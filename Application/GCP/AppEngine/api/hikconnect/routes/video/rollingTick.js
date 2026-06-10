// Periodic "tick" for the rolling export:
// - figures out which chunks are ready to be saved/polled/downloaded/merged
// - calls save / download-url / download in parallel (bounded)
// - merges in batch when possible

const { bucket } = require('../../gcs');
const { logRecording } = require('../../recordingGcsLog');

const { getRollingChunkPath } = require('./utils');
const { readRollingMeta, patchRollingMeta } = require('./rollingStorage');
const {
  ensureRollingSaveTaskOnly,
  pollRollingDownloadUrlOnce,
  downloadRollingChunkFromReadyUrl,
} = require('./rollingExport');
const { mergeRollingChunkIntoMerged, batchMergeChunksFromGcs } = require('./rollingMerge');

// Heuristic: if a predecessor is older than this and still hasn't finalized,
// consider it crashed and stop waiting on it.
const QUEUE_PREDECESSOR_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4h — supports sessions up to ~3h

/**
 * Returns true if this rolling should wait (predecessor still active).
 * Side-effect: when the predecessor is gone (finalized/crashed/expired),
 * clears `queuedBehind` from this rolling's meta so subsequent ticks proceed.
 */
async function isBlockedByPredecessor(meta) {
  const queuedBehind = meta?.queuedBehind;
  if (!queuedBehind) return false;

  const predMeta = await readRollingMeta(queuedBehind).catch(() => null);

  // Predecessor's meta is gone -> finalized + cleaned up. Proceed.
  if (!predMeta) {
    await patchRollingMeta(meta.rollingId, { queuedBehind: null }).catch(() => {});
    return false;
  }

  // Predecessor stopped (autoTick stopped or session > 30min): proceed.
  const stopped = !!predMeta.autoTickStoppedAt;
  const predBeginMs = Number(predMeta.beginMs || predMeta.createdAt || 0);
  const predTooOld =
    Number.isFinite(predBeginMs) &&
    predBeginMs > 0 &&
    Date.now() - predBeginMs > QUEUE_PREDECESSOR_MAX_AGE_MS;

  if (stopped || predTooOld) {
    await patchRollingMeta(meta.rollingId, { queuedBehind: null }).catch(() => {});
    return false;
  }

  return true;
}

async function rollingTickImpl({ rollingId, index, source = null }) {
  const meta = await readRollingMeta(rollingId);
  meta.rollingId = meta.rollingId || rollingId;

  // Safety: if session was already finalized/stopped, don't do any more work.
  if (meta?.autoTickStoppedAt && source === 'cloudtasks') {
    return {
      ok: true,
      payload: {
        rollingId,
        didWork: false,
        stopped: true,
        mergedThroughIndex: Number(meta?.mergedThroughIndex ?? -1),
      },
    };
  }

  // ── FIFO queue: if a predecessor is still running on the same device/cam,
  //    do nothing this tick. The auto-tick will retry every ~10s and will
  //    naturally start exporting as soon as the predecessor finalizes.
  if (await isBlockedByPredecessor(meta)) {
    await logRecording('ROLLING_TICK_QUEUED_WAIT', {
      rollingId,
      source: source || null,
      queuedBehind: meta.queuedBehind,
      deviceId: meta.deviceId,
      cameraId: meta.cameraId,
    });
    return {
      ok: true,
      payload: {
        rollingId,
        didWork: false,
        queuedBehind: meta.queuedBehind,
        mergedThroughIndex: Number(meta?.mergedThroughIndex ?? -1),
      },
    };
  }

  const beginMs = Number(meta?.beginMs || 0);
  const chunkMs = Number(meta?.chunkSec || 60) * 1000;
  const lagMs = Number(meta?.lagSec || 120) * 1000;
  const mergedThroughIndex = Number.isFinite(Number(meta?.mergedThroughIndex))
    ? Number(meta.mergedThroughIndex)
    : -1;

  if (!Number.isFinite(beginMs) || beginMs <= 0 || !Number.isFinite(chunkMs) || chunkMs <= 0) {
    const err = new Error('Invalid rolling meta');
    err.status = 500;
    err.details = { beginMs, chunkMs };
    throw err;
  }

  const safeEndMs = Date.now() - lagMs;
  let safeIndex = Math.floor((safeEndMs - beginMs) / chunkMs) - 1;

  // If the recording was stopped (finalize sets stopMaxIdx), cap safeIndex
  // so ticks don't try to export chunks beyond the recording end.
  const stopMaxIdx = Number.isFinite(Number(meta?.stopMaxIdx)) ? Number(meta.stopMaxIdx) : null;
  if (stopMaxIdx !== null && safeIndex > stopMaxIdx) {
    safeIndex = stopMaxIdx;
  }

  const nextIndex = mergedThroughIndex + 1;

  let idxToDo = nextIndex;
  if (index !== null && index !== undefined) {
    const requested = Number(index);
    if (!Number.isFinite(requested) || requested < 0) {
      const err = new Error('Invalid index');
      err.status = 400;
      throw err;
    }
    if (requested <= mergedThroughIndex) {
      return {
        ok: true,
        payload: {
          rollingId,
          didWork: false,
          alreadyMerged: true,
          mergedThroughIndex,
        },
      };
    }
    if (requested !== nextIndex) {
      const err = new Error('Rolling chunks must be merged sequentially');
      err.status = 409;
      err.details = {
        requestedIndex: requested,
        expectedNextIndex: nextIndex,
        mergedThroughIndex,
      };
      throw err;
    }
    idxToDo = requested;
  }

  if (idxToDo > safeIndex) {
    await logRecording('ROLLING_TICK_NOT_READY', {
      rollingId,
      source: source || null,
      idxToDo,
      safeIndex,
      nextIndex,
      mergedThroughIndex,
      lagSec: Number(meta?.lagSec || 0) || null,
      chunkSec: Number(meta?.chunkSec || 0) || null,
    });
    return {
      ok: true,
      payload: {
        rollingId,
        didWork: false,
        notReady: true,
        safeIndex,
        mergedThroughIndex,
      },
    };
  }

  const maxParallelSave = Math.max(
    1,
    Math.min(50, Number(process.env.ROLLING_PARALLEL_SAVE || 20))
  );
  const maxParallelPoll = Math.max(
    1,
    Math.min(50, Number(process.env.ROLLING_PARALLEL_POLL || 20))
  );
  const maxParallelDownload = Math.max(
    1,
    Math.min(10, Number(process.env.ROLLING_PARALLEL_DOWNLOAD || 5))
  );

  const tickT0 = Date.now();

  const candidates = [];
  for (let j = nextIndex; j <= safeIndex && candidates.length < maxParallelSave; j++) {
    candidates.push(j);
  }

  await Promise.allSettled(
    candidates.map((j) =>
      ensureRollingSaveTaskOnly({ rollingId, meta, index: j }).catch(() => null)
    )
  );

  const tickT1 = Date.now();

  const pollCandidates = candidates.slice(0, maxParallelPoll);
  const pollResults = await Promise.allSettled(
    pollCandidates.map((j) => pollRollingDownloadUrlOnce({ rollingId, index: j }))
  );

  const tickT2 = Date.now();

  const ready = [];
  for (const r of pollResults) {
    if (r.status === 'fulfilled' && r.value && r.value.ok && r.value.status === 0 && r.value.url) {
      ready.push(r.value.index);
    }
  }

  const downloads = ready.slice(0, maxParallelDownload);
  await Promise.allSettled(
    downloads.map((j) =>
      downloadRollingChunkFromReadyUrl({ rollingId, index: j, meta }).catch(() => null)
    )
  );

  const tickT3 = Date.now();

  // Batch merge: collect ALL sequential available chunks, merge in one pass.
  let mergedIdx = mergedThroughIndex;
  const chunksToMerge = [];
  {
    let checkIdx = mergedIdx + 1;
    while (checkIdx <= safeIndex) {
      const chunkPath = getRollingChunkPath(rollingId, checkIdx);
      const chunkFile = bucket.file(chunkPath);
      // eslint-disable-next-line no-await-in-loop
      const [existsChunk] = await chunkFile.exists().catch(() => [false]);
      if (!existsChunk) break;
      chunksToMerge.push({ index: checkIdx, gcsPath: chunkPath });
      checkIdx++;
    }
  }

  if (chunksToMerge.length > 0) {
    await logRecording('ROLLING_TICK_BATCH_MERGE_START', {
      rollingId,
      source: source || null,
      chunkCount: chunksToMerge.length,
      fromIndex: chunksToMerge[0].index,
      toIndex: chunksToMerge[chunksToMerge.length - 1].index,
    });

    try {
      const batchResult = await batchMergeChunksFromGcs({ rollingId, meta, chunks: chunksToMerge });
      mergedIdx = batchResult.mergedThroughIndex;
    } catch (batchErr) {
      // Fallback: try incremental merge one-by-one if batch fails
      await logRecording('ROLLING_TICK_BATCH_MERGE_FALLBACK', {
        rollingId,
        source: source || null,
        message: batchErr?.message,
        status: batchErr?.status,
      });
      for (const chunk of chunksToMerge) {
        try {
          await mergeRollingChunkIntoMerged({
            rollingId,
            meta,
            index: chunk.index,
            chunkGcsPath: chunk.gcsPath,
          });
          mergedIdx = chunk.index;
        } catch {
          break;
        }
      }
    }
  }

  const tickT4 = Date.now();

  const metaEnd = await readRollingMeta(rollingId).catch(() => meta);

  await logRecording('ROLLING_TICK_OK', {
    deviceId: metaEnd?.deviceId,
    cameraId: metaEnd?.cameraId,
    rollingId,
    source: source || null,
    index: Number(idxToDo),
    already: true,
    safeIndex,
    nextIndex,
    idxToDo,
    saveCandidatesCount: candidates.length,
    pollCandidatesCount: pollCandidates.length,
    readyCount: ready.length,
    downloadsCount: downloads.length,
    mergedThroughIndexBefore: mergedThroughIndex,
    mergedThroughIndexAfter: mergedIdx,
    mergedAdvanced: mergedIdx > mergedThroughIndex,
    mergeMode: metaEnd?.lastMergeMode || null,
    batchMergeCount: chunksToMerge.length,
    timing: {
      saveMs: tickT1 - tickT0,
      pollMs: tickT2 - tickT1,
      downloadMs: tickT3 - tickT2,
      mergeMs: tickT4 - tickT3,
      totalMs: tickT4 - tickT0,
    },
  });

  return {
    ok: true,
    payload: {
      rollingId,
      didWork: true,
      index: Number(idxToDo),
      already: true,
      mergedThroughIndex: mergedIdx,
      mergedGcsPath: metaEnd?.mergedPath || null,
      mergeMode: metaEnd?.lastMergeMode || null,
    },
  };
}

module.exports = { rollingTickImpl };
