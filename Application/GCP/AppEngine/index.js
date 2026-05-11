// Auto-load environment variables from .env if dotenv is installed
try {
  require('dotenv').config();
} catch {}

const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Middleware pour parser les corps de requêtes JSON
app.use(express.json());

// Middleware CORS
// En production, restreindre l'origine via la variable d'env ALLOWED_ORIGIN.
// L'API est appelée depuis l'app mobile React Native (pas depuis un navigateur)
// donc CORS n'est pas un vecteur d'attaque critique ici, mais on évite quand
// même le wildcard pour limiter les appels depuis des pages web tierces.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (!ALLOWED_ORIGIN || origin === ALLOWED_ORIGIN) {
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN || '*');
  }
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
  videosRoute: safeRequire('./api/videos'),
  mergeImagesRoute: safeRequire('./api/mergeImages'),
  diagRoute: safeRequire('./api/diag'),
  hikconnectOpenapiRoute: safeRequire('./api/hikconnectOpenapi'),
  uploadFromUrlRoute: safeRequire('./api/upload-from-url'),
  isapiRecordStatusRoute: safeRequire('./api/isapiRecordStatus'),
  authRoute: safeRequire('./api/auth'),
  adminUsersRoute: safeRequire('./api/adminUsers'),
  adminClubsRoute: safeRequire('./api/adminClubs'),
  adminDevicesRoute: safeRequire('./api/adminDevices'),
  devicesRoute: safeRequire('./api/devices'),
};

// Routes montées à la racine "/" plutôt que sous "/api"
const ROOT_MOUNTED = new Set(['authRoute', 'adminUsersRoute', 'adminClubsRoute', 'adminDevicesRoute', 'devicesRoute']);

// Attacher les routes sans faire planter l'API
Object.entries(routes).forEach(([name, route]) => {
  if (route) {
    const router = route.router || route;
    const mountPath = name.startsWith('isapi') || ROOT_MOUNTED.has(name) ? '/' : '/api';
    app.use(mountPath, router);
  } else {
    console.warn(`⚠️  La route ${name} n'a pas été chargée.`);
  }
});

// Middleware global pour capturer les erreurs
app.use((err, req, res, next) => {
  // Ne jamais exposer le stack/message d'erreur interne au client en production.
  console.error('Erreur attrapée par le middleware global:', err?.message || err);
  res.status(err?.status || 500).json({ status: 'error', message: 'Une erreur interne est survenue.' });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`✅ Serveur en ligne sur http://localhost:${port}`);
});
