import React, { useEffect, useState } from 'react';
import { fetchAllCameras, startRecording, stopRecording } from '../api/hikconnectApi';

export default function CamerasPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllCameras();
      const list = Array.isArray(data) ? data : (data?.cameras || data?.items || []);
      setCameras(list);
    } catch (e) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleStart = async (deviceId) => {
    setBusy(deviceId);
    try { await startRecording(deviceId); }
    catch (e) { alert(e?.message || 'Erreur'); }
    finally { setBusy(null); }
  };
  const handleStop = async (deviceId) => {
    setBusy(deviceId);
    try { await stopRecording(deviceId); }
    catch (e) { alert(e?.message || 'Erreur'); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <h1 className="iasv-page-title">Caméras</h1>
      <p className="iasv-page-subtitle">Visible uniquement pour les rôles Admin et Coach.</p>

      {error && <div className="iasv-error" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div className="iasv-card">Chargement…</div>
      ) : cameras.length === 0 ? (
        <div className="iasv-card"><p style={{ color: 'var(--iasv-text-muted)', margin: 0 }}>Aucune caméra enregistrée.</p></div>
      ) : (
        <div className="iasv-grid">
          {cameras.map((c) => {
            const id = c.deviceId || c.id;
            return (
              <div key={id} className="iasv-card">
                <div style={{ fontWeight: 700 }}>{c.name || c.deviceName || id}</div>
                <div style={{ color: 'var(--iasv-text-muted)', fontSize: 13, marginBottom: 10 }}>
                  {c.deviceSerial || c.serial || id}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="iasv-btn" disabled={busy === id} onClick={() => handleStart(id)}>
                    Démarrer
                  </button>
                  <button className="iasv-btn iasv-btn-ghost" disabled={busy === id} onClick={() => handleStop(id)}>
                    Arrêter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
