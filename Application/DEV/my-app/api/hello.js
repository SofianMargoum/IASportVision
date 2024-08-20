const express = require('express');
const router = express.Router();

// Route pour afficher un message "Hello World"
router.get('/hello', (req, res) => {
  res.status(200).json({ message: 'Hello World' });
});

module.exports = router;