const express = require('express');
const router = express.Router();
const Jimp = require('jimp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

// Initialisation du client Google Cloud Storage
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

// Télécharger une image à partir d'une URL
async function fetchImage(url, outputPath) {
    try {
        const response = await axios({
            url: url,
            method: 'GET',
            responseType: 'arraybuffer',
        });
        fs.writeFileSync(outputPath, Buffer.from(response.data, 'binary'));
        return outputPath;
    } catch (error) {
        console.error(`Erreur lors du téléchargement de l'image : ${url}`, error.message);
        throw new Error(`Impossible de télécharger l'image : ${url}`);
    }
}

// Route pour combiner les images et uploader sur GCS
router.get('/mergeImages', async (req, res) => {
    try {
        console.log("Début du traitement des images...");

        // URLs des images
        const coverUrl = 'https://storage.googleapis.com/ia-sport.appspot.com/cover.jpg';
        const logo1Url = 'https://storage.googleapis.com/ia-sport.appspot.com/logo1.png';
        const logo2Url = 'https://storage.googleapis.com/ia-sport.appspot.com/logo2.png';

        // Téléchargement des images depuis les URLs
        console.log("Téléchargement des images depuis les URLs...");
        const coverPath = await fetchImage(coverUrl, 'cover.jpg');
        const logo1Path = await fetchImage(logo1Url, 'logo1.png');
        const logo2Path = await fetchImage(logo2Url, 'logo2.png');

        // Charger les images avec Jimp
        console.log("Chargement des images dans Jimp...");
        const cover = await Jimp.read(coverPath);
        const logo1 = await Jimp.read(logo1Path);
        const logo2 = await Jimp.read(logo2Path);

        // Redimensionner les logos si nécessaire
        console.log("Redimensionnement des logos...");
        logo1.resize(200, 200);
        logo2.resize(200, 200);

        // Superposer les logos sur l'image de couverture
        console.log("Superposition des logos au milieu...");
        const xLogo1 = (cover.getWidth() / 2) - logo1.getWidth() - 30;
        const xLogo2 = (cover.getWidth() / 2) + 50;
        const yLogos = (cover.getHeight() / 2) - (logo1.getHeight() / 2) - 200;

        cover.composite(logo1, xLogo1, yLogos);
        cover.composite(logo2, xLogo2, yLogos);

        // Sauvegarder l'image finale localement
        const outputPath = path.join('/tmp', 'final-image.jpg');
        console.log("Sauvegarde de l'image finale localement...");
        await cover.writeAsync(outputPath);

        // Chemin dans le bucket GCS
        const gcsFilePath = 'images/final-image.jpg';

        // Uploader l'image vers Google Cloud Storage
        console.log("Téléchargement de l'image vers Google Cloud Storage...");
        await bucket.upload(outputPath, {
            destination: gcsFilePath,
            contentType: 'image/jpeg',
        });

        console.log(`Image finale uploadée à ${gcsFilePath} dans le bucket ${bucketName}.`);

        // Supprimer le fichier local après upload
        fs.unlinkSync(outputPath);

        // Envoyer la réponse avec l'URL publique
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsFilePath}`;
        res.status(200).json({
            status: 'success',
            message: 'Image uploadée avec succès',
            url: publicUrl,
        });
    } catch (error) {
        console.error('Erreur lors du traitement des images :', error.message);
        res.status(500).json({ error: 'Erreur lors du traitement des images.', details: error.message });
    }
});

module.exports = router;
