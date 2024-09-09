// api/google.js

const express = require('express');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();

// Remplacez par votre ID client OAuth 2.0
const CLIENT_ID = '417232013163-v2genb8j1f3odhrjt40hm9fsghgodgrl.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

// Route pour vérifier le token Google
router.post('/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  try {
    // Vérifier le token avec Google
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: userId, name, email, picture } = payload;

    // Répondre avec les informations de l'utilisateur
    res.json({
      userId,
      name,
      email,
      picture,
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
