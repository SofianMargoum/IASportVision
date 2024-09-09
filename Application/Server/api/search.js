const express = require('express');
const router = express.Router();
const xml2js = require('xml2js');

router.get('/search', async (req, res) => {
  try {
    const { default: DigestFetch } = await import('digest-fetch');
    const client = new DigestFetch('admin', 'Vidauban');

    const endTime = req.query.endTime ? new Date(req.query.endTime) : new Date();
    const startTime = req.query.startTime ? new Date(req.query.startTime) : new Date(endTime.getTime() - 6 * 60 * 60 * 1000);
    const startTimeISO = startTime.toISOString();
    const endTimeISO = endTime.toISOString();

    const bodyXML = `
      <CMSearchDescription>
        <searchID>1</searchID>
        <trackIDList>
          <trackID>101</trackID>
        </trackIDList>
        <timeSpanList>
          <timeSpan>
            <startTime>${startTimeISO}</startTime>
            <endTime>${endTimeISO}</endTime>
          </timeSpan>
        </timeSpanList>
        <maxResults>40</maxResults>
        <searchResultPostion>0</searchResultPostion>
        <metadataList>
          <metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor>
        </metadataList>
      </CMSearchDescription>`;

    const response = await client.fetch('http://91.170.83.13:60000/ISAPI/ContentMgmt/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: bodyXML,
    });

    if (!response.ok) {
      throw new Error('Failed to perform search');
    }

    const data = await response.text();

    xml2js.parseString(data, { explicitArray: false, mergeAttrs: true }, (err, result) => {
      if (err) {
        throw new Error('Failed to parse XML');
      }

      const matchList = result.CMSearchResult.matchList.searchMatchItem;
      if (Array.isArray(matchList) && matchList.length > 0) {
        const lastMatchItem = matchList[matchList.length - 1];
        let playbackURI = lastMatchItem.mediaSegmentDescriptor.playbackURI;

        playbackURI = playbackURI.replace(/rtsp:\/\/[\d\.]+/, 'rtsp://admin:Vidauban@91.170.83.13:55400');
        playbackURI = playbackURI.replace('&amp;', '&');

        const startTimeMatch = playbackURI.match(/starttime=(\d{8}T\d{6}Z)/);
        const endTimeMatch = playbackURI.match(/endtime=(\d{8}T\d{6}Z)/);

        if (startTimeMatch && endTimeMatch) {
          const startTime = new Date(startTimeMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
          const endTime = new Date(endTimeMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));

          const videoDuration = ((endTime - startTime) / 1000)-1;

          res.status(200).json({ playbackURI, videoDuration });
        } else {
          res.status(404).json({ message: 'Failed to extract times from playbackURI' });
        }
      } else {
        res.status(404).json({ message: 'No search match items found' });
      }
    });

  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({ message: 'Failed to perform search', error: error.message });
  }
});

module.exports = router;
