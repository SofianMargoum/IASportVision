// API admin/annotation : tout passe par App Engine -> Cloud Run privé.
// Aucune URL Cloud Run en dur côté navigateur.

import { request } from './client';

const BASE = '/api/admin';

// ----- Annotation -----
export function listAnnotationVideos() {
  return request(`${BASE}/annotation/videos`);
}

export function listFrames({ videoId, status = 'pending', orderBy = 'confidence', limit = 100 } = {}) {
  const q = new URLSearchParams();
  if (videoId) q.set('videoId', videoId);
  if (status) q.set('status', status);
  if (orderBy) q.set('orderBy', orderBy);
  if (limit) q.set('limit', String(limit));
  return request(`${BASE}/annotation/frames?${q.toString()}`);
}

export function getFrame(id) {
  if (!id) throw new Error('id requis');
  return request(`${BASE}/annotation/frames/${encodeURIComponent(id)}`);
}

/**
 * URL d'image pour un frame (passe par App Engine -> Cloud Run privé).
 * Le navigateur recevra du JPEG via le proxy App Engine.
 * Note : le navigateur enverra le cookie de session classique mais c'est
 * l'image elle-même qui sera servie en retour (proxy buffer).
 * On ajoute le JWT dans une URL signée n'est pas possible, donc le
 * <img> ne peut pas porter d'Authorization. → On fetch en blob.
 */
export async function fetchFrameImage(id, type = 'annotated') {
  const path = `${BASE}/annotation/frames/${encodeURIComponent(id)}/image?type=${encodeURIComponent(type)}`;
  // request() ne gère pas les blobs : on appelle fetch directement avec token.
  const { getToken } = await import('./client');
  const token = getToken();
  const apiBase = (process.env.REACT_APP_API_BASE || 'https://ia-sport.oa.r.appspot.com').replace(/\/+$/, '');
  const resp = await fetch(`${apiBase}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    const err = new Error(`HTTP ${resp.status}: ${t || resp.statusText}`);
    err.status = resp.status;
    throw err;
  }
  return await resp.blob();
}

export function saveAnnotation({ docId, label, correctedBox } = {}) {
  return request(`${BASE}/annotation/save`, {
    method: 'POST',
    body: { docId, label, ...(correctedBox ? { correctedBox } : {}) },
  });
}

export function getAnnotationStats(videoId) {
  const q = videoId ? `?videoId=${encodeURIComponent(videoId)}` : '';
  return request(`${BASE}/annotation/stats${q}`);
}

// ----- Training -----
export function getTrainingReadiness(videoIds) {
  const q = videoIds ? `?videoIds=${encodeURIComponent(videoIds)}` : '';
  return request(`${BASE}/training/readiness${q}`);
}

export function startTraining(payload) {
  return request(`${BASE}/training/start`, { method: 'POST', body: payload });
}

export function getTrainingStatus(runId) {
  return request(`${BASE}/training/status?runId=${encodeURIComponent(runId)}`);
}

export function listModelVersions() {
  return request(`${BASE}/training/versions`);
}

export function activateModel(runId) {
  return request(`${BASE}/training/activate`, { method: 'POST', body: { runId } });
}

// ----- Diagnostic -----
export function pingCloudRun() {
  return request(`${BASE}/cloudrun/ping`);
}
