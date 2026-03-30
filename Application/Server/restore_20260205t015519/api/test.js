const express = require('express');
const router = express.Router();

// Route pour une autre API, par exemple une route de test
router.get('/test', (req, res) => {
  res.status(200).json({ status: 'success', data: 'This is a test endpoint' });
});

module.exports = router;