// Auto-load environment variables from .env if dotenv is installed
try {
  require('dotenv').config();
} catch {}

const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const app = express();
const port = process.env.PORT || 8080;

// Configuration du client OAuth2
const CLIENT_ID = '417232013163-v2genb8j1f3odhrjt40hm9fsghgodgrl.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

// Middleware pour parser les corps de requêtes JSON
app.use(express.json());

// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Fonction pour importer les routes en toute sécurité (évite que l'import d'une route plante le serveur)
const safeRequire = (routePath) => {
  try {
    return require(routePath);
  } catch (error) {
    console.error(`Erreur lors du chargement de ${routePath}:`, error.message);
    return null;
  }
};

// Importer les routes
const routes = {
  helloRoute: safeRequire('./api/hello'),
  testRoute: safeRequire('./api/test'),
  searchRoute: safeRequire('./api/search'),
  videosRoute: safeRequire('./api/videos'),
  uploadRoute: safeRequire('./api/upload'),
  uploadandmergeRoute: safeRequire('./api/upload-and-merge'),
  startRecordingRoute: safeRequire('./api/startRecording'),
  startRecordingCloudRoute: safeRequire('./api/startRecordingCloud'),
  stopRecordingRoute: safeRequire('./api/stopRecording'),
  startLiveViewRoute: safeRequire('./api/startLiveView'),
  googleAuthRoute: safeRequire('./api/google'),
  mergeImagesRoute: safeRequire('./api/mergeImages'),
  effectifRoute: safeRequire('./api/effectif'),
  deviceRoute: safeRequire('./api/device'),
  inputEffectifRoute: safeRequire('./api/inputEffectif'),
  uploadZoomMapRoute: safeRequire('./api/uploadZoomMap'),
  diagRoute: safeRequire('./api/diag'),
  hikconnectOpenapiRoute: safeRequire('./api/hikconnectOpenapi'),
  downloadLastRecordingRoute: safeRequire('./api/download-last-recording'),
};

// Attacher les routes sans faire planter l'API
Object.entries(routes).forEach(([name, route]) => {
  if (route) {
    const router = route.router || route;
    app.use('/api', router);
  } else {
    console.warn(`⚠️  La route ${name} n'a pas été chargée.`);
  }
});

// Middleware global pour capturer les erreurs
app.use((err, req, res, next) => {
  console.error('🚨 Erreur attrapée par le middleware global:', err);
  res.status(500).json({ status: 'error', message: 'Une erreur interne est survenue.' });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`✅ Serveur en ligne sur http://localhost:${port}`);
});
