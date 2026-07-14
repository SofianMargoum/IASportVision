/**
 * Routes d'authentification.
 *  - POST /auth/login : { username, password } -> { token, user }
 *  - GET  /auth/me    : (Bearer) -> { user } (lecture en BDD, vérifie is_active)
 *
 * Le routeur est monté à la racine ("/") par index.js, donc l'URL exposée
 * est bien `/auth/login` et `/auth/me`.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const {
  findByUsernameWithHash,
  verifyPassword,
  findById,
  toPublic,
} = require('../auth/userStore');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  decodeRefreshToken,
  requireAuth,
} = require('../auth/jwt');
const {
  createRefreshToken,
  getRefreshTokenById,
  matchesRefreshToken,
  rotateRefreshToken,
  revokeSession,
  revokeUserSessions,
} = require('../auth/refreshTokenStore');

// Rate-limit en mémoire (par IP+username) pour ralentir le brute force.
// Pour la production sérieuse : remplacer par express-rate-limit (Redis) ou
// Cloud Armor en frontal.
const ATTEMPTS = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 1000;
const LOCKOUT_MS = 5 * 60 * 1000;

function rateLimitKey(req, username) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  return `${ip}::${(username || '').toLowerCase()}`;
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = ATTEMPTS.get(key);
  if (!entry) return { ok: true };
  if (entry.lockUntil && entry.lockUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((entry.lockUntil - now) / 1000) };
  }
  if (entry.firstAt && now - entry.firstAt > WINDOW_MS) {
    ATTEMPTS.delete(key);
  }
  return { ok: true };
}

function recordFailure(key) {
  const now = Date.now();
  const entry = ATTEMPTS.get(key) || { count: 0, firstAt: now, lockUntil: 0 };
  entry.count += 1;
  if (!entry.firstAt) entry.firstAt = now;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockUntil = now + LOCKOUT_MS;
    entry.count = 0;
    entry.firstAt = now;
  }
  ATTEMPTS.set(key, entry);
}

function recordSuccess(key) {
  ATTEMPTS.delete(key);
}

// Hash bcrypt "factice" pour homogénéiser le temps de réponse quand l'user
// n'existe pas (atténue les attaques par timing).
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8xq3VOZk7nqQwQK0Ip9k0lYxC7Klty';

function buildAuthResponse({ accessToken, refreshToken, user }) {
  return {
    status: 'ok',
    token: accessToken,
    accessToken,
    refreshToken,
    user,
  };
}

function newTokenId() {
  return crypto.randomUUID();
}

async function issueSessionTokens(user) {
  const sessionId = crypto.randomUUID();
  const refreshTokenId = newTokenId();
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({
    userId: user.id,
    sessionId,
    tokenId: refreshTokenId,
  });
  const refreshPayload = verifyRefreshToken(refreshToken);
  await createRefreshToken({
    tokenId: refreshTokenId,
    userId: user.id,
    sessionId,
    token: refreshToken,
    expiresAt: new Date(refreshPayload.exp * 1000),
  });
  return { accessToken, refreshToken };
}

/**
 * POST /auth/login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Champs username et password requis.' });
    }
    if (username.length > 64 || password.length > 128) {
      return res.status(400).json({ status: 'error', message: 'Champs trop longs.' });
    }

    const key = rateLimitKey(req, username);
    const rl = checkRateLimit(key);
    if (!rl.ok) {
      res.set('Retry-After', String(rl.retryAfterSec));
      return res.status(429).json({
        status: 'error',
        message: `Trop de tentatives. Réessayez dans ${rl.retryAfterSec}s.`,
      });
    }

    const row = await findByUsernameWithHash(username);
    // On appelle toujours verifyPassword pour limiter l'oracle de timing.
    const passwordOk = await verifyPassword(password, row ? row.password_hash : DUMMY_HASH);

    if (!row || !passwordOk || !row.is_active) {
      recordFailure(key);
      return res
        .status(401)
        .json({ status: 'error', message: 'Identifiant ou mot de passe incorrect.' });
    }

    recordSuccess(key);
    const user = toPublic(row);
    const { accessToken, refreshToken } = await issueSessionTokens(user);

    return res.status(200).json(buildAuthResponse({ accessToken, refreshToken, user }));
  } catch (err) {
    console.error('[auth/login] erreur :', err?.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

/**
 * POST /auth/refresh
 * Rotation stricte du refresh token. Révoque toute la session en cas de reuse.
 */
router.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken !== 'string' || !refreshToken) {
      return res.status(400).json({ status: 'error', message: 'refreshToken requis.' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (e) {
      return res.status(401).json({ status: 'error', message: 'Refresh token invalide ou expiré.' });
    }

    const record = await getRefreshTokenById(payload.tokenId);
    if (!record) {
      return res.status(401).json({ status: 'error', message: 'Refresh token introuvable.' });
    }
    if (!matchesRefreshToken(record, refreshToken)) {
      await revokeSession(record.session_id, 'hash-mismatch');
      return res.status(403).json({ status: 'error', message: 'Refresh token révoqué.' });
    }
    if (record.revoked_at) {
      if (record.session_id) {
        await revokeSession(record.session_id, 'reuse-detected');
      }
      return res.status(403).json({ status: 'error', message: 'Refresh token révoqué.' });
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await revokeSession(record.session_id, 'expired');
      return res.status(401).json({ status: 'error', message: 'Refresh token expiré.' });
    }

    const user = await findById(payload.userId);
    if (!user || !user.isActive) {
      await revokeSession(record.session_id, 'user-inactive');
      return res.status(403).json({ status: 'error', message: 'Compte introuvable ou désactivé.' });
    }

    const newRefreshTokenId = newTokenId();
    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const nextRefreshToken = signRefreshToken({
      userId: user.id,
      sessionId: payload.sessionId,
      tokenId: newRefreshTokenId,
    });
    const nextPayload = verifyRefreshToken(nextRefreshToken);
    const rotated = await rotateRefreshToken({
      currentTokenId: payload.tokenId,
      currentToken: refreshToken,
      newTokenId: newRefreshTokenId,
      newToken: nextRefreshToken,
      expiresAt: new Date(nextPayload.exp * 1000),
    });

    if (!rotated.ok) {
      if (rotated.sessionId) {
        await revokeSession(rotated.sessionId, rotated.code === 'rotated' ? 'reuse-detected' : rotated.code);
      }
      const status = rotated.code === 'invalid' || rotated.code === 'expired' ? 401 : 403;
      return res.status(status).json({ status: 'error', message: 'Refresh token invalide ou révoqué.' });
    }

    return res.status(200).json(buildAuthResponse({
      accessToken,
      refreshToken: nextRefreshToken,
      user,
    }));
  } catch (err) {
    console.error('[auth/refresh] erreur :', err?.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

/**
 * POST /auth/logout
 * Révoque le refresh token courant ou, à défaut, toutes les sessions du user authentifié.
 */
router.post('/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (typeof refreshToken === 'string' && refreshToken) {
      let decoded = null;
      try {
        const payload = verifyRefreshToken(refreshToken);
        await revokeSession(payload.sessionId, 'logout');
      } catch (_) {
        decoded = decodeRefreshToken(refreshToken);
        if (decoded?.sessionId) {
          await revokeSession(decoded.sessionId, 'logout');
        }
      }
      return res.status(200).json({ status: 'ok' });
    }

    if (req.headers.authorization) {
      return requireAuth(req, res, async () => {
        await revokeUserSessions(req.auth.userId, 'logout-all');
        return res.status(200).json({ status: 'ok' });
      });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[auth/logout] erreur :', err?.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

/**
 * GET /auth/me — lit l'utilisateur courant en BDD, refuse si supprimé/inactif.
 */
router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await findById(req.auth.userId);
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ status: 'error', message: 'Compte introuvable ou désactivé.' });
    }
    return res.status(200).json({ status: 'ok', user });
  } catch (err) {
    console.error('[auth/me] erreur :', err?.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

module.exports = router;
