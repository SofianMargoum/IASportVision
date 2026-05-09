import React from 'react';

export default function CoachPage() {
  return (
    <div>
      <h1 className="iasv-page-title">Espace coach</h1>
      <p className="iasv-page-subtitle">Composez vos équipes, suivez les statistiques.</p>
      <div className="iasv-grid">
        <div className="iasv-card"><h3>Effectif</h3><p style={{ color: 'var(--iasv-text-muted)' }}>À brancher.</p></div>
        <div className="iasv-card"><h3>Composition</h3><p style={{ color: 'var(--iasv-text-muted)' }}>À brancher.</p></div>
        <div className="iasv-card"><h3>Statistiques</h3><p style={{ color: 'var(--iasv-text-muted)' }}>À brancher.</p></div>
      </div>
    </div>
  );
}
