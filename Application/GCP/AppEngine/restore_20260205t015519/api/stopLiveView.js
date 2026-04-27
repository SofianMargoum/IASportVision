const express = require('express');
const router = express.Router();

router.get('/stopLiveView', (req, res) => {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGINT'); // Envoie un signal d'arrêt à FFmpeg
    ffmpegProcess = null;
    res.status(200).json({ message: 'Le flux a été arrêté.' });
  } else {
    res.status(400).json({ message: 'Aucun flux en cours.' });
  }
});

module.exports = router;
