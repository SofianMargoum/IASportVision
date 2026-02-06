const express = require('express');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { pipeline } = require('stream/promises');

const router = express.Router();

const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const buildSearchXml = () => `
  <CMSearchDescription>
    <searchID>1</searchID>
    <trackIDList>
      <trackID>101</trackID>
    </trackIDList>
    <maxResults>-1</maxResults>
  </CMSearchDescription>`;

router.post('/isapi/download-last-recording', async (req, res) => {
  const { ipAddress, port = 80, username, password, directory, filename } = req.body || {};

  if (!ipAddress || !username || !password || !directory || !filename) {
    return res.status(400).json({
      message: 'Missing required parameters: ipAddress, username, password, directory, filename'
    });
  }

  try {
    const { default: DigestFetch } = await import('digest-fetch');
    const client = new DigestFetch(username, password);

    // 1) Search last recording
    const searchUrl = `http://${ipAddress}:${port}/ISAPI/ContentMgmt/search`;
    const searchResp = await client.fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: buildSearchXml(),
    });

    if (!searchResp.ok) {
      const text = await searchResp.text();
      return res.status(searchResp.status).json({ message: 'Search failed', details: text });
    }

    const rawXml = await searchResp.text();
    const parsed = await xml2js.parseStringPromise(rawXml, { explicitArray: false, mergeAttrs: true });
    const matchList = parsed?.CMSearchResult?.matchList?.searchMatchItem;

    if (!matchList || (Array.isArray(matchList) && matchList.length === 0)) {
      return res.status(404).json({ message: 'No recordings found' });
    }

    const lastMatch = Array.isArray(matchList) ? matchList[matchList.length - 1] : matchList;
    const playbackURI = lastMatch?.mediaSegmentDescriptor?.playbackURI;

    if (!playbackURI) {
      return res.status(404).json({ message: 'playbackURI not found in search response' });
    }

    // 2) Download via ISAPI
    const downloadUrl = `http://${ipAddress}:${port}/ISAPI/ContentMgmt/download`;
    const downloadXml = `
      <downloadRequest version="1.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
        <playbackURI>${escapeXml(playbackURI)}</playbackURI>
      </downloadRequest>`;

    const downloadResp = await client.fetch(downloadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: downloadXml,
    });

    if (!downloadResp.ok) {
      const text = await downloadResp.text();
      return res.status(downloadResp.status).json({ message: 'Download failed', details: text });
    }

    const safeFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
    const localFilePath = path.join('/tmp', safeFilename);

    await pipeline(downloadResp.body, fs.createWriteStream(localFilePath));

    // 3) Upload to GCS
    const gcsFilePath = path.join(directory, safeFilename);
    await bucket.upload(localFilePath, {
      destination: gcsFilePath,
      contentType: 'video/mp4',
    });

    fs.unlinkSync(localFilePath);

    return res.status(200).json({
      status: 'success',
      message: `File uploaded to ${gcsFilePath} in GCS`,
      playbackURI,
    });
  } catch (error) {
    console.error('Download/upload error:', error);
    return res.status(500).json({ message: 'Failed to download/upload', error: error.message });
  }
});

module.exports = router;
