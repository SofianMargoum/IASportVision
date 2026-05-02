import { ROLES } from '../constants/roles';

/**
 * Configuration centralisée des permissions.
 * -------------------------------------------------------------------
 * Pour modifier les droits, il suffit d'éditer ce fichier.
 *
 * - PAGE_PERMISSIONS : quels rôles peuvent voir telle page / onglet.
 * - BLOCK_PERMISSIONS : quels rôles peuvent voir tel bloc à l'intérieur d'une page.
 *
 * Convention :
 *   - Liste des rôles autorisés (hors Admin, qui a toujours accès à tout).
 *   - Si une clé est absente, on considère par défaut que la page/bloc
 *     est visible par tous les rôles authentifiés.
 */

export const PAGES = {
  RECORD: 'record',
  RESULTAT: 'resultat',
  VIDEO: 'video',
  EXPLORE: 'explore',
  PROFILE: 'profile',
};

export const PAGE_PERMISSIONS = {
  [PAGES.RECORD]: [ROLES.COACH],
  [PAGES.RESULTAT]: [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER],
  [PAGES.VIDEO]: [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER],
  [PAGES.EXPLORE]: [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER],
  [PAGES.PROFILE]: [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER],
};

// Exemple : on pourra remplir progressivement bloc par bloc.
// Clé conseillée : 'pageName.blockName' (libre).
export const BLOCK_PERMISSIONS = {
  // 'profile.adminPanel': [], // -> seulement Admin
  // 'resultat.editScore': [ROLES.COACH],
};

// ---------- Helpers ----------

export const isAdmin = (role) => role === ROLES.ADMIN;

export const canViewPage = (role, pageName) => {
  if (!role) return false;
  if (isAdmin(role)) return true;
  const allowed = PAGE_PERMISSIONS[pageName];
  // Pas de configuration => visible par défaut (sauf Admin-only forcé ailleurs).
  if (!allowed) return true;
  return allowed.includes(role);
};

export const canViewBlock = (role, blockName) => {
  if (!role) return false;
  if (isAdmin(role)) return true;
  const allowed = BLOCK_PERMISSIONS[blockName];
  if (!allowed) return true;
  return allowed.includes(role);
};

// ---------- Visibilité fine des écrans (Profile menu, etc.) ----------
//
// Permissions par écran : on combine un set de rôles autorisés et un flag
// `requireAuth` qui permet de réserver certains écrans aux utilisateurs
// authentifiés (ex: Appareils pour Coach connecté).

export const SCREENS = {
  EFFECTIF: 'Effectif',
  COMPOSITION: 'Composition',
  STATISTIQUES: 'Statistiques',
  APPAREILS: 'Appareils',
  BOUTIQUE: 'Boutique',
  PROFILE: 'Profile',
  ADMIN: 'Admin',
};

export const SCREEN_ACCESS = {
  // Coach + Supporter (lecture seule pour Supporter, géré côté UI)
  [SCREENS.EFFECTIF]: { roles: [ROLES.COACH, ROLES.SUPPORTER], requireAuth: false },
  [SCREENS.COMPOSITION]: { roles: [ROLES.COACH], requireAuth: false },
  [SCREENS.STATISTIQUES]: { roles: [ROLES.COACH], requireAuth: false },

  // Coach connecté uniquement
  [SCREENS.APPAREILS]: { roles: [ROLES.COACH], requireAuth: true },

  // Boutique pour tous
  [SCREENS.BOUTIQUE]: {
    roles: [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER],
    requireAuth: false,
  },

  // Profil personnel : Joueur (visiteur ou connecté)
  [SCREENS.PROFILE]: { roles: [ROLES.PLAYER], requireAuth: false },

  // Gestion utilisateurs : Admin connecté uniquement
  [SCREENS.ADMIN]: { roles: [ROLES.ADMIN], requireAuth: true },
};

export const canViewScreen = (role, screen, isAuthenticated = false) => {
  if (isAdmin(role)) return true;
  if (!role) return false;
  const cfg = SCREEN_ACCESS[screen];
  if (!cfg) return true;
  if (!cfg.roles.includes(role)) return false;
  if (cfg.requireAuth && !isAuthenticated) return false;
  return true;
};

/**
 * Retourne la liste des écrans visibles pour un rôle donné,
 * en prenant en compte le statut d'authentification.
 *
 * @param {string|null} role - rôle effectif (user.role > selectedProfile)
 * @param {boolean} isAuthenticated - utilisateur connecté ?
 * @returns {string[]} liste des clés d'écrans visibles
 */
export const getVisibleScreens = (role, isAuthenticated = false) => {
  return Object.values(SCREENS).filter((screen) =>
    canViewScreen(role, screen, isAuthenticated),
  );
};

export default {
  isAdmin,
  canViewPage,
  canViewBlock,
  canViewScreen,
  getVisibleScreens,
  PAGES,
  SCREENS,
  PAGE_PERMISSIONS,
  BLOCK_PERMISSIONS,
  SCREEN_ACCESS,
};
