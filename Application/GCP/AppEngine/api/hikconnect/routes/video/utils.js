// Pure helpers and small utilities used across the video routes split.
// Keep this module dependency-free w.r.t. the other split modules to avoid
// circular imports.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

const { bucket } = require('../../gcs');
const { recordElementSearch } = require('../../recording');

// ---------------------------------------------------------------------------
// Env-driven config (rolling export)
// ---------------------------------------------------------------------------

const ROLLING_AUTOTICK_ENABLED =
  String(process.env.ROLLING_AUTOTICK_ENABLED || '').toLowerCase() === 'true' ||
  process.env.ROLLING_AUTOTICK_ENABLED === '1';

const ROLLING_AUTOTICK_INTERVAL_SEC = Math.max(
  2,
  Math.min(60, Number(process.env.ROLLING_AUTOTICK_INTERVAL_SEC || 10))
);

const ROLLING_AUTOTICK_SECRET = process.env.ROLLING_AUTOTICK_SECRET
  ? String(process.env.ROLLING_AUTOTICK_SECRET)
  : null;

// Debug: log every download-url poll, even when status does not change.
// WARNING: this can be very noisy (every 3s during finalize wait loops).
const ROLLING_LOG_DOWNLOADURL_EVERY =
  String(process.env.ROLLING_LOG_DOWNLOADURL_EVERY || '').toLowerCase() === 'true' ||
  process.env.ROLLING_LOG_DOWNLOADURL_EVERY === '1';

// When HikConnect keeps download-url status=1 for too long on a rolling chunk,
// fallback to exporting smaller sub-segments (ex: 60s => 2x30s) and concat.
const ROLLING_SPLIT_ON_TIMEOUT =
  String(process.env.ROLLING_SPLIT_ON_TIMEOUT || '').toLowerCase() === 'true' ||
  process.env.ROLLING_SPLIT_ON_TIMEOUT === '1';

const ROLLING_SPLIT_PART_SEC = Math.max(
  10,
  Math.min(60, Number(process.env.ROLLING_SPLIT_PART_SEC || 30))
);

// Pass GCS signed URLs directly to ffmpeg (avoid GCS→disk for inputs).
// Defaults to true. On failure, callers fall back to local downloads.
const ROLLING_CONCAT_USE_SIGNED_URLS =
  String(process.env.ROLLING_CONCAT_USE_SIGNED_URLS ?? 'true').toLowerCase() !== 'false';

const ROLLING_SIGNED_URL_TTL_MS = Math.max(
  60_000,
  Number(process.env.ROLLING_SIGNED_URL_TTL_MS || 15 * 60 * 1000)
);

// ---------------------------------------------------------------------------
// Generic small utilities
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// ---------------------------------------------------------------------------
// Date / offset helpers
// ---------------------------------------------------------------------------

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

function normalizeVoiceSwitch(value) {
  const n = Number(value);
  if (Number.isFinite(n) && (n === 0 || n === 1 || n === 2)) return n;
  return 2;
}

// ---------------------------------------------------------------------------
// GCS path helpers (rolling)
// ---------------------------------------------------------------------------

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

function chunkIndexToLockName(index) {
  return `chunk_${String(Number(index)).padStart(6, '0')}.lock`;
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

function getRollingChunkLockPath(rollingId, index) {
  return `${getRollingPrefix(rollingId)}/locks/${chunkIndexToLockName(index)}`;
}

function getRollingMergeLockPath(rollingId) {
  return `${getRollingPrefix(rollingId)}/locks/merge.lock`;
}

function getRollingTaskStatePath(rollingId, index) {
  return `${getRollingPrefix(rollingId)}/tasks/task_${String(Number(index)).padStart(6, '0')}.json`;
}

// Per-device active-rolling lock. One lock per (deviceId, cameraId): prevents
// starting a second rolling session on the same camera while the first one
// is still active (i.e. not yet finalized).
function slugifyForGcs(s) {
  return String(s ?? '').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 200) || '_';
}

function getDeviceRollingActivePath(deviceId, cameraId) {
  return `tmp/hikconnect/rolling-active/${slugifyForGcs(deviceId)}__${slugifyForGcs(cameraId)}.json`;
}

// Per-device download index. Lists all rollingIds whose UI entry should be
// shown to the user (until they explicitly dismiss it or the entry expires).
function getDeviceDownloadIndexPath(deviceId, cameraId) {
  return `tmp/hikconnect/rolling-downloads/${slugifyForGcs(deviceId)}__${slugifyForGcs(cameraId)}.json`;
}

function parseChunkIndexFromName(name) {
  const m = String(name || '').match(/chunk_(\d{6})\.mp4$/);
  if (!m) return null;
  return Number(m[1]);
}

// ---------------------------------------------------------------------------
// GCS signed URL helper
// ---------------------------------------------------------------------------

async function getSignedReadUrl(gcsPath) {
  const [url] = await bucket.file(gcsPath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + ROLLING_SIGNED_URL_TTL_MS,
  });
  return url;
}

// ---------------------------------------------------------------------------
// Network / file helpers
// ---------------------------------------------------------------------------

async function downloadToFile(url, destPath, { timeoutMs = 5 * 60 * 1000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      const err = new Error(`Failed to download segment: HTTP ${resp.status}`);
      err.status = resp.status;
      // Ne pas inclure le corps de la réponse dans err.details (fuite d'info interne).
      throw err;
    }
    if (!resp.body) {
      const err = new Error('Download returned no body stream');
      err.status = 502;
      throw err;
    }
    await pipeline(resp.body, fs.createWriteStream(destPath));
  } catch (e) {
    if (e?.name === 'AbortError' || controller.signal.aborted) {
      const err = new Error(`Download timed out after ${timeoutMs}ms`);
      err.status = 504;
      err.details = { timeoutMs };
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Moteur V2 : streaming HTTP -> GCS direct (mémoire plate, pas de /tmp).
// L'instance App Engine F1 (256 Mo) ne peut pas bufferiser une vidéo entière :
// on relaie le flux HTTP de Hik-Connect directement vers un writeStream GCS,
// avec backpressure. La conso mémoire reste de l'ordre de quelques Mo quelle
// que soit la taille du fichier.
// ---------------------------------------------------------------------------
async function streamUrlToGcs(
  url,
  gcsPath,
  { contentType = 'video/mp4', timeoutMs = 9 * 60 * 1000 } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      const err = new Error(`Stream download failed: HTTP ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    if (!resp.body) {
      const err = new Error('Stream download returned no body');
      err.status = 502;
      throw err;
    }

    const gcsFile = bucket.file(gcsPath);
    const writeStream = gcsFile.createWriteStream({
      resumable: true,
      contentType,
      metadata: { cacheControl: 'public, max-age=3600' },
    });

    // pipeline gère la backpressure ET propage les erreurs des deux côtés.
    await pipeline(resp.body, writeStream);

    const [meta] = await gcsFile.getMetadata().catch(() => [null]);
    const size = meta?.size ? Number(meta.size) : null;
    if (!size || size <= 0) {
      const err = new Error('Streamed file is empty');
      err.status = 502;
      err.details = { gcsPath, size };
      throw err;
    }
    return { gcsPath, size };
  } catch (e) {
    if (e?.name === 'AbortError' || controller.signal.aborted) {
      const err = new Error(`Stream to GCS timed out after ${timeoutMs}ms`);
      err.status = 504;
      err.details = { timeoutMs, gcsPath };
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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

// ---------------------------------------------------------------------------
// Timeout heuristics
// ---------------------------------------------------------------------------

function computeDownloadTimeoutMs(beginTime, endTime, { minMs = 180000, maxMs = 900000 } = {}) {
  const bt = beginTime ? new Date(beginTime) : null;
  const et = endTime ? new Date(endTime) : null;
  if (!isValidDate(bt) || !isValidDate(et) || et <= bt) return minMs;

  const durationSec = Math.max(0, Math.floor((et.getTime() - bt.getTime()) / 1000));
  // Heuristic: base 3min + 1.0s per second of video.
  const ms = 180000 + durationSec * 1000;
  return Math.max(minMs, Math.min(maxMs, ms));
}

function computeRollingDownloadTimeoutMs(beginTime, endTime) {
  const bt = beginTime ? new Date(beginTime) : null;
  const et = endTime ? new Date(endTime) : null;
  const minMs = 35_000;
  const maxMs = 60_000;
  if (!isValidDate(bt) || !isValidDate(et) || et <= bt) return minMs;

  const durationSec = Math.max(0, Math.floor((et.getTime() - bt.getTime()) / 1000));
  // Fast timeout: most successful HikConnect tasks respond within 20-30s.
  // Stuck tasks stay at status=1 forever — fail fast (35s) then requeue.
  const ms = 20_000 + durationSec * 250;
  return Math.max(minMs, Math.min(maxMs, ms));
}

module.exports = {
  // env config
  ROLLING_AUTOTICK_ENABLED,
  ROLLING_AUTOTICK_INTERVAL_SEC,
  ROLLING_AUTOTICK_SECRET,
  ROLLING_LOG_DOWNLOADURL_EVERY,
  ROLLING_SPLIT_ON_TIMEOUT,
  ROLLING_SPLIT_PART_SEC,
  ROLLING_CONCAT_USE_SIGNED_URLS,
  ROLLING_SIGNED_URL_TTL_MS,
  // small utils
  sleep,
  withTimeout,
  // date helpers
  parseOffsetMinutes,
  toFixedOffsetIsoFromMs,
  isValidDate,
  validateIsoWindow,
  isOverlapping,
  normalizeVoiceSwitch,
  // gcs paths
  normalizeGcsDirectory,
  sanitizeGcsFilename,
  safeJoinGcsPath,
  chunkIndexToName,
  chunkIndexToLockName,
  getRollingPrefix,
  getRollingMetaPath,
  getRollingChunkPath,
  getRollingMergedPath,
  getRollingMergedVersionedPath,
  getRollingChunkLockPath,
  getRollingMergeLockPath,
  getRollingTaskStatePath,
  parseChunkIndexFromName,
  getDeviceRollingActivePath,
  getDeviceDownloadIndexPath,
  // gcs / network
  getSignedReadUrl,
  downloadToFile,
  streamUrlToGcs,
  uploadMergedToGcs,
  listRecordElementsInWindow,
  // timeouts
  computeDownloadTimeoutMs,
  computeRollingDownloadTimeoutMs,
};
