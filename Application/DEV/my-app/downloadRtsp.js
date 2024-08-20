const ffmpeg = require('fluent-ffmpeg');

// URL RTSP
const rtspUrl = 'rtsp://admin:Vidauban@192.168.1.4:55400/Streaming/tracks/101/?starttime=20240818T143531Z&endtime=20240818T143541Z&name=ch01_00000000000000206&size=4224544';

// Démarrer le téléchargement
ffmpeg(rtspUrl)
  .inputOptions('-rtsp_transport tcp')  // Utilisation de TCP pour la connexion RTSP
  .outputOptions('-c:v copy')           // Conserver le codec vidéo original
  .outputOptions('-c:a copy')           // Conserver le codec audio original
  .outputOptions('-t 00:00:10')         // Limiter la durée à 10 secondes (à ajuster si nécessaire)
  .on('start', (commandLine) => {
    console.log('Téléchargement a démarré...');
  })
  .on('error', (err) => {
    console.log('Erreur lors du téléchargement :', err.message);
  })
  .on('end', () => {
    console.log('Téléchargement terminé avec succès.');
  })
  .save('video.mp4');                  // Nom du fichier de sortie
