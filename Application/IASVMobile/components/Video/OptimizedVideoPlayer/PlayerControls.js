// components/PlayerControls.js
import React from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
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
  isFullScreen,
  isUploadMode,
  setIsUploadMode,
}) => {
  return (
    <View style={styles.overlay}>
      <View style={styles.centerButtonContainer}>
        <TouchableOpacity onPress={togglePlayPause} style={styles.centerPlayButton}>
          <Icon name={paused ? 'play' : 'pause'} size={48} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.timeText}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration}
          value={currentTime}
          onSlidingComplete={(value) => videoRef.current.seek(value)}
          minimumTrackTintColor="#FF0000"
          maximumTrackTintColor="#888"
          thumbTintColor="#FF0000"
        />
        <TouchableOpacity onPress={toggleFullScreen} style={styles.fullScreenButton}>
          <Icon name={isFullScreen ? 'compress' : 'expand'} size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Upload</Text>
          <Switch
            value={isUploadMode}
            onValueChange={setIsUploadMode}
          />
        </View>
      </View>
    </View>
  );
};

export default PlayerControls;
