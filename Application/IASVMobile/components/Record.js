import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useVideoContent } from './Record/VideoContent';
import styles from './Record/VideoStyles';
import TcpSocket from 'react-native-tcp-socket'; // ✅ TCP only

// ---------- Helper TCP (une seule fois, hors composant) ----------
const tcpProbe = (host, port, ms = 4000) =>
  new Promise((resolve) => {
    const socket = TcpSocket.createConnection({ host, port, timeout: ms }, () => {
      socket.destroy();
      resolve(true); // connexion TCP OK
    });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
// -----------------------------------------------------------------

const Record = () => {
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
    params,
    selectedDevice,
  } = useVideoContent();

  // ---- États locaux ----
  const [deviceStatus, setDeviceStatus] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // ---- Vérification: TCP uniquement ----
  const checkDeviceStatus = async (device) => {
    if (!device?.domaine || !device?.port) {
      setDeviceStatus('Non connecté ❌');
      return;
    }
    setIsChecking(true);
    setDeviceStatus('Vérification...');

    try {
      const ok = await tcpProbe(device.domaine, device.port, 400); // timeout 4s
      if (ok) {
        setDeviceStatus('Connecté (TCP) ✅');
      } else {
        setDeviceStatus('Non connecté ❌');
      }
    } finally {
      setIsChecking(false);
    }
  };

  // Vérifie à chaque changement de device
  useEffect(() => {
    if (selectedDevice) {
      setDeviceStatus('Vérification...');
      setIsChecking(true);
      checkDeviceStatus(selectedDevice);
    } else {
      setDeviceStatus('');
      setIsChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice]);

if (!user) {
  return (
    <View style={styles.notConnectedContainer}>
      <Image
        source={require('../assets/connexionR.png')}
        style={{
          width: '100%',         // pleine largeur
          resizeMode: 'contain', // garde le ratio
        }}
      />
    </View>
  );
}





  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {isRecording ? 'Enregistrement en cours' : 'Commencer un enregistrement'}
        </Text>

        {/* Ligne: [🔄]  Appareil sélectionné : <nom>  [wifi/spinner] */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          {/* Bouton Rafraîchir à gauche */}
          {selectedDevice && (
            <TouchableOpacity
              onPress={() => selectedDevice && checkDeviceStatus(selectedDevice)}
              disabled={!selectedDevice || isChecking}
              style={{
                marginRight: 8,
                flexDirection: 'row',
                alignItems: 'center',
                padding: 6,
                backgroundColor: isChecking ? '#3a3a3a' : '#2A2A2A',
                borderRadius: 6,
                opacity: !selectedDevice || isChecking ? 0.7 : 1,
              }}
            >
              <Icon name="refresh" size={14} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Texte Appareil sélectionné (couleur selon état) */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              marginVertical: 10,
              marginRight: 8,
              color: isChecking
                ? '#f1c40f' // jaune si vérification
                : deviceStatus.startsWith('Connecté')
                ? 'lightgreen' // vert si connecté
                : deviceStatus.startsWith('Non connecté')
                ? '#ff6b6b' // rouge si non connecté
                : 'white', // blanc par défaut
            }}
          >
          {selectedDevice?.nom || 'aucun'}
          </Text>

          {/* Icône état WiFi à droite */}
          {selectedDevice && (
            <View style={{ marginLeft: 4 }}>
              {isChecking ? (
                <ActivityIndicator size="small" color="#f1c40f" />
              ) : deviceStatus.startsWith('Connecté') ? (
                <Icon name="wifi" size={18} color="lightgreen" />
              ) : deviceStatus.startsWith('Non connecté') ? (
                <Icon name="wifi" size={18} color="#ff6b6b" />
              ) : null}
            </View>
          )}
        </View>

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

export default Record;
