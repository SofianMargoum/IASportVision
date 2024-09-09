const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

// Route pour obtenir les liens des fichiers vidéo dans un dossier spécifique
router.get('/videos', async (req, res) => {
    const folder = req.query.folder || ''; // Obtenir le paramètre de dossier ou utiliser une chaîne vide par défaut
    const prefix = folder.endsWith('/') ? folder : `${folder}/`;

    try {
        const [files] = await bucket.getFiles({ prefix }); // Filtrer les fichiers avec le préfixe du dossier

        // Filtrer uniquement les vidéos et créer une liste avec les URLs et les noms des fichiers
        const videoData = files
            .filter(file => file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) // Filtrer uniquement les vidéos
            .map(file => {
                const fileName = file.name.split('/').pop(); // Extraire le nom du fichier
                const nameWithoutExt = fileName.replace(/\.(mp4|avi|mov|mkv|webm)$/i, ''); // Supprimer l'extension

                return {
                    url: `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(file.name)}`, // Créer l'URL
                    name: nameWithoutExt // Nom sans extension
                };
            });

        res.status(200).json({ videos: videoData });
    } catch (error) {
        console.error('Error fetching video URLs:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve video URLs' });
    }
});

module.exports = router;
