import { useState, useEffect, useContext } from 'react';
import { searchClubs, startRecording, stopRecording, getPlaybackURI, uploadVideo, mergeImages } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import { UserContext } from './../../tools/UserContext';
import { useDeviceContext } from './../../tools/DeviceContext';

export const useVideoContent = () => {
  const { selectedClub, setSelectedClub } = useClubContext();
  const { user } = useContext(UserContext);
  const { devices, selectedIndex } = useDeviceContext();

  const [isRecording, setIsRecording] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [playbackURI, setPlaybackURI] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [filename, setFilename] = useState('');
  const [message, setMessage] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [timeoutId, setTimeoutId] = useState(null);
  const [selectedClubInfo, setSelectedClubInfo] = useState(null);
  const [counter, setCounter] = useState(0);
  const [secondCounter, setSecondCounter] = useState(0);

  // 👉 récupère l'appareil sélectionné
  const selectedDevice = selectedIndex !== null ? devices[selectedIndex] : null;

  // 👉 construit dynamiquement les params
  const params = {
    username: 'admin',
    password: 'Vidauban',
    ipAddress: selectedDevice?.domaine || '', // ton domaine sert d'IP
    port: selectedDevice?.port || 0,         // port de ton device
  };

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setTimeElapsed((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleInputChange = (text) => {
    setFilename(text);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(async () => {
      const results = await searchClubs(text);
      setSearchResults(results);
    }, 1000);

    setTimeoutId(newTimeoutId);
  };

  const handleResultClick = (result) => {
    setFilename(result.name);
    setSelectedClubInfo(result);
    setSearchResults([]);
  };

const handleButtonClick = async () => {
  if (!selectedDevice) {
    setMessage("❌ Aucun appareil sélectionné.");
    console.warn("⚠️ Aucun device trouvé", { selectedIndex, devices });
    return;
  }

  if (isRecording) {
    setFilename('');
    setSelectedClubInfo(null);
    setIsRecording(false);

    try {
      console.log("⏹️ Arrêt de l'enregistrement en cours...", params);
      setMessage("⏹️ Arrêt de l'enregistrement...");

      // 1) Stop Recording
      await stopRecording(params);
      console.log("✅ Enregistrement stoppé avec succès");
      setMessage("✅ Enregistrement stoppé avec succès");

      // 2) Get playback data
      console.log("📥 Récupération de l'URI de lecture...");
      setMessage("📥 Récupération de l'URI de lecture...");

      const playbackData = await getPlaybackURI(params);
      console.log("📀 PlaybackData reçu:", playbackData);

      const uri = playbackData?.playbackURI;
      const duration = playbackData?.videoDuration ?? 0;

      if (!uri) {
        console.error("❌ URI manquante dans playbackData");
        setMessage("❌ Enregistrement arrêté, mais aucune URI reçue.");
        return;
      }

      setPlaybackURI(uri);
      setVideoDuration(duration);

      // 3) Préparer nom et dossier
      const directory = selectedClub ? selectedClub.name : 'Unknown Club';
      const combinedFilename = selectedClubInfo
        ? `${counter} - ${secondCounter} ${selectedClubInfo.name}`
        : `${counter} - ${secondCounter} Unknown Club`;

      console.log("🗂️ Dossier:", directory, " Nom fichier:", combinedFilename);

      // 4) Upload vidéo
      try {
        console.log("☁️ Upload vidéo en cours...");
        setMessage("☁️ Upload vidéo en cours...");
        await uploadVideo(combinedFilename, uri, directory, duration);
        console.log("✅ Vidéo uploadée avec succès");
        setMessage("✅ Vidéo uploadée avec succès");
      } catch (err) {
        console.error("❌ Upload vidéo échoué", err);
        setMessage("❌ Upload vidéo échoué");
      }

      // 5) Fusion images
      const mergeParams = {
        logo1Url: selectedClub?.logo || 'https://storage.googleapis.com/ia-sport.appspot.com/images/logo_default.png',
        logo2Url: selectedClubInfo?.logo || 'https://storage.googleapis.com/ia-sport.appspot.com/images/logo_default.png',
        finalFolder: directory,
        finalName: `${directory} ${combinedFilename}.png`,
      };

      try {
        console.log("🖼️ Fusion des images en cours...", mergeParams);
        setMessage("🖼️ Fusion des images en cours...");
        const mergeResponse = await mergeImages(mergeParams);
        console.log("✅ Fusion réussie:", mergeResponse);
        setMessage(`✅ Fusion réussie ${mergeResponse?.url ? `: ${mergeResponse.url}` : ''}`);
      } catch (err) {
        console.error("❌ Fusion images échouée", err);
        setMessage("❌ Fusion images échouée");
      }
    } catch (err) {
      console.error("❌ Échec global lors de l'arrêt/envoi vidéo", err);
      setMessage(`❌ Erreur générale: ${err?.message || 'Erreur inconnue'}`);
    }
  } else {
    // START RECORDING
    try {
      console.log("▶️ Démarrage enregistrement...", params);
      setMessage("▶️ Démarrage enregistrement...");

      await startRecording(params);

      setIsRecording(true);
      setTimeElapsed(0);
      console.log("✅ Enregistrement démarré");
      setMessage("✅ Enregistrement démarré");
    } catch (error) {
      console.error("❌ Échec démarrage enregistrement:", error);
      setMessage(`❌ Échec démarrage enregistrement: ${error?.message || 'Erreur inconnue'}`);
    }
  }
};


  const clearSelectedClub = () => {
    setSelectedClubInfo(null);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const incrementCounter = () => setCounter((prev) => prev + 1);
  const decrementCounter = () => setCounter((prev) => Math.max(prev - 1, 0));
  const incrementSecondCounter = () => setSecondCounter((prev) => prev + 1);
  const decrementSecondCounter = () => setSecondCounter((prev) => Math.max(prev - 1, 0));

  return {
    user,
    selectedClub,
    selectedClubInfo,
    filename,
    searchResults,
    isRecording,
    timeElapsed,
    message,
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
  params,
  selectedDevice,
  };
};
