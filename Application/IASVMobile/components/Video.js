import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { searchClubs, startRecording, stopRecording, getPlaybackURI, uploadVideo } from './api';
import { useClubContext } from './ClubContext'; // Importer le hook personnalisé

import { UserContext } from './UserContext'; // Importer le UserContext
const { width } = Dimensions.get('window');

const scale = 0.85; // Ajustez cette valeur selon vos besoins
const Video = () => {
  const { selectedClub, setSelectedClub } = useClubContext(); // Utilisation du contexte
  const { user, setUser } = useContext(UserContext); // Utilisation du contexte utilisateur
  const [isRecording, setIsRecording] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [playbackURI, setPlaybackURI] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [filename, setFilename] = useState('');
  const [message, setMessage] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [timeoutId, setTimeoutId] = useState(null);
  const [selectedClubInfo, setSelectedClubInfo] = useState(null);
  const [counter, setCounter] = useState(0);
  const [secondCounter, setSecondCounter] = useState(0);

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setTimeElapsed((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }

    return () => clearInterval(timer);
  }, [isRecording]);

  const handleInputChange = (text) => {
    setFilename(text);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(async () => {
      const results = await searchClubs(text);
      setSearchResults(results);
    }, 1000);

    setTimeoutId(newTimeoutId);
  };

  const handleResultClick = (result) => {
    setFilename(result.name);
    setSelectedClubInfo(result);
    setSearchResults([]);
  };

  const handleButtonClick = async () => {
    if (isRecording) {
      setFilename('');
      setSelectedClubInfo(null);

      try {
        setIsRecording(false);
        await stopRecording();

        const playbackData = await getPlaybackURI();
        const { playbackURI, videoDuration } = playbackData;
        setPlaybackURI(playbackURI);
        setVideoDuration(videoDuration);

        const directory = selectedClub ? selectedClub.name : 'Unknown Club';
        const combinedFilename = selectedClubInfo
          ? `${counter} - ${secondCounter} ${selectedClubInfo.name}`
          : `${counter} - ${secondCounter} Unknown Club`;

        await uploadVideo(combinedFilename, playbackURI, directory, videoDuration);

        setMessage('Recording stopped and video uploaded successfully');
      } catch (error) {
        console.error('Error:', error);
        setMessage('Failed to stop recording or upload video');
      }
    } else {
      try {
        await startRecording();
        setIsRecording(true);
        setTimeElapsed(0);
        setMessage('Recording started successfully');
      } catch (error) {
        console.error('Error:', error);
        setMessage('Failed to start recording');
      }
    }
  };
  const clearSelectedClub = () => {
    setSelectedClubInfo(null);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const incrementCounter = () => {
    setCounter((prevCounter) => prevCounter + 1);
  };

  const decrementCounter = () => {
    setCounter((prevCounter) => Math.max(prevCounter - 1, 0));
  };

  const incrementSecondCounter = () => {
    setSecondCounter((prevCounter) => prevCounter + 1);
  };

  const decrementSecondCounter = () => {
    setSecondCounter((prevCounter) => Math.max(prevCounter - 1, 0));
  };
  if (!user) {
    // Afficher un message si l'utilisateur n'est pas connecté
    return (
      <View style={styles.notConnectedContainer}>
        <Text style={styles.notConnectedText}>Veuillez vous connecter</Text>
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {isRecording ? 'Enregistrement en cours' : 'Commencer un enregistrement'}
        </Text>

        {/* Top Section: Display selected club info and counter */}
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
            <TouchableOpacity onPress={decrementCounter} disabled={counter === 0} style={styles.counterButton}>
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
                  <TouchableOpacity key={index} onPress={() => handleResultClick(result)} style={styles.result}>
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
            <TouchableOpacity onPress={decrementSecondCounter} disabled={secondCounter === 0} style={styles.counterButton}>
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
            disabled={!filename} // Désactive le bouton si filename est vide
            style={[
              styles.outerCircle,
              isRecording
                ? styles.recordingOuter
                : !filename
                  ? styles.disabledButton // Style pour le bouton désactivé
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

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, // Allows ScrollView to grow if content is small
    padding: 10,
    backgroundColor: '#010914',
    alignItems: 'center',
  },
  notConnectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notConnectedText: {
    fontSize: 18,
    color: 'red',
  },
  content: {
    flex: 1,
    backgroundColor: '#010914',
    alignItems: 'center',
  },
  title: {
    fontSize: 24 * scale, // Taille ajustée ici
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  clearButton: {
    marginLeft: 10,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#ccc',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    width: '100%', // Make width responsive
    backgroundColor: '#010E1E',
    borderRadius: 15,
  },
  disabledButton: {
    backgroundColor: '#ccc', // Couleur désactivée
    opacity: 0.3, // Rendre visuellement désactivé
  },
  selectedClubInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
  },
  selectedClubLogo: {
    width: 30 * scale, // Taille ajustée ici
    height: 30 * scale, // Taille ajustée ici
    marginRight: 10,
    borderRadius: 5,
  },
  selectedClubName: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#ccc',
    fontSize: 15 * scale, // Taille ajustée ici
  },
  counterContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
  },
  counterButton: {
    padding: 5,
  },
  counterLabel: {
    fontSize: 20 * scale, // Taille ajustée ici
    fontWeight: 'bold',
    color: '#ffffff',
    marginHorizontal: 10,
  },
  inputContainer: {
    marginTop: 20,
  },
  input: {
    color: '#ccc',
    padding: 10,
    fontSize: 16 * scale, // Taille ajustée ici
    borderRadius: 5,
  },
  searchResults: {
    maxHeight: 150,
    borderRadius: 8,
    padding: 10,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
  },
  resultLogo: {
    width: 30 * scale, // Taille ajustée ici
    height: 30 * scale, // Taille ajustée ici
    marginRight: 10,
    borderRadius: 5,
  },
  resultName: {
    color: '#ffffff',
    fontSize: 16 * scale, // Taille ajustée ici
  },
  timer: {
    marginTop: 20,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 18 * scale, // Taille ajustée ici
    color: '#ffffff',
  },
  message: {
    marginTop: 20,
    alignItems: 'center',
  },
  messageText: {
    color: '#ff4d4d',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1, // Permet de prendre tout l'espace vertical disponible
  },

  outerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: 'black',
    backgroundColor: 'white',
  },
  defaultOuter: {
    borderColor: 'black',
  },
  recordingOuter: {
    borderColor: 'red',
  },
  innerCircle: {
    width: 40,
    height: 40,
    borderRadius: 25,
  },
  defaultInner: {
    backgroundColor: 'red',
  },
  recordingInner: {
    backgroundColor: 'black',
  },
});

export default Video;
