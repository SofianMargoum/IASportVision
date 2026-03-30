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

module.exports = {
  listDevices,
  listCameras,
  getSystemProperties,
};
