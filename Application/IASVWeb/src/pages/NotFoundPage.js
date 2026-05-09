import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1 className="iasv-page-title">404</h1>
      <p className="iasv-page-subtitle">Cette page n'existe pas.</p>
      <Link to="/dashboard" className="iasv-btn">Retour au tableau de bord</Link>
    </div>
  );
}
