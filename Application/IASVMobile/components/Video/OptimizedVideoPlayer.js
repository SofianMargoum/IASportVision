// components/OptimizedVideoPlayer.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import useVideoLogic from './OptimizedVideoPlayer/useVideoLogic';
import styles from './OptimizedVideoPlayer/styles';

const OptimizedVideoPlayer = ({ videoUri, zoomMap }) => {
  const {
    isFullScreen, videoHeight, windowWidth, windowHeight,
    renderPlayer,
  } = useVideoLogic(videoUri, zoomMap);

  console.log('OptimizedVideoPlayer render, isFullScreen:', isFullScreen);

  if (isFullScreen) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.fullScreenWrapper}>
          {renderPlayer({ width: windowWidth, height: windowHeight }, styles.fullScreenVideo)}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: windowWidth, height: videoHeight }]}>
      {renderPlayer({ width: windowWidth, height: videoHeight }, styles.video)}
    </View>
  );
};

export default OptimizedVideoPlayer;
