const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Middleware pour parser les corps de requêtes JSON
app.use(express.json());


// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Permet les requêtes depuis localhost:3000 (votre frontend React)
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS'); // Permet les méthodes HTTP spécifiques
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Permet les en-têtes spécifiques
  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Répondre immédiatement pour les requêtes OPTIONS (pré-vol)
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
/*
const stopLiveViewRoute = require('./api/stopLiveView');
const getSnapshotRoute = require('./api/getSnapshot');
*/

// Utiliser les routes
app.use('/api', helloRoute);
app.use('/api', testRoute);
app.use('/api', searchRoute);
app.use('/api', videosRoute);
app.use('/api', uploadRoute);
app.use('/api', startRecordingRoute); 
app.use('/api', stopRecordingRoute); 
app.use('/api', startLiveViewRoute); 
/*
app.use('/api', stopLiveViewRoute); 
app.use('/api', getSnapshotRoute); 
*/
// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
