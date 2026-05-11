import React, { useEffect, useMemo, useState } from 'react';
import { fetchAllCameras } from '../api/hikconnectApi';
import {
  listClubs,
  listDevices,
  createDevice,
  deleteDevice,
} from '../api/adminApi';

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

/**
 * Extrait la liste de caméras de la réponse Hik-Connect.
 * Même logique que IASVMobile/components/Profile/Appareils.js :
 *   payload?.data?.camera ?? payload?.data?.cameras ?? payload?.camera ?? payload?.cameras
 */
function extractCamerasList(data) {
  const payload = data?.data ?? data;
  const cameras =
    payload?.data?.camera ??
    payload?.data?.cameras ??
    payload?.camera ??
    payload?.cameras ??
    payload?.list ??
    payload?.items ??
    (Array.isArray(payload) ? payload : []);
  return Array.isArray(cameras) ? cameras : [];
}

/**
 * Normalise une caméra Hik-Connect en { camera_id, device_id, name, serial_number, status, raw }.
 * Identique au mapping mobile :
 *   nom       <- cam.name
 *   deviceId  <- cam.device.devInfo.id
 *   cameraId  <- cam.id
 */
function normalizeHikCamera(c) {
  if (!c || typeof c !== 'object') return null;

  const cameraId =
    c.id ?? c.cameraId ?? null;
  const deviceId =
    c?.device?.devInfo?.id
    ?? c?.device?.id
    ?? c?.deviceId
    ?? null;

  if (!cameraId && !deviceId) return null;

  const name =
    c.name
    || c.cameraName
    || c.channelName
    || c?.device?.devInfo?.name
    || c.deviceName
    || (cameraId ? String(cameraId) : String(deviceId));

  const serial =
    c?.device?.devInfo?.serial
    || c.deviceSerial
    || c.serial
    || c.serialNumber
    || null;

  const status =
    c.status !== undefined && c.status !== null
      ? String(c.status)
      : c?.device?.devInfo?.status !== undefined
        ? String(c.device.devInfo.status)
        : c.online !== undefined
          ? String(c.online)
          : null;

  return {
    camera_id: cameraId !== null && cameraId !== undefined ? String(cameraId) : null,
    device_id: deviceId !== null && deviceId !== undefined ? String(deviceId) : null,
    name,
    serial_number: serial,
    status,
    raw: c,
  };
}

function StatusBadge({ status }) {
  if (status === null || status === undefined || status === '') {
    return <span style={{ color: 'var(--iasv-text-muted)' }}>—</span>;
  }
  return <span>{String(status)}</span>;
}

function AddDeviceModal({ open, onClose, onSaved, existingCameraIds }) {
  const [hikLoading, setHikLoading] = useState(false);
  const [hikError, setHikError] = useState(null);
  const [hikCameras, setHikCameras] = useState([]);

  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState(null);
  const [clubs, setClubs] = useState([]);

  const [selectedHikId, setSelectedHikId] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!open) {
      setHikCameras([]);
      setHikError(null);
      setClubs([]);
      setClubsError(null);
      setSelectedHikId('');
      setSelectedClubId('');
      setCustomName('');
      setSaving(false);
      setSaveError(null);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setHikLoading(true);
      setHikError(null);
      try {
        const raw = await fetchAllCameras();
        const list = extractCamerasList(raw)
          .map(normalizeHikCamera)
          .filter(Boolean);
        if (!cancelled) setHikCameras(list);
      } catch (e) {
        if (!cancelled) {
          setHikError(e?.message || 'Erreur lors de la récupération des caméras HikConnect.');
          setHikCameras([]);
        }
      } finally {
        if (!cancelled) setHikLoading(false);
      }
    })();

    (async () => {
      setClubsLoading(true);
      setClubsError(null);
      try {
        const list = await listClubs();
        if (!cancelled) setClubs(list);
      } catch (e) {
        if (!cancelled) {
          setClubsError(e?.message || 'Erreur lors du chargement des clubs.');
          setClubs([]);
        }
      } finally {
        if (!cancelled) setClubsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const availableCameras = useMemo(() => {
    const taken = new Set(existingCameraIds || []);
    return hikCameras.filter((c) => !c.camera_id || !taken.has(c.camera_id));
  }, [hikCameras, existingCameraIds]);

  if (!open) return null;

  const selectedCamera = availableCameras.find((c) => c.camera_id === selectedHikId) || null;
  const selectedClub = clubs.find((c) => String(c.id) === String(selectedClubId)) || null;

  const handleSave = async () => {
    if (!selectedCamera || !selectedClub) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createDevice({
        club_id: selectedClub.id,
        camera_id: selectedCamera.camera_id,
        device_id: selectedCamera.device_id,
        name: customName.trim() || selectedCamera.name,
        serial_number: selectedCamera.serial_number,
        status: selectedCamera.status,
        raw_data: selectedCamera.raw,
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
          <h2 style={{ margin: 0, fontSize: 18 }}>Ajouter une caméra</h2>
          <button type="button" className="iasv-btn iasv-btn-ghost" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
            Nom personnalisé
          </label>
          <input
            type="text"
            className="iasv-input"
            placeholder="Ex : Cam Terrain Pelouse, Cam Tribune Nord…"
            value={customName}
            maxLength={200}
            onChange={(e) => setCustomName(e.target.value)}
            style={{ marginBottom: 16, width: '100%' }}
          />

          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
            Caméra HikConnect
          </label>
          {hikLoading ? (
            <div style={{ color: 'var(--iasv-text-muted)', marginBottom: 12 }}>
              Chargement des caméras…
            </div>
          ) : hikError ? (
            <div className="iasv-error" style={{ marginBottom: 12 }}>{hikError}</div>
          ) : availableCameras.length === 0 ? (
            <div style={{ color: 'var(--iasv-text-muted)', marginBottom: 12 }}>
              Aucune caméra HikConnect disponible (toutes déjà rattachées ?).
            </div>
          ) : (
            <select
              className="iasv-input"
              value={selectedHikId}
              onChange={(e) => setSelectedHikId(e.target.value)}
              style={{ marginBottom: 12, width: '100%' }}
            >
              <option value="">— Sélectionner une caméra —</option>
              {availableCameras.map((c) => (
                <option key={c.camera_id || c.device_id} value={c.camera_id || ''}>
                  {c.name}
                  {c.device_id ? ` — device ${c.device_id}` : ''}
                  {c.camera_id ? ` / cam ${c.camera_id}` : ''}
                </option>
              ))}
            </select>
          )}

          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
            Club à rattacher
          </label>
          {clubsLoading ? (
            <div style={{ color: 'var(--iasv-text-muted)', marginBottom: 12 }}>
              Chargement des clubs…
            </div>
          ) : clubsError ? (
            <div className="iasv-error" style={{ marginBottom: 12 }}>{clubsError}</div>
          ) : clubs.length === 0 ? (
            <div style={{ color: 'var(--iasv-text-muted)', marginBottom: 12 }}>
              Aucun club enregistré. Créez d'abord un club dans l'onglet Clubs.
            </div>
          ) : (
            <select
              className="iasv-input"
              value={selectedClubId}
              onChange={(e) => setSelectedClubId(e.target.value)}
              style={{ marginBottom: 12, width: '100%' }}
            >
              <option value="">— Sélectionner un club —</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {saveError && <div className="iasv-error" style={{ marginTop: 12 }}>{saveError}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="iasv-btn iasv-btn-ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="iasv-btn"
            onClick={handleSave}
            disabled={!selectedCamera || !selectedClub || saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CamerasPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDevices();
      setDevices(list);
    } catch (e) {
      setError(e?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!successMsg) return undefined;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const handleDelete = async (device) => {
    const label = device?.name || device?.camera_id || device?.hik_device_id || 'cette caméra';
    if (!window.confirm(`Supprimer ${label} ? Cette action est définitive.`)) return;
    try {
      await deleteDevice(device.id);
      setSuccessMsg('Caméra supprimée.');
      await reload();
    } catch (e) {
      alert(e?.message || 'Erreur lors de la suppression.');
    }
  };

  const existingCameraIds = devices
    .map((d) => d.camera_id || d.hik_device_id)
    .filter(Boolean);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="iasv-page-title">Caméras</h1>
          <p className="iasv-page-subtitle">
            Rattachez les caméras HikConnect à un club. Visible uniquement pour les administrateurs.
          </p>
        </div>
        <button type="button" className="iasv-btn" onClick={() => setModalOpen(true)}>
          Ajouter une caméra
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
              <th>Nom</th>
              <th>Device ID</th>
              <th>Camera ID</th>
              <th>Club</th>
              <th>Statut</th>
              <th>Ajoutée le</th>
              <th style={{ width: 140 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: 'var(--iasv-text-muted)' }}>
                  Aucune caméra enregistrée.
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id}>
                  <td>{d.name || d.camera_id || d.hik_device_id}</td>
                  <td>{d.device_id || '—'}</td>
                  <td>{d.camera_id || d.hik_device_id || '—'}</td>
                  <td>{d.club?.name || '—'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{formatDate(d.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="iasv-btn iasv-btn-ghost"
                      onClick={() => handleDelete(d)}
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

      <AddDeviceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existingCameraIds={existingCameraIds}
        onSaved={async () => {
          setModalOpen(false);
          setSuccessMsg('Caméra rattachée avec succès.');
          await reload();
        }}
      />
    </div>
  );
}
