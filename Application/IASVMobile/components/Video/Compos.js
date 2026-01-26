import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder, ImageBackground } from 'react-native';

const Compos = ({ players }) => {
  const [positions, setPositions] = useState([
    // Gardien
    { top: 420, left: 180 },//1

    // Défenseurs (ligne de 4)
    { top: 320, left: 280 },//2
    { top: 320, left: 80 },//3
    { top: 350, left: 220 },//4
    { top: 350, left: 140 },//5

    // Milieux (ligne de 3)
    { top: 280, left: 180 },//6
    { top: 150, left: 90 },//7
    { top: 220, left: 250 },//8

    // Attaquants (ligne de 3)
    { top: 120, left: 180 },//9
    { top: 220, left: 110 },//10
    { top: 150, left: 270 },//11

    // Remplaçants (en haut à gauche)
    { top: 510, left: 0 },
    { top: 510, left: 60 },
    { top: 510, left: 120 },
  ]);

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
    })
  );

  return (
    <ImageBackground
      source={require('../../assets/terrain.jpg')}
      style={styles.container}
      imageStyle={styles.imageBackground}
    >
      {players.map((player, index) => (
        <View
          key={player.id || `compos-${index}`}
          {...panResponders[index].panHandlers}
          style={[
            styles.playerItem,
            {
              top: positions[index]?.top || 0, // Utiliser la position si elle existe
              left: positions[index]?.left || 0, // Utiliser la position si elle existe
            },
          ]}
        >
          <Text style={styles.playerText}>{player.name}</Text>
        </View>
      ))}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    marginBottom: 100,
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
});

export default Compos;
