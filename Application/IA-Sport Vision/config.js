import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeEventEmitter } from 'react-native';

// Créer une instance d'EventEmitter sans module natif
const eventEmitter = new NativeEventEmitter();

let selectedClub = null;
let selectedCompetition = null;
let recentClubs = [];

// Enregistrer le club sélectionné
const setSelectedClub = async (club) => {
  selectedClub = club;

  // Stocker le club sélectionné dans AsyncStorage
  await AsyncStorage.setItem('selectedClub', JSON.stringify(club));

  // Mettre à jour la liste des clubs récents
  recentClubs = [club, ...recentClubs.filter(c => c.cl_no !== club.cl_no)].slice(0, 3);

  // Sauvegarder les clubs récents dans AsyncStorage
  await AsyncStorage.setItem('recentClubs', JSON.stringify(recentClubs));

  // Émettre un événement de changement de club
  eventEmitter.emit('clubChanged', club);
};

// Obtenir le club sélectionné
const getSelectedClub = async () => {
  if (!selectedClub) {
    const storedClub = await AsyncStorage.getItem('selectedClub');
    if (storedClub) {
      selectedClub = JSON.parse(storedClub);
    }
  }
  return selectedClub;
};

// Enregistrer la compétition sélectionnée
const setSelectedCompetition = async (competition) => {
  selectedCompetition = competition;

  // Stocker la compétition sélectionnée dans AsyncStorage
  await AsyncStorage.setItem('selectedCompetition', competition);

  // Émettre un événement de changement de compétition
  eventEmitter.emit('competitionChanged', competition);
};

// Obtenir la compétition sélectionnée
const getSelectedCompetition = async () => {
  if (!selectedCompetition) {
    selectedCompetition = await AsyncStorage.getItem('selectedCompetition');
  }
  return selectedCompetition;
};

// Obtenir les trois derniers clubs sélectionnés
const getRecentClubs = async () => {
  if (recentClubs.length === 0) {
    const storedRecentClubs = await AsyncStorage.getItem('recentClubs');
    if (storedRecentClubs) {
      recentClubs = JSON.parse(storedRecentClubs);
    }
  }
  return recentClubs;
};

// S'abonner aux changements du club
const onClubChange = (callback) => {
  const subscription = eventEmitter.addListener('clubChanged', callback); // Ajouter un écouteur

  return () => subscription.remove(); // Fonction pour se désabonner
};

// S'abonner aux changements de compétition
const onCompetitionChange = (callback) => {
  const subscription = eventEmitter.addListener('competitionChanged', callback); // Ajouter un écouteur

  return () => subscription.remove(); // Fonction pour se désabonner
};

// Exporter les fonctions
export default {
  setSelectedClub,
  getSelectedClub,
  setSelectedCompetition,
  getSelectedCompetition,
  getRecentClubs,
  onClubChange,
  onCompetitionChange,
};
