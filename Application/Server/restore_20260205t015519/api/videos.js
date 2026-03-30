const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

const DEFAULT_COVER_URL = 'https://storage.googleapis.com/ia-sport.appspot.com/images/cover.png';

// Formatage de date
function formatDateTime(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Vérifie si la couverture personnalisée existe
async function checkCoverExists(folder, videoName) {
    const coverPath = `${folder}/${videoName}.png`;
    const [exists] = await bucket.file(coverPath).exists();
    return exists
        ? `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(coverPath)}`
        : DEFAULT_COVER_URL;
}

// ✅ Nouvelle fonction pour vérifier si le JSON existe (optionnel mais recommandé)
async function checkJsonExists(folder, videoName) {
    const jsonPath = `${folder}/${videoName}.json`;
    const [exists] = await bucket.file(jsonPath).exists();
    return exists
        ? `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(jsonPath)}`
        : null;
}

// Route pour lister les vidéos
router.get('/videos', async (req, res) => {
    const folder = req.query.folder || '';
    const prefix = folder.endsWith('/') ? folder : `${folder}/`;

    try {
        const [files] = await bucket.getFiles({ prefix });

        const videoDataPromises = files
            .filter(file => file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i))
            .map(async (file) => {
                const fileName = file.name.split('/').pop();
                const nameWithoutExt = fileName.replace(/\.(mp4|avi|mov|mkv|webm)$/i, '');

                const [metadata] = await file.getMetadata();
                const creationDateTime = formatDateTime(metadata.timeCreated);
                const coverUrl = await checkCoverExists(folder, nameWithoutExt);

                // ✅ Construction de l'URL du JSON (en supposant qu'il existe)
                const jsonUrl = await checkJsonExists(folder, nameWithoutExt);

                return {
                    url: `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(file.name)}`,
                    name: nameWithoutExt,
                    creationDate: creationDateTime,
                    coverUrl,
                    jsonUrl, // ✅ Ajout ici
                };
            });

        const videoData = await Promise.all(videoDataPromises);
        res.status(200).json({ videos: videoData });

    } catch (error) {
        console.error('Error fetching video URLs:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve video URLs' });
    }
});

module.exports = router;
