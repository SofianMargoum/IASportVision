import React, { useEffect, useRef, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { useClubContext } from './../tools/ClubContext';
import { useUserRole } from './../tools/UserRoleContext';
import { moderateScale } from './../tools/responsive';
import { VideoOverlayProvider } from '../tools/VideoOverlayContext';
import { ActiveTabProvider } from '../tools/ActiveTabContext';
import Record from './Record';
import Resultat from './Resultat';
import Video from './Video';
import Explore from './Explore';
import Profile from './Profile';
import Welcome from './Welcome';
import Header from './Header';
import BottomTabNavigator from './BottomTabNavigator';
import VideoOverlayHost from './Video/VideoOverlayHost';

const Main = ({ windowWidth, windowHeight }) => {
  const { selectedClub, isLoading } = useClubContext();
  const { role, isLoading: roleLoading } = useUserRole();
  // Largeur live de la fenêtre — fallback sur la prop venant de App.js si fournie.
  const dims = useWindowDimensions();
  const tabLayoutWidth = windowWidth || dims.width;

  const rootRef = useRef(null);

  const [index, setIndex] = useState(2); // Onglet par défaut
  const [showHeader, setShowHeader] = useState(true);

  const [routes] = useState([
    { key: 'record', title: 'Record' },
    { key: 'resultat', title: 'Resultat' },
    { key: 'video', title: 'Officiel' },
    { key: 'explore', title: 'Explore' },
    { key: 'profile', title: 'Profile' },
  ]);

  // IMPORTANT: All hooks MUST be called unconditionally, before any early returns
  useEffect(() => {
    setShowHeader(index !== routes.findIndex((route) => route.key === 'profile'));
  }, [index, routes]);



  const renderScene = SceneMap({
    record: Record,
    resultat: Resultat,
    video: Video,
    explore: Explore,
    profile: Profile,
  });

  // Now we can safely do conditional returns
  if (isLoading || roleLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#010914', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: moderateScale(18) }}>Chargement...</Text>
      </View>
    );
  }

  // Onboarding : pas de rôle OU pas de club sélectionné.
  // Welcome gère les 2 étapes (choix profil puis choix club).
  const isOnboarding = !role || !selectedClub;

  if (isOnboarding) {
    return <Welcome />;
  }


  return (
    <NavigationContainer>
      <VideoOverlayProvider rootRef={rootRef}>
        <ActiveTabProvider activeKey={routes[index]?.key}>
          <View ref={rootRef} style={{ flex: 1, backgroundColor: '#010914' }}>
            {showHeader && <Header windowWidth={windowWidth} />}
            <TabView
              navigationState={{ index, routes }}
              renderScene={renderScene}
              onIndexChange={setIndex}
              initialLayout={{ width: tabLayoutWidth }}
              renderTabBar={() => null}
              swipeEnabled={false}
            />
            <BottomTabNavigator index={index} setIndex={setIndex} />

            {/* Overlay global pour le player (style YouTube), sans remount */}
            <VideoOverlayHost />
          </View>
        </ActiveTabProvider>
      </VideoOverlayProvider>
    </NavigationContainer>
  );
};

export default Main;
