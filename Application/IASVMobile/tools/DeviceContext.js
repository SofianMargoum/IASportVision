import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
  const [devices, setDevices] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const STORAGE_KEYS = {
    DEVICES: 'appareils:list',
    SELECTED_INDEX: 'appareils:selectedIndex',
  };

  // Charger depuis AsyncStorage au montage
  useEffect(() => {
    (async () => {
      try {
        const [rawDevices, rawSelected] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.DEVICES),
          AsyncStorage.getItem(STORAGE_KEYS.SELECTED_INDEX),
        ]);
        if (rawDevices) {
          const parsed = JSON.parse(rawDevices);
          setDevices(Array.isArray(parsed) ? parsed : []);
        }
        if (rawSelected !== null) {
          const idx = JSON.parse(rawSelected);
          setSelectedIndex(Number.isInteger(idx) ? idx : null);
        }
      } catch (e) {
        console.warn('Erreur de chargement AsyncStorage', e);
      }
    })();
  }, []);

  // Sauvegarder les changements
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(devices)).catch(() => {});
  }, [devices]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.SELECTED_INDEX, JSON.stringify(selectedIndex)).catch(() => {});
  }, [selectedIndex]);

  // Fonctions utilitaires
  const addDevice = (device) => {
    setDevices((prev) => [...prev, { ...device, id: Date.now().toString() }]);
  };

  const deleteDevice = (index) => {
    setDevices((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex((prevIdx) => {
      if (prevIdx === null) return null;
      if (prevIdx === index) return null;
      if (prevIdx > index) return prevIdx - 1;
      return prevIdx;
    });
  };

  // NEW: mettre à jour par index
  const updateDevice = (index, patch) => {
    setDevices((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  // NEW: mettre à jour par id (optionnel)
  const updateDeviceById = (id, patch) => {
    setDevices((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // (Optionnel) appareil sélectionné pratique à lire
  const selectedDevice = Number.isInteger(selectedIndex) ? devices[selectedIndex] ?? null : null;

  return (
    <DeviceContext.Provider
      value={{
        devices,
        setDevices,
        selectedIndex,
        setSelectedIndex,
        selectedDevice,       // optionnel
        addDevice,
        deleteDevice,
        updateDevice,         // NEW
        updateDeviceById,     // NEW (optionnel)
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

// Hook personnalisé pour consommer le contexte
export const useDeviceContext = () => useContext(DeviceContext);
