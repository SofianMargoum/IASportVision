import React from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';

const Effectif = ({ players, setPlayers }) => {
  const handlePlayerChange = (id, value) => {
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        player.id === id ? { ...player, name: value } : player
      )
    );
  };

  return (
    <ScrollView
      style={styles.listContainer}
      showsVerticalScrollIndicator={false} // Cache la barre de défilement (optionnel)
    >
      {players.map((player, index) => (
        <View style={styles.playerRow} key={player.id || `player-${index}`}>
          <Text style={styles.number}>{player.number}</Text>
          <TextInput
            style={styles.input}
            value={player.name}
            onChangeText={(text) => handlePlayerChange(player.id, text)}
          />
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    padding: 10,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginVertical: 5, // Espace entre les items
    width: '100%', // Les items occupent toute la largeur
    backgroundColor: 'transparent',
  },
  number: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 10,
  },
  input: {
    flex: 1,
    textAlign: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#001A31',
    borderRadius: 5,
    color: '#FFFFFF',
    fontSize: 16,
  },
});

export default Effectif;
