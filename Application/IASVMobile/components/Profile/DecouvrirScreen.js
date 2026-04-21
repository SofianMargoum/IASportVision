import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DiscoverTab from '../Video/DiscoverTab';

const DecouvrirScreen = ({ onBack }) => {
  useEffect(() => {
    const backAction = () => {
      onBack?.();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Découvrir</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <DiscoverTab />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010914',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 84,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#001A31',
    backgroundColor: '#010914',
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});

export default DecouvrirScreen;
