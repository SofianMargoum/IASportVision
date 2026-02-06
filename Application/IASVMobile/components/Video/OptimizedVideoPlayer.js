// components/OptimizedVideoPlayer.js
import React from 'react';
import { View } from 'react-native';
import useVideoLogic from './OptimizedVideoPlayer/useVideoLogic';
import styles from './OptimizedVideoPlayer/styles';

const OptimizedVideoPlayer = ({
  videoUri,
  zoomMap,
  isFullScreen,
  isTransitioning,
  onToggleFullScreen,
  onExitFullScreen,
  containerWidth,
  containerHeight,
}) => {
  const {
    videoHeight, windowWidth, windowHeight,
    renderPlayer,
  } = useVideoLogic(videoUri, zoomMap, {
    isFullScreen,
    isTransitioning,
    onToggleFullScreen,
    onExitFullScreen,
    containerWidth,
    containerHeight,
  });

  const effectiveWidth = containerWidth ?? windowWidth;
  const effectiveHeight = containerHeight ?? (isFullScreen ? windowHeight : videoHeight);

  return (
    <View style={[styles.wrapper, { width: effectiveWidth, height: effectiveHeight }]}>
      {renderPlayer({ width: effectiveWidth, height: effectiveHeight }, isFullScreen ? styles.fullScreenVideo : styles.video)}
    </View>
  );
};

export default OptimizedVideoPlayer;
