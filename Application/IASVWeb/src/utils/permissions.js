// Inspiré de IASVMobile/tools/permissions.js (adapté web).
import { ROLES } from '../constants/roles';

export const PAGES = {
  DASHBOARD: 'dashboard',
  CLUBS: 'clubs',
  VIDEOS: 'videos',
  USERS: 'users',
  CAMERAS: 'cameras',
  COACH: 'coach',
  PLAYER: 'player',
  SUPPORTER: 'supporter',
  ADMIN: 'admin',
  ANNOTATION: 'annotation',
};

// roles autorisés (Admin a toujours accès via isAdmin).
// requireAuth: page réservée aux utilisateurs connectés.
export const PAGE_ACCESS = {
  [PAGES.DASHBOARD]: { roles: [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER, ROLES.ADMIN], requireAuth: true },
  [PAGES.CLUBS]: { roles: [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER, ROLES.ADMIN], requireAuth: true },
  [PAGES.VIDEOS]: { roles: [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER, ROLES.ADMIN], requireAuth: true },
  [PAGES.USERS]: { roles: [ROLES.ADMIN], requireAuth: true },
  [PAGES.CAMERAS]: { roles: [ROLES.COACH, ROLES.ADMIN], requireAuth: true },
  [PAGES.COACH]: { roles: [ROLES.COACH], requireAuth: true },
  [PAGES.PLAYER]: { roles: [ROLES.PLAYER], requireAuth: true },
  [PAGES.SUPPORTER]: { roles: [ROLES.SUPPORTER], requireAuth: true },
  [PAGES.ADMIN]: { roles: [ROLES.ADMIN], requireAuth: true },
  [PAGES.ANNOTATION]: { roles: [ROLES.ADMIN], requireAuth: true },
};

export const isAdmin = (role) => role === ROLES.ADMIN;

export function canViewPage(role, page, isAuthenticated = false) {
  if (isAdmin(role)) return true;
  const cfg = PAGE_ACCESS[page];
  if (!cfg) return true;
  if (cfg.requireAuth && !isAuthenticated) return false;
  if (!role) return false;
  return cfg.roles.includes(role);
}
