// Merge logic for rolling export:
// - mergeRollingChunkIntoMerged: incremental merge (one chunk at a time)
// - batchMergeChunksFromGcs: collects N chunks + previous merged, single ffmpeg pass

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { bucket } = require('../../gcs');
const { concatMp4Files } = require('../../concatMp4');
const { logRecording } = require('../../recordingGcsLog');

const {
  ROLLING_CONCAT_USE_SIGNED_URLS,
  withTimeout,
  getRollingMergedPath,
  getRollingMergedVersionedPath,
  getSignedReadUrl,
} = require('./utils');

const { readRollingMeta, writeRollingMeta } = require('./rollingStorage');

// ---------------------------------------------------------------------------
// Incremental merge: append one chunk to the running merged file.
// ---------------------------------------------------------------------------
async function mergeRollingChunkIntoMerged({ rollingId, meta, index, chunkGcsPath }) {
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0) {
    const err = new Error('Invalid chunk index for merge');
    err.status = 400;
    err.details = { index };
    throw err;
  }

  // Always read latest meta to pick the right current merged file/version.
  const metaNow = await readRollingMeta(rollingId).catch(() => meta || null);
  const currentMergedPathFromMeta =
    typeof metaNow?.mergedPath === 'string' && metaNow.mergedPath ? metaNow.mergedPath : null;
  const legacyMergedPath = getRollingMergedPath(rollingId);
  const chunkFile = bucket.file(chunkGcsPath);

  const tmpDir = path.join(
    os.tmpdir(),
    `hikroll_incmerge_${String(rollingId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const stageTimeoutMs = 180_000;

    // Determine current merged file: meta.mergedPath wins, otherwise fallback to legacy merged.mp4 if it exists.
    let currentMergedPath = currentMergedPathFromMeta;
    if (!currentMergedPath) {
      const legacyFile = bucket.file(legacyMergedPath);
      const [legacyExists] = await legacyFile.exists().catch(() => [false]);
      if (legacyExists) currentMergedPath = legacyMergedPath;
    }

    const currentVersion = Number(metaNow?.mergedVersion || 0);
    const nextVersion =
      Number.isFinite(currentVersion) && currentVersion >= 0 ? currentVersion + 1 : 1;
    const outMergedPath = getRollingMergedVersionedPath(rollingId, nextVersion);
    const outMergedFile = bucket.file(outMergedPath);

    if (!currentMergedPath) {
      // First merge: simply promote the chunk to merged1.mp4
      try {
        await chunkFile.copy(outMergedFile, { preconditionOpts: { ifGenerationMatch: 0 } });
        await outMergedFile
          .setMetadata({ cacheControl: 'no-store', contentType: 'video/mp4' })
          .catch(() => {});
      } catch (e) {
        if (e?.code === 412) {
          const err = new Error('Rolling merge already in progress');
          err.status = 409;
          err.details = {
            rollingId: String(rollingId),
            index: idx,
            lockPath: 'gcs-precondition-first-v',
          };
          throw err;
        }
        e.details = { ...(e.details || {}), stage: 'copy_first_v' };
        throw e;
      }

      await chunkFile.delete({ ignoreNotFound: true }).catch(() => {});

      const updated = { ...(metaNow || meta || {}) };
      updated.mergedThroughIndex = Math.max(Number(updated.mergedThroughIndex) || -1, idx);
      updated.mergedVersion = nextVersion;
      updated.mergedPath = outMergedPath;
      updated.lastMergeMode = 'copy_first_v';
      await writeRollingMeta(rollingId, updated);

      await logRecording('ROLLING_MERGE_OK', {
        deviceId: metaNow?.deviceId ?? meta?.deviceId,
        cameraId: metaNow?.cameraId ?? meta?.cameraId,
        rollingId,
        index: idx,
        mergeMode: 'copy_first_v',
        mergedThroughIndex: updated.mergedThroughIndex,
        mergedPath: outMergedPath,
      });

      return {
        mergedThroughIndex: updated.mergedThroughIndex,
        mergedGcsPath: outMergedPath,
        mergeMode: 'copy_first_v',
      };
    }

    const currentMergedFile = bucket.file(currentMergedPath);

    const mergedLocal = path.join(tmpDir, 'merged_prev.mp4');
    const chunkLocal = path.join(tmpDir, `chunk_${String(idx).padStart(6, '0')}.mp4`);
    const outLocal = path.join(tmpDir, 'merged_new.mp4');

    let mergeInfo;
    let usedSignedUrls = false;

    // Fast path: stream inputs via GCS signed URLs directly into ffmpeg.
    if (ROLLING_CONCAT_USE_SIGNED_URLS) {
      try {
        const [mergedUrl, chunkUrl] = await Promise.all([
          getSignedReadUrl(currentMergedPath),
          getSignedReadUrl(chunkGcsPath),
        ]);
        mergeInfo = await concatMp4Files([mergedUrl, chunkUrl], outLocal, {
          timeoutMs: 2 * 60 * 1000,
        });
        usedSignedUrls = true;
      } catch (eUrl) {
        await logRecording('ROLLING_MERGE_SIGNED_URL_FALLBACK', {
          rollingId: String(rollingId),
          index: idx,
          message: eUrl?.message,
          reason: eUrl?.details?.reason,
          stderr: eUrl?.details?.stderr?.slice(-2000),
          args: eUrl?.details?.args,
          tsStderr: eUrl?.details?.tsStderr?.slice(-2000),
          tsArgs: eUrl?.details?.tsArgs,
        }).catch(() => {});
        // fall through to legacy download-then-concat below
      }
    }

    if (!usedSignedUrls) {
      try {
        await Promise.all([
          withTimeout(currentMergedFile.download({ destination: mergedLocal }), stageTimeoutMs, {
            message: 'Timeout downloading merged file',
            details: { rollingId: String(rollingId), index: idx },
          }),
          withTimeout(chunkFile.download({ destination: chunkLocal }), stageTimeoutMs, {
            message: 'Timeout downloading chunk mp4',
            details: { rollingId: String(rollingId), index: idx, chunkGcsPath },
          }),
        ]);
      } catch (e) {
        e.details = { ...(e.details || {}), stage: 'download_inputs' };
        throw e;
      }

      try {
        mergeInfo = await concatMp4Files([mergedLocal, chunkLocal], outLocal, {
          timeoutMs: 2 * 60 * 1000,
        });
      } catch (e) {
        e.details = { ...(e.details || {}), stage: 'ffmpeg_concat' };
        throw e;
      }
    }

    try {
      await bucket.upload(outLocal, {
        destination: outMergedPath,
        resumable: false,
        contentType: 'video/mp4',
        metadata: { cacheControl: 'no-store' },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (e) {
      if (e?.code === 412) {
        const err = new Error('Rolling merge already in progress');
        err.status = 409;
        err.details = {
          rollingId: String(rollingId),
          index: idx,
          lockPath: 'gcs-precondition-upload-v',
        };
        throw err;
      }
      e.details = { ...(e.details || {}), stage: 'upload_merged' };
      throw e;
    }

    await chunkFile.delete({ ignoreNotFound: true }).catch(() => {});
    // Cleanup old merged file so only the latest mergedX.mp4 remains.
    await bucket.file(currentMergedPath).delete({ ignoreNotFound: true }).catch(() => {});

    const updated = { ...(metaNow || meta || {}) };
    updated.mergedThroughIndex = Math.max(Number(updated.mergedThroughIndex) || -1, idx);
    updated.mergedVersion = nextVersion;
    updated.mergedPath = outMergedPath;
    updated.lastMergeMode = mergeInfo?.mode || null;
    await writeRollingMeta(rollingId, updated);

    await logRecording('ROLLING_MERGE_OK', {
      deviceId: metaNow?.deviceId ?? meta?.deviceId,
      cameraId: metaNow?.cameraId ?? meta?.cameraId,
      rollingId,
      index: idx,
      mergeMode: mergeInfo?.mode,
      inputSource: usedSignedUrls ? 'signed_url' : 'local_download',
      mergedThroughIndex: updated.mergedThroughIndex,
      mergedPath: outMergedPath,
    });

    return {
      mergedThroughIndex: updated.mergedThroughIndex,
      mergedGcsPath: outMergedPath,
      mergeMode: mergeInfo?.mode,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Batch merge: download merged + N chunks locally, one ffmpeg concat, upload once.
// Avoids the O(N²) GCS I/O of incremental merge (download growing merged each time).
// ---------------------------------------------------------------------------
async function batchMergeChunksFromGcs({ rollingId, meta, chunks }) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { mergedCount: 0, timing: {} };
  }

  const t0 = Date.now();

  const metaNow = await readRollingMeta(rollingId).catch(() => meta || null);
  const currentMergedPath =
    typeof metaNow?.mergedPath === 'string' && metaNow.mergedPath ? metaNow.mergedPath : null;
  const currentVersion = Number(metaNow?.mergedVersion || 0);
  const nextVersion =
    Number.isFinite(currentVersion) && currentVersion >= 0 ? currentVersion + 1 : 1;
  const outMergedPath = getRollingMergedVersionedPath(rollingId, nextVersion);

  const tmpDir = path.join(
    os.tmpdir(),
    `hikroll_batch_${String(rollingId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const tDownloadStart = Date.now();

    // Ordered list of inputs to feed to ffmpeg (merged_prev first, then chunks by index).
    const orderedInputs = [];
    let usedSignedUrls = false;
    let tDownloadEnd;

    if (ROLLING_CONCAT_USE_SIGNED_URLS) {
      try {
        const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);
        const urlTasks = [];
        if (currentMergedPath) urlTasks.push(getSignedReadUrl(currentMergedPath));
        for (const c of sortedChunks) urlTasks.push(getSignedReadUrl(c.gcsPath));
        const urls = await Promise.all(urlTasks);
        orderedInputs.push(...urls);
        usedSignedUrls = true;
        tDownloadEnd = Date.now();
      } catch (eUrl) {
        await logRecording('BATCH_MERGE_SIGNED_URL_FALLBACK', {
          rollingId: String(rollingId),
          chunkCount: chunks.length,
          message: eUrl?.message,
          reason: eUrl?.details?.reason,
          stderr: eUrl?.details?.stderr?.slice(-2000),
          args: eUrl?.details?.args,
          tsStderr: eUrl?.details?.tsStderr?.slice(-2000),
          tsArgs: eUrl?.details?.tsArgs,
        }).catch(() => {});
        // fall through to local download below
      }
    }

    if (!usedSignedUrls) {
      // Legacy path: download current merged in parallel with all chunks.
      const downloadTasks = [];

      if (currentMergedPath) {
        const localMerged = path.join(tmpDir, 'merged_prev.mp4');
        downloadTasks.push(
          withTimeout(
            bucket.file(currentMergedPath).download({ destination: localMerged }),
            3 * 60_000,
            { message: 'Timeout downloading merged for batch', details: { rollingId } }
          ).then(() => ({ type: 'merged', localPath: localMerged }))
        );
      }

      for (const chunk of chunks) {
        const localPath = path.join(tmpDir, `chunk_${String(chunk.index).padStart(6, '0')}.mp4`);
        downloadTasks.push(
          withTimeout(
            bucket.file(chunk.gcsPath).download({ destination: localPath }),
            2 * 60_000,
            {
              message: 'Timeout downloading chunk for batch',
              details: { rollingId, index: chunk.index },
            }
          ).then(() => ({ type: 'chunk', index: chunk.index, localPath }))
        );
      }

      const dlResults = await Promise.all(downloadTasks);
      tDownloadEnd = Date.now();

      const mergedResult = dlResults.find((r) => r.type === 'merged');
      if (mergedResult) orderedInputs.push(mergedResult.localPath);
      const chunkResults = dlResults
        .filter((r) => r.type === 'chunk')
        .sort((a, b) => a.index - b.index);
      for (const cr of chunkResults) orderedInputs.push(cr.localPath);
    }

    // 2) Single ffmpeg concat
    const tConcatStart = Date.now();
    let mergeMode;
    const outLocal = path.join(tmpDir, 'merged_batch.mp4');

    if (orderedInputs.length === 1) {
      // Single input edge case: no merged_prev + only 1 chunk.
      // Do a server-side GCS copy (no download, no ffmpeg).
      const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);
      await bucket.file(sortedChunks[0].gcsPath).copy(bucket.file(outMergedPath));
      mergeMode = 'batch_copy_single_gcs';
    } else {
      const mergeInfo = await concatMp4Files(orderedInputs, outLocal, {
        timeoutMs: 5 * 60 * 1000,
      });
      mergeMode = `batch_${mergeInfo?.mode || 'concat'}${usedSignedUrls ? '_url' : ''}`;
    }
    const tConcatEnd = Date.now();

    // 3) Upload result (skipped for batch_copy_single_gcs, already copied in GCS).
    const tUploadStart = Date.now();
    if (mergeMode !== 'batch_copy_single_gcs') {
      await bucket.upload(outLocal, {
        destination: outMergedPath,
        resumable: false,
        contentType: 'video/mp4',
        metadata: { cacheControl: 'no-store' },
      });
    }
    const tUploadEnd = Date.now();

    // 4) Cleanup: delete individual chunks + old merged from GCS (non-blocking)
    const cleanupTargets = [
      ...chunks.map((c) => c.gcsPath),
      ...(currentMergedPath ? [currentMergedPath] : []),
    ];
    await Promise.allSettled(
      cleanupTargets.map((p) =>
        bucket.file(p).delete({ ignoreNotFound: true }).catch(() => {})
      )
    );

    // 5) Update meta
    const lastIndex = chunks[chunks.length - 1].index;
    const updated = { ...(metaNow || meta || {}) };
    updated.mergedThroughIndex = Math.max(Number(updated.mergedThroughIndex) || -1, lastIndex);
    updated.mergedVersion = nextVersion;
    updated.mergedPath = outMergedPath;
    updated.lastMergeMode = mergeMode;
    await writeRollingMeta(rollingId, updated);

    const tEnd = Date.now();
    const timing = {
      totalMs: tEnd - t0,
      downloadMs: tDownloadEnd - tDownloadStart,
      concatMs: tConcatEnd - tConcatStart,
      uploadMs: tUploadEnd - tUploadStart,
    };

    await logRecording('BATCH_MERGE_OK', {
      deviceId: metaNow?.deviceId ?? meta?.deviceId,
      cameraId: metaNow?.cameraId ?? meta?.cameraId,
      rollingId,
      chunkCount: chunks.length,
      fileCount: orderedInputs.length,
      mergeMode,
      inputSource: usedSignedUrls ? 'signed_url' : 'local_download',
      mergedThroughIndex: updated.mergedThroughIndex,
      mergedPath: outMergedPath,
      ...timing,
    });

    return {
      mergedCount: chunks.length,
      mergedThroughIndex: updated.mergedThroughIndex,
      mergedPath: outMergedPath,
      mergeMode,
      timing,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

module.exports = {
  mergeRollingChunkIntoMerged,
  batchMergeChunksFromGcs,
};
