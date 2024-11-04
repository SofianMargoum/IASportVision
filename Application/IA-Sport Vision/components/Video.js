import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ListeVideo from './Video/ListeVideo';
import ListeVideoSidebar from './Video/ListeVideoSidebar';
import Icon from 'react-native-vector-icons/FontAwesome';

const scale = 0.85; // Ajustez cette valeur selon vos besoins

const Video = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  const handleBackClick = () => {
    setSelectedVideo(null);
  };

  return (
    <View style={styles.container}>
      {/* Liste de vidéos sélectionnée */}
      {selectedVideo && (
        <View style={styles.listeVideo}>
          <View style={styles.videoHeader}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackClick}>
              <Icon name="arrow-left" size={24 * scale} color="#00BFFF" />
              <Text style={styles.selectedVideoTitle}>{selectedVideo.name}</Text>
            </TouchableOpacity>
          </View>
          <ListeVideo selectedVideo={selectedVideo} />
        </View>
      )}

      {/* Liste de vidéos dans la barre latérale */}
      {!selectedVideo && (
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
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10 * scale, // Échelle appliquée ici
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedVideoTitle: {
    marginLeft: 10 * scale, // Échelle appliquée ici
    fontSize: 18 * scale, // Échelle appliquée ici
    color: '#00BFFF', // Texte bleu clair pour le texte actif
  },
});

export default Video;
