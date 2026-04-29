const express = require('express');

const { getToken } = require('../client');

const router = express.Router();

// Token debug endpoint — protégé par secret interne.
// Ne jamais appeler depuis le front-end. Destiné uniquement au debug interne.
router.get('/hikconnect/token', async (req, res) => {
  const secret = process.env.DEBUG_TOKEN_SECRET;
  if (!secret) {
    // Si la variable n'est pas définie, la route est désactivée.
    return res.status(404).json({ message: 'Not found' });
  }
  const got = req.get('x-debug-secret');
  if (!got || !timingSafeEqual(got, secret)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const token = await getToken(false);
    res.status(200).json(token);
  } catch (err) {
    res.status(err.status || 500).json({ message: 'Token error' });
  }
});

function timingSafeEqual(a, b) {
  const crypto = require('node:crypto');
  try {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) {
      // Compare anyway to avoid short-circuit timing leak.
      crypto.timingSafeEqual(ba, Buffer.alloc(ba.length));
      return false;
    }
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

module.exports = router;
