// Legacy (non-rolling) HikConnect video routes:
//   POST /hikconnect/video/save
//   POST /hikconnect/video/download-url
//   POST /hikconnect/video/save-and-upload
//   POST /hikconnect/video/save-last-from-device

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const express = require('express');

const { bucket } = require('../../gcs');
const {
  saveVideoWithRetry,
  getDownloadUrl,
  waitForDownloadUrl,
} = require('../../video');
const { getLastRecordElement, getDefaultOffset } = require('../../recording');
const { concatMp4Files } = require('../../concatMp4');

const {
  normalizeVoiceSwitch,
  validateIsoWindow,
  computeDownloadTimeoutMs,
  downloadToFile,
  uploadMergedToGcs,
  listRecordElementsInWindow,
} = require('./utils');

const router = express.Router();

// Save video (manual begin/end)
router.post('/hikconnect/video/save', async (req, res) => {
  const { cameraId, beginTime, endTime, voiceSwitch } = req.body || {};
  if (!cameraId || !beginTime || !endTime) {
    return res.status(400).json({ message: 'Missing cameraId, beginTime or endTime' });
  }
  try {
    const data = await saveVideoWithRetry(
      { cameraId, beginTime, endTime, voiceSwitch },
      { maxAttempts: 6, baseDelayMs: 1500 }
    );
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
    return res
      .status(400)
      .json({ message: 'Missing cameraId, beginTime, endTime, directory or filename' });
  }

  try {
    const saveResp = await saveVideoWithRetry(
      { cameraId, beginTime, endTime, voiceSwitch },
      { maxAttempts: 6, baseDelayMs: 1500 }
    );
    const taskId = saveResp?.data?.taskId;
    if (!taskId) {
      return res
        .status(502)
        .json({ message: 'taskId missing from save response' });
    }

    const downloadUrl = await waitForDownloadUrl(
      taskId,
      computeDownloadTimeoutMs(beginTime, endTime, { minMs: 180000, maxMs: 900000 }),
      3000
    );
    const safeFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
    const localFilePath = path.join('/tmp', safeFilename);

    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      const text = await resp.text();
      return res
        .status(resp.status)
        .json({ message: 'Failed to download from HikConnect', details: text });
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

// Save last segment from device/camera (JSON search -> save -> poll url)
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

    const windowErr = validateIsoWindow(bt, et);
    if (windowErr) {
      return res
        .status(400)
        .json({ message: windowErr, details: { beginTime: bt, endTime: et } });
    }

    if (!bt || !et) {
      const last = await getLastRecordElement(cameraId, tz);
      bt = last.beginTime;
      et = last.endTime;
      picked = last.raw;
    }

    const requestedVoiceSwitch = normalizeVoiceSwitch(voiceSwitch);

    let saveResp;
    try {
      // If begin/end come from client clock, they can be slightly off. Use a short retry
      // then fallback to the camera's own record element times.
      const maxAttempts = beginTime && endTime ? 3 : 8;

      saveResp = await saveVideoWithRetry(
        {
          cameraId,
          beginTime: bt,
          endTime: et,
          voiceSwitch: requestedVoiceSwitch,
        },
        { maxAttempts, baseDelayMs: 1500 }
      );
    } catch (err) {
      const code = err?.details?.errorCode;
      const isOpen000009 =
        code === 'OPEN000009' || String(err?.message || '').includes('OPEN000009');

      // Fallback: use the latest record element times from HikConnect.
      if (isOpen000009 && beginTime && endTime) {
        try {
          const last = await getLastRecordElement(cameraId, tz);
          picked = last.raw;
          bt = last.beginTime;
          et = last.endTime;

          const fallbackVoiceSwitch = requestedVoiceSwitch === 0 ? 2 : requestedVoiceSwitch;

          saveResp = await saveVideoWithRetry(
            {
              cameraId,
              beginTime: bt,
              endTime: et,
              voiceSwitch: fallbackVoiceSwitch,
            },
            { maxAttempts: 8, baseDelayMs: 1500 }
          );
        } catch (fallbackErr) {
          const enriched = {
            original: {
              status: err?.status,
              message: err?.message,
              details: err?.details,
              beginTime,
              endTime,
              voiceSwitch: requestedVoiceSwitch,
            },
            fallback: {
              status: fallbackErr?.status,
              message: fallbackErr?.message,
              details: fallbackErr?.details,
              beginTime: bt,
              endTime: et,
              voiceSwitch: requestedVoiceSwitch === 0 ? 2 : requestedVoiceSwitch,
              picked,
            },
            hint:
              'OPEN000009 often means the segment is not indexed yet or the requested begin/end do not match actual camera recordings. The backend tried the provided window then the latest record element window.',
          };

          return res
            .status(fallbackErr?.status || 500)
            .json({ message: 'Save video failed (OPEN000009 fallback also failed)' });
        }
      }

      throw err;
    }

    const taskId = saveResp?.data?.taskId;
    if (!taskId) {
      return res
        .status(502)
        .json({ message: 'taskId missing from save response' });
    }

    // If the requested window spans multiple segments, export all segments and merge them.
    let segments = [];
    if (beginTime && endTime) {
      try {
        segments = await listRecordElementsInWindow(cameraId, beginTime, endTime);
      } catch {
        segments = [];
      }
    }

    // Default: single URL.
    if (!Array.isArray(segments) || segments.length <= 1) {
      const url = await waitForDownloadUrl(
        taskId,
        computeDownloadTimeoutMs(bt, et, { minMs: 180000, maxMs: 900000 }),
        3000
      );
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
          segments: Array.isArray(segments) && segments.length === 1 ? segments : undefined,
        },
      });
    }

    // Multi-segment: export each segment then concat MP4s.
    const tmpDir = path.join(
      os.tmpdir(),
      `hikconnect_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    );
    fs.mkdirSync(tmpDir, { recursive: true });

    const localParts = [];
    const segmentMeta = [];
    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segBegin = seg?.beginTime;
        const segEnd = seg?.endTime;
        const vs = requestedVoiceSwitch === 0 ? 2 : requestedVoiceSwitch;

        const save = await saveVideoWithRetry(
          { cameraId, beginTime: segBegin, endTime: segEnd, voiceSwitch: vs },
          { maxAttempts: 8, baseDelayMs: 1500 }
        );

        const segTaskId = save?.data?.taskId;
        if (!segTaskId) {
          const e = new Error('taskId missing from save response (segment)');
          e.status = 502;
          e.details = { segmentIndex: i, segBegin, segEnd, save };
          throw e;
        }

        const segUrl = await waitForDownloadUrl(
          segTaskId,
          computeDownloadTimeoutMs(segBegin, segEnd, { minMs: 180000, maxMs: 900000 }),
          3000
        );
        const partPath = path.join(tmpDir, `part_${String(i).padStart(3, '0')}.mp4`);
        await downloadToFile(segUrl, partPath);

        localParts.push(partPath);
        segmentMeta.push({ index: i, beginTime: segBegin, endTime: segEnd, taskId: segTaskId });
      }

      const mergedPath = path.join(tmpDir, 'merged.mp4');
      const mergeInfo = await concatMp4Files(localParts, mergedPath);

      const uploaded = await uploadMergedToGcs(cameraId, mergedPath);

      return res.status(200).json({
        errorCode: '0',
        data: {
          url: uploaded?.url,
          deviceId,
          cameraId,
          beginTime: beginTime,
          endTime: endTime,
          merged: { ...uploaded, ...mergeInfo },
          segments: segmentMeta,
        },
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ message: status < 500 ? err.message : 'Video save error' });
  }
});

module.exports = router;
