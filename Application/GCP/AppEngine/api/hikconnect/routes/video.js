// HikConnect video routes — split into focused submodules under ./video/.
// This file just composes the legacy + rolling sub-routers so the public
// surface stays exactly the same as before.

const express = require('express');

const legacyRoutes = require('./video/legacyRoutes');
const rollingRoutes = require('./video/rollingRoutes');

const router = express.Router();

router.use(legacyRoutes);
router.use(rollingRoutes);

module.exports = router;
