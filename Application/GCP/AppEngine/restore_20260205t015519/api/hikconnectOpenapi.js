// Auto-load environment variables from .env if dotenv is installed
try {
  require('dotenv').config();
} catch {}

const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { pipeline } = require('stream/promises');

const router = express.Router();

// Google Cloud Storage
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

const HIK_BASE_URL = process.env.HIK_BASE_URL || 'https://ieu.hikcentralconnect.com';
// Hardcoded for test only (env vars still override if set)
const HIK_APP_KEY = process.env.HIK_APP_KEY || 'r2dHJrezsz1YUAV6PfRNkAUGSfisdzm8';
const HIK_SECRET_KEY = process.env.HIK_SECRET_KEY || 'wHdmXyBmBeTbMNh7Gy14OlBh9AZQyCas';

// Simple in-memory token cache
let tokenCache = {
  accessToken: null,
  expireAt: 0
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
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ appKey: HIK_APP_KEY, secretKey: HIK_SECRET_KEY })
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
  const expireAt = expireTime > 1e12
    ? expireTime
    : (expireTime > 0 ? Date.now() + expireTime * 1000 : Date.now() + 6.5 * 24 * 60 * 60 * 1000);

  tokenCache = { accessToken, expireAt };

  return { accessToken, expireTime: expireAt };
}

async function apiRequest(path, options = {}) {
  const { accessToken } = await getToken();
  const url = `${HIK_BASE_URL}${path.startsWith('/api/') ? '' : '/api'}${path}`;

  const resp = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Token': accessToken,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
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
      'Accept': 'application/json',
      'Token': accessToken,
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

// Example OpenAPI calls (paths are typical; adjust to your exact OpenAPI spec)
async function listDevices(params = { pageIndex: 1, pageSize: 50 }) {
  return apiRequest('/api/hccgw/resource/v1/devices/get', { body: params });
}

async function listCameras(params = { pageIndex: 1, pageSize: 50, filter: {} }) {
  const body = {
    pageIndex: params.pageIndex ?? 1,
    pageSize: params.pageSize ?? 50,
    filter: params.filter ?? {}
  };
  return apiRequest('/api/hccgw/resource/v1/areas/cameras/get', { body });
}

async function getSystemProperties(params = {}) {
  return apiRequest('/api/hccgw/platform/v1/systemproperties', { method: 'GET', body: params });
}

async function proxypassRecord(deviceId, action) {
  const url = `/ISAPI/ContentMgmt/record/control/manual/${action}/tracks/1`;
  const payload = {
    method: 'PUT',
    url,
    id: deviceId,
    contentType: 'application/xml',
    body: ''
  };

  return apiRequest('/api/hccgw/video/v1/isapi/proxypass', { body: payload });
}

async function getLastPlaybackFromDevice(deviceId) {
  const bodyXML = `
    <CMSearchDescription>
      <searchID>1</searchID>
      <trackIDList>
        <trackID>101</trackID>
      </trackIDList>
      <maxResults>-1</maxResults>
    </CMSearchDescription>`;

  const xmlText = await proxypassRaw({
    method: 'POST',
    url: '/ISAPI/ContentMgmt/search',
    id: deviceId,
    contentType: 'application/xml',
    body: bodyXML,
  });

  const parsed = await xml2js.parseStringPromise(xmlText, { explicitArray: false, mergeAttrs: true });
  const matchList = parsed?.CMSearchResult?.matchList?.searchMatchItem;
  if (!matchList || (Array.isArray(matchList) && matchList.length === 0)) {
    const err = new Error('No search match items found');
    err.status = 404;
    throw err;
  }

  const lastMatchItem = Array.isArray(matchList) ? matchList[matchList.length - 1] : matchList;
  let playbackURI = lastMatchItem?.mediaSegmentDescriptor?.playbackURI;

  if (!playbackURI) {
    const err = new Error('Playback URI not found in response');
    err.status = 404;
    throw err;
  }

  playbackURI = playbackURI.replace(/&amp;/g, '&');

  const startTimeMatch = playbackURI.match(/starttime=(\d{8}T\d{6}Z)/);
  const endTimeMatch = playbackURI.match(/endtime=(\d{8}T\d{6}Z)/);
  let videoDuration = 0;

  let startTime = null;
  let endTime = null;
  if (startTimeMatch && endTimeMatch) {
    startTime = new Date(
      startTimeMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
    );
    endTime = new Date(
      endTimeMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
    );

    videoDuration = Math.max(0, Math.floor((endTime - startTime) / 1000) - 1);
  }

  return { playbackURI, videoDuration, startTimeRaw: startTimeMatch?.[1], endTimeRaw: endTimeMatch?.[1] };
}

async function getCloudPlaybackUrl({ deviceId, startTime, endTime }) {
  const body = {
    deviceId,
    channelNo: 1,
    startTime,
    endTime,
    streamType: 0,
    protocol: 'rtsp'
  };

  const candidates = [
    '/api/hccgw/video/v1/rtsp/playback',
    '/api/hccgw/video/v1/playback/rtsp',
    '/api/hccgw/video/v1/rtsp/playback/bytime'
  ];

  let lastError = null;
  for (const path of candidates) {
    try {
      const data = await apiRequest(path, { body });
      const url = data?.data?.url || data?.data?.rtspUrl || data?.data?.playbackUrl;
      if (url) return url;

      lastError = { path, message: 'Cloud playback URL not found', details: data };
    } catch (err) {
      lastError = { path, message: err.message, status: err.status, details: err.details };
    }
  }

  const error = new Error('Cloud playback URL not found via OpenAPI');
  error.status = lastError?.status || 502;
  error.details = { tried: candidates, lastError };
  throw error;
}

async function saveVideo({ cameraId, beginTime, endTime, voiceSwitch = 2 }) {
  return apiRequest('/api/hccgw/video/v1/video/save', {
    body: { cameraId, beginTime, endTime, voiceSwitch }
  });
}

async function getDownloadUrl({ taskId }) {
  return apiRequest('/api/hccgw/video/v1/video/download/url', {
    body: { taskId }
  });
}

async function waitForDownloadUrl(taskId, timeoutMs = 120000, intervalMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await getDownloadUrl({ taskId });
    const status = data?.data?.status;
    if (status === 0 && Array.isArray(data?.data?.urls) && data.data.urls.length > 0) {
      return data.data.urls[0];
    }
    if (status === 2) {
      const err = new Error('Video upload failed on HikConnect');
      err.status = 502;
      err.details = data;
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const err = new Error('Timeout waiting for download URL');
  err.status = 504;
  throw err;
}

// Express example routes
router.get('/hikconnect/token', async (req, res) => {
  try {
    const token = await getToken(false);
    res.status(200).json(token);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

router.get('/hikconnect/devices', async (req, res) => {
  try {
    const pageIndex = Number(req.query.pageIndex || 1);
    const pageSize = Number(req.query.pageSize || 50);
    const data = await listDevices({ pageIndex, pageSize });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

router.get('/hikconnect/cameras', async (req, res) => {
  try {
    const pageIndex = Number(req.query.pageIndex || 1);
    const pageSize = Number(req.query.pageSize || 50);
    const data = await listCameras({ pageIndex, pageSize, filter: {} });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

router.get('/hikconnect/system-properties', async (req, res) => {
  try {
    const data = await getSystemProperties({});
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Start recording via HikConnect OpenAPI
router.put('/hikconnect/start-recording', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  try {
    const data = await proxypassRecord(deviceId, 'start');
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Stop recording via HikConnect OpenAPI
router.put('/hikconnect/stop-recording', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  try {
    const data = await proxypassRecord(deviceId, 'stop');
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Save video on HikConnect cloud and return taskId
router.post('/hikconnect/video/save', async (req, res) => {
  const { cameraId, beginTime, endTime, voiceSwitch } = req.body || {};
  if (!cameraId || !beginTime || !endTime) {
    return res.status(400).json({ message: 'Missing cameraId, beginTime or endTime' });
  }
  try {
    const data = await saveVideo({ cameraId, beginTime, endTime, voiceSwitch });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Get download URL status for saved video
router.post('/hikconnect/video/download-url', async (req, res) => {
  const { taskId } = req.body || {};
  if (!taskId) return res.status(400).json({ message: 'Missing taskId' });
  try {
    const data = await getDownloadUrl({ taskId });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Save video then upload to GCS
router.post('/hikconnect/video/save-and-upload', async (req, res) => {
  const { cameraId, beginTime, endTime, directory, filename, voiceSwitch } = req.body || {};
  if (!cameraId || !beginTime || !endTime || !directory || !filename) {
    return res.status(400).json({ message: 'Missing cameraId, beginTime, endTime, directory or filename' });
  }

  try {
    const saveResp = await saveVideo({ cameraId, beginTime, endTime, voiceSwitch });
    const taskId = saveResp?.data?.taskId;
    if (!taskId) {
      return res.status(502).json({ message: 'taskId missing from save response', details: saveResp });
    }

    const downloadUrl = await waitForDownloadUrl(taskId);
    const safeFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
    const localFilePath = path.join('/tmp', safeFilename);

    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ message: 'Failed to download from HikConnect', details: text });
    }

    await pipeline(resp.body, fs.createWriteStream(localFilePath));

    const gcsFilePath = path.join(directory, safeFilename);
    await bucket.upload(localFilePath, {
      destination: gcsFilePath,
      contentType: 'video/mp4'
    });

    fs.unlinkSync(localFilePath);

    res.status(200).json({
      status: 'success',
      message: `File uploaded to ${gcsFilePath} in GCS`,
      taskId,
      downloadUrl
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Upload last recording via HikConnect playback
router.post('/hikconnect/upload-last-recording', async (req, res) => {
  const { deviceId, filename, directory } = req.body;
  if (!deviceId || !filename || !directory) {
    return res.status(400).json({ message: 'Missing deviceId, filename or directory' });
  }

  try {
    const { playbackURI, videoDuration, startTimeRaw, endTimeRaw } = await getLastPlaybackFromDevice(deviceId);
    if (!videoDuration || videoDuration <= 0) {
      return res.status(400).json({ message: 'Invalid or zero duration in playback data' });
    }

    let finalPlaybackUrl = playbackURI;
    if (playbackURI?.startsWith('rtsp://0.0.0.0') && startTimeRaw && endTimeRaw) {
      try {
        finalPlaybackUrl = await getCloudPlaybackUrl({ deviceId, startTime: startTimeRaw, endTime: endTimeRaw });
      } catch (cloudErr) {
        console.error('Cloud playback URL error:', cloudErr.message);
        return res.status(cloudErr.status || 500).json({ message: cloudErr.message, details: cloudErr.details });
      }
    }

    const localFilePath = path.join('/tmp', filename);
    const gcsFilePath = path.join(directory, filename);

    const command = ffmpeg(finalPlaybackUrl)
      .outputOptions(`-t ${videoDuration}`)
      .outputOptions('-c:v copy')
      .outputOptions('-c:a copy')
      .on('start', (commandLine) => {
        console.log('HikConnect download started:', commandLine);
      })
      .on('error', (err) => {
        console.error('HikConnect download error:', err.message);
        res.status(500).json({ message: 'Failed to process playback stream', error: err.message });
      })
      .on('end', async () => {
        try {
          await bucket.upload(localFilePath, {
            destination: gcsFilePath,
            contentType: 'video/mp4'
          });

          fs.unlinkSync(localFilePath);
          res.status(200).json({
            status: 'success',
            message: `File uploaded to ${gcsFilePath} in GCS`,
            playbackURI: finalPlaybackUrl,
            duration: videoDuration
          });
        } catch (uploadError) {
          console.error('Error uploading file to GCS:', uploadError);
          res.status(500).json({ message: 'Failed to upload file to GCS', error: uploadError.message });
        }
      });

    if (finalPlaybackUrl?.startsWith('rtsp://')) {
      command.inputOptions('-rtsp_transport tcp');
    }

    command.save(localFilePath);
  } catch (err) {
    console.error('HikConnect upload error:', err.message);
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

module.exports = {
  router,
  getToken,
  apiRequest,
  listDevices,
  listCameras,
  getSystemProperties,
  proxypassRecord,
  getLastPlaybackFromDevice,
  saveVideo,
  getDownloadUrl
};
