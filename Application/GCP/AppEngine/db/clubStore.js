/**
 * Repository pour la table `clubs` (clubs IA Sport Vision identifiés par leur
 * cl_no FFF/DOFA).
 *
 * Toutes les requêtes utilisent des paramètres positionnels ($1, $2, …) pour
 * éviter toute injection SQL. Les colonnes exposées vers l'API sont
 * volontairement limitées (pas de `*`).
 */

const { query } = require('../db/pool');

const PUBLIC_COLS = 'id, fff_cl_no, name, logo_url, created_at, updated_at';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function normalizeFffClNo(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > 64) throw err(400, 'fff_cl_no trop long.');
  // On accepte alphanumérique + tirets (les cl_no FFF sont en pratique numériques).
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw err(400, 'fff_cl_no invalide.');
  return s;
}

function normalizeName(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > 200) return s.slice(0, 200);
  return s;
}

function normalizeLogoUrl(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (s.length > 1000) throw err(400, 'logo_url trop long.');
  if (!/^https?:\/\//i.test(s)) throw err(400, 'logo_url doit être http(s).');
  return s;
}

async function listClubs() {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS} FROM clubs ORDER BY LOWER(name) ASC`
  );
  return rows;
}

async function findById(id) {
  if (!UUID_RE.test(String(id || ''))) return null;
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS} FROM clubs WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findByFffClNo(fffClNo) {
  const norm = normalizeFffClNo(fffClNo);
  if (!norm) return null;
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS} FROM clubs WHERE fff_cl_no = $1`,
    [norm]
  );
  return rows[0] || null;
}

async function createClub({ fff_cl_no, name, logo_url }) {
  const fff = normalizeFffClNo(fff_cl_no);
  const nm = normalizeName(name);
  const logo = normalizeLogoUrl(logo_url);
  if (!fff) throw err(400, 'fff_cl_no requis.');
  if (!nm) throw err(400, 'name requis.');

  try {
    const { rows } = await query(
      `INSERT INTO clubs (fff_cl_no, name, logo_url)
       VALUES ($1, $2, $3)
       RETURNING ${PUBLIC_COLS}`,
      [fff, nm, logo]
    );
    return rows[0];
  } catch (e) {
    // 23505 = unique_violation (fff_cl_no déjà présent)
    if (e && e.code === '23505') {
      throw err(409, 'Ce club est déjà enregistré.');
    }
    throw e;
  }
}

async function deleteClub(id) {
  if (!UUID_RE.test(String(id || ''))) {
    throw err(400, 'Identifiant invalide.');
  }
  const { rows } = await query(
    `DELETE FROM clubs WHERE id = $1 RETURNING ${PUBLIC_COLS}`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  listClubs,
  findById,
  findByFffClNo,
  createClub,
  deleteClub,
  UUID_RE,
};
