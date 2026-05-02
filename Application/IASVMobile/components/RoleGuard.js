import React from 'react';
import { useUserRole } from '../tools/UserRoleContext';
import { ROLES } from '../constants/roles';

/**
 * <RoleGuard allowedRoles={[ROLES.COACH, ROLES.PLAYER]}>
 *    ...contenu protégé...
 * </RoleGuard>
 *
 * - Admin a toujours accès (court-circuit).
 * - Si `allowedRoles` est vide ou non fourni, on considère la zone réservée à l'Admin.
 * - On peut fournir un `fallback` à afficher si l'accès est refusé (sinon null).
 */
const RoleGuard = ({ allowedRoles, blockName, fallback = null, children }) => {
  const { role, isAdmin, canViewBlock } = useUserRole();

  if (isAdmin) return <>{children}</>;
  if (!role) return fallback;

  // Si on passe un blockName, on s'appuie sur la config centralisée.
  if (blockName) {
    return canViewBlock(blockName) ? <>{children}</> : fallback;
  }

  const list = Array.isArray(allowedRoles) ? allowedRoles : [];
  // Liste vide => Admin-only (déjà géré au-dessus).
  if (list.length === 0) return fallback;

  return list.includes(role) ? <>{children}</> : fallback;
};

export { ROLES };
export default RoleGuard;
