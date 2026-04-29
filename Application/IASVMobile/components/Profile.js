import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginForm from './Profile/LoginForm';
import UserProfile from './Profile/UserProfile';
import { UserContext } from './../tools/UserContext';

// Sécurité : on ne persiste JAMAIS de tokens. Whitelist stricte des champs.
const sanitizeUserForStorage = (user) => {
  if (!user || typeof user !== 'object') return null;
  const {
    id,
    name,
    email,
    photo,
    givenName,
    familyName,
    nom,
    prenom,
    age,
    poste,
  } = user;
  return { id, name, email, photo, givenName, familyName, nom, prenom, age, poste };
};

const Profile = ({ navigation }) => {
  const { user, setUser } = useContext(UserContext);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            // On re-sanitize au chargement, au cas où un ancien build aurait
            // pu persister des tokens.
            setUser(sanitizeUserForStorage(parsed));
          } catch {
            await AsyncStorage.removeItem('user');
          }
        }
      } catch (error) {
        if (__DEV__) console.error('Erreur init utilisateur:', error?.message);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  const saveUserToStorage = async (u) => {
    try {
      const safe = sanitizeUserForStorage(u);
      if (!safe) return;
      await AsyncStorage.setItem('user', JSON.stringify(safe));
    } catch (error) {
      if (__DEV__) console.error('Erreur sauvegarde utilisateur:', error?.message);
    }
  };

  const clearUserFromStorage = async () => {
    try {
      await AsyncStorage.removeItem('user');
    } catch (error) {
      if (__DEV__) console.error('Erreur suppression utilisateur:', error?.message);
    }
  };

  const handleLocalLogin = async (userData) => {
    if (!userData || typeof userData !== 'object' || (!userData.id && !userData.email)) {
      if (__DEV__) console.warn('handleLocalLogin: données utilisateur invalides');
      return;
    }
    setUser(userData);
    await saveUserToStorage(userData);
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      setUser(null);
      await clearUserFromStorage();
    } catch (error) {
      if (__DEV__) console.error('Erreur déconnexion:', error?.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.profilePage}>
      {user ? (
        <UserProfile
          user={user}
          onLogout={handleLogout}
          navigation={navigation}
        />
      ) : (
        <LoginForm onLocalLogin={handleLocalLogin} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  profilePage: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Profile;
