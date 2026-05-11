/**
 * Routes admin de gestion des utilisateurs.
 *
 *   POST   /admin/users        Créer un utilisateur
 *   GET    /admin/users        Lister
 *   GET    /admin/users/:id    Lire
 *   PUT    /admin/users/:id    Modifier
 *   DELETE /admin/users/:id    Soft delete (is_active = false)
 *
 * Toutes les routes exigent un JWT valide ET un rôle = 'admin'.
 * Aucune route ne renvoie jamais le hash du mot de passe.
 */

const express = require('express');
const router = express.Router();

const { requireAuth, requireRole } = require('../auth/jwt');
const {
  createUser,
  listUsers,
  findById,
  updateUser,
  softDelete,
} = require('../auth/userStore');

// Middleware scopé à /admin/users uniquement (sans path, il bloquerait
// aussi des routes non-admin déclarées dans d'autres fichiers).
router.use('/admin/users', requireAuth, requireRole('admin'));

// Validation UUID simple — refuse les ids fantaisistes avant de toucher la DB.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ensureUuid(req, res) {
  if (!UUID_RE.test(req.params.id || '')) {
    res.status(400).json({ status: 'error', message: 'Identifiant invalide.' });
    return false;
  }
  return true;
}

/**
 * Wrapper d'erreur : convertit les erreurs métier en réponses HTTP propres.
 * Les erreurs avec `.status` sont renvoyées telles quelles ; sinon 500.
 */
function handleError(res, err, context) {
  const status = Number(err?.status) || 500;
  if (status >= 500) {
    console.error(`[admin/users:${context}] erreur :`, err?.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
  return res.status(status).json({
    status: 'error',
    message: err?.message || 'Requête invalide.',
  });
}

/**
 * POST /admin/users
 * Body : { username, password, name, role, email?, clubId?, photoAsset? }
 */
router.post('/admin/users', async (req, res) => {
  try {
    const { username, password, name, role, email, clubId, photoAsset } = req.body || {};
    if (!username || !password || !name || !role) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Champs requis : username, password, name, role.' });
    }
    const user = await createUser({ username, password, name, role, email, clubId, photoAsset });
    return res.status(201).json({ status: 'ok', user });
  } catch (err) {
    return handleError(res, err, 'create');
  }
});

/**
 * GET /admin/users?limit=&offset=&includeInactive=
 */
router.get('/admin/users', async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const users = await listUsers({
      limit: req.query.limit,
      offset: req.query.offset,
      includeInactive,
    });
    return res.status(200).json({ status: 'ok', users });
  } catch (err) {
    return handleError(res, err, 'list');
  }
});

/**
 * GET /admin/users/:id
 */
router.get('/admin/users/:id', async (req, res) => {
  if (!ensureUuid(req, res)) return;
  try {
    const user = await findById(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Utilisateur introuvable.' });
    }
    return res.status(200).json({ status: 'ok', user });
  } catch (err) {
    return handleError(res, err, 'read');
  }
});

/**
 * PUT /admin/users/:id
 * Body : sous-ensemble de { username, email, password, name, role,
 *                            clubId, photoAsset, isActive }
 */
router.put('/admin/users/:id', async (req, res) => {
  if (!ensureUuid(req, res)) return;
  try {
    // Le user doit exister (sinon updateUser renverrait null silencieusement).
    const existing = await findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Utilisateur introuvable.' });
    }

    const allowed = [
      'username',
      'email',
      'password',
      'name',
      'role',
      'clubId',
      'photoAsset',
      'isActive',
    ];
    const patch = {};
    for (const k of allowed) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, k)) {
        patch[k] = req.body[k];
      }
    }

    // Garde-fou : un admin ne peut pas se rétrograder/désactiver lui-même
    // pour éviter de se verrouiller dehors par accident.
    if (req.params.id === req.auth.userId) {
      if (patch.role !== undefined && patch.role !== 'admin') {
        return res.status(400).json({
          status: 'error',
          message: 'Vous ne pouvez pas changer votre propre rôle admin.',
        });
      }
      if (patch.isActive === false) {
        return res.status(400).json({
          status: 'error',
          message: 'Vous ne pouvez pas vous désactiver vous-même.',
        });
      }
    }

    const user = await updateUser(req.params.id, patch);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Utilisateur introuvable.' });
    }
    return res.status(200).json({ status: 'ok', user });
  } catch (err) {
    return handleError(res, err, 'update');
  }
});

/**
 * DELETE /admin/users/:id  — soft delete (is_active = false).
 */
router.delete('/admin/users/:id', async (req, res) => {
  if (!ensureUuid(req, res)) return;
  if (req.params.id === req.auth.userId) {
    return res.status(400).json({
      status: 'error',
      message: 'Vous ne pouvez pas supprimer votre propre compte admin.',
    });
  }
  try {
    const user = await softDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Utilisateur introuvable.' });
    }
    return res.status(200).json({ status: 'ok', user });
  } catch (err) {
    return handleError(res, err, 'delete');
  }
});

module.exports = router;
