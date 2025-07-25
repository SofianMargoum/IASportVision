// components/OptimizedVideoPlayer.js
import React from 'react';
import { View, Modal } from 'react-native';
import useVideoLogic from './OptimizedVideoPlayer/useVideoLogic';
import styles from './OptimizedVideoPlayer/styles';

const OptimizedVideoPlayer = ({ videoUri, zoomMap }) => {
  const {
    isFullScreen, videoHeight, windowWidth, windowHeight,
    renderPlayer,
  } = useVideoLogic(videoUri, zoomMap);

  return (
    <>
      {!isFullScreen ? (
        <View style={[styles.wrapper, { width: windowWidth, height: videoHeight }]}> 
          {renderPlayer({ width: windowWidth, height: videoHeight }, styles.video)}
        </View>
      ) : (
        <Modal visible={true} animationType="fade" presentationStyle="fullScreen">
          <View style={styles.fullScreenWrapper}>
            {renderPlayer({ width: windowWidth, height: windowHeight }, styles.fullScreenVideo)}
          </View>
        </Modal>
      )}
    </>
  );
};

export default OptimizedVideoPlayer;
