import React, { useCallback, useEffect, useState } from 'react';
import { listUsers, createUser, updateUser, deactivateUser, listClubs } from '../api/adminApi';
import { useAuth } from '../context/AuthContext';
import { ROLES, ROLE_LABELS } from '../constants/roles';

const ROLE_OPTIONS = [ROLES.COACH, ROLES.PLAYER, ROLES.SUPPORTER, ROLES.ADMIN];

const EMPTY_FORM = {
  username: '',
  password: '',
  name: '',
  email: '',
  role: ROLES.PLAYER,
  clubId: '',
  isActive: true,
};

function formatDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  } catch { return '—'; }
}

function UserFormModal({ open, onClose, onSaved, editingUser, clubs }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) { setError(null); return; }
    if (editingUser) {
      setForm({
        username: editingUser.username || '',
        password: '',
        name: editingUser.name || '',
        email: editingUser.email || '',
        role: editingUser.role || ROLES.PLAYER,
        clubId: editingUser.clubId || editingUser.club_id || '',
        isActive: editingUser.isActive !== undefined ? !!editingUser.isActive : !(editingUser.is_active === false),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [open, editingUser]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setCheck = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  const validate = () => {
    if (!form.username.trim()) return 'Username requis.';
    if (!form.name.trim()) return 'Nom requis.';
    if (!ROLE_OPTIONS.includes(form.role)) return 'Rôle invalide.';
    if (!editingUser && (!form.password || form.password.length < 8))
      return 'Mot de passe requis (8 caractères minimum).';
    if (editingUser && form.password && form.password.length < 8)
      return 'Le nouveau mot de passe doit faire au moins 8 caractères.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      return 'Email invalide.';
    if (form.role !== ROLES.ADMIN && !form.clubId)
      return 'Un club est obligatoire pour ce rôle.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        isActive: form.isActive,
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.clubId ? { clubId: form.clubId } : { clubId: null }),
        ...(form.password ? { password: form.password } : {}),
      };
      if (editingUser) {
        await updateUser(editingUser.id, payload);
      } else {
        await createUser(payload);
      }
      onSaved && onSaved();
    } catch (e) {
      setError(e?.message || 'Erreur serveur.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        className="iasv-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {editingUser ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
          </h2>
          <button type="button" className="iasv-btn iasv-btn-ghost" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Username *</label>
            <input
              className="iasv-input" style={inputStyle}
              value={form.username}
              onChange={set('username')}
              disabled={!!editingUser}
              autoCapitalize="none"
              autoComplete="off"
              maxLength={64}
            />
          </div>

          <div>
            <label style={labelStyle}>{editingUser ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'}</label>
            <input
              className="iasv-input" style={inputStyle}
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder={editingUser ? 'Laisser vide pour ne pas changer' : ''}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label style={labelStyle}>Nom complet *</label>
            <input className="iasv-input" style={inputStyle} value={form.name} onChange={set('name')} maxLength={100} />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input className="iasv-input" style={inputStyle} type="email" value={form.email} onChange={set('email')} maxLength={200} />
          </div>

          <div>
            <label style={labelStyle}>Rôle *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role: r }))}
                  className={form.role === r ? 'iasv-btn' : 'iasv-btn iasv-btn-ghost'}
                  style={{ padding: '4px 14px', fontSize: 13 }}
                >
                  {ROLE_LABELS[r] || r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Club {form.role !== ROLES.ADMIN ? '*' : '(optionnel pour admin)'}
            </label>
            <select
              className="iasv-input" style={inputStyle}
              value={form.clubId}
              onChange={set('clubId')}
            >
              <option value="">— Aucun club —</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {editingUser && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!form.isActive}
                onChange={setCheck('isActive')}
              />
              <span style={{ fontSize: 14 }}>Compte actif</span>
            </label>
          )}
        </div>

        {error && <div className="iasv-error" style={{ marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="iasv-btn iasv-btn-ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="button" className="iasv-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : (editingUser ? 'Enregistrer' : 'Créer')}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 };
const inputStyle = { width: '100%' };

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, clubList] = await Promise.all([
        listUsers(),
        listClubs(),
      ]);
      setUsers(userList);
      setClubs(clubList);
    } catch (e) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const openCreate = () => { setEditingUser(null); setModalOpen(true); };
  const openEdit = (u) => { setEditingUser(u); setModalOpen(true); };

  const handleDeactivate = async (u) => {
    if (u.id === me?.id) { alert('Vous ne pouvez pas désactiver votre propre compte.'); return; }
    const label = u.name || u.username;
    if (!window.confirm(`Désactiver ${label} ? Le compte sera inaccessible.`)) return;
    try {
      await deactivateUser(u.id);
      setSuccessMsg(`${label} désactivé.`);
      await reload();
    } catch (e) { alert(e?.message || 'Erreur'); }
  };

  const handleReactivate = async (u) => {
    const label = u.name || u.username;
    if (!window.confirm(`Réactiver ${label} ?`)) return;
    try {
      await updateUser(u.id, { isActive: true });
      setSuccessMsg(`${label} réactivé.`);
      await reload();
    } catch (e) { alert(e?.message || 'Erreur'); }
  };

  const clubName = (u) => {
    const id = u.clubId || u.club_id;
    if (!id) return '—';
    const club = clubs.find((c) => String(c.id) === String(id));
    return club ? club.name : id;
  };

  const isActive = (u) =>
    u.isActive !== undefined ? !!u.isActive : u.is_active !== false;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="iasv-page-title">Utilisateurs</h1>
          <p className="iasv-page-subtitle">Gestion des comptes (création, modification, activation).</p>
        </div>
        <button type="button" className="iasv-btn" onClick={openCreate}>
          Créer un utilisateur
        </button>
      </div>

      {error && <div className="iasv-error" style={{ marginBottom: 16 }}>{error}</div>}
      {successMsg && (
        <div className="iasv-card" style={{ marginBottom: 16, borderLeft: '3px solid #10b981' }}>
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="iasv-card">Chargement…</div>
      ) : (
        <table className="iasv-table">
          <thead>
            <tr>
              <th>Identifiant</th>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Club</th>
              <th>Actif</th>
              <th>Créé le</th>
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={8} style={{ color: 'var(--iasv-text-muted)' }}>Aucun utilisateur.</td></tr>
            ) : (
              users.map((u) => {
                const active = isActive(u);
                return (
                  <tr key={u.id || u.username}>
                    <td>{u.username}</td>
                    <td>{u.name || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>{ROLE_LABELS[u.role] || u.role}</td>
                    <td>{clubName(u)}</td>
                    <td style={{ color: active ? '#10b981' : 'var(--iasv-text-muted)' }}>
                      {active ? '✓' : '✗'}
                    </td>
                    <td>{formatDate(u.created_at || u.createdAt)}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="iasv-btn iasv-btn-ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => openEdit(u)}
                      >
                        Modifier
                      </button>
                      {active ? (
                        <button
                          type="button"
                          className="iasv-btn iasv-btn-ghost"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => handleDeactivate(u)}
                          disabled={u.id === me?.id}
                        >
                          Désactiver
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="iasv-btn iasv-btn-ghost"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => handleReactivate(u)}
                        >
                          Réactiver
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}

      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingUser={editingUser}
        clubs={clubs}
        onSaved={async () => {
          setModalOpen(false);
          setSuccessMsg(editingUser ? 'Utilisateur mis à jour.' : 'Utilisateur créé.');
          await reload();
        }}
      />
    </div>
  );
}

