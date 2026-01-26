// components/Video/MatchComplet.js
// Affiche le lecteur vidéo optimisé pour un match complet.
// Si aucune vidéo sélectionnée, affiche un message informatif.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import OptimizedVideoPlayer from './OptimizedVideoPlayer';

const MatchComplet = ({ selectedVideo }) => {
  const videoComponent = useMemo(() => {
    if (!selectedVideo || !selectedVideo.url) {
      return (
        <Text style={styles.noContentText}>
          Aucune vidéo sélectionnée.{'\n'}
          Veuillez choisir une vidéo depuis la liste.
        </Text>
      );
    }
    return (
      <OptimizedVideoPlayer
        key={selectedVideo.url}
        videoUri={selectedVideo.url}
        zoomMap={selectedVideo.jsonUrl}
      />
    );
  }, [selectedVideo]);

  return <View style={styles.container}>{videoComponent}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
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
