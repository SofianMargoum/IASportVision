import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Appareil from './Appareils'; // Import du composant Appareil
import Effectif from './Effectif'; // Import du composant Effectif
import Composition from './Composition'; // Import du composant Composition
import Statistiques from './Statistiques'; // Import du composant Statistiques
import BoutiqueScreen from './BoutiqueScreen';
import ProfileScreen from './ProfileScreen';

const scale = 0.85;

const resolveImageSource = (value) => {
  if (!value) return null;
  const uri = String(value).trim();
  if (!uri) return null;

  if (/^(https?:|file:|content:|data:|asset:|res:)/i.test(uri)) {
    return { uri };
  }

  if (uri === 'assets_fcmiramas') {
    return require('../../assets/assets_fcmiramas.jpg');
  }

  return null;
};

const menuItems = [
  { key: 'Effectif', label: 'Effectif', icon: 'people-outline', image: require('../../assets/list.png') },
  { key: 'Composition', label: 'Composition', icon: 'football-outline', image: require('../../assets/stade.png') },
  { key: 'Statistiques', label: 'Statistiques', icon: 'stats-chart-outline', image: require('../../assets/stat.png') },
  { key: 'Appareils', label: 'Appareils', icon: 'videocam-outline', image: require('../../assets/cam.png') },
  { key: 'Boutique', label: 'Boutique', icon: 'cart-outline', image: require('../../assets/boutique.png') },
  { key: 'Profile', label: 'Profil', icon: 'person-outline', image: require('../../assets/player.png') },
];

const UserProfile = ({ user, onLogout }) => {
  const [activeComponent, setActiveComponent] = useState(null);

  const renderActiveComponent = () => {
    switch (activeComponent) {
      case 'Appareils':
        return <Appareil onBack={() => setActiveComponent(null)} />;
      case 'Effectif':
        return <Effectif onBack={() => setActiveComponent(null)} />;
      case 'Composition':
        return <Composition onBack={() => setActiveComponent(null)} />;
      case 'Statistiques':
        return <Statistiques onBack={() => setActiveComponent(null)} />;
      case 'Boutique':
        return <BoutiqueScreen onBack={() => setActiveComponent(null)} />;
      case 'Profile':
        return <ProfileScreen user={user} onBack={() => setActiveComponent(null)} />;
      default:
        return null;
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const userPhotoSource = resolveImageSource(user?.photo);

  return (
    <View style={styles.container}>
      {!activeComponent ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            {userPhotoSource ? (
              <Image source={userPhotoSource} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.profilePlaceholder]}>
                <Text style={styles.initials}>{getInitials(user.name)}</Text>
              </View>
            )}
            <Text style={styles.title}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>

          <View style={styles.buttonsContainer}>
            {[0, 1, 2].map((rowIndex) => (
              <View style={styles.buttonRow} key={rowIndex}>
                {menuItems.slice(rowIndex * 2, rowIndex * 2 + 2).map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.squareButton}
                    onPress={() => setActiveComponent(item.key)}
                    activeOpacity={0.7}
                  >
                    <Image source={item.image} style={styles.iconImage} />
                    <Text style={styles.buttonLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.7}>
            <Icon name="log-out-outline" size={18} color="#888" style={styles.logoutIcon} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        renderActiveComponent()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 24,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  profileImage: {
    width: 64 * scale,
    height: 64 * scale,
    borderRadius: 32 * scale,
    borderWidth: 2,
    borderColor: '#1A2D45',
  },
  profilePlaceholder: {
    backgroundColor: '#010E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontSize: 22 * scale,
    fontWeight: '700',
  },
  title: {
    fontSize: 17 * scale,
    fontWeight: '700',
    color: '#fff',
    marginTop: 10,
  },
  email: {
    fontSize: 13 * scale,
    color: '#607D8B',
    marginTop: 4,
    marginBottom: 16,
  },
  buttonsContainer: {
    width: '100%',
    paddingHorizontal: 16 * scale,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10 * scale,
  },
  squareButton: {
    width: '48%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
  },
  iconImage: {
    width: 60 * scale,
    height: 60 * scale,
    marginBottom: 8,
  },
  buttonLabel: {
    color: '#C5D0DC',
    fontSize: 14 * scale,
    fontWeight: '600',
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 14 * scale,
    paddingHorizontal: 32,
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    width: '92%',
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#C5D0DC',
    fontSize: 15 * scale,
    fontWeight: '600',
  },
});

export default UserProfile;
