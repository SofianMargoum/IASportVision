import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions } from 'react-native';
import VideoControls from 'react-native-video-controls';
import Orientation from 'react-native-orientation-locker';

const { width, height } = Dimensions.get('window');

const MatchComplet = ({ selectedVideo }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleFullScreenToggle = () => {
    if (!isFullScreen) {
      Orientation.lockToLandscape(); // Mode paysage
    } else {
      Orientation.lockToPortrait(); // Mode portrait
    }
    setIsFullScreen(!isFullScreen);
  };

  const handleEnd = () => {
    console.log('La vidéo est terminée !');
  };

  return (
    <View style={styles.container}>
      {selectedVideo ? (
        <>
          {/* Vidéo avec contrôles personnalisés */}
          <VideoControls
            source={{ uri: selectedVideo.url }}
            style={styles.video}
            resizeMode="contain"
            isFullscreen={false}
            onEnterFullscreen={handleFullScreenToggle}
            onExitFullscreen={handleFullScreenToggle}
            onEnd={handleEnd}
            showOnStart
            controlTimeout={3000}
            tapAnywhereToPause={false} // Désactiver play/pause par clic
            disableVolume // Désactive la barre de volume
            disableBack // Désactive le bouton retour
          />

          {/* Mode Plein Écran */}
          {isFullScreen && (
            <Modal
              visible={isFullScreen}
              animationType="slide"
              onRequestClose={handleFullScreenToggle}
            >
              <View style={styles.fullScreenContainer}>
                <VideoControls
                  source={{ uri: selectedVideo.url }}
                  style={styles.fullScreenVideo}
                  resizeMode="contain"
                  isFullscreen={true}
                  onEnterFullscreen={handleFullScreenToggle}
                  onExitFullscreen={handleFullScreenToggle}
                  onEnd={handleEnd}
                  showOnStart
                  controlTimeout={3000}
                  tapAnywhereToPause={false} // Désactiver play/pause par clic
                  disableVolume // Désactive la barre de volume en plein écran
                  disableBack // Désactive le bouton retour en plein écran
                />
              </View>
            </Modal>
          )}
        </>
      ) : (
        <Text style={styles.noContentText}>Aucune vidéo sélectionnée.</Text>
      )}
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
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },
  noContentText: {
    color: '#FFF',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default MatchComplet;
