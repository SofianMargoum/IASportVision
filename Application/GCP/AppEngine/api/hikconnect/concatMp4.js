const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = (() => {
  try { return require('ffprobe-static').path; }
  catch { return null; }
})();

function isUrl(p) {
  return typeof p === 'string' && /^https?:\/\//i.test(p);
}

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

function runFfprobe(args, { timeoutMs = 60_000 } = {}) {
  if (!ffprobePath) return Promise.resolve(null);
  return new Promise((resolve) => {
    const child = spawn(ffprobePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(null); }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return resolve(null);
      try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
    });
  });
}

// Best-effort probe. Returns { videoCodec, hasAudio } or {} on failure.
// Works with both local paths and http(s) URLs.
async function probeInput(input) {
  const data = await runFfprobe([
    '-v', 'error',
    '-print_format', 'json',
    '-show_streams',
    input,
  ]);
  if (!data || !Array.isArray(data.streams)) return {};
  const v = data.streams.find((s) => s.codec_type === 'video');
  const a = data.streams.find((s) => s.codec_type === 'audio');
  return {
    videoCodec: v?.codec_name || null,
    hasAudio: !!a,
  };
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

// Accepts local file paths OR http(s) URLs. ffmpeg reads HTTPS natively, so we
// can skip downloading to disk when the caller already has signed URLs
// (ex: HikConnect download-url, GCS signed URLs, S3 presigned URLs).
async function concatMp4Files(inputs, outputFile, { reencodeFallback = true, timeoutMs = 2 * 60 * 1000 } = {}) {
  if (!Array.isArray(inputs) || inputs.length < 2) {
    const err = new Error('concatMp4Files requires at least 2 inputs');
    err.status = 400;
    throw err;
  }

  // Validate local files exist; URLs are passed as-is.
  for (const p of inputs) {
    if (typeof p !== 'string' || !p) {
      const err = new Error('Invalid input entry for concatMp4Files');
      err.status = 400;
      throw err;
    }
    if (!isUrl(p) && !fs.existsSync(p)) {
      const err = new Error(`Missing input file: ${p}`);
      err.status = 500;
      throw err;
    }
  }

  const baseLabel = path.basename(String(outputFile || 'out.mp4')).replace(/[^a-zA-Z0-9_.-]/g, '_');

  // Probe the first input once to know video codec (H.264 vs HEVC) and audio presence.
  // This drives the bitstream filter choice for the MPEG-TS path and -tag:v for HEVC.
  const probe = await probeInput(inputs[0]).catch(() => ({}));
  const videoCodec = probe.videoCodec || null;
  const bsfV = videoCodec === 'hevc' ? 'hevc_mp4toannexb' : 'h264_mp4toannexb';
  const videoTagArgs = videoCodec === 'hevc' ? ['-tag:v', 'hvc1'] : [];

  // ──────────────────────────────────────────────────────────
  // Method 1 (preferred): Intermediate MPEG-TS approach.
  // Convert each input → .ts (which handles timestamp resets natively),
  // then concatenate via the concat *protocol* and remux to MP4.
  // This avoids the timestamp / fast-forward issues of the concat demuxer
  // with HikConnect recordings (variable framerate, PTS resets between files).
  // ──────────────────────────────────────────────────────────
  const tsFiles = [];
  try {
    for (let i = 0; i < inputs.length; i++) {
      const tsFile = tmpName(`${baseLabel}_seg${i}`, '.ts');
      tsFiles.push(tsFile);

      await runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', inputs[i],
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '8000', '-ac', '1',
        '-bsf:v', bsfV,
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
      ...videoTagArgs,
      '-movflags', '+faststart',
      outputFile,
    ], { timeoutMs });

    cleanupFiles(...tsFiles);
    return { mode: 'ts_intermediate', videoCodec };
  } catch (errTs) {
    cleanupFiles(...tsFiles);

    // ──────────────────────────────────────────────────────────
    // Method 2: concat demuxer with genpts (lighter fallback).
    // Requires local files — skip if any input is a URL.
    // ──────────────────────────────────────────────────────────
    const anyUrl = inputs.some(isUrl);
    let errDemuxer = null;
    let listFile = null;

    if (!anyUrl) {
      listFile = tmpName(baseLabel, '.txt');
      const listContent = inputs
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
          ...videoTagArgs,
          '-c:a', 'aac', '-b:a', '128k', '-ar', '8000', '-ac', '1',
          '-movflags', '+faststart',
          outputFile,
        ], { timeoutMs });
        cleanupFiles(listFile);
        return { mode: 'demuxer_genpts_igndts', videoCodec };
      } catch (e) {
        errDemuxer = e;
      }
    }

    if (!reencodeFallback) {
      if (listFile) cleanupFiles(listFile);
      throw errDemuxer || errTs;
    }

    // ──────────────────────────────────────────────────────────
    // Method 3: Full re-encode (slowest but most robust).
    // Forces constant framerate to fix any VFR / timestamp issues.
    // Works with URLs too (ffmpeg reads HTTPS natively).
    // ──────────────────────────────────────────────────────────
    try {
      // Build a concat-filter pipeline so it works for URLs and mismatched inputs.
      // Fixed 25 fps target: last-resort path, never reached when inputs are homogeneous.
      const targetFps = '25';
      const hasAudio = !!probe.hasAudio;
      const filterParts = [];
      const filterStreams = [];
      inputs.forEach((_, i) => {
        filterParts.push(`[${i}:v]setpts=PTS-STARTPTS,fps=${targetFps},format=yuv420p[v${i}]`);
        if (hasAudio) {
          filterParts.push(`[${i}:a]aresample=async=1:first_pts=0,aformat=sample_rates=48000:channel_layouts=stereo[a${i}]`);
          filterStreams.push(`[v${i}][a${i}]`);
        } else {
          filterStreams.push(`[v${i}]`);
        }
      });
      filterParts.push(`${filterStreams.join('')}concat=n=${inputs.length}:v=1:a=${hasAudio ? 1 : 0}[vout]${hasAudio ? '[aout]' : ''}`);

      const reencArgs = [
        '-y', '-hide_banner', '-loglevel', 'error',
        ...inputs.flatMap((f) => ['-i', f]),
        '-filter_complex', filterParts.join(';'),
        '-map', '[vout]',
        ...(hasAudio ? ['-map', '[aout]'] : []),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-fps_mode', 'cfr',
        '-r', targetFps,
        ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2'] : []),
        '-movflags', '+faststart',
        outputFile,
      ];

      await runFfmpeg(reencArgs, { timeoutMs });
      if (listFile) cleanupFiles(listFile);
      return {
        mode: 'reencode_cfr',
        videoCodec,
        fallbackFrom: errDemuxer?.message || errTs?.message,
      };
    } catch (errReencode) {
      if (listFile) cleanupFiles(listFile);
      errReencode.details = {
        ...(errReencode.details || {}),
        tsAttempt: errTs?.details || { message: errTs?.message },
        demuxerAttempt: errDemuxer?.details || { message: errDemuxer?.message },
      };
      throw errReencode;
    }
  }
}

module.exports = {
  concatMp4Files,
  isUrl,
};
