import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import ListeVideo from './Video/ListeVideo';
import ListeVideoSidebar from './Video/ListeVideoSidebar';

const scale = 0.85;

const Video = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  const handleBackClick = () => {
    setSelectedVideo(null);
    return true;
  };

  const handleSwipeRight = ({ nativeEvent }) => {
    if (nativeEvent.translationX > 50) { // Si on détecte un swipe de 50px vers la droite
      handleBackClick();
    }
  };

  useEffect(() => {
    if (selectedVideo) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackClick);
      return () => backHandler.remove();
    }
  }, [selectedVideo]);

  return (
    <View style={styles.container}>
      {/* Détection du swipe seulement sur l'écran de la vidéo sélectionnée */}
      {selectedVideo ? (
        <PanGestureHandler onGestureEvent={handleSwipeRight} activeOffsetX={[-10, 10]}>
          <View style={styles.listeVideo}>
            <ListeVideo selectedVideo={selectedVideo} />
          </View>
        </PanGestureHandler>
      ) : (
        <View style={styles.listeVideoSidebar}>
          <ListeVideoSidebar onVideoSelect={handleVideoSelect} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#010914',
  },
  listeVideo: {
    flex: 1,
  },
  listeVideoSidebar: {
    flex: 1,
  },
});

export default Video;
