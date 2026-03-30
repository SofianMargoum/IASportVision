const express = require('express');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

const { bucket } = require('../gcs');
const {
  saveVideo,
  getDownloadUrl,
  waitForDownloadUrl,
} = require('../video');
const { getLastRecordElement, getDefaultOffset } = require('../recording');

const router = express.Router();

// Save video (manual begin/end)
router.post('/hikconnect/video/save', async (req, res) => {
  const { cameraId, beginTime, endTime, voiceSwitch } = req.body || {};
  if (!cameraId || !beginTime || !endTime) {
    return res.status(400).json({ message: 'Missing cameraId, beginTime or endTime' });
  }
  try {
    const data = await saveVideo({ cameraId, beginTime, endTime, voiceSwitch });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Download URL status
router.post('/hikconnect/video/download-url', async (req, res) => {
  const { taskId } = req.body || {};
  if (!taskId) return res.status(400).json({ message: 'Missing taskId' });
  try {
    const data = await getDownloadUrl({ taskId });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// Save video then upload to GCS (cloud save/download path)
router.post('/hikconnect/video/save-and-upload', async (req, res) => {
  const { cameraId, beginTime, endTime, directory, filename, voiceSwitch } = req.body || {};
  if (!cameraId || !beginTime || !endTime || !directory || !filename) {
    return res.status(400).json({ message: 'Missing cameraId, beginTime, endTime, directory or filename' });
  }

  try {
    const saveResp = await saveVideo({ cameraId, beginTime, endTime, voiceSwitch });
    const taskId = saveResp?.data?.taskId;
    if (!taskId) {
      return res.status(502).json({ message: 'taskId missing from save response', details: saveResp });
    }

    const downloadUrl = await waitForDownloadUrl(taskId);
    const safeFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
    const localFilePath = path.join('/tmp', safeFilename);

    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ message: 'Failed to download from HikConnect', details: text });
    }

    await pipeline(resp.body, fs.createWriteStream(localFilePath));

    const gcsFilePath = path.join(directory, safeFilename);
    await bucket.upload(localFilePath, {
      destination: gcsFilePath,
      contentType: 'video/mp4',
    });

    fs.unlinkSync(localFilePath);

    res.status(200).json({
      status: 'success',
      message: `File uploaded to ${gcsFilePath} in GCS`,
      taskId,
      downloadUrl,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

// ✅ Save last segment from device/camera (JSON search -> save -> poll url)
// Note: deviceId is currently only echoed back; keep it if your frontend expects it.
router.post('/hikconnect/video/save-last-from-device', async (req, res) => {
  const { deviceId, cameraId, voiceSwitch, offset, beginTime, endTime } = req.body || {};
  if (!deviceId || !cameraId) {
    return res.status(400).json({ message: 'Missing deviceId or cameraId' });
  }

  try {
    const tz = typeof offset === 'string' && offset ? offset : getDefaultOffset();

    let bt = beginTime;
    let et = endTime;
    let picked = null;

    if (!bt || !et) {
      const last = await getLastRecordElement(cameraId, tz);
      bt = last.beginTime;
      et = last.endTime;
      picked = last.raw;
    }

    const saveResp = await saveVideo({
      cameraId,
      beginTime: bt,
      endTime: et,
      voiceSwitch: voiceSwitch ?? 2,
    });

    const taskId = saveResp?.data?.taskId;
    if (!taskId) {
      return res.status(502).json({ message: 'taskId missing from save response', details: saveResp });
    }

    const url = await waitForDownloadUrl(taskId);

    return res.status(200).json({
      errorCode: '0',
      data: {
        url,
        taskId,
        deviceId,
        cameraId,
        beginTime: bt,
        endTime: et,
        picked,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

module.exports = router;
