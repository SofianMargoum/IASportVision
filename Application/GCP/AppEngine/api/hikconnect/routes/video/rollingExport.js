// Per-chunk export logic for the rolling export:
// - ensureRollingSaveTaskOnly: create the HikConnect "save" task only
// - pollRollingDownloadUrlOnce: one poll on the download-url status
// - downloadRollingChunkFromReadyUrl: download a chunk whose URL is ready
// - waitForDownloadUrlMaybeLogged: like waitForDownloadUrl but with extra logs
// - exportRollingChunkByIndex: full save->wait->download->upload pipeline

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { bucket } = require('../../gcs');
const { saveVideoWithRetry, getDownloadUrl, waitForDownloadUrl } = require('../../video');
const { getDefaultOffset } = require('../../recording');
const { concatMp4Files } = require('../../concatMp4');
const { logSofian } = require('../../recordingGcsLog');

const {
  ROLLING_LOG_DOWNLOADURL_EVERY,
  ROLLING_SPLIT_ON_TIMEOUT,
  ROLLING_SPLIT_PART_SEC,
  sleep,
  toFixedOffsetIsoFromMs,
  chunkIndexToName,
  getRollingChunkPath,
  getRollingTaskStatePath,
  downloadToFile,
  computeRollingDownloadTimeoutMs,
} = require('./utils');

const {
  readJsonIfExists,
  writeRollingTaskState,
  updateRollingTaskState,
  acquireRollingChunkLock,
  releaseRollingChunkLock,
} = require('./rollingStorage');

// ---------------------------------------------------------------------------
// One-shot poll on download-url
// ---------------------------------------------------------------------------
async function pollRollingDownloadUrlOnce({ rollingId, index }) {
  const idx = Number(index);
  const st = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(() => null);
  const taskId = st?.taskId;
  if (!taskId) return { ok: false, reason: 'no_taskId' };

  const data = await getDownloadUrl({ taskId });
  const status = data?.data?.status;
  const urls = Array.isArray(data?.data?.urls) ? data.data.urls : [];
  const url = status === 0 && urls.length > 0 ? urls[0] : null;

  const pollCount = (Number(st?.downloadUrlPollCount) || 0) + 1;
  const prevLogged = st?.lastLoggedDownloadStatus;
  const statusChanged =
    prevLogged === undefined || prevLogged === null
      ? true
      : Number(prevLogged) !== Number(status);
  const shouldLog = ROLLING_LOG_DOWNLOADURL_EVERY || statusChanged;

  if (shouldLog) {
    await logSofian("l'api download-url a été exécutée avec cette taskId", {
      rollingId: String(rollingId),
      index: idx,
      taskId,
      downloadUrlStatus: status,
      urlsCount: urls.length,
      pollCount,
      statusChanged,
    });
  }

  await updateRollingTaskState(rollingId, idx, {
    lastDownloadUrlPollAt: Date.now(),
    lastDownloadStatus: status,
    lastLoggedDownloadStatus: shouldLog ? status : prevLogged,
    downloadUrlPollCount: pollCount,
    readyUrl: url || st?.readyUrl || null,
    readyAt: url ? Date.now() : st?.readyAt || null,
  }).catch(() => {});

  return { ok: true, index: idx, taskId, status, url };
}

// ---------------------------------------------------------------------------
// Download a chunk whose URL is already ready (status=0 polled before)
// ---------------------------------------------------------------------------
async function downloadRollingChunkFromReadyUrl({ rollingId, index, meta }) {
  const idx = Number(index);
  const gcsPath = getRollingChunkPath(rollingId, idx);
  const gcsFile = bucket.file(gcsPath);
  const [exists] = await gcsFile.exists().catch(() => [false]);
  if (exists) return { already: true, index: idx, gcsPath };

  const taskState = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(
    () => null
  );
  const url = taskState?.readyUrl;
  const taskId = taskState?.taskId;
  if (!url || !taskId) {
    const err = new Error('Chunk not ready for download');
    err.status = 409;
    err.details = { rollingId: String(rollingId), index: idx };
    throw err;
  }

  // Lock to prevent duplicate parallel downloads for same chunk.
  const lockFile = await acquireRollingChunkLock({ rollingId, index: idx }).catch((e) => {
    if (e?.status === 409) return null;
    throw e;
  });
  if (!lockFile) {
    const [existsAfter] = await gcsFile.exists().catch(() => [false]);
    if (existsAfter) return { already: true, index: idx, gcsPath };
    const err = new Error('Chunk download already in progress');
    err.status = 409;
    err.details = { rollingId: String(rollingId), index: idx };
    throw err;
  }

  const chunkName = chunkIndexToName(idx);
  try {
    await logSofian('cette taskId a un status 0 donc on va télécharger la vidéo', {
      rollingId: String(rollingId),
      index: idx,
      taskId,
      chunk: chunkName,
    });

    const tmpDir = path.join(
      os.tmpdir(),
      `hikroll_dl_${String(rollingId)}_${idx}_${Date.now()}_${crypto
        .randomBytes(3)
        .toString('hex')}`
    );
    fs.mkdirSync(tmpDir, { recursive: true });
    const localPath = path.join(tmpDir, chunkName);

    try {
      await downloadToFile(url, localPath);
      await bucket.upload(localPath, {
        destination: gcsPath,
        contentType: 'video/mp4',
        metadata: { cacheControl: 'public, max-age=3600' },
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }

    await updateRollingTaskState(rollingId, idx, {
      downloadedAt: Date.now(),
      downloadedGcsPath: gcsPath,
    }).catch(() => {});

    await logSofian('chunk téléchargé', {
      rollingId: String(rollingId),
      index: idx,
      chunk: chunkName,
      gcsPath,
    });

    return { already: false, index: idx, gcsPath };
  } finally {
    await releaseRollingChunkLock(lockFile);
  }
}

// ---------------------------------------------------------------------------
// Create a save task only (no download); persists taskId in GCS state.
// ---------------------------------------------------------------------------
async function ensureRollingSaveTaskOnly({ rollingId, meta, index, endMsOverride = null }) {
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0) {
    const err = new Error('Invalid chunk index');
    err.status = 400;
    err.details = { index };
    throw err;
  }

  const existing = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(
    () => null
  );
  if (existing?.taskId) {
    return {
      already: true,
      index: idx,
      taskId: existing.taskId,
      beginTime: existing.beginTime,
      endTime: existing.endTime,
    };
  }

  // Reuse the same per-chunk lock so we don't race exportRollingChunkByIndex.
  const lockFile = await acquireRollingChunkLock({ rollingId, index: idx }).catch((e) => {
    if (e?.status === 409) return null;
    throw e;
  });
  if (!lockFile) {
    const existingAfter = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(
      () => null
    );
    if (existingAfter?.taskId) {
      return {
        already: true,
        index: idx,
        taskId: existingAfter.taskId,
        beginTime: existingAfter.beginTime,
        endTime: existingAfter.endTime,
      };
    }
    const err = new Error('Chunk task creation already in progress');
    err.status = 409;
    err.details = { rollingId: String(rollingId), index: idx };
    throw err;
  }

  try {
    const chunkMs = Number(meta?.chunkSec || 60) * 1000;
    const beginMs0 = Number(meta?.beginMs);
    const offset = String(meta?.offset || getDefaultOffset());
    if (!Number.isFinite(beginMs0) || beginMs0 <= 0) {
      const err = new Error('Invalid rolling meta (beginMs)');
      err.status = 500;
      err.details = meta;
      throw err;
    }
    if (!Number.isFinite(chunkMs) || chunkMs <= 0) {
      const err = new Error('Invalid rolling meta (chunkSec)');
      err.status = 500;
      err.details = meta;
      throw err;
    }

    const beginMs = beginMs0 + idx * chunkMs;
    const endMs =
      endMsOverride && Number.isFinite(endMsOverride)
        ? Math.min(beginMs + chunkMs, Number(endMsOverride))
        : beginMs + chunkMs;
    const beginTime = toFixedOffsetIsoFromMs(beginMs, offset);
    const endTime = toFixedOffsetIsoFromMs(endMs, offset);

    const payload = {
      cameraId: meta?.cameraId,
      beginTime,
      endTime,
      voiceSwitch: Number(meta?.voiceSwitch) === 0 ? 2 : Number(meta?.voiceSwitch),
    };

    await logSofian("l'api save a été exécutée avec ce payload", {
      rollingId: String(rollingId),
      index: idx,
      payload,
    });

    const save = await saveVideoWithRetry(payload, { maxAttempts: 8, baseDelayMs: 1500 });
    const taskId = save?.data?.taskId;
    if (!taskId) {
      const err = new Error('taskId missing from save response');
      err.status = 502;
      err.details = { save, index: idx, beginTime, endTime };
      throw err;
    }

    await logSofian("l'api save nous a renvoyé cette taskId", {
      rollingId: String(rollingId),
      index: idx,
      taskId,
    });

    await writeRollingTaskState(rollingId, idx, {
      v: 1,
      rollingId: String(rollingId),
      index: idx,
      createdAt: Date.now(),
      taskId,
      beginTime,
      endTime,
    });

    return { already: false, index: idx, taskId, beginTime, endTime };
  } finally {
    await releaseRollingChunkLock(lockFile);
  }
}

// ---------------------------------------------------------------------------
// waitForDownloadUrl with optional per-poll logging.
// ---------------------------------------------------------------------------
async function waitForDownloadUrlMaybeLogged({
  rollingId,
  index,
  taskId,
  timeoutMs,
  intervalMs,
}) {
  if (!ROLLING_LOG_DOWNLOADURL_EVERY) {
    return waitForDownloadUrl(taskId, timeoutMs, intervalMs);
  }

  const start = Date.now();
  let polls = 0;
  let lastData = null;
  let lastStatus = null;

  while (Date.now() - start < timeoutMs) {
    const data = await getDownloadUrl({ taskId });
    polls += 1;
    lastData = data;

    const status = data?.data?.status;
    lastStatus = status;
    const urls = Array.isArray(data?.data?.urls) ? data.data.urls : [];

    await logSofian("l'api download-url a été exécutée avec cette taskId", {
      rollingId: String(rollingId),
      index: Number(index),
      taskId,
      downloadUrlStatus: status,
      urlsCount: urls.length,
      poll: polls,
      elapsedMs: Date.now() - start,
      timeoutMs,
    });

    if (status === 0 && urls.length > 0) return urls[0];

    if (status === 2) {
      const err = new Error('Video upload failed on HikConnect');
      err.status = 502;
      err.details = data;
      throw err;
    }

    await sleep(intervalMs);
  }

  const err = new Error('Timeout waiting for download URL');
  err.status = 504;
  err.details = {
    taskId,
    timeoutMs,
    intervalMs,
    polls,
    lastStatus,
    lastData,
  };
  throw err;
}

// ---------------------------------------------------------------------------
// Full save -> wait -> download -> upload pipeline for a single chunk.
// ---------------------------------------------------------------------------
async function exportRollingChunkByIndex({
  rollingId,
  meta,
  index,
  endMsOverride = null,
  timeoutMsOverride = null,
  allowRequeue = true,
}) {
  const chunkMs = Number(meta?.chunkSec || 60) * 1000;
  const beginMs0 = Number(meta?.beginMs);
  const offset = String(meta?.offset || getDefaultOffset());
  if (!Number.isFinite(beginMs0) || beginMs0 <= 0) {
    const err = new Error('Invalid rolling meta (beginMs)');
    err.status = 500;
    err.details = meta;
    throw err;
  }
  if (!Number.isFinite(chunkMs) || chunkMs <= 0) {
    const err = new Error('Invalid rolling meta (chunkSec)');
    err.status = 500;
    err.details = meta;
    throw err;
  }

  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0 || idx > 20000) {
    const err = new Error('Invalid chunk index');
    err.status = 400;
    err.details = { index };
    throw err;
  }

  const gcsPath = getRollingChunkPath(rollingId, idx);
  const gcsFile = bucket.file(gcsPath);
  const [exists] = await gcsFile.exists();
  if (exists) {
    return { already: true, index: idx, gcsPath };
  }

  // Prevent duplicate parallel exports for the same chunk index.
  let lockFile = await acquireRollingChunkLock({ rollingId, index: idx }).catch((e) => {
    if (e?.status === 409) return null;
    throw e;
  });

  if (!lockFile) {
    // Another process holds the lock — poll GCS until the chunk appears or the lock is released.
    const WAIT_POLL_MS = 5_000; // check every 5s
    const WAIT_TIMEOUT_MS = 2 * 60_000; // give up after 2 min (must be << GAE 10-min timeout)
    const waitStart = Date.now();

    await logSofian('chunk lock détecté, on attend que le chunk apparaisse dans GCS', {
      rollingId: String(rollingId),
      index: idx,
      waitTimeoutMs: WAIT_TIMEOUT_MS,
    });

    while (Date.now() - waitStart < WAIT_TIMEOUT_MS) {
      const [existsNow] = await gcsFile.exists();
      if (existsNow) return { already: true, index: idx, gcsPath };

      const retryLock = await acquireRollingChunkLock({ rollingId, index: idx }).catch(
        () => null
      );
      if (retryLock) {
        lockFile = retryLock;
        await logSofian('lock récupéré après attente, on continue export', {
          rollingId: String(rollingId),
          index: idx,
          waitedMs: Date.now() - waitStart,
        });
        break;
      }

      await sleep(WAIT_POLL_MS);
    }

    if (!lockFile) {
      const [existsFinal] = await gcsFile.exists();
      if (existsFinal) return { already: true, index: idx, gcsPath };
      const err = new Error('Chunk export already in progress');
      err.status = 409;
      err.details = { rollingId: String(rollingId), index: idx, gcsPath };
      throw err;
    }
  }

  const beginMs = beginMs0 + idx * chunkMs;
  const endMs =
    endMsOverride && Number.isFinite(endMsOverride)
      ? Math.min(beginMs + chunkMs, Number(endMsOverride))
      : beginMs + chunkMs;
  if (endMs <= beginMs) {
    const err = new Error('Invalid chunk time window');
    err.status = 400;
    err.details = { beginMs, endMs, index: idx };
    throw err;
  }

  const beginTime = toFixedOffsetIsoFromMs(beginMs, offset);
  const endTime = toFixedOffsetIsoFromMs(endMs, offset);
  const chunkName = chunkIndexToName(idx);

  // If a taskId was already created (prefetch), reuse it.
  const taskState = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(
    () => null
  );
  let existingTaskId = taskState?.taskId || null;

  try {
    const payload = {
      cameraId: meta?.cameraId,
      beginTime,
      endTime,
      voiceSwitch: Number(meta?.voiceSwitch) === 0 ? 2 : Number(meta?.voiceSwitch),
    };

    const doSave = async () =>
      saveVideoWithRetry(payload, { maxAttempts: 8, baseDelayMs: 1500 });

    let save = null;
    let taskId = existingTaskId;
    if (!taskId) {
      await logSofian("l'api save a été exécutée avec ce payload", {
        rollingId: String(rollingId),
        index: idx,
        payload,
      });

      try {
        save = await doSave();
      } catch (eSave) {
        await logSofian("l'api save a échoué", {
          rollingId: String(rollingId),
          index: idx,
          message: eSave?.message,
          status: eSave?.status,
          details: eSave?.details,
        });
        throw eSave;
      }
      taskId = save?.data?.taskId;
      if (!taskId) {
        const err = new Error('taskId missing from save response');
        err.status = 502;
        err.details = { save, index: idx, beginTime, endTime };
        throw err;
      }

      await logSofian("l'api save nous a renvoyé cette taskId", {
        rollingId: String(rollingId),
        index: idx,
        taskId,
      });

      await writeRollingTaskState(rollingId, idx, {
        v: 1,
        rollingId: String(rollingId),
        index: idx,
        createdAt: Date.now(),
        taskId,
        beginTime,
        endTime,
      }).catch(() => {});
    }

    // Snapshot one download-url call for observability (avoid spamming per poll)
    try {
      const snap = await getDownloadUrl({ taskId });
      const snapStatus = snap?.data?.status;
      const snapUrls = Array.isArray(snap?.data?.urls) ? snap.data.urls : [];
      await logSofian("l'api download-url a été exécutée avec cette taskId", {
        rollingId: String(rollingId),
        index: idx,
        taskId,
        downloadUrlStatus: snapStatus,
        urlsCount: snapUrls.length,
      });
      if (snapStatus === 0 && snapUrls.length > 0) {
        // Use the ready URL immediately to reduce extra polling.
        const tmpDir = path.join(
          os.tmpdir(),
          `hikroll_${String(rollingId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
        );
        fs.mkdirSync(tmpDir, { recursive: true });
        const localPath = path.join(tmpDir, chunkName);

        try {
          await logSofian('cette taskId a un status 0 donc on va télécharger la vidéo', {
            rollingId: String(rollingId),
            index: idx,
            taskId,
            chunk: chunkName,
          });
          await downloadToFile(snapUrls[0], localPath);
          await bucket.upload(localPath, {
            destination: gcsPath,
            contentType: 'video/mp4',
            metadata: { cacheControl: 'public, max-age=3600' },
          });
          await logSofian('chunk téléchargé', {
            rollingId: String(rollingId),
            index: idx,
            chunk: chunkName,
            gcsPath,
          });
        } finally {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {}
        }

        return { already: false, index: idx, gcsPath, taskId, beginTime, endTime };
      }
    } catch (eSnap) {
      await logSofian("l'api download-url a échoué (snapshot)", {
        rollingId: String(rollingId),
        index: idx,
        taskId,
        message: eSnap?.message,
        status: eSnap?.status,
      });
    }

    const timeoutMsBase = Number.isFinite(timeoutMsOverride)
      ? Number(timeoutMsOverride)
      : computeRollingDownloadTimeoutMs(beginTime, endTime);

    const durationSec = Math.max(0, Math.round((Number(endMs) - Number(beginMs)) / 1000));
    const isShortSegment = durationSec > 0 && durationSec <= 45;

    // For very short STOP exports (ex: 10-30s), HikConnect can sometimes keep status=1 for a while.
    // Empirically, re-creating the save task can yield a new taskId that becomes ready quickly.
    const pollIntervalMs = 3000;
    const maxRequeues = allowRequeue ? (isShortSegment ? 3 : 2) : 0;
    const perAttemptTimeoutMs = isShortSegment
      ? Math.min(timeoutMsBase, 60_000)
      : timeoutMsBase;

    const durationMs = Math.max(0, Number(endMs) - Number(beginMs));
    const canSplitOnTimeout =
      !!ROLLING_SPLIT_ON_TIMEOUT &&
      durationMs >= Math.max(1, ROLLING_SPLIT_PART_SEC * 2) * 1000;
    let didSplitFallback = false;

    const splitFallback = async () => {
      // Split into 2 parts: [begin, mid] + [mid, end]
      const partMs = ROLLING_SPLIT_PART_SEC * 1000;
      let midMs = beginMs + partMs;
      if (!(midMs > beginMs && midMs < endMs)) {
        midMs = beginMs + Math.floor(durationMs / 2);
      }
      // Avoid tiny trailing part (keep at least 10s).
      if (endMs - midMs < 10_000) {
        midMs = beginMs + Math.floor(durationMs / 2);
      }

      const p1 = { beginMs: beginMs, endMs: midMs };
      const p2 = { beginMs: midMs, endMs: endMs };
      const p1Begin = toFixedOffsetIsoFromMs(p1.beginMs, offset);
      const p1End = toFixedOffsetIsoFromMs(p1.endMs, offset);
      const p2Begin = toFixedOffsetIsoFromMs(p2.beginMs, offset);
      const p2End = toFixedOffsetIsoFromMs(p2.endMs, offset);

      await logSofian('split fallback: export chunk en 2 sous-segments', {
        rollingId: String(rollingId),
        index: idx,
        original: { beginTime, endTime, durationSec },
        partSec: ROLLING_SPLIT_PART_SEC,
        parts: [
          { beginTime: p1Begin, endTime: p1End },
          { beginTime: p2Begin, endTime: p2End },
        ],
      });

      const tmpDir = path.join(
        os.tmpdir(),
        `hikroll_split_${String(rollingId)}_${idx}_${Date.now()}_${crypto
          .randomBytes(3)
          .toString('hex')}`
      );
      fs.mkdirSync(tmpDir, { recursive: true });

      try {
        const partsLocal = [
          path.join(tmpDir, `part_a_${chunkName}`),
          path.join(tmpDir, `part_b_${chunkName}`),
        ];
        const outLocal = path.join(tmpDir, chunkName);

        const parts = [
          { beginTime: p1Begin, endTime: p1End, localPath: partsLocal[0] },
          { beginTime: p2Begin, endTime: p2End, localPath: partsLocal[1] },
        ];

        const created = [];
        for (let i = 0; i < parts.length; i++) {
          const seg = parts[i];
          const payloadPart = {
            cameraId: meta?.cameraId,
            beginTime: seg.beginTime,
            endTime: seg.endTime,
            voiceSwitch: Number(meta?.voiceSwitch) === 0 ? 2 : Number(meta?.voiceSwitch),
          };

          await logSofian("split fallback: l'api save a été exécutée avec ce payload", {
            rollingId: String(rollingId),
            index: idx,
            part: i,
            payload: payloadPart,
          });

          const savePart = await saveVideoWithRetry(payloadPart, {
            maxAttempts: 8,
            baseDelayMs: 1500,
          });
          const partTaskId = savePart?.data?.taskId;
          if (!partTaskId) {
            const err = new Error('taskId missing from save response (split part)');
            err.status = 502;
            err.details = {
              index: idx,
              part: i,
              save: savePart,
              beginTime: seg.beginTime,
              endTime: seg.endTime,
            };
            throw err;
          }

          const partTimeoutMs = computeRollingDownloadTimeoutMs(seg.beginTime, seg.endTime);
          const partUrl = await waitForDownloadUrlMaybeLogged({
            rollingId,
            index: idx,
            taskId: partTaskId,
            timeoutMs: partTimeoutMs,
            intervalMs: pollIntervalMs,
          });

          await downloadToFile(partUrl, seg.localPath);
          created.push({
            part: i,
            taskId: partTaskId,
            beginTime: seg.beginTime,
            endTime: seg.endTime,
          });
        }

        const mergeInfo = await concatMp4Files(partsLocal, outLocal, { timeoutMs: 2 * 60 * 1000 });

        await bucket.upload(outLocal, {
          destination: gcsPath,
          contentType: 'video/mp4',
          metadata: { cacheControl: 'public, max-age=3600' },
        });

        await updateRollingTaskState(rollingId, idx, {
          splitFallback: true,
          splitPartSec: ROLLING_SPLIT_PART_SEC,
          splitParts: created,
          downloadedAt: Date.now(),
          downloadedGcsPath: gcsPath,
          splitMergeMode: mergeInfo?.mode || null,
        }).catch(() => {});

        await logSofian('split fallback: chunk téléchargé/assemblé', {
          rollingId: String(rollingId),
          index: idx,
          gcsPath,
          mergeMode: mergeInfo?.mode || null,
          parts: created.map((p) => ({ part: p.part, taskId: p.taskId })),
        });

        return { already: false, index: idx, gcsPath, splitFallback: true };
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    };

    let url;
    let requeueCount = 0;
    while (true) {
      try {
        url = await waitForDownloadUrlMaybeLogged({
          rollingId,
          index: idx,
          taskId,
          timeoutMs: perAttemptTimeoutMs,
          intervalMs: pollIntervalMs,
        });
        break;
      } catch (e) {
        if (e?.status === 504 && requeueCount < maxRequeues) {
          const prevTaskId = taskId;
          requeueCount += 1;

          save = await doSave();
          taskId = save?.data?.taskId;
          if (!taskId) {
            const err = new Error('taskId missing from save response (requeue)');
            err.status = 502;
            err.details = { save, index: idx, beginTime, endTime };
            throw err;
          }

          await logSofian('requeue save: nouvelle taskId', {
            rollingId: String(rollingId),
            index: idx,
            taskId,
            prevTaskId,
            requeueCount,
            maxRequeues,
            durationSec,
            perAttemptTimeoutMs,
          });

          await writeRollingTaskState(rollingId, idx, {
            v: 1,
            rollingId: String(rollingId),
            index: idx,
            createdAt: Date.now(),
            taskId,
            beginTime,
            endTime,
            requeued: true,
            requeueCount,
            prevTaskId,
          }).catch(() => {});
          continue;
        }

        // Fallback: split the chunk into smaller exports and concat.
        if (e?.status === 504 && canSplitOnTimeout && !didSplitFallback) {
          didSplitFallback = true;
          try {
            return await splitFallback();
          } catch (splitErr) {
            await logSofian('split fallback: échec', {
              rollingId: String(rollingId),
              index: idx,
              message: splitErr?.message,
              status: splitErr?.status,
            });
            throw splitErr;
          }
        }
        throw e;
      }
    }

    await logSofian('cette taskId a un status 0 donc on va télécharger la vidéo', {
      rollingId: String(rollingId),
      index: idx,
      taskId,
      chunk: chunkName,
    });

    const tmpDir = path.join(
      os.tmpdir(),
      `hikroll_${String(rollingId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
    );
    fs.mkdirSync(tmpDir, { recursive: true });
    const localPath = path.join(tmpDir, chunkName);

    try {
      await downloadToFile(url, localPath);
      await bucket.upload(localPath, {
        destination: gcsPath,
        contentType: 'video/mp4',
        metadata: { cacheControl: 'public, max-age=3600' },
      });
      await logSofian('chunk téléchargé', {
        rollingId: String(rollingId),
        index: idx,
        chunk: chunkName,
        gcsPath,
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }

    return { already: false, index: idx, gcsPath, taskId, beginTime, endTime };
  } finally {
    await releaseRollingChunkLock(lockFile);
  }
}

module.exports = {
  pollRollingDownloadUrlOnce,
  downloadRollingChunkFromReadyUrl,
  ensureRollingSaveTaskOnly,
  waitForDownloadUrlMaybeLogged,
  exportRollingChunkByIndex,
};
