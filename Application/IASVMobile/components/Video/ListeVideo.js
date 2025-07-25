import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import MatchComplet from './MatchComplet';
import MatchResume from './MatchResume';
import StatsEquipes from './StatsEquipes';
import StatsJoueurs from './StatsJoueurs';

const scale = 0.85;

const ListeVideo = ({ selectedVideo }) => {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'video', title: 'MATCH COMPLET' },
    { key: 'resume', title: 'COMPOS EFFECTIF' },
    { key: 'statsEquipes', title: 'STATS EQUIPES' },
    { key: 'statsJoueurs', title: 'STATS JOUEURS' },
  ]);

  const renderScene = SceneMap({
    video: () => <MatchComplet selectedVideo={selectedVideo} />,
    resume: () => <MatchResume selectedVideo={selectedVideo} />,
    statsEquipes: () => <StatsEquipes />,
    statsJoueurs: () => <StatsJoueurs />,
  });

  return (
    <View style={styles.resultatContainer}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        swipeEnabled={index !== 0}
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
    paddingVertical: 12 * scale,
    paddingHorizontal: 16 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    color: '#00A0E9',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14 * scale,
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
