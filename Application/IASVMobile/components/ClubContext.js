import React, { createContext, useContext, useState } from 'react';

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
