import React, { useEffect, useRef, useState } from 'react';
import {
  listClubs,
  createClub,
  deleteClub,
  searchFffClubs,
} from '../api/adminApi';

const SEARCH_DEBOUNCE_MS = 350;

function formatDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}

function ClubLogo({ src, alt }) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: 'var(--iasv-surface-2, #1f2937)',
          display: 'inline-block',
        }}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt || ''}
      width={36}
      height={36}
      style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, background: '#fff' }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

function AddClubModal({ open, onClose, onSaved }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults([]);
      setSearching(false);
      setSearchError(null);
      setSelected(null);
      setSaving(false);
      setSaveError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const cleaned = term.trim();
    if (!cleaned) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return undefined;
    }
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current;
      setSearching(true);
      setSearchError(null);
      try {
        const list = await searchFffClubs(cleaned);
        if (reqId !== reqIdRef.current) return;
        setResults(list);
      } catch (e) {
        if (reqId !== reqIdRef.current) return;
        setSearchError(e?.message || 'Erreur de recherche.');
        setResults([]);
      } finally {
        if (reqId === reqIdRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createClub({
        fff_cl_no: selected.fff_cl_no,
        name: selected.name,
        logo_url: selected.logo_url || null,
      });
      onSaved && onSaved();
    } catch (e) {
      setSaveError(e?.message || "Erreur à l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        className="iasv-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Ajouter un club</h2>
          <button type="button" className="iasv-btn iasv-btn-ghost" onClick={onClose}>Fermer</button>
        </div>

        <input
          type="text"
          className="iasv-input"
          placeholder="Rechercher un club par nom (FFF DOFA)…"
          value={term}
          maxLength={100}
          autoFocus
          onChange={(e) => {
            setTerm(e.target.value);
            setSelected(null);
          }}
          style={{ marginBottom: 12 }}
        />

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 120 }}>
          {searching && <div style={{ color: 'var(--iasv-text-muted)' }}>Recherche en cours…</div>}
          {!searching && searchError && (
            <div className="iasv-error">{searchError}</div>
          )}
          {!searching && !searchError && term.trim() && results.length === 0 && (
            <div style={{ color: 'var(--iasv-text-muted)' }}>Aucun club trouvé.</div>
          )}
          {!searching && results.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {results.map((c) => {
                const isSel = selected && selected.fff_cl_no === c.fff_cl_no;
                return (
                  <li
                    key={c.fff_cl_no}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--iasv-border, #2a3441)',
                      marginBottom: 6,
                      background: isSel ? 'var(--iasv-surface-2, #1f2937)' : 'transparent',
                    }}
                  >
                    <ClubLogo src={c.logo_url} alt={c.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{c.name || '(sans nom)'}</div>
                      <div style={{ fontSize: 12, color: 'var(--iasv-text-muted)' }}>
                        cl_no : {c.fff_cl_no}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={isSel ? 'iasv-btn' : 'iasv-btn iasv-btn-ghost'}
                      onClick={() => setSelected(c)}
                    >
                      {isSel ? 'Sélectionné' : 'Sélectionner'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--iasv-border, #2a3441)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <ClubLogo src={selected.logo_url} alt={selected.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: 'var(--iasv-text-muted)' }}>
                cl_no : {selected.fff_cl_no}
              </div>
            </div>
          </div>
        )}

        {saveError && <div className="iasv-error" style={{ marginTop: 12 }}>{saveError}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="iasv-btn iasv-btn-ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="iasv-btn"
            onClick={handleSave}
            disabled={!selected || saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setClubs(await listClubs());
    } catch (e) {
      setError(e?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleDelete = async (club) => {
    const label = club?.name || club?.fff_cl_no || 'ce club';
    if (!window.confirm(`Supprimer ${label} ? Cette action est définitive.`)) return;
    try {
      await deleteClub(club.id);
      await reload();
    } catch (e) {
      alert(e?.message || 'Erreur lors de la suppression.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="iasv-page-title">Clubs</h1>
          <p className="iasv-page-subtitle">
            Gérez les clubs ayant la solution IA Sport Vision (référencés via FFF DOFA).
          </p>
        </div>
        <button type="button" className="iasv-btn" onClick={() => setModalOpen(true)}>
          Ajouter un club
        </button>
      </div>

      {error && <div className="iasv-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="iasv-card">Chargement…</div>
      ) : (
        <table className="iasv-table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>Logo</th>
              <th>Nom</th>
              <th>ID FFF</th>
              <th>Ajouté le</th>
              <th style={{ width: 140 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {clubs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--iasv-text-muted)' }}>
                  Aucun club enregistré.
                </td>
              </tr>
            ) : (
              clubs.map((c) => (
                <tr key={c.id}>
                  <td><ClubLogo src={c.logo_url} alt={c.name} /></td>
                  <td>{c.name}</td>
                  <td>{c.fff_cl_no}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="iasv-btn iasv-btn-ghost"
                      onClick={() => handleDelete(c)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <AddClubModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          setModalOpen(false);
          await reload();
        }}
      />
    </div>
  );
}
