import { useState, useRef, useEffect } from 'react';
import { Dimensions } from 'react-native';
import ZoomablePlayer from './ZoomablePlayer';
import PlayerControls from './PlayerControls';

const useVideoLogic = (videoUri, ui = {}) => {
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
  const [videoDimensions, setVideoDimensions] = useState({ width: 3040, height: 1368 });
  const [windowDimensions, setWindowDimensions] = useState(Dimensions.get('window'));

  const videoRef = useRef(null);
  const zoomableViewRef = useRef(null);
  const touchStartTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const resumeAfterModeSwitchRef = useRef(false);

  const { width: windowWidth, height: windowHeight } = windowDimensions;

  const aspectRatio = videoDimensions.width / videoDimensions.height;
  const baseWidth = isFullScreen ? windowWidth : (containerWidth ?? windowWidth);
  const videoWidth = baseWidth;
  const videoHeight = (containerHeight && !isFullScreen) ? containerHeight : (baseWidth / aspectRatio);

  const toggleTapped = () => setTapped(prev => !prev);
  const togglePlayPause = () => setPaused(prev => !prev);
  const toggleFullScreen = () => {
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

  const renderPlayer = (containerStyle, videoStyle) => {
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
      currentTime,
      tapped,
      renderControls: () => PlayerControls({
        paused,
        togglePlayPause,
        currentTime,
        duration,
        videoRef,
        toggleFullScreen,
        exitFullScreen,
        isFullScreen,
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
            height: meta.naturalSize.height,
          });
        }
      },
    });
  };

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
