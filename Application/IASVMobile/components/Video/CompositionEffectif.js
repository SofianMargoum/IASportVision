// components/Video/CompositionEffectif.js
// Affiche la composition et l'effectif pour un match.
// Utilise des onglets internes : EFFECTIF (liste éditable) et COMPOS (terrain avec positions).

import React, { useMemo, useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Effectif from './Effectif';
import Compos from './Compos';
import { useEffectifContext } from './../../tools/EffectifContext';

const TABS = [
  { key: 'EFFECTIF', label: 'EFFECTIF' },
  { key: 'COMPOS', label: 'COMPOSITION' },
];

const MatchTabs = () => {
  const [activeTab, setActiveTab] = useState('EFFECTIF');
  const { effectif } = useEffectifContext();

  const players = useMemo(() => {
    if (effectif.length > 0) {
      return effectif.map((player, index) => ({
        id: player.numero || index + 1,
        number: player.numero || index + 1,
        name: player.joueur || `Joueur ${index + 1}`,
      }));
    }

    return Array.from({ length: 14 }, (_, i) => ({
      id: i + 1,
      number: i + 1,
      name: `Joueur ${i + 1}`,
    }));
  }, [effectif]);

  const renderContent = useCallback(() => {
    switch (activeTab) {
      case 'EFFECTIF':
        return <Effectif />;
      case 'COMPOS':
        return <Compos players={players} />;
      default:
        return null;
    }
  }, [activeTab, players]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.activeTab]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[
                    styles.tabText,
                    isActive ? styles.activeTabText : styles.inactiveTabText,
                  ]}
                >
                  {tab.label}
                </Text>
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.content}>{renderContent()}</View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
    paddingVertical: 10,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  inactiveTabText: {
    color: '#808080',
  },
  activeIndicator: {
    marginTop: 4,
    width: '100%',
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  content: {
    flex: 1,
  },
});

export default MatchTabs;
