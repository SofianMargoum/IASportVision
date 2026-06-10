// Rolling export HTTP routes:
//   POST /hikconnect/video/rolling/start
//   POST /hikconnect/video/rolling/tick
//   POST /hikconnect/video/rolling/auto-tick
//   POST /hikconnect/video/rolling/finalize

const crypto = require('crypto');
const express = require('express');

const { bucket } = require('../../gcs');
const { getDefaultOffset, setManualRecordingState } = require('../../recording');
const { logRecording } = require('../../recordingGcsLog');

const {
  ROLLING_AUTOTICK_INTERVAL_SEC,
  normalizeVoiceSwitch,
  safeJoinGcsPath,
  getRollingPrefix,
  getRollingChunkPath,
  getRollingMergedPath,
} = require('./utils');

const {
  getAutoTickConfigReport,
  isAutoTickConfigured,
  requireAutoTickSecret,
  enqueueRollingAutoTick,
  enqueueRollingFinalize,
} = require('./autotick');

const {
  readRollingMeta,
  writeRollingMeta,
  patchRollingMeta,
  swapDeviceRollingTail,
  clearDeviceRollingTailIfHead,
  readDeviceRollingTail,
  readDeviceDownloadIndex,
  appendDeviceDownloadIndex,
  removeFromDeviceDownloadIndex,
  DOWNLOAD_INDEX_TTL_MS,
} = require('./rollingStorage');

const { exportRollingChunkByIndex } = require('./rollingExport');
const { mergeRollingChunkIntoMerged } = require('./rollingMerge');
const { rollingTickImpl } = require('./rollingTick');

// Thumbnail (cover + 2 logos) generator. Loaded lazily so this module still
// works in environments where canvas is unavailable.
let _runMergeImages = null;
try {
  const mod = require('../../../mergeImages');
  _runMergeImages = typeof mod?.runMergeImages === 'function' ? mod.runMergeImages : null;
} catch (e) {
  _runMergeImages = null;
}

function sanitizeThumbMeta(input) {
  if (!input || typeof input !== 'object') return null;
  const pickStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const out = {
    directory: pickStr(input.directory),
    combinedFilename: pickStr(input.combinedFilename),
    homeLogoUrl: pickStr(input.homeLogoUrl),
    awayLogoUrl: pickStr(input.awayLogoUrl),
    label: pickStr(input.label),
  };
  // Strip dangerous URL schemes early; full SSRF check happens later in mergeImages.
  for (const k of ['homeLogoUrl', 'awayLogoUrl']) {
    if (out[k] && !/^https:\/\//i.test(out[k])) out[k] = null;
  }
  if (out.label && out.label.length > 200) out.label = out.label.slice(0, 200);
  if (!out.directory && !out.combinedFilename && !out.homeLogoUrl && !out.awayLogoUrl && !out.label) {
    return null;
  }
  return out;
}

const router = express.Router();

// ===== Rolling export (chunked during recording) =====
// Goal: every 60s, export the 60s chunk ending at now-2min.

router.post('/hikconnect/video/rolling/start', async (req, res) => {
  const {
    deviceId,
    cameraId,
    beginTime,
    offset,
    voiceSwitch,
    chunkSec,
    lagSec,
    directory,
    combinedFilename,
    homeLogoUrl,
    awayLogoUrl,
    label,
  } = req.body || {};
  if (!deviceId || !cameraId || !beginTime) {
    return res.status(400).json({ message: 'Missing deviceId, cameraId or beginTime' });
  }

  const off = typeof offset === 'string' && offset ? offset : getDefaultOffset();
  const bt = new Date(beginTime);
  if (!(bt instanceof Date) || Number.isNaN(bt.getTime())) {
    return res.status(400).json({ message: 'Invalid beginTime (expected ISO 8601)' });
  }

  const rollingId = crypto.randomBytes(10).toString('hex');
  const autoTickReport = getAutoTickConfigReport();
  const autoTickConfigured = isAutoTickConfigured();

  // ── Per-device FIFO queue: append to tail. If another rolling is already
  //    active on the same (deviceId, cameraId), this one will wait for it
  //    in rollingTickImpl (it's still scheduled, but its ticks no-op until
  //    the predecessor's meta is gone — i.e. predecessor finalized).
  let queuedBehind = null;
  try {
    const swap = await swapDeviceRollingTail({
      deviceId: String(deviceId),
      cameraId: String(cameraId),
      rollingId,
    });
    queuedBehind = swap?.validPredecessor?.rollingId || null;
    if (queuedBehind) {
      await logRecording('ROLLING_START_QUEUED', {
        deviceId,
        cameraId,
        rollingId,
        queuedBehind,
      });
    }
  } catch (queueErr) {
    await logRecording('ROLLING_START_QUEUE_ERR', {
      deviceId,
      cameraId,
      message: queueErr?.message,
    });
  }

  const meta = {
    v: 1,
    rollingId,
    createdAt: Date.now(),
    deviceId: String(deviceId),
    cameraId: String(cameraId),
    beginTime: String(beginTime),
    beginMs: bt.getTime(),
    offset: off,
    voiceSwitch: normalizeVoiceSwitch(voiceSwitch),
    chunkSec: Number(chunkSec) > 0 ? Number(chunkSec) : 60,
    lagSec: Number(lagSec) > 0 ? Number(lagSec) : 120,
    mergedThroughIndex: -1,
    mergedVersion: 0,
    mergedPath: null,
    lastMergeMode: null,
    queuedBehind,
    autoTickEnabled: !!autoTickConfigured,
    autoTickIntervalSec: ROLLING_AUTOTICK_INTERVAL_SEC,
    autoTickConfigured: !!autoTickConfigured,
    autoTickReport,
    autoTickStartedAt: null,
    autoTickStoppedAt: null,
    autoTickLastRunAt: null,
    thumbMeta: sanitizeThumbMeta({
      directory,
      combinedFilename,
      homeLogoUrl,
      awayLogoUrl,
      label,
    }),
    thumbnailGenerated: false,
  };

  try {
    await writeRollingMeta(rollingId, meta);

    // Register this rolling in the per-device download index so the UI
    // can list it (and keep listing it after finalize, until the user
    // dismisses it or the 24h TTL expires).
    await appendDeviceDownloadIndex({
      deviceId: String(deviceId),
      cameraId: String(cameraId),
      rollingId,
    }).catch((e) =>
      logRecording('ROLLING_INDEX_APPEND_ERR', { rollingId, message: e?.message })
    );

    // Backend-driven rolling tick (every ~10s) via Cloud Tasks.
    let autoTickEnq = null;
    if (meta.autoTickEnabled) {
      const updated = { ...meta, autoTickStartedAt: Date.now() };
      await writeRollingMeta(rollingId, updated).catch(() => {});
      try {
        autoTickEnq = await enqueueRollingAutoTick({ rollingId, delaySec: 0 });
        await logRecording('ROLLING_AUTOTICK_ENQUEUE_OK', { rollingId, enq: autoTickEnq });
      } catch (e) {
        await logRecording('ROLLING_AUTOTICK_ENQUEUE_ERR', {
          rollingId,
          message: e?.message,
          status: e?.status || e?.code || null,
        });
      }
    }
    await logRecording('ROLLING_START_OK', {
      deviceId,
      cameraId,
      rollingId,
      chunkSec: meta.chunkSec,
      lagSec: meta.lagSec,
      autoTickEnabled: !!meta.autoTickEnabled,
      autoTickIntervalSec: meta.autoTickIntervalSec,
      autoTickConfigured: !!meta.autoTickConfigured,
      autoTickEnq,
      autoTickReport: meta.autoTickReport,
      queuedBehind,
    });

    return res.status(200).json({
      errorCode: '0',
      data: {
        rollingId,
        chunkSec: meta.chunkSec,
        lagSec: meta.lagSec,
        autoTickEnabled: !!meta.autoTickEnabled,
        autoTickIntervalSec: meta.autoTickIntervalSec,
        autoTickConfigured: !!meta.autoTickConfigured,
        autoTickEnq,
        autoTickReport: meta.autoTickReport,
        queuedBehind,
      },
    });
  } catch (err) {
    await logRecording('ROLLING_START_ERR', {
      deviceId,
      cameraId,
      rollingId,
      message: err?.message,
    });
    // If we became the queue tail, step back so the previous tail (if any)
    // remains addressable. Best-effort.
    await clearDeviceRollingTailIfHead({
      deviceId: String(deviceId),
      cameraId: String(cameraId),
      rollingId,
    }).catch(() => {});
    return res
      .status(500)
      .json({ message: 'Failed to start rolling export' });
  }
});

router.post('/hikconnect/video/rolling/tick', async (req, res) => {
  const { rollingId, index } = req.body || {};
  if (!rollingId && rollingId !== 0) return res.status(400).json({ message: 'Missing rollingId' });

  try {
    const out = await rollingTickImpl({ rollingId, index, source: 'client' });
    return res.status(200).json({ errorCode: '0', data: out.payload });
  } catch (err) {
    const is409 = err?.status === 409;
    const msg = String(err?.message || '');
    const lockish = !!err?.details?.lockPath;
    const isInProgress =
      is409 && (lockish || /in progress/i.test(msg) || /merge already in progress/i.test(msg));

    if (isInProgress) {
      await logRecording('ROLLING_TICK_IN_PROGRESS', {
        rollingId,
        source: 'client',
        index: index === null || index === undefined ? null : Number(index),
      });
      return res.status(200).json({
        errorCode: '0',
        data: {
          rollingId,
          inProgress: true,
        },
      });
    }
    await logRecording('ROLLING_TICK_ERR', {
      rollingId,
      source: 'client',
      index: index === null || index === undefined ? null : Number(index),
      message: err?.message,
      status: err?.status,
      details: err?.details,
    });
    return res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Internal auto-tick called by Cloud Tasks (backend scheduler)
router.post('/hikconnect/video/rolling/auto-tick', async (req, res) => {
  if (!requireAutoTickSecret(req)) return res.status(403).json({ message: 'Forbidden' });

  const { rollingId } = req.body || {};
  if (!rollingId) return res.status(400).json({ message: 'Missing rollingId' });

  try {
    const meta = await readRollingMeta(rollingId);

    // Stop condition.
    if (meta?.autoTickStoppedAt) {
      return res
        .status(200)
        .json({ errorCode: '0', data: { rollingId: String(rollingId), stopped: true } });
    }

    // Safety: auto-expire after 4 hours from session start (supports recordings up to ~3h).
    const sessionAgeMs = Date.now() - Number(meta?.beginMs || 0);
    const MAX_SESSION_AGE_MS = 4 * 60 * 60 * 1000;
    if (Number.isFinite(sessionAgeMs) && sessionAgeMs > MAX_SESSION_AGE_MS) {
      await patchRollingMeta(rollingId, {
        autoTickStoppedAt: Date.now(),
        autoTickStopReason: 'expired',
      }).catch(() => {});
      await logRecording('ROLLING_AUTOTICK_EXPIRED', {
        rollingId: String(rollingId),
        sessionAgeMs,
        beginMs: meta?.beginMs,
      });
      if (meta?.deviceId && meta?.cameraId) {
        await clearDeviceRollingTailIfHead({
          deviceId: String(meta.deviceId),
          cameraId: String(meta.cameraId),
          rollingId: String(rollingId),
        }).catch(() => {});
      }
      return res.status(200).json({
        errorCode: '0',
        data: { rollingId: String(rollingId), stopped: true, reason: 'expired' },
      });
    }

    // Mark last run (best-effort) — patch to avoid overwriting flags set by finalize.
    await patchRollingMeta(rollingId, { autoTickLastRunAt: Date.now() }).catch(() => {});

    let out;
    try {
      out = await rollingTickImpl({ rollingId, index: null, source: 'cloudtasks' });
    } catch (err) {
      const is409 = err?.status === 409;
      const msg = String(err?.message || '');
      const lockish = !!err?.details?.lockPath;
      const isInProgress =
        is409 &&
        (lockish || /in progress/i.test(msg) || /merge already in progress/i.test(msg));

      if (isInProgress) {
        await logRecording('ROLLING_TICK_IN_PROGRESS', {
          rollingId: String(rollingId),
          source: 'cloudtasks',
          index: null,
        });
        out = { ok: true, payload: { rollingId: String(rollingId), inProgress: true } };
      } else {
        throw err;
      }
    }

    // Re-enqueue the next auto tick (keeps at most one scheduled per 10s slot).
    let enq = null;
    try {
      // Re-read meta: finalize/stop may have happened while this tick was running.
      const metaNow = await readRollingMeta(rollingId).catch(() => null);
      const nowStopMaxIdx = Number.isFinite(Number(metaNow?.stopMaxIdx))
        ? Number(metaNow.stopMaxIdx)
        : null;
      const nowMergedThrough = Number.isFinite(Number(metaNow?.mergedThroughIndex))
        ? Number(metaNow.mergedThroughIndex)
        : -1;
      const fullyMerged = nowStopMaxIdx !== null && nowMergedThrough >= nowStopMaxIdx;

      if (metaNow?.autoTickStoppedAt || fullyMerged) {
        if (!metaNow?.autoTickStoppedAt) {
          await patchRollingMeta(rollingId, {
            autoTickStoppedAt: Date.now(),
            autoTickStopReason: 'fullyMerged',
          }).catch(() => {});
        }
        await logRecording('ROLLING_AUTOTICK_STOPPED_SKIP_ENQUEUE', {
          rollingId: String(rollingId),
          stoppedAt: metaNow?.autoTickStoppedAt || Date.now(),
          reason: fullyMerged ? 'fullyMerged' : 'stoppedAt',
          stopMaxIdx: nowStopMaxIdx,
          mergedThroughIndex: nowMergedThrough,
        });
      } else {
        enq = await enqueueRollingAutoTick({
          rollingId,
          delaySec: ROLLING_AUTOTICK_INTERVAL_SEC,
        });
      }
    } catch (e) {
      await logRecording('ROLLING_AUTOTICK_ENQUEUE_ERR', {
        rollingId: String(rollingId),
        message: e?.message,
        status: e?.status || e?.code || null,
      });
    }

    return res.status(200).json({
      errorCode: '0',
      data: {
        rollingId: String(rollingId),
        tick: out?.payload || null,
        enq,
      },
    });
  } catch (err) {
    await logRecording('ROLLING_AUTOTICK_ERR', {
      rollingId: String(rollingId),
      message: err?.message,
      status: err?.status,
      details: err?.details,
    });
    // Return 200 for "session not found" so Cloud Tasks stops retrying
    if (err?.status === 404) {
      return res
        .status(200)
        .json({ errorCode: '0', data: { rollingId: String(rollingId), sessionGone: true } });
    }
    return res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// GET the active+queued rolling chain for a given (deviceId, cameraId).
// Returned ordered from oldest (currently exporting) to newest (queued at tail).
router.get('/hikconnect/video/rolling/queue', async (req, res) => {
  const deviceId = String(req.query?.deviceId || '').trim();
  const cameraId = String(req.query?.cameraId || '').trim();
  if (!deviceId || !cameraId) {
    return res.status(400).json({ message: 'Missing deviceId or cameraId' });
  }

  try {
    // Source of truth = per-device download index (oldest first).
    const indexEntries = await readDeviceDownloadIndex({ deviceId, cameraId });
    const items = [];
    const now = Date.now();
    const expiredIds = [];

    for (const entry of indexEntries) {
      const rollingId = String(entry.rollingId);
      let m = null;
      try {
        m = await readRollingMeta(rollingId);
      } catch {
        // Meta has been deleted (very old rolling). Drop from index.
        expiredIds.push(rollingId);
        continue;
      }

      // TTL: 24h after finalize, drop the entry from the index.
      const finalizedAt = Number(m?.finalizedAt || 0);
      if (
        m?.finalGcsPath &&
        Number.isFinite(finalizedAt) &&
        finalizedAt > 0 &&
        now - finalizedAt > DOWNLOAD_INDEX_TTL_MS
      ) {
        expiredIds.push(rollingId);
        continue;
      }

      const safeIdxNow = (() => {
        const beginMs = Number(m?.beginMs || 0);
        const chunkMs = Number(m?.chunkSec || 60) * 1000;
        const lagMs = Number(m?.lagSec || 120) * 1000;
        if (!Number.isFinite(beginMs) || !beginMs || !Number.isFinite(chunkMs) || !chunkMs) {
          return null;
        }
        return Math.max(0, Math.floor((now - lagMs - beginMs) / chunkMs) - 1);
      })();
      const stopMaxIdx = Number.isFinite(Number(m?.stopMaxIdx)) ? Number(m.stopMaxIdx) : null;
      const merged = Number.isFinite(Number(m?.mergedThroughIndex))
        ? Number(m.mergedThroughIndex)
        : -1;
      const target = stopMaxIdx !== null ? stopMaxIdx : safeIdxNow;
      const progress =
        target !== null && target >= 0
          ? Math.max(0, Math.min(1, (merged + 1) / (target + 1)))
          : null;

      let status;
      if (m?.finalGcsPath) status = 'done';
      else if (m?.queuedBehind) status = 'queued';
      else if (m?.pendingFinalize) status = 'finalizing';
      else if (stopMaxIdx !== null && merged >= stopMaxIdx) status = 'merged';
      else if (m?.autoTickStoppedAt) status = 'stopped';
      else if (stopMaxIdx !== null) status = 'finalizing';
      else status = 'recording';

      items.push({
        rollingId,
        deviceId: m?.deviceId || null,
        cameraId: m?.cameraId || null,
        beginTime: m?.beginTime || null,
        beginMs: m?.beginMs || null,
        chunkSec: m?.chunkSec || null,
        lagSec: m?.lagSec || null,
        mergedThroughIndex: merged,
        stopMaxIdx,
        safeIndex: safeIdxNow,
        progress,
        status,
        queuedBehind: m?.queuedBehind || null,
        label: m?.thumbMeta?.label || null,
        directory: m?.thumbMeta?.directory || null,
        combinedFilename: m?.thumbMeta?.combinedFilename || null,
        thumbnailGenerated: !!m?.thumbnailGenerated,
        finalGcsPath: m?.finalGcsPath || null,
        finalPublicUrl: m?.finalPublicUrl || null,
        finalizedAt: m?.finalizedAt || null,
        pendingFinalize: !!m?.pendingFinalize,
        addedAt: entry.addedAt || null,
      });
    }

    // Best-effort: clean up expired/missing entries.
    for (const id of expiredIds) {
      removeFromDeviceDownloadIndex({ deviceId, cameraId, rollingId: id }).catch(() => {});
    }

    return res.status(200).json({ errorCode: '0', data: { items } });
  } catch (err) {
    return res
      .status(err?.status || 500)
      .json({ message: err?.message || 'Failed to read queue', details: err?.details });
  }
});

// Dismiss a rolling from the per-device download index.
// The meta + final video stay in GCS; only the UI entry is removed.
router.post('/hikconnect/video/rolling/dismiss', async (req, res) => {
  const { deviceId, cameraId, rollingId } = req.body || {};
  if (!deviceId || !cameraId || !rollingId) {
    return res
      .status(400)
      .json({ message: 'Missing deviceId, cameraId or rollingId' });
  }
  try {
    const removed = await removeFromDeviceDownloadIndex({
      deviceId: String(deviceId),
      cameraId: String(cameraId),
      rollingId: String(rollingId),
    });
    return res.status(200).json({ errorCode: '0', data: { removed } });
  } catch (err) {
    return res
      .status(err?.status || 500)
      .json({ message: err?.message || 'Failed to dismiss' });
  }
});

// Fire-and-forget finalize: stamp the finalize parameters into the meta and
// enqueue a Cloud Task to actually perform the finalize. Returns 202
// immediately; the client polls /rolling/queue for finalGcsPath.
router.post('/hikconnect/video/rolling/finalize-async', async (req, res) => {
  const {
    rollingId,
    directory,
    filename,
    stopTime,
    tailTryCount,
    requireComplete,
    homeLogoUrl,
    awayLogoUrl,
    combinedFilename,
    label,
  } = req.body || {};
  if (!rollingId) return res.status(400).json({ message: 'Missing rollingId' });
  if (!directory || !filename) {
    return res.status(400).json({ message: 'Missing directory or filename' });
  }

  try {
    const meta = await readRollingMeta(rollingId);

    // If already finalized, return immediately.
    if (meta?.finalGcsPath) {
      return res.status(200).json({
        errorCode: '0',
        data: {
          rollingId,
          alreadyFinalized: true,
          gcsPath: meta.finalGcsPath,
          publicUrl: meta.finalPublicUrl || null,
        },
      });
    }

    // Persist finalize args + stopMaxIdx so auto-tick stops on time.
    const stopMs = stopTime ? Date.parse(stopTime) : null;
    const chunkMs = Number(meta?.chunkSec || 60) * 1000;
    const beginMs = Number(meta?.beginMs || 0);
    let stopMaxIdx = null;
    if (
      Number.isFinite(stopMs) &&
      stopMs &&
      Number.isFinite(beginMs) &&
      beginMs > 0
    ) {
      stopMaxIdx = Math.max(-1, Math.floor((stopMs - beginMs - 1) / chunkMs));
      if (stopMaxIdx >= 1) {
        const tailMs = stopMs - beginMs - stopMaxIdx * chunkMs;
        if (tailMs < 5000) stopMaxIdx -= 1;
      }
    }

    const finalizeArgs = {
      directory: String(directory),
      filename: String(filename),
      stopTime: stopTime || null,
      tailTryCount: Number(tailTryCount) || 0,
      requireComplete:
        requireComplete === true || requireComplete === 1 || requireComplete === '1' ? 1 : 0,
      homeLogoUrl: homeLogoUrl || null,
      awayLogoUrl: awayLogoUrl || null,
      combinedFilename: combinedFilename || null,
      label: label || null,
    };

    await patchRollingMeta(rollingId, {
      pendingFinalize: true,
      pendingFinalizeAt: Date.now(),
      pendingFinalizeArgs: finalizeArgs,
      ...(Number.isFinite(stopMaxIdx) ? { stopMaxIdx } : {}),
    }).catch(() => {});

    // Enqueue a Cloud Task that calls /rolling/finalize-internal with these
    // args. Cloud Tasks retries 5xx automatically with backoff.
    let enq = null;
    try {
      enq = await enqueueRollingFinalize({
        rollingId,
        delaySec: 5,
        args: finalizeArgs,
      });
      await logRecording('ROLLING_FINALIZE_ASYNC_ENQUEUED', { rollingId, enq });
    } catch (e) {
      await logRecording('ROLLING_FINALIZE_ASYNC_ENQUEUE_ERR', {
        rollingId,
        message: e?.message,
      });
    }

    return res.status(202).json({
      errorCode: '0',
      data: { rollingId, accepted: true, stopMaxIdx, enq },
    });
  } catch (err) {
    return res
      .status(err?.status || 500)
      .json({ message: err?.message || 'Failed to schedule finalize' });
  }
});

// Internal handler invoked by Cloud Tasks. Re-routes to the regular
// finalize handler (sharing its full logic). The finalize handler detects
// the cloud-tasks header (x-cloudtasks-taskname) and converts 409 -> 503
// so the task queue retries with exponential backoff.
router.post('/hikconnect/video/rolling/finalize-internal', (req, res, next) => {
  if (!requireAutoTickSecret(req)) return res.status(403).json({ message: 'Forbidden' });
  req.url = '/hikconnect/video/rolling/finalize';
  return router.handle(req, res, next);
});

router.post('/hikconnect/video/rolling/finalize', async (req, res) => {
  const {
    rollingId,
    directory,
    filename,
    stopTime,
    tailTryCount,
    requireComplete,
    homeLogoUrl,
    awayLogoUrl,
    combinedFilename,
    label,
  } = req.body || {};
  if (!rollingId) return res.status(400).json({ message: 'Missing rollingId' });
  if (!directory || !filename)
    return res.status(400).json({ message: 'Missing directory or filename' });

  try {
    const finalizeT0 = Date.now();
    const meta = await readRollingMeta(rollingId);

    // Idempotent: if already finalized, return cached result.
    if (meta?.finalGcsPath) {
      return res.status(200).json({
        errorCode: '0',
        data: {
          rollingId,
          bucket: bucket.name,
          gcsPath: meta.finalGcsPath,
          publicUrl:
            meta.finalPublicUrl ||
            `https://storage.googleapis.com/${bucket.name}/${encodeURI(meta.finalGcsPath)}`,
          alreadyFinalized: true,
          finalizedAt: meta.finalizedAt || null,
        },
      });
    }

    // When the request comes from Cloud Tasks, prefer 503 over 409 so the
    // queue auto-retries with backoff.
    const fromCloudTasks = !!req.get('x-cloudtasks-taskname');

    // ── Finalize lock: reject concurrent finalize requests ──
    const FINALIZE_LOCK_TTL_MS = 5 * 60_000;
    if (
      meta?.finalizingAt &&
      Date.now() - Number(meta.finalizingAt) < FINALIZE_LOCK_TTL_MS
    ) {
      return res
        .status(fromCloudTasks ? 503 : 409)
        .json({ message: 'Finalize already in progress', retryAfterMs: 10000 });
    }
    await writeRollingMeta(rollingId, {
      ...meta,
      finalizingAt: Date.now(),
      firstFinalizeAt: meta?.firstFinalizeAt || Date.now(),
    }).catch(() => {});

    // Stop auto-tick as soon as finalize is requested (best-effort).
    // Also write stopMaxIdx so any in-flight tick knows not to go beyond this index.
    const stopMs_pre = stopTime ? Date.parse(stopTime) : null;
    const chunkMs_pre = Number(meta?.chunkSec || 60) * 1000;
    const beginMs_pre = Number(meta?.beginMs || 0);
    let earlyMaxIdx =
      Number.isFinite(stopMs_pre) &&
      stopMs_pre &&
      Number.isFinite(beginMs_pre) &&
      beginMs_pre > 0
        ? Math.max(-1, Math.floor((stopMs_pre - beginMs_pre - 1) / chunkMs_pre))
        : null;
    // Skip tiny tail chunk (< 5s) for stopMaxIdx too
    if (Number.isFinite(earlyMaxIdx) && earlyMaxIdx >= 1) {
      const tailMs_pre = stopMs_pre - beginMs_pre - earlyMaxIdx * chunkMs_pre;
      if (tailMs_pre < 5000) earlyMaxIdx = earlyMaxIdx - 1;
    }
    if (meta?.autoTickEnabled && !meta?.autoTickStoppedAt) {
      await patchRollingMeta(rollingId, {
        autoTickEnabled: false,
        autoTickStoppedAt: Date.now(),
        ...(Number.isFinite(earlyMaxIdx) ? { stopMaxIdx: earlyMaxIdx } : {}),
      }).catch(() => {});
    } else if (
      Number.isFinite(earlyMaxIdx) &&
      !Number.isFinite(Number(meta?.stopMaxIdx))
    ) {
      await patchRollingMeta(rollingId, { stopMaxIdx: earlyMaxIdx }).catch(() => {});
    }

    await logRecording('ROLLING_FINALIZE_REQUEST', {
      deviceId: meta?.deviceId,
      cameraId: meta?.cameraId,
      rollingId,
      directory,
      filename,
      hasStopTime: !!stopTime,
      tailTryCount: Number(tailTryCount) || 0,
      requireComplete:
        requireComplete === true || requireComplete === 1 || requireComplete === '1',
    });

    const stopMs = stopTime ? Date.parse(stopTime) : null;
    const chunkMs = Number(meta?.chunkSec || 60) * 1000;
    const beginMs = Number(meta?.beginMs || 0);
    const mergedThroughIndex0 = Number.isFinite(Number(meta?.mergedThroughIndex))
      ? Number(meta.mergedThroughIndex)
      : -1;

    // Catch-up at STOP: export+merge as many missing sequential chunks as possible (best-effort)
    // within a bounded time budget, to maximize recovered video even if mobile ticks were paused.
    const requireAll =
      requireComplete === true || requireComplete === 1 || requireComplete === '1';

    let targetMaxIdx = null;
    if (
      Number.isFinite(stopMs) &&
      stopMs &&
      Number.isFinite(beginMs) &&
      beginMs > 0
    ) {
      targetMaxIdx = Math.max(-1, Math.floor((stopMs - beginMs - 1) / chunkMs));
      // Skip tiny tail chunk (< 5s) — camera can't export such short segments
      const tailMs = stopMs - beginMs - targetMaxIdx * chunkMs;
      if (targetMaxIdx >= 1 && tailMs < 5000) {
        targetMaxIdx -= 1;
      }
    }

    if (
      Number.isFinite(stopMs) &&
      stopMs &&
      Number.isFinite(beginMs) &&
      beginMs > 0
    ) {
      const budgetMs = requireAll ? 8 * 60_000 : 3 * 60_000; // 8 min max (must be < GAE 10-min timeout)
      const allowTail = Number(tailTryCount) > 0;

      const maxIdx = targetMaxIdx;
      const mergedIdx0 = mergedThroughIndex0;

      const toExport = [];
      for (let i = mergedIdx0 + 1; i <= maxIdx; i++) toExport.push(i);

      await logRecording('ROLLING_FINALIZE_CATCHUP_START', {
        rollingId,
        mergedThroughIndex: mergedIdx0,
        maxIdx,
        budgetMs,
        allowTail,
        requireComplete: requireAll,
        toExportCount: toExport.length,
      });

      if (toExport.length > 0) {
        // PHASE 1: Export chunks SEQUENTIALLY (one at a time).
        const maxParallelFinalize = Math.max(
          1,
          Math.min(10, Number(process.env.ROLLING_PARALLEL_FINALIZE || 1))
        );
        const tExportStart = Date.now();
        const exportResults = [];
        let budgetExceeded = false;

        for (
          let batchStart = 0;
          batchStart < toExport.length;
          batchStart += maxParallelFinalize
        ) {
          if (Date.now() - tExportStart > budgetMs) {
            budgetExceeded = true;
            await logRecording('ROLLING_FINALIZE_EXPORT_TIMEOUT', {
              rollingId,
              message: 'Finalize catch-up budget exceeded during sequential export',
              elapsedMs: Date.now() - tExportStart,
              exportedSoFar: exportResults.length,
              remaining: toExport.length - batchStart,
            });
            break;
          }
          const batch = toExport.slice(batchStart, batchStart + maxParallelFinalize);
          const remainingBudgetMs = budgetMs - (Date.now() - tExportStart);
          const batchPromises = batch.map((i) => {
            const endOverride = allowTail && i === maxIdx ? stopMs : null;
            return exportRollingChunkByIndex({
              rollingId,
              meta,
              index: i,
              endMsOverride: endOverride,
              timeoutMsOverride: Math.max(35_000, remainingBudgetMs),
              allowRequeue: requireAll,
            }).then(
              (result) => ({
                ok: true,
                index: i,
                gcsPath: result?.gcsPath || getRollingChunkPath(rollingId, i),
              }),
              (error) => ({ ok: false, index: i, error })
            );
          });
          const batchResults = await Promise.all(batchPromises);
          exportResults.push(...batchResults);
        }

        const tExportEnd = Date.now();

        // PHASE 2: Collect sequential available chunks from GCS (skip gaps).
        const availableChunks = [];
        const failedIndices = [];
        for (let i = mergedIdx0 + 1; i <= maxIdx; i++) {
          const result = exportResults ? exportResults.find((r) => r.index === i) : null;
          if (result && result.ok) {
            availableChunks.push({ index: i, gcsPath: result.gcsPath });
            continue;
          }

          // Fallback: maybe another tick already exported this chunk
          const chunkPath = getRollingChunkPath(rollingId, i);
          // eslint-disable-next-line no-await-in-loop
          const [exists] = await bucket.file(chunkPath).exists().catch(() => [false]);
          if (exists) {
            availableChunks.push({ index: i, gcsPath: chunkPath });
            continue;
          }

          if (result && !result.ok) {
            await logRecording('ROLLING_FINALIZE_CATCHUP_ERR', {
              rollingId,
              index: i,
              message: result.error?.message,
              status: result.error?.status,
              details: result.error?.details,
            });
          }
          failedIndices.push(i);
        }

        const tCollectEnd = Date.now();

        await logRecording('ROLLING_FINALIZE_EXPORT_DONE', {
          rollingId,
          exportDurationMs: tExportEnd - tExportStart,
          collectDurationMs: tCollectEnd - tExportEnd,
          toExportCount: toExport.length,
          availableCount: availableChunks.length,
          failedIndices,
          exportResults: exportResults
            ? exportResults.map((r) => ({
                index: r.index,
                ok: r.ok,
                error: r.ok ? null : r.error?.message || null,
              }))
            : 'timeout',
          budgetExceeded,
        });

        // PHASE 3: Incremental merge — one chunk at a time.
        if (availableChunks.length > 0) {
          let mergedCount = 0;
          const preMergeMeta = await readRollingMeta(rollingId).catch(() => meta);
          const alreadyMergedThrough = Number.isFinite(Number(preMergeMeta?.mergedThroughIndex))
            ? Number(preMergeMeta.mergedThroughIndex)
            : mergedIdx0;
          const chunksToMerge = availableChunks.filter((c) => c.index > alreadyMergedThrough);

          if (chunksToMerge.length < availableChunks.length) {
            await logRecording('ROLLING_FINALIZE_SKIP_ALREADY_MERGED', {
              rollingId,
              alreadyMergedThrough,
              skipped: availableChunks.length - chunksToMerge.length,
              remaining: chunksToMerge.length,
            });
          }

          for (const chunk of chunksToMerge) {
            try {
              const incMeta = await readRollingMeta(rollingId).catch(() => meta);
              const currentMergedThrough = Number.isFinite(Number(incMeta?.mergedThroughIndex))
                ? Number(incMeta.mergedThroughIndex)
                : alreadyMergedThrough;
              if (chunk.index <= currentMergedThrough) {
                await logRecording('ROLLING_FINALIZE_SKIP_CHUNK_MERGED_BY_TICK', {
                  rollingId,
                  index: chunk.index,
                  currentMergedThrough,
                });
                continue;
              }
              // eslint-disable-next-line no-await-in-loop
              await mergeRollingChunkIntoMerged({
                rollingId,
                meta: incMeta,
                index: chunk.index,
                chunkGcsPath: chunk.gcsPath,
              });
              mergedCount++;
            } catch (incErr) {
              console.error('[FINALIZE] incremental merge failed', chunk.index, incErr?.message);
              await logRecording('ROLLING_FINALIZE_INC_MERGE_ERR', {
                rollingId,
                index: chunk.index,
                message: incErr?.message,
              });
            }
          }
          await logRecording('ROLLING_FINALIZE_MERGE_DONE', {
            rollingId,
            mergedCount,
            totalAvailable: availableChunks.length,
            skippedAlreadyMerged: availableChunks.length - chunksToMerge.length,
            failedIndices,
          });
        }
      }
    }

    const metaAfter = await readRollingMeta(rollingId).catch(() => meta);
    const mergedThroughIndexAfter = Number.isFinite(Number(metaAfter?.mergedThroughIndex))
      ? Number(metaAfter.mergedThroughIndex)
      : mergedThroughIndex0;

    const mergedPathNow =
      typeof metaAfter?.mergedPath === 'string' && metaAfter.mergedPath
        ? metaAfter.mergedPath
        : getRollingMergedPath(rollingId);
    const mergedFileNow = bucket.file(mergedPathNow);
    const [mergedExists] = await mergedFileNow.exists();
    await logRecording('ROLLING_FINALIZE_CHUNKS', {
      deviceId: metaAfter?.deviceId,
      cameraId: metaAfter?.cameraId,
      rollingId,
      chunkCount: mergedExists ? 1 : 0,
      firstIndex: mergedExists ? 0 : null,
      lastIndex: Number.isFinite(mergedThroughIndexAfter) ? mergedThroughIndexAfter : null,
    });

    if (!mergedExists) {
      await patchRollingMeta(rollingId, { finalizingAt: null }).catch(() => {});
      return res.status(409).json({ message: 'No merged chunk available yet' });
    }

    // Fast repair: scan for chunk files that exist in GCS but haven't been
    // merged yet (e.g. export succeeded during a tick but merge was blocked).
    try {
      const chunksToRepair = [];
      const repairStart = Number.isFinite(Number(metaAfter?.mergedThroughIndex))
        ? Number(metaAfter.mergedThroughIndex) + 1
        : mergedThroughIndexAfter + 1;
      const repairEnd = Number.isFinite(targetMaxIdx) ? targetMaxIdx : repairStart + 50;
      let gapCount = 0;
      for (let checkIdx = repairStart; checkIdx <= repairEnd && gapCount < 10; checkIdx++) {
        const nextPath = getRollingChunkPath(rollingId, checkIdx);
        // eslint-disable-next-line no-await-in-loop
        const [existsNext] = await bucket.file(nextPath).exists().catch(() => [false]);
        if (existsNext) {
          chunksToRepair.push({ index: checkIdx, gcsPath: nextPath });
          gapCount = 0;
        } else {
          gapCount++;
        }
      }

      if (chunksToRepair.length > 0) {
        await logRecording('ROLLING_FINALIZE_REPAIR_START', {
          rollingId,
          count: chunksToRepair.length,
        });
        for (const chunk of chunksToRepair) {
          try {
            const repairMeta = await readRollingMeta(rollingId).catch(() => metaAfter);
            // eslint-disable-next-line no-await-in-loop
            await mergeRollingChunkIntoMerged({
              rollingId,
              meta: repairMeta,
              index: chunk.index,
              chunkGcsPath: chunk.gcsPath,
            });
          } catch (incErr) {
            console.error('[FINALIZE] repair merge failed', chunk.index, incErr?.message);
          }
        }
      }
    } catch (eRepair) {
      await logRecording('ROLLING_FINALIZE_REPAIR_ERR', {
        rollingId,
        message: eRepair?.message,
        status: eRepair?.status,
      });
    }

    const metaPostRepair = await readRollingMeta(rollingId).catch(() => metaAfter);
    const mergedThroughIndexPostRepair = Number.isFinite(
      Number(metaPostRepair?.mergedThroughIndex)
    )
      ? Number(metaPostRepair.mergedThroughIndex)
      : mergedThroughIndexAfter;

    // ── Accept partial results after enough attempts ──
    const finalizeAttempts = Number(metaPostRepair?.finalizeAttempts || 0) + 1;
    await patchRollingMeta(rollingId, { finalizeAttempts }).catch(() => {});

    const isIncomplete =
      requireAll &&
      Number.isFinite(targetMaxIdx) &&
      mergedThroughIndexPostRepair < targetMaxIdx;
    const acceptPartial = finalizeAttempts >= 3;

    if (isIncomplete && !acceptPartial) {
      await logRecording('ROLLING_FINALIZE_INCOMPLETE', {
        rollingId,
        mergedThroughIndex: mergedThroughIndexPostRepair,
        targetMaxIdx,
        finalizeAttempts,
      });
      await patchRollingMeta(rollingId, { finalizingAt: null }).catch(() => {});
      return res.status(fromCloudTasks ? 503 : 409).json({
        message: 'Rolling export not complete yet',
        details: {
          rollingId,
          mergedThroughIndex: mergedThroughIndexPostRepair,
          targetMaxIdx,
          finalizeAttempts,
          retryAfterMs: 5000,
        },
      });
    }

    if (isIncomplete && acceptPartial) {
      await logRecording('ROLLING_FINALIZE_PARTIAL_ACCEPT', {
        rollingId,
        mergedThroughIndex: mergedThroughIndexPostRepair,
        targetMaxIdx,
        finalizeAttempts,
      });
    }

    const finalName = String(filename).endsWith('.mp4')
      ? String(filename)
      : `${String(filename)}.mp4`;
    const gcsPath = safeJoinGcsPath(directory, finalName);
    const mergedPathPostRepair =
      typeof metaPostRepair?.mergedPath === 'string' && metaPostRepair.mergedPath
        ? metaPostRepair.mergedPath
        : mergedPathNow;
    await bucket.file(mergedPathPostRepair).copy(bucket.file(gcsPath));

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(gcsPath)}`;

    // Persist final result in meta so finalize is idempotent and the queue
    // endpoint can expose it to clients polling status.
    await patchRollingMeta(rollingId, {
      finalGcsPath: gcsPath,
      finalPublicUrl: publicUrl,
      finalizedAt: Date.now(),
      pendingFinalize: false,
      finalizingAt: null,
    }).catch(() => {});

    // Cleanup: delete the entire tmp rolling folder from GCS (non-blocking).
    const rollingPrefix = getRollingPrefix(rollingId) + '/';
    bucket
      .getFiles({ prefix: rollingPrefix })
      .then(([files]) =>
        Promise.allSettled(files.map((f) => f.delete({ ignoreNotFound: true }).catch(() => {})))
      )
      .catch(() => {});

    // Reset manual recording state so recording-status no longer returns true.
    try {
      setManualRecordingState(metaPostRepair?.deviceId, false);
    } catch {}

    // Release the per-device queue tail so the next queued rolling can start.
    if (metaPostRepair?.deviceId && metaPostRepair?.cameraId) {
      await clearDeviceRollingTailIfHead({
        deviceId: String(metaPostRepair.deviceId),
        cameraId: String(metaPostRepair.cameraId),
        rollingId,
      }).catch(() => {});
    }

    // ── Backend-side thumbnail (cover + 2 logos) ──
    // Merge fresh values from request body over what was stored at /start.
    const thumbBase = metaPostRepair?.thumbMeta || {};
    const thumbCombined = sanitizeThumbMeta({
      directory: directory || thumbBase.directory,
      combinedFilename: combinedFilename || thumbBase.combinedFilename,
      homeLogoUrl: homeLogoUrl || thumbBase.homeLogoUrl,
      awayLogoUrl: awayLogoUrl || thumbBase.awayLogoUrl,
      label: label || thumbBase.label,
    });
    const canMakeThumb =
      _runMergeImages &&
      thumbCombined &&
      thumbCombined.directory &&
      thumbCombined.combinedFilename &&
      thumbCombined.homeLogoUrl &&
      thumbCombined.awayLogoUrl;
    if (canMakeThumb) {
      // Fire-and-forget: thumbnail must keep generating even if the client
      // disconnects right after receiving the finalize response.
      const thumbName = thumbCombined.combinedFilename.endsWith('.png')
        ? thumbCombined.combinedFilename
        : `${thumbCombined.combinedFilename}.png`;
      const thumbFinalName = thumbName.startsWith(`${thumbCombined.directory} `)
        ? thumbName
        : `${thumbCombined.directory} ${thumbName}`;
      Promise.resolve()
        .then(() =>
          _runMergeImages({
            logo1Url: thumbCombined.homeLogoUrl,
            logo2Url: thumbCombined.awayLogoUrl,
            finalFolder: thumbCombined.directory,
            finalName: thumbFinalName,
          })
        )
        .then(async (out) => {
          await patchRollingMeta(rollingId, { thumbnailGenerated: true }).catch(() => {});
          await logRecording('ROLLING_THUMBNAIL_OK', {
            rollingId,
            gcsPath: out?.gcsPath,
          }).catch(() => {});
        })
        .catch(async (e) => {
          await logRecording('ROLLING_THUMBNAIL_ERR', {
            rollingId,
            message: e?.message,
            status: e?.status || null,
          }).catch(() => {});
        });
    } else if (thumbCombined) {
      await logRecording('ROLLING_THUMBNAIL_SKIPPED', {
        rollingId,
        reason: !_runMergeImages
          ? 'mergeImages module unavailable'
          : 'missing thumb fields',
        hasDirectory: !!thumbCombined.directory,
        hasCombinedFilename: !!thumbCombined.combinedFilename,
        hasHomeLogo: !!thumbCombined.homeLogoUrl,
        hasAwayLogo: !!thumbCombined.awayLogoUrl,
      }).catch(() => {});
    }

    await logRecording('ROLLING_FINALIZE_OK', {
      deviceId: metaPostRepair?.deviceId,
      cameraId: metaPostRepair?.cameraId,
      rollingId,
      chunkCount: 1,
      gcsPath,
      mergeMode: metaPostRepair?.lastMergeMode,
      mergedThroughIndex: mergedThroughIndexPostRepair,
      targetMaxIdx,
      totalFinalizeDurationMs: Date.now() - finalizeT0,
    });

    return res.status(200).json({
      errorCode: '0',
      data: {
        rollingId,
        bucket: bucket.name,
        gcsPath,
        publicUrl,
        chunkCount: 1,
        merged: { mode: metaPostRepair?.lastMergeMode || 'unknown' },
      },
    });
  } catch (err) {
    console.error('[FINALIZE] error:', err?.message, err?.stack);
    await logRecording('ROLLING_FINALIZE_ERR', {
      rollingId,
      message: err?.message,
      status: err?.status,
      details: err?.details,
    });
    // Clear finalize lock on error so retries can proceed
    await patchRollingMeta(rollingId, { finalizingAt: null }).catch(() => {});
    return res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

module.exports = router;
