/**
 * Cloud Run Job — Worker de capture HLS Live.
 *
 * Reçoit ROLLING_ID (override d'exécution). Lit la session dans Cloud SQL,
 * capture le flux HLS avec FFmpeg et streame un MP4 fragmenté DIRECTEMENT vers
 * GCS (mémoire plate : aucun gros fichier local). Au STOP (flag Cloud SQL) ou
 * à 2 h, arrête FFmpeg proprement (SIGINT), copie temp -> final, COMPLET.
 *
 * Cloud SQL est la source de vérité. Aucune URL/token n'est journalisé.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');
const { Storage } = require('@google-cloud/storage');

const ROLLING_ID = process.env.ROLLING_ID || '';
const BUCKET = process.env.GCS_BUCKET || 'ia-sport.appspot.com';
const MAX_DURATION_SEC = Math.max(60, Number(process.env.RECORDING_MAX_DURATION_SEC || 7200));
const POLL_MS = Math.max(3000, Number(process.env.RECORDER_POLL_MS || 10000));
const FASTSTART_MAX_CAPTURE_MB = Math.max(
  100,
  Number(process.env.FASTSTART_MAX_CAPTURE_MB || 1500)
);
const FASTSTART_MIN_FREE_MB = Math.max(
  256,
  Number(process.env.FASTSTART_MIN_FREE_MB || 3072)
);

let currentExecutionName = process.env.EXECUTION_NAME || process.env.CLOUD_RUN_EXECUTION || '';
let stopSignalSeen = false;
let stopReceiptLogged = false;
let currentStage = 'BOOT';
// Vrai dès qu'un état terminal (COMPLETED/FAILED) a été écrit en base : empêche
// le handler de signal d'écraser une finalisation réussie.
let terminalWritten = false;
let shuttingDown = false;

const storage = new Storage();
const bucket = storage.bucket(BUCKET);

function enrichDetails(details = {}) {
  const enriched = details && typeof details === 'object' ? { ...details } : { value: details };
  enriched.rollingId = ROLLING_ID;
  if (currentExecutionName && !enriched.executionName) {
    enriched.executionName = currentExecutionName;
  }
  if (currentStage && !enriched.stage) {
    enriched.stage = currentStage;
  }
  return enriched;
}

function buildPoolConfig() {
  const host = process.env.DB_HOST;
  const isSocket = host && host.startsWith('/');
  return {
    host,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ...(isSocket ? {} : { port: Number(process.env.DB_PORT || 5432) }),
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: 'iasv-recorder',
  };
}
const pool = new Pool(buildPoolConfig());

function log(event, extra = {}) {
  // Logs structurés. JAMAIS d'URL/token (live_url, signed urls).
  const safe = enrichDetails(extra);
  delete safe.liveUrl;
  delete safe.url;
  console.log(JSON.stringify({ event, rollingId: ROLLING_ID, ...safe }));
}

// Masque toute URL absolue dans un texte (logs ffmpeg).
function redact(text) {
  return String(text || '').replace(/https?:\/\/[^\s"']+/gi, '[REDACTED_URL]');
}

async function q(text, params) {
  return pool.query(text, params);
}

async function getRow() {
  const { rows } = await q(
    `SELECT id, rolling_id, device_id, camera_id, state, status, stop_requested,
            execution_name,
            live_url, temp_gcs_path, final_gcs_path, date_debut
       FROM current_recording WHERE rolling_id = $1 LIMIT 1`,
    [ROLLING_ID]
  );
  return rows[0] || null;
}

async function heartbeat() {
  const { rows } = await q(
    `UPDATE current_recording SET heartbeat_at = NOW()
       WHERE rolling_id = $1
       RETURNING stop_requested, state, status, final_gcs_path`,
    [ROLLING_ID]
  );
  return rows[0] || null;
}

async function setState(state) {
  await q(`UPDATE current_recording SET state = $2 WHERE rolling_id = $1`, [ROLLING_ID, state]).catch(
    () => {}
  );
}

async function addLog(level, eventType, message, details) {
  await q(
    `INSERT INTO recording_log (recording_id, club_id, camera_id, level, event_type, message, details_json)
     SELECT id, club_id, camera_id, $2, $3, $4, $5 FROM current_recording WHERE rolling_id = $1`,
    [ROLLING_ID, level, eventType, message, details ? JSON.stringify(enrichDetails(details)) : null]
  ).catch(() => {});
}

async function record(level, eventType, message, details = {}) {
  const payload = enrichDetails(details);
  log(eventType, payload);
  await addLog(level, eventType, message, payload);
}

async function markComplete({ finalGcsPath, publicUrl, timeout }) {
  currentStage = 'MARK_COMPLETE';
  await record('INFO', 'MARK_COMPLETE_STARTED', 'Finalisation DB démarrée', {
    finalGcsPath,
    timeout,
  });
  // Convergence métier : un arrêt à 2 h se comporte EXACTEMENT comme un STOP
  // manuel -> status='COMPLET'. `timeout` n'est conservé que comme drapeau
  // d'audit (auto_timeout). Garde d'état : n'écrase jamais un état terminal
  // déjà écrit (idempotent, sûr face aux signaux/relances).
  const { rowCount } = await q(
    `UPDATE current_recording
        SET state = 'COMPLETED',
            status = 'COMPLET',
            auto_timeout = (auto_timeout OR $3),
            final_gcs_path = COALESCE($2, final_gcs_path),
            final_public_url = $4,
            date_fin = COALESCE(date_fin, NOW()),
            duration_seconds = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(date_fin, NOW()) - date_debut)))::int)
      WHERE rolling_id = $1 AND state NOT IN ('COMPLETED', 'FAILED')`,
    [ROLLING_ID, finalGcsPath, !!timeout, publicUrl]
  );
  terminalWritten = true;
  if (rowCount === 0) {
    await record('INFO', 'MARK_COMPLETE_NOOP', 'État déjà terminal (idempotent)', { finalGcsPath });
    return;
  }
  await record('INFO', 'VIDEO_FINALIZED', timeout ? 'Vidéo finale générée (limite 2 h)' : 'Vidéo finale générée', {
    finalGcsPath,
    timeout,
  });
}

async function markFailed(error) {
  await q(
    `UPDATE current_recording
        SET state = 'FAILED', status = 'INTERROMPU',
            error_message = COALESCE($2, error_message),
            date_fin = COALESCE(date_fin, NOW()),
            duration_seconds = COALESCE(duration_seconds, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(date_fin, NOW()) - date_debut)))::int))
      WHERE rolling_id = $1 AND state NOT IN ('COMPLETED', 'FAILED')`,
    [ROLLING_ID, String(error || '').slice(0, 2000)]
  ).catch(() => {});
  terminalWritten = true;
  await record('ERROR', 'ERROR', 'Capture HLS interrompue', { error: String(error || '').slice(0, 500) });
}

async function markFinalizationFailed(error, stage) {
  const message = String(error || '').slice(0, 2000);
  await q(
    `UPDATE current_recording
        SET state = 'FAILED', status = 'INTERROMPU',
            error_message = COALESCE($2, error_message),
            date_fin = COALESCE(date_fin, NOW()),
            duration_seconds = COALESCE(duration_seconds, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(date_fin, NOW()) - date_debut)))::int))
      WHERE rolling_id = $1 AND state NOT IN ('COMPLETED', 'FAILED')`,
    [ROLLING_ID, `FINALIZATION_FAILED${stage ? ` (${stage})` : ''}: ${message}`]
  ).catch(() => {});
  terminalWritten = true;
  await record('ERROR', 'FINALIZATION_FAILED', 'Finalisation HLS échouée', {
    error: message.slice(0, 500),
    stage: stage || currentStage,
  });
}

function publicUrlFor(gcsPath) {
  return `https://storage.googleapis.com/${BUCKET}/${encodeURI(gcsPath)}`;
}

function toMb(bytes) {
  return Math.max(0, Math.round(Number(bytes || 0) / (1024 * 1024)));
}

async function getTmpDiskStats() {
  try {
    const st = await fs.promises.statfs(os.tmpdir());
    const bsize = Number(st?.bsize || 0);
    const bavail = Number(st?.bavail || 0);
    const bfree = Number(st?.bfree || 0);
    const freeBytes = bsize > 0 ? Math.max(0, (bavail || bfree) * bsize) : 0;
    const totalBytes = bsize > 0 ? Math.max(0, Number(st?.blocks || 0) * bsize) : 0;
    return {
      ok: true,
      freeBytes,
      totalBytes,
      freeMb: toMb(freeBytes),
      totalMb: toMb(totalBytes),
    };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'statfs_unavailable',
      freeBytes: 0,
      totalBytes: 0,
      freeMb: 0,
      totalMb: 0,
    };
  }
}

function decideFaststartPlan({ captureBytes, diskStats }) {
  const reasons = [];
  const captureMb = toMb(captureBytes);

  // Faststart réécrit intégralement le MP4: il faut pouvoir supporter un
  // pic de stockage local important. Au-delà du seuil, on évite ce chemin
  // risqué et on upload directement la capture (fichier valide, sans faststart).
  if (captureMb >= FASTSTART_MAX_CAPTURE_MB) {
    reasons.push('capture_too_large');
  }

  if (!diskStats?.ok) {
    reasons.push('disk_stats_unavailable');
  } else {
    const requiredBytes = Math.round((captureBytes || 0) * 1.25);
    if ((diskStats.freeBytes || 0) < requiredBytes) {
      reasons.push('insufficient_free_space_for_faststart');
    }
    if ((diskStats.freeMb || 0) < FASTSTART_MIN_FREE_MB) {
      reasons.push('low_free_disk_headroom');
    }
  }

  return {
    useFaststart: reasons.length === 0,
    reasons,
    captureMb,
    freeMb: diskStats?.freeMb || 0,
    totalMb: diskStats?.totalMb || 0,
  };
}

// ---------------------------------------------------------------------------
// Capture FFmpeg -> fichier MP4 local. Renvoie { ok, bytes, code, signalledStop }.
// mode 'copy' (par défaut) ou 'reencode'.
// ---------------------------------------------------------------------------
function runCapture({ liveUrl, localCapturePath, mode, getStopState }) {
  return new Promise((resolve) => {
    const commonInput = [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-user_agent', 'Mozilla/5.0',
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-rw_timeout', '20000000',
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', liveUrl,
      '-t', String(MAX_DURATION_SEC),
    ];

    const codecArgs =
      mode === 'reencode'
        ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k']
        : ['-c', 'copy'];

    const args = [...commonInput, ...codecArgs, '-f', 'mp4', localCapturePath];

    currentStage = 'CAPTURE';
    log('FFMPEG_START', { mode, localCapturePath });
    void record('INFO', 'FFMPEG_START', 'Capture FFmpeg lancée', { mode, localCapturePath });

    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let bytes = 0;
    let signalledStop = false;
    let stderrTail = '';
    let settled = false;
    let childClosed = false;
    let childCode = null;
    let childSignal = null;

    const startedAt = Date.now();
    const poll = setInterval(async () => {
      try {
        const st = await getStopState();
        const elapsed = (Date.now() - startedAt) / 1000;
        if (st?.stop) {
          if (!stopReceiptLogged) {
            stopReceiptLogged = true;
            currentStage = 'STOP_REQUESTED';
            void record('INFO', 'STOP_RECEIVED', 'Arrêt reçu', { elapsedSec: Math.round(elapsed) });
          }
          sendStop('stop_requested');
        } else if (elapsed >= MAX_DURATION_SEC) {
          sendStop('max_duration');
        }
      } catch {
      }
    }, POLL_MS);

    const settle = () => {
      if (settled) return;
      if (!childClosed) return;
      settled = true;
      clearInterval(poll);
      try {
        const st = fs.statSync(localCapturePath);
        bytes = st.size || 0;
      } catch {
        bytes = 0;
      }
      const ok = bytes > 0 && (childCode === 0 || signalledStop);
      log('FFMPEG_DONE', { mode, code: childCode, signal: childSignal, bytes, signalledStop, stderrTail });
      void record('INFO', 'FFMPEG_DONE', 'Capture FFmpeg terminée', {
        mode,
        code: childCode,
        signal: childSignal,
        bytes,
        signalledStop,
      });
      resolve({ ok, bytes, code: childCode, signal: childSignal, signalledStop, mode });
    };

    function sendStop(reason) {
      if (signalledStop) return;
      signalledStop = true;
      stopSignalSeen = true;
      currentStage = 'FFMPEG_STOP_REQUESTED';
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      log('FFMPEG_STOP_REQUESTED', { reason, elapsedSec });
      void record('INFO', 'FFMPEG_STOP_REQUESTED', 'Arrêt FFmpeg demandé', { reason, elapsedSec });
      try { child.kill('SIGINT'); } catch {}
      setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 25000);
    }

    child.stderr.on('data', (d) => {
      stderrTail = (stderrTail + redact(d.toString())).slice(-2000);
    });

    child.on('error', (e) => {
      log('FFMPEG_SPAWN_ERR', { message: e?.message });
      void record('ERROR', 'FFMPEG_SPAWN_ERR', 'Spawn FFmpeg impossible', { message: e?.message });
      childClosed = true;
      childCode = -1;
      settle();
    });
    child.on('close', (code, signal) => {
      childClosed = true;
      childCode = code;
      childSignal = signal || null;
      settle();
    });
  });
}

function runFaststart({ inputPath, outputPath }) {
  return new Promise((resolve) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', inputPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-f', 'mp4',
      outputPath,
    ];

    log('FFMPEG_FASTSTART_START', { inputPath, outputPath });
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderrTail = '';

    child.stderr.on('data', (d) => {
      stderrTail = (stderrTail + redact(d.toString())).slice(-2000);
    });

    child.on('error', (e) => {
      resolve({ ok: false, code: -1, error: e?.message || 'spawn_error', stderrTail });
    });
    child.on('close', (code) => {
      let bytes = 0;
      try {
        bytes = fs.statSync(outputPath).size || 0;
      } catch {
        bytes = 0;
      }
      log('FFMPEG_FASTSTART_DONE', { code, bytes, stderrTail });
      resolve({ ok: code === 0 && bytes > 0, code, bytes, stderrTail });
    });
  });
}

async function main() {
  if (!ROLLING_ID) {
    console.error('ROLLING_ID manquant');
    process.exit(2);
  }

  const row = await getRow();
  if (!row) {
    log('ROW_NOT_FOUND');
    process.exit(0);
  }
  currentExecutionName = row.execution_name || currentExecutionName;
  if (row.state === 'COMPLETED' || row.state === 'FAILED') {
    log('ALREADY_TERMINAL', { state: row.state });
    process.exit(0);
  }
  if (!row.live_url) {
    await markFailed('live_url manquante');
    process.exit(0);
  }

  const tempGcsPath = row.temp_gcs_path || `tmp/hikconnect/hls/${ROLLING_ID}.mp4`;
  const liveUrl = row.live_url;
  const localCapturePath = path.join(os.tmpdir(), `capture-${ROLLING_ID}.mp4`);
  const localFaststartPath = path.join(os.tmpdir(), `final-${ROLLING_ID}.mp4`);

  await fs.promises.rm(localCapturePath, { force: true }).catch(() => {});
  await fs.promises.rm(localFaststartPath, { force: true }).catch(() => {});

  await q(`UPDATE current_recording SET capture_started_at = COALESCE(capture_started_at, NOW()), heartbeat_at = NOW() WHERE rolling_id = $1`, [ROLLING_ID]).catch(() => {});
  currentStage = 'CAPTURE_START';
  await record('INFO', 'HLS_CAPTURE_STARTED', 'Capture FFmpeg démarrée', {
    tempGcsPath,
    liveUrlPresent: true,
  });

  const getStopState = async () => {
    const hb = await heartbeat();
    if (!hb) return { stop: true };
    if (hb.stop_requested === true && !stopReceiptLogged) {
      stopReceiptLogged = true;
      currentStage = 'STOP_REQUESTED';
      await record('INFO', 'STOP_RECEIVED', 'Arrêt reçu', { source: 'db' });
    }
    return { stop: hb.stop_requested === true };
  };

  // 1) Tentative en stream-copy vers un MP4 local.
  let result = await runCapture({ liveUrl, localCapturePath, mode: 'copy', getStopState });

  // 2) Repli ré-encodage si la copie a échoué tôt sans qu'on ait demandé l'arrêt.
  if (!result.ok && !result.signalledStop && (result.bytes || 0) < 1_000_000) {
    currentStage = 'CAPTURE_FALLBACK_REENCODE';
    log('FFMPEG_FALLBACK_REENCODE', { firstCode: result.code, bytes: result.bytes });
    void record('WARNING', 'FFMPEG_FALLBACK_REENCODE', 'Repli ré-encodage FFmpeg', {
      firstCode: result.code,
      bytes: result.bytes,
    });
    await fs.promises.rm(localCapturePath, { force: true }).catch(() => {});
    result = await runCapture({ liveUrl, localCapturePath, mode: 'reencode', getStopState });
  }

  if (!result.ok || (result.bytes || 0) <= 0) {
    const afterStop = stopSignalSeen || (await isStopRequested());
    if (afterStop) {
      await markFinalizationFailed(`Capture vide ou échec ffmpeg (code=${result.code}, bytes=${result.bytes})`, 'capture');
    } else {
      await markFailed(`Capture vide ou échec ffmpeg (code=${result.code}, bytes=${result.bytes})`);
    }
    await fs.promises.rm(localCapturePath, { force: true }).catch(() => {});
    await fs.promises.rm(localFaststartPath, { force: true }).catch(() => {});
    process.exit(1);
  }

  const diskStats = await getTmpDiskStats();
  const faststartPlan = decideFaststartPlan({
    captureBytes: result.bytes || 0,
    diskStats,
  });
  await record('INFO', 'FINALIZATION_PLAN', 'Plan de finalisation calculé', {
    useFaststart: faststartPlan.useFaststart,
    reasons: faststartPlan.reasons,
    captureMb: faststartPlan.captureMb,
    freeMb: faststartPlan.freeMb,
    totalMb: faststartPlan.totalMb,
    faststartMaxCaptureMb: FASTSTART_MAX_CAPTURE_MB,
    faststartMinFreeMb: FASTSTART_MIN_FREE_MB,
  });

  // Heartbeat pendant la finalisation (faststart + upload GCS) : garde
  // heartbeat_at frais (supervision) et distingue "vivant mais en finalisation"
  // de "process mort". unref() => n'empêche jamais la sortie du process.
  const finalizationHeartbeat = setInterval(() => {
    q(`UPDATE current_recording SET heartbeat_at = NOW() WHERE rolling_id = $1`, [ROLLING_ID]).catch(
      () => {}
    );
  }, POLL_MS);
  if (typeof finalizationHeartbeat.unref === 'function') finalizationHeartbeat.unref();

  // 3) Finalisation locale MP4 : faststart quand les conditions locales sont
  // favorables; sinon upload direct de la capture (fichier valide).
  let uploadSourcePath = localCapturePath;
  let faststartApplied = false;
  if (faststartPlan.useFaststart) {
    currentStage = 'FASTSTART';
    await record('INFO', 'FASTSTART_STARTED', 'Faststart démarré', { inputPath: localCapturePath });
    const faststart = await runFaststart({ inputPath: localCapturePath, outputPath: localFaststartPath });
    if (!faststart.ok) {
      await markFinalizationFailed(`Faststart échoué (code=${faststart.code})`, 'faststart');
      await fs.promises.rm(localCapturePath, { force: true }).catch(() => {});
      await fs.promises.rm(localFaststartPath, { force: true }).catch(() => {});
      process.exit(1);
    }
    await record('INFO', 'FASTSTART_DONE', 'Faststart terminé', {
      code: faststart.code,
      bytes: faststart.bytes,
    });
    uploadSourcePath = localFaststartPath;
    faststartApplied = true;
  } else {
    await record('WARNING', 'FASTSTART_SKIPPED', 'Faststart ignoré (politique de sécurité)', {
      reasons: faststartPlan.reasons,
      captureMb: faststartPlan.captureMb,
      freeMb: faststartPlan.freeMb,
      totalMb: faststartPlan.totalMb,
    });
  }

  // 4) Finalisation : upload GCS du MP4 final, suppression des temporaires.
  await setState('FINALIZING');
  currentStage = 'FINALIZING';
  const after = await getRow();
  const finalGcsPath =
    after?.final_gcs_path || row.final_gcs_path || `recordings/${ROLLING_ID}.mp4`;
  // Si l'arrêt n'a PAS été demandé, la capture s'est arrêtée sur la limite 2 h.
  const timeoutReached = !(await isStopRequested());

  try {
    await record('INFO', 'GCS_UPLOAD_STARTED', 'Upload GCS démarré', { finalGcsPath });
    await bucket.upload(uploadSourcePath, {
      destination: finalGcsPath,
      metadata: {
        contentType: 'video/mp4',
        cacheControl: 'public, max-age=3600',
      },
    });
    await record('INFO', 'GCS_UPLOAD_DONE', 'Upload GCS terminé', { finalGcsPath });
    await bucket.file(finalGcsPath).setMetadata({ contentType: 'video/mp4', cacheControl: 'public, max-age=3600' }).catch(() => {});
    await bucket.file(tempGcsPath).delete({ ignoreNotFound: true }).catch(() => {});
    await fs.promises.rm(localCapturePath, { force: true }).catch(() => {});
    await fs.promises.rm(localFaststartPath, { force: true }).catch(() => {});
  } catch (e) {
    await markFinalizationFailed(`Copie GCS finale échouée: ${e?.message}`, 'upload_gcs');
    await fs.promises.rm(localCapturePath, { force: true }).catch(() => {});
    await fs.promises.rm(localFaststartPath, { force: true }).catch(() => {});
    process.exit(1);
  }

  try {
    await markComplete({
      finalGcsPath,
      publicUrl: publicUrlFor(finalGcsPath),
      timeout: timeoutReached,
    });
  } catch (e) {
    clearInterval(finalizationHeartbeat);
    await markFinalizationFailed(`markComplete échoué: ${e?.message}`, 'mark_complete');
    process.exit(1);
  }
  clearInterval(finalizationHeartbeat);
  log('COMPLETED', {
    finalGcsPath,
    bytes: result.bytes,
    mode: result.mode,
    faststartApplied,
  });
  process.exit(0);
}

async function isStopRequested() {
  try {
    const { rows } = await q(`SELECT stop_requested FROM current_recording WHERE rolling_id = $1`, [
      ROLLING_ID,
    ]);
    return rows[0]?.stop_requested === true;
  } catch {
    return true;
  }
}

main().catch(async (e) => {
  currentStage = 'FATAL';
  log('WORKER_FATAL', { message: e?.message });
  await markFinalizationFailed(`Worker fatal: ${e?.message}`, 'worker_fatal').catch(() => {});
  // Laisser le temps aux logs de partir.
  setTimeout(() => process.exit(1), 500);
});

process.on('exit', (code) => {
  console.log(JSON.stringify(enrichDetails({ event: 'PROCESS_EXIT', exitCode: code }))); 
});

// Cloud Run envoie SIGTERM (~10 s de grâce) avant SIGKILL lors d'un arrêt
// d'infrastructure ou d'un dépassement de task-timeout. Sans handler, le process
// mourait sans écrire d'état terminal -> session orpheline EN_COURS (puis
// "supersedée" en INTERROMPU par l'enregistrement suivant). Ce filet de sécurité
// garantit un état terminal déterministe. Les gardes SQL (WHERE state NOT IN
// terminal) le rendent idempotent : il n'écrase jamais une finalisation réussie.
async function handleTermination(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('SIGNAL_RECEIVED', { signal, stage: currentStage, terminalWritten });
  try {
    if (!terminalWritten) {
      await markFinalizationFailed(
        `Conteneur arrêté par l'infrastructure (${signal}) en phase ${currentStage}`,
        currentStage
      );
    }
  } catch (e) {
    log('SIGNAL_HANDLER_ERR', { signal, message: e?.message });
  } finally {
    // Laisse le temps aux logs / à la base de partir avant la sortie.
    setTimeout(() => process.exit(143), 1500);
  }
}

process.on('SIGTERM', () => {
  void handleTermination('SIGTERM');
});
