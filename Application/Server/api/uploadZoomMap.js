const express = require('express');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

const router = express.Router();

const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

router.post('/uploadZoomMap', async (req, res) => {
  const { filename, data } = req.body;

  if (!filename || !data) {
    return res.status(400).json({
      status: 'error',
      message: 'Filename et data sont requis'
    });
  }

  const localPath = path.join('/tmp', path.basename(filename));
  const remotePath = filename.startsWith('/') ? filename.slice(1) : filename;

  try {
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2));

    await bucket.upload(localPath, {
      destination: remotePath,
      contentType: 'application/json',
	  metadata: {
		cacheControl: 'no-cache, max-age=0', // <-- important
	  },
    });

    console.log(`✅ ZoomMap uploadé : ${remotePath}`);

    fs.unlinkSync(localPath);

    return res.status(200).json({
      status: 'success',
      message: `ZoomMap uploaded to ${remotePath}`,
      gcsUrl: `https://storage.googleapis.com/${bucketName}/${remotePath}`
    });
  } catch (error) {
    console.error('❌ Erreur upload ZoomMap :', error);
    return res.status(500).json({
      status: 'error',
      message: 'Upload failed',
      error: error.message
    });
  }
});

module.exports = router;
