import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const CustomVideoPlayer = ({ videoUri }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [paused, setPaused] = useState(true);

  // Gestion du plein écran
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    StatusBar.setHidden(!isFullScreen);
  };

  // Gestion du play/pause via JavaScript injecté dans le WebView
  const togglePlayPause = () => {
    setPaused(!paused);
  };

  return (
    <View style={isFullScreen ? styles.fullScreenContainer : styles.videoContainer}>
      {/* WebView pour la vidéo */}
      <WebView
        source={{ uri: videoUri }}
        style={styles.webView}
        mediaPlaybackRequiresUserAction={false} 
        allowsFullscreenVideo
      />

      {/* Contrôles vidéo */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={togglePlayPause} style={styles.button}>
          <Text style={styles.buttonText}>{paused ? '▶️' : '⏸'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleFullScreen} style={styles.button}>
          <Text style={styles.buttonText}>{isFullScreen ? '↩️' : '⛶'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  videoContainer: {
    width: '100%',
    height: 250, // Taille normale
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullScreenContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  button: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
  },
});

export default CustomVideoPlayer;
