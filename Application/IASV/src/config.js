let selectedClub = null;
let selectedCompetition = null;

// Créer un objet d'événement personnalisé pour notifier des changements
const eventEmitter = new EventTarget();

const setSelectedClub = (club) => {
  selectedClub = club;
  localStorage.setItem('selectedClub', JSON.stringify(club));
  
  // Déclencher l'événement lorsqu'un club est sélectionné
  eventEmitter.dispatchEvent(new CustomEvent('clubChanged', { detail: club }));
};

const getSelectedClub = () => {
  if (!selectedClub) {
    selectedClub = JSON.parse(localStorage.getItem('selectedClub'));
  }
  return selectedClub;
};

const setSelectedCompetition = (competition) => {
  selectedCompetition = competition;
  localStorage.setItem('selectedCompetition', competition);
  
  // Déclencher l'événement lorsqu'une compétition est sélectionnée
  eventEmitter.dispatchEvent(new CustomEvent('competitionChanged', { detail: competition }));
};

const getSelectedCompetition = () => {
  if (!selectedCompetition) {
    selectedCompetition = localStorage.getItem('selectedCompetition');
  }
  return selectedCompetition;
};

const onClubChange = (callback) => {
  eventEmitter.addEventListener('clubChanged', (event) => {
    callback(event.detail);
  });
};

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
  onClubChange,
  onCompetitionChange,
};
