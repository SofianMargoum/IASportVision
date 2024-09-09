const express = require('express');
const router = express.Router();
const xml2js = require('xml2js');

router.put('/stop-recording', async (req, res) => {
  try {
    // Importer le module digest-fetch dynamiquement
    const { default: DigestFetch } = await import('digest-fetch');

    const client = new DigestFetch('admin', 'Vidauban');

    // Requête PUT avec digest-fetch
    const response = await client.fetch('http://91.170.83.13:60000/ISAPI/ContentMgmt/record/control/manual/stop/tracks/1', {
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
    console.error('Error stoping recording:', error);
    res.status(500).json({ message: 'Failed to stop recording', error: error.message });
  }
});

module.exports = router;
