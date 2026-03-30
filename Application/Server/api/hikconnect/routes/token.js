const express = require('express');

const { getToken } = require('../client');

const router = express.Router();

// Token (debug)
router.get('/hikconnect/token', async (req, res) => {
  try {
    const token = await getToken(false);
    res.status(200).json(token);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, details: err.details });
  }
});

module.exports = router;
