/**
 * Pool PostgreSQL partagé pour l'API.
 *
 * Configuration via variables d'environnement uniquement :
 *   DB_HOST  : hôte TCP, ex. "127.0.0.1" ou "34.163.248.199"
 *              OU socket Cloud SQL : "/cloudsql/<projet>:<region>:<instance>"
 *   DB_PORT  : 5432 par défaut
 *   DB_NAME
 *   DB_USER
 *   DB_PASS
 *   DB_SSL   : "true" pour activer SSL (TCP distant)
 *
 * Sur App Engine, App Engine expose la socket Unix de Cloud SQL à
 * /cloudsql/<connection_name> dès lors que `beta_settings.cloud_sql_instances`
 * est défini dans app.yaml. Dans ce cas on met DB_HOST = /cloudsql/...
 * et on ignore DB_PORT.
 *
 * Ce module est volontairement léger : un seul Pool, exporté.
 */

const { Pool } = require('pg');

function readEnv(name, { required = true, fallback } = {}) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (required) {
      throw new Error(
        `Variable d'environnement ${name} manquante (configuration DB invalide).`
      );
    }
    return fallback;
  }
  return v;
}

function buildPoolConfig() {
  const host = readEnv('DB_HOST');
  const database = readEnv('DB_NAME');
  const user = readEnv('DB_USER');
  const password = readEnv('DB_PASS');
  const port = Number(readEnv('DB_PORT', { required: false, fallback: 5432 }));
  const ssl =
    String(process.env.DB_SSL || '').toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : undefined;

  // Socket Cloud SQL : pas de port, pas de SSL.
  const isUnixSocket = host.startsWith('/');

  return {
    host,
    database,
    user,
    password,
    ...(isUnixSocket ? {} : { port }),
    ...(isUnixSocket ? {} : ssl ? { ssl } : {}),
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'iasv-api',
  };
}

let _pool = null;

/**
 * Récupère le pool partagé. Initialisation paresseuse pour ne pas planter
 * le démarrage si une route DB n'est pas appelée.
 */
function getPool() {
  if (_pool) return _pool;
  _pool = new Pool(buildPoolConfig());
  _pool.on('error', (err) => {
    // Erreurs côté client idle : on log sans planter.
    console.error('[db] pool error:', err?.message);
  });
  return _pool;
}

/**
 * Exécute une requête SQL paramétrée. Toujours utiliser des $1, $2... pour
 * éviter toute injection SQL.
 */
async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}

/**
 * Exécute un bloc dans une transaction. Rollback automatique si erreur.
 */
async function withTransaction(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

async function close() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

module.exports = { getPool, query, withTransaction, close };
