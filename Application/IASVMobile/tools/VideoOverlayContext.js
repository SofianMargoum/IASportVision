import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const VideoOverlayContext = createContext(null);

export const VideoOverlayProvider = ({ rootRef, children }) => {
  const [videoUri, setVideoUri] = useState(null);
  const [zoomMap, setZoomMap] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [anchorRectInWindow, setAnchorRectInWindow] = useState(null);

  const rootOffsetRef = useRef({ x: 0, y: 0 });
  const anchorRectRef = useRef(null);

  const measureRootOffset = useCallback(() => {
    return new Promise((resolve) => {
      const root = rootRef?.current;
      if (!root?.measureInWindow) {
        rootOffsetRef.current = { x: 0, y: 0 };
        resolve(rootOffsetRef.current);
        return;
      }
      root.measureInWindow((x, y) => {
        rootOffsetRef.current = { x: x || 0, y: y || 0 };
        resolve(rootOffsetRef.current);
      });
    });
  }, [rootRef]);

  const openVideo = useCallback((nextVideoUri, nextZoomMap) => {
    setVideoUri(nextVideoUri);
    setZoomMap(nextZoomMap);
  }, []);

  const closeVideo = useCallback(() => {
    setIsFullScreen(false);
    setIsTransitioning(false);
    setVideoUri(null);
    setZoomMap(null);
    setAnchorRectInWindow(null);
    anchorRectRef.current = null;
  }, []);

  const setTransitioning = useCallback((value) => {
    setIsTransitioning(!!value);
  }, []);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  const exitFullScreen = useCallback(() => {
    setIsFullScreen(false);
  }, []);

  const setAnchorRect = useCallback(async (rect) => {
    // Rect is in window coords; we store it as-is and compute root offset separately.
    if (!rect) return;
    const prev = anchorRectRef.current;
    const delta = prev
      ? Math.max(
          Math.abs((prev.x ?? 0) - rect.x),
          Math.abs((prev.y ?? 0) - rect.y),
          Math.abs((prev.width ?? 0) - rect.width),
          Math.abs((prev.height ?? 0) - rect.height)
        )
      : Infinity;

    // Ignore tiny/no-op changes to avoid layout loops.
    if (delta < 1) return;

    await measureRootOffset();
    anchorRectRef.current = rect;
    setAnchorRectInWindow(rect);
  }, [measureRootOffset]);

  const value = useMemo(
    () => ({
      videoUri,
      zoomMap,
      isFullScreen,
      isTransitioning,
      anchorRectInWindow,
      rootOffsetRef,
      openVideo,
      closeVideo,
      toggleFullScreen,
      exitFullScreen,
      setIsTransitioning: setTransitioning,
      setAnchorRectInWindow: setAnchorRect,
    }),
    [
      videoUri,
      zoomMap,
      isFullScreen,
      isTransitioning,
      anchorRectInWindow,
      openVideo,
      closeVideo,
      toggleFullScreen,
      exitFullScreen,
      setTransitioning,
      setAnchorRect,
    ]
  );

  return <VideoOverlayContext.Provider value={value}>{children}</VideoOverlayContext.Provider>;
};

export const useVideoOverlay = () => {
  const ctx = useContext(VideoOverlayContext);
  if (!ctx) throw new Error('useVideoOverlay must be used within VideoOverlayProvider');
  return ctx;
};
