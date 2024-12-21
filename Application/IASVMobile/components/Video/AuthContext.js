import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (userData) => {
    console.log('Connexion de l\'utilisateur avec les données :', userData); // Debug
    setUser(userData);
  };

  const logout = () => {
    console.log('Déconnexion de l\'utilisateur');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
