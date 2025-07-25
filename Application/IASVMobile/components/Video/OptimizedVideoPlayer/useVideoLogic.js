import { useState, useRef, useEffect } from 'react';
import { Dimensions, Platform, StatusBar } from 'react-native';
import Orientation from 'react-native-orientation-locker';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { uploadZoomMapToApi } from '../../api';
import { getFilenameFromVideoUri, smoothMoveTo } from './utils';
import ZoomablePlayer from './ZoomablePlayer';
import PlayerControls from './PlayerControls';

const useVideoLogic = (videoUri, zoomMap) => {
  const [tapped, setTapped] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomData, setZoomData] = useState({});
  const [zoomMapExport, setZoomMapExport] = useState({});
  const [sentTimes, setSentTimes] = useState([]);
  const [isUploadMode, setIsUploadMode] = useState(false);

  const videoRef = useRef(null);
  const zoomableViewRef = useRef(null);
  const touchStartTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const lastOffsetRef = useRef({ x: null, y: null });
  const lastAnimationSecondRef = useRef(null);
  const currentAnimationIdRef = useRef(0);

  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  const videoWidth = windowWidth;
  const videoHeight = windowWidth / (16 / 9);
  const filename = getFilenameFromVideoUri(videoUri);

  const lastPositionRef = useRef({
    x: videoWidth / 2,
    y: videoHeight / 2,
  });

  const toggleTapped = () => setTapped(prev => !prev);
  const togglePlayPause = () => setPaused(prev => !prev);
  const toggleFullScreen = () => setIsFullScreen(prev => !prev);
  const handleTouchStart = () => { touchStartTimeRef.current = Date.now(); };
  const handleTouchEnd = () => {
    if (Date.now() - touchStartTimeRef.current < 200) toggleTapped();
  };

  const getZoomedOffset = ({ x, y }, videoWidth, videoHeight) => {
    const zoom = 3;
    const contentW = videoWidth * zoom;
    const contentH = videoHeight * zoom;

    return {
      x: (x / 100) * contentW - videoWidth / 2,
      y: (y / 100) * contentH - videoHeight / 2,
    };
  };

  const renderPlayer = (containerStyle, videoStyle) => ZoomablePlayer({
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
    windowWidth: videoWidth,
    windowHeight: videoHeight,
    currentTime,
    setZoomMapExport,
    tapped,
    renderControls: () => PlayerControls({
      paused,
      togglePlayPause,
      currentTime,
      duration,
      videoRef,
      toggleFullScreen,
      isFullScreen,
      isUploadMode,
      setIsUploadMode
    })
  });

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

  useEffect(() => {
    if (isUploadMode) return;

    const flooredTime = Math.floor(currentTime);
    if (lastAnimationSecondRef.current === flooredTime) return;
    lastAnimationSecondRef.current = flooredTime;

    const times = Object.keys(zoomData).map(Number).sort((a, b) => b - a);
    const closestTime = times.find(t => currentTime >= t);
    const zoomTarget = zoomData[closestTime];

    if (
      zoomTarget &&
      typeof zoomTarget.x === 'number' &&
      typeof zoomTarget.y === 'number'
    ) {
      const { x: offsetX, y: offsetY } = getZoomedOffset(zoomTarget, videoWidth, videoHeight);

      if (
        lastOffsetRef.current.x !== offsetX ||
        lastOffsetRef.current.y !== offsetY
      ) {
        lastOffsetRef.current = { x: offsetX, y: offsetY };
        console.log("🎯 moveTo (corrected for zoom):", { offsetX, offsetY });
        smoothMoveTo(offsetX, offsetY, zoomableViewRef, lastPositionRef, currentAnimationIdRef);
      }
    }
  }, [currentTime, zoomData, isUploadMode]);

  useEffect(() => {
    const floored = Math.floor(currentTime);
    if (floored % 10 === 0 && !sentTimes.includes(floored)) {
      setSentTimes(prev => [...prev, floored]);
      if (isUploadMode && Object.keys(zoomMapExport).length > 0) {
        uploadZoomMapToApi(zoomMapExport, filename);
      }
    }
  }, [currentTime, isUploadMode]);

  useEffect(() => {
    const showUI = () => {
      StatusBar.setHidden(false, 'fade');
      if (Platform.OS === 'android') SystemNavigationBar.navigationShow();
    };
    const hideUI = () => {
      StatusBar.setHidden(true, 'fade');
      if (Platform.OS === 'android') SystemNavigationBar.immersive();
    };

    if (isFullScreen) {
      Orientation.lockToLandscape();
      setTimeout(hideUI, 5);
    } else {
      Orientation.lockToPortrait();
      setTimeout(showUI, 5);
    }

    return () => {
      Orientation.lockToPortrait();
      showUI();
    };
  }, [isFullScreen]);

  return {
    isFullScreen,
    videoHeight,
    windowWidth: videoWidth,
    windowHeight: videoHeight,
    renderPlayer
  };
};

export default useVideoLogic;
