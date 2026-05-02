/**
 * Runner de migrations SQL.
 *
 * Usage :
 *   node db/migrate.js
 *
 * Charge tous les fichiers .sql de db/migrations dans l'ordre alphanumérique
 * et les exécute. Suivi via la table `schema_migrations`.
 *
 * Idempotent : un fichier déjà appliqué (présent dans schema_migrations)
 * n'est pas rejoué.
 */

try { require('dotenv').config(); } catch {}

const fs = require('fs');
const path = require('path');
const { getPool, close } = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getApplied(pool) {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function applyMigration(pool, filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [filename]
    );
    await client.query('COMMIT');
    console.log(`✓ migration appliquée : ${filename}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const pool = getPool();
  await ensureTable(pool);
  const applied = await getApplied(pool);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const f of files) {
    if (applied.has(f)) {
      console.log(`= déjà appliqué : ${f}`);
      continue;
    }
    await applyMigration(pool, f);
    count += 1;
  }
  console.log(count === 0 ? 'Aucune nouvelle migration.' : `${count} migration(s) appliquée(s).`);
}

main()
  .then(() => close())
  .catch(async (e) => {
    console.error('Échec des migrations :', e.message);
    await close();
    process.exit(1);
  });
