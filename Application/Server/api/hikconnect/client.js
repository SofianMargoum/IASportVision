// Auto-load environment variables from .env if dotenv is installed
try {
  require('dotenv').config();
} catch {}

const HIK_BASE_URL = process.env.HIK_BASE_URL || 'https://ieu.hikcentralconnect.com';
// ⚠️ Évite les clés en dur en prod (env vars override if set)
const HIK_APP_KEY = process.env.HIK_APP_KEY || 'r2dHJrezsz1YUAV6PfRNkAUGSfisdzm8';
const HIK_SECRET_KEY = process.env.HIK_SECRET_KEY || 'wHdmXyBmBeTbMNh7Gy14OlBh9AZQyCas';

// Simple in-memory token cache
let tokenCache = {
  accessToken: null,
  expireAt: 0,
};

function assertEnv() {
  if (!HIK_APP_KEY || !HIK_SECRET_KEY) {
    const err = new Error('Missing env vars: HIK_APP_KEY and HIK_SECRET_KEY');
    err.status = 500;
    throw err;
  }
}

async function getToken(forceRefresh = false) {
  assertEnv();

  const now = Date.now();
  if (!forceRefresh && tokenCache.accessToken && tokenCache.expireAt > now) {
    return { accessToken: tokenCache.accessToken, expireTime: tokenCache.expireAt };
  }

  const url = `${HIK_BASE_URL}/api/hccgw/platform/v1/token/get`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ appKey: HIK_APP_KEY, secretKey: HIK_SECRET_KEY }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.errorCode !== '0') {
    const err = new Error(`Token request failed: HTTP ${resp.status} / errorCode=${data?.errorCode}`);
    err.status = resp.status;
    err.details = data;
    throw err;
  }

  const accessToken = data?.data?.accessToken;
  const expireTime = data?.data?.expireTime || 0;

  if (!accessToken) {
    const err = new Error('Token response missing accessToken');
    err.status = 502;
    err.details = data;
    throw err;
  }

  // expireTime may be seconds or milliseconds; normalize to ms from now if small
  const expireAt =
    expireTime > 1e12
      ? expireTime
      : expireTime > 0
        ? Date.now() + expireTime * 1000
        : Date.now() + 6.5 * 24 * 60 * 60 * 1000;

  tokenCache = { accessToken, expireAt };

  return { accessToken, expireTime: expireAt };
}

// Safe apiRequest (no body for GET/HEAD)
async function apiRequest(path, options = {}) {
  const { accessToken } = await getToken();
  const url = `${HIK_BASE_URL}${path.startsWith('/api/') ? '' : '/api'}${path}`;

  const method = (options.method || 'POST').toUpperCase();
  const canHaveBody = !['GET', 'HEAD'].includes(method);

  const resp = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Token: accessToken,
      ...(options.headers || {}),
    },
    body: canHaveBody && options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || (data?.errorCode && data.errorCode !== '0')) {
    const err = new Error(`OpenAPI request failed: HTTP ${resp.status} / errorCode=${data?.errorCode}`);
    err.status = resp.status;
    err.details = data;
    throw err;
  }

  return data;
}

async function proxypassRaw(payload) {
  const { accessToken } = await getToken();
  const url = `${HIK_BASE_URL}/api/hccgw/video/v1/isapi/proxypass`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Token: accessToken,
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`Proxypass failed: HTTP ${resp.status}`);
    err.status = resp.status;
    err.details = text;
    throw err;
  }

  try {
    const json = JSON.parse(text);
    if (json?.errorCode && json.errorCode !== '0') {
      const err = new Error(`Proxypass errorCode=${json.errorCode}`);
      err.status = 502;
      err.details = json;
      throw err;
    }
    return json?.data || text;
  } catch {
    return text;
  }
}

module.exports = {
  HIK_BASE_URL,
  getToken,
  apiRequest,
  proxypassRaw,
};
