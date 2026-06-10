// Storage layer for the rolling export:
// - meta.json read/write/patch
// - per-chunk task state (taskId, polling status, ...) read/write
// - GCS-precondition based locks (chunk + merge)

const { bucket } = require('../../gcs');
const {
  getRollingMetaPath,
  getRollingTaskStatePath,
  getRollingChunkLockPath,
  getRollingMergeLockPath,
  getDeviceRollingActivePath,
  getDeviceDownloadIndexPath,
} = require('./utils');

// ---------------------------------------------------------------------------
// Generic JSON helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Meta.json
// ---------------------------------------------------------------------------

async function readRollingMeta(rollingId) {
  const file = bucket.file(getRollingMetaPath(rollingId));
  const [exists] = await file.exists();
  if (!exists) {
    const err = new Error('Rolling session not found');
    err.status = 404;
    throw err;
  }
  const [buf] = await file.download();
  return JSON.parse(buf.toString('utf8'));
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

// ---------------------------------------------------------------------------
// Per-chunk task state
// ---------------------------------------------------------------------------

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
  const current =
    (await readJsonIfExists(getRollingTaskStatePath(rollingId, index)).catch(() => null)) || {};
  const next = { ...current, ...(patch || {}), updatedAt: Date.now() };
  await writeRollingTaskState(rollingId, index, next);
  return next;
}

// ---------------------------------------------------------------------------
// Locks (GCS ifGenerationMatch=0 precondition)
// ---------------------------------------------------------------------------

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
    if (e?.code !== 412) throw e;

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
    if (e?.code !== 412) throw e;

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

// ---------------------------------------------------------------------------
// Per-device rolling FIFO queue
// (one "tail pointer" file per deviceId+cameraId. New /start reads the
//  current tail to know its predecessor, then becomes the new tail. The
//  per-rolling tick checks meta.queuedBehind to know whether to wait.)
// ---------------------------------------------------------------------------

async function readDeviceRollingTail({ deviceId, cameraId }) {
  const lockPath = getDeviceRollingActivePath(deviceId, cameraId);
  return readJsonIfExists(lockPath).catch(() => null);
}

/**
 * Atomically swap the per-device "tail" pointer to the new rolling.
 * Returns the previous tail (or null if none / stale).
 *
 * staleMs: if the existing tail is older than this, it is considered crashed
 * and ignored (returned as null) so the new rolling does not wait on a
 * zombie predecessor.
 */
async function swapDeviceRollingTail({
  deviceId,
  cameraId,
  rollingId,
  staleMs = 4 * 60 * 60 * 1000, // 4h — supports sessions up to ~3h
}) {
  const lockPath = getDeviceRollingActivePath(deviceId, cameraId);
  const lockFile = bucket.file(lockPath);
  const previous = await readJsonIfExists(lockPath).catch(() => null);

  let validPredecessor = null;
  if (previous && previous.rollingId && String(previous.rollingId) !== String(rollingId)) {
    const createdAt = Number(previous.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt <= staleMs) {
      validPredecessor = previous;
    }
  }

  await lockFile.save(
    JSON.stringify({
      rollingId: String(rollingId),
      deviceId: String(deviceId),
      cameraId: String(cameraId),
      createdAt: Date.now(),
      queuedBehind: validPredecessor ? String(validPredecessor.rollingId) : null,
    }),
    {
      resumable: false,
      contentType: 'application/json',
      metadata: { cacheControl: 'no-store' },
    }
  );

  return { previous, validPredecessor, lockPath };
}

/** Clear the per-device tail pointer ONLY if it still points to this rolling. */
async function clearDeviceRollingTailIfHead({ deviceId, cameraId, rollingId }) {
  const lockPath = getDeviceRollingActivePath(deviceId, cameraId);
  const lockFile = bucket.file(lockPath);
  try {
    const existing = await readJsonIfExists(lockPath).catch(() => null);
    if (!existing) return false;
    if (String(existing.rollingId) !== String(rollingId)) {
      // A successor has taken the tail position — leave it alone.
      return false;
    }
    await lockFile.delete({ ignoreNotFound: true });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Per-device download index
// One JSON file per (deviceId, cameraId) listing every rollingId that should
// still be visible in the user's "downloads" panel. Entries stay until either:
//   - the client explicitly dismisses them (X button), or
//   - they expire (24h after finalize).
// This is intentionally separate from the FIFO queue chain (queuedBehind):
// the chain only orders ACTIVE rollings, while the download index is the
// UI source of truth.
// ---------------------------------------------------------------------------

const DOWNLOAD_INDEX_TTL_MS = 24 * 60 * 60 * 1000; // 24h after finalize

async function readDeviceDownloadIndex({ deviceId, cameraId }) {
  const p = getDeviceDownloadIndexPath(deviceId, cameraId);
  const data = await readJsonIfExists(p).catch(() => null);
  const list = Array.isArray(data?.items) ? data.items : [];
  // Sort oldest-first for stable display.
  return list.slice().sort((a, b) => Number(a?.addedAt || 0) - Number(b?.addedAt || 0));
}

async function writeDeviceDownloadIndex({ deviceId, cameraId, items }) {
  const p = getDeviceDownloadIndexPath(deviceId, cameraId);
  await bucket.file(p).save(JSON.stringify({ items }), {
    resumable: false,
    contentType: 'application/json',
    metadata: { cacheControl: 'no-store' },
  });
}

/** Add (or upsert) a rollingId to the download index. */
async function appendDeviceDownloadIndex({ deviceId, cameraId, rollingId }) {
  const items = await readDeviceDownloadIndex({ deviceId, cameraId });
  const id = String(rollingId);
  if (items.some((it) => String(it.rollingId) === id)) return items;
  items.push({ rollingId: id, addedAt: Date.now() });
  await writeDeviceDownloadIndex({ deviceId, cameraId, items });
  return items;
}

/** Remove a rollingId from the index (used by dismiss + TTL cleanup). */
async function removeFromDeviceDownloadIndex({ deviceId, cameraId, rollingId }) {
  const items = await readDeviceDownloadIndex({ deviceId, cameraId });
  const id = String(rollingId);
  const next = items.filter((it) => String(it.rollingId) !== id);
  if (next.length === items.length) return false;
  await writeDeviceDownloadIndex({ deviceId, cameraId, items: next });
  return true;
}

module.exports = {
  readJsonIfExists,
  readRollingMeta,
  writeRollingMeta,
  patchRollingMeta,
  writeRollingTaskState,
  updateRollingTaskState,
  acquireRollingChunkLock,
  releaseRollingChunkLock,
  acquireRollingMergeLock,
  readDeviceRollingTail,
  swapDeviceRollingTail,
  clearDeviceRollingTailIfHead,
  readDeviceDownloadIndex,
  appendDeviceDownloadIndex,
  removeFromDeviceDownloadIndex,
  DOWNLOAD_INDEX_TTL_MS,
};
