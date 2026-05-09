// IASVWeb — serveur statique SPA pour App Engine (service: iasvweb)
// - Sert les assets buildés par CRA (./build)
// - Cache long pour /static/** (fichiers hashés par CRA)
// - Cache court / no-cache pour index.html
// - Fallback SPA : toute route inconnue renvoie index.html (React Router)

'use strict';

const path = require('path');
const express = require('express');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8080;
const BUILD_DIR = path.join(__dirname, 'build');
const INDEX_HTML = path.join(BUILD_DIR, 'index.html');

// Sécurité minimale : headers utiles
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Healthcheck léger pour App Engine
app.get('/_ah/health', (_req, res) => res.status(200).send('ok'));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Assets hashés par CRA (immutables) → cache long
app.use(
  '/static',
  express.static(path.join(BUILD_DIR, 'static'), {
    immutable: true,
    maxAge: '1y',
    fallthrough: true,
  })
);

// Tous les autres fichiers du build (favicon, manifest, images publiques, etc.)
app.use(
  express.static(BUILD_DIR, {
    index: false,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// Fallback SPA : toute route GET → index.html
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[iasvweb] listening on :${PORT} (build=${BUILD_DIR})`);
});
