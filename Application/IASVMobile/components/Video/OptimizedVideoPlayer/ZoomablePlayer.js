import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Video from 'react-native-video';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import styles from './styles';

const ZoomablePlayer = ({
  zoomableViewRef,
  videoRef,
  paused,
  videoUri,
  containerStyle,
  videoStyle,
  setCurrentTime,
  currentTimeRef,
  setDuration,
  handleTouchStart,
  handleTouchEnd,
  tapped,
  renderControls,
  onLoad,
}) => {
  return (
    <View style={[containerStyle, { backgroundColor: 'black' }]}>
      <ReactNativeZoomableView
        ref={zoomableViewRef}
        maxZoom={3}
        minZoom={1}
        initialZoom={3}
        style={{ flex: 1 }}
      >
        <Animated.View style={styles.content}>
          <View style={[styles.videoWrapper, containerStyle]}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={videoStyle}
              resizeMode="cover"
              paused={paused}
              bufferConfig={{
                minBufferMs: 15000,
                maxBufferMs: 50000,
                bufferForPlaybackMs: 250,
                bufferForPlaybackAfterRebufferMs: 500,
              }}
              repeat
              onProgress={(data) => {
                setCurrentTime(data.currentTime);
                currentTimeRef.current = Math.floor(data.currentTime);
              }}
              onLoad={(data) => {
                setDuration(data.duration);
                onLoad?.(data);
              }}
            />
            <View
              style={StyleSheet.absoluteFill}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            />
          </View>
        </Animated.View>
      </ReactNativeZoomableView>
      {tapped && renderControls()}
    </View>
  );
};

export default ZoomablePlayer;
