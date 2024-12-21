import React, { createContext, useState } from 'react';

// Créer le contexte
export const UserContext = createContext();

// Fournisseur de contexte
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); // État global utilisateur

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};
