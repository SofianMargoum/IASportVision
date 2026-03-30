// api/analyzeVideo.js

const express = require('express');
const { Storage } = require('@google-cloud/storage');
const cv = require('opencv4nodejs');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const storage = new Storage();

// Middleware pour vérifier les requêtes
router.post('/analyzeVideo', async (req, res) => {
    const { videoUri } = req.body;

    // Vérifiez que videoUri est fourni
    if (!videoUri) {
        return res.status(400).json({
            status: 'error',
            message: 'Le paramètre videoUri est requis.'
        });
    }

    // Définir le chemin local où la vidéo sera stockée
    const localFilePath = path.join(__dirname, '..', 'downloaded_video.mp4'); // Chemin local pour stocker la vidéo téléchargée

    try {
        // Télécharger la vidéo
        await downloadVideo(videoUri, localFilePath);
        console.log(`Vidéo téléchargée à : ${localFilePath}`);

        // Traiter la vidéo
        await processVideo(localFilePath);
        res.status(200).json({ status: 'success', message: 'Vidéo analysée avec succès.' });
    } catch (error) {
        console.error('Erreur lors du téléchargement ou du traitement de la vidéo:', error);
        res.status(500).json({ status: 'error', message: 'Erreur lors de l\'analyse de la vidéo.', error: error.message });
    } finally {
        // Supprimer le fichier vidéo local après traitement
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
    }
});

// Fonction pour télécharger la vidéo
const downloadVideo = async (videoUri, localFilePath) => {
    try {
        const options = {
            destination: localFilePath,
        };

        // Extraire le nom de fichier du videoUri
        const videoFileName = videoUri.split('/').pop();
        
        // Télécharger le fichier vidéo depuis GCS
        await storage.bucket('ia-sport.appspot.com').file(videoFileName).download(options);
    } catch (error) {
        throw new Error(`Erreur lors du téléchargement de la vidéo : ${error.message}`);
    }
};

// Définir la fonction pour charger le modèle YOLO
const loadYolo = () => {
    try {
        const net = cv.readNetFromDarknet('yolo/yolov3.cfg', 'yolo/yolov3.weights');
        return net;
    } catch (error) {
        throw new Error('Erreur lors du chargement du modèle YOLO : ' + error.message);
    }
};

// Détection d'objets
const detectObjects = (frame, net) => {
    const blob = cv.blobFromImage(frame, 0.00392, new cv.Size(416, 416), new cv.Vec(0, 0, 0), true, false);
    net.setInput(blob);
    const outputLayers = net.getUnconnectedOutLayersNames();
    const detections = net.forward(outputLayers);
    return detections;
};

// Fonction pour traiter la vidéo
const processVideo = async (videoPath) => {
    const net = loadYolo();
    const cap = new cv.VideoCapture(videoPath);
    let done = false;

    while (!done) {
        let frame = cap.read();
        if (frame.empty) {
            done = true;
            break;
        }

        const detections = detectObjects(frame, net);
        const boxes = [];
        const confidences = [];
        const classIds = [];

        detections.forEach(detection => {
            detection.forEach(item => {
                const scores = item.slice(5);
                const classId = scores.argmax();
                const confidence = scores[classId];
                if (confidence > 0.5) { // seuil de confiance
                    const [centerX, centerY, width, height] = item.slice(0, 4).map(num => Math.round(num));
                    const x = Math.round(centerX - width / 2);
                    const y = Math.round(centerY - height / 2);

                    boxes.push(new cv.Rect(x, y, width, height));
                    confidences.push(confidence);
                    classIds.push(classId);
                }
            });
        });

        // Dessiner les boîtes englobantes
        boxes.forEach((box, i) => {
            const label = `Class: ${classIds[i]} Conf: ${confidences[i].toFixed(2)}`;
            frame.drawRectangle(box, new cv.Vec(0, 255, 0), 2);
            frame.putText(label, new cv.Point(box.x, box.y - 5), cv.FONT_HERSHEY_SIMPLEX, 0.5, new cv.Vec(0, 255, 0), 2);
        });

        cv.imshow('Video', frame);
        if (cv.waitKey(1) === 27) { // Touche Esc
            done = true;
        }
    }

    cap.release();
    cv.destroyAllWindows();
};

module.exports = router;
