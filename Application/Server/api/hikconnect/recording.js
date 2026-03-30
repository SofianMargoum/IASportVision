const { apiRequest } = require('./client');

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

async function proxypassRecord(deviceId, action) {
  const url = `/ISAPI/ContentMgmt/record/control/manual/${action}/tracks/1`;
  const payload = {
    method: 'PUT',
    url,
    id: deviceId,
    contentType: 'application/xml',
    body: '',
  };

  return apiRequest('/api/hccgw/video/v1/isapi/proxypass', { body: payload });
}

// ===== Record element search (JSON, stable) =====
async function recordElementSearch(body) {
  return apiRequest('/api/hccgw/video/v1/record/element/search', { body });
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
  recordElementSearch,
  getLastRecordElement,
  getOffsetForTimeZone,
  getDefaultOffset,
};
