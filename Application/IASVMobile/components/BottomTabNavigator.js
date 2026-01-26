import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const scale = 0.85;

const BottomTabNavigator = ({ index, setIndex }) => {
  const tabs = [
    { name: 'Record', icon: 'video-camera' },
    { name: 'Resultat', icon: 'trophy' },
    { name: 'Video', icon: 'home' },
    { name: 'Explore', icon: 'search' },
    { name: 'Profile', icon: 'user' },
  ];

  return (
    <View style={styles.tabBarStyle}>
      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={tab.name}
          style={[styles.iconContainer, index === i && styles.iconActive]}
          onPress={() => setIndex(i)}
        >
          <Icon name={tab.icon} size={25 * scale} color={index === i ? '#00A0E9' : '#ffffff'} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
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
    width: '100%',
    height: '100%',
  },
  iconActive: {},
});

export default BottomTabNavigator;
