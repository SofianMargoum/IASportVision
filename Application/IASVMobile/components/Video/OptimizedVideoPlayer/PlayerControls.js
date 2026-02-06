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
  balloonActive,
  setBalloonActive,
}) => {

  const handleBalloonPress = () => {
    setBalloonActive(prev => !prev);
  };

  return (
    <View style={styles.overlay}>

      {/* 📍 TOP BAR — Upload en haut à droite (plein écran uniquement) */}
      {isFullScreen && (
        <View style={{
          position: 'absolute',
          top: 10,
          right: 10,
          flexDirection: 'row',
          alignItems: 'center',
          zIndex: 20,
        }}>
          <Text style={[styles.switchLabel, { marginRight: 8 }]}>Upload</Text>
          <Switch value={isUploadMode} onValueChange={setIsUploadMode} />
        </View>
      )}

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
            bottom: 0,        // 👈 collé parfaitement en bas
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

        <TouchableOpacity onPress={toggleFullScreen} style={{ marginHorizontal: 10 }}>
          <Icon name={isFullScreen ? 'compress' : 'expand'} size={22} color="white" />
        </TouchableOpacity>

        {/* ⚽ BALLON TOUT À DROITE (plein écran uniquement) */}
        {isFullScreen && (
          <TouchableOpacity onPress={handleBalloonPress}>
            <Icon
              name="soccer-ball-o"
              size={20}
              color={balloonActive ? '#010E1E' : 'white'}
            />
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
};

export default PlayerControls;
