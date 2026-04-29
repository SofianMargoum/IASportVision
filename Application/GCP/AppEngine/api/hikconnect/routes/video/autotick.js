// Cloud Tasks auto-tick for the rolling export.
// Optional dependency: works without @google-cloud/tasks (returns "not_configured").

const {
  ROLLING_AUTOTICK_ENABLED,
  ROLLING_AUTOTICK_INTERVAL_SEC,
  ROLLING_AUTOTICK_SECRET,
} = require('./utils');

let CloudTasksClient;
try {
  ({ CloudTasksClient } = require('@google-cloud/tasks'));
} catch {
  CloudTasksClient = null;
}

const CLOUD_TASKS_QUEUE = process.env.CLOUD_TASKS_QUEUE
  ? String(process.env.CLOUD_TASKS_QUEUE)
  : null;
const CLOUD_TASKS_LOCATION = process.env.CLOUD_TASKS_LOCATION
  ? String(process.env.CLOUD_TASKS_LOCATION)
  : null;
const CLOUD_TASKS_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  null;

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
  if (!got) return false;
  // Utiliser timingSafeEqual pour éviter les attaques par timing.
  const crypto = require('node:crypto');
  try {
    const ba = Buffer.from(String(got));
    const bb = Buffer.from(ROLLING_AUTOTICK_SECRET);
    if (ba.length !== bb.length) {
      crypto.timingSafeEqual(ba, Buffer.alloc(ba.length));
      return false;
    }
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function enqueueRollingAutoTick({
  rollingId,
  delaySec = ROLLING_AUTOTICK_INTERVAL_SEC,
}) {
  if (!isAutoTickConfigured()) return { enqueued: false, reason: 'not_configured' };

  const client = getTasksClient();
  const parent = client.queuePath(CLOUD_TASKS_PROJECT, CLOUD_TASKS_LOCATION, CLOUD_TASKS_QUEUE);

  const nextRunAtMs = Date.now() + Math.max(0, Number(delaySec) || 0) * 1000;
  const nextRunSec = Math.floor(nextRunAtMs / 1000);
  const taskId = `rolling_${String(rollingId)}_${String(nextRunSec)}`;

  const payload = { rollingId: String(rollingId) };

  // On App Engine: without explicit routing, Cloud Tasks can hit the default service.
  // Routing to current service/version makes auto-tick reliable in multi-service deploys.
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
        ...(ROLLING_AUTOTICK_SECRET
          ? { 'x-rolling-autotick-secret': ROLLING_AUTOTICK_SECRET }
          : {}),
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

// Enqueue a Cloud Task that calls /rolling/finalize-internal with the
// finalize args. Cloud Tasks will auto-retry on 5xx with backoff.
async function enqueueRollingFinalize({
  rollingId,
  delaySec = 5,
  args = {},
}) {
  if (!isAutoTickConfigured()) return { enqueued: false, reason: 'not_configured' };

  const client = getTasksClient();
  const parent = client.queuePath(CLOUD_TASKS_PROJECT, CLOUD_TASKS_LOCATION, CLOUD_TASKS_QUEUE);

  const nextRunAtMs = Date.now() + Math.max(0, Number(delaySec) || 0) * 1000;
  const nextRunSec = Math.floor(nextRunAtMs / 1000);
  const taskId = `rolling_final_${String(rollingId)}_${String(nextRunSec)}`;

  const payload = { rollingId: String(rollingId), ...args };

  const appEngineRouting = {
    ...(process.env.GAE_SERVICE ? { service: String(process.env.GAE_SERVICE) } : {}),
    ...(process.env.GAE_VERSION ? { version: String(process.env.GAE_VERSION) } : {}),
  };

  const task = {
    name: `${parent}/tasks/${taskId}`,
    scheduleTime: { seconds: nextRunSec },
    // Long-running finalize: 9-minute timeout (just under GAE's 10-min cap).
    dispatchDeadline: { seconds: 9 * 60 },
    appEngineHttpRequest: {
      httpMethod: 'POST',
      relativeUri: '/api/hikconnect/video/rolling/finalize-internal',
      ...(Object.keys(appEngineRouting).length > 0 ? { appEngineRouting } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...(ROLLING_AUTOTICK_SECRET
          ? { 'x-rolling-autotick-secret': ROLLING_AUTOTICK_SECRET }
          : {}),
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    },
  };

  try {
    await client.createTask({ parent, task });
    return { enqueued: true, taskId, nextRunSec };
  } catch (e) {
    if (e?.code === 6) return { enqueued: false, already: true, taskId, nextRunSec };
    throw e;
  }
}

module.exports = {
  getAutoTickConfigReport,
  isAutoTickConfigured,
  requireAutoTickSecret,
  enqueueRollingAutoTick,
  enqueueRollingFinalize,
};
