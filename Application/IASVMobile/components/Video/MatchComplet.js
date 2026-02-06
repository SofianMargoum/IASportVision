// components/Video/MatchComplet.js
// Affiche le lecteur vidéo optimisé pour un match complet.
// Si aucune vidéo sélectionnée, affiche un message informatif.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVideoOverlay } from '../../tools/VideoOverlayContext';

const MatchComplet = ({ selectedVideo }) => {
  const anchorRef = useRef(null);
  const { openVideo, closeVideo, setAnchorRectInWindow } = useVideoOverlay();

  useEffect(() => {
    if (selectedVideo?.url) {
      openVideo(selectedVideo.url, selectedVideo.jsonUrl);
      return;
    }
    closeVideo();
  }, [selectedVideo?.url, selectedVideo?.jsonUrl, openVideo, closeVideo]);

  useEffect(() => {
    // Si on quitte cet écran, on coupe le player.
    return () => {
      closeVideo();
    };
  }, [closeVideo]);

  const measureAnchor = () => {
    const node = anchorRef.current;
    if (!node?.measureInWindow) return;
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setAnchorRectInWindow({ x, y, width, height });
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

  return (
    <View style={styles.container}>
      <View
        ref={anchorRef}
        onLayout={measureAnchor}
        style={styles.playerAnchor}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
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
