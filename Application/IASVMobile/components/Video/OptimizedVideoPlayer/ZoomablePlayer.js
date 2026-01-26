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
  windowWidth,
  windowHeight,
  currentTime,
  setZoomMapExport,
  tapped,
  renderControls,
  balloonActive, // 👈 ajouté
}) => {
  return (
    <View style={[containerStyle, { backgroundColor: 'black' }]}>
      <ReactNativeZoomableView
        ref={zoomableViewRef}
        maxZoom={3}
        minZoom={1}
        initialZoom={3}
        zoomEnabled={!balloonActive}  // ⚪ OFF => zoomEnabled = true, 🔵 ON => false
        style={{ flex: 1 }}
        onTransform={(event) => {
          if (!event) return;
          const { offsetX, offsetY, zoomLevel } = event;
          
          const time = currentTimeRef.current;
          const percentX = (Math.round(offsetX)/Math.round(windowWidth)*3-1)*-50;
          const percentY = (Math.round(offsetY)/Math.round(windowHeight)*3-1)*-50;

          setZoomMapExport(prev => {
            if (prev[time]) return prev;
            return {
              ...prev,
              [time]: {
                scale: parseFloat(zoomLevel.toFixed(2)),
                x: parseFloat(percentX.toFixed(2)),
                y: parseFloat(percentY.toFixed(2)),
              },
            };
          });
        }}
      >
        <Animated.View style={styles.content}>
          <View style={[styles.videoWrapper, containerStyle]}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={videoStyle}
              resizeMode="contain"
              paused={paused}
              repeat
              onProgress={(data) => {
                setCurrentTime(data.currentTime);
                currentTimeRef.current = Math.floor(data.currentTime);
              }}
              onLoad={(data) => setDuration(data.duration)}
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
