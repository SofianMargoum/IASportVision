import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useVideoContent } from './Record/VideoContent';
import styles, { SUCCESS_GREEN } from './Record/VideoStyles';

// ✅ adapte ce chemin selon ton projet (là j’assume que Record.js est à côté de tools/)
import { fetchAllCameras } from '../tools/api';

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
    progressVisible,
    progressValue,
    progressLines,
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
    selectedDevice,
  } = useVideoContent();

  // Animation pour rendre la progression visible (même si ça "saute")
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const progressAnimPx = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!progressVisible) {
      progressAnimPx.setValue(0);
      return;
    }

    const w = Number(progressBarWidth) || 0;
    const target = w * Math.max(0, Math.min(1, progressValue ?? 0));
    Animated.timing(progressAnimPx, {
      toValue: target,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [progressVisible, progressValue, progressBarWidth, progressAnimPx]);

  // ---- États locaux ----
  const [deviceStatus, setDeviceStatus] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // ---- Vérification: Hik-Connect (online) ----
  const checkDeviceStatus = async (device) => {
    if (!device?.cameraId) {
      setDeviceStatus('Non connecté ❌');
      return;
    }

    setIsChecking(true);
    setDeviceStatus('Vérification...');

    try {
      const res = await fetchAllCameras();

      // axios => res.data, sinon on accepte payload direct
      const payload = res?.data ?? res;

      // Ton exemple: { data: { camera: [...] }, errorCode: "0" }
      const cams =
        payload?.data?.camera ??
        payload?.data?.cameras ??
        payload?.camera ??
        payload?.cameras ??
        [];

      const cam = Array.isArray(cams) ? cams.find((c) => c?.id === device.cameraId) : null;

      if (!cam) {
        setDeviceStatus('Inconnu ❔');
        return;
      }

      const isOnline = cam?.online === '1';
      setDeviceStatus(isOnline ? 'Connecté' : 'Non connecté ❌');
    } catch (e) {
      setDeviceStatus('Erreur réseau ⚠️');
    } finally {
      setIsChecking(false);
    }
  };

  // Vérifie à chaque changement de device
  useEffect(() => {
    if (selectedDevice) {
      checkDeviceStatus(selectedDevice);
    } else {
      setDeviceStatus('');
      setIsChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice?.cameraId]); // on suit surtout la caméra

  if (!user) {
    return (
      <View style={styles.notConnectedContainer}>
        <Image
          source={require('../assets/connexionR.png')}
          style={{
            width: '100%',
            resizeMode: 'contain',
          }}
        />
      </View>
    );
  }

  // Optionnel: empêcher de démarrer un enregistrement si caméra offline/inconnue
  const canRecord = !!filename && deviceStatus.startsWith('Connecté');

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
                padding: 2,
                borderRadius: 6,
                opacity: !selectedDevice || isChecking ? 0.7 : 1,
              }}
            >
              <Icon name="refresh" size={12} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Texte Appareil sélectionné (couleur selon état) */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              marginVertical: 10,
              marginRight: 8,
              color: isChecking
                ? '#f1c40f'
                : deviceStatus.startsWith('Connecté')
                ? SUCCESS_GREEN
                : deviceStatus.startsWith('Non connecté')
                ? '#ff6b6b'
                : 'white',
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
                <Icon name="wifi" size={12} color={SUCCESS_GREEN} />
              ) : deviceStatus.startsWith('Non connecté') ? (
                <Icon name="wifi" size={12} color="#ff6b6b" />
              ) : (
                <Icon name="question-circle" size={12} color="#bbb" />
              )}
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
            <Text style={styles.timerText}>
              {formatTime(timeElapsed)}
            </Text>
          </View>
        )}

        {message && !progressVisible ? (
          <View style={styles.message}>
            <Text
              style={
                /succès|reussi|réussi|enregistrement\s+en\s+cours/i.test(String(message))
                  ? styles.messageTextSuccess
                  : styles.messageText
              }
            >
              {message}
            </Text>
          </View>
        ) : null}

        {progressVisible && (
          <View style={styles.progressWrapper}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressPercentText}>
                {Math.round((progressValue ?? 0) * 100)}%
              </Text>
            </View>
            <View
              style={styles.progressBarBg}
              onLayout={(e) => {
                const w = e?.nativeEvent?.layout?.width;
                if (typeof w === 'number' && w > 0) setProgressBarWidth(w);
              }}
            >
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnimPx,
                  },
                ]}
              />
            </View>
            <View style={styles.progressMessages}>
              <Text style={styles.progressMessageText}>
                {(progressLines && progressLines[progressLines.length - 1]) || ''}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleButtonClick}
            disabled={!canRecord}
            style={[
              styles.outerCircle,
              isRecording
                ? styles.recordingOuter
                : !canRecord
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

          {/* petit hint si disabled */}
          {!isRecording && !deviceStatus.startsWith('Connecté') && selectedDevice ? (
            <Text style={{ color: '#bbb', marginTop: 10, textAlign: 'center' }}>
              Caméra hors ligne ou inconnue — enregistrement désactivé
            </Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
};

export default Record;
