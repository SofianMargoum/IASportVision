const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

// URL de l'image par défaut
const DEFAULT_COVER_URL = 'https://storage.googleapis.com/ia-sport.appspot.com/images/cover.png';

// Fonction pour formater la date et l'heure au format DD/MM/YYYY HH:mm:ss
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

// Fonction pour vérifier si une couverture existe
async function checkCoverExists(folder, videoName) {
    const coverPath = `${folder}/${videoName}.png`; // Chemin attendu pour la couverture
    const [exists] = await bucket.file(coverPath).exists();
    return exists ? `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(coverPath)}` : DEFAULT_COVER_URL;
}

// Route pour obtenir les liens des fichiers vidéo dans un dossier spécifique
router.get('/videos', async (req, res) => {
    const folder = req.query.folder || ''; // Obtenir le paramètre de dossier ou utiliser une chaîne vide par défaut
    const prefix = folder.endsWith('/') ? folder : `${folder}/`;

    try {
        const [files] = await bucket.getFiles({ prefix }); // Filtrer les fichiers avec le préfixe du dossier

        // Promesse pour obtenir les métadonnées des fichiers
        const videoDataPromises = files
            .filter(file => file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) // Filtrer uniquement les vidéos
            .map(async (file) => {
                const fileName = file.name.split('/').pop(); // Extraire le nom du fichier
                const nameWithoutExt = fileName.replace(/\.(mp4|avi|mov|mkv|webm)$/i, ''); // Supprimer l'extension

                // Récupérer les métadonnées du fichier, y compris la date de création
                const [metadata] = await file.getMetadata();
                const creationDateTime = formatDateTime(metadata.timeCreated); // Formater la date et l'heure

                // Vérifier si la couverture existe ou utiliser l'image par défaut
                const coverUrl = await checkCoverExists(folder, nameWithoutExt);

                return {
                    url: `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(file.name)}`, // URL de la vidéo
                    name: nameWithoutExt, // Nom sans extension
                    creationDate: creationDateTime, // Date et heure formatées
                    coverUrl // URL de la couverture ou image par défaut
                };
            });

        // Résoudre toutes les promesses
        const videoData = await Promise.all(videoDataPromises);

        res.status(200).json({ videos: videoData });
    } catch (error) {
        console.error('Error fetching video URLs:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve video URLs' });
    }
});

module.exports = router;
