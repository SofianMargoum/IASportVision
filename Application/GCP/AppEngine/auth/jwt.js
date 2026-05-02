/**
 * JWT helpers : signature, vérification, middleware Express.
 *
 * ⚠️  Le secret JWT NE DOIT JAMAIS être en dur.
 *     Il doit être fourni via la variable d'environnement JWT_SECRET
 *     (App Engine env_variables, fichier .env local, Secret Manager, ...).
 */

const jwt = require('jsonwebtoken');

const DEFAULT_TTL = '12h';

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

/**
 * Signe un JWT pour un utilisateur authentifié.
 * Le payload contient : userId, role.
 */
function signAuthToken({ userId, role }, options = {}) {
  if (!userId || !role) {
    throw new Error('signAuthToken: userId et role sont requis');
  }
  return jwt.sign(
    { userId: String(userId), role: String(role) },
    getJwtSecret(),
    {
      expiresIn: options.expiresIn || process.env.JWT_TTL || DEFAULT_TTL,
      issuer: 'iasv-api',
      audience: 'iasv-mobile',
    }
  );
}

/**
 * Vérifie un JWT. Retourne le payload décodé.
 * Lève une erreur si invalide / expiré.
 */
function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: 'iasv-api',
    audience: 'iasv-mobile',
  });
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
    const payload = verifyAuthToken(m[1]);
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
  signAuthToken,
  verifyAuthToken,
  requireAuth,
  requireRole,
};
