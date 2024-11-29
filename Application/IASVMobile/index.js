// index.js
import React, { useEffect, useState } from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import SplashScreen from './SplashScreen'; // Import du composant SplashScreen
import { name as appName } from './app.json';

const Main = () => {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    // Masquer le SplashScreen après 2 secondes
    const timer = setTimeout(() => setIsSplashVisible(false), 2500);
    return () => clearTimeout(timer); // Nettoyage du timer
  }, []);

  return isSplashVisible ? <SplashScreen /> : <App />;
};

AppRegistry.registerComponent(appName, () => Main);
