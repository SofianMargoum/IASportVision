import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import MainComponent from './components/Main';
import { NavigationContainer } from '@react-navigation/native';
import { TabView } from 'react-native-tab-view';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Resultat from './components/Resultat';
import Video from './components/Video'; // celui qui contient ListeVideoSidebar et ListeVideo
import Record from './components/Record';
import Explore from './components/Explore';
import Profile from './components/Profile';
import { UserContext, UserProvider } from './tools/UserContext';
import { ClubProvider, useClubContext } from './tools/ClubContext';
import { EffectifProvider } from './tools/EffectifContext';
import { DeviceProvider } from './tools/DeviceContext';

const scale = 0.85;

const App = () => {
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(Dimensions.get('window').width);
    };
    const subscription = Dimensions.addEventListener('change', handleResize);
    return () => subscription?.remove();
  }, []);

  return (
    <UserProvider>
      <ClubProvider>
        <EffectifProvider>
          <DeviceProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <MainComponent windowWidth={windowWidth} />
            </GestureHandlerRootView>
          </DeviceProvider>
        </EffectifProvider>
      </ClubProvider>
    </UserProvider>
  );
};

export default App;
