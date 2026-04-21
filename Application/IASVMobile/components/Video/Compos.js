import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ImageBackground,
  Dimensions,
  ScrollView,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIELD_HEIGHT = SCREEN_WIDTH * 1.5;

// Positions en pourcentage du terrain (top%, left%)
const POSITIONS = [
  { top: 77, left: 50 },  // 1 - Gardien

  { top: 60, left: 78 },  // 2 - Latéral droit
  { top: 60, left: 22 },  // 3 - Latéral gauche
  { top: 65, left: 61 },  // 4 - Défenseur central droit
  { top: 65, left: 39 },  // 5 - Défenseur central gauche

  { top: 50, left: 50 },  // 6 - Milieu défensif
  { top: 30, left: 22 },  // 7 - Ailier gauche
  { top: 42, left: 70 },  // 8 - Milieu droit

  { top: 23, left: 50 },  // 9 - Attaquant
  { top: 42, left: 30 },  // 10 - Milieu gauche
  { top: 30, left: 78 },  // 11 - Ailier droit
];

const PLAYER_SIZE = 44;

const Compos = React.memo(({ players }) => {
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
          {players.slice(0, 11).map((player, index) => {
            const pos = POSITIONS[index];
            return (
              <View
                key={player.id || `player-${index}`}
                style={[
                  styles.playerContainer,
                  {
                    top: `${pos.top}%`,
                    left: `${pos.left}%`,
                  },
                ]}
              >
                <Image source={require('../../assets/player.png')} style={styles.playerImage} />
                <View style={styles.playerLabelRow}>
                  <Text style={styles.playerNumber}>{player.number}</Text>
                  <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                </View>
              </View>
            );
          })}
        </ImageBackground>
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  wrapper: {
    alignItems: 'center',
  },
  field: {
    width: SCREEN_WIDTH,
    height: FIELD_HEIGHT,
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
    borderRadius: 8,
  },
  playerContainer: {
    position: 'absolute',
    alignItems: 'center',
    marginLeft: -(PLAYER_SIZE / 2),
    marginTop: -(PLAYER_SIZE / 2),
  },
  playerImage: {
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    resizeMode: 'contain',
  },
  playerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    gap: 8,
  },
  playerNumber: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  playerName: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    maxWidth: 70,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export default Compos;
