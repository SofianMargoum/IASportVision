import { request } from './client';

export async function fetchAllCameras() {
  return request('/api/hikconnect/cameras');
}

export async function startRecording(deviceId) {
  if (!deviceId) throw new Error('deviceId requis');
  return request('/api/hikconnect/start-recording', { method: 'PUT', body: { deviceId } });
}

export async function stopRecording(deviceId) {
  if (!deviceId) throw new Error('deviceId requis');
  return request('/api/hikconnect/stop-recording', { method: 'PUT', body: { deviceId } });
}

export async function getRecordingStatus({ deviceId, cameraId }) {
  if (!deviceId) throw new Error('deviceId requis');
  return request('/api/hikconnect/recording-status', {
    method: 'POST',
    body: { deviceId, ...(cameraId ? { cameraId } : {}) },
  });
}
