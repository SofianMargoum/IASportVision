/**
 * Client API pour l'authentification.
 *  - login(username, password) -> { token, user }
 *  - me(token) -> payload JWT côté serveur (validation du token)
 *
 * Le token est stocké via tools/secureToken.js (react-native-keychain).
 * Aucune information sensible n'est jamais journalisée.
 */

const AUTH_BASE = 'https://ia-sport.oa.r.appspot.com';
const TIMEOUT_MS = 15000;

if (!/^https:\/\//i.test(AUTH_BASE)) {
  throw new Error('AUTH_BASE must use HTTPS');
}

async function authFetch(path, { method = 'GET', body, token } = {}) {
  const url = `${AUTH_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = {};
    try {
      data = await resp.json();
    } catch {
      data = {};
    }

    if (!resp.ok) {
      const err = new Error(
        (data && data.message) || `HTTP ${resp.status}`
      );
      err.status = resp.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('La requête a expiré. Vérifiez votre connexion.');
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /auth/login
 * @returns { token, user } en cas de succès
 * @throws  Error avec .status (401 = identifiants invalides, 429 = blocage, ...)
 */
export async function loginRequest(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    const err = new Error('Identifiants invalides.');
    err.status = 400;
    throw err;
  }
  const data = await authFetch('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  if (!data || !data.token || !data.user) {
    const err = new Error('Réponse serveur invalide.');
    err.status = 500;
    throw err;
  }
  return { token: data.token, user: data.user };
}

/**
 * GET /auth/me — valide le token. Lève si invalide/expiré.
 */
export async function meRequest(token) {
  if (!token) {
    const err = new Error('Token absent.');
    err.status = 401;
    throw err;
  }
  return authFetch('/auth/me', { method: 'GET', token });
}
