import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Créer le contexte
const ClubContext = createContext();

// Créer le provider
export const ClubProvider = ({ children }) => {
  const [selectedClub, setSelectedClub] = useState(null);
  const [clNo, setClNo] = useState(null); // Numéro du club
  const [competition, setCompetition] = useState(null); // Nom de la compétition
  const [cp_no, setCp_no] = useState(null); // Phase de la compétition
  const [phase, setPhase] = useState(null); // Phase de la compétition
  const [poule, setPoule] = useState(null); // Poule de la compétition
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const savedSelectedClub = await AsyncStorage.getItem('selectedClub');
        const savedSelectedCompetition = await AsyncStorage.getItem('selectedCompetition');

        if (savedSelectedClub) {
          const club = JSON.parse(savedSelectedClub);
          setSelectedClub(club);
          setClNo(club.cl_no);
        }
        if (savedSelectedCompetition) {
          setCompetition(savedSelectedCompetition);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données sauvegardées', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredData();
  }, []);

  return (
    <ClubContext.Provider
      value={{
        selectedClub,
        setSelectedClub,
        cp_no,
        setCp_no,
        clNo,
        setClNo,
        competition,
        setCompetition,
        phase,
        setPhase,
        poule,
        setPoule,
        isLoading,
      }}
    >
      {children}
    </ClubContext.Provider>
  );
};

// Hook personnalisé pour utiliser le contexte
export const useClubContext = () => {
  return useContext(ClubContext);
};
