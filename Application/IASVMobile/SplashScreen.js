import React from 'react';
import { View, StyleSheet, useWindowDimensions, StatusBar } from 'react-native';
import FastImage from 'react-native-fast-image';

const SplashScreen = () => {
  const { width, height } = useWindowDimensions();
  // Logo dimensionné à ~60% de la plus petite dimension de l'écran,
  // borné entre 160 et 360 dp pour rester lisible sur petits téléphones
  // (ex : Xiaomi Redmi 360x640) et propre sur tablettes.
  const logoSize = Math.max(160, Math.min(360, Math.min(width, height) * 0.6));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010914" />
      <FastImage
        source={require('./assets/logo-SplashScreen.gif')}
        style={{ width: logoSize, height: logoSize }}
        resizeMode={FastImage.resizeMode.contain}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010914',
  },
});

export default SplashScreen;
