// StatsContent.js
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const StatsContent = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue sur IASV Mobile!</Text>
      <Text style={styles.description}>
        Explorez les dernières actualités, résultats et vidéos de votre club préféré.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#010E1E',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  image: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default StatsContent;
