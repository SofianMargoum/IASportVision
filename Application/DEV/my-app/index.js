const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Middleware pour parser les corps de requêtes JSON
app.use(express.json());

// Importer les routes
const helloRoute = require('./api/hello');
const testRoute = require('./api/test');
const videosRoute = require('./api/videos');
const uploadRoute = require('./api/upload');

// Utiliser les routes
app.use('/api', helloRoute);
app.use('/api', testRoute);
app.use('/api', videosRoute);
app.use('/api', uploadRoute);

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
