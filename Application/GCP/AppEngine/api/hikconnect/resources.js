const { apiRequest } = require('./client');

async function listDevices(params = { pageIndex: 1, pageSize: 50 }) {
  return apiRequest('/api/hccgw/resource/v1/devices/get', { body: params });
}

async function listCameras(params = { pageIndex: 1, pageSize: 50, filter: {} }) {
  const body = {
    pageIndex: params.pageIndex ?? 1,
    pageSize: params.pageSize ?? 50,
    filter: params.filter ?? {},
  };
  return apiRequest('/api/hccgw/resource/v1/areas/cameras/get', { body });
}

async function getSystemProperties() {
  return apiRequest('/api/hccgw/platform/v1/systemproperties', { method: 'GET' });
}

// ---------------------------------------------------------------------------
// HLS Live : résolution caméra + obtention de l'URL HLS.
// Aucune valeur (resourceId / deviceSerial) n'est codée en dur : on résout
// depuis areas/cameras/get. Petit cache mémoire pour éviter de paginer à
// chaque démarrage (les caméras changent rarement).
// ---------------------------------------------------------------------------

const _cameraCache = { at: 0, byId: new Map() };
const CAMERA_CACHE_TTL_MS = 5 * 60 * 1000;

function extractSerial(cam) {
  return (
    cam?.device?.devInfo?.serialNo ||
    cam?.device?.deviceInfo?.serialNo ||
    cam?.devInfo?.serialNo ||
    cam?.serialNo ||
    null
  );
}

function extractChannel(cam) {
  return (
    cam?.device?.channelInfo?.no ||
    cam?.channelInfo?.no ||
    cam?.channelNo ||
    '1'
  );
}

async function buildCameraIndex() {
  const byId = new Map();
  const pageSize = 100;
  for (let pageIndex = 1; pageIndex <= 50; pageIndex++) {
    // eslint-disable-next-line no-await-in-loop
    const data = await listCameras({ pageIndex, pageSize, filter: {} });
    // areas/cameras/get renvoie : { data: { camera: [...], totalCount, ... } }.
    const root = data?.data || {};
    const list = root.camera || root.cameras || root.list || [];
    const arr = Array.isArray(list) ? list : [];
    for (const cam of arr) {
      const id = cam?.id || cam?.cameraId || cam?.resourceId;
      if (id) {
        byId.set(String(id), {
          resourceId: String(id),
          name: cam?.name || cam?.cameraName || null,
          deviceSerial: extractSerial(cam),
          channelNo: String(extractChannel(cam)),
        });
      }
    }
    if (arr.length < pageSize) break;
  }
  return byId;
}

/**
 * Résout (resourceId, deviceSerial, channelNo, name) pour une caméra donnée
 * par son resourceId (== cameraId Hik-Connect). Utilise un cache mémoire.
 */
async function resolveCameraIdentifiers(cameraId, { force = false } = {}) {
  const id = String(cameraId || '').trim();
  if (!id) {
    const err = new Error('cameraId requis pour résoudre la caméra');
    err.status = 400;
    throw err;
  }

  const fresh = Date.now() - _cameraCache.at < CAMERA_CACHE_TTL_MS;
  if (!force && fresh && _cameraCache.byId.has(id)) {
    return _cameraCache.byId.get(id);
  }

  const byId = await buildCameraIndex();
  _cameraCache.at = Date.now();
  _cameraCache.byId = byId;

  const found = byId.get(id);
  if (!found) {
    const err = new Error('Caméra introuvable dans areas/cameras/get');
    err.status = 404;
    err.details = { cameraId: id };
    throw err;
  }
  return found;
}

/**
 * Obtient une URL HLS Live pour une caméra (protocol 2 = HLS).
 * expireTime par défaut 7200 s (2 h), validé.
 */
async function getLiveAddress({
  deviceSerial,
  resourceId,
  type = '1',
  protocol = 2,
  quality = 1,
  expireTime = 7200,
}) {
  if (!deviceSerial || !resourceId) {
    const err = new Error('deviceSerial et resourceId requis pour live/address/get');
    err.status = 400;
    throw err;
  }
  const data = await apiRequest('/api/hccgw/video/v1/live/address/get', {
    body: {
      deviceSerial: String(deviceSerial),
      resourceId: String(resourceId),
      type: String(type),
      protocol: Number(protocol),
      quality: Number(quality),
      expireTime: Number(expireTime),
    },
  });
  const url = data?.data?.url || null;
  if (!url) {
    const err = new Error('live/address/get : URL HLS absente de la réponse');
    err.status = 502;
    // Ne pas inclure de token dans details.
    err.details = { errorCode: data?.errorCode };
    throw err;
  }
  return { url, expireTime: Number(expireTime) };
}

module.exports = {
  listDevices,
  listCameras,
  getSystemProperties,
  resolveCameraIdentifiers,
  getLiveAddress,
};
