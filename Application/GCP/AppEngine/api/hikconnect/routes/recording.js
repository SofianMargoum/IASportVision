const express = require('express');

const { apiRequest } = require('../client');

const {
  proxypassRecord,
  getRecordingStatus,
  signRecordingStateToken,
  recordElementSearch,
  deleteRecordsByTimeRange,
  getManualRecordingState,
  setManualRecordingState,
} = require('../recording');

const { engineHls } = require('../../../db/recordingStore');

const { logRecording, logSofian } = require('../recordingGcsLog');

const router = express.Router();

// Limite de capture — doit refléter RECORDING_MAX_DURATION_SEC (worker HLS).
const RECORDING_MAX_DURATION_SEC = Math.max(
  60,
  Number(process.env.RECORDING_MAX_DURATION_SEC || 7200)
);

function formatMmSs(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Statut d'enregistrement basé sur la session HLS (Cloud SQL = source de vérité).
 *
 * En mode HLS, « l'enregistrement » est la capture Cloud Run (la vidéo du match),
 * pas l'enregistrement SD de la caméra. Le bouton Stop côté mobile doit donc
 * refléter la SESSION, pas l'état caméra. Conséquence : à 2 h (limite atteinte)
 * ou après un STOP, la session devient terminale -> isRecording=false -> le bouton
 * Stop disparaît, exactement comme pour un STOP manuel.
 *
 * Renvoie null si aucune session HLS récente pour ce device (=> fallback caméra).
 * Réconciliation idempotente : si la limite est atteinte alors que la session est
 * encore active, demande l'arrêt (le worker finalise) ; coupe l'enregistrement
 * manuel résiduel de la caméra une seule fois.
 */
async function resolveHlsSessionStatus({ deviceId, cameraId }) {
  let session = null;
  try {
    session = await engineHls.getActiveForDevice({ deviceId, cameraId });
  } catch {
    return null;
  }
  if (!session) return null;

  const state = session.state;
  const isTerminal = state === 'COMPLETED' || state === 'FAILED';
  const startMs = session.capture_started_at
    ? new Date(session.capture_started_at).getTime()
    : session.date_debut
    ? new Date(session.date_debut).getTime()
    : null;
  const elapsedSec = Number.isFinite(startMs) ? Math.max(0, (Date.now() - startMs) / 1000) : 0;
  const pastDue = elapsedSec >= RECORDING_MAX_DURATION_SEC;

  const active = !isTerminal && session.stop_requested !== true && !pastDue;

  // Réconciliation : limite atteinte mais session encore active -> demande l'arrêt
  // (le worker finalisera comme pour un STOP manuel). Idempotent.
  if (!isTerminal && session.stop_requested !== true && pastDue) {
    await engineHls.autoStop({ rollingId: session.rolling_id }).catch(() => {});
    await logRecording('HLS_AUTO_STOP_RECONCILED', {
      rollingId: session.rolling_id,
      deviceId,
      cameraId: cameraId ?? null,
      elapsedSec: Math.round(elapsedSec),
    }).catch(() => {});
  }

  // Dès que l'enregistrement n'est plus actif, couper l'enregistrement manuel
  // résiduel de la caméra (best-effort, une seule fois via le cache manuel).
  if (!active) {
    try {
      const manual = getManualRecordingState(deviceId);
      if (manual?.isRecording === true) {
        setManualRecordingState(deviceId, false);
        proxypassRecord(deviceId, 'stop').catch(() => {});
      }
    } catch {}
  }

  return {
    isRecording: active,
    recordingTime: active ? formatMmSs(elapsedSec) : null,
    recordingSource: 'session',
    sessionActive: active,
    sessionState: state || null,
    statusSource: 'hls-session',
  };
}

const STATUS_LOG_INTERVAL_MS = Number(process.env.RECORDING_STATUS_LOG_INTERVAL_MS || 60_000);
const lastStatusLogByKey = new Map();

function getStatusLogKey(deviceId, cameraId) {
  return `${String(deviceId)}::${cameraId ? String(cameraId) : ''}`;
}

function shouldLogStatusResult({ deviceId, cameraId, isRecording, statusNotSupported, statusSource }) {
  const now = Date.now();
  const key = getStatusLogKey(deviceId, cameraId);

  const prev = lastStatusLogByKey.get(key);
  const prevIsRecording = prev ? !!prev.isRecording : null;
  const prevNotSupported = prev ? !!prev.statusNotSupported : null;
  const prevSource = prev ? String(prev.statusSource || '') : null;
  const prevAt = prev ? Number(prev.at) : 0;

  const changed =
    prev === undefined ||
    prevIsRecording !== !!isRecording ||
    prevNotSupported !== !!statusNotSupported ||
    prevSource !== String(statusSource || '');

  const due = !Number.isFinite(STATUS_LOG_INTERVAL_MS) || STATUS_LOG_INTERVAL_MS <= 0 ? true : now - prevAt >= STATUS_LOG_INTERVAL_MS;

  if (changed || due) {
    // Basic bound to prevent unbounded growth if keys explode.
    if (lastStatusLogByKey.size > 5000) lastStatusLogByKey.clear();
    lastStatusLogByKey.set(key, {
      at: now,
      isRecording: !!isRecording,
      statusNotSupported: !!statusNotSupported,
      statusSource: String(statusSource || ''),
    });
    return true;
  }

  return false;
}

// Start recording via proxypass
router.put('/hikconnect/start-recording', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  try {
    await logRecording('START_RECORDING_REQUEST', { deviceId });
    const data = await proxypassRecord(deviceId, 'start');
    const recordingStateToken = signRecordingStateToken({ deviceId, action: 'start' });
    const payload = data && typeof data === 'object' && !Array.isArray(data) ? { ...data, recordingStateToken } : { data, recordingStateToken };
    await logRecording('START_RECORDING_OK', { deviceId });
    res.status(200).json(payload);
  } catch (err) {
    await logRecording('START_RECORDING_ERR', { deviceId, message: err?.message, status: err?.status });
    const status = err?.status || 500;
    res.status(status).json({ message: status < 500 ? err.message : 'Recording error' });
  }
});

// Stop recording via proxypass
router.put('/hikconnect/stop-recording', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  try {
    await logRecording('STOP_RECORDING_REQUEST', { deviceId });
    const data = await proxypassRecord(deviceId, 'stop');
    const recordingStateToken = signRecordingStateToken({ deviceId, action: 'stop' });
    const payload = data && typeof data === 'object' && !Array.isArray(data) ? { ...data, recordingStateToken } : { data, recordingStateToken };
    await logRecording('STOP_RECORDING_OK', { deviceId });
    await logSofian('enregistrement arrêté', { deviceId });
    res.status(200).json(payload);
  } catch (err) {
    await logRecording('STOP_RECORDING_ERR', { deviceId, message: err?.message, status: err?.status });
    const status = err?.status || 500;
    res.status(status).json({ message: status < 500 ? err.message : 'Recording error' });
  }
});

// Recording status via proxypass
router.post('/hikconnect/recording-status', async (req, res) => {
  const { deviceId, cameraId, debug, recordingStateToken } = req.body || {};
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  try {
    const isDebug = debug === true || debug === 1 || debug === '1';
    if (isDebug) {
      await logRecording('RECORDING_STATUS_REQUEST', {
        deviceId,
        cameraId: cameraId ?? null,
        hasToken: !!recordingStateToken,
        debug: true,
      });
    }

    // ===== Source de vérité = session HLS (Cloud SQL) quand elle existe =====
    // Couvre le mode HLS par défaut : le statut suit la capture (la vidéo du
    // match), de sorte que l'arrêt à 2 h ou le STOP manuel coupent le bouton.
    const sessionStatus = await resolveHlsSessionStatus({ deviceId, cameraId: cameraId ?? null });
    if (sessionStatus) {
      const doLog =
        isDebug ||
        shouldLogStatusResult({
          deviceId,
          cameraId: cameraId ?? null,
          isRecording: sessionStatus.isRecording,
          statusNotSupported: false,
          statusSource: sessionStatus.statusSource,
        });
      if (doLog) {
        await logRecording('RECORDING_STATUS_RESULT', {
          deviceId,
          cameraId: cameraId ?? null,
          isRecording: sessionStatus.isRecording,
          statusSource: sessionStatus.statusSource,
          sessionState: sessionStatus.sessionState,
          throttled: !isDebug,
        });
      }
      return res.status(200).json(
        isDebug
          ? { ...sessionStatus }
          : {
              isRecording: sessionStatus.isRecording,
              recordingTime: sessionStatus.recordingTime,
              recordingSource: sessionStatus.recordingSource,
              sessionActive: sessionStatus.sessionActive,
            }
      );
    }

    // ===== Fallback : statut basé caméra (V1/V2/legacy, ou device sans HLS) =====
    const data = await getRecordingStatus(deviceId, {
      cameraId: cameraId ?? null,
      debug: isDebug,
      recordingStateToken: recordingStateToken ?? null,
    });

    const isRecording = !!data?.isRecording;
    const statusNotSupported = !!data?.statusNotSupported;
    const statusSource = data?.statusSource;
    const doLog =
      isDebug ||
      shouldLogStatusResult({ deviceId, cameraId: cameraId ?? null, isRecording, statusNotSupported, statusSource });
    if (doLog) {
      await logRecording('RECORDING_STATUS_RESULT', {
        deviceId,
        cameraId: cameraId ?? null,
        isRecording,
        statusSource,
        statusNotSupported,
        readySegmentsProbe: data?.recentSegmentsProbe?.inferred,
        throttled: !isDebug,
      });
    }

    res.status(200).json(
      isDebug
        ? data
        : {
            isRecording,
            recordingTime: data?.recordingTime ?? null,
          }
    );
  } catch (err) {
    await logRecording('RECORDING_STATUS_ERR', { deviceId, cameraId: cameraId ?? null, message: err?.message, status: err?.status });
    const status = err?.status || 500;
    res.status(status).json({ message: status < 500 ? err.message : 'Status error' });
  }
});

// ✅ Record element search (JSON)
router.post('/hikconnect/record/element/search', async (req, res) => {
  try {
    const data = await recordElementSearch(req.body || {});
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status < 500 ? err.message : 'Search error' });
  }
});

// Quick ISAPI proxypass test
router.post('/hikconnect/isapi/proxypass-test', async (req, res) => {
  const source = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : req.body;

  const deviceId = source?.deviceId ?? req.query?.deviceId;
  const method = String(source?.method ?? req.query?.method ?? 'GET').toUpperCase();
  const url = source?.url ?? source?.requestURL ?? req.query?.url;
  const contentType = source?.contentType ?? req.query?.contentType ?? 'application/xml';
  const body = source?.body ?? req.query?.body ?? '';

  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });
  if (!url) {
    return res.status(400).json({
      message: 'Missing url',
      hint: 'Send JSON with {deviceId, method, url} and header Content-Type: application/json (or pass url as query param).',
    });
  }
  if (typeof url !== 'string' || !url.startsWith('/ISAPI/')) {
    return res.status(400).json({ message: 'url must start with /ISAPI/' });
  }
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
    return res.status(400).json({ message: 'Invalid method (GET/POST/PUT/DELETE)' });
  }

  try {
    const data = await apiRequest('/api/hccgw/video/v1/isapi/proxypass', {
      body: {
        id: deviceId,
        method,
        url,
        contentType,
        body,
      },
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status < 500 ? err.message : 'Proxypass error' });
  }
});

// Delete recordings for a device in a given time range
router.delete('/hikconnect/record/delete-by-time-range', async (req, res) => {
  const deviceId = req.body?.deviceId ?? req.query?.deviceId;
  const startTime = req.body?.startTime ?? req.query?.startTime;
  const endTime = req.body?.endTime ?? req.query?.endTime;

  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });
  if (!startTime) return res.status(400).json({ message: 'Missing startTime' });
  if (!endTime) return res.status(400).json({ message: 'Missing endTime' });

  try {
    const data = await deleteRecordsByTimeRange(deviceId, startTime, endTime);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status < 500 ? err.message : 'Delete error' });
  }
});

module.exports = router;
