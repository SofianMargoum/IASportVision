const express = require('express');
const router = express.Router();
const ffmpeg = require('fluent-ffmpeg');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Initialisation du client Google Cloud Storage
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

// URL RTSP avec authentification intégrée et le port spécifié
const cameraRtspUrl = 'rtsp://admin:Vidauban@91.170.83.13:55400/Streaming/tracks/101/?starttime=20240818T143531Z&endtime=20240818T143541Z&name=ch01_00000000000000206&size=4224544';

router.post('/upload', async (req, res) => {
    const { filename } = req.body;

    if (!filename) {
        return res.status(400).json({
            status: 'error',
            message: 'Filename not specified'
        });
    }

    // Définir le chemin de fichier temporaire local
    const localFilePath = path.join('/tmp', filename);

    try {
        // Démarrer le téléchargement depuis le flux RTSP
        ffmpeg(cameraRtspUrl)
            .inputOptions('-rtsp_transport tcp')  // Utilisation de TCP pour la connexion RTSP
            .outputOptions('-c:v copy')           // Conserver le codec vidéo original
            .outputOptions('-c:a copy')           // Conserver le codec audio original
            .outputOptions('-t 00:00:10')         // Limiter la durée à 10 secondes
            .on('start', (commandLine) => {
                console.log('Téléchargement a démarré...');
                console.log(`FFmpeg process started with command: ${commandLine}`);
            })
            .on('error', (err) => {
                console.log('Erreur lors du téléchargement :', err.message);
                res.status(500).json({
                    status: 'error',
                    message: 'Failed to process RTSP stream: ' + err.message
                });
            })
            .on('end', async () => {
                console.log('Téléchargement terminé avec succès.');

                // Télécharger le fichier local vers Google Cloud Storage
                try {
                    await bucket.upload(localFilePath, {
                        destination: filename,
                        contentType: 'video/mp4'
                    });

                    console.log(`File ${filename} uploaded to ${bucketName}.`);
                    res.status(200).json({
                        status: 'success',
                        message: 'File uploaded to GCS'
                    });

                    // Supprimer le fichier local après le téléchargement
                    fs.unlinkSync(localFilePath);
                } catch (uploadError) {
                    console.error('Error uploading file to GCS:', uploadError);
                    res.status(500).json({
                        status: 'error',
                        message: 'Failed to upload file to GCS: ' + uploadError.message
                    });
                }
            })
            .save(localFilePath);  // Sauvegarder localement le fichier temporaire

    } catch (error) {
        console.error('Error in RTSP streaming:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process RTSP stream: ' + error.message
        });
    }
});

module.exports = router;
