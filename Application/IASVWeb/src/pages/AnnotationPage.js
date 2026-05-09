// AnnotationPage — UI admin d'annotation des frames vidéo.
// 100% React. Aucun appel direct à Cloud Run.
// Tout passe par App Engine (cf. ../api/annotationApi.js).

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './AnnotationPage.css';
import {
  listAnnotationVideos,
  listFrames,
  fetchFrameImage,
  saveAnnotation,
  getTrainingReadiness,
  startTraining,
  getTrainingStatus,
  listModelVersions,
  activateModel,
} from '../api/annotationApi';

const POLL_TRAINING_MS = 10000;
const REFRESH_READINESS_MS = 15000;

export default function AnnotationPage() {
  const [videos, setVideos] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [orderBy, setOrderBy] = useState('confidence');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState(null);
  const [loadingFrames, setLoadingFrames] = useState(false);

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imageBlobUrl, setImageBlobUrl] = useState(null);
  const [originalBox, setOriginalBox] = useState(null);
  const [currentBox, setCurrentBox] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const dragRef = useRef(null);

  const [readiness, setReadiness] = useState(null);
  const [trainOpts, setTrainOpts] = useState({
    baseModel: 'yolov8s.pt',
    epochs: 80,
    imgsz: 1280,
    batch: 8,
  });
  const [trainStatus, setTrainStatus] = useState('');
  const [activeRunId, setActiveRunId] = useState(null);
  const [registry, setRegistry] = useState({ active: null, runs: [] });

  // -----------------------------------------------------------------
  // Loaders
  // -----------------------------------------------------------------
  const loadVideos = useCallback(async () => {
    try {
      const data = await listAnnotationVideos();
      setVideos(Array.isArray(data?.videos) ? data.videos : []);
    } catch (e) {
      setError(e?.message || 'Erreur chargement vidéos');
    }
  }, []);

  const loadFramesList = useCallback(async () => {
    setLoadingFrames(true);
    setError(null);
    try {
      const data = await listFrames({ videoId, status: statusFilter, orderBy, limit: 100 });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCursor(0);
    } catch (e) {
      setError(e?.message || 'Erreur chargement frames');
      setItems([]);
    } finally {
      setLoadingFrames(false);
    }
  }, [videoId, statusFilter, orderBy]);

  const loadCurrentImage = useCallback(async () => {
    const it = items[cursor];
    if (!it) {
      setImageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      imgRef.current = null;
      return;
    }
    const box = it.correctedBox || it.box || null;
    setOriginalBox(box ? { ...box } : null);
    setCurrentBox(box ? { ...box } : null);
    setEditMode(false);
    try {
      const blob = await fetchFrameImage(it.id, 'raw');
      const url = URL.createObjectURL(blob);
      setImageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (e) {
      setError(`Erreur image : ${e?.message || e}`);
    }
  }, [items, cursor]);

  // Chargement asynchrone de l'image
  useEffect(() => {
    if (!imageBlobUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      drawScene();
    };
    img.src = imageBlobUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageBlobUrl]);

  useEffect(() => { drawScene(); /* eslint-disable-next-line */ }, [currentBox, editMode]);

  useEffect(() => { loadVideos(); }, [loadVideos]);
  useEffect(() => { loadFramesList(); }, [loadFramesList]);
  useEffect(() => { loadCurrentImage(); }, [loadCurrentImage]);

  useEffect(() => () => {
    if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl);
  }, [imageBlobUrl]);

  // -----------------------------------------------------------------
  // Canvas drawing
  // -----------------------------------------------------------------
  function drawScene() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    if (currentBox) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = editMode ? '#2196f3' : '#4caf50';
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
      if (editMode) {
        ctx.fillStyle = '#2196f3';
        ctx.fillRect(currentBox.x + currentBox.w - 10, currentBox.y + currentBox.h - 10, 14, 14);
      }
    }
  }

  function canvasCoords(ev) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (ev.clientX - rect.left) * sx, y: (ev.clientY - rect.top) * sy };
  }

  const onMouseDown = (ev) => {
    if (!editMode) return;
    const p = canvasCoords(ev);
    const box = currentBox;
    if (box) {
      const onResize =
        p.x >= box.x + box.w - 16 && p.x <= box.x + box.w + 6 &&
        p.y >= box.y + box.h - 16 && p.y <= box.y + box.h + 6;
      const inside =
        p.x >= box.x && p.x <= box.x + box.w &&
        p.y >= box.y && p.y <= box.y + box.h;
      if (onResize) { dragRef.current = { mode: 'resize', start: p, boxStart: { ...box } }; return; }
      if (inside) { dragRef.current = { mode: 'move', start: p, boxStart: { ...box } }; return; }
    }
    const newBox = { x: p.x - 40, y: p.y - 40, w: 80, h: 80 };
    setCurrentBox(newBox);
    dragRef.current = { mode: 'resize', start: p, boxStart: { ...newBox } };
  };

  const onMouseMove = (ev) => {
    if (!dragRef.current) return;
    const p = canvasCoords(ev);
    const dx = p.x - dragRef.current.start.x;
    const dy = p.y - dragRef.current.start.y;
    const start = dragRef.current.boxStart;
    if (dragRef.current.mode === 'move') {
      setCurrentBox({ ...start, x: start.x + dx, y: start.y + dy });
    } else {
      setCurrentBox({
        ...start,
        w: Math.max(8, start.w + dx),
        h: Math.max(8, start.h + dy),
      });
    }
  };

  const onMouseUp = () => { dragRef.current = null; };

  // -----------------------------------------------------------------
  // Save annotation
  // -----------------------------------------------------------------
  const boxChanged = useMemo(() => {
    if (!currentBox || !originalBox) return !!currentBox;
    return ['x', 'y', 'w', 'h'].some((k) => currentBox[k] !== originalBox[k]);
  }, [currentBox, originalBox]);

  const submitLabel = useCallback(async (label) => {
    const it = items[cursor];
    if (!it) return;
    const payload = { docId: it.id, label };
    if (editMode && currentBox && boxChanged) {
      payload.correctedBox = {
        x: Math.round(currentBox.x),
        y: Math.round(currentBox.y),
        w: Math.round(currentBox.w),
        h: Math.round(currentBox.h),
      };
    }
    try {
      await saveAnnotation(payload);
      if (statusFilter === 'pending') {
        const next = items.filter((_, i) => i !== cursor);
        setItems(next);
        if (cursor >= next.length) setCursor(Math.max(0, next.length - 1));
      } else {
        setCursor((c) => Math.min(c + 1, items.length - 1));
      }
    } catch (e) {
      setError(`Sauvegarde impossible : ${e?.message || e}`);
    }
  }, [items, cursor, editMode, currentBox, boxChanged, statusFilter]);

  // -----------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------
  useEffect(() => {
    const handler = (ev) => {
      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA') return;
      if (ev.key === 'ArrowRight') setCursor((c) => Math.min(items.length - 1, c + 1));
      else if (ev.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1));
      else if (ev.key === '1') submitLabel('true_ball');
      else if (ev.key === '2') submitLabel('false_positive');
      else if (ev.key === '3') submitLabel('no_ball');
      else if (ev.key.toLowerCase() === 'e') setEditMode((m) => !m);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items.length, submitLabel]);

  // -----------------------------------------------------------------
  // Training panel
  // -----------------------------------------------------------------
  const refreshReadiness = useCallback(async () => {
    try {
      const r = await getTrainingReadiness(videoId || '');
      setReadiness(r);
    } catch (e) {
      setReadiness({ ready: false, reason: e?.message || 'erreur' });
    }
  }, [videoId]);

  const refreshRegistry = useCallback(async () => {
    try {
      const r = await listModelVersions();
      setRegistry({ active: r?.active || null, runs: r?.runs || [] });
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    refreshReadiness();
    refreshRegistry();
    const id = setInterval(() => {
      refreshReadiness();
      refreshRegistry();
    }, REFRESH_READINESS_MS);
    return () => clearInterval(id);
  }, [refreshReadiness, refreshRegistry]);

  const handleStartTraining = async () => {
    if (!window.confirm(
      `Lancer l'entraînement ?\n\nBase : ${trainOpts.baseModel}\n` +
        `Epochs : ${trainOpts.epochs}  imgsz : ${trainOpts.imgsz}  batch : ${trainOpts.batch}`
    )) return;
    setTrainStatus('Soumission du job Vertex AI…');
    try {
      const r = await startTraining({ ...trainOpts, videoIds: videoId || '' });
      setActiveRunId(r.runId);
      setTrainStatus(`runId=${r.runId}\nvertex=${r.vertexJobResource || '?'}\n…en cours…`);
    } catch (e) {
      setTrainStatus('Échec : ' + (e?.message || e));
    }
  };

  useEffect(() => {
    if (!activeRunId) return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const r = await getTrainingStatus(activeRunId);
        const run = r?.run || {};
        const lines = [`runId=${activeRunId}`, `state=${run.state}`];
        if (run.metrics?.mAP50) lines.push(`mAP50=${run.metrics.mAP50.toFixed(3)}`);
        if (run.modelUri) lines.push(run.modelUri);
        if (run.error) lines.push('ERROR: ' + run.error);
        setTrainStatus(lines.join('\n'));
        if (run.state === 'succeeded' || run.state === 'failed') {
          if (run.state === 'succeeded') alert('✓ Nouveau modèle publié et activé !');
          setActiveRunId(null);
          refreshRegistry();
          return;
        }
      } catch { /* on retentera */ }
      if (!stopped) setTimeout(tick, POLL_TRAINING_MS);
    };
    tick();
    return () => { stopped = true; };
  }, [activeRunId, refreshRegistry]);

  const handleActivate = async (runId) => {
    if (!window.confirm(`Activer le modèle ${runId} ?`)) return;
    try {
      await activateModel(runId);
      await refreshRegistry();
    } catch (e) {
      alert('Échec : ' + (e?.message || e));
    }
  };

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  const it = items[cursor];

  return (
    <div className="annot-root">
      <div>
        <h1 className="iasv-page-title" style={{ marginBottom: 4 }}>Annotation</h1>
        <p className="iasv-page-subtitle" style={{ margin: 0 }}>
          Validation des détections et entraînement (réservé administrateurs).
        </p>
      </div>

      {error && <div className="annot-error">{error}</div>}

      <div className="annot-toolbar">
        <label>
          Vidéo :
          <select value={videoId} onChange={(e) => setVideoId(e.target.value)}>
            <option value="">(toutes)</option>
            {videos.map((v) => (
              <option key={v.videoId} value={v.videoId}>
                {v.videoId} — {v.pending}/{v.total} à faire
              </option>
            ))}
          </select>
        </label>
        <label>
          Statut :
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="pending">À annoter</option>
            <option value="annotated">Déjà annotées</option>
            <option value="all">Toutes</option>
          </select>
        </label>
        <label>
          Tri :
          <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)}>
            <option value="confidence">Confiance ↑ (difficiles d'abord)</option>
            <option value="frame">Frame ↑</option>
          </select>
        </label>
        <button type="button" onClick={loadFramesList}>Recharger</button>
        <span className="annot-progress">
          {loadingFrames ? 'Chargement…' : items.length === 0 ? 'Aucune frame' : `${cursor + 1} / ${items.length}`}
        </span>
      </div>

      <div className="annot-main">
        <section className="annot-viewer">
          <div className="annot-canvas-wrap">
            <canvas
              ref={canvasRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>
          <div className="annot-meta">
            {it ? (
              `id: ${it.id}\n` +
              `videoId: ${it.videoId}\n` +
              `frame: ${it.frame}\n` +
              `source: ${it.source ?? '-'}   confidence: ${it.confidence ?? '-'}\n` +
              `status: ${it.status}   label: ${it.label || '-'}\n` +
              (currentBox
                ? `box: x=${Math.round(currentBox.x)} y=${Math.round(currentBox.y)} w=${Math.round(currentBox.w)} h=${Math.round(currentBox.h)}`
                : '')
            ) : 'Aucune frame sélectionnée.'}
          </div>
        </section>

        <aside className="annot-controls">
          <div className="annot-card">
            <h3>Navigation</h3>
            <div className="annot-row">
              <button className="annot-btn" disabled={!items.length}
                onClick={() => setCursor((c) => Math.max(0, c - 1))}>◀ Précédent</button>
              <button className="annot-btn" disabled={!items.length}
                onClick={() => setCursor((c) => Math.min(items.length - 1, c + 1))}>Suivant ▶</button>
            </div>
          </div>

          <div className="annot-card">
            <h3>Étiquette</h3>
            <div className="annot-row">
              <button className="annot-btn annot-btn-yes" disabled={!it} onClick={() => submitLabel('true_ball')}>✓ Vrai ballon (1)</button>
              <button className="annot-btn annot-btn-no" disabled={!it} onClick={() => submitLabel('false_positive')}>✗ Faux positif (2)</button>
              <button className="annot-btn annot-btn-abs" disabled={!it} onClick={() => submitLabel('no_ball')}>∅ Absent (3)</button>
            </div>
            <div className="annot-row" style={{ marginTop: 8 }}>
              <button className={`annot-btn ${editMode ? 'active' : ''}`} disabled={!it}
                onClick={() => setEditMode((m) => !m)}>✎ Corriger box (E)</button>
              <button className="annot-btn" disabled={!it}
                onClick={() => setCurrentBox(originalBox ? { ...originalBox } : null)}>↺ Reset box</button>
            </div>
            <div className="annot-help">
              <kbd>1</kbd> vrai &nbsp; <kbd>2</kbd> faux &nbsp; <kbd>3</kbd> absent &nbsp;
              <kbd>←</kbd>/<kbd>→</kbd> nav &nbsp; <kbd>E</kbd> édit
            </div>
          </div>

          <div className="annot-card">
            <h3>Entraînement</h3>
            {readiness ? (
              <div className={`annot-readiness ${readiness.ready ? 'ok' : 'nok'}`}>
                {readiness.ready
                  ? `✓ Prêt : ${readiness.trueBall} vrais, ${readiness.falsePositive} faux+, ${readiness.noBall} vides`
                  : `✗ pending=${readiness.pending ?? '?'}, true_ball=${readiness.trueBall ?? 0}/${readiness.minRequired ?? '?'}. ${readiness.reason || ''}`}
              </div>
            ) : <div className="annot-readiness nok">Chargement…</div>}
            <button className="annot-btn annot-btn-train" style={{ marginTop: 10 }}
              disabled={!readiness?.ready || !!activeRunId}
              onClick={handleStartTraining}>🚀 Lancer l'entraînement</button>
            <details style={{ marginTop: 10, fontSize: 12 }}>
              <summary>Paramètres avancés</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <label>Base
                  <input value={trainOpts.baseModel}
                    onChange={(e) => setTrainOpts((o) => ({ ...o, baseModel: e.target.value }))} />
                </label>
                <label>Epochs
                  <input type="number" value={trainOpts.epochs}
                    onChange={(e) => setTrainOpts((o) => ({ ...o, epochs: parseInt(e.target.value, 10) || 1 }))} />
                </label>
                <label>imgsz
                  <input type="number" value={trainOpts.imgsz}
                    onChange={(e) => setTrainOpts((o) => ({ ...o, imgsz: parseInt(e.target.value, 10) || 320 }))} />
                </label>
                <label>batch
                  <input type="number" value={trainOpts.batch}
                    onChange={(e) => setTrainOpts((o) => ({ ...o, batch: parseInt(e.target.value, 10) || 1 }))} />
                </label>
              </div>
            </details>
            <pre className="annot-train-status">{trainStatus}</pre>
          </div>

          <div className="annot-card">
            <h3>Modèles</h3>
            <div className="annot-registry">
              {registry.active ? (
                <div className="active">● Actif : {registry.active.runId}</div>
              ) : <div>Aucun modèle actif</div>}
              <div style={{ marginTop: 6 }}>Historique :</div>
              {(registry.runs || []).map((run) => {
                const isActive = registry.active && registry.active.runId === run.runId;
                return (
                  <div key={run.runId} className={isActive ? 'active' : ''}>
                    {run.runId} — {run.state}
                    {run.metrics?.mAP50 ? ` (mAP50=${run.metrics.mAP50.toFixed(3)})` : ''}
                    {!isActive && run.modelUri ? (
                      <> · <a onClick={() => handleActivate(run.runId)}>activer</a></>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
