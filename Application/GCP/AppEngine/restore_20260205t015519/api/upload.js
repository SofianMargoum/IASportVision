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

router.post('/upload', async (req, res) => {
    const { filename, cameraRtspUrl, directory, duration } = req.body;

    // Vérification des paramètres
    if (!filename || !cameraRtspUrl || !directory || !duration) {
        return res.status(400).json({
            status: 'error',
            message: 'Filename, cameraRtspUrl, directory or duration not specified'
        });
    }

    // Vérification si la durée est valide
    if (duration <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid duration'
        });
    }

    // Définir le chemin de fichier temporaire local
    const localFilePath = path.join('/tmp', filename);

    // Définir le chemin complet du fichier dans le bucket GCS (incluant le dossier)
    const gcsFilePath = path.join(directory, filename);

    try {
        // Démarrer le téléchargement depuis le flux RTSP
        ffmpeg(cameraRtspUrl)
            .inputOptions('-rtsp_transport tcp')  // Utilisation de TCP pour la connexion RTSP
            .outputOptions(`-t ${duration}`)      // Limiter la durée en fonction des paramètres
            .outputOptions('-c:v copy')           // Conserver le codec vidéo original
            .outputOptions('-c:a copy')           // Conserver le codec audio original
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

                // Télécharger le fichier local vers Google Cloud Storage dans le dossier spécifié
                try {
                    await bucket.upload(localFilePath, {
                        destination: gcsFilePath,
                        contentType: 'video/mp4'
                    });

                    console.log(`File ${filename} uploaded to ${gcsFilePath} in bucket ${bucketName}.`);
                    res.status(200).json({
                        status: 'success',
                        message: `File uploaded to ${gcsFilePath} in GCS`
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
