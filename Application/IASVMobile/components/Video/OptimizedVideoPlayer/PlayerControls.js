// components/PlayerControls.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import Slider from '@react-native-community/slider';
import styles from './styles';

const formatTime = (time) => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const PlayerControls = ({
  paused,
  togglePlayPause,
  currentTime,
  duration,
  videoRef,
  toggleFullScreen,
  exitFullScreen,
  isFullScreen,
}) => {
  return (
    <View style={styles.overlay}>
      {/* 🎛 BOUTON PLAY / PAUSE AU CENTRE */}
      <View style={styles.centerButtonContainer}>
        <TouchableOpacity onPress={togglePlayPause} style={styles.centerPlayButton}>
          <Icon name={paused ? 'play' : 'pause'} size={48} color="white" />
        </TouchableOpacity>
      </View>

      {/* 📍 BOTTOM BAR COLLÉE AU BAS */}
      <View
        style={[
          styles.bottomBar,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 15,
            paddingBottom: 10,
          },
        ]}
      >
        <Text style={styles.timeText}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>

        <Slider
          style={[styles.slider, { flex: 1 }]}
          minimumValue={0}
          maximumValue={duration}
          value={currentTime}
          onSlidingComplete={(value) => videoRef.current.seek(value)}
          minimumTrackTintColor="#FF0000"
          maximumTrackTintColor="#888"
          thumbTintColor="#FF0000"
        />

        <TouchableOpacity
          onPress={isFullScreen ? exitFullScreen : toggleFullScreen}
          style={{ marginHorizontal: 10 }}
        >
          <Icon name={isFullScreen ? 'compress' : 'expand'} size={22} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PlayerControls;
