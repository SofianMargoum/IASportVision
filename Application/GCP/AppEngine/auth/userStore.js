/**
 * Repository utilisateurs — adossé à PostgreSQL.
 *
 * Toutes les requêtes utilisent des paramètres ($1, $2, ...) pour éviter
 * toute injection SQL. Les mots de passe ne sont jamais retournés en clair :
 * - en interne on manipule `password_hash`
 * - en sortie publique on appelle `toPublic()` qui exclut ce champ
 *
 * La table `users` est créée par db/migrations/001_users.sql.
 */

const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');

const BCRYPT_ROUNDS = 10;
const ROLES = new Set(['coach', 'player', 'supporter', 'admin']);

const PUBLIC_COLUMNS =
  'id, username, email, name, role, club_id, photo_asset, is_active, created_at, updated_at';

/**
 * Projection publique : ne contient JAMAIS password_hash.
 */
function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    role: row.role,
    clubId: row.club_id || null,
    photoAsset: row.photo_asset || null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw Object.assign(new Error('Mot de passe trop court (min 8).'), { status: 400 });
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (typeof plain !== 'string' || typeof hash !== 'string') return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Recherche par username (case-insensitive). Retourne la ligne brute (avec hash).
 * Usage interne uniquement (login). Ne JAMAIS retourner cet objet à un client.
 */
async function findByUsernameWithHash(username) {
  if (typeof username !== 'string' || !username) return null;
  const sql = `SELECT id, username, email, password_hash, name, role,
                      club_id, photo_asset, is_active, created_at, updated_at
                 FROM users
                WHERE LOWER(username) = LOWER($1)
                LIMIT 1`;
  const { rows } = await query(sql, [username]);
  return rows[0] || null;
}

async function findById(id) {
  if (!id) return null;
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? toPublic(rows[0]) : null;
}

async function listUsers({ limit = 100, offset = 0, includeInactive = false } = {}) {
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));
  const off = Math.max(0, Number(offset) || 0);
  const where = includeInactive ? '' : 'WHERE is_active = TRUE';
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}
       FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  return rows.map(toPublic);
}

function assertValidRole(role) {
  if (!ROLES.has(role)) {
    throw Object.assign(new Error('Rôle invalide.'), { status: 400 });
  }
}

function assertValidUsername(username) {
  if (typeof username !== 'string' || username.length < 3 || username.length > 64) {
    throw Object.assign(new Error('Username invalide (3-64 caractères).'), { status: 400 });
  }
}

function assertValidEmail(email) {
  if (email === null || email === undefined || email === '') return;
  if (
    typeof email !== 'string' ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw Object.assign(new Error('Email invalide.'), { status: 400 });
  }
}

async function createUser({ username, password, name, role, email, clubId, photoAsset }) {
  assertValidUsername(username);
  assertValidRole(role);
  assertValidEmail(email);
  if (typeof name !== 'string' || !name.trim()) {
    throw Object.assign(new Error('Nom requis.'), { status: 400 });
  }
  const password_hash = await hashPassword(password);

  const sql = `INSERT INTO users (username, email, password_hash, name, role, club_id, photo_asset)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING ${PUBLIC_COLUMNS}`;
  const params = [
    username.trim(),
    email ? String(email).trim().toLowerCase() : null,
    password_hash,
    name.trim(),
    role,
    clubId || null,
    photoAsset || null,
  ];

  try {
    const { rows } = await query(sql, params);
    return toPublic(rows[0]);
  } catch (e) {
    if (e?.code === '23505') {
      const field = /username/i.test(e.detail || '') ? 'username' : 'email';
      throw Object.assign(new Error(`Un utilisateur avec ce ${field} existe déjà.`), {
        status: 409,
      });
    }
    throw e;
  }
}

/**
 * Met à jour partiellement un utilisateur. Champs autorisés uniquement.
 */
async function updateUser(id, patch = {}) {
  if (!id) throw Object.assign(new Error('id requis.'), { status: 400 });

  const sets = [];
  const params = [];
  let i = 1;

  const push = (col, val) => {
    sets.push(`${col} = $${i++}`);
    params.push(val);
  };

  if (patch.username !== undefined) {
    assertValidUsername(patch.username);
    push('username', patch.username.trim());
  }
  if (patch.email !== undefined) {
    assertValidEmail(patch.email);
    push('email', patch.email ? String(patch.email).trim().toLowerCase() : null);
  }
  if (patch.name !== undefined) {
    if (typeof patch.name !== 'string' || !patch.name.trim()) {
      throw Object.assign(new Error('Nom invalide.'), { status: 400 });
    }
    push('name', patch.name.trim());
  }
  if (patch.role !== undefined) {
    assertValidRole(patch.role);
    push('role', patch.role);
  }
  if (patch.clubId !== undefined) push('club_id', patch.clubId || null);
  if (patch.photoAsset !== undefined) push('photo_asset', patch.photoAsset || null);
  if (patch.isActive !== undefined) push('is_active', Boolean(patch.isActive));
  if (patch.password !== undefined) {
    push('password_hash', await hashPassword(patch.password));
  }

  if (sets.length === 0) {
    return findById(id);
  }

  params.push(id);
  const sql = `UPDATE users SET ${sets.join(', ')}
                 WHERE id = $${i}
               RETURNING ${PUBLIC_COLUMNS}`;
  try {
    const { rows } = await query(sql, params);
    return rows[0] ? toPublic(rows[0]) : null;
  } catch (e) {
    if (e?.code === '23505') {
      const field = /username/i.test(e.detail || '') ? 'username' : 'email';
      throw Object.assign(new Error(`Un utilisateur avec ce ${field} existe déjà.`), {
        status: 409,
      });
    }
    throw e;
  }
}

/**
 * Soft delete : passe is_active à FALSE. Retourne le user mis à jour ou null.
 */
async function softDelete(id) {
  if (!id) return null;
  const { rows } = await query(
    `UPDATE users SET is_active = FALSE
       WHERE id = $1
     RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0] ? toPublic(rows[0]) : null;
}

module.exports = {
  findByUsernameWithHash,
  verifyPassword,
  findById,
  listUsers,
  createUser,
  updateUser,
  softDelete,
  toPublic,
  hashPassword,
  ROLES,
};
