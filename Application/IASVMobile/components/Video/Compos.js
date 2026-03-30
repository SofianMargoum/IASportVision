import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Dimensions,
  ScrollView,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIELD_HEIGHT = 600;

const Compos = ({ players }) => {
  const positions = [
    { top: 460, left: 180 }, // 1

    { top: 360, left: 280 }, // 2
    { top: 360, left: 80 },  // 3
    { top: 390, left: 220 }, // 4
    { top: 390, left: 140 }, // 5

    { top: 300, left: 180 }, // 6
    { top: 180, left: 90 },  // 7
    { top: 250, left: 250 }, // 8

    { top: 140, left: 180 }, // 9
    { top: 250, left: 110 }, // 10
    { top: 180, left: 270 }, // 11
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.wrapper}>
        <ImageBackground
          source={require('../../assets/terrain.jpg')}
          style={styles.field}
          imageStyle={styles.image}
        >
          {players.slice(0, 11).map((player, index) => (
            <View
              key={player.id || `player-${index}`}
              style={[
                styles.playerItem,
                {
                  top: positions[index]?.top ?? 0,
                  left: positions[index]?.left ?? 0,
                },
              ]}
            >
              <Text style={styles.playerText}>{player.name}</Text>
            </View>
          ))}
        </ImageBackground>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  wrapper: {
    alignItems: 'center',
  },
  field: {
    width: SCREEN_WIDTH,
    height: FIELD_HEIGHT,
    position: 'relative',
    backgroundColor: '#0A7F3F',
  },
  image: {
    resizeMode: 'contain',
    opacity: 0.85,
  },
  playerItem: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010E1E',
  },
  playerText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default Compos;
