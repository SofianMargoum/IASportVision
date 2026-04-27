const express = require('express');
const router = express.Router();
const xml2js = require('xml2js');

router.post('/search', async (req, res) => {
  try {
    // Extraire les paramètres dynamiques du corps de la requête
    const { username, password, ipAddress, port } = req.body;

    // Vérifier que tous les paramètres requis sont présents
    if (!username || !password || !ipAddress || !port) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const { default: DigestFetch } = await import('digest-fetch');
    const client = new DigestFetch(username, password);

    // Construire le corps XML simplifié
    const bodyXML = `
      <CMSearchDescription>
        <searchID>1</searchID>
        <trackIDList>
          <trackID>101</trackID>
        </trackIDList>
        <maxResults>-1</maxResults>
      </CMSearchDescription>`;

    // Construire l'URL cible
    const url = `http://${ipAddress}:${port}/ISAPI/ContentMgmt/search`;

    // Envoyer la requête
    const response = await client.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: bodyXML,
    });

    if (!response.ok) {
      throw new Error(`Failed to perform search. HTTP status: ${response.status}`);
    }

    const rawData = await response.text();

    // Convertir la réponse XML en JSON
    xml2js.parseString(rawData, { explicitArray: false, mergeAttrs: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        throw new Error('Failed to parse XML');
      }

      const matchList = result?.CMSearchResult?.matchList?.searchMatchItem;
      if (Array.isArray(matchList) && matchList.length > 0) {
        const lastMatchItem = matchList[matchList.length - 1];
        let playbackURI = lastMatchItem?.mediaSegmentDescriptor?.playbackURI;

        if (!playbackURI) {
          return res.status(404).json({ message: 'Playback URI not found in response' });
        }

        playbackURI = playbackURI.replace(
          /rtsp:\/\/[\d\.]+/,
          `rtsp://${username}:${password}@${ipAddress}:55400`
        ).replace('&amp;', '&');

        // Extraire les informations de temps depuis l'URI
        const startTimeMatch = playbackURI.match(/starttime=(\d{8}T\d{6}Z)/);
        const endTimeMatch = playbackURI.match(/endtime=(\d{8}T\d{6}Z)/);

        if (startTimeMatch && endTimeMatch) {
          const startTime = new Date(
            startTimeMatch[1].replace(
              /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,
              '$1-$2-$3T$4:$5:$6Z'
            )
          );
          const endTime = new Date(
            endTimeMatch[1].replace(
              /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,
              '$1-$2-$3T$4:$5:$6Z'
            )
          );

          const videoDuration = Math.max(0, ((endTime - startTime) / 1000) - 1);

          return res.status(200).json({ playbackURI, videoDuration });
        } else {
          return res.status(404).json({ message: 'Failed to extract times from playbackURI' });
        }
      } else {
        return res.status(404).json({ message: 'No search match items found' });
      }
    });
  } catch (error) {
    console.error('Error performing search:', error);
    return res.status(500).json({ message: 'Failed to perform search', error: error.message });
  }
});
module.exports = router;
