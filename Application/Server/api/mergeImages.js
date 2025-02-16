const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');

const router = express.Router();
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

// Générer un nom de fichier avec timestamp si aucun n'est fourni
const generateFileName = (baseName, extension) => {
    const timestamp = Date.now();
    return `${baseName}-${timestamp}.${extension}`;
};

// Télécharger une image et l'enregistrer dans le bucket temporaire
async function fetchAndUploadToTmp(url, fileName, tmpPath) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const file = bucket.file(`${tmpPath}/${fileName}`);
    await file.save(Buffer.from(response.data), { contentType: 'image/png' });
    console.log(`Fichier téléchargé et sauvegardé : ${fileName}`);
    return fileName;
}

// Charger une image depuis GCS
async function loadImageFromGCS(fileName, tmpPath) {
    const file = bucket.file(`${tmpPath}/${fileName}`);
    const [fileBuffer] = await file.download();
    return await loadImage(fileBuffer);
}

// Supprimer tous les fichiers dans le dossier temporaire
async function deleteTmpFolder(tmpPath) {
    const [files] = await bucket.getFiles({ prefix: `${tmpPath}/` });
    await Promise.all(files.map((file) => file.delete()));
    console.log(`Dossier temporaire nettoyé : ${tmpPath}`);
}

// Route principale
router.get('/mergeImages', async (req, res) => {
    try {
        const { logo1Url, logo2Url, finalFolder, finalName } = req.query;

        if (!logo1Url || !logo2Url || !finalFolder) {
            return res.status(400).json({
                error: "Les paramètres 'logo1Url', 'logo2Url', et 'finalFolder' sont requis.",
            });
        }

        const tmpFolder = `${finalFolder}/tmp`;

        // Générer des noms de fichiers avec timestamp si aucun n'est fourni
        const coverFileName = generateFileName('cover', 'png');
        const logo1FileName = generateFileName('logo1', 'jpg');
        const logo2FileName = generateFileName('logo2', 'jpg');
        const roundedLogo1FileName = generateFileName('rounded-logo1', 'png');
        const roundedLogo2FileName = generateFileName('rounded-logo2', 'png');
        const finalFileName = finalName || generateFileName('final-image', 'png');

        // Télécharger les images dans le répertoire temporaire
        await fetchAndUploadToTmp('https://storage.googleapis.com/ia-sport.appspot.com/images/cover.png', coverFileName, tmpFolder);
        await fetchAndUploadToTmp(logo1Url, logo1FileName, tmpFolder);
        await fetchAndUploadToTmp(logo2Url, logo2FileName, tmpFolder);

        // Charger les images depuis le bucket
        const coverImage = await loadImageFromGCS(coverFileName, tmpFolder);
        const logo1Image = await loadImageFromGCS(logo1FileName, tmpFolder);
        const logo2Image = await loadImageFromGCS(logo2FileName, tmpFolder);

        // Taille des logos
        const logoSize = 150;

        // Fonction pour arrondir les coins
        const makeRoundedImage = (image) => {
            const canvas = createCanvas(logoSize, logoSize);
            const ctx = canvas.getContext('2d');

            ctx.beginPath();
            ctx.arc(logoSize / 2, logoSize / 2, logoSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(image, 0, 0, logoSize, logoSize);

            return canvas;
        };

        // Arrondir les coins des logos
        const roundedLogo1 = makeRoundedImage(logo1Image);
        const roundedLogo2 = makeRoundedImage(logo2Image);

        // Sauvegarder les logos arrondis dans le dossier temporaire
        const roundedLogo1Buffer = roundedLogo1.toBuffer('image/png');
        const roundedLogo2Buffer = roundedLogo2.toBuffer('image/png');

        await bucket.file(`${tmpFolder}/${roundedLogo1FileName}`).save(roundedLogo1Buffer, {
            contentType: 'image/png',
        });
        await bucket.file(`${tmpFolder}/${roundedLogo2FileName}`).save(roundedLogo2Buffer, {
            contentType: 'image/png',
        });

        console.log('Logos arrondis sauvegardés dans le dossier temporaire.');

        // Dimensions de la couverture
        const coverWidth = coverImage.width;
        const coverHeight = coverImage.height;

        // Créer le canvas final
        const canvas = createCanvas(coverWidth, coverHeight);
        const ctx = canvas.getContext('2d');

        // Dessiner la couverture
        ctx.drawImage(coverImage, 0, 0, coverWidth, coverHeight);

        // Positionner les logos arrondis
        const logo1Position = { x: coverWidth / 2 - 175, y: coverHeight / 2 - 200 };
        const logo2Position = { x: coverWidth / 2 + 50, y: coverHeight / 2 - 200 };

        ctx.drawImage(roundedLogo1, logo1Position.x, logo1Position.y);
        ctx.drawImage(roundedLogo2, logo2Position.x, logo2Position.y);

        // Sauvegarder l'image finale dans le bucket (hors dossier tmp)
        const buffer = canvas.toBuffer('image/png');
        const finalFile = bucket.file(`${finalFolder}/${finalFileName}`);
        await finalFile.save(buffer, { contentType: 'image/png', public: true });

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${finalFolder}/${finalFileName}`;

        // Nettoyer le dossier temporaire
        await deleteTmpFolder(tmpFolder);

        res.status(200).json({
            status: 'success',
            message: 'Image traitée et uploadée avec succès',
            url: publicUrl,
        });
    } catch (error) {
        console.error('Erreur lors du traitement des images :', error.message);
        res.status(500).json({ error: 'Erreur lors du traitement des images.', details: error.message });
    }
});

module.exports = router;
