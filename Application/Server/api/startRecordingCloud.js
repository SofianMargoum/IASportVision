// api/startRecordingCloud.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// ⚠️ Définis ces variables dans ton .env (ne jamais les mettre en dur)
const HCC_HOST = process.env.HCC_HOST;   // ex: "https://ieu.hikcentralconnect.com"
const HCC_USER = process.env.HCC_USER;   // compte OpenAPI
const HCC_PASS = process.env.HCC_PASS;   // mot de passe OpenAPI

// Fonction pour obtenir un token
async function getToken() {
  const resp = await fetch(`${HCC_HOST}/api/hccgw/platform/v1/token/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: HCC_USER, password: HCC_PASS })
  });
  if (!resp.ok) throw new Error(`Token request failed: ${resp.status}`);
  const data = await resp.json();
  return data?.data?.token || data?.data?.accessToken || data.data;
}

// Fonction pour appeler proxypass
async function proxypass(deviceId, action) {
  const token = await getToken();

  // URL ISAPI cible
  const url = `/ISAPI/ContentMgmt/record/control/manual/${action}/tracks/1`;

  const payload = {
    method: 'PUT',
    url,
    id: deviceId,
    contentType: 'application/xml',
    body: '' // vide, suffisant pour start/stop
  };

  const resp = await fetch(`${HCC_HOST}/api/hccgw/video/v1/isapi/proxypass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Token': token
    },
    body: JSON.stringify(payload)
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Proxypass failed ${resp.status}: ${text}`);
  }
  return JSON.parse(text);
}

// Route API — Start recording via cloud
router.put('/start-recording-cloud', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  try {
    const result = await proxypass(deviceId, 'start');
    res.status(200).json(result);
  } catch (err) {
    console.error('Cloud start-recording error:', err.message);
    res.status(500).json({ message: 'Failed to start recording (cloud)', error: err.message });
  }
});

// Route API — Stop recording via cloud
router.put('/stop-recording-cloud', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  try {
    const result = await proxypass(deviceId, 'stop');
    res.status(200).json(result);
  } catch (err) {
    console.error('Cloud stop-recording error:', err.message);
    res.status(500).json({ message: 'Failed to stop recording (cloud)', error: err.message });
  }
});

module.exports = router;
