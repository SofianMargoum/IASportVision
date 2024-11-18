import React, { createContext, useContext, useState } from 'react';

// Créer le contexte
const ClubContext = createContext();

// Créer le provider
export const ClubProvider = ({ children }) => {
  const [selectedClub, setSelectedClub] = useState(null);
  const [clNo, setClNo] = useState(null); // Ajout de cl_no
  const [competition, setCompetition] = useState(null); // Ajout de competition

  return (
    <ClubContext.Provider value={{ selectedClub, setSelectedClub, clNo, setClNo, competition, setCompetition }}>
      {children}
    </ClubContext.Provider>
  );
};

// Hook personnalisé pour utiliser le contexte
export const useClubContext = () => {
  return useContext(ClubContext);
};
