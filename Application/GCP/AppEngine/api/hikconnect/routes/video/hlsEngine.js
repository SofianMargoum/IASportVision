// Moteur HLS Live — côté App Engine (orchestration).
//
// App Engine ne capture PAS le flux (instance F1 256 Mo, pas de process long) :
// il résout la caméra, obtient l'URL HLS, crée la session Cloud SQL, puis
// déclenche une exécution du Cloud Run Job `iasv-recorder` qui fait la capture
// FFmpeg réelle (process longue durée, jusqu'à 2 h) et streame vers GCS.
//
// Le déclenchement utilise l'API Cloud Run Admin v2 (jobs:run) avec un override
// d'environnement ROLLING_ID, via google-auth-library (déjà dépendance).

const { GoogleAuth } = require('google-auth-library');

const { resolveCameraIdentifiers, getLiveAddress } = require('../../resources');
const { getDefaultOffset } = require('../../recording');
const { logRecording } = require('../../recordingGcsLog');
const { engineHls } = require('../../../../db/recordingStore');
const { safeJoinGcsPath, sanitizeGcsFilename } = require('./utils');

const RECORDER_JOB = process.env.CLOUD_RUN_RECORDER_JOB || 'iasv-recorder';
const RECORDER_REGION = process.env.CLOUD_RUN_RECORDER_REGION || 'europe-west9';
const RECORDER_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  null;
const RECORDER_MAX_DURATION_SEC = Math.max(
  60,
  Number(process.env.RECORDING_MAX_DURATION_SEC || 7200)
);

// Marge de finalisation : temps laissé au worker APRÈS la capture pour le
// faststart + l'upload GCS + l'écriture de l'état terminal. Pour un match de 2 h
// (fichier multi-Go), 10 min ne suffisent pas et l'infra tuait le conteneur en
// pleine finalisation (-> session orpheline). 30 min par défaut, configurable.
// Le `--task-timeout` du Cloud Run Job doit être >= MAX + cette marge.
const RECORDER_FINALIZE_BUFFER_SEC = Math.max(
  120,
  Number(process.env.RECORDER_FINALIZE_BUFFER_SEC || 1800)
);
const RECORDER_TASK_TIMEOUT_SEC = RECORDER_MAX_DURATION_SEC + RECORDER_FINALIZE_BUFFER_SEC;

let _auth = null;
function getAuth() {
  if (_auth) return _auth;
  _auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
  return _auth;
}

function recorderConfigReport() {
  return {
    job: RECORDER_JOB,
    region: RECORDER_REGION,
    project: RECORDER_PROJECT,
    configured: !!RECORDER_PROJECT,
    maxDurationSec: RECORDER_MAX_DURATION_SEC,
    finalizeBufferSec: RECORDER_FINALIZE_BUFFER_SEC,
    taskTimeoutSec: RECORDER_TASK_TIMEOUT_SEC,
  };
}

// Chemins GCS : on capture vers un fichier temporaire (le nom final dépend du
// score, connu seulement au STOP) puis on copie vers le chemin final.
function buildTempGcsPath(rollingId) {
  return `tmp/hikconnect/hls/${String(rollingId)}.mp4`;
}

function buildFinalGcsPath(directory, combinedFilename) {
  const dir = String(directory || '').trim();
  const combined = String(combinedFilename || '').trim();
  if (!dir) return null;
  // Convention historique : "<directory>/<directory> <combinedFilename>.mp4".
  const base = combined ? `${dir} ${combined}` : dir;
  const name = sanitizeGcsFilename(base.endsWith('.mp4') ? base : `${base}.mp4`);
  return safeJoinGcsPath(dir, name);
}

/**
 * Déclenche une exécution du Cloud Run Job de capture, en passant ROLLING_ID
 * en override d'environnement. Renvoie le nom de l'exécution.
 */
async function triggerCaptureJob({ rollingId }) {
  if (!RECORDER_PROJECT) {
    const err = new Error('Projet GCP introuvable (GOOGLE_CLOUD_PROJECT) pour déclencher le job');
    err.status = 500;
    throw err;
  }
  const client = await getAuth().getClient();
  const url =
    `https://run.googleapis.com/v2/projects/${RECORDER_PROJECT}` +
    `/locations/${RECORDER_REGION}/jobs/${RECORDER_JOB}:run`;

  const resp = await client.request({
    url,
    method: 'POST',
    data: {
      overrides: {
        containerOverrides: [{ env: [{ name: 'ROLLING_ID', value: String(rollingId) }] }],
        taskCount: 1,
        timeout: `${RECORDER_TASK_TIMEOUT_SEC}s`,
      },
    },
  });

  // L'opération longue : son `name` identifie l'exécution lancée.
  const opName = resp?.data?.name || null;
  const execName = resp?.data?.metadata?.name || opName || null;
  return { executionName: execName, operation: opName };
}

/**
 * START HLS : résout la caméra, obtient l'URL HLS, crée la session Cloud SQL
 * (RECORDING) et déclenche le worker de capture. Renvoie { rollingId, row }.
 */
async function startHls({
  rollingId,
  deviceId,
  cameraId,
  beginTimeIso,
  offset,
  directory,
  combinedFilename,
  thumb,
}) {
  const off = typeof offset === 'string' && offset ? offset : getDefaultOffset();

  // 1) Résolution caméra (resourceId + deviceSerial) — aucun hardcode.
  const cam = await resolveCameraIdentifiers(cameraId);
  if (!cam?.deviceSerial) {
    const err = new Error('deviceSerial introuvable pour cette caméra (areas/cameras/get)');
    err.status = 502;
    err.details = { cameraId };
    throw err;
  }

  // 2) URL HLS Live (jamais journalisée).
  const live = await getLiveAddress({
    deviceSerial: cam.deviceSerial,
    resourceId: cam.resourceId,
    type: '1',
    protocol: 2,
    quality: 1,
    expireTime: RECORDER_MAX_DURATION_SEC,
  });
  await logRecording('HLS_LIVE_ADDRESS_OK', {
    rollingId,
    deviceId,
    cameraId,
    deviceSerial: cam.deviceSerial,
    urlPresent: !!live?.url,
    expireTime: live?.expireTime,
  }).catch(() => {});

  // 3) Session Cloud SQL (RECORDING) + chemins GCS.
  const tempGcsPath = buildTempGcsPath(rollingId);
  const finalGcsPath = buildFinalGcsPath(directory, combinedFilename);
  const row = await engineHls.start({
    rollingId,
    deviceId,
    cameraId,
    deviceSerial: cam.deviceSerial,
    liveUrl: live.url,
    directory,
    combinedFilename,
    beginTimeIso,
    offset: off,
    finalGcsPath,
    tempGcsPath,
    thumb,
  });

  // 4) Déclenche le worker de capture.
  let executionName = null;
  try {
    const trig = await triggerCaptureJob({ rollingId });
    executionName = trig.executionName;
    await engineHls.markCapturing({ rollingId, executionName });
    await logRecording('HLS_CAPTURE_TRIGGERED', { rollingId, executionName }).catch(() => {});
  } catch (e) {
    // Échec de déclenchement : marque la session interrompue et propage.
    await engineHls.fail({ rollingId, error: `Déclenchement worker échoué: ${e?.message}` }).catch(
      () => {}
    );
    await logRecording('HLS_CAPTURE_TRIGGER_ERR', {
      rollingId,
      message: e?.message,
      status: e?.status || e?.code || null,
    }).catch(() => {});
    const err = new Error('Échec du démarrage de la capture HLS');
    err.status = 502;
    throw err;
  }

  return { rollingId, row, executionName, finalGcsPath, tempGcsPath };
}

module.exports = {
  recorderConfigReport,
  buildTempGcsPath,
  buildFinalGcsPath,
  triggerCaptureJob,
  startHls,
  RECORDER_MAX_DURATION_SEC,
  RECORDER_FINALIZE_BUFFER_SEC,
  RECORDER_TASK_TIMEOUT_SEC,
};
