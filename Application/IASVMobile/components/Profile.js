import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import LoginForm from './LoginForm';
import UserProfile from './UserProfile';

const scale = 0.85; // Échelle pour ajuster les tailles

const Profile = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '417232013163-of6mf1nmu8tqibvfmm864oq7uhp7ka8g.apps.googleusercontent.com',
    });

    const checkCurrentUser = async () => {
      try {
        const currentUser = await GoogleSignin.getCurrentUser();
        if (currentUser && currentUser.data && currentUser.data.user) {
          setUser(currentUser.data.user);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur actuel:', error);
      }
    };

    checkCurrentUser();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (!userInfo || !userInfo.data || !userInfo.data.user) {
        throw new Error('Impossible de récupérer les informations utilisateur.');
      }
      setUser(userInfo.data.user);
    } catch (error) {
      console.error('Erreur lors de la connexion Google :', error);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await GoogleSignin.signOut();
      setUser(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion :', error);
    }
  };

  return (
    <View style={styles.profilePage}>
        {user ? (
          <UserProfile user={user} onLogout={handleGoogleLogout} />
        ) : (
          <LoginForm handleGoogleLogin={handleGoogleLogin} />
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  profilePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010914',
    height: '100%',
  },
});

export default Profile;
