// components/Video/MatchComplet.js
// Affiche le lecteur vidéo optimisé pour un match complet.
// Si aucune vidéo sélectionnée, affiche un message informatif.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useVideoOverlay } from '../../tools/VideoOverlayContext';

const MatchComplet = ({ selectedVideo }) => {
  const anchorRef = useRef(null);
  const lastRectRef = useRef(null);
  const measuredForUrlRef = useRef(null);
  const prevFullScreenRef = useRef(false);
  const { openVideo, setAnchorRectInWindow, isFullScreen, isTransitioning } = useVideoOverlay();

  useEffect(() => {
    if (selectedVideo?.url) {
      openVideo(selectedVideo.url, selectedVideo.jsonUrl);
    }
  }, [selectedVideo?.url, selectedVideo?.jsonUrl, openVideo]);


  const measureAnchor = () => {
    const node = anchorRef.current;
    if (!node?.measureInWindow) return;
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        const prev = lastRectRef.current;
        const delta = prev
          ? Math.max(
              Math.abs((prev.x ?? 0) - x),
              Math.abs((prev.y ?? 0) - y),
              Math.abs((prev.width ?? 0) - width),
              Math.abs((prev.height ?? 0) - height)
            )
          : Infinity;


        if (delta < 2) return;
        const nextRect = { x, y, width, height };
        lastRectRef.current = nextRect;
        measuredForUrlRef.current = selectedVideo?.url || null;
        setAnchorRectInWindow(nextRect);
      }
    });
  };

  if (!selectedVideo || !selectedVideo.url) {
    return (
      <View style={styles.container}>
        <Text style={styles.noContentText}>
          Aucune vidéo sélectionnée.{"\n"}
          Veuillez choisir une vidéo depuis la liste.
        </Text>
      </View>
    );
  }

  useEffect(() => {
    if (!selectedVideo?.url) return;
    if (isFullScreen || isTransitioning) return;
    measuredForUrlRef.current = null;
    lastRectRef.current = null;
    const id = requestAnimationFrame(measureAnchor);
    return () => cancelAnimationFrame(id);
  }, [selectedVideo?.url, isFullScreen, isTransitioning]);

  useEffect(() => {
    const wasFull = prevFullScreenRef.current;
    prevFullScreenRef.current = isFullScreen;
    if (wasFull && !isFullScreen && selectedVideo?.url && !isTransitioning) {
      const id = requestAnimationFrame(measureAnchor);
      return () => cancelAnimationFrame(id);
    }
  }, [isFullScreen, selectedVideo?.url, isTransitioning]);

  useEffect(() => {
    if (!selectedVideo?.url) return;
    const subscription = Dimensions.addEventListener('change', () => {
      if (isFullScreen || isTransitioning) return;
      measuredForUrlRef.current = null;
      lastRectRef.current = null;
      measureAnchor();
    });
    return () => subscription?.remove();
  }, [selectedVideo?.url, isFullScreen, isTransitioning]);

  return (
    <View style={styles.container}>
      <View
        ref={anchorRef}
        onLayout={() => {
          if (!selectedVideo?.url) return;
          if (isFullScreen || isTransitioning) return;
          if (measuredForUrlRef.current === selectedVideo.url) return;
          measureAnchor();
        }}
        style={styles.playerAnchor}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  playerAnchor: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'black',
  },
  noContentText: {
    color: '#FFF',
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});

export default MatchComplet;
