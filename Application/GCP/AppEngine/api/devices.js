/**
 * Routes "devices" pour les clients mobiles (coach / player / admin).
 *
 *   GET /devices  Liste des caméras visibles par l'utilisateur connecté :
 *                   - admin                 -> toutes les caméras
 *                   - autre rôle avec club  -> caméras du club du user
 *                   - autre rôle sans club  -> liste vide
 *
 * Auth : JWT obligatoire (req.auth = { userId, role }).
 * Le filtrage côté serveur garantit qu'un user ne peut JAMAIS voir
 * les caméras d'un autre club, même en bricolant la requête.
 */

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../auth/jwt');
const { listDevices, findByClubId } = require('../db/deviceStore');
const { findById: findUserById } = require('../auth/userStore');

router.get('/devices', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const role = String(req.auth?.role || '').toLowerCase();

    console.log('[GET /devices]', { userId, role });

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Token invalide.' });
    }

    // Admin : voit tout, tous clubs confondus.
    if (role === 'admin') {
      const devices = await listDevices();
      return res.status(200).json({ status: 'ok', devices, scope: 'all' });
    }

    // Autres rôles : on récupère le clubId du user depuis la base
    // (pas depuis le JWT, qui ne le contient pas et ne doit pas être
    // une source de vérité pour des données mutables).
    const user = await findUserById(userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ status: 'error', message: 'Compte invalide.' });
    }

    const clubId = user.clubId || null;
    if (!clubId) {
      return res.status(200).json({ status: 'ok', devices: [], scope: 'club', clubId: null });
    }

    const devices = await findByClubId(clubId);
    return res.status(200).json({ status: 'ok', devices, scope: 'club', clubId });
  } catch (err) {
    console.error('[devices:list]', err?.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

module.exports = router;
