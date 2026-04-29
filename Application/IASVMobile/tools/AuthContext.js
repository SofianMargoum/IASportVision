import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (userData) => {
    // Ne jamais logger userData : peut contenir un token, email, etc.
    if (__DEV__) {
      console.log('Connexion utilisateur (id only):', userData?.id ?? '[anonymous]');
    }
    setUser(userData);
  };

  const logout = () => {
    if (__DEV__) {
      console.log('Déconnexion de l\'utilisateur');
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
