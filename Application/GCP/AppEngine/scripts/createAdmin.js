/**
 * Bootstrap : crée le premier utilisateur admin en BDD.
 *
 * Usage (mode interactif via env vars) :
 *   $env:ADMIN_USERNAME="admin"
 *   $env:ADMIN_PASSWORD="<motdepasse_fort>"
 *   $env:ADMIN_NAME="Administrateur"
 *   $env:ADMIN_EMAIL="admin@iasv.fr"      # optionnel
 *   node scripts/createAdmin.js
 *
 * Usage (CLI) :
 *   node scripts/createAdmin.js --username admin --password 'XXX' --name 'Admin' --email admin@iasv.fr
 *
 * Comportement :
 *  - si l'utilisateur existe déjà : message clair, exit 0 (idempotent côté CI).
 *  - sinon : création avec role='admin', is_active=true.
 *  - le mot de passe est hashé (bcrypt) avant insertion.
 */

try { require('dotenv').config(); } catch {}

const { createUser, findByUsernameWithHash } = require('../auth/userStore');
const { close } = require('../db/pool');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const k = argv[i];
    const v = argv[i + 1];
    if (!k || !k.startsWith('--')) continue;
    out[k.slice(2)] = v;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const username = args.username || process.env.ADMIN_USERNAME;
  const password = args.password || process.env.ADMIN_PASSWORD;
  const name = args.name || process.env.ADMIN_NAME || username;
  const email = args.email || process.env.ADMIN_EMAIL || null;

  if (!username || !password) {
    console.error(
      'Usage : node scripts/createAdmin.js --username <u> --password <p> [--name <n>] [--email <e>]'
    );
    console.error('Ou via env : ADMIN_USERNAME, ADMIN_PASSWORD (et optionnellement ADMIN_NAME, ADMIN_EMAIL).');
    process.exit(2);
  }

  const existing = await findByUsernameWithHash(username);
  if (existing) {
    console.log(`Utilisateur "${username}" déjà présent (id=${existing.id}). Rien à faire.`);
    return;
  }

  const user = await createUser({
    username,
    password,
    name,
    role: 'admin',
    email,
  });
  console.log('✓ Administrateur créé :');
  console.log(JSON.stringify(user, null, 2));
}

main()
  .then(() => close())
  .catch(async (e) => {
    console.error('Échec :', e?.message || e);
    await close();
    process.exit(1);
  });
