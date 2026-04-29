const express = require('express');

const { listDevices, listCameras, getSystemProperties } = require('../resources');

const router = express.Router();

// Devices
router.get('/hikconnect/devices', async (req, res) => {
  try {
    const pageIndex = Number(req.query.pageIndex || 1);
    const pageSize = Number(req.query.pageSize || 50);
    const data = await listDevices({ pageIndex, pageSize });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: 'Failed to list devices' });
  }
});

// Cameras
router.get('/hikconnect/cameras', async (req, res) => {
  try {
    const pageIndex = Number(req.query.pageIndex || 1);
    const pageSize = Number(req.query.pageSize || 50);
    const data = await listCameras({ pageIndex, pageSize, filter: {} });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: 'Failed to list cameras' });
  }
});

// System properties
router.get('/hikconnect/system-properties', async (req, res) => {
  try {
    const data = await getSystemProperties();
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: 'Failed to get system properties' });
  }
});

module.exports = router;
