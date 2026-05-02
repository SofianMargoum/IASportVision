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

const {
  findByUsernameWithHash,
  verifyPassword,
  findById,
  toPublic,
} = require('../auth/userStore');
const { signAuthToken, requireAuth } = require('../auth/jwt');

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
    const token = signAuthToken({ userId: row.id, role: row.role });

    return res.status(200).json({
      status: 'ok',
      token,
      user: toPublic(row),
    });
  } catch (err) {
    console.error('[auth/login] erreur :', err?.message);
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
