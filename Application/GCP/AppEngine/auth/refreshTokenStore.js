const crypto = require('crypto');
const { query, withTransaction } = require('../db/pool');

function hashRefreshToken(token) {
  if (typeof token !== 'string' || !token) {
    throw new Error('Refresh token invalide.');
  }
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function safeEqualHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function createRefreshToken({ tokenId, userId, sessionId, token, expiresAt }) {
  if (!tokenId || !userId || !sessionId || !expiresAt) {
    throw new Error('createRefreshToken: paramètres requis manquants.');
  }
  await query(
    `INSERT INTO refresh_tokens (id, user_id, session_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenId, userId, sessionId, hashRefreshToken(token), expiresAt]
  );
}

async function getRefreshTokenById(tokenId) {
  if (!tokenId) return null;
  const { rows } = await query(
    `SELECT id, user_id, session_id, token_hash, expires_at, last_used_at,
            rotated_at, revoked_at, revoked_reason, replaced_by_token_id,
            created_at, updated_at
       FROM refresh_tokens
      WHERE id = $1
      LIMIT 1`,
    [tokenId]
  );
  return rows[0] || null;
}

function matchesRefreshToken(record, presentedToken) {
  if (!record?.token_hash) return false;
  return safeEqualHex(record.token_hash, hashRefreshToken(presentedToken));
}

async function rotateRefreshToken({
  currentTokenId,
  currentToken,
  newTokenId,
  newToken,
  expiresAt,
} = {}) {
  if (!currentTokenId || !currentToken || !newTokenId || !newToken || !expiresAt) {
    throw new Error('rotateRefreshToken: paramètres requis manquants.');
  }

  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, user_id, session_id, token_hash, expires_at, rotated_at,
              revoked_at, revoked_reason, replaced_by_token_id
         FROM refresh_tokens
        WHERE id = $1
        FOR UPDATE`,
      [currentTokenId]
    );

    const row = current.rows[0] || null;
    if (!row || !matchesRefreshToken(row, currentToken)) {
      return { ok: false, code: 'invalid' };
    }
    if (row.revoked_at) {
      return { ok: false, code: row.rotated_at ? 'rotated' : 'revoked', sessionId: row.session_id };
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { ok: false, code: 'expired', sessionId: row.session_id };
    }

    await client.query(
      `INSERT INTO refresh_tokens (id, user_id, session_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [newTokenId, row.user_id, row.session_id, hashRefreshToken(newToken), expiresAt]
    );

    await client.query(
      `UPDATE refresh_tokens
          SET last_used_at = NOW(),
              rotated_at = NOW(),
              revoked_at = NOW(),
              revoked_reason = 'rotated',
              replaced_by_token_id = $2
        WHERE id = $1`,
      [currentTokenId, newTokenId]
    );

    return { ok: true, userId: row.user_id, sessionId: row.session_id };
  });
}

async function revokeRefreshToken(tokenId, reason = 'revoked') {
  if (!tokenId) return 0;
  const result = await query(
    `UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, NOW()),
            revoked_reason = COALESCE(revoked_reason, $2)
      WHERE id = $1
        AND revoked_at IS NULL`,
    [tokenId, reason]
  );
  return result.rowCount || 0;
}

async function revokeSession(sessionId, reason = 'revoked') {
  if (!sessionId) return 0;
  const result = await query(
    `UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, NOW()),
            revoked_reason = COALESCE(revoked_reason, $2)
      WHERE session_id = $1
        AND revoked_at IS NULL`,
    [sessionId, reason]
  );
  return result.rowCount || 0;
}

async function revokeUserSessions(userId, reason = 'revoked') {
  if (!userId) return 0;
  const result = await query(
    `UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, NOW()),
            revoked_reason = COALESCE(revoked_reason, $2)
      WHERE user_id = $1
        AND revoked_at IS NULL`,
    [userId, reason]
  );
  return result.rowCount || 0;
}

module.exports = {
  createRefreshToken,
  getRefreshTokenById,
  matchesRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeSession,
  revokeUserSessions,
};