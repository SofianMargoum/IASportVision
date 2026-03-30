const express = require('express');

const { proxypassRecord, recordElementSearch } = require('../recording');

const router = express.Router();

// Start recording via proxypass
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

// Stop recording via proxypass
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

// ✅ Record element search (JSON)
router.post('/hikconnect/record/element/search', async (req, res) => {
  try {
    const data = await recordElementSearch(req.body || {});
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

module.exports = router;
