const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

const { bucket } = require('../gcs');
const {
  saveVideoWithRetry,
  getDownloadUrl,
  waitForDownloadUrl,
} = require('../video');
const { recordElementSearch, getLastRecordElement, getDefaultOffset, setManualRecordingState } = require('../recording');
const { concatMp4Files } = require('../concatMp4');
const { logRecording, logSofian } = require('../recordingGcsLog');

// Optional: Cloud Tasks auto-tick (App Engine). Kept optional so local/dev can run without it.
let CloudTasksClient;
try {
  ({ CloudTasksClient } = require('@google-cloud/tasks'));
} catch {
  CloudTasksClient = null;
}

const router = express.Router();

const ROLLING_AUTOTICK_ENABLED = String(process.env.ROLLING_AUTOTICK_ENABLED || '').toLowerCase() === 'true' || process.env.ROLLING_AUTOTICK_ENABLED === '1';
const ROLLING_AUTOTICK_INTERVAL_SEC = Math.max(2, Math.min(60, Number(process.env.ROLLING_AUTOTICK_INTERVAL_SEC || 10)));
const ROLLING_AUTOTICK_SECRET = process.env.ROLLING_AUTOTICK_SECRET ? String(process.env.ROLLING_AUTOTICK_SECRET) : null;

// Debug: log every download-url poll, even when status does not change.
// WARNING: this can be very noisy (every 3s during finalize wait loops).
const ROLLING_LOG_DOWNLOADURL_EVERY =
  String(process.env.ROLLING_LOG_DOWNLOADURL_EVERY || '').toLowerCase() === 'true' || process.env.ROLLING_LOG_DOWNLOADURL_EVERY === '1';

// When HikConnect keeps download-url status=1 for too long on a rolling chunk,
// we can fallback to exporting smaller sub-segments (ex: 60s => 2x30s), then concat.
const ROLLING_SPLIT_ON_TIMEOUT =
  String(process.env.ROLLING_SPLIT_ON_TIMEOUT || '').toLowerCase() === 'true' || process.env.ROLLING_SPLIT_ON_TIMEOUT === '1';
const ROLLING_SPLIT_PART_SEC = Math.max(
  10,
  Math.min(60, Number(process.env.ROLLING_SPLIT_PART_SEC || 30))
);

// When enabled, the rolling merge steps pass GCS signed URLs directly to ffmpeg
// instead of downloading inputs locally first. This halves the I/O (no
// GCS→disk step for inputs) and lets ffmpeg start streaming immediately.
// Defaults to true. On failure, we automatically fall back to the legacy
// download-then-concat path.
const ROLLING_CONCAT_USE_SIGNED_URLS =
  String(process.env.ROLLING_CONCAT_USE_SIGNED_URLS ?? 'true').toLowerCase() !== 'false';

const ROLLING_SIGNED_URL_TTL_MS = Math.max(
  60_000,
  Number(process.env.ROLLING_SIGNED_URL_TTL_MS || 15 * 60 * 1000)
);

async function getSignedReadUrl(gcsPath) {
  const [url] = await bucket.file(gcsPath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + ROLLING_SIGNED_URL_TTL_MS,
  });
  return url;
}

const CLOUD_TASKS_QUEUE = process.env.CLOUD_TASKS_QUEUE ? String(process.env.CLOUD_TASKS_QUEUE) : null;
const CLOUD_TASKS_LOCATION = process.env.CLOUD_TASKS_LOCATION ? String(process.env.CLOUD_TASKS_LOCATION) : null;
const CLOUD_TASKS_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || null;

let _tasksClient = null;
function getTasksClient() {
  if (!CloudTasksClient) return null;
  if (_tasksClient) return _tasksClient;
  _tasksClient = new CloudTasksClient();
  return _tasksClient;
}

function getAutoTickConfigReport() {
  const hasClient = !!getTasksClient();
  const enabled = !!ROLLING_AUTOTICK_ENABLED;
  const hasProject = !!CLOUD_TASKS_PROJECT;
  const hasLocation = !!CLOUD_TASKS_LOCATION;
  const hasQueue = !!CLOUD_TASKS_QUEUE;

  const missing = [];
  if (!enabled) missing.push('ROLLING_AUTOTICK_ENABLED');
  if (!hasProject) missing.push('GOOGLE_CLOUD_PROJECT');
  if (!hasLocation) missing.push('CLOUD_TASKS_LOCATION');
  if (!hasQueue) missing.push('CLOUD_TASKS_QUEUE');
  if (!hasClient) missing.push('@google-cloud/tasks');

  return {
    enabled,
    intervalSec: ROLLING_AUTOTICK_INTERVAL_SEC,
    hasClient,
    hasProject,
    hasLocation,
    hasQueue,
    missing,
    project: CLOUD_TASKS_PROJECT || null,
    location: CLOUD_TASKS_LOCATION || null,
    queue: CLOUD_TASKS_QUEUE || null,
  };
}

function isAutoTickConfigured() {
  const r = getAutoTickConfigReport();
  return !!(r.enabled && r.hasClient && r.hasProject && r.hasLocation && r.hasQueue);
}

function requireAutoTickSecret(req) {
  if (!ROLLING_AUTOTICK_SECRET) return true; // allow if no secret configured (dev)
  const got = req.get('x-rolling-autotick-secret');
  return got && String(got) === ROLLING_AUTOTICK_SECRET;
}

async function enqueueRollingAutoTick({ rollingId, delaySec = ROLLING_AUTOTICK_INTERVAL_SEC }) {
  if (!isAutoTickConfigured()) return { enqueued: false, reason: 'not_configured' };

  const client = getTasksClient();
  const parent = client.queuePath(CLOUD_TASKS_PROJECT, CLOUD_TASKS_LOCATION, CLOUD_TASKS_QUEUE);

  const nextRunAtMs = Date.now() + Math.max(0, Number(delaySec) || 0) * 1000;
  const nextRunSec = Math.floor(nextRunAtMs / 1000);
  const taskId = `rolling_${String(rollingId)}_${String(nextRunSec)}`;

  const payload = { rollingId: String(rollingId) };

  // Important on App Engine: without explicit routing, Cloud Tasks can hit the default service.
  // Routing to current service/version makes auto-tick reliable in multi-service deployments.
  const appEngineRouting = {
    ...(process.env.GAE_SERVICE ? { service: String(process.env.GAE_SERVICE) } : {}),
    ...(process.env.GAE_VERSION ? { version: String(process.env.GAE_VERSION) } : {}),
  };

  const task = {
    name: `${parent}/tasks/${taskId}`,
    scheduleTime: { seconds: nextRunSec },
    appEngineHttpRequest: {
      httpMethod: 'POST',
      relativeUri: '/api/hikconnect/video/rolling/auto-tick',
      ...(Object.keys(appEngineRouting).length > 0 ? { appEngineRouting } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...(ROLLING_AUTOTICK_SECRET ? { 'x-rolling-autotick-secret': ROLLING_AUTOTICK_SECRET } : {}),
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    },
  };

  try {
    await client.createTask({ parent, task });
    return { enqueued: true, taskId, nextRunSec };
  } catch (e) {
    // ALREADY_EXISTS => ok (idempotent per nextRunSec)
    if (e?.code === 6) return { enqueued: false, already: true, taskId, nextRunSec };
    throw e;
  }
}

async function rollingTickImpl({ rollingId, index, source = null }) {
  const meta = await readRollingMeta(rollingId);

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

  const beginMs = Number(meta?.beginMs || 0);
  const chunkMs = Number(meta?.chunkSec || 60) * 1000;
  const lagMs = Number(meta?.lagSec || 120) * 1000;
  const mergedThroughIndex = Number.isFinite(Number(meta?.mergedThroughIndex)) ? Number(meta.mergedThroughIndex) : -1;

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
      err.details = { requestedIndex: requested, expectedNextIndex: nextIndex, mergedThroughIndex };
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

  const maxParallelSave = Math.max(1, Math.min(50, Number(process.env.ROLLING_PARALLEL_SAVE || 20)));
  const maxParallelPoll = Math.max(1, Math.min(50, Number(process.env.ROLLING_PARALLEL_POLL || 20)));
  const maxParallelDownload = Math.max(1, Math.min(10, Number(process.env.ROLLING_PARALLEL_DOWNLOAD || 5)));

  const tickT0 = Date.now();

  const candidates = [];
  for (let j = nextIndex; j <= safeIndex && candidates.length < maxParallelSave; j++) candidates.push(j);

  await Promise.allSettled(candidates.map((j) => ensureRollingSaveTaskOnly({ rollingId, meta, index: j }).catch(() => null)));

  const tickT1 = Date.now();

  const pollCandidates = candidates.slice(0, maxParallelPoll);
  const pollResults = await Promise.allSettled(pollCandidates.map((j) => pollRollingDownloadUrlOnce({ rollingId, index: j })));

  const tickT2 = Date.now();

  const ready = [];
  for (const r of pollResults) {
    if (r.status === 'fulfilled' && r.value && r.value.ok && r.value.status === 0 && r.value.url) {
      ready.push(r.value.index);
    }
  }

  const downloads = ready.slice(0, maxParallelDownload);
  await Promise.allSettled(downloads.map((j) => downloadRollingChunkFromReadyUrl({ rollingId, index: j, meta }).catch(() => null)));

  const tickT3 = Date.now();

  // Batch merge: collect ALL sequential available chunks, merge in one pass.
  // This avoids downloading the growing merged.mp4 N times from GCS.
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
          await mergeRollingChunkIntoMerged({ rollingId, meta, index: chunk.index, chunkGcsPath: chunk.gcsPath });
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

function parseOffsetMinutes(offsetStr) {
  const m = String(offsetStr || '').match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

function toFixedOffsetIsoFromMs(ms, offsetStr) {
  const offMin = parseOffsetMinutes(offsetStr);
  const shifted = new Date(ms + offMin * 60_000);
  const pad = (n) => String(n).padStart(2, '0');

  const yyyy = shifted.getUTCFullYear();
  const MM = pad(shifted.getUTCMonth() + 1);
  const dd = pad(shifted.getUTCDate());
  const hh = pad(shifted.getUTCHours());
  const mi = pad(shifted.getUTCMinutes());
  const ss = pad(shifted.getUTCSeconds());

  return `${yyyy}-${MM}-${dd}T${hh}:${mi}:${ss}${offsetStr}`;
}

function normalizeGcsDirectory(dir) {
  return String(dir || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

function sanitizeGcsFilename(name) {
  return String(name || '')
    .trim()
    .replace(/[\\/]+/g, '_')
    .replace(/\s+/g, ' ');
}

function safeJoinGcsPath(directory, filename) {
  const dir = normalizeGcsDirectory(directory);
  const file = sanitizeGcsFilename(filename);
  return dir ? path.posix.join(dir, file) : file;
}

function chunkIndexToName(index) {
  return `chunk_${String(Number(index)).padStart(6, '0')}.mp4`;
}

function getRollingPrefix(rollingId) {
  return `tmp/hikconnect/rolling/${String(rollingId)}`;
}

function getRollingMetaPath(rollingId) {
  return `${getRollingPrefix(rollingId)}/meta.json`;
}

function getRollingChunkPath(rollingId, index) {
  return `${getRollingPrefix(rollingId)}/chunks/${chunkIndexToName(index)}`;
}

function getRollingMergedPath(rollingId) {
  return `${getRollingPrefix(rollingId)}/chunks/merged.mp4`;
}

function getRollingMergedVersionedPath(rollingId, version) {
  const v = Number(version);
  if (!Number.isFinite(v) || v <= 0) return getRollingMergedPath(rollingId);
  return `${getRollingPrefix(rollingId)}/chunks/merged${v}.mp4`;
}

function chunkIndexToLockName(index) {
  return `chunk_${String(Number(index)).padStart(6, '0')}.lock`;
}

function getRollingChunkLockPath(rollingId, index) {
  return `${getRollingPrefix(rollingId)}/locks/${chunkIndexToLockName(index)}`;
}

function getRollingMergeLockPath(rollingId) {
  return `${getRollingPrefix(rollingId)}/locks/merge.lock`;
}

function getRollingTaskStatePath(rollingId, index) {
  return `${getRollingPrefix(rollingId)}/tasks/task_${String(Number(index)).padStart(6, '0')}.json`;
}

async function readJsonIfExists(gcsPath) {
  const file = bucket.file(gcsPath);
  const [exists] = await file.exists().catch(() => [false]);
  if (!exists) return null;
  const [buf] = await file.download();
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

async function writeRollingTaskState(rollingId, index, state) {
  const p = getRollingTaskStatePath(rollingId, index);
  const file = bucket.file(p);
  await file.save(JSON.stringify(state), {
    resumable: false,
    contentType: 'application/json',
    metadata: { cacheControl: 'no-store' },
  });
  return p;
}

async function updateRollingTaskState(rollingId, index, patch) {
  const current = (await readJsonIfExists(getRollingTaskStatePath(rollingId, index)).catch(() => null)) || {};
  const next = { ...current, ...(patch || {}), updatedAt: Date.now() };
  await writeRollingTaskState(rollingId, index, next);
  return next;
}

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
  const statusChanged = prevLogged === undefined || prevLogged === null ? true : Number(prevLogged) !== Number(status);
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

async function downloadRollingChunkFromReadyUrl({ rollingId, index, meta }) {
  const idx = Number(index);
  const gcsPath = getRollingChunkPath(rollingId, idx);
  const gcsFile = bucket.file(gcsPath);
  const [exists] = await gcsFile.exists().catch(() => [false]);
  if (exists) return { already: true, index: idx, gcsPath };

  const taskState = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(() => null);
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

    const tmpDir = path.join(os.tmpdir(), `hikroll_dl_${String(rollingId)}_${idx}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
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

async function ensureRollingSaveTaskOnly({ rollingId, meta, index, endMsOverride = null }) {
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0) {
    const err = new Error('Invalid chunk index');
    err.status = 400;
    err.details = { index };
    throw err;
  }

  const existing = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(() => null);
  if (existing?.taskId) {
    return { already: true, index: idx, taskId: existing.taskId, beginTime: existing.beginTime, endTime: existing.endTime };
  }

  // Reuse the same per-chunk lock so we don't race exportRollingChunkByIndex.
  const lockFile = await acquireRollingChunkLock({ rollingId, index: idx }).catch((e) => {
    if (e?.status === 409) return null;
    throw e;
  });
  if (!lockFile) {
    const existingAfter = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(() => null);
    if (existingAfter?.taskId) {
      return { already: true, index: idx, taskId: existingAfter.taskId, beginTime: existingAfter.beginTime, endTime: existingAfter.endTime };
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
    const endMs = endMsOverride && Number.isFinite(endMsOverride) ? Math.min(beginMs + chunkMs, Number(endMsOverride)) : beginMs + chunkMs;
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

async function acquireRollingMergeLock({ rollingId, staleMs = 2 * 60 * 1000 }) {
  const lockPath = getRollingMergeLockPath(rollingId);
  const lockFile = bucket.file(lockPath);

  const tryCreate = async () => {
    await lockFile.save(JSON.stringify({ createdAt: Date.now() }), {
      resumable: false,
      contentType: 'application/json',
      metadata: { cacheControl: 'no-store' },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  };

  try {
    await tryCreate();
    return lockFile;
  } catch (e) {
    const code = e?.code;
    if (code !== 412) throw e;

    // If stale, clear it once.
    try {
      const [md] = await lockFile.getMetadata();
      const created = Date.parse(md?.timeCreated);
      if (Number.isFinite(created) && Date.now() - created > staleMs) {
        await lockFile.delete({ ignoreNotFound: true }).catch(() => {});
        await tryCreate();
        return lockFile;
      }
    } catch {
      // ignore
    }

    const err = new Error('Rolling merge already in progress');
    err.status = 409;
    err.details = { rollingId: String(rollingId), lockPath };
    throw err;
  }
}

function withTimeout(promise, timeoutMs, { message = 'Timeout', details = null } = {}) {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return promise;

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(message);
      err.status = 504;
      if (details) err.details = details;
      reject(err);
    }, ms);
  });

  return Promise.race([promise.finally(() => clearTimeout(timer)), timeoutPromise]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  const currentMergedPathFromMeta = typeof metaNow?.mergedPath === 'string' && metaNow.mergedPath ? metaNow.mergedPath : null;
  const legacyMergedPath = getRollingMergedPath(rollingId);
  const chunkFile = bucket.file(chunkGcsPath);

  const tmpDir = path.join(os.tmpdir(), `hikroll_incmerge_${String(rollingId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
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
    const nextVersion = Number.isFinite(currentVersion) && currentVersion >= 0 ? currentVersion + 1 : 1;
    const outMergedPath = getRollingMergedVersionedPath(rollingId, nextVersion);
    const outMergedFile = bucket.file(outMergedPath);

    if (!currentMergedPath) {
      // First merge: simply promote the chunk to merged1.mp4
      try {
        await chunkFile.copy(outMergedFile, { preconditionOpts: { ifGenerationMatch: 0 } });
        await outMergedFile.setMetadata({ cacheControl: 'no-store', contentType: 'video/mp4' }).catch(() => {});
      } catch (e) {
        if (e?.code === 412) {
          const err = new Error('Rolling merge already in progress');
          err.status = 409;
          err.details = { rollingId: String(rollingId), index: idx, lockPath: 'gcs-precondition-first-v' };
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

      return { mergedThroughIndex: updated.mergedThroughIndex, mergedGcsPath: outMergedPath, mergeMode: 'copy_first_v' };
    }

    const currentMergedFile = bucket.file(currentMergedPath);

    const mergedLocal = path.join(tmpDir, 'merged_prev.mp4');
    const chunkLocal = path.join(tmpDir, `chunk_${String(idx).padStart(6, '0')}.mp4`);
    const outLocal = path.join(tmpDir, 'merged_new.mp4');

    let mergeInfo;
    let usedSignedUrls = false;

    // Fast path: stream inputs via GCS signed URLs directly into ffmpeg.
    // Avoids the GCS→local-disk download of merged_prev + chunk.
    if (ROLLING_CONCAT_USE_SIGNED_URLS) {
      try {
        const [mergedUrl, chunkUrl] = await Promise.all([
          getSignedReadUrl(currentMergedPath),
          getSignedReadUrl(chunkGcsPath),
        ]);
        mergeInfo = await concatMp4Files([mergedUrl, chunkUrl], outLocal, { timeoutMs: 2 * 60 * 1000 });
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
        mergeInfo = await concatMp4Files([mergedLocal, chunkLocal], outLocal, { timeoutMs: 2 * 60 * 1000 });
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
        err.details = { rollingId: String(rollingId), index: idx, lockPath: 'gcs-precondition-upload-v' };
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

    return { mergedThroughIndex: updated.mergedThroughIndex, mergedGcsPath: outMergedPath, mergeMode: mergeInfo?.mode };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

// =====================================================================
// Batch merge: download merged + N chunks locally, one ffmpeg concat, upload once.
// This avoids the O(N²) GCS I/O of incremental merge (download growing merged each time).
// For a 10-chunk recording, this reduces GCS transfers by ~5x.
// =====================================================================
async function batchMergeChunksFromGcs({ rollingId, meta, chunks }) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { mergedCount: 0, timing: {} };
  }

  const t0 = Date.now();

  const metaNow = await readRollingMeta(rollingId).catch(() => meta || null);
  const currentMergedPath = typeof metaNow?.mergedPath === 'string' && metaNow.mergedPath ? metaNow.mergedPath : null;
  const currentVersion = Number(metaNow?.mergedVersion || 0);
  const nextVersion = Number.isFinite(currentVersion) && currentVersion >= 0 ? currentVersion + 1 : 1;
  const outMergedPath = getRollingMergedVersionedPath(rollingId, nextVersion);

  const tmpDir = path.join(os.tmpdir(), `hikroll_batch_${String(rollingId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const tDownloadStart = Date.now();

    // Ordered list of inputs to feed to ffmpeg (merged_prev first, then chunks by index).
    const orderedInputs = [];
    let usedSignedUrls = false;
    let tDownloadEnd;

    // Fast path: build signed URLs for every input and stream them directly
    // into ffmpeg. Avoids any GCS→local download for the inputs.
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
            { message: 'Timeout downloading chunk for batch', details: { rollingId, index: chunk.index } }
          ).then(() => ({ type: 'chunk', index: chunk.index, localPath }))
        );
      }

      const dlResults = await Promise.all(downloadTasks);
      tDownloadEnd = Date.now();

      const mergedResult = dlResults.find((r) => r.type === 'merged');
      if (mergedResult) orderedInputs.push(mergedResult.localPath);
      const chunkResults = dlResults.filter((r) => r.type === 'chunk').sort((a, b) => a.index - b.index);
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
      const mergeInfo = await concatMp4Files(orderedInputs, outLocal, { timeoutMs: 5 * 60 * 1000 });
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
      ...chunks.map(c => c.gcsPath),
      ...(currentMergedPath ? [currentMergedPath] : []),
    ];
    await Promise.allSettled(cleanupTargets.map(p => bucket.file(p).delete({ ignoreNotFound: true }).catch(() => {})));

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
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

async function acquireRollingChunkLock({ rollingId, index, staleMs = 3 * 60 * 1000 }) {
  const lockPath = getRollingChunkLockPath(rollingId, index);
  const lockFile = bucket.file(lockPath);

  const tryCreate = async () => {
    await lockFile.save(JSON.stringify({ createdAt: Date.now() }), {
      resumable: false,
      contentType: 'application/json',
      metadata: { cacheControl: 'no-store' },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  };

  try {
    await tryCreate();
    return lockFile;
  } catch (e) {
    // 412 = precondition failed => lock already exists
    const code = e?.code;
    if (code !== 412) throw e;

    // If stale, clear it once.
    try {
      const [md] = await lockFile.getMetadata();
      const created = Date.parse(md?.timeCreated);
      if (Number.isFinite(created) && Date.now() - created > staleMs) {
        await lockFile.delete({ ignoreNotFound: true }).catch(() => {});
        await tryCreate();
        return lockFile;
      }
    } catch {
      // ignore
    }

    const err = new Error('Chunk export already in progress');
    err.status = 409;
    err.details = { rollingId: String(rollingId), index: Number(index), lockPath };
    throw err;
  }
}

async function releaseRollingChunkLock(lockFile) {
  if (!lockFile) return;
  try {
    await lockFile.delete({ ignoreNotFound: true });
  } catch {
    // ignore
  }
}

async function readRollingMeta(rollingId) {
  const file = bucket.file(getRollingMetaPath(rollingId));
  const [exists] = await file.exists();
  if (!exists) {
    const err = new Error('Rolling session not found');
    err.status = 404;
    throw err;
  }
  const [buf] = await file.download();
  const json = JSON.parse(buf.toString('utf8'));
  return json;
}

async function writeRollingMeta(rollingId, meta) {
  const file = bucket.file(getRollingMetaPath(rollingId));
  await file.save(JSON.stringify(meta), {
    resumable: false,
    contentType: 'application/json',
    metadata: { cacheControl: 'no-store' },
  });
}

/** Read-merge-write: patches only the given fields without overwriting the rest. */
async function patchRollingMeta(rollingId, patch) {
  const current = await readRollingMeta(rollingId).catch(() => ({}));
  const merged = { ...current, ...(patch || {}) };
  await writeRollingMeta(rollingId, merged);
  return merged;
}

function parseChunkIndexFromName(name) {
  const m = String(name || '').match(/chunk_(\d{6})\.mp4$/);
  if (!m) return null;
  return Number(m[1]);
}

async function waitForDownloadUrlMaybeLogged({ rollingId, index, taskId, timeoutMs, intervalMs }) {
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
  // (Observed in logs: the same index can be requested twice and the 2nd one times out.)
  let lockFile = await acquireRollingChunkLock({ rollingId, index: idx }).catch((e) => {
    // If locked, do a quick double-check: if chunk got uploaded in the meantime, return already.
    if (e?.status === 409) {
      return null;
    }
    throw e;
  });

  if (!lockFile) {
    // Another process holds the lock — poll GCS until the chunk appears or the lock is released.
    const WAIT_POLL_MS = 5_000;          // check every 5s
    const WAIT_TIMEOUT_MS = 2 * 60_000;  // give up after 2 min (must be << GAE 10-min timeout)
    const waitStart = Date.now();

    await logSofian('chunk lock détecté, on attend que le chunk apparaisse dans GCS', {
      rollingId: String(rollingId), index: idx, waitTimeoutMs: WAIT_TIMEOUT_MS,
    });

    while (Date.now() - waitStart < WAIT_TIMEOUT_MS) {
      const [existsNow] = await gcsFile.exists();
      if (existsNow) return { already: true, index: idx, gcsPath };

      // Try to re-acquire the lock (it might have been released / became stale)
      const retryLock = await acquireRollingChunkLock({ rollingId, index: idx }).catch(() => null);
      if (retryLock) {
        // We now own the lock — fall through to normal export below.
        // Replace lockFile reference used in the finally block.
        // We reassign via a wrapper that the outer try/finally can use.
        lockFile = retryLock;
        await logSofian('lock récupéré après attente, on continue export', {
          rollingId: String(rollingId), index: idx, waitedMs: Date.now() - waitStart,
        });
        break;
      }

      await new Promise(r => setTimeout(r, WAIT_POLL_MS));
    }

    // If we still don't have the lock and chunk still doesn't exist, fail.
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
  const endMs = endMsOverride && Number.isFinite(endMsOverride) ? Math.min(beginMs + chunkMs, Number(endMsOverride)) : (beginMs + chunkMs);
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
  let taskState = await readJsonIfExists(getRollingTaskStatePath(rollingId, idx)).catch(() => null);
  let existingTaskId = taskState?.taskId || null;

  try {
    const payload = {
      cameraId: meta?.cameraId,
      beginTime,
      endTime,
      voiceSwitch: Number(meta?.voiceSwitch) === 0 ? 2 : Number(meta?.voiceSwitch),
    };

    const doSave = async () => saveVideoWithRetry(payload, { maxAttempts: 8, baseDelayMs: 1500 });

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
        const tmpDir = path.join(os.tmpdir(), `hikroll_${String(rollingId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
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
    // We allow up to 2 requeues for short segments to reduce end-to-end latency.
    const pollIntervalMs = 3000;
    const maxRequeues = allowRequeue ? (isShortSegment ? 3 : 2) : 0;
    const perAttemptTimeoutMs = isShortSegment ? Math.min(timeoutMsBase, 60_000) : timeoutMsBase;

    const durationMs = Math.max(0, Number(endMs) - Number(beginMs));
    const canSplitOnTimeout =
      !!ROLLING_SPLIT_ON_TIMEOUT &&
      // Need at least 2 parts of ROLLING_SPLIT_PART_SEC
      durationMs >= Math.max(1, ROLLING_SPLIT_PART_SEC * 2) * 1000;
    let didSplitFallback = false;

    const splitFallback = async () => {
      // Split into 2 parts: [begin, mid] + [mid, end]
      // Prefer fixed part length when reasonable (ex: 60s => 2x30s).
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
        `hikroll_split_${String(rollingId)}_${idx}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
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

          const savePart = await saveVideoWithRetry(payloadPart, { maxAttempts: 8, baseDelayMs: 1500 });
          const partTaskId = savePart?.data?.taskId;
          if (!partTaskId) {
            const err = new Error('taskId missing from save response (split part)');
            err.status = 502;
            err.details = { index: idx, part: i, save: savePart, beginTime: seg.beginTime, endTime: seg.endTime };
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
          created.push({ part: i, taskId: partTaskId, beginTime: seg.beginTime, endTime: seg.endTime });
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

          await logSofian("requeue save: nouvelle taskId", {
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

    const tmpDir = path.join(os.tmpdir(), `hikroll_${String(rollingId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
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

function computeDownloadTimeoutMs(beginTime, endTime, { minMs = 180000, maxMs = 900000 } = {}) {
  const bt = beginTime ? new Date(beginTime) : null;
  const et = endTime ? new Date(endTime) : null;
  const isValid = (d) => d instanceof Date && !Number.isNaN(d.getTime());
  if (!isValid(bt) || !isValid(et) || et <= bt) return minMs;

  const durationSec = Math.max(0, Math.floor((et.getTime() - bt.getTime()) / 1000));

  // Heuristic: base 3min + 1.0s per second of video.
  // This matches observed behavior where download-url readiness can be close to real duration.
  // (Capped by maxMs to avoid very long synchronous waits.)
  const ms = 180000 + durationSec * 1000;
  return Math.max(minMs, Math.min(maxMs, ms));
}

function computeRollingDownloadTimeoutMs(beginTime, endTime) {
  const bt = beginTime ? new Date(beginTime) : null;
  const et = endTime ? new Date(endTime) : null;
  const isValid = (d) => d instanceof Date && !Number.isNaN(d.getTime());
  const minMs = 35_000;
  const maxMs = 60_000;
  if (!isValid(bt) || !isValid(et) || et <= bt) return minMs;

  const durationSec = Math.max(0, Math.floor((et.getTime() - bt.getTime()) / 1000));
  // Fast timeout: most HikConnect tasks that succeed respond within 20-30s.
  // Stuck tasks stay at status=1 forever — waiting longer never helps.
  // Fail fast (35s) then requeue with a fresh taskId.
  const ms = 20_000 + durationSec * 250;
  return Math.max(minMs, Math.min(maxMs, ms));
}

function normalizeVoiceSwitch(value) {
  const n = Number(value);
  if (Number.isFinite(n) && (n === 0 || n === 1 || n === 2)) return n;
  return 2;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function validateIsoWindow(bt, et) {
  if (!bt || !et) return null;
  const btDate = new Date(bt);
  const etDate = new Date(et);
  if (!isValidDate(btDate) || !isValidDate(etDate)) {
    return 'Invalid beginTime/endTime format (expected ISO 8601 with timezone, e.g. 2026-04-12T20:44:00+02:00)';
  }
  if (etDate <= btDate) {
    return 'Invalid time window: endTime must be after beginTime';
  }
  return null;
}

function isOverlapping(seg, bt, et) {
  const a1 = new Date(seg?.beginTime);
  const a2 = new Date(seg?.endTime);
  const b1 = new Date(bt);
  const b2 = new Date(et);
  if (!isValidDate(a1) || !isValidDate(a2) || !isValidDate(b1) || !isValidDate(b2)) return true;
  return a2.getTime() > b1.getTime() && a1.getTime() < b2.getTime();
}

async function listRecordElementsInWindow(cameraId, bt, et) {
  const pageSize = 200;
  let pageIndex = 1;
  const all = [];

  while (true) {
    const reqBody = {
      cameraId,
      pageSize,
      pageIndex,
      filter: {
        timeType: 0,
        beginTime: bt,
        endTime: et,
        targetType: 0,
      },
    };

    const data = await recordElementSearch(reqBody);
    const root = data?.data ?? data;
    const list = root?.recordList || [];
    if (!Array.isArray(list) || list.length === 0) break;
    all.push(...list);
    if (list.length < pageSize) break;
    pageIndex++;
    if (pageIndex > 50) break;
  }

  all.sort((a, b) => String(a?.beginTime || '').localeCompare(String(b?.beginTime || '')));
  return all.filter((seg) => isOverlapping(seg, bt, et));
}

async function downloadToFile(url, destPath) {
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Failed to download segment: HTTP ${resp.status}`);
    err.status = resp.status;
    err.details = text.slice(0, 2000);
    throw err;
  }
  if (!resp.body) {
    const err = new Error('Download returned no body stream');
    err.status = 502;
    throw err;
  }
  await pipeline(resp.body, fs.createWriteStream(destPath));
}

async function uploadMergedToGcs(cameraId, localFilePath) {
  const tmpName = `tmp/hikconnect/merged/${String(cameraId)}/${Date.now()}_${crypto
    .randomBytes(6)
    .toString('hex')}.mp4`;

  await bucket.upload(localFilePath, {
    destination: tmpName,
    contentType: 'video/mp4',
  });

  const file = bucket.file(tmpName);
  try {
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });
    return { tmpGcsPath: tmpName, url: signedUrl, urlMode: 'signed' };
  } catch (e) {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(tmpName)}`;
    return {
      tmpGcsPath: tmpName,
      url: publicUrl,
      urlMode: 'public',
      urlWarning: 'Signed URL generation failed; using storage.googleapis.com URL instead.',
      urlError: e?.message,
    };
  }
}

// Save video (manual begin/end)
router.post('/hikconnect/video/save', async (req, res) => {
  const { cameraId, beginTime, endTime, voiceSwitch } = req.body || {};
  if (!cameraId || !beginTime || !endTime) {
    return res.status(400).json({ message: 'Missing cameraId, beginTime or endTime' });
  }
  try {
    const data = await saveVideoWithRetry(
      { cameraId, beginTime, endTime, voiceSwitch },
      { maxAttempts: 6, baseDelayMs: 1500 }
    );
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Download URL status
router.post('/hikconnect/video/download-url', async (req, res) => {
  const { taskId } = req.body || {};
  if (!taskId) return res.status(400).json({ message: 'Missing taskId' });
  try {
    const data = await getDownloadUrl({ taskId });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Save video then upload to GCS (cloud save/download path)
router.post('/hikconnect/video/save-and-upload', async (req, res) => {
  const { cameraId, beginTime, endTime, directory, filename, voiceSwitch } = req.body || {};
  if (!cameraId || !beginTime || !endTime || !directory || !filename) {
    return res.status(400).json({ message: 'Missing cameraId, beginTime, endTime, directory or filename' });
  }

  try {
    const saveResp = await saveVideoWithRetry(
      { cameraId, beginTime, endTime, voiceSwitch },
      { maxAttempts: 6, baseDelayMs: 1500 }
    );
    const taskId = saveResp?.data?.taskId;
    if (!taskId) {
      return res.status(502).json({ message: 'taskId missing from save response', details: saveResp });
    }

    const downloadUrl = await waitForDownloadUrl(
      taskId,
      computeDownloadTimeoutMs(beginTime, endTime, { minMs: 180000, maxMs: 900000 }),
      3000
    );
    const safeFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
    const localFilePath = path.join('/tmp', safeFilename);

    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ message: 'Failed to download from HikConnect', details: text });
    }

    await pipeline(resp.body, fs.createWriteStream(localFilePath));

    const gcsFilePath = path.join(directory, safeFilename);
    await bucket.upload(localFilePath, {
      destination: gcsFilePath,
      contentType: 'video/mp4',
    });

    fs.unlinkSync(localFilePath);

    res.status(200).json({
      status: 'success',
      message: `File uploaded to ${gcsFilePath} in GCS`,
      taskId,
      downloadUrl,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// ✅ Save last segment from device/camera (JSON search -> save -> poll url)
// Note: deviceId is currently only echoed back; keep it if your frontend expects it.
router.post('/hikconnect/video/save-last-from-device', async (req, res) => {
  const { deviceId, cameraId, voiceSwitch, offset, beginTime, endTime } = req.body || {};
  if (!deviceId || !cameraId) {
    return res.status(400).json({ message: 'Missing deviceId or cameraId' });
  }

  try {
    const tz = typeof offset === 'string' && offset ? offset : getDefaultOffset();

    let bt = beginTime;
    let et = endTime;
    let picked = null;

    const windowErr = validateIsoWindow(bt, et);
    if (windowErr) {
      return res.status(400).json({ message: windowErr, details: { beginTime: bt, endTime: et } });
    }

    if (!bt || !et) {
      const last = await getLastRecordElement(cameraId, tz);
      bt = last.beginTime;
      et = last.endTime;
      picked = last.raw;
    }

    const requestedVoiceSwitch = normalizeVoiceSwitch(voiceSwitch);

    let saveResp;
    try {
      // If begin/end come from client clock, they can be slightly off. Use a short retry
      // then fallback to the camera's own record element times.
      const maxAttempts = beginTime && endTime ? 3 : 8;

      saveResp = await saveVideoWithRetry(
        {
          cameraId,
          beginTime: bt,
          endTime: et,
          voiceSwitch: requestedVoiceSwitch,
        },
        { maxAttempts, baseDelayMs: 1500 }
      );
    } catch (err) {
      const code = err?.details?.errorCode;
      const isOpen000009 = code === 'OPEN000009' || String(err?.message || '').includes('OPEN000009');

      // Fallback: use the latest record element times from HikConnect. This avoids
      // local clock drift and also works when Hik indexes the segment slightly later.
      if (isOpen000009 && beginTime && endTime) {
        try {
          const last = await getLastRecordElement(cameraId, tz);
          picked = last.raw;
          bt = last.beginTime;
          et = last.endTime;

          // Some tenants reject voiceSwitch=0; retry with a safer default.
          const fallbackVoiceSwitch = requestedVoiceSwitch === 0 ? 2 : requestedVoiceSwitch;

          saveResp = await saveVideoWithRetry(
            {
              cameraId,
              beginTime: bt,
              endTime: et,
              voiceSwitch: fallbackVoiceSwitch,
            },
            { maxAttempts: 8, baseDelayMs: 1500 }
          );
        } catch (fallbackErr) {
          // Enrich details for mobile logs/debug.
          const enriched = {
            original: {
              status: err?.status,
              message: err?.message,
              details: err?.details,
              beginTime,
              endTime,
              voiceSwitch: requestedVoiceSwitch,
            },
            fallback: {
              status: fallbackErr?.status,
              message: fallbackErr?.message,
              details: fallbackErr?.details,
              beginTime: bt,
              endTime: et,
              voiceSwitch: requestedVoiceSwitch === 0 ? 2 : requestedVoiceSwitch,
              picked,
            },
            hint:
              'OPEN000009 often means the segment is not indexed yet or the requested begin/end do not match actual camera recordings. The backend tried the provided window then the latest record element window.',
          };

          return res
            .status(fallbackErr?.status || 500)
            .json({ message: fallbackErr?.message || 'Save video failed', details: enriched });
        }
      }

      throw err;
    }

    const taskId = saveResp?.data?.taskId;
    if (!taskId) {
      return res.status(502).json({ message: 'taskId missing from save response', details: saveResp });
    }

    // If the requested window spans multiple segments, export all segments and merge them.
    // This is only attempted when client provided begin/end (user intent: full video window).
    let segments = [];
    if (beginTime && endTime) {
      try {
        segments = await listRecordElementsInWindow(cameraId, beginTime, endTime);
      } catch {
        // ignore and fallback to single taskId url
        segments = [];
      }
    }

    // Default: single URL.
    if (!Array.isArray(segments) || segments.length <= 1) {
      const url = await waitForDownloadUrl(
        taskId,
        computeDownloadTimeoutMs(bt, et, { minMs: 180000, maxMs: 900000 }),
        3000
      );
      return res.status(200).json({
        errorCode: '0',
        data: {
          url,
          taskId,
          deviceId,
          cameraId,
          beginTime: bt,
          endTime: et,
          picked,
          segments: Array.isArray(segments) && segments.length === 1 ? segments : undefined,
        },
      });
    }

    // Multi-segment: export each segment then concat MP4s.
    const tmpDir = path.join(os.tmpdir(), `hikconnect_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const localParts = [];
    const segmentMeta = [];
    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segBegin = seg?.beginTime;
        const segEnd = seg?.endTime;
        const vs = requestedVoiceSwitch === 0 ? 2 : requestedVoiceSwitch;

        const save = await saveVideoWithRetry(
          { cameraId, beginTime: segBegin, endTime: segEnd, voiceSwitch: vs },
          { maxAttempts: 8, baseDelayMs: 1500 }
        );

        const segTaskId = save?.data?.taskId;
        if (!segTaskId) {
          const e = new Error('taskId missing from save response (segment)');
          e.status = 502;
          e.details = { segmentIndex: i, segBegin, segEnd, save };
          throw e;
        }

        const segUrl = await waitForDownloadUrl(
          segTaskId,
          computeDownloadTimeoutMs(segBegin, segEnd, { minMs: 180000, maxMs: 900000 }),
          3000
        );
        const partPath = path.join(tmpDir, `part_${String(i).padStart(3, '0')}.mp4`);
        await downloadToFile(segUrl, partPath);

        localParts.push(partPath);
        segmentMeta.push({ index: i, beginTime: segBegin, endTime: segEnd, taskId: segTaskId });
      }

      const mergedPath = path.join(tmpDir, 'merged.mp4');
      const mergeInfo = await concatMp4Files(localParts, mergedPath);

      const uploaded = await uploadMergedToGcs(cameraId, mergedPath);

      return res.status(200).json({
        errorCode: '0',
        data: {
          url: uploaded?.url,
          deviceId,
          cameraId,
          beginTime: beginTime,
          endTime: endTime,
          // debugging / traceability
          merged: { ...uploaded, ...mergeInfo },
          segments: segmentMeta,
        },
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// ===== Rolling export (chunked during recording) =====
// Goal: every 60s, export the 60s chunk ending at now-2min.

router.post('/hikconnect/video/rolling/start', async (req, res) => {
  const { deviceId, cameraId, beginTime, offset, voiceSwitch, chunkSec, lagSec } = req.body || {};
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
    autoTickEnabled: !!autoTickConfigured,
    autoTickIntervalSec: ROLLING_AUTOTICK_INTERVAL_SEC,
    autoTickConfigured: !!autoTickConfigured,
    autoTickReport,
    autoTickStartedAt: null,
    autoTickStoppedAt: null,
    autoTickLastRunAt: null,
  };

  try {
    await writeRollingMeta(rollingId, meta);

    // Backend-driven rolling tick (every ~10s) via Cloud Tasks.
    // This allows the mobile/web app to NOT call /rolling/tick repeatedly.
    let autoTickEnq = null;
    if (meta.autoTickEnabled) {
      const updated = { ...meta, autoTickStartedAt: Date.now() };
      await writeRollingMeta(rollingId, updated).catch(() => {});
      try {
        autoTickEnq = await enqueueRollingAutoTick({ rollingId, delaySec: 0 });
        await logRecording('ROLLING_AUTOTICK_ENQUEUE_OK', { rollingId, enq: autoTickEnq });
      } catch (e) {
        await logRecording('ROLLING_AUTOTICK_ENQUEUE_ERR', { rollingId, message: e?.message, status: e?.status || e?.code || null });
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
      },
    });
  } catch (err) {
    await logRecording('ROLLING_START_ERR', { deviceId, cameraId, rollingId, message: err?.message });
    return res.status(500).json({ message: 'Failed to start rolling export', details: err?.message });
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
    const isInProgress = is409 && (lockish || /in progress/i.test(msg) || /merge already in progress/i.test(msg));

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
      return res.status(200).json({ errorCode: '0', data: { rollingId: String(rollingId), stopped: true } });
    }

    // Safety: auto-expire after 30 minutes from session start (recordings are max ~10 min).
    const sessionAgeMs = Date.now() - Number(meta?.beginMs || 0);
    const MAX_SESSION_AGE_MS = 30 * 60 * 1000;
    if (Number.isFinite(sessionAgeMs) && sessionAgeMs > MAX_SESSION_AGE_MS) {
      await patchRollingMeta(rollingId, { autoTickStoppedAt: Date.now(), autoTickStopReason: 'expired' }).catch(() => {});
      await logRecording('ROLLING_AUTOTICK_EXPIRED', {
        rollingId: String(rollingId),
        sessionAgeMs,
        beginMs: meta?.beginMs,
      });
      return res.status(200).json({ errorCode: '0', data: { rollingId: String(rollingId), stopped: true, reason: 'expired' } });
    }

    // Mark last run (best-effort) — use patch to avoid overwriting flags set by finalize.
    await patchRollingMeta(rollingId, { autoTickLastRunAt: Date.now() }).catch(() => {});

    let out;
    try {
      out = await rollingTickImpl({ rollingId, index: null, source: 'cloudtasks' });
    } catch (err) {
      const is409 = err?.status === 409;
      const msg = String(err?.message || '');
      const lockish = !!err?.details?.lockPath;
      const isInProgress = is409 && (lockish || /in progress/i.test(msg) || /merge already in progress/i.test(msg));

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
      const nowStopMaxIdx = Number.isFinite(Number(metaNow?.stopMaxIdx)) ? Number(metaNow.stopMaxIdx) : null;
      const nowMergedThrough = Number.isFinite(Number(metaNow?.mergedThroughIndex)) ? Number(metaNow.mergedThroughIndex) : -1;
      const fullyMerged = nowStopMaxIdx !== null && nowMergedThrough >= nowStopMaxIdx;

      if (metaNow?.autoTickStoppedAt || fullyMerged) {
        if (!metaNow?.autoTickStoppedAt) {
          await patchRollingMeta(rollingId, { autoTickStoppedAt: Date.now(), autoTickStopReason: 'fullyMerged' }).catch(() => {});
        }
        await logRecording('ROLLING_AUTOTICK_STOPPED_SKIP_ENQUEUE', {
          rollingId: String(rollingId),
          stoppedAt: metaNow?.autoTickStoppedAt || Date.now(),
          reason: fullyMerged ? 'fullyMerged' : 'stoppedAt',
          stopMaxIdx: nowStopMaxIdx,
          mergedThroughIndex: nowMergedThrough,
        });
      } else {
        enq = await enqueueRollingAutoTick({ rollingId, delaySec: ROLLING_AUTOTICK_INTERVAL_SEC });
      }
    } catch (e) {
      await logRecording('ROLLING_AUTOTICK_ENQUEUE_ERR', { rollingId: String(rollingId), message: e?.message, status: e?.status || e?.code || null });
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
    await logRecording('ROLLING_AUTOTICK_ERR', { rollingId: String(rollingId), message: err?.message, status: err?.status, details: err?.details });
    // Return 200 for "session not found" so Cloud Tasks stops retrying
    if (err?.status === 404) {
      return res.status(200).json({ errorCode: '0', data: { rollingId: String(rollingId), sessionGone: true } });
    }
    return res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

router.post('/hikconnect/video/rolling/finalize', async (req, res) => {
  const { rollingId, directory, filename, stopTime, tailTryCount, requireComplete } = req.body || {};
  if (!rollingId) return res.status(400).json({ message: 'Missing rollingId' });
  if (!directory || !filename) return res.status(400).json({ message: 'Missing directory or filename' });

  try {
    const finalizeT0 = Date.now();
    const meta = await readRollingMeta(rollingId);

    // ── Finalize lock: reject concurrent finalize requests ──
    const FINALIZE_LOCK_TTL_MS = 5 * 60_000;
    if (meta?.finalizingAt && (Date.now() - Number(meta.finalizingAt)) < FINALIZE_LOCK_TTL_MS) {
      return res.status(409).json({ message: 'Finalize already in progress', retryAfterMs: 10000 });
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
    let earlyMaxIdx = (Number.isFinite(stopMs_pre) && stopMs_pre && Number.isFinite(beginMs_pre) && beginMs_pre > 0)
      ? Math.max(-1, Math.floor((stopMs_pre - beginMs_pre - 1) / chunkMs_pre))
      : null;
    // Skip tiny tail chunk (< 5s) for stopMaxIdx too
    if (Number.isFinite(earlyMaxIdx) && earlyMaxIdx >= 1) {
      const tailMs_pre = (stopMs_pre - beginMs_pre) - earlyMaxIdx * chunkMs_pre;
      if (tailMs_pre < 5000) earlyMaxIdx = earlyMaxIdx - 1;
    }
    if (meta?.autoTickEnabled && !meta?.autoTickStoppedAt) {
      await patchRollingMeta(rollingId, {
        autoTickEnabled: false,
        autoTickStoppedAt: Date.now(),
        ...(Number.isFinite(earlyMaxIdx) ? { stopMaxIdx: earlyMaxIdx } : {}),
      }).catch(() => {});
    } else if (Number.isFinite(earlyMaxIdx) && !Number.isFinite(Number(meta?.stopMaxIdx))) {
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
      requireComplete: requireComplete === true || requireComplete === 1 || requireComplete === '1',
    });

    const stopMs = stopTime ? Date.parse(stopTime) : null;
    const chunkMs = Number(meta?.chunkSec || 60) * 1000;
    const beginMs = Number(meta?.beginMs || 0);
    const mergedThroughIndex0 = Number.isFinite(Number(meta?.mergedThroughIndex)) ? Number(meta.mergedThroughIndex) : -1;

    // Catch-up at STOP: export+merge as many missing sequential chunks as possible (best-effort)
    // within a bounded time budget, to maximize recovered video even if mobile ticks were paused.
    // Still never merges out-of-order indices.
    const requireAll = requireComplete === true || requireComplete === 1 || requireComplete === '1';

    let targetMaxIdx = null;
    if (Number.isFinite(stopMs) && stopMs && Number.isFinite(beginMs) && beginMs > 0) {
      targetMaxIdx = Math.max(-1, Math.floor((stopMs - beginMs - 1) / chunkMs));
      // Skip tiny tail chunk (< 5s) — camera can't export such short segments
      const tailMs = (stopMs - beginMs) - targetMaxIdx * chunkMs;
      if (targetMaxIdx >= 1 && tailMs < 5000) {
        targetMaxIdx -= 1;
      }
    }

    if (Number.isFinite(stopMs) && stopMs && Number.isFinite(beginMs) && beginMs > 0) {
      const budgetMs = requireAll ? 7 * 60_000 : 2 * 60_000;  // 7 min max (must be < GAE 10-min timeout)
      const allowTail = Number(tailTryCount) > 0;

      // Last index whose *begin* is strictly before stopMs.
      const maxIdx = targetMaxIdx;
      const catchupStart = Date.now();
      const mergedIdx0 = mergedThroughIndex0;

      // Indices that still need to be exported (not yet merged).
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
        // ================================================================
        // PHASE 1: Export chunks SEQUENTIALLY (one at a time).
        // The camera records AND exports simultaneously — hammering it
        // with parallel export requests causes timeouts. By serialising
        // we let the camera handle one export at a time, which should
        // dramatically improve the success rate per chunk.
        // ================================================================
        const maxParallelFinalize = Math.max(1, Math.min(10, Number(process.env.ROLLING_PARALLEL_FINALIZE || 1)));
        const tExportStart = Date.now();
        const exportResults = [];
        let budgetExceeded = false;

        for (let batchStart = 0; batchStart < toExport.length; batchStart += maxParallelFinalize) {
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
          const batchPromises = batch.map(i => {
            const endOverride = allowTail && i === maxIdx ? stopMs : null;
            return exportRollingChunkByIndex({
              rollingId,
              meta,
              index: i,
              endMsOverride: endOverride,
              timeoutMsOverride: Math.max(35_000, remainingBudgetMs),
              allowRequeue: requireAll,
            }).then(
              result => ({ ok: true, index: i, gcsPath: result?.gcsPath || getRollingChunkPath(rollingId, i) }),
              error => ({ ok: false, index: i, error })
            );
          });
          const batchResults = await Promise.all(batchPromises);
          exportResults.push(...batchResults);
        }

        const tExportEnd = Date.now();

        // ================================================================
        // PHASE 2: Collect sequential available chunks from GCS.
        // Skip gaps: collect ALL available chunks even when some are missing.
        // This lets us merge 80%+ of the video when a few chunks are
        // permanently stuck on HikConnect's side.
        // ================================================================
        const availableChunks = [];
        const failedIndices = [];
        for (let i = mergedIdx0 + 1; i <= maxIdx; i++) {
          // Check result from parallel exports
          const result = exportResults ? exportResults.find(r => r.index === i) : null;
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

          // Gap: log the failure but continue collecting remaining chunks
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
          exportResults: exportResults ? exportResults.map(r => ({
            index: r.index,
            ok: r.ok,
            error: r.ok ? null : (r.error?.message || null),
          })) : 'timeout',
        });

        // ================================================================
        // PHASE 3: Incremental merge — one chunk at a time.
        // Re-read mergedThroughIndex before merging because concurrent
        // ticks may have already merged (and deleted!) some chunks while
        // the finalize export phase was running.
        // ================================================================
        if (availableChunks.length > 0) {
          let mergedCount = 0;
          const preMergeMeta = await readRollingMeta(rollingId).catch(() => meta);
          const alreadyMergedThrough = Number.isFinite(Number(preMergeMeta?.mergedThroughIndex))
            ? Number(preMergeMeta.mergedThroughIndex)
            : mergedIdx0;
          const chunksToMerge = availableChunks.filter(c => c.index > alreadyMergedThrough);

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
              // Re-check: a tick may have merged this chunk while we were
              // merging the previous one (the tick deletes the chunk file).
              const currentMergedThrough = Number.isFinite(Number(incMeta?.mergedThroughIndex))
                ? Number(incMeta.mergedThroughIndex) : alreadyMergedThrough;
              if (chunk.index <= currentMergedThrough) {
                await logRecording('ROLLING_FINALIZE_SKIP_CHUNK_MERGED_BY_TICK', {
                  rollingId, index: chunk.index, currentMergedThrough,
                });
                continue;
              }
              // eslint-disable-next-line no-await-in-loop
              await mergeRollingChunkIntoMerged({ rollingId, meta: incMeta, index: chunk.index, chunkGcsPath: chunk.gcsPath });
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
    const mergedThroughIndexAfter = Number.isFinite(Number(metaAfter?.mergedThroughIndex)) ? Number(metaAfter.mergedThroughIndex) : mergedThroughIndex0;

    const mergedPathNow = typeof metaAfter?.mergedPath === 'string' && metaAfter.mergedPath ? metaAfter.mergedPath : getRollingMergedPath(rollingId);
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
    // Use incremental merge and skip gaps (don't stop at missing chunks).
    try {
      const chunksToRepair = [];
      const repairStart = Number.isFinite(Number(metaAfter?.mergedThroughIndex)) ? Number(metaAfter.mergedThroughIndex) + 1 : mergedThroughIndexAfter + 1;
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
        await logRecording('ROLLING_FINALIZE_REPAIR_START', { rollingId, count: chunksToRepair.length });
        for (const chunk of chunksToRepair) {
          try {
            const repairMeta = await readRollingMeta(rollingId).catch(() => metaAfter);
            // eslint-disable-next-line no-await-in-loop
            await mergeRollingChunkIntoMerged({ rollingId, meta: repairMeta, index: chunk.index, chunkGcsPath: chunk.gcsPath });
          } catch (incErr) {
            // Skip failed chunk, continue repairing
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
    const mergedThroughIndexPostRepair = Number.isFinite(Number(metaPostRepair?.mergedThroughIndex))
      ? Number(metaPostRepair.mergedThroughIndex)
      : mergedThroughIndexAfter;

    // ── Accept partial results after enough attempts ──
    // HikConnect sometimes permanently fails to export certain chunks.
    // Track finalize attempts: after 3 rounds, accept what we have rather
    // than looping forever with 409 retries.
    const finalizeAttempts = Number(metaPostRepair?.finalizeAttempts || 0) + 1;
    await patchRollingMeta(rollingId, { finalizeAttempts }).catch(() => {});

    const isIncomplete = requireAll && Number.isFinite(targetMaxIdx) && mergedThroughIndexPostRepair < targetMaxIdx;
    const acceptPartial = finalizeAttempts >= 3;

    if (isIncomplete && !acceptPartial) {
      await logRecording('ROLLING_FINALIZE_INCOMPLETE', {
        rollingId,
        mergedThroughIndex: mergedThroughIndexPostRepair,
        targetMaxIdx,
        finalizeAttempts,
      });
      await patchRollingMeta(rollingId, { finalizingAt: null }).catch(() => {});
      return res.status(409).json({
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

    const finalName = String(filename).endsWith('.mp4') ? String(filename) : `${String(filename)}.mp4`;
    const gcsPath = safeJoinGcsPath(directory, finalName);
    const mergedPathPostRepair = typeof metaPostRepair?.mergedPath === 'string' && metaPostRepair.mergedPath ? metaPostRepair.mergedPath : mergedPathNow;
    await bucket.file(mergedPathPostRepair).copy(bucket.file(gcsPath));

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(gcsPath)}`;

    // Cleanup: delete the entire tmp rolling folder from GCS (non-blocking).
    const rollingPrefix = getRollingPrefix(rollingId) + '/';
    bucket.getFiles({ prefix: rollingPrefix })
      .then(([files]) => Promise.allSettled(files.map(f => f.delete({ ignoreNotFound: true }).catch(() => {}))))
      .catch(() => {});

    // Reset manual recording state so recording-status no longer returns true.
    try { setManualRecordingState(metaPostRepair?.deviceId, false); } catch {}

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
    await logRecording('ROLLING_FINALIZE_ERR', { rollingId, message: err?.message, status: err?.status, details: err?.details });
    // Clear finalize lock on error so retries can proceed
    await patchRollingMeta(rollingId, { finalizingAt: null }).catch(() => {});
    return res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

module.exports = router;
