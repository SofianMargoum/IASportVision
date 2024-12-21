// index.js

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

// Importer les routes
const helloRoute = require('./api/hello');
const testRoute = require('./api/test');
const searchRoute = require('./api/search');
const videosRoute = require('./api/videos');
const uploadRoute = require('./api/upload');
const startRecordingRoute = require('./api/startRecording');
const stopRecordingRoute = require('./api/stopRecording');
const startLiveViewRoute = require('./api/startLiveView');
const googleAuthRoute = require('./api/google'); // Importer la route Google Auth
const mergeImagesRoute = require('./api/mergeImages'); // Importer la route
//const analyzeVideoRoute = require('./api/analyzeVideo');

// Utiliser les routes
app.use('/api', helloRoute);
app.use('/api', testRoute);
app.use('/api', searchRoute);
app.use('/api', videosRoute);
app.use('/api', uploadRoute);
app.use('/api', startRecordingRoute); 
app.use('/api', stopRecordingRoute); 
app.use('/api', startLiveViewRoute); 
app.use('/api', googleAuthRoute); // Utiliser la route Google Auth
app.use('/api', mergeImagesRoute); // Ajouter la route à Express
//app.use('/api', analyzeVideoRoute);

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
