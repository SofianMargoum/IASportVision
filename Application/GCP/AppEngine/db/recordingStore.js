/**
 * Repository pour les enregistrements vidéo (current_recording,
 * recording_segments, recording_log) — source de vérité Cloud SQL.
 *
 * Ce module encadre le moteur de rolling GCS existant SANS le remplacer :
 * l'API écrit en base en "dual-write" best-effort. Pour cette raison, le
 * point d'entrée recommandé est l'objet `mirror`, dont TOUTES les méthodes
 * avalent les erreurs (jamais de throw) et renvoient null en cas d'échec.
 * Ainsi une base indisponible ne casse jamais le rolling.
 *
 * Toutes les requêtes utilisent des paramètres positionnels ($1, $2, …) pour
 * éviter toute injection SQL.
 */

const { query } = require('./pool');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Interrupteur global : permet de couper le dual-write instantanément via
// l'environnement (app.yaml) sans redéployer de logique.
function isMirrorEnabled() {
  const v = String(process.env.RECORDING_DB_MIRROR_ENABLED ?? '1').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampText(value, max = 1000) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

// "0 - 1 Draguignan" => "Draguignan" (best-effort, sinon null).
function parseOpponentFromCombined(combinedFilename) {
  const s = clampText(combinedFilename, 255);
  if (!s) return null;
  const m = s.match(/^\s*\d+\s*-\s*\d+\s+(.+?)\s*$/);
  return m ? clampText(m[1], 255) : null;
}

// Calcule begin/end d'un segment à partir de la meta rolling.
function segmentWindow(meta, index) {
  const beginMs = Number(meta?.beginMs);
  const chunkMs = Number(meta?.chunkSec || 60) * 1000;
  if (!Number.isFinite(beginMs) || beginMs <= 0 || !Number.isFinite(chunkMs) || chunkMs <= 0) {
    return { dateDebut: null, dateFin: null };
  }
  const idx = Number(index);
  return {
    dateDebut: new Date(beginMs + idx * chunkMs),
    dateFin: new Date(beginMs + (idx + 1) * chunkMs),
  };
}

// ---------------------------------------------------------------------------
// Résolution club_id depuis la table devices (caméra HikConnect -> club)
// ---------------------------------------------------------------------------

async function resolveClubIdByCamera({ deviceId, cameraId }) {
  const cam = clampText(cameraId, 255);
  const dev = clampText(deviceId, 255);
  if (!cam && !dev) return null;

  const { rows } = await query(
    `SELECT club_id
       FROM devices
      WHERE camera_id = $1 OR device_id = $1 OR hik_device_id = $1
         OR camera_id = $2 OR device_id = $2 OR hik_device_id = $2
      LIMIT 1`,
    [cam, dev]
  );
  return rows[0]?.club_id || null;
}

// ---------------------------------------------------------------------------
// current_recording
// ---------------------------------------------------------------------------

async function findByRollingId(rollingId) {
  const rid = clampText(rollingId, 128);
  if (!rid) return null;
  const { rows } = await query(
    `SELECT id, club_id, camera_id, device_id, status, date_debut
       FROM current_recording
      WHERE rolling_id = $1
      LIMIT 1`,
    [rid]
  );
  return rows[0] || null;
}

/**
 * Crée (ou retrouve) la ligne current_recording d'une session rolling.
 * Idempotent sur rolling_id. Renvoie { id, club_id, camera_id } ou null si la
 * caméra a déjà un enregistrement EN_COURS (contrainte métier) — dans ce cas
 * un WARNING est journalisé et la création est simplement repoussée.
 */
async function ensureRecording({
  rollingId,
  deviceId,
  cameraId,
  directory,
  combinedFilename,
  nomVideo,
  beginMs,
  dateDebut,
}) {
  const rid = clampText(rollingId, 128);
  if (!rid) return null;

  const existing = await findByRollingId(rid);
  if (existing) return existing;

  const clubId = await resolveClubIdByCamera({ deviceId, cameraId });
  const clubDomicile = clampText(directory, 255);
  const clubAdverse = parseOpponentFromCombined(combinedFilename);
  const nom = clampText(nomVideo, 255) || clampText(combinedFilename, 255);
  const start = toDate(dateDebut) || toDate(beginMs);

  try {
    const { rows } = await query(
      `INSERT INTO current_recording
         (rolling_id, club_id, device_id, camera_id, club_domicile, club_adverse,
          nom_video, date_debut, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'EN_COURS')
       ON CONFLICT (rolling_id) DO NOTHING
       RETURNING id, club_id, camera_id`,
      [
        rid,
        clubId,
        clampText(deviceId, 255),
        clampText(cameraId, 255),
        clubDomicile,
        clubAdverse,
        nom,
        start,
      ]
    );

    if (rows[0]) return rows[0];

    // ON CONFLICT (rolling_id) => la ligne existe déjà (course). On la relit.
    return await findByRollingId(rid);
  } catch (e) {
    // Violation de l'index partiel "un seul EN_COURS par caméra".
    if (e?.code === '23505') {
      await rawAddLog({
        rollingId: rid,
        clubId,
        cameraId,
        level: 'WARNING',
        eventType: 'CAMERA_BUSY_SKIP_DB',
        message:
          "Caméra déjà EN_COURS : enregistrement non créé en base pour le moment (sera créé plus tard).",
        detailsJson: { rollingId: rid, cameraId: clampText(cameraId, 255) || null },
      }).catch(() => {});
      return null;
    }
    throw e;
  }
}

async function startRecording(params) {
  const rec = await ensureRecording(params);
  if (rec) {
    await rawAddLog({
      recordingId: rec.id,
      clubId: rec.club_id,
      cameraId: params.cameraId,
      level: 'INFO',
      eventType: 'RECORDING_STARTED',
      message: 'Enregistrement démarré',
      detailsJson: {
        rollingId: clampText(params.rollingId, 128),
        deviceId: clampText(params.deviceId, 255),
        clubDomicile: clampText(params.directory, 255),
      },
    });
    if (!rec.club_id) {
      await rawAddLog({
        recordingId: rec.id,
        clubId: null,
        cameraId: params.cameraId,
        level: 'WARNING',
        eventType: 'CLUB_UNRESOLVED',
        message: "Caméra non rattachée à un club (devices) : club_id NULL.",
        detailsJson: {
          deviceId: clampText(params.deviceId, 255),
          cameraId: clampText(params.cameraId, 255),
        },
      });
    }
  }
  return rec;
}

/**
 * Met à jour le statut/fin d'un enregistrement. duration_seconds est calculé en
 * base depuis date_debut/date_fin (robuste). N'écrit que des colonnes non nulles.
 */
async function finishRecording({
  rollingId,
  status,
  dateFin,
  finalGcsPath,
  finalPublicUrl,
  nomVideo,
  errorMessage,
}) {
  const rid = clampText(rollingId, 128);
  if (!rid) return null;
  const st = clampText(status, 32);
  const end = toDate(dateFin) || new Date();

  const { rows } = await query(
    `UPDATE current_recording
        SET status           = COALESCE($2, status),
            date_fin         = COALESCE(date_fin, $3),
            duration_seconds = GREATEST(0,
              FLOOR(EXTRACT(EPOCH FROM (COALESCE(date_fin, $3) - date_debut)))::int),
            final_gcs_path   = COALESCE($4, final_gcs_path),
            final_public_url = COALESCE($5, final_public_url),
            nom_video        = COALESCE($6, nom_video),
            error_message    = COALESCE($7, error_message)
      WHERE rolling_id = $1
      RETURNING id, club_id, camera_id, status, duration_seconds`,
    [
      rid,
      st,
      end,
      clampText(finalGcsPath, 1024),
      clampText(finalPublicUrl, 2048),
      clampText(nomVideo, 255),
      clampText(errorMessage, 2000),
    ]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// recording_segments
// ---------------------------------------------------------------------------

async function addSegment({
  rollingId,
  meta,
  index,
  fileName,
  fileSize,
  dateDebut,
  dateFin,
  status = 'OK',
  deviceId,
  cameraId,
  emitLog = true,
}) {
  const rid = clampText(rollingId, 128);
  if (!rid) return null;

  const rec = await ensureRecording({
    rollingId: rid,
    deviceId: deviceId ?? meta?.deviceId,
    cameraId: cameraId ?? meta?.cameraId,
    directory: meta?.thumbMeta?.directory,
    combinedFilename: meta?.thumbMeta?.combinedFilename,
    beginMs: meta?.beginMs,
  });
  if (!rec) return null;

  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0) return null;

  const win = segmentWindow(meta, idx);
  const begin = toDate(dateDebut) || win.dateDebut;
  const end = toDate(dateFin) || win.dateFin;
  const name = clampText(fileName, 255) || `chunk_${String(idx).padStart(6, '0')}.mp4`;
  const size =
    fileSize === null || fileSize === undefined || !Number.isFinite(Number(fileSize))
      ? null
      : Math.max(0, Math.floor(Number(fileSize)));

  const { rows } = await query(
    `INSERT INTO recording_segments
       (recording_id, club_id, camera_id, segment_index, file_name, file_size,
        date_debut, date_fin, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (recording_id, segment_index) DO UPDATE
       SET file_name  = COALESCE(EXCLUDED.file_name, recording_segments.file_name),
           file_size  = COALESCE(EXCLUDED.file_size, recording_segments.file_size),
           date_debut = COALESCE(EXCLUDED.date_debut, recording_segments.date_debut),
           date_fin   = COALESCE(EXCLUDED.date_fin, recording_segments.date_fin),
           status     = EXCLUDED.status
     RETURNING (xmax = 0) AS inserted`,
    [
      rec.id,
      rec.club_id,
      clampText(cameraId ?? meta?.cameraId, 255),
      idx,
      name,
      size,
      begin,
      end,
      status === 'ERREUR' ? 'ERREUR' : 'OK',
    ]
  );

  const inserted = rows[0]?.inserted === true;

  // Tient à jour les compteurs de l'enregistrement.
  await query(
    `UPDATE current_recording
        SET last_rolling_at    = NOW(),
            last_file_found_at = NOW(),
            last_file_name     = $2
      WHERE id = $1`,
    [rec.id, name]
  ).catch(() => {});

  if (inserted && emitLog) {
    await rawAddLog({
      recordingId: rec.id,
      clubId: rec.club_id,
      cameraId: cameraId ?? meta?.cameraId,
      level: 'INFO',
      eventType: 'SEGMENT_CREATED',
      message: `Segment ${idx + 1} créé`,
      detailsJson: { index: idx, fileName: name },
    }).catch(() => {});
  }

  return { recordingId: rec.id, inserted };
}

/**
 * Enregistre en base tous les segments d'un intervalle [fromIndex, toIndex]
 * qui viennent d'être fusionnés. Idempotent (upsert). Borné par sécurité.
 */
async function recordSegmentsMerged({ rollingId, meta, fromIndex, toIndex, deviceId, cameraId }) {
  const from = Math.max(0, Number(fromIndex));
  const to = Number(toIndex);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  // Garde-fou : ne jamais boucler de façon non bornée.
  const MAX = 5000;
  let count = 0;
  for (let i = from; i <= to && count < MAX; i++) {
    // eslint-disable-next-line no-await-in-loop
    await addSegment({ rollingId, meta, index: i, deviceId, cameraId });
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// recording_log
// ---------------------------------------------------------------------------

async function rawAddLog({
  rollingId,
  recordingId,
  clubId,
  cameraId,
  level,
  eventType,
  message,
  detailsJson,
}) {
  const evt = clampText(eventType, 64);
  if (!evt) return null;

  let recId = UUID_RE.test(String(recordingId || '')) ? recordingId : null;
  let club = UUID_RE.test(String(clubId || '')) ? clubId : null;
  let cam = clampText(cameraId, 255);

  // Si on n'a pas de recordingId mais un rollingId, on tente de résoudre.
  if (!recId && rollingId) {
    const rec = await findByRollingId(rollingId).catch(() => null);
    if (rec) {
      recId = rec.id;
      if (!club) club = rec.club_id || null;
      if (!cam) cam = rec.camera_id || null;
    }
  }

  const lvl = ['INFO', 'WARNING', 'ERROR'].includes(String(level)) ? level : 'INFO';

  const { rows } = await query(
    `INSERT INTO recording_log
       (recording_id, club_id, camera_id, level, event_type, message, details_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [recId, club, cam, lvl, evt, clampText(message, 2000), detailsJson ? JSON.stringify(detailsJson) : null]
  );
  return rows[0]?.id || null;
}

// ===========================================================================
// Moteur V2 (machine d'état, Cloud SQL = source de vérité).
//
// FSM : RECORDING -> EXPORTING -> WAITING_DOWNLOAD_URL -> DOWNLOADING -> COMPLETED
//                                                                  \-> FAILED
// Un seul export Hik-Connect par enregistrement (au STOP), pas de chunks,
// pas de merge ffmpeg. Ces fonctions PEUVENT throw : le moteur appelant gère
// les erreurs et persiste l'état d'échec.
// ===========================================================================

const V2_TERMINAL = ['COMPLETED', 'FAILED'];

const V2_COLS = `
  id, rolling_id, club_id, device_id, camera_id,
  club_domicile, club_adverse, nom_video,
  date_debut, date_fin, duration_seconds,
  status, engine, state, hik_task_id,
  export_begin_iso, export_end_iso, cam_offset, voice_switch,
  attempts, next_action_at, dismissed_at, auto_timeout,
  final_gcs_path, final_public_url, thumbnail_generated, thumb_json, download_url,
  device_serial, live_url, stop_requested, execution_name,
  capture_started_at, heartbeat_at, temp_gcs_path,
  error_message, created_at, updated_at
`;

function statusForState(state) {
  switch (state) {
    case 'COMPLETED':
      return 'COMPLET';
    case 'FAILED':
      return 'ERREUR';
    default:
      return 'EN_COURS';
  }
}

/**
 * Crée (ou retrouve) la ligne V2 d'une session. Idempotent sur rolling_id.
 * Avant insertion, "supersede" tout enregistrement EN_COURS résiduel de la
 * même caméra (on ne peut pas filmer deux matchs à la fois sur une caméra) :
 * cela garantit l'invariant "un seul EN_COURS par caméra" et évite les blocages.
 */
async function startV2Recording({
  rollingId,
  deviceId,
  cameraId,
  directory,
  combinedFilename,
  beginTimeIso,
  offset,
  voiceSwitch,
  thumb,
}) {
  const rid = clampText(rollingId, 128);
  if (!rid) throw new Error('startV2Recording: rollingId requis');

  const existing = await getV2ByRollingId(rid).catch(() => null);
  if (existing) return existing;

  const cam = clampText(cameraId, 255);

  // Supersede les sessions EN_COURS résiduelles de la même caméra.
  if (cam) {
    const sup = await query(
      `UPDATE current_recording
          SET status = 'ERREUR',
              state = CASE WHEN engine = 'v2' THEN 'FAILED' ELSE state END,
              error_message = COALESCE(error_message, 'Remplacé par un nouvel enregistrement'),
              date_fin = COALESCE(date_fin, NOW())
        WHERE camera_id = $1 AND status = 'EN_COURS' AND rolling_id <> $2
        RETURNING rolling_id`,
      [cam, rid]
    );
    for (const r of sup.rows) {
      await rawAddLog({
        rollingId: r.rolling_id,
        cameraId: cam,
        level: 'WARNING',
        eventType: 'RECORDING_SUPERSEDED',
        message: 'Enregistrement clôturé : une nouvelle session a démarré sur la caméra',
        detailsJson: { supersededBy: rid },
      }).catch(() => {});
    }
  }

  const clubId = await resolveClubIdByCamera({ deviceId, cameraId }).catch(() => null);
  const start = toDate(beginTimeIso);
  const th = thumb && typeof thumb === 'object' ? thumb : null;

  const { rows } = await query(
    `INSERT INTO current_recording
       (rolling_id, club_id, device_id, camera_id, club_domicile, club_adverse,
        nom_video, date_debut, status, engine, state, cam_offset, voice_switch,
        export_begin_iso, thumb_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'EN_COURS','v2','RECORDING',$9,$10,$11,$12)
     ON CONFLICT (rolling_id) DO NOTHING
     RETURNING ${V2_COLS}`,
    [
      rid,
      clubId,
      clampText(deviceId, 255),
      cam,
      clampText(directory, 255),
      parseOpponentFromCombined(combinedFilename),
      clampText(combinedFilename, 255),
      start,
      clampText(offset, 16),
      voiceSwitch === null || voiceSwitch === undefined ? null : Number(voiceSwitch),
      clampText(beginTimeIso, 64),
      th ? JSON.stringify(th) : null,
    ]
  );

  const row = rows[0] || (await getV2ByRollingId(rid));
  if (row) {
    await rawAddLog({
      recordingId: row.id,
      clubId: row.club_id,
      cameraId: cam,
      level: 'INFO',
      eventType: 'RECORDING_STARTED',
      message: 'Enregistrement démarré',
      detailsJson: { rollingId: rid, engine: 'v2', deviceId: clampText(deviceId, 255) },
    }).catch(() => {});
    if (!row.club_id) {
      await rawAddLog({
        recordingId: row.id,
        cameraId: cam,
        level: 'WARNING',
        eventType: 'CLUB_UNRESOLVED',
        message: 'Caméra non rattachée à un club (devices) : club_id NULL.',
        detailsJson: { deviceId: clampText(deviceId, 255), cameraId: cam },
      }).catch(() => {});
    }
  }
  return row;
}

async function getV2ByRollingId(rollingId) {
  const rid = clampText(rollingId, 128);
  if (!rid) return null;
  const { rows } = await query(
    `SELECT ${V2_COLS} FROM current_recording WHERE rolling_id = $1 LIMIT 1`,
    [rid]
  );
  return rows[0] || null;
}

/**
 * Démarre la phase d'export (au STOP ou à la limite de durée).
 * Définit la fenêtre [export_begin_iso, export_end_iso], la cible finale et
 * passe l'état à EXPORTING. Idempotent : ne ré-arme pas une session terminée.
 */
async function beginExportV2({
  rollingId,
  exportBeginIso,
  exportEndIso,
  dateFin,
  finalGcsPath,
  thumb,
  reason,
  timeout = false,
}) {
  const rid = clampText(rollingId, 128);
  if (!rid) throw new Error('beginExportV2: rollingId requis');

  const row = await getV2ByRollingId(rid);
  if (!row) throw new Error('beginExportV2: session V2 introuvable');
  if (V2_TERMINAL.includes(row.state)) return row; // déjà fini
  if (row.state && row.state !== 'RECORDING') return row; // export déjà lancé

  const th = thumb && typeof thumb === 'object' ? thumb : null;
  const { rows } = await query(
    `UPDATE current_recording
        SET state = 'EXPORTING',
            export_begin_iso = COALESCE($2, export_begin_iso),
            export_end_iso = $3,
            date_fin = COALESCE($4, date_fin),
            final_gcs_path = COALESCE($5, final_gcs_path),
            nom_video = COALESCE($6, nom_video),
            thumb_json = COALESCE($7, thumb_json),
            auto_timeout = $8,
            attempts = 0,
            next_action_at = NOW()
      WHERE rolling_id = $1
      RETURNING ${V2_COLS}`,
    [
      rid,
      clampText(exportBeginIso, 64) || row.export_begin_iso,
      clampText(exportEndIso, 64),
      toDate(dateFin),
      clampText(finalGcsPath, 1024),
      finalGcsPath ? clampText(finalGcsPath.split('/').pop(), 255) : null,
      th ? JSON.stringify(th) : null,
      timeout === true,
    ]
  );
  await rawAddLog({
    recordingId: row.id,
    clubId: row.club_id,
    cameraId: row.camera_id,
    level: 'INFO',
    eventType: 'RECORDING_STOPPED',
    message: 'Enregistrement arrêté, export demandé',
    detailsJson: { reason: reason || 'stop', exportEndIso: clampText(exportEndIso, 64) },
  }).catch(() => {});
  return rows[0] || null;
}

/** EXPORTING -> WAITING_DOWNLOAD_URL : mémorise la taskId Hik-Connect. */
async function setExportTaskV2({ rollingId, taskId }) {
  const rid = clampText(rollingId, 128);
  const { rows } = await query(
    `UPDATE current_recording
        SET state = 'WAITING_DOWNLOAD_URL', hik_task_id = $2, attempts = 0, next_action_at = NOW()
      WHERE rolling_id = $1 RETURNING ${V2_COLS}`,
    [rid, clampText(taskId, 256)]
  );
  return rows[0] || null;
}

/** WAITING_DOWNLOAD_URL -> DOWNLOADING : l'URL est prête (status 0). */
async function setDownloadingV2({ rollingId, url }) {
  const rid = clampText(rollingId, 128);
  const { rows } = await query(
    `UPDATE current_recording
        SET state = 'DOWNLOADING', download_url = $2, attempts = 0, next_action_at = NOW()
      WHERE rolling_id = $1 RETURNING ${V2_COLS}`,
    [rid, clampText(url, 4096)]
  );
  return rows[0] || null;
}

/** Incrémente le compteur de tentatives et planifie la prochaine action. */
async function bumpAttemptsV2({ rollingId, delaySec = 30 }) {
  const rid = clampText(rollingId, 128);
  const { rows } = await query(
    `UPDATE current_recording
        SET attempts = attempts + 1,
            next_action_at = NOW() + ($2 || ' seconds')::interval
      WHERE rolling_id = $1 RETURNING attempts`,
    [rid, String(Math.max(0, Number(delaySec) || 0))]
  );
  return rows[0]?.attempts ?? null;
}

/** DOWNLOADING -> COMPLETED : vidéo finale écrite dans GCS. */
async function completeV2({ rollingId, finalGcsPath, finalPublicUrl }) {
  const rid = clampText(rollingId, 128);
  const row = await getV2ByRollingId(rid);
  const { rows } = await query(
    `UPDATE current_recording
        SET state = 'COMPLETED',
            status = CASE WHEN auto_timeout THEN 'TIMEOUT' ELSE 'COMPLET' END,
            final_gcs_path = COALESCE($2, final_gcs_path),
            final_public_url = COALESCE($3, final_public_url),
            date_fin = COALESCE(date_fin, NOW()),
            duration_seconds = GREATEST(0,
              FLOOR(EXTRACT(EPOCH FROM (COALESCE(date_fin, NOW()) - date_debut)))::int),
            next_action_at = NULL
      WHERE rolling_id = $1
      RETURNING ${V2_COLS}`,
    [rid, clampText(finalGcsPath, 1024), clampText(finalPublicUrl, 2048)]
  );
  await rawAddLog({
    recordingId: row?.id,
    clubId: row?.club_id,
    cameraId: row?.camera_id,
    level: 'INFO',
    eventType: 'VIDEO_FINALIZED',
    message: 'Vidéo finale générée',
    detailsJson: { finalGcsPath: clampText(finalGcsPath, 1024) },
  }).catch(() => {});
  return rows[0] || null;
}

/** Transition d'échec. `timeout` => statut métier TIMEOUT au lieu de ERREUR. */
async function failV2({ rollingId, error, timeout = false }) {
  const rid = clampText(rollingId, 128);
  const row = await getV2ByRollingId(rid);
  const businessStatus = timeout ? 'TIMEOUT' : 'ERREUR';
  const { rows } = await query(
    `UPDATE current_recording
        SET state = 'FAILED',
            status = $2,
            error_message = COALESCE($3, error_message),
            date_fin = COALESCE(date_fin, NOW()),
            duration_seconds = COALESCE(duration_seconds, GREATEST(0,
              FLOOR(EXTRACT(EPOCH FROM (COALESCE(date_fin, NOW()) - date_debut)))::int)),
            next_action_at = NULL
      WHERE rolling_id = $1
      RETURNING ${V2_COLS}`,
    [rid, businessStatus, clampText(error, 2000)]
  );
  await rawAddLog({
    recordingId: row?.id,
    clubId: row?.club_id,
    cameraId: row?.camera_id,
    level: timeout ? 'WARNING' : 'ERROR',
    eventType: timeout ? 'RECORDING_TIMEOUT' : 'ERROR',
    message: timeout
      ? 'Enregistrement arrêté automatiquement (durée maximale atteinte)'
      : 'Échec de la génération vidéo',
    detailsJson: { error: clampText(error, 500) },
  }).catch(() => {});
  return rows[0] || null;
}

async function markThumbnailV2(rollingId) {
  const rid = clampText(rollingId, 128);
  await query(
    `UPDATE current_recording SET thumbnail_generated = TRUE WHERE rolling_id = $1`,
    [rid]
  ).catch(() => {});
}

/** Liste les enregistrements (récents, non rejetés) d'une caméra pour l'UI. */
async function listForCameraV2({ cameraId, sinceHours = 48 }) {
  const cam = clampText(cameraId, 255);
  if (!cam) return [];
  const { rows } = await query(
    `SELECT ${V2_COLS} FROM current_recording
      WHERE camera_id = $1
        AND engine IN ('v2', 'hls')
        AND dismissed_at IS NULL
        AND created_at > NOW() - ($2 || ' hours')::interval
      ORDER BY created_at ASC`,
    [cam, String(Math.max(1, Number(sinceHours) || 48))]
  );
  return rows;
}

async function dismissV2({ rollingId }) {
  const rid = clampText(rollingId, 128);
  const { rowCount } = await query(
    `UPDATE current_recording SET dismissed_at = NOW()
      WHERE rolling_id = $1 AND dismissed_at IS NULL`,
    [rid]
  );
  return rowCount > 0;
}

const engineV2 = {
  start: startV2Recording,
  get: getV2ByRollingId,
  beginExport: beginExportV2,
  setTask: setExportTaskV2,
  setDownloading: setDownloadingV2,
  bumpAttempts: bumpAttemptsV2,
  complete: completeV2,
  fail: failV2,
  markThumbnail: markThumbnailV2,
  listForCamera: listForCameraV2,
  dismiss: dismissV2,
  addLog: rawAddLog,
  statusForState,
};

// ===========================================================================
// Moteur HLS Live (capture FFmpeg directe dans un Cloud Run Job).
//
// FSM (col state) : RECORDING --(stop|2h)--> FINALIZING --> COMPLETED | FAILED
// status métier   : EN_COURS --> COMPLET | TIMEOUT | INTERROMPU
//
// App Engine crée la session (RECORDING) et déclenche le worker ; le worker
// Cloud Run capture le flux, met à jour heartbeat_at et, au STOP, finalise.
// Ces fonctions PEUVENT throw : l'appelant gère et persiste l'état d'échec.
// ===========================================================================

/**
 * Crée la session HLS. Idempotent sur rolling_id. Supersede toute session
 * EN_COURS résiduelle de la même caméra (un seul enregistrement actif/caméra)
 * en lui demandant aussi l'arrêt (stop_requested) pour que son worker sorte.
 */
async function startHlsRecording({
  rollingId,
  deviceId,
  cameraId,
  deviceSerial,
  liveUrl,
  directory,
  combinedFilename,
  beginTimeIso,
  offset,
  finalGcsPath,
  tempGcsPath,
  thumb,
}) {
  const rid = clampText(rollingId, 128);
  if (!rid) throw new Error('startHlsRecording: rollingId requis');

  const existing = await getV2ByRollingId(rid).catch(() => null);
  if (existing) return existing;

  const cam = clampText(cameraId, 255);

  if (cam) {
    const sup = await query(
      `UPDATE current_recording
          SET status = 'INTERROMPU',
              state = CASE WHEN engine IN ('v2','hls') THEN 'FAILED' ELSE state END,
              stop_requested = TRUE,
              error_message = COALESCE(error_message, 'Remplacé par un nouvel enregistrement'),
              date_fin = COALESCE(date_fin, NOW())
        WHERE camera_id = $1 AND status = 'EN_COURS' AND rolling_id <> $2
        RETURNING rolling_id`,
      [cam, rid]
    );
    for (const r of sup.rows) {
      await rawAddLog({
        rollingId: r.rolling_id,
        cameraId: cam,
        level: 'WARNING',
        eventType: 'RECORDING_SUPERSEDED',
        message: 'Enregistrement clôturé : une nouvelle session a démarré sur la caméra',
        detailsJson: { supersededBy: rid },
      }).catch(() => {});
    }
  }

  const clubId = await resolveClubIdByCamera({ deviceId, cameraId }).catch(() => null);
  const start = toDate(beginTimeIso);
  const th = thumb && typeof thumb === 'object' ? thumb : null;

  const { rows } = await query(
    `INSERT INTO current_recording
       (rolling_id, club_id, device_id, camera_id, device_serial, club_domicile,
        club_adverse, nom_video, date_debut, status, engine, state, cam_offset,
        export_begin_iso, live_url, final_gcs_path, temp_gcs_path, thumb_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'EN_COURS','hls','RECORDING',$10,$11,$12,$13,$14,$15)
     ON CONFLICT (rolling_id) DO NOTHING
     RETURNING ${V2_COLS}`,
    [
      rid,
      clubId,
      clampText(deviceId, 255),
      cam,
      clampText(deviceSerial, 255),
      clampText(directory, 255),
      parseOpponentFromCombined(combinedFilename),
      clampText(combinedFilename, 255),
      start,
      clampText(offset, 16),
      clampText(beginTimeIso, 64),
      liveUrl || null,
      clampText(finalGcsPath, 1024),
      clampText(tempGcsPath, 1024),
      th ? JSON.stringify(th) : null,
    ]
  );

  const row = rows[0] || (await getV2ByRollingId(rid));
  if (row) {
    await rawAddLog({
      recordingId: row.id,
      clubId: row.club_id,
      cameraId: cam,
      level: 'INFO',
      eventType: 'RECORDING_STARTED',
      message: 'Enregistrement démarré (HLS Live)',
      detailsJson: { rollingId: rid, engine: 'hls', deviceId: clampText(deviceId, 255) },
    }).catch(() => {});
    if (!row.club_id) {
      await rawAddLog({
        recordingId: row.id,
        cameraId: cam,
        level: 'WARNING',
        eventType: 'CLUB_UNRESOLVED',
        message: 'Caméra non rattachée à un club (devices) : club_id NULL.',
        detailsJson: { deviceId: clampText(deviceId, 255), cameraId: cam },
      }).catch(() => {});
    }
  }
  return row;
}

/** STOP : demande l'arrêt et fixe la cible finale (nom connu au STOP). */
async function requestStopHls({ rollingId, finalGcsPath, nomVideo, dateFin, thumb }) {
  const rid = clampText(rollingId, 128);
  if (!rid) throw new Error('requestStopHls: rollingId requis');
  const row = await getV2ByRollingId(rid);
  if (!row) throw new Error('requestStopHls: session introuvable');
  if (['COMPLETED', 'FAILED'].includes(row.state)) return row;

  const th = thumb && typeof thumb === 'object' ? thumb : null;
  const { rows } = await query(
    `UPDATE current_recording
        SET stop_requested = TRUE,
            final_gcs_path = COALESCE($2, final_gcs_path),
            nom_video = COALESCE($3, nom_video),
            date_fin = COALESCE($4, date_fin),
            thumb_json = COALESCE($5, thumb_json)
      WHERE rolling_id = $1
      RETURNING ${V2_COLS}`,
    [
      rid,
      clampText(finalGcsPath, 1024),
      clampText(nomVideo, 255),
      toDate(dateFin),
      th ? JSON.stringify(th) : null,
    ]
  );
  await rawAddLog({
    recordingId: row.id,
    clubId: row.club_id,
    cameraId: row.camera_id,
    level: 'INFO',
    eventType: 'RECORDING_STOPPED',
    message: 'Arrêt demandé',
    detailsJson: {},
  }).catch(() => {});
  return rows[0] || null;
}

/** Worker : marque la capture démarrée (execution Cloud Run liée). */
async function markCapturingHls({ rollingId, executionName }) {
  const rid = clampText(rollingId, 128);
  const { rows } = await query(
    `UPDATE current_recording
        SET capture_started_at = COALESCE(capture_started_at, NOW()),
            heartbeat_at = NOW(),
            execution_name = COALESCE($2, execution_name)
      WHERE rolling_id = $1 RETURNING ${V2_COLS}`,
    [rid, clampText(executionName, 512)]
  );
  return rows[0] || null;
}

/** Worker : heartbeat + lecture de l'ordre d'arrêt. Renvoie {stopRequested, state}. */
async function heartbeatHls({ rollingId }) {
  const rid = clampText(rollingId, 128);
  const { rows } = await query(
    `UPDATE current_recording SET heartbeat_at = NOW()
      WHERE rolling_id = $1
      RETURNING stop_requested, state, status`,
    [rid]
  );
  if (!rows[0]) return { stopRequested: true, state: 'FAILED', missing: true };
  return {
    stopRequested: rows[0].stop_requested === true,
    state: rows[0].state,
    status: rows[0].status,
  };
}

/** Worker : passe en FINALIZING (ffmpeg arrêté, upload/copie en cours). */
async function finalizingHls({ rollingId }) {
  const rid = clampText(rollingId, 128);
  const { rows } = await query(
    `UPDATE current_recording SET state = 'FINALIZING'
      WHERE rolling_id = $1 AND state NOT IN ('COMPLETED','FAILED')
      RETURNING ${V2_COLS}`,
    [rid]
  );
  return rows[0] || null;
}

/**
 * Worker : capture terminée avec succès. Convergence métier : un arrêt à 2 h se
 * comporte EXACTEMENT comme un STOP manuel -> status='COMPLET'. `timeout` n'est
 * conservé que comme drapeau d'audit (auto_timeout), sans impact sur le statut.
 * Idempotent et protégé : n'écrase jamais un état terminal déjà écrit.
 */
async function completeHls({ rollingId, finalGcsPath, finalPublicUrl, timeout = false }) {
  const rid = clampText(rollingId, 128);
  const current = await getV2ByRollingId(rid);
  if (current && ['COMPLETED', 'FAILED'].includes(current.state)) return current;
  const { rows } = await query(
    `UPDATE current_recording
        SET state = 'COMPLETED',
            status = 'COMPLET',
            auto_timeout = (auto_timeout OR $4),
            final_gcs_path = COALESCE($2, final_gcs_path),
            final_public_url = COALESCE($3, final_public_url),
            date_fin = COALESCE(date_fin, NOW()),
            duration_seconds = GREATEST(0,
              FLOOR(EXTRACT(EPOCH FROM (COALESCE(date_fin, NOW()) - date_debut)))::int)
      WHERE rolling_id = $1 AND state NOT IN ('COMPLETED', 'FAILED')
      RETURNING ${V2_COLS}`,
    [rid, clampText(finalGcsPath, 1024), clampText(finalPublicUrl, 2048), !!timeout]
  );
  const updated = rows[0] || null;
  if (!updated) return await getV2ByRollingId(rid); // course perdue : déjà finalisé
  await rawAddLog({
    recordingId: updated.id,
    clubId: updated.club_id,
    cameraId: updated.camera_id,
    level: 'INFO',
    eventType: 'VIDEO_FINALIZED',
    message: timeout ? 'Vidéo finale générée (limite 2 h atteinte)' : 'Vidéo finale générée',
    detailsJson: { finalGcsPath: clampText(finalGcsPath, 1024) },
  }).catch(() => {});
  return updated;
}

/** Worker : capture interrompue / échec. status INTERROMPU. Idempotent + protégé. */
async function failHls({ rollingId, error }) {
  const rid = clampText(rollingId, 128);
  const current = await getV2ByRollingId(rid);
  if (current && ['COMPLETED', 'FAILED'].includes(current.state)) return current;
  const { rows } = await query(
    `UPDATE current_recording
        SET state = 'FAILED',
            status = 'INTERROMPU',
            error_message = COALESCE($2, error_message),
            date_fin = COALESCE(date_fin, NOW()),
            duration_seconds = COALESCE(duration_seconds, GREATEST(0,
              FLOOR(EXTRACT(EPOCH FROM (COALESCE(date_fin, NOW()) - date_debut)))::int))
      WHERE rolling_id = $1 AND state NOT IN ('COMPLETED', 'FAILED')
      RETURNING ${V2_COLS}`,
    [rid, clampText(error, 2000)]
  );
  const updated = rows[0] || null;
  if (!updated) return await getV2ByRollingId(rid);
  await rawAddLog({
    recordingId: updated.id,
    clubId: updated.club_id,
    cameraId: updated.camera_id,
    level: 'ERROR',
    eventType: 'ERROR',
    message: 'Capture HLS interrompue',
    detailsJson: { error: clampText(error, 500) },
  }).catch(() => {});
  return updated;
}

/**
 * Source de vérité du statut côté mobile : dernière session HLS d'un device
 * (ou caméra), non rejetée et récente. NULL si aucune. Permet à
 * /hikconnect/recording-status de refléter l'état Cloud SQL plutôt que l'état
 * caméra (le bouton Stop disparaît dès que la session est terminale).
 */
async function getActiveHlsForDevice({ deviceId, cameraId, sinceHours = 6 } = {}) {
  const dev = clampText(deviceId, 255);
  const cam = clampText(cameraId, 255);
  if (!dev && !cam) return null;
  const { rows } = await query(
    `SELECT ${V2_COLS} FROM current_recording
      WHERE engine = 'hls'
        AND dismissed_at IS NULL
        AND ($1::text IS NULL OR device_id = $1)
        AND ($2::text IS NULL OR camera_id = $2)
        AND created_at > NOW() - ($3 || ' hours')::interval
      ORDER BY created_at DESC
      LIMIT 1`,
    [dev || null, cam || null, String(Math.max(1, Number(sinceHours) || 6))]
  );
  return rows[0] || null;
}

/**
 * Réconciliation "limite de durée atteinte" : demande l'arrêt d'une session HLS
 * encore active (exactement comme un STOP utilisateur) et marque auto_timeout
 * pour l'audit. Le worker verra stop_requested et finalisera normalement.
 * Idempotent : sans effet si déjà terminale ou déjà en cours d'arrêt.
 */
async function autoStopHls({ rollingId }) {
  const rid = clampText(rollingId, 128);
  if (!rid) return null;
  const { rows } = await query(
    `UPDATE current_recording
        SET stop_requested = TRUE,
            auto_timeout = TRUE
      WHERE rolling_id = $1
        AND engine = 'hls'
        AND state NOT IN ('COMPLETED', 'FAILED')
        AND stop_requested = FALSE
      RETURNING ${V2_COLS}`,
    [rid]
  );
  const row = rows[0] || null;
  if (row) {
    await rawAddLog({
      recordingId: row.id,
      clubId: row.club_id,
      cameraId: row.camera_id,
      level: 'INFO',
      eventType: 'RECORDING_STOPPED',
      message: 'Arrêt automatique (durée maximale atteinte)',
      detailsJson: { reason: 'max_duration' },
    }).catch(() => {});
  }
  return row;
}

const engineHls = {
  start: startHlsRecording,
  get: getV2ByRollingId,
  getActiveForDevice: getActiveHlsForDevice,
  requestStop: requestStopHls,
  autoStop: autoStopHls,
  markCapturing: markCapturingHls,
  heartbeat: heartbeatHls,
  finalizing: finalizingHls,
  complete: completeHls,
  fail: failHls,
  markThumbnail: markThumbnailV2,
  listForCamera: listForCameraV2,
  dismiss: dismissV2,
  addLog: rawAddLog,
};

// ---------------------------------------------------------------------------
// Façade "mirror" : best-effort, ne jette JAMAIS (protège le rolling).
// ---------------------------------------------------------------------------

function wrap(fn, label) {
  return async (...args) => {
    if (!isMirrorEnabled()) return null;
    try {
      return await fn(...args);
    } catch (e) {
      console.error(`[recmirror] ${label} failed:`, e?.message);
      return null;
    }
  };
}

const mirror = {
  startRecording: wrap(startRecording, 'startRecording'),
  finishRecording: wrap(finishRecording, 'finishRecording'),
  addSegment: wrap(addSegment, 'addSegment'),
  recordSegmentsMerged: wrap(recordSegmentsMerged, 'recordSegmentsMerged'),
  addLog: wrap(rawAddLog, 'addLog'),
  findByRollingId: wrap(findByRollingId, 'findByRollingId'),
};

module.exports = {
  // Façade recommandée (best-effort).
  mirror,
  // Moteur V2 (FSM, source de vérité). Ces fonctions peuvent throw.
  engineV2,
  // Moteur HLS Live (capture FFmpeg / Cloud Run Job). Ces fonctions peuvent throw.
  engineHls,
  // Fonctions brutes (peuvent throw) — utiles pour de futurs endpoints/admin.
  resolveClubIdByCamera,
  findByRollingId,
  ensureRecording,
  startRecording,
  finishRecording,
  addSegment,
  recordSegmentsMerged,
  addLog: rawAddLog,
  isMirrorEnabled,
};
