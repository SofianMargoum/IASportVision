import React, { useRef, useState } from 'react';
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { moderateScale, scale as s } from './../../tools/responsive';
import { loginRequest } from './../../tools/authApi';
import { saveToken } from './../../tools/secureToken';
import { setAuthToken } from './../../tools/api';

const ms = moderateScale;

// Rate-limit local : protection UX en plus du rate-limit serveur.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000;

const resolvePhotoUri = (asset) => {
  try {
    if (asset === 'fcmiramas.jpg') {
      const { uri } = Image.resolveAssetSource(require('../../assets/fcmiramas.jpg'));
      return uri;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const LoginForm = ({ onLocalLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const attemptsRef = useRef(0);
  const lockUntilRef = useRef(0);

  const handleLogin = async () => {
    const now = Date.now();
    if (lockUntilRef.current > now) {
      const remaining = Math.ceil((lockUntilRef.current - now) / 1000);
      Alert.alert(
        'Trop de tentatives',
        `Réessayez dans ${remaining} seconde${remaining > 1 ? 's' : ''}.`
      );
      return;
    }

    if (!username || !password) {
      Alert.alert('Erreur', 'Veuillez saisir un identifiant et un mot de passe.');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await loginRequest(username.trim(), password);

      // Stockage sécurisé du token (Keychain). Si Keychain n'est pas dispo,
      // saveToken renvoie false : l'utilisateur devra se reconnecter au
      // prochain démarrage (mais reste connecté pour la session).
      await saveToken(token);
      // Cache mémoire pour que les futures requêtes envoient Authorization.
      setAuthToken(token);

      attemptsRef.current = 0;
      // Effacer le mot de passe de la mémoire React.
      setPassword('');

      onLocalLogin?.({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: resolvePhotoUri(user.photoAsset),
      });
    } catch (e) {
      attemptsRef.current += 1;
      if (e?.status === 429) {
        lockUntilRef.current = Date.now() + LOCKOUT_MS;
        attemptsRef.current = 0;
        Alert.alert(
          'Compte temporairement bloqué',
          e.message || 'Trop de tentatives. Réessayez plus tard.'
        );
      } else if (e?.status === 401 || e?.status === 400) {
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          lockUntilRef.current = Date.now() + LOCKOUT_MS;
          attemptsRef.current = 0;
          Alert.alert(
            'Compte temporairement bloqué',
            `Trop de tentatives. Réessayez dans ${LOCKOUT_MS / 1000}s.`
          );
        } else {
          Alert.alert('Erreur', 'Identifiant ou mot de passe incorrect.');
        }
      } else if (e?.status === 408) {
        Alert.alert('Erreur réseau', e.message || 'Délai dépassé.');
      } else {
        Alert.alert(
          'Erreur',
          'Connexion impossible. Vérifiez votre réseau et réessayez.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.profileContainer}>
      <Text style={styles.title}>Connectez-vous à votre compte</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Identifiant</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez votre identifiant"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          onChangeText={setUsername}
          value={username}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          maxLength={64}
          editable={!loading}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez votre mot de passe"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          secureTextEntry
          onChangeText={setPassword}
          value={password}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          maxLength={128}
          editable={!loading}
        />
      </View>

      <TouchableOpacity
        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginBtnText}>Se connecter</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: ms(30),
    fontWeight: 'bold',
    marginBottom: s(20),
    color: '#fff',
    textAlign: 'center',
  },
  profileContainer: {
    width: '80%',
    padding: s(20),
    borderRadius: ms(10),
    shadowColor: '#00A0E9',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
    backgroundColor: '#010914',
  },
  inputGroup: {
    marginBottom: s(20),
  },
  label: {
    color: '#fff',
    fontSize: ms(16),
    marginBottom: s(5),
  },
  input: {
    borderWidth: 3,
    borderColor: '#001A31',
    borderRadius: ms(5),
    color: '#fff',
    padding: s(10),
    fontSize: ms(16),
  },
  loginBtn: {
    padding: s(15),
    borderWidth: 1,
    borderColor: '#001A31',
    alignItems: 'center',
    borderRadius: ms(10),
    shadowColor: '#00A0E9',
    shadowOpacity: 1,
    elevation: 3,
    backgroundColor: '#010914',
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: ms(16),
    fontWeight: 'bold',
  },
});

export default LoginForm;
