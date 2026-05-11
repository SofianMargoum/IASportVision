/**
 * Routes admin pour la gestion des caméras (table `devices`).
 *
 *   GET    /admin/devices       Liste des caméras enregistrées (avec club joint)
 *   POST   /admin/devices       Rattache une caméra HikConnect à un club existant
 *   DELETE /admin/devices/:id   Supprime une caméra enregistrée
 *
 * Toutes les routes exigent un JWT valide ET un rôle = 'admin'.
 */

const express = require('express');
const router = express.Router();

const { requireAuth, requireRole } = require('../auth/jwt');
const {
  listDevices,
  createDevice,
  deleteDevice,
  UUID_RE,
} = require('../db/deviceStore');

// Middleware scopé à /admin/devices uniquement.
// /!\ Sans path, `router.use(...)` s'appliquerait à TOUTES les requêtes
// passant par ce router (monté à `/`), bloquant ainsi des routes non-admin
// déclarées dans d'autres fichiers (ex: GET /devices pour les coaches).
router.use('/admin/devices', requireAuth, requireRole('admin'));

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
    console.error(`[admin/devices:${context}] erreur :`, err?.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
  return res.status(status).json({
    status: 'error',
    message: err?.message || 'Requête invalide.',
  });
}

/**
 * GET /admin/devices
 */
router.get('/admin/devices', async (req, res) => {
  try {
    const devices = await listDevices();
    return res.status(200).json({ status: 'ok', devices });
  } catch (err) {
    return handleError(res, err, 'list');
  }
});

/**
 * POST /admin/devices
 * Body : { club_id, hik_device_id, name?, serial_number?, status?, raw_data? }
 */
router.post('/admin/devices', async (req, res) => {
  try {
    const {
      club_id,
      hik_device_id,
      device_id,
      camera_id,
      name,
      serial_number,
      status,
      raw_data,
    } = req.body || {};

    // On accepte soit (camera_id) soit (hik_device_id) comme identifiant
    // unique. Le mobile envoie camera_id ; l'admin web aussi.
    if (!club_id || (!hik_device_id && !camera_id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Champs requis : club_id, camera_id (ou hik_device_id).',
      });
    }

    const device = await createDevice({
      club_id,
      hik_device_id,
      device_id,
      camera_id,
      name,
      serial_number,
      status,
      raw_data,
    });
    return res.status(201).json({ status: 'ok', device });
  } catch (err) {
    return handleError(res, err, 'create');
  }
});

/**
 * DELETE /admin/devices/:id
 */
router.delete('/admin/devices/:id', async (req, res) => {
  if (!ensureUuid(req, res)) return;
  try {
    const device = await deleteDevice(req.params.id);
    if (!device) {
      return res.status(404).json({ status: 'error', message: 'Caméra introuvable.' });
    }
    return res.status(200).json({ status: 'ok', device });
  } catch (err) {
    return handleError(res, err, 'delete');
  }
});

module.exports = router;
