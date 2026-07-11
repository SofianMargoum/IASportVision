// Moteur d'enregistrement V2 — machine d'état pilotée par Cloud SQL.
//
// Remplace le pipeline "chunks 60s + merge ffmpeg" par un EXPORT UNIQUE :
//   EXPORTING            -> save([début, fin]) Hik-Connect, mémorise la taskId
//   WAITING_DOWNLOAD_URL -> poll download-url jusqu'à status 0
//   DOWNLOADING          -> streaming HTTP -> GCS (mémoire plate, pas de /tmp)
//   COMPLETED            -> vidéo finale écrite + miniature (best-effort)
//
// Aucun ffmpeg, aucune fusion : élimine la cause racine (OOM sur F1).
// Chaque appel runV2Step() fait UNE transition courte puis se ré-enfile via
// Cloud Tasks (queue concurrency=1 => strictement séquentiel par caméra).
// L'état vit en base : après un crash, le step suivant reprend où on en était.

const { saveVideoWithRetry, getDownloadUrl } = require('../../video');
const { getDefaultOffset } = require('../../recording');
const { logRecording } = require('../../recordingGcsLog');
const { engineV2 } = require('../../../../db/recordingStore');
const { bucket } = require('../../gcs');

const {
  streamUrlToGcs,
  safeJoinGcsPath,
  toFixedOffsetIsoFromMs,
} = require('./utils');

// Miniature (cover + 2 logos). Chargé paresseusement : si canvas est absent,
// la finalisation vidéo reste fonctionnelle.
let _runMergeImages = null;
try {
  const mod = require('../../../mergeImages');
  _runMergeImages = typeof mod?.runMergeImages === 'function' ? mod.runMergeImages : null;
} catch {
  _runMergeImages = null;
}

const MAX_DURATION_SEC = Math.max(
  60,
  Number(process.env.RECORDING_MAX_DURATION_SEC || 7200) // défaut 2h
);
const POLL_DELAY_SEC = Math.max(
  5,
  Number(process.env.RECORDING_EXPORT_POLL_SEC || 30) // poll download-url
);
const MAX_POLL_ATTEMPTS = Math.max(
  3,
  Number(process.env.RECORDING_EXPORT_MAX_POLLS || 80) // 80 * 30s ≈ 40 min
);
const MAX_DOWNLOAD_ATTEMPTS = Math.max(
  1,
  Number(process.env.RECORDING_DOWNLOAD_MAX_ATTEMPTS || 5)
);

function hikVoiceSwitch(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 2;
  return n === 0 ? 2 : n; // 0 (sans voix) -> 2 côté Hik-Connect
}

// Construit le chemin GCS final à partir des infos disponibles.
// Priorité : finalGcsPath déjà calculé > directory+filename (finalize) > thumb_json.
function resolveFinalGcsPath(row, { directory, filename } = {}) {
  if (row?.final_gcs_path) return row.final_gcs_path;
  const thumb = row?.thumb_json || {};
  const dir = directory || thumb.directory;
  let name = filename;
  if (!name) {
    const combined = thumb.combinedFilename;
    if (dir && combined) name = `${dir} ${combined}.mp4`;
  }
  if (!dir || !name) return null;
  const finalName = String(name).toLowerCase().endsWith('.mp4') ? String(name) : `${name}.mp4`;
  return safeJoinGcsPath(dir, finalName);
}

function publicUrlFor(gcsPath) {
  return `https://storage.googleapis.com/${bucket.name}/${encodeURI(gcsPath)}`;
}

// Miniature best-effort (après COMPLETED) : ne bloque jamais la vidéo.
function fireThumbnail(rollingId, row) {
  const thumb = row?.thumb_json || {};
  const directory = thumb.directory;
  const combinedFilename = thumb.combinedFilename;
  const homeLogoUrl = thumb.homeLogoUrl;
  const awayLogoUrl = thumb.awayLogoUrl;
  if (
    !_runMergeImages ||
    !directory ||
    !combinedFilename ||
    !homeLogoUrl ||
    !awayLogoUrl ||
    !/^https:\/\//i.test(String(homeLogoUrl)) ||
    !/^https:\/\//i.test(String(awayLogoUrl))
  ) {
    return;
  }
  const baseName = combinedFilename.toLowerCase().endsWith('.png')
    ? combinedFilename
    : `${combinedFilename}.png`;
  const finalName = baseName.startsWith(`${directory} `) ? baseName : `${directory} ${baseName}`;
  Promise.resolve()
    .then(() =>
      _runMergeImages({
        logo1Url: homeLogoUrl,
        logo2Url: awayLogoUrl,
        finalFolder: directory,
        finalName,
      })
    )
    .then(async (out) => {
      await engineV2.markThumbnail(rollingId).catch(() => {});
      await logRecording('V2_THUMBNAIL_OK', { rollingId, gcsPath: out?.gcsPath }).catch(() => {});
    })
    .catch(async (e) => {
      await logRecording('V2_THUMBNAIL_ERR', { rollingId, message: e?.message }).catch(() => {});
    });
}

// ---------------------------------------------------------------------------
// Une transition de la FSM. Renvoie { terminal, nextDelaySec } :
//   - terminal=true  => plus rien à faire (COMPLETED/FAILED/introuvable)
//   - nextDelaySec=N => le routeur doit ré-enfiler un step dans N secondes
// ---------------------------------------------------------------------------
async function runV2Step({ rollingId }) {
  const row = await engineV2.get(rollingId);
  if (!row) return { terminal: true, reason: 'not_found' };
  if (row.engine !== 'v2') return { terminal: true, reason: 'not_v2' };
  if (row.state === 'COMPLETED' || row.state === 'FAILED') {
    return { terminal: true, reason: 'already_terminal', state: row.state };
  }

  try {
    switch (row.state) {
      case 'RECORDING':
        return await stepDeadlineCheck(row);
      case 'EXPORTING':
        return await stepExport(row);
      case 'WAITING_DOWNLOAD_URL':
        return await stepPoll(row);
      case 'DOWNLOADING':
        return await stepDownload(row);
      default:
        // État inconnu : on relance un export propre.
        return await stepExport(row);
    }
  } catch (e) {
    await engineV2
      .fail({ rollingId, error: `${row.state}: ${e?.message || 'erreur inconnue'}` })
      .catch(() => {});
    await logRecording('V2_STEP_FAILED', {
      rollingId,
      state: row.state,
      message: e?.message,
      status: e?.status,
    }).catch(() => {});
    return { terminal: true, reason: 'failed', error: e?.message };
  }
}

// RECORDING : sonde de limite de durée. Ne fait rien tant que la limite n'est
// pas atteinte (re-planifie). À la limite : déclenche l'export auto (TIMEOUT).
async function stepDeadlineCheck(row) {
  const beginMs = row.date_debut ? new Date(row.date_debut).getTime() : NaN;
  if (!Number.isFinite(beginMs)) {
    // Pas de date de début exploitable : on attend un STOP explicite.
    return { terminal: false, nextDelaySec: MAX_DURATION_SEC };
  }
  const deadlineMs = beginMs + MAX_DURATION_SEC * 1000;
  const now = Date.now();
  if (now < deadlineMs) {
    return { terminal: false, nextDelaySec: Math.ceil((deadlineMs - now) / 1000) + 2 };
  }

  const offset = row.cam_offset || getDefaultOffset();
  const endIso = toFixedOffsetIsoFromMs(deadlineMs, offset);
  const finalGcsPath = resolveFinalGcsPath(row);
  await engineV2.beginExport({
    rollingId: row.rolling_id,
    exportEndIso: endIso,
    dateFin: new Date(deadlineMs),
    finalGcsPath,
    reason: 'timeout',
    timeout: true,
  });
  await logRecording('V2_AUTO_TIMEOUT', {
    rollingId: row.rolling_id,
    deviceId: row.device_id,
    cameraId: row.camera_id,
    maxDurationSec: MAX_DURATION_SEC,
    endIso,
  }).catch(() => {});
  return { terminal: false, nextDelaySec: 1 };
}

// EXPORTING : un seul save Hik-Connect sur toute la fenêtre.
async function stepExport(row) {
  const rollingId = row.rolling_id;
  const beginTime = row.export_begin_iso;
  const endTime = row.export_end_iso;
  if (!beginTime || !endTime) {
    const err = new Error('Fenêtre d\'export incomplète (begin/end manquant)');
    err.status = 500;
    throw err;
  }
  if (new Date(endTime).getTime() <= new Date(beginTime).getTime()) {
    const err = new Error('Fenêtre d\'export invalide (fin <= début)');
    err.status = 400;
    throw err;
  }

  const payload = {
    cameraId: row.camera_id,
    beginTime,
    endTime,
    voiceSwitch: hikVoiceSwitch(row.voice_switch),
  };

  await logRecording('V2_EXPORT_SAVE', { rollingId, payload }).catch(() => {});
  const save = await saveVideoWithRetry(payload, { maxAttempts: 8, baseDelayMs: 1500 });
  const taskId = save?.data?.taskId;
  if (!taskId) {
    const err = new Error('taskId absent de la réponse save');
    err.status = 502;
    throw err;
  }

  await engineV2.setTask({ rollingId, taskId });
  await logRecording('V2_EXPORT_TASKID', { rollingId, taskId }).catch(() => {});
  return { terminal: false, nextDelaySec: 5 };
}

// WAITING_DOWNLOAD_URL : un seul poll par step.
async function stepPoll(row) {
  const rollingId = row.rolling_id;
  const taskId = row.hik_task_id;
  if (!taskId) {
    const err = new Error('hik_task_id manquant en attente download-url');
    err.status = 500;
    throw err;
  }

  const data = await getDownloadUrl({ taskId });
  const status = data?.data?.status;
  const urls = Array.isArray(data?.data?.urls) ? data.data.urls : [];

  await logRecording('V2_DOWNLOAD_URL_POLL', {
    rollingId,
    taskId,
    status,
    urlsCount: urls.length,
    attempt: row.attempts,
  }).catch(() => {});

  if (status === 0 && urls.length > 0) {
    await engineV2.setDownloading({ rollingId, url: urls[0] });
    return { terminal: false, nextDelaySec: 1 };
  }
  if (status === 2) {
    const err = new Error('Hik-Connect a échoué la génération (status 2)');
    err.status = 502;
    throw err;
  }
  // status 1 (en cours) : on re-planifie tant qu'on n'a pas dépassé le budget.
  if (Number(row.attempts) + 1 >= MAX_POLL_ATTEMPTS) {
    const err = new Error('Timeout download-url (status resté en attente)');
    err.status = 504;
    throw err;
  }
  await engineV2.bumpAttempts({ rollingId, delaySec: POLL_DELAY_SEC });
  return { terminal: false, nextDelaySec: POLL_DELAY_SEC };
}

// DOWNLOADING : streaming direct de l'URL Hik vers le fichier final GCS.
async function stepDownload(row) {
  const rollingId = row.rolling_id;
  const taskId = row.hik_task_id;
  const finalGcsPath = row.final_gcs_path || resolveFinalGcsPath(row);
  if (!finalGcsPath) {
    const err = new Error('Chemin GCS final introuvable');
    err.status = 500;
    throw err;
  }

  // Rafraîchit l'URL (les URLs Hik expirent) ; repli sur l'URL stockée.
  let url = null;
  try {
    const data = await getDownloadUrl({ taskId });
    const status = data?.data?.status;
    const urls = Array.isArray(data?.data?.urls) ? data.data.urls : [];
    if (status === 0 && urls.length > 0) url = urls[0];
    else if (status === 2) {
      const err = new Error('Hik-Connect a échoué la génération (status 2)');
      err.status = 502;
      throw err;
    }
  } catch (e) {
    if (e?.status === 502) throw e;
    // poll transitoire en échec : on retombe sur l'URL stockée si présente.
  }
  if (!url) url = row.download_url || null;
  if (!url) {
    // L'URL n'est pas (encore) prête : on repasse en attente.
    if (Number(row.attempts) + 1 >= MAX_DOWNLOAD_ATTEMPTS) {
      const err = new Error('URL de téléchargement indisponible');
      err.status = 504;
      throw err;
    }
    await engineV2.bumpAttempts({ rollingId, delaySec: POLL_DELAY_SEC });
    return { terminal: false, nextDelaySec: POLL_DELAY_SEC };
  }

  await logRecording('V2_DOWNLOAD_START', { rollingId, taskId, gcsPath: finalGcsPath }).catch(
    () => {}
  );

  try {
    const out = await streamUrlToGcs(url, finalGcsPath, {
      contentType: 'video/mp4',
      timeoutMs: 9 * 60 * 1000,
    });
    const publicUrl = publicUrlFor(finalGcsPath);
    const done = await engineV2.complete({
      rollingId,
      finalGcsPath,
      finalPublicUrl: publicUrl,
    });
    await logRecording('V2_COMPLETED', {
      rollingId,
      deviceId: row.device_id,
      cameraId: row.camera_id,
      gcsPath: finalGcsPath,
      sizeBytes: out?.size || null,
      durationSeconds: done?.duration_seconds ?? null,
    }).catch(() => {});

    fireThumbnail(rollingId, row);
    return { terminal: true, completed: true };
  } catch (e) {
    // Échec de stream : on retente quelques fois (URL fraîche au prochain step).
    if (Number(row.attempts) + 1 >= MAX_DOWNLOAD_ATTEMPTS) throw e;
    await engineV2.bumpAttempts({ rollingId, delaySec: 10 });
    await logRecording('V2_DOWNLOAD_RETRY', {
      rollingId,
      attempt: Number(row.attempts) + 1,
      message: e?.message,
    }).catch(() => {});
    return { terminal: false, nextDelaySec: 10 };
  }
}

module.exports = {
  runV2Step,
  resolveFinalGcsPath,
  MAX_DURATION_SEC,
};
