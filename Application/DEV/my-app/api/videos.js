const express = require('express');
const router = express.Router();

try {
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
            const videoUrls = files
                .filter(file => file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) // Filtrer uniquement les vidéos
                .map(file => `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(file.name)}`); // Créer l'URL

            res.status(200).json({ videos: videoUrls });
        } catch (error) {
            console.error('Error fetching video URLs:', error);
            res.status(500).json({ status: 'error', message: 'Failed to retrieve video URLs' });
        }
    });

} catch (error) {
    // Route pour afficher un message d'erreur personnalisé
    router.get('/videos', (req, res) => {
        res.status(200).json({ message: 'Erreur lors de l\'initialisation de la route Videos' });
    });
}

module.exports = router;
