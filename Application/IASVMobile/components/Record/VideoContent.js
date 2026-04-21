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

const OPPONENT_STORAGE_KEY = 'selectedOpponentClub';

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

        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.name) return;

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

        if (serverIsRecording) {
          setIsRecording(true);
          setMessage('Enregistrement en cours...');

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
        } else {
          // Simplification robuste: si l'utilisateur est en train d'enregistrer,
          // on ignore les faux "false" ponctuels (observé dans les logs).
          if (isRecordingRef.current) return;

          setIsRecording(false);
          setTimeElapsed(0);
          recordStartMsRef.current = null;
        }
      } catch (e) {
        // On ne casse pas l'UI si le status échoue ponctuellement.
        console.warn(TAG, nowIso(), 'hikGetRecordingStatus error', {
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
        console.warn(TAG, nowIso(), 'rolling tick error', {
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
        console.error(TAG, nowIso(), 'searchClubs error', e);
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
    const directory = clubSnap ? clubSnap.name : 'Unknown Club';
    const combinedFilename = opponentSnap
      ? `${counter} - ${secondCounter} ${opponentSnap.name}`
      : `${counter} - ${secondCounter} Unknown Club`;

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
      console.warn(TAG, nowIso(), 'invalid device', {
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
        setMessage('⏹️ Arrêt enregistrement (HikConnect)...');
        stepProgress(0.12, 'Stop caméra…');
        debugLog(TAG, nowIso(), 'hikStopRecording start', { deviceId: selectedDevice.deviceId });

        const stopResp = await hikStopRecording({ deviceId: selectedDevice.deviceId });

        // Token signed by backend to make recording-status instantaneous across instances
        recordingStateTokenRef.current = stopResp?.recordingStateToken || recordingStateTokenRef.current;

        debugLog(TAG, nowIso(), 'hikStopRecording success', safeJson(stopResp));
        stepProgress(0.18, 'Stop OK.');
      } catch (e) {
        console.error(TAG, nowIso(), '❌ hikStopRecording error', {
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

        // Prefer rolling finalize (chunks downloaded during recording). Fallback to async export job.
        let res;
        let rollingFinalized = false;
        try {
          if (rollingIdRef.current) {
            // Final catch-up tick: ask server to merge any ready chunk(s) before finalize.
            // If backend auto-tick is active, do NOT tick from the app (avoid duplicate orchestration).
            if (!rollingAutoTickActiveRef.current) {
              try {
                const startCatch = Date.now();
                const maxCatchMs = 90_000;
                let lastMerged = null;

                while (Date.now() - startCatch < maxCatchMs) {
                  // eslint-disable-next-line no-await-in-loop
                  const t = await tickRollingExport({ rollingId: rollingIdRef.current });

                  const notReady = !!t?.data?.notReady;
                  const inProgress = !!t?.data?.inProgress;
                  const merged = Number(t?.data?.mergedThroughIndex);

                  if (notReady || inProgress || !Number.isFinite(merged)) break;
                  if (lastMerged !== null && merged <= lastMerged) break;
                  lastMerged = merged;

                  // avoid hammering the backend
                  // eslint-disable-next-line no-await-in-loop
                  await new Promise((r) => setTimeout(r, 2000));
                }
              } catch (eCatchup) {
                console.warn(TAG, nowIso(), 'rolling catch-up error', {
                  message: eCatchup?.message,
                  status: eCatchup?.status,
                });
              }
            }

            setMessage('🧩 Assemblage MP4 (rolling)…');
            stepProgress(0.32, 'Assemblage…');

            const finalName = `${directory} ${combinedFilename}.mp4`;
            let finalizeRolling = null;
            const startFinalize = Date.now();
            const maxWaitMs = 12 * 60 * 1000; // user prefers completeness over speed
            let attempt = 0;
            while (Date.now() - startFinalize < maxWaitMs) {
              attempt += 1;
              try {
                if (attempt > 1) {
                  setMessage(`🧩 Assemblage MP4 (rolling)… (attente ${Math.round((Date.now() - startFinalize) / 1000)}s)`);
                }

                // eslint-disable-next-line no-await-in-loop
                finalizeRolling = await finalizeRollingExport({
                  rollingId: rollingIdRef.current,
                  directory,
                  filename: finalName,
                  stopTime: endTime,
                  tailTryCount: 1,
                  requireComplete: 1,
                });
                break;
              } catch (eFin) {
                const st = Number(eFin?.status) || 0;
                const msg = String(eFin?.message || '');
                const isNetwork = !st && /network request failed/i.test(msg);
                const retryable =
                  isNetwork ||
                  st === 409 || // still processing / incomplete
                  st === 500 ||
                  st === 502 ||
                  st === 503 ||
                  st === 504;

                if (!retryable) throw eFin;

                const retryAfterMsRaw =
                  Number(eFin?.details?.retryAfterMs) ||
                  Number(eFin?.details?.details?.retryAfterMs) ||
                  5000;
                const waitMs = Math.max(1000, Math.min(30_000, retryAfterMsRaw));

                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, waitMs));
              }
            }

            if (!finalizeRolling) {
              const err = new Error('Rolling finalize timeout (still incomplete)');
              err.status = 504;
              throw err;
            }

            // Provide a "saveLastRecording-like" shape for downstream code
            res = {
              data: {
                url: finalizeRolling?.data?.publicUrl,
                gcsPath: finalizeRolling?.data?.gcsPath,
                rollingId: rollingIdRef.current,
              },
            };
            rollingFinalized = true;
            stepProgress(0.4, 'MP4 prêt.');
          } else {
            throw new Error('No rollingId');
          }
        } catch (eRolling) {
          console.warn(TAG, nowIso(), 'rolling finalize failed, fallback to legacy saveLastRecording', {
            message: eRolling?.message,
            status: eRolling?.status,
          });

          // If backend is temporarily unreachable, do not start the slow fallback (it will fail too).
          if (!eRolling?.status && /network request failed/i.test(String(eRolling?.message || ''))) {
            setMessage('❌ Réseau indisponible pendant le STOP. Réessaie quand la connexion revient.');
            stepProgress(0.4, 'Réseau KO.');
            throw eRolling;
          }

          // Legacy fallback only (kept for resilience).
          try {
            setMessage('⏳ Génération MP4 (fallback legacy) en cours...');
            stepProgress(0.32, 'Traitement…');
            debugLog(TAG, nowIso(), 'fallback saveLastRecording call start');
            res = await saveLastRecording(payload);
            debugLog(TAG, nowIso(), 'fallback saveLastRecording call success', safeJson(res));
            stepProgress(0.4, 'MP4 prêt.');
          } catch (e2) {
            console.error(TAG, nowIso(), 'fallback saveLastRecording error', e2);
            throw eRolling;
          }
        }

        const sourceUrl = resolveUrlFromSaveLastRecordingResponse(res);
        if (!sourceUrl) {
          console.error(TAG, nowIso(), '❌ saveLastRecording: no URL', safeJson(res));
          setMessage("❌ MP4 non disponible (pas d'URL retournée).");
          stepProgress(0.4, 'URL MP4 manquante.');
          stopHadError = true;
          return;
        }

        const duration = resolveDurationSeconds(res, timeElapsed);

        // 2) Upload HTTP(S) -> GCS (skip if rolling already produced final file in GCS)
        if (rollingFinalized && typeof res?.data?.gcsPath === 'string' && res.data.gcsPath) {
          setMessage('Vidéo uploadée avec succès');
          stepProgress(0.78, 'Upload OK.');
        } else {
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
            console.error(TAG, nowIso(), '❌ Upload-from-url échoué', err);
            setMessage('❌ Upload vidéo échoué');
            stepProgress(0.78, 'Upload KO.');
            stopHadError = true;
          }
        }

        // 3) Fusion images
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
          console.error(TAG, nowIso(), '❌ Fusion images échouée', err);
          setMessage('❌ Fusion images échouée');
          stepProgress(0.98, 'Miniature KO.');
          stopHadError = true;
        }
      } catch (err) {
        console.error(TAG, nowIso(), '❌ Erreur générale STOP/save/upload', err);
        setMessage(`❌ Erreur générale: ${err?.message || 'Erreur inconnue'}`);
        stepProgress(progressValue || 0.5, 'Erreur.');
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
        if (stopHadError) {
          stepProgress(1, 'Terminé (erreur).');
          // ne masque pas automatiquement pour laisser le détail visible
          endProgress(null, { autoHide: false });
        } else {
          setMessage('Enregistrement terminé avec succès');
          endProgress('Terminé.');
        }
      }
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
          const roll = await startRollingExport({
            deviceId: selectedDevice.deviceId,
            cameraId: selectedDevice.cameraId,
            beginTime,
            offset: tz,
            voiceSwitch: 0,
            chunkSec: 60,
            lagSec: 60,
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
          } else {
            rollingIdRef.current = null;
            rollingAutoTickActiveRef.current = false;
          }
        } catch (eRoll) {
          console.warn(TAG, nowIso(), 'startRollingExport failed (ignored)', {
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
        setMessage('Enregistrement en cours...');
      } catch (error) {
        console.error(TAG, nowIso(), '❌ Échec start HikConnect', {
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
