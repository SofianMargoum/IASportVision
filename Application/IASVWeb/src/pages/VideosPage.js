import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchVideosByClub } from '../api/videosApi';

export default function VideosPage() {
  const [club, setClub] = useState('');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!club.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchVideosByClub(club.trim());
      setVideos(list);
    } catch (err) {
      setError(err?.message || 'Erreur de chargement');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // pré-charge si un club est mémorisé
    const last = localStorage.getItem('iasv.lastClub');
    if (last) setClub(last);
  }, []);

  useEffect(() => {
    if (club) localStorage.setItem('iasv.lastClub', club);
  }, [club]);

  return (
    <div>
      <h1 className="iasv-page-title">Vidéos</h1>
      <p className="iasv-page-subtitle">Consultez les vidéos des matchs et entraînements.</p>

      <form className="iasv-card" onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="iasv-input"
          placeholder="Nom du club (ex: F.C. VIDAUBAN)"
          value={club}
          onChange={(e) => setClub(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="iasv-btn" type="submit" disabled={loading}>
          {loading ? 'Recherche…' : 'Charger'}
        </button>
      </form>

      {error && <div className="iasv-error" style={{ marginBottom: 16 }}>{error}</div>}

      {videos.length === 0 && !loading ? (
        <div className="iasv-card">
          <p style={{ color: 'var(--iasv-text-muted)', margin: 0 }}>
            Aucune vidéo. Indiquez un nom de club exact (correspondant au dossier GCS).
          </p>
        </div>
      ) : (
        <table className="iasv-table">
          <thead>
            <tr>
              <th>Aperçu</th>
              <th>Nom</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => {
              const name = v.name || v.filename || 'video';
              const url = v.url || v.publicUrl || v.video;
              const cover = v.cover || v.coverUrl;
              const date = v.date || v.updated || v.createdAt;
              return (
                <tr key={url || name}>
                  <td>
                    {cover ? (
                      <img src={cover} alt="" style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: 80, height: 45, background: 'var(--iasv-surface-hover)', borderRadius: 6 }} />
                    )}
                  </td>
                  <td>{name}</td>
                  <td>{date || '—'}</td>
                  <td>
                    {url ? (
                      <Link
                        className="iasv-btn iasv-btn-ghost"
                        to={`/videos/play?src=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`}
                      >
                        Lire
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
