import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROLES } from '../constants/roles';
import { isAdmin as isAdminFn, canViewPage as canViewPageFn, canViewBlock as canViewBlockFn } from './permissions';

const STORAGE_KEY = 'selectedProfile';

const UserRoleContext = createContext({
  role: null,
  isLoading: true,
  setRole: () => {},
  clearRole: () => {},
  isAdmin: false,
  canViewPage: () => false,
  canViewBlock: () => false,
});

export const UserRoleProvider = ({ children }) => {
  const [role, setRoleState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && Object.values(ROLES).includes(saved)) {
          setRoleState(saved);
        }
      } catch (e) {
        console.error('Erreur chargement userRole', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setRole = useCallback(async (newRole) => {
    if (!Object.values(ROLES).includes(newRole)) {
      console.warn('Rôle invalide ignoré:', newRole);
      return;
    }
    setRoleState(newRole);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newRole);
    } catch (e) {
      console.error('Erreur sauvegarde userRole', e);
    }
  }, []);

  const clearRole = useCallback(async () => {
    setRoleState(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Erreur suppression userRole', e);
    }
  }, []);

  const value = {
    role,
    isLoading,
    setRole,
    clearRole,
    isAdmin: isAdminFn(role),
    canViewPage: (pageName) => canViewPageFn(role, pageName),
    canViewBlock: (blockName) => canViewBlockFn(role, blockName),
  };

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
};

export const useUserRole = () => useContext(UserRoleContext);

export default UserRoleContext;
