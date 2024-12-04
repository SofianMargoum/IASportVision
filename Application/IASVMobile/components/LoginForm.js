import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const scale = 0.85; // Échelle pour ajuster les tailles

const LoginForm = ({ handleGoogleLogin }) => {
  return (
    <View style={styles.profileContainer}>
    <>
      <Text style={styles.title}>Connectez-vous à votre compte</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Adresse e-mail</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez votre email"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez votre mot de passe"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          secureTextEntry
        />
      </View>

      <TouchableOpacity style={styles.loginBtn}>
        <Text style={styles.loginBtnText}>Se connecter</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <Text style={styles.dividerText}>ou</Text>
      </View>

      <TouchableOpacity style={styles.loginBtn} onPress={handleGoogleLogin}>
        <Text style={styles.loginBtnText}>Se connecter avec Google</Text>
      </TouchableOpacity>
    </>
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
  divider: {
    marginVertical: 20 * scale,
    alignItems: 'center',
  },
  dividerText: {
    fontSize: 16 * scale,
    color: '#aaa',
  },
});

export default LoginForm;
