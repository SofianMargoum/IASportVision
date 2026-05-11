// DeviceContext.js
//
// Source unique de vérité pour la liste des caméras (devices) visibles
// par l'utilisateur courant.
//
// Logique métier :
//  - Dès qu'un user est connecté (UserContext), on récupère côté serveur
//    la liste des devices (déjà filtrée par clubId pour les non-admin,
//    complète pour les admin).
//  - On normalise le format serveur (snake_case + club imbriqué) vers
//    le format historique attendu par l'UI : { id, nom, deviceId,
//    cameraId, club: { id, name, logoUrl, ffNo } }.
//  - On auto-sélectionne la première caméra valide.
//  - Sur logout (user=null) on remet à zéro.
//
// Les écrans (Appareils.js, Record, …) ne doivent plus déclencher le
// chargement : ils consomment seulement `devices`, `selectedIndex` et
// `selectedDevice`.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { UserContext } from './UserContext';
import { fetchDevices, getAuthToken, setAuthToken } from './api';
import { loadToken } from './secureToken';

const DeviceContext = createContext(null);

const STORAGE_KEY = 'devices_storage_v3_server';
const SELECTED_KEY = 'devices_selected_index_v3_server';

const sanitizeIndex = (idx, len) => {
  if (!Number.isInteger(idx)) return len > 0 ? 0 : null;
  if (idx < 0) return len > 0 ? 0 : null;
  if (idx >= len) return len > 0 ? 0 : null;
  return idx;
};

// Normalise un device renvoyé par le backend vers le format UI.
const mapServerDevice = (d) => {
  if (!d || typeof d !== 'object') return null;
  const cameraId = d.camera_id ?? d.cameraId ?? '';
  const deviceId = d.device_id ?? d.deviceId ?? '';
  const hikDeviceId = d.hik_device_id ?? d.hikDeviceId ?? '';
  return {
    id: d.id ?? `${hikDeviceId || cameraId || Date.now()}`,
    nom: d.name ?? d.nom ?? 'Caméra',
    deviceId: String(deviceId || ''),
    cameraId: String(cameraId || ''),
    hikDeviceId: String(hikDeviceId || ''),
    club: d.club
      ? {
          id: d.club.id ?? null,
          name: d.club.name ?? null,
          logoUrl: d.club.logo_url ?? d.club.logoUrl ?? null,
          ffNo: d.club.fff_cl_no ?? d.club.ffNo ?? null,
        }
      : null,
    _raw: d,
  };
};

const normalizeDevices = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((d) => {
      if (!d || typeof d !== 'object') return null;
      // Format déjà UI (cache local) ?
      if (typeof d.deviceId === 'string' && typeof d.cameraId === 'string' && d.nom !== undefined) {
        return {
          id: d.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          nom: d.nom || 'Caméra',
          deviceId: d.deviceId,
          cameraId: d.cameraId,
          hikDeviceId: d.hikDeviceId || '',
          club: d.club || null,
        };
      }
      return mapServerDevice(d);
    })
    .filter(Boolean);
};

export const DeviceProvider = ({ children }) => {
  const userCtx = useContext(UserContext);
  const user = userCtx?.user || null;

  const [devices, setDevices] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // 1) Hydratation initiale depuis le cache AsyncStorage.
  useEffect(() => {
    const load = async () => {
      try {
        const [rawDevices, rawSelected] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SELECTED_KEY),
        ]);
        const parsedDevices = rawDevices ? JSON.parse(rawDevices) : [];
        const normalized = normalizeDevices(parsedDevices);
        const parsedSelected = rawSelected != null && rawSelected !== '' ? Number(rawSelected) : null;
        setDevices(normalized);
        setSelectedIndex(sanitizeIndex(parsedSelected, normalized.length));
      } catch {
        setDevices([]);
        setSelectedIndex(null);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  // 2) Persist cache local.
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(devices)).catch(() => {});
  }, [devices, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    const val = selectedIndex == null ? '' : String(selectedIndex);
    AsyncStorage.setItem(SELECTED_KEY, val).catch(() => {});
  }, [selectedIndex, isLoaded]);

  // 3) Garde-fou : selectedIndex toujours valide.
  useEffect(() => {
    if (!isLoaded) return;
    setSelectedIndex((prev) => sanitizeIndex(prev, devices.length));
  }, [devices.length, isLoaded]);

  // 4) Chargement serveur — déclenché par le user connecté.
  //
  // Sécurité d'ordre : on ne fait JAMAIS l'appel sans JWT.
  // Le token peut être :
  //   - déjà en mémoire (CURRENT_AUTH_TOKEN, posé par setAuthToken)
  //   - sinon présent en Keychain (cold start, avant que Profile.js ait
  //     fini son initializeUser). Dans ce cas on le réinjecte ici.
  // Si aucune des deux sources ne donne un token, on n'appelle pas l'API
  // et on ne pose pas de loadError : c'est juste « pas encore prêt ».
  const loadDevicesFromServer = useCallback(async () => {
    let token = getAuthToken();
    if (!token) {
      try {
        token = await loadToken();
      } catch {
        token = null;
      }
      if (token) setAuthToken(token);
    }
    if (!token) {
      if (__DEV__) {
        console.log('[DeviceContext] skip fetchDevices: no token yet');
      }
      // Pas une erreur : juste prématuré. L'effet se redéclenchera
      // au prochain changement de user (ex. après login complet).
      return null;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const serverDevices = await fetchDevices();
      const mapped = serverDevices.map(mapServerDevice).filter(Boolean);
      setDevices(mapped);
      const firstValid = mapped.findIndex((d) => d.deviceId && d.cameraId);
      setSelectedIndex(firstValid >= 0 ? firstValid : (mapped.length > 0 ? 0 : null));
      return mapped;
    } catch (e) {
      if (__DEV__) console.warn('[DeviceContext] fetchDevices error:', e?.message);
      setLoadError(e?.message || 'Erreur de chargement des caméras.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 5) Réagir au user connecté.
  useEffect(() => {
    if (!isLoaded) return;
    if (!user || !user.id) {
      setDevices([]);
      setSelectedIndex(null);
      setLoadError(null);
      return;
    }
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[DeviceContext] user/token ready, loading devices', {
        userId: user?.id,
        role: user?.role,
        clubId: user?.clubId,
        hasToken: Boolean(getAuthToken()),
      });
    }
    loadDevicesFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id, user?.role, user?.clubId]);

  // 6) Mutations locales (Appareils.js — fallback / manuel).
  const addDevice = (device) => {
    const nom = (device?.nom ?? '').toString().trim();
    const deviceId = (device?.deviceId ?? '').toString().trim();
    const cameraId = (device?.cameraId ?? '').toString().trim();
    if (!nom || !deviceId || !cameraId) return;

    setDevices((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        nom,
        deviceId,
        cameraId,
        hikDeviceId: '',
        club: null,
      },
    ]);
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
      return prev.filter((_, i) => i !== index);
    });
  };

  // 7) Dérivés.
  const selectedDevice = useMemo(() => {
    if (selectedIndex == null) return null;
    return devices[selectedIndex] || null;
  }, [devices, selectedIndex]);

  const value = useMemo(
    () => ({
      devices,
      selectedIndex,
      setSelectedIndex,
      selectedDevice,
      isLoading,
      loadError,
      isLoaded,
      reloadDevices: loadDevicesFromServer,
      addDevice,
      updateDevice,
      deleteDevice,
    }),
    [devices, selectedIndex, selectedDevice, isLoading, loadError, isLoaded, loadDevicesFromServer]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};

export const useDeviceContext = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDeviceContext must be used within a DeviceProvider');
  return ctx;
};
