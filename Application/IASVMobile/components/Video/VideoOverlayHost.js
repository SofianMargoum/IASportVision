import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import Orientation from 'react-native-orientation-locker';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { useVideoOverlay } from '../../tools/VideoOverlayContext';
import OptimizedVideoPlayer from './OptimizedVideoPlayer';

const showSystemUI = () => {
  StatusBar.setHidden(false, 'fade');
  if (Platform.OS === 'android') SystemNavigationBar.navigationShow();
};

const hideSystemUI = () => {
  StatusBar.setHidden(true, 'fade');
  if (Platform.OS === 'android') SystemNavigationBar.immersive();
};

const VideoOverlayHost = () => {
  const {
    videoUri,
    zoomMap,
    isFullScreen,
    isTransitioning,
    setIsTransitioning,
    anchorRectInWindow,
    rootOffsetRef,
    toggleFullScreen,
    exitFullScreen,
  } = useVideoOverlay();

  const window = useWindowDimensions();
  const windowRef = useRef({ width: window.width, height: window.height });
  const [fullLayout, setFullLayout] = useState({ width: window.width, height: window.height });
  const lastCollapsedRectRef = useRef(null);

  useEffect(() => {
    windowRef.current = { width: window.width, height: window.height };
  }, [window.width, window.height]);

  const waitForWindowOrientation = useCallback((target, timeoutMs = 600) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const { width, height } = windowRef.current;
        const ok = target === 'landscape' ? width > height : height >= width;
        if (ok) return resolve(true);
        if (Date.now() - start >= timeoutMs) return resolve(false);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }, []);

  const collapsedRect = useMemo(() => {
    if (!videoUri) return null;

    if (!anchorRectInWindow) {
      if (lastCollapsedRectRef.current) return lastCollapsedRectRef.current;
      const width = window.width;
      const height = Math.round((width * 9) / 16);
      return { x: 0, y: 0, width, height };
    }

    const rootOffset = rootOffsetRef.current || { x: 0, y: 0 };
    const rect = {
      x: Math.max(0, anchorRectInWindow.x - rootOffset.x),
      y: Math.max(0, anchorRectInWindow.y - rootOffset.y),
      width: anchorRectInWindow.width,
      height: anchorRectInWindow.height,
    };

    lastCollapsedRectRef.current = rect;

    return rect;
  }, [videoUri, anchorRectInWindow, rootOffsetRef, window.width]);

  const effectiveCollapsedRect = collapsedRect || lastCollapsedRectRef.current;

  // Pas d'animation: layout instantané (évite les saccades).
  const playerLayoutStyle = useMemo(() => {
    if (!videoUri) return null;

    if (isFullScreen) {
      return {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 0,
        overflow: 'hidden',
      };
    }

    const width = effectiveCollapsedRect?.width ?? window.width;
    const height = effectiveCollapsedRect?.height ?? Math.round((width * 9) / 16);

    return {
      position: 'absolute',
      top: effectiveCollapsedRect?.y ?? 0,
      left: effectiveCollapsedRect?.x ?? 0,
      width,
      height,
      borderRadius: 12,
      overflow: 'hidden',
    };
  }, [videoUri, isFullScreen, collapsedRect, effectiveCollapsedRect, window.width, window.height]);

  // Transition la plus fluide: petit fade-out -> switch -> fade-in (native driver),
  // sans animer la taille/position pour éviter les saccades.
  const opacityAV = useRef(new Animated.Value(1)).current;
  const isTransitioningRef = useRef(false);

  const fadeTo = useCallback(
    (toValue, duration, onEnd) => {
      Animated.timing(opacityAV, {
        toValue,
        duration,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onEnd?.();
      });
    },
    [opacityAV]
  );

  useEffect(() => {
    if (!videoUri) return;
    // À l'ouverture uniquement.
    opacityAV.stopAnimation();
    opacityAV.setValue(0);
    fadeTo(1, 140);
  }, [videoUri, fadeTo, opacityAV]);

  const toggleFullScreenSmooth = useCallback(() => {
    if (!videoUri) return;
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning?.(true);

    // Pas de fade-out animé (ça rajoute une latence). On masque instant, on fade-in après rotation.
    opacityAV.stopAnimation();
    opacityAV.setValue(0);

    const enteringFullScreen = !isFullScreen;
    if (enteringFullScreen) {
      Orientation.lockToLandscape();
      hideSystemUI();
      toggleFullScreen();
      waitForWindowOrientation('landscape').then(() => {
        requestAnimationFrame(() => {
          fadeTo(1, 140, () => {
            isTransitioningRef.current = false;
            setIsTransitioning?.(false);
          });
        });
      });
    } else {
      toggleFullScreen();
      Orientation.lockToPortrait();
      showSystemUI();
      waitForWindowOrientation('portrait').then(() => {
        requestAnimationFrame(() => {
          fadeTo(1, 140, () => {
            isTransitioningRef.current = false;
            setIsTransitioning?.(false);
          });
        });
      });
    }
  }, [
    videoUri,
    fadeTo,
    opacityAV,
    toggleFullScreen,
    isFullScreen,
    waitForWindowOrientation,
    setIsTransitioning,
  ]);

  const exitFullScreenSmooth = useCallback(() => {
    if (!videoUri) return;
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning?.(true);

    opacityAV.stopAnimation();
    opacityAV.setValue(0);
    exitFullScreen();
    Orientation.lockToPortrait();
    showSystemUI();
    waitForWindowOrientation('portrait').then(() => {
      requestAnimationFrame(() => {
        fadeTo(1, 140, () => {
          isTransitioningRef.current = false;
          setIsTransitioning?.(false);
        });
      });
    });
  }, [videoUri, fadeTo, opacityAV, exitFullScreen, waitForWindowOrientation, setIsTransitioning]);

  useEffect(() => {
    if (!videoUri) return;
    return () => {
      setIsTransitioning?.(false);
      Orientation.lockToPortrait();
      showSystemUI();
    };
  }, [videoUri, setIsTransitioning]);

  if (!videoUri) return null;

  const containerWidth = isFullScreen
    ? (fullLayout.width || window.width)
    : effectiveCollapsedRect?.width ?? window.width;
  const containerHeight = isFullScreen
    ? (fullLayout.height || window.height)
    : effectiveCollapsedRect?.height ?? window.height;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <Animated.View
        style={[styles.playerContainer, playerLayoutStyle, { opacity: opacityAV }]}
        pointerEvents="auto"
        renderToHardwareTextureAndroid
        onLayout={(e) => {
          if (!isFullScreen) return;
          const { width, height } = e?.nativeEvent?.layout || {};
          if (!width || !height) return;
          if (
            Math.abs((fullLayout?.width ?? 0) - width) < 1 &&
            Math.abs((fullLayout?.height ?? 0) - height) < 1
          ) {
            return;
          }
          setFullLayout({ width, height });
        }}
      >
        <OptimizedVideoPlayer
          videoUri={videoUri}
          zoomMap={zoomMap}
          isFullScreen={isFullScreen}
          isTransitioning={isTransitioning}
          onToggleFullScreen={toggleFullScreenSmooth}
          onExitFullScreen={exitFullScreenSmooth}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  playerContainer: {
    backgroundColor: 'black',
  },
});

export default VideoOverlayHost;
