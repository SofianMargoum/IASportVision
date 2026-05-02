import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { moderateScale, verticalScale } from './../tools/responsive';
import { useUserRole } from './../tools/UserRoleContext';

const BottomTabNavigator = ({ index, setIndex }) => {
  // insets.bottom : hauteur de la barre de gestes Android (Pixel 6+, Samsung
  // One UI, MIUI...) — évite que les icônes passent sous la barre système.
  const insets = useSafeAreaInsets();
  const { canViewPage } = useUserRole();

  // L'ordre et les clés DOIVENT correspondre aux `routes` du TabView dans Main.js
  // car `index` fait référence à la position dans la liste d'origine.
  const allTabs = [
    { name: 'Record', icon: 'video-camera', pageKey: 'record' },
    { name: 'Resultat', icon: 'trophy', pageKey: 'resultat' },
    { name: 'Officiel', icon: 'home', pageKey: 'video' },
    { name: 'Explore', icon: 'search', pageKey: 'explore' },
    { name: 'Profile', icon: 'user', pageKey: 'profile' },
  ];

  // Garde-fou : hauteur jamais < 48dp (cible tactile Material) ni > 72dp.
  const barHeight = Math.max(48, Math.min(72, verticalScale(60)));

  return (
    <View
      style={[
        styles.tabBarStyle,
        {
          height: barHeight + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {allTabs.map((tab, i) => {
        if (!canViewPage(tab.pageKey)) return null;
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.iconContainer, index === i && styles.iconActive]}
            onPress={() => setIndex(i)}
          >
            <Icon
              name={tab.icon}
              size={moderateScale(22)}
              color={index === i ? '#ffffff' : '#666666'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarStyle: {
    backgroundColor: '#010E1E',
    borderTopWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  iconActive: {},
});

export default BottomTabNavigator;
