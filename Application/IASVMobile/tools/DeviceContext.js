// DeviceContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DeviceContext = createContext(null);

const STORAGE_KEY = 'devices_storage_v2_hikconnect'; // change si tu veux
const SELECTED_KEY = 'devices_selected_index_v2_hikconnect';

const sanitizeIndex = (idx, len) => {
  if (!Number.isInteger(idx)) return len > 0 ? 0 : null;
  if (idx < 0) return len > 0 ? 0 : null;
  if (idx >= len) return len > 0 ? 0 : null;
  return idx;
};

const normalizeDevices = (arr) => {
  if (!Array.isArray(arr)) return [];

  // Migration: ancien format { nom, domaine, port } -> on le garde mais on marque comme legacy
  // (tu peux aussi décider de filtrer et d’ignorer totalement ces entrées)
  return arr
    .map((d) => {
      if (!d || typeof d !== 'object') return null;

      const id = d.id ?? Date.now().toString() + Math.random().toString(16).slice(2);

      // Nouveau format attendu
      const hasHik = typeof d.deviceId === 'string' && typeof d.cameraId === 'string';

      if (hasHik) {
        return {
          id,
          nom: typeof d.nom === 'string' ? d.nom : 'Caméra',
          deviceId: d.deviceId,
          cameraId: d.cameraId,
        };
      }

      // Ancien format: on conserve mais sans casser l’app
      // => nom ok, mais deviceId/cameraId absents. Tu verras "undefined" dans l’UI si tu ne gères pas.
      // Si tu préfères ignorer, remplace ce return par null.
      const legacyName = typeof d.nom === 'string' ? d.nom : 'Appareil';
      return {
        id,
        nom: legacyName,
        deviceId: d.deviceId ?? '',
        cameraId: d.cameraId ?? '',
        // legacy hints (optionnel)
        domaine: d.domaine,
        port: d.port,
      };
    })
    .filter(Boolean);
};

export const DeviceProvider = ({ children }) => {
  const [devices, setDevices] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load storage
  useEffect(() => {
    const load = async () => {
      try {
        const [rawDevices, rawSelected] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SELECTED_KEY),
        ]);

        const parsedDevices = rawDevices ? JSON.parse(rawDevices) : [];
        const normalized = normalizeDevices(parsedDevices);

        const parsedSelected = rawSelected != null ? Number(rawSelected) : null;
        const fixedSelected = sanitizeIndex(parsedSelected, normalized.length);

        setDevices(normalized);
        setSelectedIndex(fixedSelected);
      } catch (e) {
        // en cas de JSON corrompu, on repart clean
        setDevices([]);
        setSelectedIndex(null);
      } finally {
        setIsLoaded(true);
      }
    };

    load();
  }, []);

  // Persist devices
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(devices)).catch(() => {});
  }, [devices, isLoaded]);

  // Persist selectedIndex
  useEffect(() => {
    if (!isLoaded) return;
    const val = selectedIndex == null ? '' : String(selectedIndex);
    AsyncStorage.setItem(SELECTED_KEY, val).catch(() => {});
  }, [selectedIndex, isLoaded]);

  // Guard selectedIndex whenever devices changes (delete, load, etc.)
  useEffect(() => {
    if (!isLoaded) return;
    setSelectedIndex((prev) => sanitizeIndex(prev, devices.length));
  }, [devices.length, isLoaded]);

  const addDevice = (device) => {
    // device attendu: { nom, deviceId, cameraId }
    const nom = (device?.nom ?? '').toString().trim();
    const deviceId = (device?.deviceId ?? '').toString().trim();
    const cameraId = (device?.cameraId ?? '').toString().trim();

    if (!nom || !deviceId || !cameraId) {
      // On évite de polluer le state avec des entrées invalides
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      nom,
      deviceId,
      cameraId,
    };

    setDevices((prev) => [...prev, newItem]);
  };

  const updateDevice = (index, patch) => {
    setDevices((prev) => {
      if (!Array.isArray(prev) || index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const deleteDevice = (index) => {
    setDevices((prev) => {
      if (!Array.isArray(prev) || index < 0 || index >= prev.length) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next;
    });

    // La correction de selectedIndex est gérée par l'effet guard ci-dessus
  };

  const value = useMemo(
    () => ({
      devices,
      addDevice,
      updateDevice,
      deleteDevice,
      selectedIndex,
      setSelectedIndex,
    }),
    [devices, selectedIndex]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};

export const useDeviceContext = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDeviceContext must be used within a DeviceProvider');
  return ctx;
};
