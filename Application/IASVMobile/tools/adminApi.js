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

import { secureFetch } from './api';

const ADMIN_BASE = 'https://ia-sport.oa.r.appspot.com';
const TIMEOUT_MS = 15000;

if (!/^https:\/\//i.test(ADMIN_BASE)) {
  throw new Error('ADMIN_BASE must use HTTPS');
}

async function adminFetch(path, { method = 'GET', body } = {}) {
  return secureFetch(`${ADMIN_BASE}${path}`, {
    method,
    body,
    timeoutMs: TIMEOUT_MS,
    parse: 'json',
  });
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
