import { request } from './client';

export async function login(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    const err = new Error('Identifiants invalides.');
    err.status = 400;
    throw err;
  }
  const data = await request('/auth/login', { method: 'POST', body: { username, password } });
  if (!data || !data.token || !data.user) {
    const err = new Error('Réponse serveur invalide.');
    err.status = 500;
    throw err;
  }
  return { token: data.token, user: data.user };
}

export async function me() {
  return request('/auth/me', { method: 'GET' });
}
