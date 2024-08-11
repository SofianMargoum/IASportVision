const express = require('express');
const { Storage } = require('@google-cloud/storage');
const app = express();
const port = process.env.PORT || 8080;

// Instancier le client Google Cloud Storage
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

// Middleware pour parser les corps de requêtes JSON
app.use(express.json());

// Route pour afficher un message "Hello World"
app.get('/api/hello', (req, res) => {
  res.status(200).json({ message: 'Hello World' });
});

// Route pour une autre API, par exemple une route de test
app.get('/api/test', (req, res) => {
  res.status(200).json({ status: 'success', data: 'This is a test endpoint' });
});

// Route pour obtenir les liens des fichiers vidéo dans un dossier spécifique
app.get('/api/videos', async (req, res) => {
  const folder = req.query.folder || ''; // Obtenir le paramètre de dossier ou utiliser une chaîne vide par défaut

  // Assurer que le préfixe se termine par un '/' pour le filtrage correct des fichiers dans le dossier
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

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
