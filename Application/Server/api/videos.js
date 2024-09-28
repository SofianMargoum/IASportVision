const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

// Fonction pour formater la date au format DD/MM/YYYY
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0'); // Ajoute un 0 si le jour est inférieur à 10
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Les mois sont indexés à partir de 0
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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
                const creationDate = formatDate(metadata.timeCreated); // Formater la date

                return {
                    url: `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(file.name)}`, // Créer l'URL
                    name: nameWithoutExt, // Nom sans extension
                    creationDate: creationDate // Date formatée
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
