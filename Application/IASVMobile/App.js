import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabView, SceneMap } from 'react-native-tab-view';
import Icon from 'react-native-vector-icons/FontAwesome';
import Home from './components/Home';
import Resultat from './components/Resultat';
import Video from './components/Video';
import Explore from './components/Explore';
import Profile from './components/Profile';
import { ClubProvider, useClubContext } from './components/ClubContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
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
    <ClubProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Main windowWidth={windowWidth} />
      </GestureHandlerRootView>
    </ClubProvider>
  );
};

const Main = ({ windowWidth }) => {
  const { setSelectedClub, setClNo, setCompetition } = useClubContext();
  const [index, setIndex] = useState(2); // Définit "Video" comme onglet par défaut
  const [showHeader, setShowHeader] = useState(true);
  const [routes] = useState([
    { key: 'video', title: 'Video' },
    { key: 'resultat', title: 'Resultat' },
    { key: 'home', title: 'Home' },
    { key: 'explore', title: 'Explore' },
    { key: 'profile', title: 'Profile' },
  ]);

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const savedSelectedClub = await AsyncStorage.getItem('selectedClub');
        const savedSelectedCompetition = await AsyncStorage.getItem('selectedCompetition');

        if (savedSelectedClub) {
          const club = JSON.parse(savedSelectedClub);
          setSelectedClub(club);
          setClNo(club.cl_no);
        }
        if (savedSelectedCompetition) {
          setCompetition(savedSelectedCompetition);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données sauvegardées", error);
      }
    };

    loadStoredData();
  }, [setSelectedClub, setClNo, setCompetition]);

  const renderScene = SceneMap({
    video: Video,
    resultat: Resultat,
    home: Home,
    explore: Explore,
    profile: Profile,
  });

  useEffect(() => {
    // Masquer le Header uniquement si l'index actif est celui de Profile
    setShowHeader(index !== routes.findIndex(route => route.key === 'profile'));
  }, [index, routes]);

  return (
    <NavigationContainer>
      <View style={styles.appContainer}>
        {/* Affiche le Header en fonction de l'état showHeader */}
        {showHeader && <Header windowWidth={windowWidth} />}
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: Dimensions.get('window').width }}
          renderTabBar={() => null} // Cache la barre de tab par défaut
          swipeEnabled={false} // Désactive le défilement horizontal
        />
        <BottomTabNavigator index={index} setIndex={setIndex} />
      </View>
    </NavigationContainer>
  );
};

const BottomTabNavigator = ({ index, setIndex }) => (
  <View style={styles.tabBarStyle}>
    {[
      { name: 'Video', icon: 'video-camera' },
      { name: 'Resultat', icon: 'trophy' },
      { name: 'Home', icon: 'home' },
      { name: 'Explore', icon: 'search' },
      { name: 'Profile', icon: 'user' },
    ].map((route, i) => (
      <TabIcon
        key={route.name}
        icon={route.icon}
        focused={index === i}
        onPress={() => setIndex(i)}
      />
    ))}
  </View>
);

const Header = ({ windowWidth }) => {
  const { selectedClub, competition } = useClubContext();

  return (
    <View style={styles.header}>
      <View style={styles.logoMain}>
        {windowWidth >= 1000 && (
          <Image source={require('./assets/logo.png')} style={styles.logo} />
        )}
      </View>
      {selectedClub && (
        <View style={styles.selectedClubLabel}>
          <Image source={{ uri: selectedClub.logo }} style={styles.clubLogo} />
          <View style={styles.selectedClubText}>
            <Text style={styles.clubName}>{selectedClub.name}</Text>
            {competition && (
              <Text style={styles.competitionLabel}>{competition}</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const TabIcon = ({ icon, focused, onPress }) => (
  <TouchableOpacity
    style={[styles.iconContainer, focused && styles.iconActive]}
    onPress={onPress}
  >
    <Icon
      name={icon}
      size={focused ? 30 * scale : 25 * scale}
      color={focused ? '#00A0E9' : '#ffffff'}
    />
  </TouchableOpacity>
);

const scale = 0.85;

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#010914',
  },
  header: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 5,
    shadowColor: '#00A0E9',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 6,
    elevation: 3,
    backgroundColor: '#010914',
  },
  logoMain: {
    position: 'absolute',
    left: 0,
    opacity: 0.2,
  },
  logo: {
    width: 2500 * scale,
    height: 50 * scale,
    resizeMode: 'contain',
  },
  selectedClubLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15 * scale,
  },
  clubLogo: {
    width: 50 * scale,
    height: 50 * scale,
    borderRadius: 25 * scale,
    marginRight: 15 * scale,
  },
  selectedClubText: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  clubName: {
    fontSize: 18 * scale,
    fontWeight: 'bold',
    color: '#fff',
  },
  competitionLabel: {
    fontSize: 14 * scale,
    fontStyle: 'italic',
    color: '#ffffff',
  },
  tabBarStyle: {
    backgroundColor: '#010E1E',
    borderTopWidth: 0,
    height: 60 * scale,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%', // Pour que le bouton prenne toute la largeur
    height: '100%', // Pour que le bouton prenne toute la hauteur
  },
});

export default App;
