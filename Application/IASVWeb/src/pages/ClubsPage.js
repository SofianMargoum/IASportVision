import React from 'react';

export default function ClubsPage() {
  return (
    <div>
      <h1 className="iasv-page-title">Clubs</h1>
      <p className="iasv-page-subtitle">
        Sélectionnez et gérez les clubs suivis par votre plateforme.
      </p>
      <div className="iasv-card">
        <p style={{ color: 'var(--iasv-text-muted)', margin: 0 }}>
          Module à brancher sur l'API FFF DOFA et sur la liste des clubs gérés (à exposer côté backend).
        </p>
      </div>
    </div>
  );
}
