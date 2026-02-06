import { useState, useRef, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { uploadZoomMapToApi } from '../../../tools/api';
import { getFilenameFromVideoUri, smoothMoveTo } from './utils';
import ZoomablePlayer from './ZoomablePlayer';
import PlayerControls from './PlayerControls';

const useVideoLogic = (videoUri, zoomMap, ui = {}) => {
  const {
    isFullScreen = false,
    isTransitioning = false,
    onToggleFullScreen,
    onExitFullScreen,
    containerWidth,
    containerHeight,
  } = ui;

  const [tapped, setTapped] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoomData, setZoomData] = useState({});
  const [zoomMapExport, setZoomMapExport] = useState({});
  const [sentTimes, setSentTimes] = useState([]);
  const [isUploadMode, setIsUploadMode] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 3040, height: 1368 }); // dimensions réelles
  const [balloonActive, setBalloonActive] = useState(false); // 🔵 ballon ON = zoom auto actif
  const [windowDimensions, setWindowDimensions] = useState(Dimensions.get('window'));

  const videoRef = useRef(null);
  const zoomableViewRef = useRef(null);
  const touchStartTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const resumeAfterModeSwitchRef = useRef(false);
  const lastOffsetRef = useRef({ x: null, y: null });
  const lastAnimationSecondRef = useRef(-1); // pas 0 !

  const currentAnimationIdRef = useRef(0);
  const hasLaunchedAtZeroRef = useRef(false);

  const { width: windowWidth, height: windowHeight } = windowDimensions;

  const aspectRatio = videoDimensions.width / videoDimensions.height;
  const baseWidth = isFullScreen ? windowWidth : (containerWidth ?? windowWidth);
  const videoWidth = baseWidth;
  const videoHeight = (containerHeight && !isFullScreen) ? containerHeight : (baseWidth / aspectRatio);

  const filename = getFilenameFromVideoUri(videoUri);

  const lastPositionRef = useRef({
    x: videoWidth / 2,
    y: videoHeight / 2,
  });

  const toggleTapped = () => setTapped(prev => !prev);
  const togglePlayPause = () => setPaused(prev => !prev);
  const toggleFullScreen = () => {
    // Pause pendant le changement de mode pour éviter flash / restart.
    resumeAfterModeSwitchRef.current = !paused;
    setPaused(true);
    onToggleFullScreen?.();
  };
  const exitFullScreen = () => {
    resumeAfterModeSwitchRef.current = !paused;
    setPaused(true);
    onExitFullScreen?.();
  };
  const handleTouchStart = () => { touchStartTimeRef.current = Date.now(); };
  const handleTouchEnd = () => {
    if (Date.now() - touchStartTimeRef.current < 200) toggleTapped();
  };

  // Écouter les changements de dimensions (orientation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  // À la sortie du plein écran, on désactive les modes spécifiques.
  useEffect(() => {
    if (!isFullScreen) {
      setIsUploadMode(false);
      setBalloonActive(false);
    }
  }, [isFullScreen]);

  // Pause/reprise calées sur la vraie transition overlay (plus fiable qu'un timeout fixe).
  useEffect(() => {
    if (isTransitioning) {
      setPaused(true);
      return;
    }

    if (resumeAfterModeSwitchRef.current) {
      resumeAfterModeSwitchRef.current = false;
      setPaused(false);
    }
  }, [isTransitioning]);

  const getZoomedOffset = ({ x, y }, videoWidth, videoHeight) => {
    const baseOffsetX = (x / 100) * videoWidth;
    const baseOffsetY = (y / 100) * videoHeight;

    const deltaX = (x - 50) / 50;
    const deltaY = (y - 50) / 50;

    let offsetX = baseOffsetX + deltaX * (videoWidth / 2);
    let offsetY = baseOffsetY + deltaY * (videoHeight / 2);

    offsetX = Math.max(-(videoWidth / 2), Math.min(offsetX, videoWidth + videoWidth / 2));
    offsetY = Math.max(-(videoHeight / 2), Math.min(offsetY, videoHeight + videoHeight / 2));

    return {
      x: Math.round(offsetX),
      y: Math.round(offsetY),
    };
  };

  const renderPlayer = (containerStyle, videoStyle) => {
    const playerWidth = containerStyle?.width ?? videoWidth;
    const playerHeight = containerStyle?.height ?? videoHeight;

    return ZoomablePlayer({
    zoomableViewRef,
    videoRef,
    paused,
    videoUri,
    containerStyle,
    videoStyle,
    setCurrentTime,
    currentTimeRef,
    setDuration,
    handleTouchStart,
    handleTouchEnd,
    windowWidth: playerWidth,
    windowHeight: playerHeight,
    currentTime,
    setZoomMapExport,
    tapped,
    balloonActive, // 👈 passé au composant zoomable
    renderControls: () => PlayerControls({
      paused,
      togglePlayPause,
      currentTime,
      duration,
      videoRef,
      toggleFullScreen,
      isFullScreen,
      isUploadMode,
      setIsUploadMode,
      balloonActive,
      setBalloonActive,
    }),
    onLoad: (meta) => {
      if (
        meta?.naturalSize?.width &&
        meta?.naturalSize?.height &&
        meta.naturalSize.width > 0 &&
        meta.naturalSize.height > 0
      ) {
        setVideoDimensions({
          width: meta.naturalSize.width,
          height: meta.naturalSize.height
        });
      }
    }
  });
  };

  // Chargement du zoomMap (fichier / objet)
  useEffect(() => {
    if (!zoomMap) return;
    (async () => {
      let data = {};
      if (typeof zoomMap === 'string') {
        try {
          const res = await fetch(zoomMap);
          data = await res.json();
        } catch (err) {
          console.error('Erreur de chargement zoomMap:', err);
        }
      } else if (typeof zoomMap === 'object') {
        data = zoomMap;
      }
      setZoomData(data);
    })();
  }, [zoomMap]);

  // Fonction pour remettre le zoom à 3
  const resetZoomToDefault = () => {
    if (zoomableViewRef.current?.zoomTo) {
      zoomableViewRef.current.zoomTo(3);
    }
  };

  // Quand le ballon devient BLEU : zoom = 3 + recentrage
  useEffect(() => {
    if (balloonActive) {
      // remet le zoom à 3
      resetZoomToDefault();

      // centre la caméra (option simple au centre de la vidéo)
      const center = {
        x: videoWidth / 2,
        y: videoHeight / 2,
      };

      lastOffsetRef.current = center;
      lastPositionRef.current = center;

      smoothMoveTo(
        [center],
        zoomableViewRef,
        lastPositionRef,
        currentAnimationIdRef
      );
    }
  }, [balloonActive, videoWidth, videoHeight]);

  // Application automatique du zoomMap (caméra auto) ⬅️ contrôlé par balloonActive
  useEffect(() => {
    const flooredTime = Math.floor(currentTime);
    const alreadyTriggered = lastAnimationSecondRef.current === flooredTime;

    const isZeroTime = flooredTime === 0;
    const isEvery5Sec = flooredTime % 5 === 0;
    const shouldTrigger = isZeroTime || isEvery5Sec;

    const zoomKeys = Object.keys(zoomData);

    if (
      isUploadMode ||          // si on est en mode upload, pas de replay auto
      !balloonActive ||        // ⚪ ballon OFF -> pas de zoom auto
      !shouldTrigger ||
      alreadyTriggered ||
      zoomKeys.length === 0
    ) return;

    lastAnimationSecondRef.current = flooredTime;

    const times = zoomKeys
      .map(Number)
      .filter(t => t >= flooredTime && t < flooredTime + 5)
      .sort((a, b) => a - b);

    const upcomingPositions = times
      .map(t => {
        const zoomTarget = zoomData[t];
        if (
          zoomTarget &&
          typeof zoomTarget.x === 'number' &&
          typeof zoomTarget.y === 'number'
        ) {
          return getZoomedOffset(zoomTarget, videoWidth, videoHeight);
        }
        return null;
      })
      .filter(Boolean);

    if (upcomingPositions.length > 0) {
      const last = lastOffsetRef.current;
      const first = upcomingPositions[0];

      if (last.x !== first.x || last.y !== first.y || isZeroTime) {
        lastOffsetRef.current = { x: first.x, y: first.y };
        console.log('smoothMoveTo:', upcomingPositions);
        smoothMoveTo(
          upcomingPositions,
          zoomableViewRef,
          lastPositionRef,
          currentAnimationIdRef
        );
      }
    }
  }, [currentTime, zoomData, isUploadMode, balloonActive, videoWidth, videoHeight]);

  // Upload régulier du zoomMapExport
  useEffect(() => {
    const floored = Math.floor(currentTime);
    if (floored % 10 === 0 && !sentTimes.includes(floored)) {
      setSentTimes(prev => [...prev, floored]);
      if (isUploadMode && Object.keys(zoomMapExport).length > 0) {
        uploadZoomMapToApi(zoomMapExport, filename);
      }
    }
  }, [currentTime, isUploadMode]);

  return {
    isFullScreen,
    videoHeight,
    windowWidth,
    windowHeight,
    renderPlayer,
    exitFullScreen,
  };
};

export default useVideoLogic;
