// components/Video/ListeVideo.js
// Conteneur pour afficher les détails d'une vidéo sélectionnée.
// Utilise TabView avec 4 onglets : Match Complet, Composition/Effectif, Stats Équipes, Stats Joueurs.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { TabView } from 'react-native-tab-view';
import MatchComplet from './MatchComplet';
import Effectif from './Effectif';
import Compos from './Compos';
import StatsEquipes from './StatsEquipes';
import StatsJoueurs from './StatsJoueurs';
import Moi from './Moi';
import { useEffectifContext } from './../../tools/EffectifContext';

const scale = 0.85;
const { width } = Dimensions.get('window');

const ROUTES = [
  { key: 'effectif', title: 'EFFECTIF' },
  { key: 'composition', title: 'COMPOSITION' },
  { key: 'statsEquipes', title: 'STATS EQUIPES' },
  { key: 'statsJoueurs', title: 'STATS JOUEURS' },
  { key: 'moi', title: 'MOI' },
];

const ListeVideo = ({ selectedVideo }) => {
  const [index, setIndex] = useState(0);
  const { effectif } = useEffectifContext();

  const players = useMemo(() => {
    if (effectif.length > 0) {
      return effectif.map((player, idx) => ({
        id: player.numero || idx + 1,
        number: player.numero || idx + 1,
        name: player.joueur || `Joueur ${idx + 1}`,
      }));
    }

    return Array.from({ length: 14 }, (_, i) => ({
      id: i + 1,
      number: i + 1,
      name: `Joueur ${i + 1}`,
    }));
  }, [effectif]);

  const renderScene = useCallback(({ route }) => {
    switch (route.key) {
      case 'effectif':
        return <Effectif />;
      case 'composition':
        return <Compos players={players} />;
      case 'statsEquipes':
        return <StatsEquipes />;
      case 'statsJoueurs':
        return <StatsJoueurs />;
      case 'moi':
        return <Moi />;
      default:
        return null;
    }
  }, [players]);

  const tabScrollRef = useRef(null);
  const tabLayouts = useRef({});

  useEffect(() => {
    if (tabScrollRef.current && tabLayouts.current[index] !== undefined) {
      const x = tabLayouts.current[index];
      tabScrollRef.current.scrollTo({ x: Math.max(0, x - width / 3), animated: true });
    }
  }, [index]);

  const renderTabBar = useCallback((props) => (
    <ScrollView
      ref={tabScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.nav}
      style={styles.navScroll}
    >
      {props.navigationState.routes.map((route, i) => {
        const isActive = index === i;
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.button}
            onPress={() => setIndex(i)}
            onLayout={(e) => {
              tabLayouts.current[i] = e.nativeEvent.layout.x;
            }}
          >
            <Text
              style={[
                styles.buttonText,
                isActive && styles.activeButtonText,
              ]}
              numberOfLines={1}
            >
              {route.title}
            </Text>
            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  ), [index]);

  return (
    <View style={styles.resultatContainer}>
      <MatchComplet selectedVideo={selectedVideo} />
      <TabView
        navigationState={{ index, routes: ROUTES }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        swipeEnabled
        initialLayout={{ width: '100%' }}
        renderTabBar={renderTabBar}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  resultatContainer: {
    flex: 1,
  },
  navScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 6,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    flexGrow: 1,
    paddingHorizontal: 4,
  },
  button: {
    paddingVertical: 12 * scale,
    paddingHorizontal: 14 * scale,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  buttonText: {
    color: '#666666',
    fontSize: 13 * scale,
    fontWeight: '700',
  },
  activeButtonText: {
    color: '#FFFFFF',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '80%',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});

export default ListeVideo;
