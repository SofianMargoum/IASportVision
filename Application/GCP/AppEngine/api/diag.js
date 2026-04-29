// routes/diag.js
const express = require('express');
const router = express.Router();
const dns = require('node:dns').promises;
const net = require('node:net');

// Allowlist des hosts que cette route peut sonder.
// Seule la base de données PostgreSQL et l'instance Cloud SQL proxy sont autorisées.
// Ajouter ici d'autres hosts internes légitimes si besoin.
const ALLOWED_DIAG_HOSTS = new Set(
  (process.env.DIAG_ALLOWED_HOSTS || '34.163.248.199,127.0.0.1,localhost')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

// Ports autorisés : uniquement PostgreSQL + Cloud SQL Auth Proxy
const ALLOWED_DIAG_PORTS = new Set(
  (process.env.DIAG_ALLOWED_PORTS || '5432,3307')
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536)
);

router.get('/diag/reach', async (req, res) => {
  const host = String(req.query.host || '').trim().toLowerCase();
  const port = Number(req.query.port);

  if (!host || !port) return res.status(400).json({ message: 'host & port required' });

  if (!ALLOWED_DIAG_HOSTS.has(host)) {
    return res.status(403).json({ message: 'Host not in allowlist' });
  }
  if (!ALLOWED_DIAG_PORTS.has(port)) {
    return res.status(403).json({ message: 'Port not in allowlist' });
  }

  let dnsInfo = null;
  try { dnsInfo = await dns.lookup(host); } catch (e) { dnsInfo = { error: e.code || 'DNS_ERROR' }; }

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
    s.once('error', (err) => done(false, err?.code || 'ERROR'));
    s.connect(port, host);
  });

  res.status(tcpProbe.ok ? 200 : 502).json({ host, port, dns: dnsInfo, tcp: tcpProbe });
});

module.exports = router;
