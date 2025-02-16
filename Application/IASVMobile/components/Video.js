import React from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useVideoContent } from './VideoContent';
import styles from './VideoStyles'; // Import du fichier de style


const Video = () => {
  const {
    user,
    selectedClub,
    selectedClubInfo,
    filename,
    searchResults,
    isRecording,
    timeElapsed,
    message,
    counter,
    secondCounter,
    handleInputChange,
    handleResultClick,
    handleButtonClick,
    clearSelectedClub,
    formatTime,
    incrementCounter,
    decrementCounter,
    incrementSecondCounter,
    decrementSecondCounter,
  } = useVideoContent();

  if (!user) {
    return (
      <View style={styles.notConnectedContainer}>
        <Text style={styles.notConnectedText}>Veuillez vous connecter</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {isRecording ? 'Enregistrement en cours' : 'Commencer un enregistrement'}
        </Text>

        <View style={styles.topSection}>
          {selectedClub ? (
            <View style={styles.selectedClubInfo}>
              <Image source={{ uri: selectedClub.logo }} style={styles.selectedClubLogo} />
              <Text style={styles.selectedClubName}>{selectedClub.name}</Text>
            </View>
          ) : (
            <Text style={styles.placeholderText}>No Club Selected</Text>
          )}
          <View style={styles.counterContainer}>
            <TouchableOpacity onPress={incrementCounter} style={styles.counterButton}>
              <Icon name="plus" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.counterLabel}>{counter}</Text>
            <TouchableOpacity
              onPress={decrementCounter}
              disabled={counter === 0}
              style={styles.counterButton}
            >
              <Icon name="minus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.topSection}>
          <View style={styles.inputContainer}>
            {selectedClubInfo ? (
              <View style={styles.selectedClubInfo}>
                <Image source={{ uri: selectedClubInfo.logo }} style={styles.selectedClubLogo} />
                <Text style={styles.selectedClubName}>{selectedClubInfo.name}</Text>
                <TouchableOpacity onPress={clearSelectedClub} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={filename}
                onChangeText={handleInputChange}
                placeholder="Rechercher un club adverse"
                placeholderTextColor="#ccc"
              />
            )}
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.slice(0, 3).map((result, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleResultClick(result)}
                    style={styles.result}
                  >
                    <Image source={{ uri: result.logo }} style={styles.resultLogo} />
                    <Text style={styles.resultName}>{result.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={styles.counterContainer}>
            <TouchableOpacity onPress={incrementSecondCounter} style={styles.counterButton}>
              <Icon name="plus" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.counterLabel}>{secondCounter}</Text>
            <TouchableOpacity
              onPress={decrementSecondCounter}
              disabled={secondCounter === 0}
              style={styles.counterButton}
            >
              <Icon name="minus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {isRecording && (
          <View style={styles.timer}>
            <Text style={styles.timerText}>Recording Time: {formatTime(timeElapsed)}</Text>
          </View>
        )}

        {message && (
          <View style={styles.message}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleButtonClick}
            disabled={!filename}
            style={[
              styles.outerCircle,
              isRecording
                ? styles.recordingOuter
                : !filename
                ? styles.disabledButton
                : styles.defaultOuter,
            ]}
          >
            <View
              style={[
                styles.innerCircle,
                isRecording ? styles.recordingInner : styles.defaultInner,
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default Video;
