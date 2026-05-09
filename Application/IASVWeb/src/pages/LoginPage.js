import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from?.pathname || '/dashboard';

  if (isAuthenticated) {
    navigate(from, { replace: true });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const status = err?.status;
      if (status === 401) setError('Identifiants invalides.');
      else if (status === 429) setError('Trop de tentatives. Réessayez dans quelques minutes.');
      else setError(err?.message || 'Connexion impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="iasv-login">
      <form className="iasv-login-card" onSubmit={handleSubmit}>
        <div className="iasv-login-brand">
          <span>{process.env.REACT_APP_BRAND || 'IA Sport Vision'}</span>
        </div>
        <h1 className="iasv-login-title">Connexion</h1>
        <p className="iasv-login-sub">Accédez à votre plateforme club.</p>

        {error && <div className="iasv-error" role="alert">{error}</div>}

        <label className="iasv-login-label">
          Identifiant
          <input
            className="iasv-input"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={64}
          />
        </label>

        <label className="iasv-login-label">
          Mot de passe
          <input
            className="iasv-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={128}
          />
        </label>

        <button type="submit" className="iasv-btn" disabled={submitting}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
