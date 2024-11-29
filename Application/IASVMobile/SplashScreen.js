import React from 'react';
import { View, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';

const SplashScreen = () => (
  <View style={styles.container}>
    <FastImage
      source={require('./assets/logo-SplashScreen.gif')}
      style={styles.logoSplashScreen}
      resizeMode={FastImage.resizeMode.contain}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010914',
  },
  logoSplashScreen: {
    width: 300,
    height: 300,
  },
});

export default SplashScreen;
