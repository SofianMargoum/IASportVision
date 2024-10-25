// src/components/Profile.js
import React from 'react';
import { GoogleLogin } from '@react-oauth/google'; // Utilisation pour le web
import { sendIdTokenToBackend } from './api'; // Chemin vers votre fichier API
import './css/Profile.css';

const Profile = () => {
  const handleGoogleLoginSuccess = async (response) => {
    const idToken = response.credential; // Assurez-vous que credential existe

    try {
      const data = await sendIdTokenToBackend(idToken);
      console.log('Utilisateur vérifié avec succès:', data);
    } catch (error) {
      console.error('Erreur lors de la vérification du token Google:', error);
    }
  };

  const handleGoogleLoginError = (error) => {
    console.error('Erreur de connexion Google:', error);
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1>Connectez-vous à votre compte</h1>

        {/* Email Input */}
        <div className="input-group">
          <label htmlFor="email">Adresse e-mail</label>
          <div className="inputs">
            <input type="email" id="email" placeholder="Entrez votre email" />
          </div>
        </div>

        {/* Password Input */}
        <div className="input-group">
          <label htmlFor="password">Mot de passe</label>
          <div className="inputs">
            <input type="password" id="password" placeholder="Entrez votre mot de passe" />
          </div>
        </div>

        {/* Login Button */}
        <div className="login-btn">Se connecter</div>

        {/* Divider */}
        <div className="divider">
          <span>ou</span>
        </div>

        {/* Google Login for Web */}
        <div className="login-btn">
          <GoogleLogin
            onSuccess={handleGoogleLoginSuccess}
            onError={handleGoogleLoginError}
            style={{ width: '100%' }} // Si nécessaire
          />
        </div>
      </div>
    </div>
  );
};

export default Profile;
