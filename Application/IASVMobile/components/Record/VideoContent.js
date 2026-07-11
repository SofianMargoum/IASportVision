import { useState, useEffect, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  searchClubs,
  hikStartRecording, // ✅ HikConnect START
  hikStopRecording,  // ✅ HikConnect STOP
  hikGetRecordingStatus, // ✅ HikConnect STATUS (backend)
  saveLastRecording, // ✅ legacy
  startRollingExport,
  tickRollingExport,
  finalizeRollingExport,
  finalizeRollingAsync,
  getRollingQueue,
  dismissRolling,
  uploadFromUrl,     // ✅ HTTP(S) -> GCS
  mergeImages,
} from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import { UserContext } from './../../tools/UserContext';
import { useDeviceContext } from './../../tools/DeviceContext';

const TAG = '[useVideoContent]';

// Toggle to re-enable verbose logs when debugging.
const DEBUG_LOGS = false;
const debugLog = (...args) => {
  if (DEBUG_LOGS) console.log(...args);
};
// En prod, on étouffe warn/error pour ne pas exposer de détails techniques
// (URL backend, IDs internes, stack traces) via les logs système.
const warnLog = (...args) => {
  if (__DEV__) console.warn(...args);
};
const errorLog = (...args) => {
  if (__DEV__) console.error(...args);
};

const OPPONENT_STORAGE_KEY = 'selectedOpponentClub';
const ROLLING_STORAGE_KEY = 'activeRollingSession';
const DISMISSED_UPLOADS_KEY = 'dismissedPendingUploads';

// Anti path-traversal : on enlève les séparateurs et `..` qui pourraient remonter
// l'arborescence côté backend / GCS si le nom de club contenait une charge.
const sanitizeName = (s) =>
  String(s ?? '')
    .replace(/[\\/]/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);

const safeJson = (x) => {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
};

const nowIso = () => new Date().toISOString();

const parseMmSsToSeconds = (mmss) => {
  if (!mmss) return null;
  const m = String(mmss).trim().match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
};

// --- NEW: helpers pour envoyer begin/end au backend ---
const getLocalOffsetString = (date = new Date()) => {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(totalMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
};

const parseOffsetMinutes = (offsetStr = getLocalOffsetString()) => {
  const m = String(offsetStr).match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
};

const toFixedOffsetIso = (ms, offsetStr = getLocalOffsetString()) => {
  const offMin = parseOffsetMinutes(offsetStr);
  const shifted = new Date(ms + offMin * 60_000); // exprimer l'heure à l'offset donné
  const pad = (n) => String(n).padStart(2, '0');

  const yyyy = shifted.getUTCFullYear();
  const MM = pad(shifted.getUTCMonth() + 1);
  const dd = pad(shifted.getUTCDate());
  const hh = pad(shifted.getUTCHours());
  const mi = pad(shifted.getUTCMinutes());
  const ss = pad(shifted.getUTCSeconds());

  return `${yyyy}-${MM}-${dd}T${hh}:${mi}:${ss}${offsetStr}`;
};

export const useVideoContent = () => {
  const { selectedClub, setSelectedClub } = useClubContext();
  const { user } = useContext(UserContext);
  const { devices, selectedIndex } = useDeviceContext();

  const [isRecording, setIsRecording] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Refs to avoid stale values inside polling closures
  const isRecordingRef = useRef(false);
  const timeElapsedRef = useRef(0);

  const [filename, setFilename] = useState('');
  const [message, setMessage] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [timeoutId, setTimeoutId] = useState(null);
  const [selectedClubInfo, setSelectedClubInfo] = useState(null);

  const [counter, setCounter] = useState(0);
  const [secondCounter, setSecondCounter] = useState(0);

  // Progress UI (STOP -> export -> upload -> merge)
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressLines, setProgressLines] = useState([]);

  // Pending uploads queue (background pipelines kicked off by Stop, plus
  // backend-side queued/active rollings).
  // Each entry: { id, rollingId, label, status, progress, statusText, error,
  //               localStartedAt, source: 'client'|'backend' }
  const [pendingUploads, setPendingUploads] = useState([]);
  const pendingUploadsRef = useRef([]);
  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  const addPending = (entry) => {
    setPendingUploads((prev) => {
      if (prev.find((e) => e.id === entry.id)) return prev;
      return [...prev, { localStartedAt: Date.now(), source: 'client', ...entry }];
    });
  };
  const updatePending = (id, patch) => {
    setPendingUploads((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...(patch || {}) } : e))
    );
  };
  const removePending = (id) => {
    // Optimistic UI: drop locally first, then ask backend to forget it.
    const entry = (pendingUploadsRef.current || []).find(
      (e) => e.id === id || e.rollingId === id
    );
    setPendingUploads((prev) =>
      prev.filter((e) => e.id !== id && e.rollingId !== id)
    );
    const rollingId = entry?.rollingId || (typeof id === 'string' ? id : null);
    const deviceId = entry?.deviceId || selectedDevice?.deviceId;
    const cameraId = entry?.cameraId || selectedDevice?.cameraId;
    if (rollingId && deviceId && cameraId) {
      dismissRolling({ deviceId, cameraId, rollingId }).catch((e) =>
        warnLog(TAG, nowIso(), 'dismissRolling failed', { rollingId, message: e?.message })
      );
    }
  };

  const pushProgressLine = (line) => {
    if (!line) return;
    setProgressLines((prev) => {
      const next = [...prev, line];
      return next.slice(-1);
    });
  };

  const beginProgress = (firstLine) => {
    setProgressVisible(true);
    setProgressValue(0.05);
    setProgressLines(firstLine ? [firstLine] : []);
  };

  const stepProgress = (value, line) => {
    if (typeof value === 'number') {
      const v = Math.max(0, Math.min(1, value));
      setProgressValue(v);
    }
    if (line) pushProgressLine(line);
  };

  const endProgress = (finalLine, { autoHide = true } = {}) => {
    if (finalLine) pushProgressLine(finalLine);
    setProgressValue(1);
    if (!autoHide) return;

    // laisse le temps de lire "Terminé" puis masque
    setTimeout(() => {
      setProgressVisible(false);
      setProgressLines([]);
      setProgressValue(0);
    }, 1200);
  };

  // ✅ appareil sélectionné (deviceId/cameraId)
  const selectedDevice =
    selectedIndex !== null &&
    selectedIndex !== undefined &&
    selectedIndex >= 0 &&
    selectedIndex < devices.length
      ? devices[selectedIndex]
      : null;

  // ✅ refs pour timestamps
  const recordStartMsRef = useRef(null);
  const lastStopMsRef = useRef(null);
  const ignoreStatusUntilMsRef = useRef(0);
  const recordingStateTokenRef = useRef(null);

  // Rolling (chunked) export during recording: 60s chunks with 2min lag
  const rollingIdRef = useRef(null);
  const rollingChunkMsRef = useRef(60_000);
  const rollingLagMsRef = useRef(120_000);
  const rollingNextIndexRef = useRef(0);
  const rollingTickInFlightRef = useRef(false);
  const rollingInFlightIndicesRef = useRef(new Set());
  const rollingRetryQueueRef = useRef([]); // [{ index:number, attempts:number }]
  const rollingMaxConcurrencyRef = useRef(2);
  const rollingAutoTickActiveRef = useRef(false);

  // --- DEBUG: lifecycle / state changes ---
  useEffect(() => {
    debugLog(TAG, nowIso(), 'mount');
    return () => debugLog(TAG, nowIso(), 'unmount');
  }, []);

  // Restore opponent club from storage on mount
  useEffect(() => {
    let cancelled = false;

    const restoreOpponent = async () => {
      try {
        const raw = await AsyncStorage.getItem(OPPONENT_STORAGE_KEY);
        if (cancelled) return;
        if (!raw) return;

        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          await AsyncStorage.removeItem(OPPONENT_STORAGE_KEY);
          return;
        }
        if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string') {
          await AsyncStorage.removeItem(OPPONENT_STORAGE_KEY);
          return;
        }

        setSelectedClubInfo(parsed);
        setFilename(parsed.name);
      } catch (e) {
        // ignore corrupted cache
      }
    };

    restoreOpponent();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore active rolling session (rollingId) from storage on mount.
  // This survives the app being killed during a recording: when the user
  // re-opens the app while the camera is still recording, we recover the
  // server-side rolling session so STOP can finalize cleanly without
  // having to fall back to a late rolling session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ROLLING_STORAGE_KEY);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        if (typeof parsed.rollingId === 'string' && parsed.rollingId) {
          rollingIdRef.current = parsed.rollingId;
          rollingAutoTickActiveRef.current = !!parsed.autoTickActive;
          if (Number.isFinite(Number(parsed.startMs))) {
            recordStartMsRef.current = Number(parsed.startMs);
          }
          debugLog(TAG, nowIso(), 'restored active rolling session', {
            rollingId: parsed.rollingId,
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist opponent club whenever it changes
  useEffect(() => {
    const persist = async () => {
      try {
        if (selectedClubInfo && selectedClubInfo.name) {
          const minimal = {
            id: selectedClubInfo.id,
            name: selectedClubInfo.name,
            logo: selectedClubInfo.logo,
          };
          await AsyncStorage.setItem(OPPONENT_STORAGE_KEY, JSON.stringify(minimal));
        } else {
          await AsyncStorage.removeItem(OPPONENT_STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    };

    persist();
  }, [selectedClubInfo]);

  useEffect(() => {
    debugLog(TAG, nowIso(), 'selectedIndex/devices change', {
      selectedIndex,
      devicesLen: Array.isArray(devices) ? devices.length : -1,
      selectedDevice: selectedDevice
        ? {
            deviceId: selectedDevice.deviceId,
            cameraId: selectedDevice.cameraId,
            nom: selectedDevice.nom,
          }
        : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, devices]);

  useEffect(() => {
    debugLog(TAG, nowIso(), 'isRecording change', isRecording);
    isRecordingRef.current = !!isRecording;
  }, [isRecording]);

  useEffect(() => {
    debugLog(TAG, nowIso(), 'timeElapsed', timeElapsed);
    timeElapsedRef.current = Number(timeElapsed) || 0;
  }, [timeElapsed]);

  useEffect(() => {
    debugLog(TAG, nowIso(), 'selectedClub change', selectedClub?.name || null);
  }, [selectedClub]);

  useEffect(() => {
    debugLog(TAG, nowIso(), 'selectedClubInfo change', selectedClubInfo?.name || null);
  }, [selectedClubInfo]);

  useEffect(() => {
    debugLog(TAG, nowIso(), 'counter change', counter);
  }, [counter]);

  useEffect(() => {
    debugLog(TAG, nowIso(), 'secondCounter change', secondCounter);
  }, [secondCounter]);

  // Timer UI
  useEffect(() => {
    let timer;
    if (isRecording) {
      debugLog(TAG, nowIso(), 'timer start');
      timer = setInterval(() => {
        setTimeElapsed((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => {
      if (timer) debugLog(TAG, nowIso(), 'timer stop');
      clearInterval(timer);
    };
  }, [isRecording]);

  // Arrêt automatique piloté par le backend : la session HLS (Cloud SQL) est
  // devenue terminale (STOP manuel répercuté, OU limite 2 h atteinte). On
  // reproduit le MÊME comportement qu'un STOP manuel côté UI, sans rappeler le
  // backend (la session est déjà arrêtée / en finalisation côté serveur).
  // syncQueue prend ensuite le relais pour afficher la vidéo (finalisation -> prête).
  const finishRecordingFromAutoStop = () => {
    const rollingId = rollingIdRef.current;
    debugLog(TAG, nowIso(), 'AUTO-STOP (session terminée côté serveur)', { rollingId });

    // Évite un re-clignotement le temps que la file backend reflète l'arrêt.
    ignoreStatusUntilMsRef.current = Date.now() + 15000;

    const clubSnap = selectedClub;
    const opponentSnap = selectedClubInfo;
    const deviceId = selectedDevice?.deviceId || null;
    const cameraId = selectedDevice?.cameraId || null;

    // 1) Libère l'avant-plan : le bouton Stop disparaît, le timer se remet à zéro.
    setIsRecording(false);
    setFilename('');
    setSelectedClubInfo(null);
    setTimeElapsed(0);

    // 2) Entrée "en traitement" pour la continuité d'affichage (comme le STOP
    //    manuel). syncQueue la remplacera par l'état backend (finalisation -> prêt).
    if (rollingId) {
      const _entryDir = clubSnap ? clubSnap.name : 'Unknown Club';
      const _entryFile = opponentSnap
        ? `${counter} - ${secondCounter} ${opponentSnap.name}`
        : `${counter} - ${secondCounter} Unknown Club`;
      addPending({
        id: rollingId,
        rollingId,
        deviceId,
        cameraId,
        label: `${_entryDir} ${_entryFile}`,
        status: 'processing',
        progress: 0.5,
        statusText: 'Traitement serveur…',
      });
    }

    // 3) Réinitialise les refs de session pour permettre un nouvel enregistrement.
    recordStartMsRef.current = null;
    rollingIdRef.current = null;
    rollingAutoTickActiveRef.current = false;
    rollingNextIndexRef.current = 0;
    rollingTickInFlightRef.current = false;
    rollingInFlightIndicesRef.current = new Set();
    rollingRetryQueueRef.current = [];
    AsyncStorage.removeItem(ROLLING_STORAGE_KEY).catch(() => {});
  };

  // Sync recording status from backend (device truth) + keep timer aligned
  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    const deviceId = selectedDevice?.deviceId;
    if (!deviceId) return undefined;

    const syncOnce = async () => {
      if (cancelled) return;
      if (progressVisible) return; // évite de perturber STOP/upload UI
      if (Date.now() < (ignoreStatusUntilMsRef.current || 0)) return;

      try {
        const status = await hikGetRecordingStatus({
          deviceId,
          cameraId: selectedDevice?.cameraId,
          recordingStateToken: recordingStateTokenRef.current,
        });
        if (cancelled) return;

        const serverIsRecording = !!status?.isRecording;
        const serverSeconds = parseMmSsToSeconds(status?.recordingTime);
        // Statut faisant autorité : émis par la session Cloud SQL (HLS), il est
        // DÉFINITIF (le statut caméra, lui, est parfois bruité).
        const sessionAuthoritative = status?.recordingSource === 'session';

        if (serverIsRecording) {
          setIsRecording(true);

          if (typeof serverSeconds === 'number') {
            // Ne jamais faire "reculer" le timer à cause d'un reset côté API.
            // On recale seulement si ça avance (ou si on n'a pas d'état local).
            const current = Number(timeElapsedRef.current) || 0;
            if (!Number.isFinite(current) || serverSeconds >= current) {
              setTimeElapsed(serverSeconds);
              recordStartMsRef.current = Date.now() - serverSeconds * 1000;
            }
          } else if (!Number.isFinite(recordStartMsRef.current)) {
            // best-effort: démarre un timer local si on n'a pas l'elapsed serveur
            recordStartMsRef.current = Date.now();
            setTimeElapsed(0);
          }
        } else if (isRecordingRef.current) {
          // Le serveur dit "pas d'enregistrement" alors qu'on enregistrait.
          if (sessionAuthoritative) {
            // Source de vérité Cloud SQL : la capture est terminée (STOP manuel
            // OU limite 2 h atteinte). On arrête l'UI exactement comme un STOP
            // -> le bouton Stop disparaît automatiquement.
            finishRecordingFromAutoStop();
          }
          // Sinon (statut caméra) : on ignore un "false" ponctuel (faux négatif
          // de l'API maintenance pendant un changement de segment).
          return;
        } else {
          setIsRecording(false);
          setTimeElapsed(0);
          recordStartMsRef.current = null;
        }
      } catch (e) {
        // On ne casse pas l'UI si le status échoue ponctuellement.
        warnLog(TAG, nowIso(), 'hikGetRecordingStatus error', {
          message: e?.message,
          status: e?.status,
        });
      }
    };

    // 1er sync immédiat
    syncOnce();

    // Polling léger
    intervalId = setInterval(syncOnce, 5000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice?.deviceId, progressVisible]);

  // Rolling export tick loop (best-effort, only when recording and rolling session exists)
  // Server computes the next eligible chunk (now - lag) and merges incrementally into one GCS object.
  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    const tickOnce = async () => {
      if (cancelled) return;
      if (!isRecording) return;
      if (rollingAutoTickActiveRef.current) return;
      const rollingId = rollingIdRef.current;
      if (!rollingId) return;
      if (rollingTickInFlightRef.current) return;

      rollingTickInFlightRef.current = true;
      try {
        await tickRollingExport({ rollingId });
      } catch (e) {
        warnLog(TAG, nowIso(), 'rolling tick error', {
          rollingId,
          message: e?.message,
          status: e?.status,
        });
      } finally {
        rollingTickInFlightRef.current = false;
      }
    };

    if (isRecording && rollingIdRef.current && !rollingAutoTickActiveRef.current) {
      tickOnce().catch(() => {});
      intervalId = setInterval(() => {
        tickOnce().catch(() => {});
      }, 15_000);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRecording]);

  // ── Poll backend rolling queue: gives an authoritative view of any rolling
  //    sessions still active/queued on the server (useful after app reload,
  //    or when multiple clients share the same camera).
  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    const deviceId = selectedDevice?.deviceId;
    const cameraId = selectedDevice?.cameraId;
    if (!deviceId || !cameraId) return undefined;

    const syncQueue = async () => {
      if (cancelled) return;
      try {
        const resp = await getRollingQueue({ deviceId, cameraId });
        const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
        if (cancelled) return;

        // Backend is the single source of truth. Every entry the user
        // hasn't dismissed lives in the per-device download index, so we
        // simply mirror the response into pendingUploads. Local-only
        // entries (no rollingId, e.g. legacy non-rolling pipelines) are
        // preserved as-is.
        const mapped = items
          // Skip the still-recording session of the user's *own* camera:
          // it's already shown via the live progress UI, not the downloads
          // list. Queued/finalizing/done all stay visible.
          .filter((item) => item.status !== 'recording')
          .map((item) => {
            const mergedIdx = Number(item.mergedThroughIndex);
            const stopIdx = Number(item.stopMaxIdx);
            const safeIdx = Number(item.safeIndex);
            const target = Number.isFinite(stopIdx)
              ? stopIdx
              : Number.isFinite(safeIdx)
              ? safeIdx
              : null;
            const chunkText =
              Number.isFinite(mergedIdx) && target !== null && target >= 0
                ? ` ${Math.max(0, mergedIdx + 1)}/${target + 1} chunks`
                : '';
            const isDone = item.status === 'done' || !!item.finalGcsPath;
            const statusText = isDone
              ? 'Vidéo prête'
              : item.status === 'queued'
              ? 'En file d’attente'
              : item.status === 'finalizing'
              ? `Finalisation…${chunkText}`
              : item.status === 'merged'
              ? `Assemblé${chunkText}`
              : item.status === 'stopped'
              ? `Arrêté${chunkText}`
              : 'En cours';
            const backendProg = Number(item.progress);
            const progress = isDone
              ? 1
              : Number.isFinite(backendProg)
              ? backendProg
              : 0.05;
            return {
              id: item.rollingId,
              rollingId: item.rollingId,
              deviceId: item.deviceId || deviceId,
              cameraId: item.cameraId || cameraId,
              label:
                (typeof item.label === 'string' && item.label.trim()) ||
                (item.directory && item.combinedFilename
                  ? `${item.directory} ${item.combinedFilename}`
                  : `Rolling ${String(item.rollingId).slice(0, 6)}…`),
              status: isDone ? 'done' : item.status === 'queued' ? 'queued' : 'processing',
              backendStatus: item.status,
              queuedBehind: item.queuedBehind || null,
              progress,
              statusText,
              mergedThroughIndex: Number.isFinite(mergedIdx) ? mergedIdx : null,
              stopMaxIdx: Number.isFinite(stopIdx) ? stopIdx : null,
              safeIndex: Number.isFinite(safeIdx) ? safeIdx : null,
              finalGcsPath: item.finalGcsPath || null,
              finalPublicUrl: item.finalPublicUrl || null,
              source: 'backend',
            };
          });

        setPendingUploads((prev) => {
          const localOnly = prev.filter((e) => !e.rollingId);
          return [...localOnly, ...mapped];
        });
      } catch (e) {
        // ignore: queue is best-effort
      }
    };

    syncQueue();
    intervalId = setInterval(syncQueue, 2000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice?.deviceId, selectedDevice?.cameraId]);

  const handleInputChange = (text) => {
    debugLog(TAG, nowIso(), 'handleInputChange', { text });

    setFilename(text);

    if (timeoutId) {
      debugLog(TAG, nowIso(), 'clearTimeout', timeoutId);
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(async () => {
      debugLog(TAG, nowIso(), 'searchClubs start', { query: text });
      try {
        const results = await searchClubs(text);
        debugLog(TAG, nowIso(), 'searchClubs success', {
          count: Array.isArray(results) ? results.length : null,
        });
        setSearchResults(results);
      } catch (e) {
        errorLog(TAG, nowIso(), 'searchClubs error', e);
        setSearchResults([]);
      }
    }, 1000);

    debugLog(TAG, nowIso(), 'setTimeout scheduled', newTimeoutId);
    setTimeoutId(newTimeoutId);
  };

  const handleResultClick = (result) => {
    debugLog(TAG, nowIso(), 'handleResultClick', {
      picked: result?.name,
      result: result ? { id: result.id, name: result.name } : null,
    });

    setFilename(result.name);
    setSelectedClubInfo(result);
    setSearchResults([]);
  };

  const clearSelectedClub = () => {
    debugLog(TAG, nowIso(), 'clearSelectedClub');
    setSelectedClubInfo(null);
    setFilename('');
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const incrementCounter = () => {
    debugLog(TAG, nowIso(), 'incrementCounter');
    setCounter((prev) => prev + 1);
  };
  const decrementCounter = () => {
    debugLog(TAG, nowIso(), 'decrementCounter');
    setCounter((prev) => Math.max(prev - 1, 0));
  };
  const incrementSecondCounter = () => {
    debugLog(TAG, nowIso(), 'incrementSecondCounter');
    setSecondCounter((prev) => prev + 1);
  };
  const decrementSecondCounter = () => {
    debugLog(TAG, nowIso(), 'decrementSecondCounter');
    setSecondCounter((prev) => Math.max(prev - 1, 0));
  };

  // --- Helpers ---
  const buildNames = (clubSnap, opponentSnap) => {
    const directory = sanitizeName(clubSnap ? clubSnap.name : 'Unknown Club') || 'Unknown Club';
    const oppName = sanitizeName(opponentSnap ? opponentSnap.name : 'Unknown Club') || 'Unknown Club';
    const combinedFilename = `${counter} - ${secondCounter} ${oppName}`;

    debugLog(TAG, nowIso(), 'buildNames', { directory, combinedFilename });
    return { directory, combinedFilename };
  };

  const resolveUrlFromSaveLastRecordingResponse = (res) => {
    const url =
      res?.url ??
      res?.data?.url ??
      res?.data?.urls?.[0] ??
      res?.urls?.[0] ??
      res?.data?.data?.url ??
      res?.data?.data?.urls?.[0] ??
      null;

    debugLog(TAG, nowIso(), 'resolveUrl', { url, keys: Object.keys(res || {}) });
    return url;
  };

  const resolveDurationSeconds = (res, fallbackSeconds = 0) => {
    const bt = res?.data?.beginTime || res?.beginTime;
    const et = res?.data?.endTime || res?.endTime;

    if (bt && et) {
      const s = Date.parse(bt);
      const e = Date.parse(et);
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
        const d = Math.max(0, Math.round((e - s) / 1000));
        debugLog(TAG, nowIso(), 'resolveDurationSeconds from begin/end', { bt, et, d });
        return d;
      }
    }

    debugLog(TAG, nowIso(), 'resolveDurationSeconds fallback', { fallbackSeconds });
    return fallbackSeconds;
  };

  /**
   * Hik-Connect model:
   * - START: hikStartRecording -> UI timer
   * - STOP: hikStopRecording -> saveLastRecording(begin/end) -> URL -> uploadFromUrl -> mergeImages
   */
  const handleButtonClick = async () => {
    debugLog(TAG, nowIso(), 'handleButtonClick', {
      isRecording,
      selectedDevice: selectedDevice
        ? {
            deviceId: selectedDevice.deviceId,
            cameraId: selectedDevice.cameraId,
            nom: selectedDevice.nom,
          }
        : null,
      filename,
      selectedClub: selectedClub?.name || null,
      selectedClubInfo: selectedClubInfo?.name || null,
      counter,
      secondCounter,
      timeElapsed,
    });

    if (!selectedDevice?.deviceId || !selectedDevice?.cameraId) {
      setMessage('❌ Aucun appareil Hik-Connect sélectionné (deviceId/cameraId manquant).');
      warnLog(TAG, nowIso(), 'invalid device', {
        selectedDevice,
        selectedIndex,
        devicesLen: devices?.length,
      });
      return;
    }

    if (isRecording) {
      // STOP
      // évite un clignotement si l'API maintenance met du temps à refléter l'arrêt
      ignoreStatusUntilMsRef.current = Date.now() + 15000;

      const endMs = Date.now();
      const startMs = recordStartMsRef.current;
      lastStopMsRef.current = endMs;

      let stopHadError = false;

      // snapshots (évite incohérences après reset UI)
      const clubSnap = selectedClub;
      const opponentSnap = selectedClubInfo;

      debugLog(TAG, nowIso(), 'STOP pressed', { startMs, endMs, elapsedSec: timeElapsed });

      beginProgress('Arrêt…');

      // 1) STOP côté HikConnect
      try {
        stepProgress(0.12, 'Stop caméra…');
        debugLog(TAG, nowIso(), 'hikStopRecording start', { deviceId: selectedDevice.deviceId });

        const stopResp = await hikStopRecording({ deviceId: selectedDevice.deviceId });

        // Token signed by backend to make recording-status instantaneous across instances
        recordingStateTokenRef.current = stopResp?.recordingStateToken || recordingStateTokenRef.current;

        debugLog(TAG, nowIso(), 'hikStopRecording success', safeJson(stopResp));
        stepProgress(0.18, 'Stop OK.');
      } catch (e) {
        errorLog(TAG, nowIso(), '❌ hikStopRecording error', {
          message: e?.message,
          status: e?.status,
          details: e?.details,
        });
        setMessage("⚠️ Stop HikConnect échoué, tentative d'export via begin/end...");
        stepProgress(0.18, 'Stop KO, export…');
      }

      // UI reset
  debugLog(TAG, nowIso(), 'UI reset (filename/clubInfo/isRecording)');
      setFilename('');
      setSelectedClubInfo(null);
      setIsRecording(false);

      // ── Capture snapshot BEFORE resetting refs so the background pipeline
      //    keeps using the right rollingId / club info, while the foreground
      //    is freed for a brand-new recording.
      const snapshot = {
        rollingId: rollingIdRef.current,
        rollingAutoTickActive: rollingAutoTickActiveRef.current,
        startMs,
        endMs,
        timeElapsed: timeElapsedRef.current,
        clubSnap,
        opponentSnap,
        counter,
        secondCounter,
        deviceId: selectedDevice.deviceId,
        cameraId: selectedDevice.cameraId,
      };

      // Reset shared refs so a fresh recording can start cleanly.
      recordStartMsRef.current = null;
      rollingIdRef.current = null;
      rollingAutoTickActiveRef.current = false;
      rollingNextIndexRef.current = 0;
      rollingTickInFlightRef.current = false;
      rollingInFlightIndicesRef.current = new Set();
      rollingRetryQueueRef.current = [];
      setTimeElapsed(0);
      // Clear persisted rolling session: the recording is being stopped.
      AsyncStorage.removeItem(ROLLING_STORAGE_KEY).catch(() => {});

      // Add a pending-upload entry that the UI will display under the
      // progress bar. The pipeline below will keep it up to date.
      const _entryDir = clubSnap ? clubSnap.name : 'Unknown Club';
      const _entryFile = opponentSnap
        ? `${snapshot.counter} - ${snapshot.secondCounter} ${opponentSnap.name}`
        : `${snapshot.counter} - ${snapshot.secondCounter} Unknown Club`;
      const entryId = snapshot.rollingId || `local-${Date.now()}`;
      addPending({
        id: entryId,
        rollingId: snapshot.rollingId || null,
        deviceId: snapshot.deviceId || selectedDevice?.deviceId || null,
        cameraId: snapshot.cameraId || selectedDevice?.cameraId || null,
        label: `${_entryDir} ${_entryFile}`,
        status: 'processing',
        progress: 0.2,
        statusText: 'Stop OK.',
      });

      // Hide the foreground progress bar; the entry list takes over.
      setProgressVisible(false);
      setProgressLines([]);
      setProgressValue(0);

      // Fire-and-forget the heavy pipeline. We shadow refs/setters with
      // snapshot-bound locals so the pipeline body can stay (almost)
      // unchanged AND so a concurrent new recording cannot corrupt it.
      void (async () => {
        // shadow refs with snapshot
        const rollingIdRef = { current: snapshot.rollingId };
        const rollingAutoTickActiveRef = { current: snapshot.rollingAutoTickActive };
        const recordStartMsRef = { current: snapshot.startMs };
        const lastStopMsRef = { current: snapshot.endMs };
        const rollingNextIndexRef = { current: 0 };
        const rollingTickInFlightRef = { current: false };
        const rollingInFlightIndicesRef = { current: new Set() };
        const rollingRetryQueueRef = { current: [] };

        // shadow snapshot-bound locals so closures inside the body resolve
        // them to the snapshot values.
        const selectedClub = snapshot.clubSnap;
        const selectedClubInfo = snapshot.opponentSnap;
        const counter = snapshot.counter;
        const secondCounter = snapshot.secondCounter;
        const startMs = snapshot.startMs;
        const endMs = snapshot.endMs;
        const timeElapsed = snapshot.timeElapsed;
        const clubSnap = snapshot.clubSnap;
        const opponentSnap = snapshot.opponentSnap;
        const selectedDevice = { deviceId: snapshot.deviceId, cameraId: snapshot.cameraId };

        // shadow UI setters: redirect to the pending entry, no foreground UI.
        const setMessage = (m) =>
          updatePending(entryId, { statusText: String(m || '') });
        const stepProgress = (v, l) => {
          if (typeof v === 'number') {
            updatePending(entryId, {
              progress: Math.max(0, Math.min(1, v)),
            });
          }
          if (l) updatePending(entryId, { statusText: String(l) });
        };
        const beginProgress = (l) =>
          updatePending(entryId, {
            progress: 0.05,
            statusText: l ? String(l) : '',
          });
        const endProgress = (l) => {
          updatePending(entryId, { progress: 1, statusText: l ? String(l) : '' });
        };
        const pushProgressLine = (l) => {
          if (l) updatePending(entryId, { statusText: String(l) });
        };

        // shadow state setters that the pipeline body accidentally calls
        // (we already reset them in the foreground above).
        const setFilename = () => {};
        const setSelectedClubInfo = () => {};
        const setIsRecording = () => {};
        const setTimeElapsed = () => {};
        const setProgressVisible = () => {};
        const setProgressLines = () => {};
        const setProgressValue = () => {};

        // shadow progressValue (read once inside the catch block)
        const progressValue = 0.5;

        let stopHadError = false;

        try {
        setMessage('📦 Génération MP4 via Hik-Connect...');
        stepProgress(0.25, 'MP4…');

        // ✅ NEW: on envoie beginTime/endTime pour ne PAS dépendre de record/element/search
        const tz = getLocalOffsetString();
        const PAD_BEFORE_MS = 2000;
        const PAD_AFTER_MS = 2000;
        const MIN_MS = 8000;

        const startMs0 = Number.isFinite(startMs) ? startMs : Date.now() - MIN_MS;
        let endMs0 = Number.isFinite(endMs) ? endMs : Date.now();
        if (endMs0 - startMs0 < MIN_MS) endMs0 = startMs0 + MIN_MS;

        const beginTime = toFixedOffsetIso(startMs0 - PAD_BEFORE_MS, tz);
        const endTime = toFixedOffsetIso(endMs0 + PAD_AFTER_MS, tz);

        const payload = {
          deviceId: selectedDevice.deviceId,
          cameraId: selectedDevice.cameraId,
          voiceSwitch: 0,
          offset: tz,
          beginTime,
          endTime,
        };

        debugLog(TAG, nowIso(), 'saveLastRecording payload (WITH begin/end)', payload);

        const { directory, combinedFilename } = buildNames(clubSnap, opponentSnap);

        // Backend handles the entire export pipeline (chunks → merge →
        // copy → thumbnail) via Cloud Tasks. The client just stamps the
        // finalize request and exits. Status is observed via /rolling/queue.
        let res;
        let rollingFinalized = false;

        try {
          // Ensure we have a rolling session (start one late if needed).
          if (!rollingIdRef.current) {
            warnLog(TAG, nowIso(), 'no rollingId at stop – starting late rolling session');
            try {
              stepProgress(0.25, 'Démarrage rolling tardif…');
              const lateRoll = await startRollingExport({
                deviceId: selectedDevice.deviceId,
                cameraId: selectedDevice.cameraId,
                beginTime,
                offset: tz,
                voiceSwitch: 0,
                chunkSec: 60,
                lagSec: 0,
                directory,
                combinedFilename,
                homeLogoUrl: clubSnap?.logo || undefined,
                awayLogoUrl: opponentSnap?.logo || undefined,
                label: `${directory} ${combinedFilename}`,
              });
              const lateId = lateRoll?.data?.rollingId || lateRoll?.rollingId;
              if (!lateId) throw new Error('late startRollingExport: no rollingId');
              rollingIdRef.current = lateId;
              rollingAutoTickActiveRef.current = !!lateRoll?.data?.autoTickEnabled;
            } catch (eLate) {
              const st = Number(eLate?.status) || 0;
              const isNetwork =
                !st && /network request failed/i.test(String(eLate?.message || ''));
              if (isNetwork) {
                setMessage('❌ Réseau indisponible pendant le STOP. Réessaie quand la connexion revient.');
                stepProgress(0.3, 'Réseau KO.');
                throw eLate;
              }
              warnLog(TAG, nowIso(), 'late rolling start failed', {
                message: eLate?.message,
                status: st,
              });
              throw eLate;
            }
          }

          // Fire-and-forget: backend will finalize via Cloud Tasks. We do
          // NOT wait for completion. The queue endpoint exposes the status
          // (status=done + finalGcsPath when ready).
          setMessage('📤 Demande de finalisation envoyée…');
          stepProgress(0.4, 'Traitement serveur…');
          try {
            const finalName = `${directory} ${combinedFilename}.mp4`;
            await finalizeRollingAsync({
              rollingId: rollingIdRef.current,
              directory,
              filename: finalName,
              stopTime: endTime,
              tailTryCount: 1,
              requireComplete: 1,
              combinedFilename: `${combinedFilename}.png`,
              homeLogoUrl: clubSnap?.logo || undefined,
              awayLogoUrl: opponentSnap?.logo || undefined,
              label: `${directory} ${combinedFilename}`,
            });
          } catch (eAsync) {
            // finalize-async is short and idempotent – a failure here is
            // a real network problem. Surface it but do not block.
            warnLog(TAG, nowIso(), 'finalizeRollingAsync failed', {
              message: eAsync?.message,
              status: eAsync?.status,
            });
          }

          res = {
            data: {
              gcsPath: null,
              rollingId: rollingIdRef.current,
            },
          };
          rollingFinalized = true;
          stepProgress(0.5, 'Traitement serveur…');
        } catch (eRolling) {
          warnLog(TAG, nowIso(), 'rolling stop pipeline failed', {
            message: eRolling?.message,
            status: eRolling?.status,
          });

          if (
            !eRolling?.status &&
            /network request failed/i.test(String(eRolling?.message || ''))
          ) {
            setMessage('❌ Réseau indisponible pendant le STOP. Réessaie quand la connexion revient.');
            stepProgress(0.4, 'Réseau KO.');
            throw eRolling;
          }

          // Legacy fallback only as last resort (no rolling at all available).
          try {
            setMessage('⏳ Génération MP4 (fallback legacy) en cours...');
            stepProgress(0.32, 'Traitement…');
            res = await saveLastRecording(payload);
            stepProgress(0.4, 'MP4 prêt.');
          } catch (e2) {
            errorLog(TAG, nowIso(), 'fallback saveLastRecording error', e2);
            throw eRolling;
          }
        }

        // ── Fast path: rolling handled the export server-side; skip legacy
        //    upload/merge steps entirely.
        if (rollingFinalized) {
          if (typeof res?.data?.gcsPath === 'string' && res.data.gcsPath) {
            // GCS path already known – fully done.
            setMessage('Vidéo enregistrée avec succès');
            stepProgress(1, 'Terminé.');
          } else {
            // Backend still processing (finalize timed out client-side).
            // Entry stays visible in the list; syncQueue will update it.
            setMessage('Vidéo en cours de traitement…');
            stepProgress(0.6, 'En attente serveur…');
          }
          return;
        }

        const sourceUrl = resolveUrlFromSaveLastRecordingResponse(res);
        if (!sourceUrl) {
          errorLog(TAG, nowIso(), '❌ saveLastRecording: no URL', safeJson(res));
          setMessage("❌ MP4 non disponible (pas d'URL retournée).");
          stepProgress(0.4, 'URL MP4 manquante.');
          stopHadError = true;
          return;
        }

        const duration = resolveDurationSeconds(res, timeElapsed);

        // 2) Upload HTTP(S) -> GCS (legacy fallback only – rolling fast-path returned above).
        {
          try {
            setMessage('☁️ Upload vidéo en cours...');
            stepProgress(0.55, 'Upload…');
            const targetFilename = `${directory} ${combinedFilename}.mp4`;

            debugLog(TAG, nowIso(), 'uploadFromUrl start', {
              directory,
              targetFilename,
              duration,
              sourceUrlPreview: String(sourceUrl).slice(0, 120),
            });

            const uploadResp = await uploadFromUrl({
              sourceUrl,
              directory,
              filename: targetFilename,
              contentType: 'video/mp4',
            });

            debugLog(TAG, nowIso(), 'uploadFromUrl success', safeJson(uploadResp));
            setMessage('Vidéo uploadée avec succès');
            stepProgress(0.78, 'Upload OK.');
          } catch (err) {
            errorLog(TAG, nowIso(), '❌ Upload-from-url échoué', err);
            setMessage('❌ Upload vidéo échoué');
            stepProgress(0.78, 'Upload KO.');
            stopHadError = true;
          }
        }

        // 3) Fusion images - generated server-side by rolling/finalize.
        //    Client-side merge is only kept as fallback for non-rolling exports
        //    and runs immediately to keep legacy behavior intact.
        if (rollingFinalized) {
          stepProgress(0.98, 'Miniature OK.');
        } else {
          const mergeParams = {
            logo1Url:
              clubSnap?.logo ||
              'https://storage.googleapis.com/ia-sport.appspot.com/images/logo_default.png',
            logo2Url:
              opponentSnap?.logo ||
              'https://storage.googleapis.com/ia-sport.appspot.com/images/logo_default.png',
            finalFolder: directory,
            finalName: `${directory} ${combinedFilename}.png`,
          };

          debugLog(TAG, nowIso(), 'mergeImages params', mergeParams);

          try {
            setMessage('🖼️ Fusion des images en cours...');
            stepProgress(0.9, 'Miniature…');
            debugLog(TAG, nowIso(), 'mergeImages start');
            const mergeResponse = await mergeImages(mergeParams);
            debugLog(TAG, nowIso(), 'mergeImages success', safeJson(mergeResponse));
            setMessage('Fusion réussie');
            stepProgress(0.98, 'Miniature OK.');
          } catch (err) {
            errorLog(TAG, nowIso(), '❌ Fusion images échouée', err);
            setMessage('❌ Fusion images échouée');
            stepProgress(0.98, 'Miniature KO.');
            stopHadError = true;
          }
        }
      } catch (err) {
        // Suppress the internal 'No rollingId' sentinel thrown when the late
        // rolling path already handled things (or decided to use legacy).
        if (!err._useLegacy) {
          errorLog(TAG, nowIso(), '❌ Erreur générale STOP/save/upload', err);
          setMessage(`❌ Erreur générale: ${err?.message || 'Erreur inconnue'}`);
          stepProgress(progressValue || 0.5, 'Erreur.');
        }
        stopHadError = true;
      } finally {
        debugLog(TAG, nowIso(), 'STOP finally cleanup');
        recordStartMsRef.current = null;
        rollingIdRef.current = null;
        rollingAutoTickActiveRef.current = false;
        rollingNextIndexRef.current = 0;
        rollingTickInFlightRef.current = false;
        rollingInFlightIndicesRef.current = new Set();
        rollingRetryQueueRef.current = [];
        setTimeElapsed(0);
        // Foreground progress bar already hidden after STOP. The pending
        // entry's status/progress is driven by syncQueue polling /rolling/queue
        // — we do NOT force 'done' here because the backend may still be
        // finalizing for several minutes after STOP. The entry will flip to
        // 'done' (status=done + finalGcsPath) when Cloud Tasks finishes.
        if (stopHadError) {
          updatePending(entryId, { status: 'error', progress: 1 });
        } else if (snapshot.rollingId) {
          // Keep entry under backend control. Show "Traitement serveur…"
          // until syncQueue updates it.
          updatePending(entryId, {
            status: 'processing',
            progress: 0.5,
            statusText: 'Traitement serveur…',
          });
        } else {
          // No rolling at all (legacy fallback path) – it really is done now.
          updatePending(entryId, { status: 'done', progress: 1 });
          setTimeout(() => removePending(entryId), 5000);
        }
      }
      })().catch((e) => {
        errorLog(TAG, nowIso(), '❌ background pipeline crash', {
          message: e?.message,
        });
        updatePending(entryId, {
          status: 'error',
          progress: 1,
          error: e?.message || 'Erreur',
        });
      });
    } else {
      // START (HikConnect + UI)
      try {
        setProgressVisible(false);
        setProgressLines([]);
        setProgressValue(0);
        debugLog(TAG, nowIso(), 'hikStartRecording start', { deviceId: selectedDevice.deviceId });

        const startResp = await hikStartRecording({ deviceId: selectedDevice.deviceId });

        // Token signed by backend to make recording-status more responsive across instances
        recordingStateTokenRef.current = startResp?.recordingStateToken || recordingStateTokenRef.current;

        debugLog(TAG, nowIso(), 'hikStartRecording success', safeJson(startResp));

        const start = Date.now();
        recordStartMsRef.current = start;

        // Start rolling export session (best-effort)
        try {
          const tz = getLocalOffsetString();
          const beginTime = toFixedOffsetIso(start, tz);
          // Best-effort placeholder names so the in-progress download list
          // shows the final video title instead of "Rolling xxxxxx…".
          // The same fields are sent again (overriding) at finalize time.
          const _clubSnapStart = selectedClub;
          const _opponentSnapStart = selectedClubInfo;
          const _startNames = buildNames(_clubSnapStart, _opponentSnapStart);
          const _startLabel = `${_startNames.directory} ${_startNames.combinedFilename}`.trim();
          const roll = await startRollingExport({
            deviceId: selectedDevice.deviceId,
            cameraId: selectedDevice.cameraId,
            beginTime,
            offset: tz,
            voiceSwitch: 0,
            chunkSec: 60,
            lagSec: 60,
            directory: _startNames.directory,
            combinedFilename: _startNames.combinedFilename,
            homeLogoUrl: _clubSnapStart?.logo || undefined,
            awayLogoUrl: _opponentSnapStart?.logo || undefined,
            label: _startLabel,
          });

          const rollingId = roll?.data?.rollingId || roll?.rollingId;
          const autoTickEnabled = !!(roll?.data?.autoTickEnabled ?? roll?.autoTickEnabled);
          const autoTickConfigured = !!(roll?.data?.autoTickConfigured ?? roll?.autoTickConfigured);
          rollingAutoTickActiveRef.current = autoTickEnabled && autoTickConfigured;

          if (rollingId) {
            rollingIdRef.current = rollingId;
            rollingNextIndexRef.current = 0;
            rollingChunkMsRef.current = (Number(roll?.data?.chunkSec) || 60) * 1000;
            rollingLagMsRef.current = (Number(roll?.data?.lagSec) || 120) * 1000;
            rollingInFlightIndicesRef.current = new Set();
            rollingRetryQueueRef.current = [];
            // Persist so we can recover the session if the app is killed.
            AsyncStorage.setItem(
              ROLLING_STORAGE_KEY,
              JSON.stringify({
                rollingId,
                autoTickActive: rollingAutoTickActiveRef.current,
                startMs: start,
              })
            ).catch(() => {});
          } else {
            rollingIdRef.current = null;
            rollingAutoTickActiveRef.current = false;
          }
        } catch (eRoll) {
          warnLog(TAG, nowIso(), 'startRollingExport failed (ignored)', {
            message: eRoll?.message,
            status: eRoll?.status,
          });
          rollingIdRef.current = null;
          rollingAutoTickActiveRef.current = false;
        }

        // évite un clignotement si la maintenance API met quelques secondes à se mettre à jour
        ignoreStatusUntilMsRef.current = Date.now() + 8000;

        setIsRecording(true);
        setTimeElapsed(0);
      } catch (error) {
        errorLog(TAG, nowIso(), '❌ Échec start HikConnect', {
          message: error?.message,
          status: error?.status,
          details: error?.details,
        });
        setMessage(`❌ Échec start: ${error?.message || 'Erreur inconnue'}`);
      }
    }
  };

  return {
    user,
    selectedClub,
    selectedClubInfo,
    filename,
    searchResults,
    isRecording,
    timeElapsed,
    message,
    progressVisible,
    progressValue,
    progressLines,
    pendingUploads,
    removePending,
    counter,
    secondCounter,
    handleInputChange,
    handleResultClick,
    handleButtonClick,
    clearSelectedClub,
    formatTime,
    incrementCounter,
    decrementCounter,
    incrementSecondCounter,
    decrementSecondCounter,
    selectedDevice,
  };
};
