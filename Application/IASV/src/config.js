let selectedClub = null;
let selectedCompetition = null;
let recentClubs = [];  // Ajout d'une variable pour stocker les clubs récents

const eventEmitter = new EventTarget();

// Enregistrer le club sélectionné
const setSelectedClub = (club) => {
  selectedClub = club;
  localStorage.setItem('selectedClub', JSON.stringify(club));
  
  // Mettre à jour la liste des clubs récents
  recentClubs = [club, ...recentClubs.filter(c => c.cl_no !== club.cl_no)].slice(0, 3);
  localStorage.setItem('recentClubs', JSON.stringify(recentClubs));  // Sauvegarder les 3 derniers clubs

  eventEmitter.dispatchEvent(new CustomEvent('clubChanged', { detail: club }));
};

// Obtenir le club sélectionné
const getSelectedClub = () => {
  if (!selectedClub) {
    selectedClub = JSON.parse(localStorage.getItem('selectedClub'));
  }
  return selectedClub;
};

// Enregistrer la compétition sélectionnée
const setSelectedCompetition = (competition) => {
  selectedCompetition = competition;
  localStorage.setItem('selectedCompetition', competition);
  
  eventEmitter.dispatchEvent(new CustomEvent('competitionChanged', { detail: competition }));
};

// Obtenir la compétition sélectionnée
const getSelectedCompetition = () => {
  if (!selectedCompetition) {
    selectedCompetition = localStorage.getItem('selectedCompetition');
  }
  return selectedCompetition;
};

// Obtenir les trois derniers clubs sélectionnés
const getRecentClubs = () => {
  if (recentClubs.length === 0) {
    recentClubs = JSON.parse(localStorage.getItem('recentClubs')) || [];
  }
  return recentClubs;
};

// S'abonner aux changements du club
const onClubChange = (callback) => {
  eventEmitter.addEventListener('clubChanged', (event) => {
    callback(event.detail);
  });
};

// S'abonner aux changements de compétition
const onCompetitionChange = (callback) => {
  eventEmitter.addEventListener('competitionChanged', (event) => {
    callback(event.detail);
  });
};

module.exports = {
  setSelectedClub,
  getSelectedClub,
  setSelectedCompetition,
  getSelectedCompetition,
  getRecentClubs,  // Exporter la fonction pour obtenir les clubs récents
  onClubChange,
  onCompetitionChange,
};
