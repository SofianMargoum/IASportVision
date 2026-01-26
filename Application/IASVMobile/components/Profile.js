import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import LoginForm from './Profile/LoginForm';
import UserProfile from './Profile/UserProfile';
import { UserContext } from './../tools/UserContext'; // Importez le contexte

const Profile = ({ navigation }) => { // Ajoutez navigation comme prop
  const { user, setUser } = useContext(UserContext); // Accédez au contexte utilisateur
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '417232013163-of6mf1nmu8tqibvfmm864oq7uhp7ka8g.apps.googleusercontent.com',
    });

    const initializeUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          const userInfo = await GoogleSignin.getCurrentUser();
          if (userInfo && userInfo.user) {
            setUser(userInfo.user);
            await saveUserToStorage(userInfo.user);
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'utilisateur :', error);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  const saveUserToStorage = async (user) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des informations utilisateur :', error);
    }
  };

  const clearUserFromStorage = async () => {
    try {
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Erreur lors de la suppression des informations utilisateur :', error);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const userFromCurrent = await GoogleSignin.getCurrentUser();
      const finalUser = userInfo?.user || userFromCurrent?.user;

      if (finalUser) {
        setUser(finalUser);
        await saveUserToStorage(finalUser);
      } else {
        console.error('Connexion échouée, utilisateur introuvable.');
      }
    } catch (error) {
      console.error('Erreur lors de la connexion Google :', error);
    } finally {
      setLoading(false);
    }
  };
// Profile.js
const handleLocalLogin = async (userData) => {
  setUser(userData);                // on met l'objet tel quel
  await saveUserToStorage(userData);
};


  const handleGoogleLogout = async () => {
    try {
      setLoading(true);
      await GoogleSignin.signOut();
      setUser(null);
      await clearUserFromStorage();
    } catch (error) {
      console.error('Erreur lors de la déconnexion :', error);
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
          onLogout={handleGoogleLogout}
          navigation={navigation} // Transmettez navigation à UserProfile
        />
      ) : (<LoginForm
            onLocalLogin={handleLocalLogin}
            handleGoogleLogin={handleGoogleLogin}
          />
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
