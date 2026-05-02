// Définition centralisée des rôles utilisateurs.
// L'Admin est volontairement exclu de SELECTABLE_ROLES : il est attribué
// hors de l'UI publique (back-office, configuration manuelle, etc.).

export const ROLES = {
  ADMIN: 'admin',
  COACH: 'coach',
  PLAYER: 'player',
  SUPPORTER: 'supporter',
};

// Rôles proposés à l'utilisateur lors de l'onboarding (page Welcome).
export const SELECTABLE_ROLES = [
  {
    key: ROLES.COACH,
    label: 'Entraîneur',
    description: 'Gérez vos équipes, analysez les matchs et suivez vos joueurs.',
    icon: 'whistle',
  },
  {
    key: ROLES.PLAYER,
    label: 'Joueur',
    description: 'Consultez vos performances et les vidéos de vos matchs.',
    icon: 'running',
  },
  {
    key: ROLES.SUPPORTER,
    label: 'Supporter',
    description: 'Suivez votre club, ses résultats et ses temps forts.',
    icon: 'heart',
  },
];

export default ROLES;
