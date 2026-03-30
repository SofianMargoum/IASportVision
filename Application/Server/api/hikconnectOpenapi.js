// api/hikconnectOpenapi.js
// Split implementation: one file per API group under ./hikconnect/

const express = require('express');

const router = express.Router();

// Routes (keep the same URLs as before)
router.use(require('./hikconnect/routes/token'));
router.use(require('./hikconnect/routes/resources'));
router.use(require('./hikconnect/routes/recording'));
router.use(require('./hikconnect/routes/video'));

// Re-export helpers for backward compatibility
const client = require('./hikconnect/client');
const resources = require('./hikconnect/resources');
const recording = require('./hikconnect/recording');
const video = require('./hikconnect/video');

module.exports = {
  router,
  ...client,
  ...resources,
  ...recording,
  ...video,
};
