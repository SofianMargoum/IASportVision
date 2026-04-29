import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  PanResponder,
  ImageBackground,
  TouchableOpacity,
  BackHandler,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useEffectifContext } from './../../tools/EffectifContext';

const scale = 0.85;

const DEFAULT_PLAYERS = [
  { joueur: 'Gardien' },
  { joueur: 'Défenseur 1' },
  { joueur: 'Défenseur 2' },
  { joueur: 'Défenseur 3' },
  { joueur: 'Défenseur 4' },
  { joueur: 'Milieu 1' },
  { joueur: 'Milieu 2' },
  { joueur: 'Milieu 3' },
  { joueur: 'Attaquant 1' },
  { joueur: 'Attaquant 2' },
  { joueur: 'Attaquant 3' },
];

const DEFAULT_POSITIONS = [
  { top: 420, left: 180 },
  { top: 320, left: 280 },
  { top: 320, left: 80 },
  { top: 350, left: 220 },
  { top: 350, left: 140 },
  { top: 280, left: 180 },
  { top: 150, left: 90 },
  { top: 220, left: 250 },
  { top: 120, left: 180 },
  { top: 220, left: 110 },
  { top: 150, left: 270 },
];

const DraggablePlayer = ({ player, position, onPositionChange }) => {
  const startPosRef = useRef(position);
  const callbackRef = useRef(onPositionChange);
  const isDragging = useRef(false);

  // Keep callback ref fresh without re-creating PanResponder
  useEffect(() => {
    callbackRef.current = onPositionChange;
  }, [onPositionChange]);

  // Sync position from parent only when NOT dragging
  useEffect(() => {
    if (!isDragging.current) {
      startPosRef.current = position;
    }
  }, [position]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = true;
      },
      onPanResponderMove: (_, gesture) => {
        callbackRef.current({
          top: startPosRef.current.top + gesture.dy,
          left: startPosRef.current.left + gesture.dx,
        }, false);
      },
      onPanResponderRelease: (_, gesture) => {
        const newPos = {
          top: startPosRef.current.top + gesture.dy,
          left: startPosRef.current.left + gesture.dx,
        };
        startPosRef.current = newPos;
        isDragging.current = false;
        callbackRef.current(newPos, true);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
      },
    })
  ).current;

  const shortName = player.joueur.length > 8
    ? player.joueur.substring(0, 7) + '.'
    : player.joueur;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.playerItem,
        { top: position.top, left: position.left },
      ]}
    >
      <Image source={require('../../assets/player.png')} style={styles.playerImage} />
      <View style={styles.playerLabelRow}>
        {player.numero != null && (
          <Text style={styles.playerNumero}>{player.numero}</Text>
        )}
        <Text style={styles.playerName} numberOfLines={1}>{shortName}</Text>
      </View>
    </View>
  );
};

const Composition = ({ onBack }) => {
  const { effectif } = useEffectifContext();
  const players = effectif.length > 0 ? effectif.slice(0, 11) : DEFAULT_PLAYERS;
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);

  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  useEffect(() => {
    const loadPositions = async () => {
      try {
        const data = await AsyncStorage.getItem('@composition_positions');
        if (data) {
          setPositions(JSON.parse(data));
        }
      } catch (error) {
        if (__DEV__) console.error('Erreur de chargement des positions :', error?.message);
      }
    };
    loadPositions();
  }, []);

  const handlePositionChange = (index, newPos, save) => {
    setPositions((prev) => {
      const updated = [...prev];
      updated[index] = newPos;
      if (save) {
        AsyncStorage.setItem('@composition_positions', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleReset = async () => {
    setPositions(DEFAULT_POSITIONS);
    await AsyncStorage.setItem('@composition_positions', JSON.stringify(DEFAULT_POSITIONS));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-back" size={22} color="#C5D0DC" />
        </TouchableOpacity>
        <Text style={styles.title}>Composition</Text>
        <TouchableOpacity onPress={handleReset} style={styles.resetButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="refresh-outline" size={20} color="#607D8B" />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Maintenez et déplacez les joueurs</Text>

      {/* Terrain */}
      <View style={styles.terrainWrapper}>
        <ImageBackground
          source={require('../../assets/terrain.jpg')}
          style={styles.terrain}
          imageStyle={styles.terrainImage}
        >
          {players.map((player, index) => (
            <DraggablePlayer
              key={index}
              player={player}
              position={positions[index] || { top: 0, left: 0 }}
              onPositionChange={(pos, save) => handlePositionChange(index, pos, save)}
            />
          ))}
        </ImageBackground>
      </View>

      <Text style={styles.playerCount}>
        {players.length} joueur{players.length > 1 ? 's' : ''} sur le terrain
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16 * scale,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18 * scale,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  resetButton: {
    padding: 4,
  },
  hint: {
    textAlign: 'center',
    color: '#455A64',
    fontSize: 12 * scale,
    marginBottom: 12,
  },
  terrainWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  terrain: {
    flex: 1,
    position: 'relative',
  },
  terrainImage: {
    resizeMode: 'cover',
    opacity: 0.7,
  },
  playerItem: {
    position: 'absolute',
    alignItems: 'center',
  },
  playerImage: {
    width: 40 * scale,
    height: 40 * scale,
    resizeMode: 'contain',
  },
  playerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    gap: 6 * scale,
  },
  playerNumero: {
    fontSize: 10 * scale,
    color: '#fff',
    fontWeight: '800',
  },
  playerName: {
    fontSize: 10 * scale,
    color: '#C5D0DC',
    textAlign: 'center',
    fontWeight: '800',
  },
  playerCount: {
    textAlign: 'center',
    color: '#607D8B',
    fontSize: 12 * scale,
    marginTop: 12,
    marginBottom: 4,
  },
});

export default Composition;
