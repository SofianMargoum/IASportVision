import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Effectif from './Effectif';
import Compos from './Compos';

const MatchTabs = () => {
  const [activeTab, setActiveTab] = useState('EFFECTIF');
  const [players, setPlayers] = useState(
    Array.from({ length: 14 }, (_, i) => ({
      id: i + 1,
      number: i + 1,
      name: `Joueur ${i + 1}`,
    }))
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'EFFECTIF':
        return <Effectif players={players} setPlayers={setPlayers} />;
      case 'COMPOS':
        return <Compos players={players} />;
      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'EFFECTIF' && styles.activeTab]}
            onPress={() => setActiveTab('EFFECTIF')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'EFFECTIF' ? styles.activeTabText : styles.inactiveTabText,
              ]}
            >
              EFFECTIF
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'COMPOS' && styles.activeTab]}
            onPress={() => setActiveTab('COMPOS')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'COMPOS' ? styles.activeTabText : styles.inactiveTabText,
              ]}
            >
              COMPOSITION
            </Text>
          </TouchableOpacity>
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
  content: {
    flex: 1,
  },
});

export default MatchTabs;
