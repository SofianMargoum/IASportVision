import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../constants/roles';

export default function DashboardPage() {
  const { user, role } = useAuth();

  return (
    <div>
      <h1 className="iasv-page-title">Bienvenue {user?.username || user?.email || ''}</h1>
      <p className="iasv-page-subtitle">
        Profil&nbsp;: <span className="iasv-badge">{ROLE_LABELS[role] || role || 'inconnu'}</span>
      </p>

      <div className="iasv-grid" style={{ marginBottom: 24 }}>
        <div className="iasv-stat-card">
          <div className="iasv-stat-label">Vidéos</div>
          <div className="iasv-stat-value">—</div>
        </div>
        <div className="iasv-stat-card">
          <div className="iasv-stat-label">Clubs suivis</div>
          <div className="iasv-stat-value">—</div>
        </div>
        <div className="iasv-stat-card">
          <div className="iasv-stat-label">Caméras</div>
          <div className="iasv-stat-value">—</div>
        </div>
        <div className="iasv-stat-card">
          <div className="iasv-stat-label">Statut</div>
          <div className="iasv-stat-value" style={{ color: 'var(--iasv-success)' }}>OK</div>
        </div>
      </div>

      <div className="iasv-card">
        <h3>Démarrage rapide</h3>
        <p style={{ color: 'var(--iasv-text-muted)' }}>
          Accédez aux modules de votre plateforme&nbsp;:
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <Link className="iasv-btn" to="/videos">Vidéos</Link>
          <Link className="iasv-btn iasv-btn-ghost" to="/clubs">Clubs</Link>
          <Link className="iasv-btn iasv-btn-ghost" to="/cameras">Caméras</Link>
        </div>
      </div>
    </div>
  );
}
