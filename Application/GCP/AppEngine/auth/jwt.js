/**
 * JWT helpers : signature, vérification, middleware Express.
 *
 * ⚠️  Le secret JWT NE DOIT JAMAIS être en dur.
 *     Il doit être fourni via la variable d'environnement JWT_SECRET
 *     (App Engine env_variables, fichier .env local, Secret Manager, ...).
 */

const jwt = require('jsonwebtoken');

const DEFAULT_ACCESS_TTL = '15m';
const DEFAULT_REFRESH_TTL = '30d';

/**
 * Récupère le secret JWT depuis l'environnement.
 * Lance une erreur explicite si absent (refus de démarrer avec un secret vide).
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error(
      'JWT_SECRET manquant ou trop court (>= 16 caractères requis). ' +
        'Définissez la variable d\'environnement JWT_SECRET.'
    );
  }
  return secret;
}

function getRefreshJwtSecret() {
  const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error(
      'REFRESH_TOKEN_SECRET manquant ou trop court (>= 16 caractères requis). '
        + 'Définissez REFRESH_TOKEN_SECRET ou JWT_SECRET.'
    );
  }
  return secret;
}

function normalizeAccessPayload(payload) {
  return {
    userId: String(payload.sub || payload.userId || ''),
    role: String(payload.role || ''),
    tokenType: String(payload.typ || payload.tokenType || ''),
  };
}

function normalizeRefreshPayload(payload) {
  return {
    userId: String(payload.sub || payload.userId || ''),
    sessionId: String(payload.sid || payload.sessionId || ''),
    tokenId: String(payload.jti || payload.tokenId || ''),
    tokenType: String(payload.typ || payload.tokenType || ''),
    exp: payload.exp,
  };
}

/**
 * Signe un JWT pour un utilisateur authentifié.
 * Le payload contient : userId, role.
 */
function signAccessToken({ userId, role }, options = {}) {
  if (!userId || !role) {
    throw new Error('signAccessToken: userId et role sont requis');
  }
  return jwt.sign(
    { sub: String(userId), role: String(role), typ: 'access' },
    getJwtSecret(),
    {
      expiresIn: options.expiresIn || process.env.ACCESS_TOKEN_TTL || process.env.JWT_TTL || DEFAULT_ACCESS_TTL,
      issuer: 'iasv-api',
      audience: 'iasv-mobile',
    }
  );
}

function signRefreshToken({ userId, sessionId, tokenId }, options = {}) {
  if (!userId || !sessionId || !tokenId) {
    throw new Error('signRefreshToken: userId, sessionId et tokenId sont requis');
  }
  return jwt.sign(
    {
      sub: String(userId),
      sid: String(sessionId),
      jti: String(tokenId),
      typ: 'refresh',
    },
    getRefreshJwtSecret(),
    {
      expiresIn: options.expiresIn || process.env.REFRESH_TOKEN_TTL || DEFAULT_REFRESH_TTL,
      issuer: 'iasv-api',
      audience: 'iasv-mobile-refresh',
    }
  );
}

/**
 * Vérifie un JWT. Retourne le payload décodé.
 * Lève une erreur si invalide / expiré.
 */
function verifyAccessToken(token) {
  const payload = jwt.verify(token, getJwtSecret(), {
    issuer: 'iasv-api',
    audience: 'iasv-mobile',
  });
  const normalized = normalizeAccessPayload(payload);
  if (normalized.tokenType !== 'access' || !normalized.userId || !normalized.role) {
    throw new Error('Access token invalide.');
  }
  return normalized;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, getRefreshJwtSecret(), {
    issuer: 'iasv-api',
    audience: 'iasv-mobile-refresh',
  });
  const normalized = normalizeRefreshPayload(payload);
  if (
    normalized.tokenType !== 'refresh'
    || !normalized.userId
    || !normalized.sessionId
    || !normalized.tokenId
  ) {
    throw new Error('Refresh token invalide.');
  }
  return normalized;
}

function decodeRefreshToken(token) {
  const payload = jwt.decode(token);
  if (!payload || typeof payload !== 'object') return null;
  const normalized = normalizeRefreshPayload(payload);
  if (!normalized.sessionId || !normalized.tokenId) return null;
  return normalized;
}

/**
 * Middleware Express : protège une route.
 * Cherche le token dans le header `Authorization: Bearer <token>`.
 * Attache le payload décodé dans `req.auth`.
 */
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!m) {
      return res.status(401).json({ status: 'error', message: 'Token manquant.' });
    }
    const payload = verifyAccessToken(m[1]);
    req.auth = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ status: 'error', message: 'Token invalide ou expiré.' });
  }
}

/**
 * Middleware factory : exige un (ou plusieurs) rôle(s) précis.
 * Usage : router.get('/admin', requireAuth, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  const allowed = new Set(roles.flat().map(String));
  return (req, res, next) => {
    if (!req.auth || !allowed.has(req.auth.role)) {
      return res.status(403).json({ status: 'error', message: 'Accès refusé.' });
    }
    next();
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeRefreshToken,
  requireAuth,
  requireRole,
};
