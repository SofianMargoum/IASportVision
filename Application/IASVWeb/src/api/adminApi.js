import { request } from './client';

export async function listUsers() {
  const data = await request('/admin/users');
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getUser(id) {
  if (!id) throw new Error('id requis');
  return request(`/admin/users/${encodeURIComponent(id)}`);
}

export async function createUser(payload) {
  return request('/admin/users', { method: 'POST', body: payload });
}

export async function updateUser(id, payload) {
  if (!id) throw new Error('id requis');
  return request(`/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
}

export async function deactivateUser(id) {
  if (!id) throw new Error('id requis');
  return request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
