const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

function runFfmpeg(args, { timeoutMs = 2 * 60 * 1000 } = {}) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static introuvable');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`ffmpeg timeout\n${stderr}`));
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`ffmpeg failed (code ${code})\n${stderr}`));
      }
    });
  });
}

async function concatMp4KeepAudio(inputFiles, outputFile) {
  if (!Array.isArray(inputFiles) || inputFiles.length < 2) {
    throw new Error('Il faut au moins 2 fichiers');
  }

  for (const file of inputFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Fichier introuvable : ${file}`);
    }
  }

  const listFile = path.resolve(__dirname, 'concat-list.txt');

  const content = inputFiles
    .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');

  fs.writeFileSync(listFile, content, 'utf8');

  try {
    await runFfmpeg([
      '-y',
      '-hide_banner',
      '-loglevel', 'info',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,

      // on garde la vidéo telle quelle
      '-c:v', 'copy',

      // on convertit seulement l'audio pour compatibilité MP4
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '8000',
      '-ac', '1',

      '-movflags', '+faststart',
      outputFile,
    ]);

    return { mode: 'video_copy_audio_aac' };
  } finally {
    try {
      fs.unlinkSync(listFile);
    } catch {}
  }
}

(async () => {
  try {
    const inputFiles = [
      path.resolve(__dirname, 'video1.mp4'),
      path.resolve(__dirname, 'video2.mp4'),
    ];

    const outputFile = path.resolve(__dirname, 'output.mp4');

    const start = Date.now();
    const result = await concatMp4KeepAudio(inputFiles, outputFile);
    const elapsedMs = Date.now() - start;

    console.log('\nTerminé');
    console.log('Mode :', result.mode);
    console.log('Temps :', `${elapsedMs} ms`);
    console.log('Fichier :', outputFile);
  } catch (err) {
    console.error('\nERREUR');
    console.error(err.message);
  }
})();