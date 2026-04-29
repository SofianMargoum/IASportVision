import React, { useRef, useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { DEMO_CREDENTIALS } from './loginCredentials';

const scale = 0.85;

// Comparaison à temps constant pour éviter les attaques par timing.
const constantTimeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

// Rate-limit en mémoire (réinitialisé à chaque relance de l'app).
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000;

const LoginForm = ({ onLocalLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const attemptsRef = useRef(0);
  const lockUntilRef = useRef(0);

  const findCredential = (u, p) => {
    if (typeof u !== 'string' || typeof p !== 'string') return null;
    if (!u || !p) return null;
    // Boucle complète : on évite de court-circuiter pour ne pas révéler
    // par timing l'existence d'un identifiant.
    let match = null;
    for (const cred of DEMO_CREDENTIALS) {
      const userOk = constantTimeEqual(u, cred.username);
      const passOk = constantTimeEqual(p, cred.password);
      if (userOk && passOk) match = cred;
    }
    return match;
  };

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

  const handleLogin = () => {
    const now = Date.now();
    if (lockUntilRef.current > now) {
      const remaining = Math.ceil((lockUntilRef.current - now) / 1000);
      Alert.alert(
        'Trop de tentatives',
        `Réessayez dans ${remaining} seconde${remaining > 1 ? 's' : ''}.`
      );
      return;
    }

    const cred = findCredential(username, password);
    if (!cred) {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        lockUntilRef.current = now + LOCKOUT_MS;
        attemptsRef.current = 0;
        Alert.alert(
          'Compte temporairement bloqué',
          `Trop de tentatives. Réessayez dans ${LOCKOUT_MS / 1000}s.`
        );
      } else {
        // Message générique : ne pas révéler si l'identifiant existe.
        Alert.alert('Erreur', 'Identifiant ou mot de passe incorrect.');
      }
      return;
    }

    attemptsRef.current = 0;
    onLocalLogin?.({
      id: cred.id,
      name: cred.name,
      email: cred.email,
      photo: resolvePhotoUri(cred.photoAsset),
    });
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
        />
      </View>

      <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
        <Text style={styles.loginBtnText}>Se connecter</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 30 * scale,
    fontWeight: 'bold',
    marginBottom: 20 * scale,
    color: '#fff',
    textAlign: 'center',
  },
  profileContainer: {
    width: '80%',
    padding: 20 * scale,
    borderRadius: 10,
    shadowColor: '#00A0E9',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
    backgroundColor: '#010914',
  },
  inputGroup: {
    marginBottom: 20 * scale,
  },
  label: {
    color: '#fff',
    fontSize: 16 * scale,
    marginBottom: 5,
  },
  input: {
    borderWidth: 3,
    borderColor: '#001A31',
    borderRadius: 5,
    color: '#fff',
    padding: 10 * scale,
    fontSize: 16 * scale,
  },
  loginBtn: {
    padding: 15 * scale,
    borderWidth: 1,
    borderColor: '#001A31',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#00A0E9',
    shadowOpacity: 1,
    elevation: 3,
    backgroundColor: '#010914',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16 * scale,
    fontWeight: 'bold',
  },
});

export default LoginForm;
