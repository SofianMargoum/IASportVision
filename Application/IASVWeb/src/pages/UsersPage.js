import React, { useEffect, useState } from 'react';
import { listUsers, deactivateUser } from '../api/adminApi';
import { ROLE_LABELS } from '../constants/roles';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (e) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleDeactivate = async (id) => {
    if (!window.confirm('Désactiver cet utilisateur ?')) return;
    try {
      await deactivateUser(id);
      await reload();
    } catch (e) {
      alert(e?.message || 'Erreur');
    }
  };

  return (
    <div>
      <h1 className="iasv-page-title">Utilisateurs</h1>
      <p className="iasv-page-subtitle">Gestion des comptes (rôles, activation).</p>

      {error && <div className="iasv-error" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div className="iasv-card">Chargement…</div>
      ) : (
        <table className="iasv-table">
          <thead>
            <tr>
              <th>Identifiant</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Actif</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} style={{ color: 'var(--iasv-text-muted)' }}>Aucun utilisateur.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id || u.username}>
                  <td>{u.username || u.id}</td>
                  <td>{u.email || '—'}</td>
                  <td>{ROLE_LABELS[u.role] || u.role}</td>
                  <td>{u.is_active === false || u.isActive === false ? '—' : '✓'}</td>
                  <td>
                    <button
                      className="iasv-btn iasv-btn-ghost"
                      type="button"
                      onClick={() => handleDeactivate(u.id)}
                    >
                      Désactiver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
