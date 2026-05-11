/**
 * Repository pour la table `devices` (caméras HikConnect rattachées à un club).
 *
 * Toutes les requêtes utilisent des paramètres positionnels ($1, $2, …) pour
 * éviter toute injection SQL. Les colonnes exposées vers l'API sont
 * volontairement limitées (pas de `*`).
 */

const { query } = require('./pool');

const PUBLIC_COLS = `
  d.id,
  d.club_id,
  d.hik_device_id,
  d.device_id,
  d.camera_id,
  d.name,
  d.serial_number,
  d.status,
  d.raw_data,
  d.created_at,
  d.updated_at
`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function normalizeText(value, { max = 255, required = false, label = 'champ' } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) throw err(400, `${label} requis.`);
    return null;
  }
  const s = String(value).trim();
  if (!s) {
    if (required) throw err(400, `${label} requis.`);
    return null;
  }
  if (s.length > max) throw err(400, `${label} trop long.`);
  return s;
}

function normalizeRawData(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw err(400, 'raw_data invalide (JSON attendu).');
    }
  }
  if (typeof value !== 'object') {
    throw err(400, 'raw_data invalide (objet attendu).');
  }
  return value;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    club_id: row.club_id,
    hik_device_id: row.hik_device_id,
    device_id: row.device_id,
    camera_id: row.camera_id,
    name: row.name,
    serial_number: row.serial_number,
    status: row.status,
    raw_data: row.raw_data,
    created_at: row.created_at,
    updated_at: row.updated_at,
    club: row.club_name
      ? {
          id: row.club_id,
          name: row.club_name,
          fff_cl_no: row.club_fff_cl_no,
          logo_url: row.club_logo_url,
        }
      : null,
  };
}

async function listDevices() {
  const { rows } = await query(`
    SELECT ${PUBLIC_COLS},
           c.name      AS club_name,
           c.fff_cl_no AS club_fff_cl_no,
           c.logo_url  AS club_logo_url
      FROM devices d
      JOIN clubs   c ON c.id = d.club_id
     ORDER BY LOWER(c.name) ASC, LOWER(COALESCE(d.name, d.hik_device_id)) ASC
  `);
  return rows.map(mapRow);
}

async function findById(id) {
  if (!UUID_RE.test(String(id || ''))) return null;
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS},
            c.name      AS club_name,
            c.fff_cl_no AS club_fff_cl_no,
            c.logo_url  AS club_logo_url
       FROM devices d
       JOIN clubs   c ON c.id = d.club_id
      WHERE d.id = $1`,
    [id]
  );
  return mapRow(rows[0]);
}

async function findByClubId(clubId) {
  if (!UUID_RE.test(String(clubId || ''))) return [];
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS},
            c.name      AS club_name,
            c.fff_cl_no AS club_fff_cl_no,
            c.logo_url  AS club_logo_url
       FROM devices d
       JOIN clubs   c ON c.id = d.club_id
      WHERE d.club_id = $1
      ORDER BY LOWER(COALESCE(d.name, d.hik_device_id)) ASC`,
    [clubId]
  );
  return rows.map(mapRow);
}

async function findByHikDeviceId(hikDeviceId) {
  const norm = normalizeText(hikDeviceId, { max: 255, label: 'hik_device_id' });
  if (!norm) return null;
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS},
            c.name      AS club_name,
            c.fff_cl_no AS club_fff_cl_no,
            c.logo_url  AS club_logo_url
       FROM devices d
       JOIN clubs   c ON c.id = d.club_id
      WHERE d.hik_device_id = $1`,
    [norm]
  );
  return mapRow(rows[0]);
}

async function createDevice({
  club_id,
  hik_device_id,
  device_id,
  camera_id,
  name,
  serial_number,
  status,
  raw_data,
}) {
  if (!UUID_RE.test(String(club_id || ''))) {
    throw err(400, 'club_id invalide.');
  }

  // Le `camera_id` Hik-Connect est l'identifiant unique réel d'une caméra.
  // On l'utilise aussi comme `hik_device_id` (clé unique légacy) si non fourni
  // explicitement, pour garder la compatibilité avec les anciennes lignes.
  const cam = normalizeText(camera_id, { max: 255, label: 'camera_id' });
  const dev = normalizeText(device_id, { max: 255, label: 'device_id' });
  const hikRaw = hik_device_id || cam;
  const hik = normalizeText(hikRaw, { max: 255, required: true, label: 'hik_device_id' });
  const nm = normalizeText(name, { max: 255, label: 'name' });
  const sn = normalizeText(serial_number, { max: 255, label: 'serial_number' });
  const st = normalizeText(status, { max: 64, label: 'status' });
  const raw = normalizeRawData(raw_data);

  // Vérifie l'existence du club avant l'INSERT pour renvoyer un 404 clair.
  const clubCheck = await query('SELECT id FROM clubs WHERE id = $1', [club_id]);
  if (clubCheck.rows.length === 0) {
    throw err(404, 'Club introuvable.');
  }

  try {
    const { rows } = await query(
      `INSERT INTO devices (club_id, hik_device_id, device_id, camera_id, name, serial_number, status, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [club_id, hik, dev, cam, nm, sn, st, raw]
    );
    return findById(rows[0].id);
  } catch (e) {
    if (e && e.code === '23505') {
      throw err(409, 'Cette caméra est déjà enregistrée.');
    }
    if (e && e.code === '23503') {
      throw err(404, 'Club introuvable.');
    }
    throw e;
  }
}

async function deleteDevice(id) {
  if (!UUID_RE.test(String(id || ''))) {
    throw err(400, 'Identifiant invalide.');
  }
  const { rows } = await query(
    `DELETE FROM devices WHERE id = $1
     RETURNING id, club_id, hik_device_id, device_id, camera_id, name, serial_number, status, raw_data, created_at, updated_at`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  listDevices,
  findById,
  findByClubId,
  findByHikDeviceId,
  createDevice,
  deleteDevice,
  UUID_RE,
};
