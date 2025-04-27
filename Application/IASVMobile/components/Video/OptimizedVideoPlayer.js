import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import Video from 'react-native-video';
import Orientation from 'react-native-orientation-locker';
import Icon from 'react-native-vector-icons/FontAwesome';
import Slider from '@react-native-community/slider';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OptimizedVideoPlayer = ({ videoUri }) => {
  const [paused, setPaused] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(1);
  const videoRef = useRef(null);

  const togglePlayPause = () => {
    setPaused(!paused);
  };

  const toggleFullScreen = async () => {
    const newState = !isFullScreen;
    await AsyncStorage.setItem('is_full_screen', JSON.stringify(newState));
    setIsFullScreen(newState);
  };

  useEffect(() => {
    const restoreFullScreenState = async () => {
      const savedState = await AsyncStorage.getItem('is_full_screen');
      if (savedState !== null) {
        setIsFullScreen(JSON.parse(savedState));
      }
    };
    restoreFullScreenState();
  }, []);

  useEffect(() => {
    const setSystemBars = () => {
      if (isFullScreen) {
        Orientation.lockToLandscape();
        StatusBar.setHidden(true, 'none');
        setTimeout(() => {
          if (Platform.OS === 'android') {
            if (Platform.Version >= 19) {
              SystemNavigationBar.immersive();
            } else {
              // Gestion spécifique pour les versions antérieures d'Android
              // ... (si nécessaire)
            }
          }
        }, 500);
      } else {
        Orientation.lockToPortrait();
        StatusBar.setHidden(false, 'none');
        setTimeout(() => {
          if (Platform.OS === 'android') {
            SystemNavigationBar.navigationShow();
          }
        }, 500);
      }
    };
    setSystemBars();
    return () => {
      if (!isFullScreen) {
        setTimeout(() => {
          if (Platform.OS === 'android') {
            SystemNavigationBar.navigationShow();
          }
        }, 500);
      }
    };
  }, [isFullScreen]);

  const onSlideComplete = (value) => {
    videoRef.current.seek(value);
    setCurrentTime(value);
  };

  return (
    <>
      {!isFullScreen && (
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode="cover"
            paused={paused}
            controls={false}
            onProgress={(data) => setCurrentTime(data.currentTime)}
            onLoad={(data) => setDuration(data.duration)}
          />
          <View style={styles.controls}>
            <TouchableOpacity onPress={togglePlayPause} style={styles.button}>
              <Icon name={paused ? 'play' : 'pause'} size={20} color="white" />
            </TouchableOpacity>
            <View style={styles.progressContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={duration}
                value={currentTime}
                minimumTrackTintColor="white"
                maximumTrackTintColor="#555"
                thumbTintColor="white"
                onSlidingComplete={onSlideComplete}
              />
            </View>
            <TouchableOpacity onPress={toggleFullScreen} style={styles.button}>
              <Icon name="expand" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isFullScreen && (
        <Modal
          visible={isFullScreen}
          supportedOrientations={['landscape']}
          animationType="fade"
        >
          <View style={styles.fullScreenContainer}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.fullScreenVideo}
              resizeMode="cover"
              paused={paused}
              controls={false}
              onProgress={(data) => setCurrentTime(data.currentTime)}
              onLoad={(data) => setDuration(data.duration)}
            />
            <View style={styles.controls}>
              <TouchableOpacity onPress={togglePlayPause} style={styles.button}>
                <Icon name={paused ? 'play' : 'pause'} size={20} color="white" />
              </TouchableOpacity>
              <View style={styles.progressContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={duration}
                  value={currentTime}
                  minimumTrackTintColor="white"
                  maximumTrackTintColor="#555"
                  thumbTintColor="white"
                  onSlidingComplete={onSlideComplete}
                />
              </View>
              <TouchableOpacity onPress={toggleFullScreen} style={styles.button}>
                <Icon name="compress" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};


const styles = StyleSheet.create({
  videoContainer: {
    width: Dimensions.get('window').width,
    height: (Dimensions.get('window').width * 9) / 16,
    backgroundColor: '#000',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  button: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  slider: {
    width: '100%',
    height: 20,
  },
});

export default OptimizedVideoPlayer;
