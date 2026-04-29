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
    pendingUploads,
    removePending,
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

  // --- Progress bar animation ---
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

  // --- Pulsing red dot animation for recording timer ---
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  // --- Device status ---
  const [deviceStatus, setDeviceStatus] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const checkDeviceStatus = async (device) => {
    if (!device?.cameraId) {
      setDeviceStatus('Non connecté ❌');
      return;
    }
    setIsChecking(true);
    setDeviceStatus('Vérification...');
    try {
      const res = await fetchAllCameras();
      const payload = res?.data ?? res;
      const cams =
        payload?.data?.camera ??
        payload?.data?.cameras ??
        payload?.camera ??
        payload?.cameras ??
        [];
      const cam = Array.isArray(cams) ? cams.find((c) => c?.id === device.cameraId) : null;
      if (!cam) {
        setDeviceStatus('Inconnu');
        return;
      }
      setDeviceStatus(cam?.online === '1' ? 'Connecté' : 'Non connecté');
    } catch {
      setDeviceStatus('Erreur réseau');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (selectedDevice) {
      checkDeviceStatus(selectedDevice);
    } else {
      setDeviceStatus('');
      setIsChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice?.cameraId]);

  // --- Not connected ---
  if (!user) {
    return (
      <View style={styles.notConnectedContainer}>
        <Image
          source={require('../assets/connexionR.png')}
          style={{ width: '100%', resizeMode: 'contain' }}
        />
      </View>
    );
  }

  const isConnected = deviceStatus.startsWith('Connecté');
  const isDisconnected = deviceStatus.startsWith('Non connecté');
  // Button requires a club name + a selected device; we do NOT gate on
  // isConnected so the user can always attempt to start and get a clear
  // error if the camera is truly offline (hikStartRecording will fail).
  const canStartRecording = !!filename && !!selectedDevice;
  const buttonDisabled = isRecording ? false : !canStartRecording;

  // Pick the right color style for device name
  const deviceNameColorStyle = isChecking
    ? styles.deviceNameChecking
    : isConnected
    ? styles.deviceNameConnected
    : isDisconnected
    ? styles.deviceNameDisconnected
    : styles.deviceNameDefault;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {isRecording ? 'Enregistrement en cours' : 'Commencer un enregistrement'}
        </Text>

        {/* === Device status bar === */}
        <View style={styles.deviceStatusRow}>
          {selectedDevice && (
            <TouchableOpacity
              onPress={() => checkDeviceStatus(selectedDevice)}
              disabled={isChecking}
              style={[
                styles.deviceRefreshButton,
                isChecking && styles.deviceRefreshDisabled,
              ]}
            >
              <Icon name="refresh" size={12} color="#fff" />
            </TouchableOpacity>
          )}
          <Text style={[styles.deviceNameText, deviceNameColorStyle]}>
            {selectedDevice?.nom || 'Aucun appareil'}
          </Text>
          {selectedDevice && (
            <View style={styles.deviceStatusIcon}>
              {isChecking ? (
                <ActivityIndicator size="small" color="#f1c40f" />
              ) : isConnected ? (
                <Icon name="wifi" size={12} color={SUCCESS_GREEN} />
              ) : isDisconnected ? (
                <Icon name="wifi" size={12} color="#ff6b6b" />
              ) : (
                <Icon name="question-circle" size={12} color="#bbb" />
              )}
            </View>
          )}
        </View>

        {/* === Score section: Club [score] - [score] Adversaire === */}
        <View style={styles.scoreContainer}>
          {/* Home team */}
          <View style={styles.scoreTeamBlock}>
            {selectedClub ? (
              <>
                <Image source={{ uri: selectedClub.logo }} style={styles.scoreTeamLogo} />
                <Text style={styles.scoreTeamName} numberOfLines={2}>
                  {selectedClub.name}
                </Text>
              </>
            ) : (
              <Text style={styles.placeholderText}>Aucun club</Text>
            )}
          </View>

          {/* Score center */}
          <View style={styles.scoreCenterBlock}>
            <View style={styles.scoreRow}>
              {/* Home counter */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity onPress={incrementCounter} style={styles.scoreCounterButton}>
                  <Icon name="caret-up" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.scoreText}>{counter}</Text>
                <TouchableOpacity
                  onPress={decrementCounter}
                  disabled={counter === 0}
                  style={styles.scoreCounterButton}
                >
                  <Icon name="caret-down" size={22} color={counter === 0 ? '#333' : '#fff'} />
                </TouchableOpacity>
              </View>

              <Text style={styles.scoreDash}>-</Text>

              {/* Away counter */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity onPress={incrementSecondCounter} style={styles.scoreCounterButton}>
                  <Icon name="caret-up" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.scoreText}>{secondCounter}</Text>
                <TouchableOpacity
                  onPress={decrementSecondCounter}
                  disabled={secondCounter === 0}
                  style={styles.scoreCounterButton}
                >
                  <Icon name="caret-down" size={22} color={secondCounter === 0 ? '#333' : '#fff'} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Away team */}
          <View style={styles.scoreTeamBlock}>
            {selectedClubInfo ? (
              <>
                <Image source={{ uri: selectedClubInfo.logo }} style={styles.scoreTeamLogo} />
                <Text style={styles.scoreTeamName} numberOfLines={2}>
                  {selectedClubInfo.name}
                </Text>
                <TouchableOpacity onPress={clearSelectedClub} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TextInput
                style={styles.input}
                value={filename}
                onChangeText={handleInputChange}
                placeholder="Club adverse"
                placeholderTextColor="#666"
              />
            )}
          </View>
        </View>

        {/* Search results dropdown */}
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

        {/* === Timer (recording) === */}
        {isRecording && (
          <View style={styles.timer}>
            <Text style={styles.timerText}>{formatTime(timeElapsed)}</Text>
            <Animated.View style={[styles.timerRecordingDot, { opacity: pulseAnim }]} />
          </View>
        )}

        {/* === Message === */}
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

        {/* === Progress bar === */}
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
                style={[styles.progressBarFill, { width: progressAnimPx }]}
              />
            </View>
            <View style={styles.progressMessages}>
              <Text style={styles.progressMessageText}>
                {(progressLines && progressLines[progressLines.length - 1]) || ''}
              </Text>
            </View>
          </View>
        )}

        {/* === Pending uploads queue === */}
        {Array.isArray(pendingUploads) && pendingUploads.length > 0 && (
          <View style={styles.pendingListWrapper}>
            <Text style={styles.pendingListTitle}>
              Téléchargements en attente ({pendingUploads.length})
            </Text>
            {pendingUploads.map((item) => {
              const pct = Math.round(
                Math.max(0, Math.min(1, Number(item.progress) || 0)) * 100
              );
              const isDone = item.status === 'done';
              const isError = item.status === 'error';
              const isQueued =
                item.status === 'queued' || item.backendStatus === 'queued';
              return (
                <View key={item.id} style={styles.pendingItem}>
                  <View style={styles.pendingItemHeader}>
                    <Text
                      style={[
                        styles.pendingItemLabel,
                        isError && styles.pendingItemLabelError,
                        isDone && styles.pendingItemLabelDone,
                      ]}
                      numberOfLines={1}
                    >
                      {item.label || item.rollingId || item.id}
                    </Text>
                    {(isDone || isError) && (
                      <TouchableOpacity
                        onPress={() => removePending && removePending(item.id)}
                        style={styles.pendingItemCloseBtn}
                      >
                        <Text style={styles.pendingItemCloseTxt}>×</Text>
                      </TouchableOpacity>
                    )}
                    {!isDone && !isError && (
                      <TouchableOpacity
                        onLongPress={() =>
                          removePending && removePending(item.id)
                        }
                        delayLongPress={800}
                        style={styles.pendingItemCloseBtn}
                      >
                        <Text style={styles.pendingItemCloseTxt}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.pendingItemBarBg}>
                    <View
                      style={[
                        styles.pendingItemBarFill,
                        isError && styles.pendingItemBarFillError,
                        isDone && styles.pendingItemBarFillDone,
                        { width: `${pct}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.pendingItemStatus} numberOfLines={1}>
                    {isQueued
                      ? `En file d’attente${
                          item.queuedBehind
                            ? ` (après ${String(item.queuedBehind).slice(0, 6)}…)`
                            : ''
                        }`
                      : isDone
                      ? 'Terminé'
                      : isError
                      ? `Erreur${item.error ? ` — ${item.error}` : ''}`
                      : `${item.statusText || 'En cours'} — ${pct}%`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* === Record button === */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleButtonClick}
            disabled={buttonDisabled}
            style={[
              styles.outerCircle,
              isRecording
                ? styles.recordingOuter
                : !canStartRecording
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

          {!isRecording && !isConnected && selectedDevice ? (
            <Text style={styles.hintText}>
              Caméra hors ligne — enregistrement désactivé
            </Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
};

export default Record;
