import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminPage() {
  return (
    <div>
      <h1 className="iasv-page-title">Administration</h1>
      <p className="iasv-page-subtitle">Outils de gestion réservés aux admins.</p>
      <div className="iasv-grid">
        <Link to="/users" className="iasv-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Utilisateurs</h3>
          <p style={{ color: 'var(--iasv-text-muted)', margin: 0 }}>Lister, désactiver, modifier les comptes.</p>
        </Link>
        <Link to="/cameras" className="iasv-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Caméras</h3>
          <p style={{ color: 'var(--iasv-text-muted)', margin: 0 }}>Statut HikConnect, démarrer / arrêter.</p>
        </Link>
        <Link to="/annotation" className="iasv-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Annotation</h3>
          <p style={{ color: 'var(--iasv-text-muted)', margin: 0 }}>Annoter les frames extraites des vidéos.</p>
        </Link>
      </div>
    </div>
  );
}
