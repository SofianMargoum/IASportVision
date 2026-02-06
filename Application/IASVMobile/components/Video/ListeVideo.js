// components/Video/ListeVideo.js
// Conteneur pour afficher les détails d'une vidéo sélectionnée.
// Utilise TabView avec 4 onglets : Match Complet, Composition/Effectif, Stats Équipes, Stats Joueurs.
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TabView } from 'react-native-tab-view';
import MatchComplet from './MatchComplet';
import Effectif from './Effectif';
import Compos from './Compos';
import StatsEquipes from './StatsEquipes';
import StatsJoueurs from './StatsJoueurs';

const scale = 0.85;

const ListeVideo = ({ selectedVideo }) => {
  const [index, setIndex] = useState(0);
  const [players, setPlayers] = useState(
    Array.from({ length: 14 }, (_, i) => ({
      id: i + 1,
      number: i + 1,
      name: `Joueur ${i + 1}`,
    }))
  );
  const [routes] = useState([
    { key: 'effectif', title: 'EFFECTIF' },
    { key: 'composition', title: 'COMPOSITION' },
    { key: 'statsEquipes', title: 'STATS EQUIPES' },
    { key: 'statsJoueurs', title: 'STATS JOUEURS' },
  ]);

  const renderScene = useCallback(({ route }) => {
    switch (route.key) {
      case 'effectif':
        return <Effectif players={players} setPlayers={setPlayers} />;
      case 'composition':
        return <Compos players={players} />;
      case 'statsEquipes':
        return <StatsEquipes />;
      case 'statsJoueurs':
        return <StatsJoueurs />;
      default:
        return null;
    }
  }, [players]);

  return (
    <View style={styles.resultatContainer}>
      <MatchComplet selectedVideo={selectedVideo} />
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        swipeEnabled
        initialLayout={{ width: '100%' }}
        renderTabBar={(props) => (
          <View style={styles.nav}>
            {props.navigationState.routes.map((route, i) => (
              <TouchableOpacity
                key={route.key}
                style={[styles.button, index === i && styles.activeButton]}
                onPress={() => setIndex(i)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    index === i && styles.activeButtonText,
                  ]}
                >
                  {route.title}
                </Text>
                {index === i && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  resultatContainer: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30 * scale,
    borderBottomWidth: 2 * scale,
    borderBottomColor: '#00A0E9',
  },
  button: {
    flex: 1,
    paddingVertical: 8 * scale,
    paddingHorizontal: 10 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    color: '#00A0E9',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 11 * scale,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  activeButtonText: {
    color: '#00A0E9',
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2 * scale,
    width: '100%',
    height: 3 * scale,
    backgroundColor: '#00A0E9',
  },
});

export default ListeVideo;
