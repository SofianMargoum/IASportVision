const express = require('express');
const router = express.Router();
const ffmpeg = require('fluent-ffmpeg');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Initialisation de Google Cloud Storage
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

router.post('/upload-and-merge', async (req, res) => {
    console.log('📢 Requête reçue pour /upload-and-merge');

    const { filename, cameraRtspUrl, directory } = req.body;

    if (!filename || !cameraRtspUrl || !directory) {
        console.error('❌ Paramètres manquants');
        return res.status(400).json({
            status: 'error',
            message: 'Filename, cameraRtspUrl, and directory must be provided'
        });
    }

    const localDir = '/tmp';
    const segmentDuration = 60; // 1 minute (60 secondes)
    const mergedVideoPath = path.join(localDir, filename);
    const gcsOutputPath = path.join(directory, filename);

    try {
        console.log('🔍 Extraction des timestamps depuis l’URL RTSP...');
        const startTimeMatch = cameraRtspUrl.match(/starttime=(\d+T\d+Z)/);
        const endTimeMatch = cameraRtspUrl.match(/endtime=(\d+T\d+Z)/);

        if (!startTimeMatch || !endTimeMatch) {
            throw new Error('Impossible d’extraire starttime ou endtime de l’URL RTSP');
        }

        const startTime = moment(startTimeMatch[1], 'YYYYMMDDTHHmmss[Z]');
        const endTime = moment(endTimeMatch[1], 'YYYYMMDDTHHmmss[Z]');

        console.log(`⏳ Début: ${startTime.format()} | Fin: ${endTime.format()}`);

        let segmentStart = startTime.clone();
        let segmentIndex = 0;
        let videoSegments = [];

        console.log('🎥 Téléchargement des segments vidéo...');

        while (segmentStart.isBefore(endTime)) {
            const segmentEnd = moment.min(segmentStart.clone().add(segmentDuration, 'seconds'), endTime);
            const segmentFilename = `segment_${segmentIndex}.mp4`;
            const segmentPath = path.join(localDir, segmentFilename);
            videoSegments.push(segmentPath);

            const segmentUrl = cameraRtspUrl.replace(
                /starttime=\d+T\d+Z/,
                `starttime=${segmentStart.format('YYYYMMDDTHHmmss[Z]')}`
            ).replace(
                /endtime=\d+T\d+Z/,
                `endtime=${segmentEnd.format('YYYYMMDDTHHmmss[Z]')}`
            );

            console.log(`📥 Téléchargement du segment ${segmentIndex}: ${segmentUrl}`);

            await new Promise((resolve, reject) => {
                ffmpeg(segmentUrl)
                    .inputOptions('-rtsp_transport tcp')
                    .outputOptions(`-t ${segmentDuration}`) // Arrêter après 1 minute
                    .outputOptions('-c:v copy', '-c:a copy')
                    .on('start', (commandLine) => {
                        console.log(`FFmpeg started: ${commandLine}`);
                    })
                    .on('error', (err) => {
                        console.error(`❌ Erreur lors du téléchargement du segment ${segmentIndex}:`, err.message);
                        reject(err);
                    })
                    .on('end', async () => {
                        console.log(`✅ Segment ${segmentIndex} téléchargé avec succès.`);

                        // Uploader immédiatement le segment sur GCS
                        const gcsSegmentPath = path.join(directory, segmentFilename);
                        try {
                            await bucket.upload(segmentPath, {
                                destination: gcsSegmentPath,
                                contentType: 'video/mp4'
                            });

                            console.log(`📤 Segment ${segmentIndex} uploadé vers ${gcsSegmentPath}`);

                            // Supprimer le fichier local après l'upload
                            fs.unlinkSync(segmentPath);
                        } catch (uploadError) {
                            console.error('❌ Erreur lors de l’upload du segment:', uploadError);
                            reject(uploadError);
                        }
                        resolve();
                    })
                    .save(segmentPath);
            });

            segmentStart = segmentEnd;
            segmentIndex++;
        }

        console.log('🛠️ Segments téléchargés. Fusion en cours...');

        const concatFilePath = path.join(localDir, 'file_list.txt');
        fs.writeFileSync(concatFilePath, videoSegments.map(file => `file '${file}'`).join('\n'));

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(concatFilePath)
                .inputOptions('-f concat', '-safe 0')
                .outputOptions('-c copy')
                .on('error', (err) => {
                    console.error('❌ Erreur lors de la fusion:', err.message);
                    reject(err);
                })
                .on('end', async () => {
                    console.log('✅ Fusion terminée');

                    // Uploader la vidéo fusionnée sur GCS
                    try {
                        await bucket.upload(mergedVideoPath, {
                            destination: gcsOutputPath,
                            contentType: 'video/mp4'
                        });

                        console.log(`🎉 Vidéo fusionnée uploadée: ${gcsOutputPath}`);

                        // Nettoyage des fichiers
                        fs.unlinkSync(concatFilePath);
                        fs.unlinkSync(mergedVideoPath);

                        res.status(200).json({
                            status: 'success',
                            message: 'Merged video uploaded',
                            outputFile: gcsOutputPath
                        });
                    } catch (uploadError) {
                        console.error('❌ Erreur lors de l’upload de la vidéo fusionnée:', uploadError);
                        reject(uploadError);
                    }
                    resolve();
                })
                .save(mergedVideoPath);
        });
    } catch (error) {
        console.error('🚨 Erreur critique:', error);
        res.status(500).json({
            status: 'error',
            message: 'Unexpected error: ' + error.message
        });
    }
});

module.exports = router;
