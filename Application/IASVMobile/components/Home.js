import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import ListeVideo from './Video/ListeVideo';
import ListeVideoSidebar from './Video/ListeVideoSidebar';

const scale = 0.85;

const Home = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  const handleBackClick = () => {
    setSelectedVideo(null);
    return true;
  };

  useEffect(() => {
    if (selectedVideo) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackClick);
      return () => backHandler.remove();
    }
  }, [selectedVideo]);

  return (
    <View style={styles.container}>
      {selectedVideo ? (
        <View style={styles.listeVideo}>
          <ListeVideo selectedVideo={selectedVideo} />
        </View>
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

export default Home;