// Client HTTP web pour IA Sport Vision.
// - HTTPS uniquement
// - Timeout via AbortController
// - Injecte automatiquement Authorization: Bearer <jwt> pour notre backend
// - Lit le token via getToken() (localStorage)
// Inspiré de IASVMobile/tools/api.js — version web.

const API_BASE = (process.env.REACT_APP_API_BASE || 'https://ia-sport.oa.r.appspot.com').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 30000;
const TOKEN_KEY = 'iasv.jwt';

if (!/^https:\/\//i.test(API_BASE)) {
  // En dev pur on tolère localhost http si jamais — sinon on force HTTPS.
  if (!/^http:\/\/localhost/i.test(API_BASE)) {
    throw new Error('REACT_APP_API_BASE must use HTTPS');
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token && typeof token === 'string') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* storage indisponible : on ignore silencieusement */
  }
}

export function clearToken() {
  setToken(null);
}

function isOwnApiUrl(url) {
  try {
    const u = new URL(url);
    const base = new URL(API_BASE);
    return u.origin === base.origin;
  } catch {
    return false;
  }
}

export async function request(path, { method = 'GET', body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, parse = 'json' } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const token = getToken();
  const sendAuth = token && isOwnApiUrl(url);

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(sendAuth ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = null;
    if (parse === 'json') {
      data = await resp.json().catch(() => ({}));
    } else if (parse === 'text') {
      data = await resp.text().catch(() => '');
    }

    if (!resp.ok) {
      const err = new Error((data && data.message) || `HTTP ${resp.status}`);
      err.status = resp.status;
      err.details = data;
      // Auto-déconnexion si le backend rejette le JWT.
      if (resp.status === 401 && sendAuth) {
        clearToken();
        try { window.dispatchEvent(new CustomEvent('iasv:auth:expired')); } catch {}
      }
      throw err;
    }
    return data;
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('La requête a expiré.');
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const API_URL = API_BASE;
