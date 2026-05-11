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

// --- Clubs -----------------------------------------------------------------

export async function listClubs() {
  const data = await request('/admin/clubs');
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.clubs)) return data.clubs;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function createClub(payload) {
  return request('/admin/clubs', { method: 'POST', body: payload });
}

export async function deleteClub(id) {
  if (!id) throw new Error('id requis');
  return request(`/admin/clubs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function searchFffClubs(q) {
  const term = (q || '').trim().slice(0, 100);
  if (!term) return [];
  const data = await request(`/admin/fff/clubs/search?q=${encodeURIComponent(term)}`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.clubs)) return data.clubs;
  return [];
}

export async function fetchFffClubByClNo(clNo) {
  if (clNo === null || clNo === undefined || clNo === '') return null;
  const data = await request(`/admin/fff/clubs/${encodeURIComponent(clNo)}`);
  return data?.club || data || null;
}

// --- Devices (caméras rattachées à un club) --------------------------------

export async function listDevices() {
  const data = await request('/admin/devices');
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.devices)) return data.devices;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function createDevice(payload) {
  return request('/admin/devices', { method: 'POST', body: payload });
}

export async function deleteDevice(id) {
  if (!id) throw new Error('id requis');
  return request(`/admin/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
