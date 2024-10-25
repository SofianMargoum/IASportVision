// GoogleSignInWeb.js
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';

const GoogleSignInWeb = () => {
  const handleSuccess = (response) => {
    console.log('Login Success:', response);
    // Votre logique côté serveur
  };

  const handleError = (error) => {
    console.error('Login Failed:', error);
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={handleError}
    />
  );
};

export default GoogleSignInWeb;
