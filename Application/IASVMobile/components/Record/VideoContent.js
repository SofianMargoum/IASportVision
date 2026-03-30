import { useState, useEffect, useContext, useRef } from 'react';
import {
  searchClubs,
  hikStartRecording, // ✅ HikConnect START
  hikStopRecording,  // ✅ HikConnect STOP
  saveLastRecording, // ✅ HikConnect save segment -> URL (backend /save-last-from-device)
  uploadFromUrl,     // ✅ HTTP(S) -> GCS
  mergeImages,
} from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import { UserContext } from './../../tools/UserContext';
import { useDeviceContext } from './../../tools/DeviceContext';

const TAG = '[useVideoContent]';

const safeJson = (x) => {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
};

const nowIso = () => new Date().toISOString();

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

  // --- DEBUG: lifecycle / state changes ---
  useEffect(() => {
    console.log(TAG, nowIso(), 'mount');
    return () => console.log(TAG, nowIso(), 'unmount');
  }, []);

  useEffect(() => {
    console.log(TAG, nowIso(), 'selectedIndex/devices change', {
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
    console.log(TAG, nowIso(), 'isRecording change', isRecording);
  }, [isRecording]);

  useEffect(() => {
    console.log(TAG, nowIso(), 'timeElapsed', timeElapsed);
  }, [timeElapsed]);

  useEffect(() => {
    console.log(TAG, nowIso(), 'selectedClub change', selectedClub?.name || null);
  }, [selectedClub]);

  useEffect(() => {
    console.log(TAG, nowIso(), 'selectedClubInfo change', selectedClubInfo?.name || null);
  }, [selectedClubInfo]);

  useEffect(() => {
    console.log(TAG, nowIso(), 'counter change', counter);
  }, [counter]);

  useEffect(() => {
    console.log(TAG, nowIso(), 'secondCounter change', secondCounter);
  }, [secondCounter]);

  // Timer UI
  useEffect(() => {
    let timer;
    if (isRecording) {
      console.log(TAG, nowIso(), 'timer start');
      timer = setInterval(() => {
        setTimeElapsed((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => {
      if (timer) console.log(TAG, nowIso(), 'timer stop');
      clearInterval(timer);
    };
  }, [isRecording]);

  const handleInputChange = (text) => {
    console.log(TAG, nowIso(), 'handleInputChange', { text });

    setFilename(text);

    if (timeoutId) {
      console.log(TAG, nowIso(), 'clearTimeout', timeoutId);
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(async () => {
      console.log(TAG, nowIso(), 'searchClubs start', { query: text });
      try {
        const results = await searchClubs(text);
        console.log(TAG, nowIso(), 'searchClubs success', {
          count: Array.isArray(results) ? results.length : null,
        });
        setSearchResults(results);
      } catch (e) {
        console.error(TAG, nowIso(), 'searchClubs error', e);
        setSearchResults([]);
      }
    }, 1000);

    console.log(TAG, nowIso(), 'setTimeout scheduled', newTimeoutId);
    setTimeoutId(newTimeoutId);
  };

  const handleResultClick = (result) => {
    console.log(TAG, nowIso(), 'handleResultClick', {
      picked: result?.name,
      result: result ? { id: result.id, name: result.name } : null,
    });

    setFilename(result.name);
    setSelectedClubInfo(result);
    setSearchResults([]);
  };

  const clearSelectedClub = () => {
    console.log(TAG, nowIso(), 'clearSelectedClub');
    setSelectedClubInfo(null);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const incrementCounter = () => {
    console.log(TAG, nowIso(), 'incrementCounter');
    setCounter((prev) => prev + 1);
  };
  const decrementCounter = () => {
    console.log(TAG, nowIso(), 'decrementCounter');
    setCounter((prev) => Math.max(prev - 1, 0));
  };
  const incrementSecondCounter = () => {
    console.log(TAG, nowIso(), 'incrementSecondCounter');
    setSecondCounter((prev) => prev + 1);
  };
  const decrementSecondCounter = () => {
    console.log(TAG, nowIso(), 'decrementSecondCounter');
    setSecondCounter((prev) => Math.max(prev - 1, 0));
  };

  // --- Helpers ---
  const buildNames = (clubSnap, opponentSnap) => {
    const directory = clubSnap ? clubSnap.name : 'Unknown Club';
    const combinedFilename = opponentSnap
      ? `${counter} - ${secondCounter} ${opponentSnap.name}`
      : `${counter} - ${secondCounter} Unknown Club`;

    console.log(TAG, nowIso(), 'buildNames', { directory, combinedFilename });
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

    console.log(TAG, nowIso(), 'resolveUrl', { url, keys: Object.keys(res || {}) });
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
        console.log(TAG, nowIso(), 'resolveDurationSeconds from begin/end', { bt, et, d });
        return d;
      }
    }

    console.log(TAG, nowIso(), 'resolveDurationSeconds fallback', { fallbackSeconds });
    return fallbackSeconds;
  };

  /**
   * Hik-Connect model:
   * - START: hikStartRecording -> UI timer
   * - STOP: hikStopRecording -> saveLastRecording(begin/end) -> URL -> uploadFromUrl -> mergeImages
   */
  const handleButtonClick = async () => {
    console.log(TAG, nowIso(), 'handleButtonClick', {
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
      const endMs = Date.now();
      const startMs = recordStartMsRef.current;
      lastStopMsRef.current = endMs;

      let stopHadError = false;

      // snapshots (évite incohérences après reset UI)
      const clubSnap = selectedClub;
      const opponentSnap = selectedClubInfo;

      console.log(TAG, nowIso(), 'STOP pressed', { startMs, endMs, elapsedSec: timeElapsed });

      beginProgress('Arrêt…');

      // 1) STOP côté HikConnect
      try {
        setMessage('⏹️ Arrêt enregistrement (HikConnect)...');
        stepProgress(0.12, 'Stop caméra…');
        console.log(TAG, nowIso(), 'hikStopRecording start', { deviceId: selectedDevice.deviceId });

        const stopResp = await hikStopRecording({ deviceId: selectedDevice.deviceId });

        console.log(TAG, nowIso(), 'hikStopRecording success', safeJson(stopResp));
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
      console.log(TAG, nowIso(), 'UI reset (filename/clubInfo/isRecording)');
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

        console.log(TAG, nowIso(), 'saveLastRecording payload (WITH begin/end)', payload);

        let res;
        try {
          console.log(TAG, nowIso(), 'saveLastRecording call start');
          res = await saveLastRecording(payload);
          console.log(TAG, nowIso(), 'saveLastRecording call success', safeJson(res));
          stepProgress(0.4, 'MP4 prêt.');
        } catch (e) {
          console.error(TAG, nowIso(), 'saveLastRecording call error', e);
          console.error(TAG, nowIso(), 'saveLastRecording error details', {
            message: e?.message,
            status: e?.status,
            details: e?.details,
          });
          throw e;
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
        const { directory, combinedFilename } = buildNames(clubSnap, opponentSnap);

        // 2) Upload HTTP(S) -> GCS
        try {
          setMessage('☁️ Upload vidéo en cours...');
          stepProgress(0.55, 'Upload…');
          const targetFilename = `${directory} ${combinedFilename}.mp4`;

          console.log(TAG, nowIso(), 'uploadFromUrl start', {
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

          console.log(TAG, nowIso(), 'uploadFromUrl success', safeJson(uploadResp));
          setMessage('Vidéo uploadée avec succès');
          stepProgress(0.78, 'Upload OK.');
        } catch (err) {
          console.error(TAG, nowIso(), '❌ Upload-from-url échoué', err);
          setMessage('❌ Upload vidéo échoué');
          stepProgress(0.78, 'Upload KO.');
          stopHadError = true;
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

        console.log(TAG, nowIso(), 'mergeImages params', mergeParams);

        try {
          setMessage('🖼️ Fusion des images en cours...');
          stepProgress(0.9, 'Miniature…');
          console.log(TAG, nowIso(), 'mergeImages start');
          const mergeResponse = await mergeImages(mergeParams);
          console.log(TAG, nowIso(), 'mergeImages success', safeJson(mergeResponse));
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
        console.log(TAG, nowIso(), 'STOP finally cleanup');
        recordStartMsRef.current = null;
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
        console.log(TAG, nowIso(), 'hikStartRecording start', { deviceId: selectedDevice.deviceId });

        const startResp = await hikStartRecording({ deviceId: selectedDevice.deviceId });

        console.log(TAG, nowIso(), 'hikStartRecording success', safeJson(startResp));

        const start = Date.now();
        recordStartMsRef.current = start;

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
