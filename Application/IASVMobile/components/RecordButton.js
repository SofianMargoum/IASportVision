import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import styles from './VideoStyles';

const RecordButton = ({ isRecording, setIsRecording, setMessage }) => {
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    setMessage(isRecording ? 'Recording stopped' : 'Recording started');
  };

  return (
    <View style={styles.buttonContainer}>
      <TouchableOpacity
        onPress={toggleRecording}
        style={[styles.outerCircle, isRecording ? styles.recordingOuter : styles.defaultOuter]}
      >
        <View style={[styles.innerCircle, isRecording ? styles.recordingInner : styles.defaultInner]} />
      </TouchableOpacity>
    </View>
  );
};

export default RecordButton;
