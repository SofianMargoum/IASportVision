// GoogleSignInAndroid.js
import React from 'react';
import { Button, Alert } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: '417232013163-v2genb8j1f3odhrjt40hm9fsghgodgrl.apps.googleusercontent.com',
  offlineAccess: true,
});

const GoogleSignInAndroid = () => {
  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      console.log(userInfo);

      // Envoyer le token au backend pour vérification
      const response = await fetch('https://api-dofa.prd-aws.fff.fr/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: userInfo.idToken,
        }),
      });
      const data = await response.json();
      console.log('Backend response:', data);
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Sign-In Cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Sign-In In Progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Play Services Not Available');
      } else {
        Alert.alert('Sign-In Error', error.message);
      }
    }
  };

  return (
    <Button
      title="Sign in with Google"
      onPress={signIn}
    />
  );
};

export default GoogleSignInAndroid;
