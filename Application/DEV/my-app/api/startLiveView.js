const express = require('express');
const router = express.Router();
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

let ffmpegProcess = null; // Variable pour stocker le processus FFmpeg

router.get('/startLiveView', (req, res) => {
  if (ffmpegProcess) {
    return res.status(400).json({ message: 'Le flux est déjà en cours.' });
  }

  const videoSource = 'rtsp://admin:Vidauban@91.170.83.13:55400/Streaming/Channels/101/';
  const stream = new PassThrough();

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Connection': 'keep-alive',
    'Accept-Ranges': 'bytes'
  });

  ffmpegProcess = ffmpeg(videoSource)
    .inputOptions('-rtsp_transport tcp')
    .outputOptions([
      '-movflags frag_keyframe+empty_moov',
      '-vf scale=640:360',
      '-c:v libx264',
      '-c:a aac',
      '-f mp4'
    ])
    .on('start', () => {
      console.log('Le flux live a commencé.');
    })
    .on('error', err => {
      console.error('Erreur FFmpeg:', err.message);
      stream.end();
      ffmpegProcess = null; // Réinitialise la référence du processus FFmpeg
    })
    .on('end', () => {
      console.log('Le flux live a été arrêté.');
      stream.end();
      ffmpegProcess = null; // Réinitialise la référence du processus FFmpeg
    })
    .pipe(stream);

  stream.pipe(res);
});

module.exports = router;
