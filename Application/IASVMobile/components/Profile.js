import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginForm from './Profile/LoginForm';
import UserProfile from './Profile/UserProfile';
import { UserContext } from './../tools/UserContext';
import { loadToken, clearToken } from './../tools/secureToken';
import { meRequest } from './../tools/authApi';
import { setAuthToken, clearAuthToken } from './../tools/api';

// Sécurité : on ne persiste JAMAIS de tokens dans AsyncStorage.
// Whitelist stricte des champs (cache d'affichage uniquement).
const sanitizeUserForStorage = (user) => {
  if (!user || typeof user !== 'object') return null;
  const {
    id,
    name,
    email,
    photo,
    role,
    givenName,
    familyName,
    nom,
    prenom,
    age,
    poste,
  } = user;
  return { id, name, email, photo, role, givenName, familyName, nom, prenom, age, poste };
};

const Profile = ({ navigation }) => {
  const { user, setUser } = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  // Permet de basculer vers l'écran de connexion depuis UserProfile
  // (bouton "Se connecter" en bas) tout en restant non authentifié.
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // 1) Source de vérité : token JWT stocké dans Keychain.
        const token = await loadToken();
        if (!token) {
          // Pas de token : on s'assure qu'aucun cache utilisateur ne reste.
          await AsyncStorage.removeItem('user');
          clearAuthToken();
          setUser(null);
          return;
        }

        // 2) Vérifier la validité du token côté serveur.
        try {
          await meRequest(token);
        } catch (e) {
          // Token expiré / invalide : nettoyage et retour anonyme.
          if (__DEV__) console.warn('[Profile] token invalide :', e?.status);
          await clearToken();
          await AsyncStorage.removeItem('user');
          clearAuthToken();
          setUser(null);
          return;
        }

        // 3) Token valide : injecter dans api.js + charger le cache d'affichage.
        setAuthToken(token);
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
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
    setShowLogin(false);
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      setUser(null);
      // Supprimer le JWT du Keychain ET le cache utilisateur.
      await clearToken();
      clearAuthToken();
      await clearUserFromStorage();
      setShowLogin(false);
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
      ) : showLogin ? (
        <LoginForm
          onLocalLogin={handleLocalLogin}
          onCancel={() => setShowLogin(false)}
        />
      ) : (
        <UserProfile
          user={null}
          onLogout={handleLogout}
          navigation={navigation}
          onShowLogin={() => setShowLogin(true)}
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
