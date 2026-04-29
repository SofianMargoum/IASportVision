const express = require('express');
const dns = require('node:dns').promises;
const net = require('node:net');
const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');

const router = express.Router();
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

const COVER_URL = 'https://storage.googleapis.com/ia-sport.appspot.com/images/cover.png';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per logo/cover
const FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_CONTENT_TYPES = /^(image\/(png|jpe?g|webp|gif|svg\+xml)|application\/octet-stream)$/i;

// ── Anti-SSRF helpers ────────────────────────────────────────────────
function isPrivateIp(ip) {
  if (!ip) return true;
  const v = String(ip).toLowerCase();
  if (net.isIPv4(v)) {
    if (v === '0.0.0.0') return true;
    if (v.startsWith('10.')) return true;
    if (v.startsWith('127.')) return true;
    if (v.startsWith('169.254.')) return true; // link-local + GCP metadata
    if (v.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
    if (v.startsWith('100.64.')) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(v)) {
    if (v === '::' || v === '::1') return true;
    if (v.startsWith('fc') || v.startsWith('fd')) return true; // ULA
    if (v.startsWith('fe80:')) return true; // link-local
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7)); // IPv4-mapped
    return false;
  }
  return true;
}

async function assertSafePublicUrl(url, fieldName) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    throw Object.assign(new Error(`${fieldName}: invalid URL`), { status: 400 });
  }
  if (parsed.protocol !== 'https:') {
    throw Object.assign(new Error(`${fieldName}: only https:// is allowed`), { status: 400 });
  }
  if (net.isIP(parsed.hostname)) {
    throw Object.assign(new Error(`${fieldName}: IP literals are not allowed`), { status: 400 });
  }
  if (parsed.username || parsed.password) {
    throw Object.assign(new Error(`${fieldName}: credentials in URL are not allowed`), { status: 400 });
  }
  if (parsed.port && parsed.port !== '443') {
    throw Object.assign(new Error(`${fieldName}: only port 443 is allowed`), { status: 400 });
  }
  let addrs;
  try {
    addrs = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw Object.assign(new Error(`${fieldName}: DNS resolution failed`), { status: 400 });
  }
  if (!addrs || addrs.length === 0) {
    throw Object.assign(new Error(`${fieldName}: DNS resolution failed`), { status: 400 });
  }
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw Object.assign(new Error(`${fieldName}: resolves to a private IP`), { status: 400 });
    }
  }
}

function sanitizeFolderSegment(seg) {
  return String(seg || '')
    .replace(/\/+$/, '')
    .replace(/\.\./g, '_')
    .replace(/[\\]/g, '_');
}

const generateFileName = (baseName, extension) => `${baseName}-${Date.now()}.${extension}`;

async function fetchImageBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: FETCH_TIMEOUT_MS,
    maxRedirects: 0, // any redirect bypasses our DNS check on the final host
    maxContentLength: MAX_IMAGE_BYTES,
    maxBodyLength: MAX_IMAGE_BYTES,
    validateStatus: (s) => s >= 200 && s < 300,
  });
  const ct = String(response.headers?.['content-type'] || '').split(';')[0].trim();
  if (ct && !ALLOWED_CONTENT_TYPES.test(ct)) {
    throw Object.assign(new Error(`Unexpected content-type: ${ct}`), { status: 400 });
  }
  const buf = Buffer.from(response.data);
  if (buf.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('Image too large'), { status: 400 });
  }
  return buf;
}

async function uploadBufferToTmp(buffer, fileName, tmpPath, contentType = 'image/png') {
  const file = bucket.file(`${tmpPath}/${fileName}`);
  await file.save(buffer, { contentType });
  return fileName;
}

async function loadImageFromGCS(fileName, tmpPath) {
  const file = bucket.file(`${tmpPath}/${fileName}`);
  const [fileBuffer] = await file.download();
  return await loadImage(fileBuffer);
}

async function deleteTmpFolder(tmpPath) {
  const [files] = await bucket.getFiles({ prefix: `${tmpPath}/` });
  await Promise.allSettled(files.map((file) => file.delete({ ignoreNotFound: true })));
}

/**
 * Compose cover + 2 club logos and upload the resulting PNG to GCS.
 * Returns { publicUrl, gcsPath, fileName }.
 * Throws { status, message } on validation/fetch errors.
 */
async function runMergeImages({ logo1Url, logo2Url, finalFolder, finalName }) {
  if (!logo1Url || !logo2Url || !finalFolder) {
    throw Object.assign(new Error("Parameters 'logo1Url', 'logo2Url', and 'finalFolder' are required."), { status: 400 });
  }

  await assertSafePublicUrl(logo1Url, 'logo1Url');
  await assertSafePublicUrl(logo2Url, 'logo2Url');

  const folderClean = sanitizeFolderSegment(finalFolder);
  if (!folderClean) {
    throw Object.assign(new Error('finalFolder is empty after sanitization'), { status: 400 });
  }
  const tmpFolder = `${folderClean}/tmp`;

  const coverFileName = generateFileName('cover', 'png');
  const logo1FileName = generateFileName('logo1', 'jpg');
  const logo2FileName = generateFileName('logo2', 'jpg');
  const roundedLogo1FileName = generateFileName('rounded-logo1', 'png');
  const roundedLogo2FileName = generateFileName('rounded-logo2', 'png');
  const finalFileName = finalName || generateFileName('final-image', 'png');

  try {
    const [coverBuf, logo1Buf, logo2Buf] = await Promise.all([
      fetchImageBuffer(COVER_URL),
      fetchImageBuffer(logo1Url),
      fetchImageBuffer(logo2Url),
    ]);

    await Promise.all([
      uploadBufferToTmp(coverBuf, coverFileName, tmpFolder, 'image/png'),
      uploadBufferToTmp(logo1Buf, logo1FileName, tmpFolder, 'image/jpeg'),
      uploadBufferToTmp(logo2Buf, logo2FileName, tmpFolder, 'image/jpeg'),
    ]);

    const coverImage = await loadImageFromGCS(coverFileName, tmpFolder);
    const logo1Image = await loadImageFromGCS(logo1FileName, tmpFolder);
    const logo2Image = await loadImageFromGCS(logo2FileName, tmpFolder);

    const logoSize = 150;
    const makeRoundedImage = (image) => {
      const c = createCanvas(logoSize, logoSize);
      const ctx = c.getContext('2d');
      ctx.beginPath();
      ctx.arc(logoSize / 2, logoSize / 2, logoSize / 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(image, 0, 0, logoSize, logoSize);
      return c;
    };

    const roundedLogo1 = makeRoundedImage(logo1Image);
    const roundedLogo2 = makeRoundedImage(logo2Image);

    await Promise.all([
      bucket.file(`${tmpFolder}/${roundedLogo1FileName}`).save(roundedLogo1.toBuffer('image/png'), { contentType: 'image/png' }),
      bucket.file(`${tmpFolder}/${roundedLogo2FileName}`).save(roundedLogo2.toBuffer('image/png'), { contentType: 'image/png' }),
    ]);

    const coverWidth = coverImage.width;
    const coverHeight = coverImage.height;
    const canvas = createCanvas(coverWidth, coverHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(coverImage, 0, 0, coverWidth, coverHeight);
    ctx.drawImage(roundedLogo1, coverWidth / 2 - 175, coverHeight / 2 - 200);
    ctx.drawImage(roundedLogo2, coverWidth / 2 + 50, coverHeight / 2 - 200);

    const buffer = canvas.toBuffer('image/png');
    const gcsPath = `${folderClean}/${finalFileName}`;
    await bucket.file(gcsPath).save(buffer, { contentType: 'image/png', public: true });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
    return { publicUrl, gcsPath, fileName: finalFileName };
  } finally {
    deleteTmpFolder(tmpFolder).catch(() => {});
  }
}

// HTTP route — kept as a fallback. The main path is now backend-triggered
// from the rolling/finalize handler.
router.get('/mergeImages', async (req, res) => {
  try {
    const { logo1Url, logo2Url, finalFolder, finalName } = req.query;
    const out = await runMergeImages({ logo1Url, logo2Url, finalFolder, finalName });
    return res.status(200).json({
      status: 'success',
      message: 'Image traitée et uploadée avec succès',
      url: out.publicUrl,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: status >= 500 ? 'Erreur lors du traitement des images.' : error.message,
    });
  }
});

router.runMergeImages = runMergeImages;
module.exports = router;
