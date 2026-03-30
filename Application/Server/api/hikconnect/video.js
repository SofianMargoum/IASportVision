const xml2js = require('xml2js');

const { apiRequest, proxypassRaw } = require('./client');

// ===== Playback (XML via proxypass) =====
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

  if (startTimeMatch && endTimeMatch) {
    const startTime = new Date(
      startTimeMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
    );
    const endTime = new Date(
      endTimeMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
    );

    // small guard -1s
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
    protocol: 'rtsp',
  };

  const candidates = [
    '/api/hccgw/video/v1/rtsp/playback',
    '/api/hccgw/video/v1/playback/rtsp',
    '/api/hccgw/video/v1/rtsp/playback/bytime',
  ];

  let lastError = null;
  for (const p of candidates) {
    try {
      const data = await apiRequest(p, { body });
      const url = data?.data?.url || data?.data?.rtspUrl || data?.data?.playbackUrl;
      if (url) return url;

      lastError = { path: p, message: 'Cloud playback URL not found', details: data };
    } catch (err) {
      lastError = { path: p, message: err.message, status: err.status, details: err.details };
    }
  }

  const error = new Error('Cloud playback URL not found via OpenAPI');
  error.status = lastError?.status || 502;
  error.details = { tried: candidates, lastError };
  throw error;
}

// ===== Save / Download =====
async function saveVideo({ cameraId, beginTime, endTime, voiceSwitch = 2 }) {
  return apiRequest('/api/hccgw/video/v1/video/save', {
    body: { cameraId, beginTime, endTime, voiceSwitch },
  });
}

async function getDownloadUrl({ taskId }) {
  return apiRequest('/api/hccgw/video/v1/video/download/url', {
    body: { taskId },
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

module.exports = {
  getLastPlaybackFromDevice,
  getCloudPlaybackUrl,
  saveVideo,
  getDownloadUrl,
  waitForDownloadUrl,
};
