const crypto = require('crypto');

const { bucket } = require('./gcs');

const LOG_OBJECT_NAME = 'log-recording.txt';
const MAX_BYTES = 400_000; // keep log reasonably small
const RETRIES = 4;

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

function clipToMaxBytes(text, maxBytes) {
  if (!text) return '';
  const buf = Buffer.from(String(text), 'utf8');
  if (buf.length <= maxBytes) return String(text);
  // Keep the tail
  const tail = buf.subarray(buf.length - maxBytes);
  return tail.toString('utf8');
}

async function downloadIfExists(file) {
  try {
    const [content] = await file.download();
    return content.toString('utf8');
  } catch (e) {
    // Not found
    if (e && (e.code === 404 || e.code === 412)) return '';
    if (String(e?.message || '').toLowerCase().includes('no such object')) return '';
    throw e;
  }
}

async function getGeneration(file) {
  try {
    const [meta] = await file.getMetadata();
    return meta?.generation ? String(meta.generation) : null;
  } catch (e) {
    if (e && e.code === 404) return null;
    return null;
  }
}

async function appendToGcsObject({ objectName = LOG_OBJECT_NAME, line }) {
  const file = bucket.file(objectName);
  const entry = String(line || '');

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const generation = await getGeneration(file);
    const existing = await downloadIfExists(file);

    const base = clipToMaxBytes(existing, Math.max(0, MAX_BYTES - Buffer.byteLength(entry, 'utf8') - 2));
    const next = (base ? base.trimEnd() + '\n' : '') + entry + '\n';

    try {
      const preconditionOpts = generation ? { ifGenerationMatch: generation } : { ifGenerationMatch: 0 };
      await file.save(next, {
        contentType: 'text/plain; charset=utf-8',
        resumable: false,
        preconditionOpts,
      });
      return;
    } catch (e) {
      // Precondition failed due to concurrent writes: retry
      if (e && (e.code === 412 || String(e?.message || '').includes('conditionNotMet'))) {
        continue;
      }
      // Best-effort: if we are not able to enforce precondition, fallback to overwrite once
      if (attempt === RETRIES) {
        await file.save(next, {
          contentType: 'text/plain; charset=utf-8',
          resumable: false,
        });
        return;
      }
      throw e;
    }
  }
}

async function logRecording(event, details) {
  const line = `${nowIso()}\t${event}\t${safeJson(details)}\t${crypto.randomBytes(3).toString('hex')}`;
  try {
    await appendToGcsObject({ line });
  } catch (e) {
    // Never fail the API because logging failed.
    // eslint-disable-next-line no-console
    console.error('[recordingGcsLog] GCS write failed, event:', event, 'error:', e?.message, 'line:', line);
  }
}

function ensureSofianPrefix(message) {
  const m = String(message || '').trim();
  if (!m) return '[Sofian]';
  return m.startsWith('[Sofian]') ? m : `[Sofian] ${m}`;
}

async function logSofian(message, details) {
  const payload = {
    message: ensureSofianPrefix(message),
    ...(details && typeof details === 'object' && !Array.isArray(details) ? details : {}),
  };
  await logRecording('SOFIAN', payload);
}

module.exports = {
  LOG_OBJECT_NAME,
  logRecording,
  logSofian,
};
