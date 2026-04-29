const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

const DEFAULT_COVER_URL = 'https://storage.googleapis.com/ia-sport.appspot.com/images/cover.png';

// Anti path-traversal : séparateurs, `..`, et caractères de contrôle interdits.
function sanitizeGcsSegment(v) {
  return String(v || '')
    .replace(/\\/g, '')
    .replace(/\/\.\.(\/|$)/g, '/_/')
    .replace(/^\.\./g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

function hasTraversal(v) {
  return v.includes('/') || v.includes('\\') || v.includes('..');
}

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
    const folder = sanitizeGcsSegment(req.query.folder || '');
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
        console.error('Error fetching video URLs:', error.message);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve video URLs' });
    }
});

// Route pour supprimer une vidéo (et fichiers associés)
// DELETE /api/videos?folder=CLUB&name=VIDEO_NAME_SANS_EXTENSION
router.delete('/videos', async (req, res) => {
    const folder = sanitizeGcsSegment(req.query.folder || '');
    const name = sanitizeGcsSegment(req.query.name || '');

    if (!folder || !name) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required query params: folder, name',
        });
    }

    if (hasTraversal(folder) || hasTraversal(name)) {
        return res.status(400).json({ status: 'error', message: 'Invalid folder or name' });
    }

    const prefix = folder.endsWith('/') ? folder : `${folder}/`;
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm'];

    const candidates = [
        ...videoExts.map((ext) => `${prefix}${name}.${ext}`),
        `${prefix}${name}.png`,
        `${prefix}${name}.json`,
    ];

    try {
        const deletions = await Promise.all(
            candidates.map(async (objectName) => {
                const file = bucket.file(objectName);
                const [exists] = await file.exists();
                if (!exists) return { objectName, deleted: false };
                await file.delete();
                return { objectName, deleted: true };
            })
        );

        const deletedCount = deletions.filter((d) => d.deleted).length;
        if (deletedCount === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Video not found',
                details: { folder, name },
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Video deleted',
            details: {
                folder,
                name,
                deleted: deletions.filter((d) => d.deleted).map((d) => d.objectName),
            },
        });
    } catch (error) {
        console.error('Error deleting video:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to delete video',
        });
    }
});

// Route pour renommer une vidéo (et fichiers associés)
// PUT /api/videos/rename
// Body JSON: { folder: "CLUB", oldName: "ANCIEN", newName: "NOUVEAU" }
router.put('/videos/rename', async (req, res) => {
    const folder = String(req.body?.folder || '');
    const oldName = String(req.body?.oldName || '');
    const newName = String(req.body?.newName || '');

    const clean = (v) => String(v || '').trim();
    const folderClean = clean(folder);
    const oldClean = clean(oldName);
    const newClean = clean(newName);

    if (!folderClean || !oldClean || !newClean) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required body fields: folder, oldName, newName',
        });
    }

    if (oldClean === newClean) {
        return res.status(400).json({
            status: 'error',
            message: 'newName must be different from oldName',
        });
    }

    // Sécurité: on renomme uniquement au sein du dossier, sans sous-chemins
    const invalidName = (v) => v.includes('/') || v.includes('\\') || v.includes('..');
    if (invalidName(oldClean) || invalidName(newClean) || invalidName(folderClean)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid folder or name',
        });
    }

    const prefix = folderClean.endsWith('/') ? folderClean : `${folderClean}/`;
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm'];

    try {
        // 1) Trouver l'extension réelle de la vidéo
        let foundExt = null;
        for (const ext of videoExts) {
            const src = bucket.file(`${prefix}${oldClean}.${ext}`);
            const [exists] = await src.exists();
            if (exists) {
                foundExt = ext;
                break;
            }
        }

        if (!foundExt) {
            return res.status(404).json({
                status: 'error',
                message: 'Video not found',
                details: { folder: folderClean, name: oldClean },
            });
        }

        // 2) Empêcher l'écrasement si la destination existe déjà
        const destVideo = bucket.file(`${prefix}${newClean}.${foundExt}`);
        const [destExists] = await destVideo.exists();
        if (destExists) {
            return res.status(409).json({
                status: 'error',
                message: 'A video with this name already exists',
                details: { folder: folderClean, name: newClean },
            });
        }

        const renamed = [];

        // 3) Renommer vidéo: copy -> delete
        const srcVideo = bucket.file(`${prefix}${oldClean}.${foundExt}`);
        await srcVideo.copy(destVideo);
        await srcVideo.delete();
        renamed.push({ from: `${prefix}${oldClean}.${foundExt}`, to: `${prefix}${newClean}.${foundExt}` });

        // 4) Renommer fichiers associés (optionnels)
        const associatedExts = ['png', 'json'];
        for (const ext of associatedExts) {
            const src = bucket.file(`${prefix}${oldClean}.${ext}`);
            const [exists] = await src.exists();
            if (!exists) continue;

            const dest = bucket.file(`${prefix}${newClean}.${ext}`);
            const [assocDestExists] = await dest.exists();
            if (assocDestExists) {
                // On évite d'écraser un fichier existant
                continue;
            }

            await src.copy(dest);
            await src.delete();
            renamed.push({ from: `${prefix}${oldClean}.${ext}`, to: `${prefix}${newClean}.${ext}` });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Video renamed',
            details: {
                folder: folderClean,
                oldName: oldClean,
                newName: newClean,
                renamed,
            },
        });
    } catch (error) {
        console.error('Error renaming video:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to rename video',
        });
    }
});

module.exports = router;
