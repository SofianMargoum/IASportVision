// SplashScreen.js
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const SplashScreen = () => (
  <View style={styles.container}>
    <Image source={require('./assets/logo.png')} style={styles.logoSplashScreen} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010914', // Fond de l'écran splash
  },
  logoSplashScreen: {
    width: 200,
    height: 200,
    resizeMode: 'contain', // Ajustez les dimensions si nécessaire
  },
});

export default SplashScreen;
