import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Appareil from './Appareils'; // Import du composant Appareil
import Effectif from './Effectif'; // Import du composant Effectif
import Composition from './Composition'; // Import du composant Composition
import Statistiques from './Statistiques'; // Import du composant Statistiques
import BoutiqueScreen from './BoutiqueScreen';
import ProfileScreen from './ProfileScreen';
import AdminUsersScreen from './AdminUsersScreen';
import { moderateScale, scale as s } from './../../tools/responsive';
import { useUserRole } from './../../tools/UserRoleContext';
import { getVisibleScreens } from './../../tools/permissions';

const ms = moderateScale;

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
  { key: 'Admin', label: 'Utilisateurs', icon: 'shield-checkmark-outline', image: require('../../assets/player.png') },
];

const UserProfile = ({ user, onLogout, onShowLogin }) => {
  const [activeComponent, setActiveComponent] = useState(null);
  const { role: selectedProfile, clearRole } = useUserRole();

  const isAuthenticated = !!user;
  // Le rôle réel de l'utilisateur connecté prime sur le profil sélectionné au Welcome.
  const effectiveRole = (user && user.role) || selectedProfile;

  // Liste des clés d'écrans visibles pour ce rôle / état d'auth.
  const visibleScreens = useMemo(
    () => getVisibleScreens(effectiveRole, isAuthenticated),
    [effectiveRole, isAuthenticated],
  );

  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => visibleScreens.includes(item.key)),
    [visibleScreens],
  );

  // Le Supporter voit l'effectif en lecture seule (pas d'ajout / suppression).
  const isSupporter = effectiveRole === 'supporter';

  const renderActiveComponent = () => {
    switch (activeComponent) {
      case 'Appareils':
        return <Appareil onBack={() => setActiveComponent(null)} />;
      case 'Effectif':
        return <Effectif onBack={() => setActiveComponent(null)} readOnly={isSupporter} />;
      case 'Composition':
        return <Composition onBack={() => setActiveComponent(null)} />;
      case 'Statistiques':
        return <Statistiques onBack={() => setActiveComponent(null)} />;
      case 'Boutique':
        return <BoutiqueScreen onBack={() => setActiveComponent(null)} />;
      case 'Profile':
        return <ProfileScreen user={user} onBack={() => setActiveComponent(null)} />;
      case 'Admin':
        return <AdminUsersScreen user={user} onBack={() => setActiveComponent(null)} />;
      default:
        return null;
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const userPhotoSource = resolveImageSource(user?.photo);

  // Re-construit dynamiquement les rangées (2 colonnes) à partir des items
  // visibles seulement.
  const rows = [];
  for (let i = 0; i < visibleMenuItems.length; i += 2) {
    rows.push(visibleMenuItems.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      {!activeComponent ? (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              {isAuthenticated ? (
                <>
                  {userPhotoSource ? (
                    <Image source={userPhotoSource} style={styles.profileImage} />
                  ) : (
                    <View style={[styles.profileImage, styles.profilePlaceholder]}>
                      <Text style={styles.initials}>{getInitials(user.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.title}>{user.name}</Text>
                  <Text style={styles.email}>{user.email}</Text>
                </>
              ) : (
                <Text style={[styles.email, styles.visitorLabel]}>Mode visiteur</Text>
              )}
            </View>

            <View style={styles.buttonsContainer}>
              {rows.map((row, rowIndex) => (
                <View style={styles.buttonRow} key={rowIndex}>
                  {row.map((item) => (
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
                  {/* Cellule vide pour préserver l'alignement si nb impair */}
                  {row.length === 1 && <View style={[styles.squareButton, styles.emptyCell]} />}
                </View>
              ))}
            </View>

            {isAuthenticated && (
              <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.7}>
                <Icon name="log-out-outline" size={18} color="#888" style={styles.logoutIcon} />
                <Text style={styles.logoutText}>Se déconnecter</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {!isAuthenticated && (
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={[styles.logoutButton, styles.loginButton]}
                onPress={onShowLogin}
                activeOpacity={0.7}
              >
                <Icon name="log-in-outline" size={18} color="#7FB6FF" style={styles.logoutIcon} />
                <Text style={[styles.logoutText, styles.loginText]}>Se connecter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutButton, styles.changeProfileButton]}
                onPress={clearRole}
                activeOpacity={0.7}
              >
                <Icon name="swap-horizontal-outline" size={18} color="#9FB1C7" style={styles.logoutIcon} />
                <Text style={[styles.logoutText, styles.changeProfileText]}>Changer de profil</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
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
    paddingBottom: s(24),
  },
  header: {
    width: '100%',
    alignItems: 'center',
    paddingTop: s(24),
    paddingBottom: s(8),
  },
  profileImage: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
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
    fontSize: ms(22),
    fontWeight: '700',
  },
  title: {
    fontSize: ms(17),
    fontWeight: '700',
    color: '#fff',
    marginTop: s(10),
  },
  email: {
    fontSize: ms(13),
    color: '#607D8B',
    marginTop: s(4),
    marginBottom: s(16),
  },
  buttonsContainer: {
    width: '100%',
    paddingHorizontal: s(16),
    marginTop: s(8),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(10),
  },
  squareButton: {
    width: '48%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#010E1E',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#1A2D45',
  },
  iconImage: {
    width: ms(60),
    height: ms(60),
    marginBottom: s(8),
  },
  buttonLabel: {
    color: '#C5D0DC',
    fontSize: ms(14),
    fontWeight: '600',
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(20),
    paddingVertical: s(14),
    paddingHorizontal: s(32),
    backgroundColor: '#010E1E',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#1A2D45',
    width: '92%',
  },
  logoutIcon: {
    marginRight: s(8),
  },
  logoutText: {
    color: '#C5D0DC',
    fontSize: ms(15),
    fontWeight: '600',
  },
  loginButton: {
    borderColor: 'rgba(127, 182, 255, 0.4)',
    backgroundColor: 'rgba(47, 140, 255, 0.08)',
  },
  loginText: {
    color: '#7FB6FF',
  },
  emptyCell: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  changeProfileButton: {
    borderColor: 'rgba(159, 177, 199, 0.2)',
    backgroundColor: 'transparent',
    marginTop: s(10),
  },
  changeProfileText: {
    color: '#9FB1C7',
  },
  visitorLabel: {
    fontStyle: 'italic',
    marginBottom: s(8),
  },
  bottomActions: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: s(16),
    paddingBottom: s(24),
    gap: s(10),
  },
});

export default UserProfile;
