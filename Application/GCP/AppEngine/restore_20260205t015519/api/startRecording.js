// api/startRecording.js
const express = require('express');
const router = express.Router();
const xml2js = require('xml2js');

router.put('/start-recording', async (req, res) => {
  const { username, password, ipAddress, port } = req.body;
  if (!username || !password || !ipAddress || !port) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  try {
    const { default: DigestFetch } = await import('digest-fetch');
    const client = new DigestFetch(username, password, { algorithm: 'MD5' }); // par défaut

    const url = `http://${ipAddress}:${port}/ISAPI/ContentMgmt/record/control/manual/start/tracks/1`;

    // XML minimal souvent requis par ISAPI
    const xmlBody =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<ManualRecord xmlns="http://www.isapi.org/ver20/XMLSchema">` +
      `<enabled>true</enabled></ManualRecord>`;

    const response = await client.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
      body: xmlBody,
      // timeout raisonnable (si tu utilises node-fetch v3 via digest-fetch)
      // signal: AbortController...
    });

    const text = await response.text();
    if (!response.ok) {
      // utile pour savoir si le device répond 401/403/4xx
      return res.status(response.status).send(text || 'device error');
    }

    xml2js.parseString(text, (err, result) => {
      if (err) return res.status(502).json({ message: 'Failed to parse XML', raw: text });
      res.status(200).json(result);
    });
  } catch (error) {
    console.error('start-recording fetch error', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      cause: error?.cause
    });
    res.status(500).json({ message: 'Failed to start recording', error: error.message });
  }
});

module.exports = router;
