const xml2js = require('xml2js');
const crypto = require('crypto');

const { apiRequest, proxypassRaw } = require('./client');

// Manual recording state cache (best-effort fallback)
// Key: deviceId, Value: { isRecording: boolean, updatedAt: number, startedAt: number|null }
const manualRecordingState = new Map();

function base64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecodeToString(input) {
  const s = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64').toString('utf8');
}

function getRecordingStateSecret() {
  return (
    process.env.RECORDING_STATE_SECRET ||
    process.env.HIK_RECORDING_STATE_SECRET ||
    process.env.HIK_SECRET_KEY ||
    ''
  );
}

function signRecordingStatePayload(payloadObj) {
  const secret = getRecordingStateSecret();
  const payloadB64 = base64urlEncode(JSON.stringify(payloadObj));
  if (!secret) return { token: payloadB64, signed: false };

  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = base64urlEncode(sig);
  return { token: `${payloadB64}.${sigB64}`, signed: true };
}

function verifyAndReadRecordingStateToken(stateToken) {
  const token = String(stateToken || '').trim();
  if (!token) return null;

  const parts = token.split('.');
  const payloadB64 = parts[0];
  const sigB64 = parts.length === 2 ? parts[1] : null;

  const jsonStr = base64urlDecodeToString(payloadB64);
  let payload;
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    const err = new Error('Invalid recordingStateToken payload');
    err.status = 400;
    throw err;
  }

  const secret = getRecordingStateSecret();
  if (secret) {
    // If a secret is configured, require a signature.
    if (!sigB64) {
      const err = new Error('Missing recordingStateToken signature');
      err.status = 401;
      throw err;
    }

    const expectedSig = base64urlEncode(
      crypto.createHmac('sha256', secret).update(payloadB64).digest()
    );
    if (expectedSig !== sigB64) {
      const err = new Error('Invalid recordingStateToken signature');
      err.status = 401;
      throw err;
    }
  }

  return payload;
}

function signRecordingStateToken({ deviceId, action }) {
  const payload = {
    v: 1,
    deviceId: String(deviceId || ''),
    action: action === 'start' ? 'start' : 'stop',
    at: Date.now(),
  };
  return signRecordingStatePayload(payload).token;
}

function setManualRecordingState(deviceId, isRecording) {
  if (!deviceId) return;
  const key = String(deviceId);
  const prev = manualRecordingState.get(key) || null;
  const now = Date.now();

  if (isRecording) {
    const startedAt = prev?.isRecording && prev?.startedAt ? prev.startedAt : now;
    manualRecordingState.set(key, { isRecording: true, updatedAt: now, startedAt });
  } else {
    manualRecordingState.set(key, { isRecording: false, updatedAt: now, startedAt: null });
  }
}

function getManualRecordingState(deviceId) {
  if (!deviceId) return null;
  return manualRecordingState.get(String(deviceId)) || null;
}

function formatElapsedMmSs(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function getMaintenanceRecordingStatus(deviceId) {
  const targetId = String(deviceId);

  // Paginate defensively: some tenants have many devices.
  const pageSize = 100;
  for (let pageIndex = 1; pageIndex <= 20; pageIndex++) {
    const data = await apiRequest('/api/hccgw/maintenance/v1/list/device/detail', {
      body: {
        pageSize,
        pageIndex,
        deviceCategory: 2001, // encoding device (caméra IP)
        exceptions: [],
      },
    });

    const devices = data?.data?.list || [];
    const device = devices.find((d) => {
      const id1 = d?.deviceId;
      const id2 = d?.deviceInfo?.deviceId;
      return String(id1) === targetId || String(id2) === targetId;
    });

    if (device) {
      const recordStatus = device.deviceRecordStatus;
      const overall = recordStatus?.overallRecordStatus;

      return {
        // Doc: 0 normal, 1 abnormal, -1 not supported
        isRecording: overall === 0,
        status: overall,
        abnormalChannels: recordStatus?.channelName || [],
        raw: recordStatus || null,
      };
    }

    if (!Array.isArray(devices) || devices.length < pageSize) break;
  }

  const err = new Error('Device not found in maintenance list');
  err.status = 404;
  throw err;
}

function toOffsetString(totalMinutes) {
  const sign = totalMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(totalMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

// Returns "+01:00" / "+02:00" reliably across DST when ICU data is available.
function getOffsetForTimeZone(timeZone = 'Europe/Paris', date = new Date()) {
  try {
    // Prefer longOffset (e.g. "GMT+01:00") when supported.
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = dtf.formatToParts(date);
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value;
    const m = tzName && tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (m) {
      const sign = m[1] === '-' ? -1 : 1;
      const hours = Number(m[2] || 0);
      const minutes = Number(m[3] || 0);
      return toOffsetString(sign * (hours * 60 + minutes));
    }
  } catch {
    // ignore and fallback below
  }

  // Fallback: server local timezone offset (may be wrong if server runs in UTC)
  return toOffsetString(-date.getTimezoneOffset());
}

function getDefaultOffset() {
  const tz = process.env.HIK_TIMEZONE || 'Europe/Paris';
  return getOffsetForTimeZone(tz, new Date());
}

function ensureIsoHasTimeZone(dateTime, offset) {
  if (dateTime === null || dateTime === undefined) return dateTime;
  const s = String(dateTime).trim();
  if (!s) return s;

  // Already has timezone (Z or ±HH:MM / ±HHMM / ±HH)
  if (/[zZ]$/.test(s)) return s;
  if (/([+-]\d{2}:\d{2})$/.test(s)) return s;
  if (/([+-]\d{4})$/.test(s)) return s;
  if (/([+-]\d{2})$/.test(s)) return s;

  return s + offset;
}

async function proxypassRecord(deviceId, action) {
  const url = `/ISAPI/ContentMgmt/record/control/manual/${action}/tracks/1`;
  const payload = {
    method: 'PUT',
    url,
    id: deviceId,
    contentType: 'application/xml',
    body: '',
  };

  const data = await apiRequest('/api/hccgw/video/v1/isapi/proxypass', { body: payload });

  if (action === 'start') setManualRecordingState(deviceId, true);
  if (action === 'stop') setManualRecordingState(deviceId, false);

  return data;
}

async function proxypassRecordStatus(deviceId) {
  const url = '/ISAPI/ContentMgmt/record/status';
  const payload = {
    method: 'GET',
    url,
    id: deviceId,
    contentType: 'application/xml',
    body: '',
  };

  return apiRequest('/api/hccgw/video/v1/isapi/proxypass', { body: payload });
}

async function getRecordingStatus(deviceId, { cameraId = null, debug = false, recordingStateToken = null } = {}) {
  const parseOptions = {
    explicitArray: false,
    mergeAttrs: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
    attrNameProcessors: [xml2js.processors.stripPrefix],
  };

  const toText = (v) => {
    if (typeof v === 'string') return v;
    if (Buffer.isBuffer(v)) return v.toString('utf8');
    return null;
  };

  const isProbablyXml = (text) => {
    if (typeof text !== 'string') return false;
    const t = text.trim();
    return t.startsWith('<');
  };

  const parseBool = (value) => {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true;
      if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false;
    }
    return null;
  };

  const getFirstKeyIgnoreCase = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return null;
    const lowerMap = new Map(Object.keys(obj).map((k) => [String(k).toLowerCase(), k]));
    for (const wanted of keys) {
      const realKey = lowerMap.get(String(wanted).toLowerCase());
      if (realKey && obj[realKey] !== undefined && obj[realKey] !== null && obj[realKey] !== '') {
        return obj[realKey];
      }
    }
    return null;
  };

  const collectStringValues = (node, out, depth = 0) => {
    if (!node || depth > 10) return;
    if (typeof node === 'string') {
      const s = node.trim();
      if (s) out.push(s);
      return;
    }
    if (typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const it of node) collectStringValues(it, out, depth + 1);
      return;
    }

    for (const k of Object.keys(node)) {
      collectStringValues(node[k], out, depth + 1);
      if (out.length > 2000) return;
    }
  };

  // 1) Runtime status (en cours d'enregistrement ?)
  let runtimeIsRecording = null;
  let runtimeRaw = null;
  let runtimeNotSupported = false;
  let statusSource = null;
  let maintenance = null;
  let maintenanceError = null;
  let recentSegmentsProbe = null;

  const manual = getManualRecordingState(deviceId);
  const manualStopAgeMs = manual && manual.isRecording === false ? Date.now() - (manual.updatedAt || 0) : null;
  const manualStopFresh =
    manualStopAgeMs !== null && Number.isFinite(manualStopAgeMs) && manualStopAgeMs >= 0 && manualStopAgeMs < 10 * 60 * 1000;

  // 0) Client-provided (signed) state token: makes START/STOP instantaneous across instances.
  let tokenDecision = null;
  if (recordingStateToken) {
    const tokenPayload = verifyAndReadRecordingStateToken(recordingStateToken);
    if (tokenPayload && String(tokenPayload.deviceId) === String(deviceId)) {
      const ageMs = Date.now() - Number(tokenPayload.at || 0);
      const ageOk = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 5 * 60 * 1000;
      if (ageOk) {
        if (tokenPayload.action === 'stop') {
          runtimeIsRecording = false;
          statusSource = 'recordingStateToken-stop';
          tokenDecision = { action: 'stop', ageMs };
        } else if (tokenPayload.action === 'start') {
          runtimeIsRecording = true;
          statusSource = 'recordingStateToken-start';
          tokenDecision = { action: 'start', ageMs };
        }
      } else {
        tokenDecision = { ignored: true, reason: 'expired', ageMs };
      }
    } else {
      tokenDecision = { ignored: true, reason: 'deviceId-mismatch' };
    }
  }

  // Prefer track runtime status when available
  try {
    const trackStatusXml = await proxypassRaw({
      method: 'GET',
      url: '/ISAPI/ContentMgmt/record/tracks/101/status',
      id: deviceId,
      contentType: 'application/xml',
    });

    const trackStatusText = toText(trackStatusXml);
    if (!isProbablyXml(trackStatusText)) {
      throw new Error('tracks/101/status returned non-XML');
    }

    const trackStatusParsed = await xml2js.parseStringPromise(trackStatusText, parseOptions);
    const statusNode =
      trackStatusParsed?.TrackStatus ||
      trackStatusParsed?.trackStatus ||
      trackStatusParsed;

    runtimeRaw = statusNode;

    const respStatusString =
      statusNode?.ResponseStatus?.statusString ||
      statusNode?.ResponseStatus?.StatusString ||
      null;
    const respSubStatus =
      statusNode?.ResponseStatus?.subStatusCode ||
      statusNode?.ResponseStatus?.SubStatusCode ||
      null;
    if (
      typeof respSubStatus === 'string' &&
      respSubStatus.toLowerCase() === 'notsupport'
    ) {
      runtimeNotSupported = true;
    }
    if (
      typeof respStatusString === 'string' &&
      respStatusString.toLowerCase().includes('invalid')
    ) {
      runtimeNotSupported = true;
    }

    const recordingState = getFirstKeyIgnoreCase(statusNode, [
      'recordingStatus',
      'RecordingStatus',
      'status',
      'Status',
      'state',
      'State',
    ]);

    if (typeof recordingState === 'string') {
      const v = recordingState.trim().toLowerCase();
      if (v === 'recording') runtimeIsRecording = true;
      else if (v === 'stopped' || v === 'stop') runtimeIsRecording = false;
      // ⚠️ On Hikvision, "idle" can show up during segment rollover or when manual mode isn't active,
      // while the device is still recording (scheduled/continuous). Treat it as unknown.
      else if (v === 'idle') runtimeIsRecording = null;
    }

    if (runtimeIsRecording !== null) {
      statusSource = 'tracks/101/status';
    }
  } catch {
    // ignore and fallback below
  }

  // Always try maintenance API as a second opinion when runtime says "false" or is unknown.
  // This endpoint is often more stable across segment/file splits.
  if (runtimeIsRecording !== true) {
    try {
      maintenance = maintenance || (await getMaintenanceRecordingStatus(deviceId));
      if (maintenance && maintenance.status !== -1) {
        if (maintenance.isRecording === true) {
          runtimeIsRecording = true;
          statusSource = 'maintenance/device/detail';
        } else if (runtimeIsRecording === null) {
          runtimeIsRecording = false;
          statusSource = statusSource || 'maintenance/device/detail';
        }
      }
    } catch (e) {
      maintenanceError = e?.message || String(e);
      // ignore and fallback below
    }
  }

  // If track-status endpoint is not supported, try maintenance API (often more reliable)
  if (runtimeIsRecording === null && runtimeNotSupported) {
    try {
      maintenance = await getMaintenanceRecordingStatus(deviceId);
      // overall === -1 means not supported
      if (maintenance && maintenance.status !== -1) {
        runtimeIsRecording = !!maintenance.isRecording;
        statusSource = 'maintenance/device/detail';
      }
    } catch {
      // ignore and fallback below
    }
  }

  // Last resort: infer from recent record elements (segments) when cameraId is available.
  // Useful when ISAPI status endpoints are not supported or flaky.
  if (
    cameraId &&
    runtimeNotSupported &&
    runtimeIsRecording !== true
  ) {
    try {
      // If user explicitly stopped manual recording recently, do not let segment inference flip it back to true.
      if (manualStopFresh) {
        recentSegmentsProbe = debug
          ? {
              skipped: true,
              reason: 'manualStopFresh',
            }
          : null;
      } else {
      const now = Date.now();
      const begin = new Date(now - 5 * 60 * 1000).toISOString();
      const end = new Date(now + 60 * 1000).toISOString();

      const data = await recordElementSearch({
        cameraId,
        pageSize: 50,
        pageIndex: 1,
        filter: {
          timeType: 0,
          beginTime: begin,
          endTime: end,
          targetType: 0,
        },
      });

      const root = data?.data ?? data;
      const list = Array.isArray(root?.recordList) ? root.recordList : [];
      // Consider "recording" if any segment ended very recently (within 2 minutes)
      // or if there is an ongoing segment window that overlaps "now".
      const twoMinAgo = now - 2 * 60 * 1000;
      const isRecent = (seg) => {
        const bt = Date.parse(seg?.beginTime);
        const et = Date.parse(seg?.endTime);
        if (Number.isFinite(et) && et >= twoMinAgo) return true;
        if (Number.isFinite(bt) && Number.isFinite(et) && bt <= now && et >= now) return true;
        return false;
      };

      const inferred = list.some(isRecent);
      recentSegmentsProbe = debug
        ? {
            window: { beginTime: begin, endTime: end },
            count: list.length,
            sample: list.slice(0, 6),
            inferred,
          }
        : null;

      if (inferred) {
        runtimeIsRecording = true;
        statusSource = statusSource || 'record/element/search(recent)';
      }
      }
    } catch (e) {
      recentSegmentsProbe = debug ? { error: e?.message || String(e) } : null;
    }
  }

  try {
    const statusXml = await proxypassRaw({
      method: 'GET',
      url: '/ISAPI/ContentMgmt/record/status',
      id: deviceId,
      contentType: 'application/xml',
    });

    const statusText = toText(statusXml);
    if (!isProbablyXml(statusText)) {
      throw new Error('record/status returned non-XML');
    }

    const statusParsed = await xml2js.parseStringPromise(statusText, parseOptions);

    // Some firmwares return nested structures; scan for keywords.
    const strings = [];
    collectStringValues(statusParsed, strings);
    const joined = strings.join(' | ').toLowerCase();

    const hasRecording = joined.includes('recording');
    const hasStopped = joined.includes('stopped') || joined.includes('stop') || joined.includes('idle');

    if (hasRecording) {
      runtimeIsRecording = true;
      statusSource = statusSource || 'record/status(scan)';
    } else if (hasStopped && runtimeIsRecording !== true) {
      runtimeIsRecording = false;
      statusSource = statusSource || 'record/status(scan)';
    } else {
      // Fallback to boolean parsing on common keys
      const statusValue =
        statusParsed?.RecordingStatus?.status ??
        statusParsed?.RecordingStatus?.Status ??
        statusParsed?.status ??
        statusParsed?.Status ??
        null;

      const b = parseBool(statusValue);
      if (b === false) {
        if (runtimeIsRecording !== true) {
          runtimeIsRecording = false;
          statusSource = statusSource || 'record/status';
        }
      } else if (b === true) {
        if (!runtimeNotSupported) {
          runtimeIsRecording = true;
          statusSource = statusSource || 'record/status';
        }
      }
    }

    if (debug) {
      runtimeRaw = runtimeRaw || { recordStatusScanPreview: strings.slice(0, 60) };
    }
  } catch {
    // ignore: some devices don't expose this endpoint
  }

  // 2) Track meta (codec/résolution/etc.)
  let track = null;
  let trackInfoError = null;
  let trackInfoXmlPreview = null;

  try {
    const xmlTextRaw = await proxypassRaw({
      method: 'GET',
      url: '/ISAPI/ContentMgmt/record/tracks/101',
      id: deviceId,
      contentType: 'application/xml',
    });

    const xmlText = toText(xmlTextRaw);
    trackInfoXmlPreview = typeof xmlText === 'string' ? xmlText.slice(0, 800) : null;
    if (!isProbablyXml(xmlText)) {
      throw new Error('tracks/101 returned non-XML');
    }

    const parsed = await xml2js.parseStringPromise(xmlText, parseOptions);

  const pickFirstTrack = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] || null;
    return value;
  };

  const findTrackRecursive = (node) => {
    if (!node || typeof node !== 'object') return null;

    // Common shapes
    if (node.Track) return pickFirstTrack(node.Track);
    if (node.TrackList?.Track) return pickFirstTrack(node.TrackList.Track);

    // Heuristic: object looks like a Track node
    if (
      Object.prototype.hasOwnProperty.call(node, 'Enable') ||
      Object.prototype.hasOwnProperty.call(node, 'TrackID') ||
      Object.prototype.hasOwnProperty.call(node, 'TrackDescription')
    ) {
      return node;
    }

    for (const v of Object.values(node)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          const found = findTrackRecursive(item);
          if (found) return found;
        }
      } else if (v && typeof v === 'object') {
        const found = findTrackRecursive(v);
        if (found) return found;
      }
    }

    return null;
  };

    track =
      pickFirstTrack(parsed?.Track) ||
      pickFirstTrack(parsed?.TrackList?.Track) ||
      findTrackRecursive(parsed);

    // If we got a list, try to pick TrackID=101 when present
    if (Array.isArray(parsed?.TrackList?.Track)) {
      track = parsed.TrackList.Track.find((t) => String(t?.TrackID) === '101') || track;
    }

    if (!track) {
      throw new Error('Track info not found');
    }
  } catch (e) {
    // Best-effort: track meta is not required to answer "isRecording".
    // If HikConnect returns JSON/HTML errors, xml parsing would throw; avoid failing the whole route.
    track = null;
    trackInfoError = e?.message || String(e);
  }

  // Combine signals:
  // - If runtime is unknown, trust manual cache (but only if recent enough).
  // - If runtime says false but manual says true (and manual state is recent), prefer true.
  //   This avoids false negatives during segment rollovers.
  const MANUAL_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
  let isRecording = runtimeIsRecording;
  if (manual?.isRecording) {
    const manualAgeMs = Date.now() - (manual.updatedAt || 0);
    const manualFresh = Number.isFinite(manualAgeMs) && manualAgeMs >= 0 && manualAgeMs < MANUAL_MAX_AGE_MS;
    if (isRecording === null && manualFresh) {
      isRecording = true;
      statusSource = statusSource || 'manual';
    } else if (isRecording === false && manualFresh) {
      isRecording = true;
      statusSource = (statusSource ? `${statusSource}+manual` : 'manual');
    }
  }
  // Symmetric rule: if we have a fresh manual STOP, prefer false to avoid "always true" when
  // continuous/scheduled recording exists or segment inference keeps returning recent elements.
  if (manualStopFresh) {
    isRecording = false;
    statusSource = statusSource ? `${statusSource}+manual-stop` : 'manual-stop';
  }
  // Hard override: if a fresh STOP token is present, force false.
  if (tokenDecision?.action === 'stop') {
    isRecording = false;
    statusSource = statusSource ? `${statusSource}+token-stop` : 'token-stop';
  }
  if (isRecording === null) isRecording = false;

  statusSource = statusSource || (manual ? 'manual' : 'unknown');

  const trackId =
    track?.TrackID ??
    track?.trackID ??
    (track ? getFirstKeyIgnoreCase(track, ['TrackId', 'trackId', 'ID', 'Id', 'id', 'trackID', 'trackIDList']) : null) ??
    '101';

  return {
    trackId,
    isRecording,
    recordingTime:
      isRecording && manual?.startedAt
        ? formatElapsedMmSs(Date.now() - manual.startedAt)
        : null,
    recordingType: track?.TrackDescription || track?.Description || null,
    ...(debug && manual ? { manual } : {}),
    ...(debug && tokenDecision ? { recordingStateTokenDecision: tokenDecision } : {}),
    ...(debug && runtimeRaw ? { statusRaw: runtimeRaw } : {}),
    ...(debug && statusSource ? { statusSource } : {}),
    ...(debug && runtimeNotSupported ? { statusNotSupported: true } : {}),
    ...(debug && maintenance ? { maintenance } : {}),
    ...(debug && maintenanceError ? { maintenanceError } : {}),
    ...(debug && recentSegmentsProbe ? { recentSegmentsProbe } : {}),
    ...(debug && trackInfoError ? { trackInfoError } : {}),
    ...(debug && trackInfoXmlPreview ? { trackInfoXmlPreview } : {}),
    ...(debug && cameraId ? { cameraId } : {}),
  };
}

// ===== Record element search (JSON, stable) =====
async function recordElementSearch(body) {
  return apiRequest('/api/hccgw/video/v1/record/element/search', { body });
}

async function deleteRecordsByTimeRange(deviceId, startTime, endTime) {
  const offset = getDefaultOffset();
  const start = ensureIsoHasTimeZone(startTime, offset);
  const end = ensureIsoHasTimeZone(endTime, offset);

  const body = `<CMDeleteDescription>
    <trackID>101</trackID>
    <timeSpanList>
      <timeSpan>
        <startTime>${start}</startTime>
        <endTime>${end}</endTime>
      </timeSpan>
    </timeSpanList>
  </CMDeleteDescription>`;

  const resp = await apiRequest('/api/hccgw/video/v1/isapi/proxypass', {
    body: {
      // ISAPI often expects PUT here; DELETE is frequently reported as "Invalid Operation".
      method: 'PUT',
      url: '/ISAPI/ContentMgmt/delete',
      id: deviceId,
      contentType: 'application/xml',
      body,
    },
  });

  // OpenAPI can succeed (errorCode=0) while ISAPI still returns an error in XML.
  const maybeXml = resp?.data;
  if (typeof maybeXml === 'string' && maybeXml.includes('<ResponseStatus')) {
    const parseOptions = {
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix],
      attrNameProcessors: [xml2js.processors.stripPrefix],
    };

    let parsed;
    try {
      parsed = await xml2js.parseStringPromise(maybeXml, parseOptions);
    } catch {
      // If we can't parse, return raw response.
      return resp;
    }

    const rs = parsed?.ResponseStatus || parsed;
    const statusCode = String(rs?.statusCode ?? '').trim();
    const statusString = String(rs?.statusString ?? '').trim();
    const subStatusCode = String(rs?.subStatusCode ?? '').trim();

    // On many Hikvision ISAPI endpoints: statusCode 1 => OK.
    const ok = statusCode === '1' || statusString.toLowerCase() === 'ok';
    if (!ok) {
      const err = new Error(statusString || 'ISAPI delete failed');
      err.status = subStatusCode.toLowerCase() === 'notsupport' ? 501 : 502;
      err.details = {
        statusCode: rs?.statusCode,
        statusString: rs?.statusString,
        subStatusCode: rs?.subStatusCode,
        requestURL: rs?.requestURL,
        raw: maybeXml,
      };
      throw err;
    }
  }

  return resp;
}

async function getLastRecordElement(cameraId, offset = getDefaultOffset()) {
  const beginTime = '2000-01-01T00:00:00' + offset;
  const endTime = '2099-12-31T23:59:59' + offset;

  let pageIndex = 1;
  const pageSize = 200;

  let all = [];

  while (true) {
    const reqBody = {
      cameraId,
      pageSize,
      pageIndex,
      filter: {
        timeType: 0,
        beginTime,
        endTime,
        targetType: 0,
      },
    };

    const data = await recordElementSearch(reqBody);
    const root = data?.data ?? data;

    const list = root?.recordList || [];

    if (!Array.isArray(list) || list.length === 0) break;

    all.push(...list);

    if (list.length < pageSize) break; // dernière page

    pageIndex++;
  }

  if (all.length === 0) {
    throw new Error('No record elements found');
  }

  all.sort((a, b) => String(a.endTime).localeCompare(String(b.endTime)));

  return all[all.length - 1];
}

module.exports = {
  proxypassRecord,
  proxypassRecordStatus,
  getRecordingStatus,
  signRecordingStateToken,
  getManualRecordingState,
  setManualRecordingState,
  getMaintenanceRecordingStatus,
  recordElementSearch,
  deleteRecordsByTimeRange,
  getLastRecordElement,
  getOffsetForTimeZone,
  getDefaultOffset,
};
