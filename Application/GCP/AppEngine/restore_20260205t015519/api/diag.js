// routes/diag.js
const express = require('express');
const router = express.Router();
const dns = require('node:dns').promises;
const net = require('node:net');

router.get('/diag/reach', async (req, res) => {
  const host = req.query.host;
  const port = Number(req.query.port);
  if (!host || !port) return res.status(400).json({ message: 'host & port required' });

  let dnsInfo = null;
  try { dnsInfo = await dns.lookup(host); } catch (e) { dnsInfo = { error: e.code || e.message }; }

  const tcpProbe = await new Promise(resolve => {
    const s = new net.Socket();
    const out = { ok: false, code: null, ms: null };
    const t = Date.now();
    s.setTimeout(5000);
    const done = (ok, code) => {
      out.ok = ok; out.code = code || null; out.ms = Date.now() - t;
      try { s.destroy(); } catch {}
      resolve(out);
    };
    s.once('connect', () => done(true));
    s.once('timeout', () => done(false, 'ETIMEDOUT'));
    s.once('error', (err) => done(false, err?.code || err?.message || 'ERROR'));
    s.connect(port, host);
  });

  res.status(tcpProbe.ok ? 200 : 502).json({ host, port, dns: dnsInfo, tcp: tcpProbe });
});

module.exports = router;
