/**
 * Client API admin (CRUD utilisateurs).
 * Toutes les requêtes envoient Authorization: Bearer <jwt>.
 * Le token est lu via tools/secureToken.js (Keychain).
 *
 * Endpoints (cf. backend GCP/AppEngine/api/adminUsers.js) :
 *   GET    /admin/users
 *   POST   /admin/users
 *   GET    /admin/users/:id
 *   PUT    /admin/users/:id
 *   DELETE /admin/users/:id   (soft-delete : isActive=false)
 */

import { loadToken } from './secureToken';

const ADMIN_BASE = 'https://ia-sport.oa.r.appspot.com';
const TIMEOUT_MS = 15000;

if (!/^https:\/\//i.test(ADMIN_BASE)) {
  throw new Error('ADMIN_BASE must use HTTPS');
}

async function adminFetch(path, { method = 'GET', body } = {}) {
  const token = await loadToken();
  if (!token) {
    const err = new Error('Session expirée. Reconnectez-vous.');
    err.status = 401;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(`${ADMIN_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = {};
    try { data = await resp.json(); } catch { data = {}; }

    if (!resp.ok) {
      const err = new Error((data && data.message) || `HTTP ${resp.status}`);
      err.status = resp.status;
      err.details = data;
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

export async function listUsers() {
  const data = await adminFetch('/admin/users');
  // Backend renvoie { users: [...] } ou un tableau direct selon implémentation.
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getUser(id) {
  if (!id) throw new Error('id requis');
  return adminFetch(`/admin/users/${encodeURIComponent(id)}`);
}

export async function createUser(payload) {
  return adminFetch('/admin/users', { method: 'POST', body: payload });
}

export async function updateUser(id, payload) {
  if (!id) throw new Error('id requis');
  return adminFetch(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  });
}

/** Désactivation (soft-delete) côté serveur. */
export async function deactivateUser(id) {
  if (!id) throw new Error('id requis');
  return adminFetch(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
