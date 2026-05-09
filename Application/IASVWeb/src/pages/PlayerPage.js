import React from 'react';

export default function PlayerPage() {
  return (
    <div>
      <h1 className="iasv-page-title">Espace joueur</h1>
      <p className="iasv-page-subtitle">Vos performances et vidéos personnelles.</p>
      <div className="iasv-card">
        <p style={{ color: 'var(--iasv-text-muted)', margin: 0 }}>Module à brancher sur le profil joueur.</p>
      </div>
    </div>
  );
}
