import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginForm from './Profile/LoginForm';
import UserProfile from './Profile/UserProfile';
import { UserContext } from './../tools/UserContext';
import { loadAuthTokens } from './../tools/secureToken';
import { AUTH_BASE } from './../tools/authApi';
import {
  clearAuthSession,
  logoutCurrentSession,
  registerAuthFailureHandler,
  secureFetch,
  setAuthSession,
} from './../tools/api';

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
    clubId,
    photoAsset,
    givenName,
    familyName,
    nom,
    prenom,
    age,
    poste,
  } = user;
  return { id, name, email, photo, role, clubId, photoAsset, givenName, familyName, nom, prenom, age, poste };
};

const Profile = ({ navigation }) => {
  const { user, setUser } = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  // Permet de basculer vers l'écran de connexion depuis UserProfile
  // (bouton "Se connecter" en bas) tout en restant non authentifié.
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initializeUser = async () => {
      try {
        const session = await loadAuthTokens();
        if (!session?.accessToken && !session?.refreshToken) {
          // Pas de token : on s'assure qu'aucun cache utilisateur ne reste.
          await AsyncStorage.removeItem('user');
          clearAuthSession();
          if (!cancelled) setUser(null);
          return;
        }

        setAuthSession(session);

        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser && !cancelled) {
          try {
            const parsed = JSON.parse(storedUser);
            setUser(sanitizeUserForStorage(parsed));
          } catch {
            await AsyncStorage.removeItem('user');
          }
        }

        // Vérifie l'access token et renouvelle la session si besoin.
        try {
          const response = await secureFetch(`${AUTH_BASE}/auth/me`);
          const safeUser = sanitizeUserForStorage(response?.user);
          if (safeUser) {
            if (!cancelled) setUser(safeUser);
            await saveUserToStorage(safeUser);
          }
        } catch (e) {
          if (e?.status === 401 || e?.status === 403) {
            await AsyncStorage.removeItem('user');
            clearAuthSession();
            if (!cancelled) setUser(null);
            return;
          }
          if (__DEV__) console.warn('[Profile] session conservée malgré erreur réseau :', e?.message || e?.status);
          return;
        }
      } catch (error) {
        if (__DEV__) console.error('Erreur init utilisateur:', error?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    registerAuthFailureHandler(async () => {
      await AsyncStorage.removeItem('user');
      if (!cancelled) {
        setUser(null);
        setShowLogin(false);
      }
    });

    initializeUser();

    return () => {
      cancelled = true;
      registerAuthFailureHandler(null);
    };
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
      // Déconnexion manuelle : tentative de révocation serveur puis purge locale.
      await logoutCurrentSession();
      await clearUserFromStorage();
      setUser(null);
      setShowLogin(false);
    } catch (error) {
      if (__DEV__) console.error('Erreur déconnexion:', error?.message);
      await clearUserFromStorage();
      clearAuthSession();
      setUser(null);
      setShowLogin(false);
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
