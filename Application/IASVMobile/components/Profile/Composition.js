import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  ImageBackground,
  TouchableOpacity, BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffectifContext } from './../../tools/EffectifContext';

const Composition = ({ onBack }) => {
  const { effectif } = useEffectifContext();

  // Si l'effectif est vide → composition par défaut
  const players = effectif.length > 0
    ? effectif
    : [
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

  const [positions, setPositions] = useState([
    { top: 420, left: 180 }, // Gardien
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
  ]);
  useEffect(() => {
    const backAction = () => {
      onBack(); // même effet que ton bouton "← Retour"
      return true; // empêche la fermeture automatique de l'app
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove(); // nettoyage
  }, [onBack]);
  const handleDeletePlayer = (index) => {
    Alert.alert('Confirmation', 'Voulez-vous vraiment supprimer ce joueur ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removePlayer(index) },
    ]);
  };
  // Charger les positions sauvegardées au démarrage
  useEffect(() => {
    const loadPositions = async () => {
      try {
        const data = await AsyncStorage.getItem('@composition_positions');
        if (data) {
          setPositions(JSON.parse(data));
        }
      } catch (error) {
        console.error('Erreur de chargement des positions :', error);
      }
    };
    loadPositions();
  }, []);

  // Gestion du déplacement des joueurs + sauvegarde
  const panResponders = positions.map((position, index) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        const newPositions = [...positions];
        newPositions[index] = {
          top: position.top + gestureState.dy,
          left: position.left + gestureState.dx,
        };
        setPositions(newPositions);
      },
      onPanResponderRelease: async (e, gestureState) => {
        try {
          const newPositions = [...positions];
          newPositions[index] = {
            top: position.top + gestureState.dy,
            left: position.left + gestureState.dx,
          };
          await AsyncStorage.setItem(
            '@composition_positions',
            JSON.stringify(newPositions)
          );
          setPositions(newPositions);
        } catch (error) {
          console.error('Erreur de sauvegarde des positions :', error);
        }
      },
    })
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Composition</Text>

      <ImageBackground
        source={require('../../assets/terrain.jpg')}
        style={styles.container}
        imageStyle={styles.imageBackground}
      >
        {players.map((player, index) => (
          <View
            key={index}
            {...panResponders[index]?.panHandlers}
            style={[
              styles.playerItem,
              {
                top: positions[index]?.top || 0,
                left: positions[index]?.left || 0,
              },
            ]}
          >
            <Text style={styles.playerText}>
              {player.numero ? `${player.numero}\n${player.joueur}` : player.joueur}
            </Text>
          </View>
        ))}
      </ImageBackground>

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Retour</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 40,
    marginBottom: 10,
  },
  container: {
    flex: 1,
    position: 'relative',
    width: '100%',
    marginBottom: 60,
  },
  imageBackground: {
    resizeMode: 'contain',
    opacity: 0.8,
  },
  playerItem: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: '#010E1E',
  },
  playerText: {
    fontSize: 10,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
backButton: {
  width: '80%', // un peu moins large pour être plus élégant
  alignSelf: 'center', // ✅ centre horizontalement
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 10,
},
backButtonText: {
  padding: 15,
  borderWidth: 1,
  borderColor: '#001A31',
  borderRadius: 10,
  shadowColor: '#00A0E9',
  shadowOpacity: 1,
  elevation: 3,
  backgroundColor: '#010914',
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
  textAlign: 'center',
  width: '100%',
},
});

export default Composition;
