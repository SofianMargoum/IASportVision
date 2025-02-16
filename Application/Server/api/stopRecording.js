const express = require('express');
const router = express.Router();
const xml2js = require('xml2js');

router.put('/stop-recording', async (req, res) => {
  try {
    // Récupérer les paramètres depuis le corps de la requête
    const { username, password, ipAddress, port } = req.body;

    // Vérifier que tous les paramètres requis sont présents
    if (!username || !password || !ipAddress || !port) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Importer le module digest-fetch dynamiquement
    const { default: DigestFetch } = await import('digest-fetch');

    // Initialiser le client DigestFetch avec les identifiants fournis
    const client = new DigestFetch(username, password);

    // Construire l'URL avec l'adresse IP et le port
    const url = `http://[${ipAddress}]:${port}/ISAPI/ContentMgmt/record/control/manual/stop/tracks/1`;

    // Requête PUT avec digest-fetch
    const response = await client.fetch(url, {
      method: 'PUT',
    });

    if (!response.ok) {
      throw new Error('Failed to stop recording');
    }

    // Lire la réponse en tant que texte brut
    const data = await response.text();

    // Convertir XML en JSON
    xml2js.parseString(data, (err, result) => {
      if (err) {
        throw new Error('Failed to parse XML');
      }
      res.status(200).json(result);
    });

  } catch (error) {
    console.error('Error stopping recording:', error);
    res.status(500).json({ message: 'Failed to stop recording', error: error.message });
  }
});

module.exports = router;
