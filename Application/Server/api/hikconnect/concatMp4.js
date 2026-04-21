const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

function runFfmpeg(args, { timeoutMs = 2 * 60 * 1000 } = {}) {
  if (!ffmpegPath) {
    const err = new Error('ffmpeg binary not found (ffmpeg-static returned null)');
    err.status = 500;
    throw err;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
      const err = new Error('ffmpeg timeout');
      err.status = 504;
      err.details = { args, stderr: stderr.slice(-4000), stdout: stdout.slice(-2000) };
      reject(err);
    }, timeoutMs);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (e) => {
      clearTimeout(killTimer);
      reject(e);
    });

    child.on('close', (code) => {
      clearTimeout(killTimer);
      if (code === 0) return resolve({ stdout, stderr });

      const err = new Error(`ffmpeg failed with exit code ${code}`);
      err.status = 502;
      err.details = { args, stderr: stderr.slice(-4000), stdout: stdout.slice(-2000) };
      reject(err);
    });
  });
}

function cleanupFiles(...files) {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch {}
  }
}

function tmpName(label, ext) {
  return path.join(
    os.tmpdir(),
    `ffconcat_${label}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
  );
}

async function concatMp4Files(inputFiles, outputFile, { reencodeFallback = true, timeoutMs = 2 * 60 * 1000 } = {}) {
  if (!Array.isArray(inputFiles) || inputFiles.length < 2) {
    const err = new Error('concatMp4Files requires at least 2 input files');
    err.status = 400;
    throw err;
  }

  for (const p of inputFiles) {
    if (!fs.existsSync(p)) {
      const err = new Error(`Missing input file: ${p}`);
      err.status = 500;
      throw err;
    }
  }

  const baseLabel = path.basename(String(outputFile || 'out.mp4')).replace(/[^a-zA-Z0-9_.-]/g, '_');

  // ──────────────────────────────────────────────────────────
  // Method 1 (preferred): Intermediate MPEG-TS approach.
  // Convert each MP4 → .ts (which handles timestamp resets natively),
  // then concatenate via the concat *protocol* and remux to MP4.
  // This avoids the timestamp / fast-forward issues of the concat demuxer
  // with HikConnect recordings (variable framerate, PTS resets between files).
  // ──────────────────────────────────────────────────────────
  const tsFiles = [];
  try {
    for (let i = 0; i < inputFiles.length; i++) {
      const tsFile = tmpName(`${baseLabel}_seg${i}`, '.ts');
      tsFiles.push(tsFile);

      await runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', inputFiles[i],
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '8000', '-ac', '1',
        '-bsf:v', 'h264_mp4toannexb',
        '-f', 'mpegts',
        tsFile,
      ], { timeoutMs });
    }

    // concat protocol: "concat:seg0.ts|seg1.ts|..."
    const concatInput = `concat:${tsFiles.join('|')}`;

    await runFfmpeg([
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', concatInput,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputFile,
    ], { timeoutMs });

    cleanupFiles(...tsFiles);
    return { mode: 'ts_intermediate' };
  } catch (errTs) {
    cleanupFiles(...tsFiles);

    // ──────────────────────────────────────────────────────────
    // Method 2: concat demuxer with genpts (lighter fallback).
    // ──────────────────────────────────────────────────────────
    const listFile = tmpName(baseLabel, '.txt');
    const listContent = inputFiles
      .map((p) => String(p).replace(/'/g, "'\\''"))
      .map((p) => `file '${p}'`)
      .join('\n');
    fs.writeFileSync(listFile, listContent, 'utf8');

    try {
      await runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-fflags', '+genpts+igndts',
        '-avoid_negative_ts', 'make_zero',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-map', '0:v:0',
        '-map', '0:a?',
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '8000', '-ac', '1',
        '-movflags', '+faststart',
        outputFile,
      ], { timeoutMs });
      cleanupFiles(listFile);
      return { mode: 'demuxer_genpts_igndts' };
    } catch (errDemuxer) {
      if (!reencodeFallback) {
        cleanupFiles(listFile);
        throw errDemuxer;
      }

      // ──────────────────────────────────────────────────────────
      // Method 3: Full re-encode (slowest but most robust).
      // Forces constant framerate to fix any VFR / timestamp issues.
      // ──────────────────────────────────────────────────────────
      try {
        await runFfmpeg([
          '-y', '-hide_banner', '-loglevel', 'error',
          '-fflags', '+genpts+igndts',
          '-f', 'concat',
          '-safe', '0',
          '-i', listFile,
          '-map', '0:v:0',
          '-map', '0:a?',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-vsync', 'cfr',
          '-c:a', 'aac', '-b:a', '128k', '-ar', '8000', '-ac', '1',
          '-movflags', '+faststart',
          outputFile,
        ], { timeoutMs });
        cleanupFiles(listFile);
        return { mode: 'reencode_cfr', fallbackFrom: errDemuxer?.message || errTs?.message };
      } catch (errReencode) {
        cleanupFiles(listFile);
        errReencode.details = {
          ...(errReencode.details || {}),
          tsAttempt: errTs?.details || { message: errTs?.message },
          demuxerAttempt: errDemuxer?.details || { message: errDemuxer?.message },
        };
        throw errReencode;
      }
    }
  }
}

module.exports = {
  concatMp4Files,
};
