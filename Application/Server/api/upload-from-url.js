// ./api/upload-from-url.js
try {
  require('dotenv').config();
} catch {}

const express = require('express');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream'); // ✅ important

const router = express.Router();

// GCS
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

const MAX_BYTES = Number(process.env.UPLOAD_FROM_URL_MAX_BYTES || 1024 * 1024 * 1024); // 1GB

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function safeJoinGcsPath(directory, filename) {
  const cleanDir = String(directory || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const cleanName = String(filename || '').replace(/\\/g, '/').split('/').pop();
  return cleanDir ? `${cleanDir}/${cleanName}` : cleanName;
}

function guessContentTypeFromFilename(filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}

function redactUrl(u) {
  if (!u) return u;
  const s = String(u);
  const i = s.indexOf('?');
  return i === -1 ? s : `${s.slice(0, i)}?<redacted>`;
}

// (Optionnel) ping pour valider rapidement que la route est montée
router.get('/upload-from-url', (req, res) => res.json({ ok: true }));

router.post('/upload-from-url', async (req, res) => {
  const { sourceUrl, directory, filename, contentType } = req.body || {};
  const traceId = crypto.randomBytes(6).toString('hex');

  if (!isNonEmptyString(sourceUrl) || !isNonEmptyString(directory) || !isNonEmptyString(filename)) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing sourceUrl, directory or filename',
    });
  }

  if (!/^https:\/\//i.test(sourceUrl.trim())) {
    return res.status(400).json({
      status: 'error',
      message: 'sourceUrl must be https://',
    });
  }

  const finalContentType = isNonEmptyString(contentType)
    ? contentType.trim()
    : guessContentTypeFromFilename(filename);

  const gcsPath = safeJoinGcsPath(directory, filename);

  console.log(`[upload-from-url:${traceId}] request`, {
    directory,
    filename,
    gcsPath,
    contentType: finalContentType,
    sourceUrl: redactUrl(sourceUrl),
  });

  try {
    const upstream = await fetch(sourceUrl, { redirect: 'follow' });

    console.log(`[upload-from-url:${traceId}] upstream status`, upstream.status);

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error(`[upload-from-url:${traceId}] upstream error (truncated)`, text.slice(0, 400));
      return res.status(upstream.status).json({
        status: 'error',
        message: 'Failed to download video from sourceUrl',
        details: text.slice(0, 2000),
      });
    }

    const lenHeader = upstream.headers.get('content-length');
    const contentLength = lenHeader ? Number(lenHeader) : null;
    const upstreamType = upstream.headers.get('content-type');

    console.log(`[upload-from-url:${traceId}] upstream headers`, {
      contentLength,
      upstreamType,
    });

    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
      return res.status(413).json({
        status: 'error',
        message: `File too large (${contentLength} bytes). Max is ${MAX_BYTES}.`,
      });
    }

    if (!upstream.body) {
      return res.status(502).json({
        status: 'error',
        message: 'Upstream returned no body stream',
      });
    }

    // ✅ Convert Web ReadableStream -> Node.js Readable
    // Node 18+: upstream.body est un Web ReadableStream
    // Readable.fromWeb() le transforme en stream Node compatible pipe()
    const nodeReadable =
      typeof upstream.body.getReader === 'function'
        ? Readable.fromWeb(upstream.body)
        : upstream.body;

    const file = bucket.file(gcsPath);
    const gcsWriteStream = file.createWriteStream({
      resumable: false,
      contentType: finalContentType,
      metadata: { cacheControl: 'public, max-age=3600' },
    });

    let responded = false;

    const fail = (status, payload) => {
      if (responded) return;
      responded = true;
      return res.status(status).json(payload);
    };

    nodeReadable.on('error', (err) => {
      console.error(`[upload-from-url:${traceId}] upstream stream error`, err);
      fail(502, { status: 'error', message: 'Upstream stream error', details: err.message });
    });

    gcsWriteStream.on('error', (err) => {
      console.error(`[upload-from-url:${traceId}] GCS write error`, err);
      fail(500, { status: 'error', message: 'Failed to upload to GCS', details: err.message });
    });

    gcsWriteStream.on('finish', () => {
      console.log(`[upload-from-url:${traceId}] upload complete`, { bucket: bucketName, gcsPath });

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(
        directory
      )}/${encodeURIComponent(path.basename(filename))}`;

      if (responded) return;
      responded = true;

      return res.status(200).json({
        status: 'success',
        bucket: bucketName,
        gcsPath,
        publicUrl,
        upstreamType,
        contentLength,
      });
    });

    // ✅ Pipe Node stream vers GCS
    nodeReadable.pipe(gcsWriteStream);
  } catch (err) {
    console.error(`[upload-from-url:${traceId}] unexpected error`, err);
    return res.status(500).json({
      status: 'error',
      message: 'Unexpected server error',
      details: err.message,
    });
  }
});

module.exports = router;
