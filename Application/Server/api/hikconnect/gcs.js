const { Storage } = require('@google-cloud/storage');

// Google Cloud Storage
const storage = new Storage();
const bucketName = 'ia-sport.appspot.com';
const bucket = storage.bucket(bucketName);

module.exports = {
  storage,
  bucketName,
  bucket,
};
