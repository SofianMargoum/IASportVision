import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import OptimizedVideoPlayer from './OptimizedVideoPlayer';

const MatchComplet = ({ selectedVideo }) => {
  const videoComponent = useMemo(() => {
    if (!selectedVideo) {
      return <Text style={styles.noContentText}>Aucune vidéo sélectionnée.</Text>;
    }
    return <OptimizedVideoPlayer key={selectedVideo.url} videoUri={selectedVideo.url} />;
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
    fontSize: 16,
  },
});

export default MatchComplet;
