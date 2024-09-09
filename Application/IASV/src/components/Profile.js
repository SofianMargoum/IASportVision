import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import './css/Profile.css';

const Profile = () => {
  const handleLoginSuccess = (response) => {
    console.log('Login Success:', response);
    // Envoyer le token d'accès au backend pour validation ou stockage
  };

  const handleLoginFailure = (response) => {
    console.error('Login Failure:', response);
  };

  return (
    <div className="profile-page">
	
		<div className="profile-container">
		  <h1>Bienvenue à nouveau</h1>
		  <div className="google-login-container">
			<GoogleLogin
			  onSuccess={handleLoginSuccess}
			  onError={handleLoginFailure}
			/>
		  </div>
		</div>
    </div>
  );
};

export default Profile;
