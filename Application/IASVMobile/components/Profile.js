import React, { useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { sendIdTokenToBackend } from './api'; // Importez votre fonction API

const scale = 0.85; // Ajustez cette valeur selon vos besoins

const Profile = () => {
  useEffect(() => {
    // Configuration Google Sign-In
    GoogleSignin.configure({
      webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Remplacez par votre ID client Google
    });
  }, []);

  const handleGoogleLoginSuccess = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken;
      
      // Envoyer le token au backend
      const data = await sendIdTokenToBackend(idToken);
      console.log('Utilisateur vérifié avec succès:', data);
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.error('Connexion Google annulée');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.error('Connexion Google déjà en cours');
      } else {
        console.error('Erreur lors de la connexion Google:', error);
      }
    }
  };

  return (
    <View style={styles.profilePage}>
      <View style={styles.profileContainer}>
        <Text style={styles.title}>Connectez-vous à votre compte</Text>

        {/* Email Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Adresse e-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="Entrez votre email"
            placeholderTextColor="rgba(255, 255, 255, 0.5)" // Placeholder en blanc translucide
            keyboardType="email-address"
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="Entrez votre mot de passe"
            placeholderTextColor="rgba(255, 255, 255, 0.5)" // Placeholder en blanc translucide
            secureTextEntry
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginBtn}>
          <Text style={styles.loginBtnText}>Se connecter</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <Text style={styles.dividerText}>ou</Text>
        </View>

        {/* Google Login */}
        <TouchableOpacity style={styles.loginBtn} onPress={handleGoogleLoginSuccess}>
          <Text style={styles.loginBtnText}>Se connecter avec Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  profilePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010914',
  },
  profileContainer: {
    width: '80%',
    padding: 20 * scale, // Échelle appliquée ici
    borderRadius: 10,
    shadowColor: '#00A0E9',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
    backgroundColor: '#010914',
  },
  title: {
    fontSize: 30 * scale, // Échelle appliquée ici
    fontWeight: 'bold',
    marginBottom: 20 * scale, // Échelle appliquée ici
    color: '#fff',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20 * scale, // Échelle appliquée ici
  },
  label: {
    color: '#fff',
    fontSize: 16 * scale, // Échelle appliquée ici
    marginBottom: 5,
  },
  input: {
    borderWidth: 3,
    borderColor: '#001A31',
    borderRadius: 5,
    padding: 10 * scale, // Échelle appliquée ici
    fontSize: 16 * scale, // Échelle appliquée ici
  },
  loginBtn: {
    padding: 15 * scale, // Échelle appliquée ici
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
    fontSize: 16 * scale, // Échelle appliquée ici
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 20 * scale, // Échelle appliquée ici
    alignItems: 'center',
  },
  dividerText: {
    fontSize: 16 * scale, // Échelle appliquée ici
    color: '#aaa',
  },
});

export default Profile;
