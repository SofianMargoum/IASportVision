/**
 * Routes admin pour la gestion des clubs IA Sport Vision.
 *
 *   GET    /admin/clubs                  Liste des clubs en base
 *   POST   /admin/clubs                  Ajoute un club { fff_cl_no, name, logo_url }
 *   DELETE /admin/clubs/:id              Supprime un club
 *
 *   GET    /admin/fff/clubs/search?q=... Proxy DOFA — recherche par nom
 *   GET    /admin/fff/clubs/:cl_no       Proxy DOFA — récupération directe
 *
 * Toutes les routes exigent un JWT valide ET un rôle = 'admin'.
 * Les routes proxy DOFA évitent d'exposer l'API tierce au navigateur et
 * normalisent les réponses au format { fff_cl_no, name, logo_url }.
 */

const express = require('express');
const router = express.Router();

const { requireAuth, requireRole } = require('../auth/jwt');
const {
  listClubs,
  findById,
  createClub,
  deleteClub,
  UUID_RE,
} = require('../db/clubStore');

// Middleware scopé aux chemins admin uniquement (sans path, il bloquerait
// aussi des routes non-admin déclarées dans d'autres fichiers).
router.use(['/admin/clubs', '/admin/fff'], requireAuth, requireRole('admin'));

const DOFA_BASE = 'https://api-dofa.fff.fr/api/clubs';
const DOFA_TIMEOUT_MS = 10_000;
const SEARCH_MAX_LEN = 100;

// Validation cl_no DOFA — alphanumérique + tirets, longueur raisonnable.
const CL_NO_RE = /^[A-Za-z0-9_-]{1,64}$/;

function ensureUuid(req, res) {
  if (!UUID_RE.test(req.params.id || '')) {
    res.status(400).json({ status: 'error', message: 'Identifiant invalide.' });
    return false;
  }
  return true;
}

function handleError(res, err, context) {
  const status = Number(err?.status) || 500;
  if (status >= 500) {
    console.error(`[admin/clubs:${context}] erreur :`, err?.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
  return res.status(status).json({
    status: 'error',
    message: err?.message || 'Requête invalide.',
  });
}

// --- Helpers DOFA ----------------------------------------------------------

/**
 * Normalise un objet club retourné par DOFA en { fff_cl_no, name, logo_url }.
 */
function normalizeDofaClub(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cl = raw.cl_no ?? raw.clNo ?? raw.id ?? null;
  if (cl === null || cl === undefined || cl === '') return null;
  return {
    fff_cl_no: String(cl),
    name: typeof raw.name === 'string' ? raw.name : (raw.libelle || ''),
    logo_url: typeof raw.logo === 'string' ? raw.logo : (raw.logo_url || null),
  };
}

/**
 * Extrait la liste depuis une réponse DOFA (Hydra ou tableau brut).
 */
function extractList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data['hydra:member'])) return data['hydra:member'];
  if (data && Array.isArray(data.member)) return data.member;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

async function dofaFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOFA_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      // 404 = club inconnu, autres = erreur upstream.
      const e = new Error(`DOFA HTTP ${resp.status}`);
      e.status = resp.status === 404 ? 404 : 502;
      throw e;
    }
    return await resp.json();
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Délai dépassé côté DOFA.');
      err.status = 504;
      throw err;
    }
    if (!e.status) {
      const err = new Error('Erreur lors de l\'appel DOFA.');
      err.status = 502;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// --- Routes admin clubs ----------------------------------------------------

/**
 * GET /admin/clubs
 */
router.get('/admin/clubs', async (req, res) => {
  try {
    const clubs = await listClubs();
    return res.status(200).json({ status: 'ok', clubs });
  } catch (err) {
    return handleError(res, err, 'list');
  }
});

/**
 * POST /admin/clubs
 * Body : { fff_cl_no, name, logo_url? }
 */
router.post('/admin/clubs', async (req, res) => {
  try {
    const { fff_cl_no, name, logo_url } = req.body || {};
    if (!fff_cl_no || !name) {
      return res.status(400).json({
        status: 'error',
        message: 'Champs requis : fff_cl_no, name.',
      });
    }
    const club = await createClub({ fff_cl_no, name, logo_url });
    return res.status(201).json({ status: 'ok', club });
  } catch (err) {
    return handleError(res, err, 'create');
  }
});

/**
 * DELETE /admin/clubs/:id
 */
router.delete('/admin/clubs/:id', async (req, res) => {
  if (!ensureUuid(req, res)) return;
  try {
    const club = await deleteClub(req.params.id);
    if (!club) {
      return res.status(404).json({ status: 'error', message: 'Club introuvable.' });
    }
    return res.status(200).json({ status: 'ok', club });
  } catch (err) {
    return handleError(res, err, 'delete');
  }
});

// --- Routes proxy DOFA -----------------------------------------------------

/**
 * GET /admin/fff/clubs/search?q=...
 * Recherche un club par nom via DOFA. Renvoie une liste normalisée.
 */
router.get('/admin/fff/clubs/search', async (req, res) => {
  try {
    const raw = typeof req.query.q === 'string' ? req.query.q : '';
    const cleaned = raw.trim().slice(0, SEARCH_MAX_LEN);
    if (!cleaned) {
      return res.status(200).json({ status: 'ok', clubs: [] });
    }
    const url = `${DOFA_BASE}?clNom=${encodeURIComponent(cleaned)}`;
    const data = await dofaFetch(url);
    const clubs = extractList(data)
      .map(normalizeDofaClub)
      .filter(Boolean);
    return res.status(200).json({ status: 'ok', clubs });
  } catch (err) {
    return handleError(res, err, 'search');
  }
});

/**
 * GET /admin/fff/clubs/:cl_no
 * Récupère un club DOFA par son cl_no.
 */
router.get('/admin/fff/clubs/:cl_no', async (req, res) => {
  try {
    const clNo = String(req.params.cl_no || '').trim();
    if (!CL_NO_RE.test(clNo)) {
      return res.status(400).json({ status: 'error', message: 'cl_no invalide.' });
    }
    const url = `${DOFA_BASE}/${encodeURIComponent(clNo)}`;
    const data = await dofaFetch(url);
    const club = normalizeDofaClub(data);
    if (!club) {
      return res.status(404).json({ status: 'error', message: 'Club introuvable côté DOFA.' });
    }
    return res.status(200).json({ status: 'ok', club });
  } catch (err) {
    return handleError(res, err, 'fetch');
  }
});

module.exports = router;
