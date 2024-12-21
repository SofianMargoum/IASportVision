import React, { useEffect, useState } from 'react';
import { View, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { useClubContext } from './ClubContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from './Header';
import BottomTabNavigator from './BottomTabNavigator';
import Video from './Video';
import Resultat from './Resultat';
import Home from './Home';
import Explore from './Explore';
import Profile from './Profile';

const Main = ({ windowWidth }) => {
  const { setSelectedClub, setClNo, setCompetition } = useClubContext();
  const [index, setIndex] = useState(2); // Onglet par défaut
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
        console.error('Erreur lors du chargement des données sauvegardées', error);
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
    setShowHeader(index !== routes.findIndex(route => route.key === 'profile'));
  }, [index, routes]);

  return (
    <NavigationContainer>
      <View style={{ flex: 1 }}>
        {showHeader && <Header windowWidth={windowWidth} />}
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: Dimensions.get('window').width }}
          renderTabBar={() => null}
          swipeEnabled={false}
        />
        <BottomTabNavigator index={index} setIndex={setIndex} />
      </View>
    </NavigationContainer>
  );
};

export default Main;
