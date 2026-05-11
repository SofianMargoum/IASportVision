// GCPPage — Centre de contrôle infrastructure & coûts (admin only).
// 100% mock data pour l'instant. Composants réutilisables internes.

import React, { useMemo, useState } from 'react';
import {
  FaServer,
  FaBrain,
  FaDesktop,
  FaChartLine,
  FaShieldAlt,
  FaCoins,
  FaCogs,
  FaPlay,
  FaStop,
  FaFileAlt,
  FaCloud,
  FaDatabase,
  FaHdd,
  FaRocket,
  FaBolt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaLock,
  FaUserShield,
  FaKey,
  FaGlobe,
  FaVideo,
  FaFilm,
  FaProjectDiagram,
  FaFire,
  FaInfoCircle,
} from 'react-icons/fa';
import './GCPPage.css';

// ----------------------------------------------------------------
// Mock data
// ----------------------------------------------------------------

const INFRA = [
  {
    key: 'appengine',
    name: 'App Engine',
    icon: FaCloud,
    desc: 'Backend Node.js / Express, API REST, Auth JWT, orchestration Hikvision.',
    status: 'active',
    crit: 'essentiel',
    cost: 'moyen',
    badges: ['Backend', 'Production'],
  },
  {
    key: 'cloudrun',
    name: 'Cloud Run',
    icon: FaRocket,
    desc: 'Traitement vidéo, inference YOLO, tracking ballon, jobs IA à la demande.',
    status: 'active',
    crit: 'essentiel',
    cost: 'eleve',
    badges: ['GPU', 'IA', 'Production'],
  },
  {
    key: 'cloudsql',
    name: 'Cloud SQL Postgres',
    icon: FaDatabase,
    desc: 'Base de données principale (clubs, utilisateurs, matchs, annotations).',
    status: 'active',
    crit: 'essentiel',
    cost: 'moyen',
    badges: ['Backend', 'Production'],
  },
  {
    key: 'gcs',
    name: 'Cloud Storage',
    icon: FaHdd,
    desc: 'Stockage vidéos brutes, exports, frames d\'annotation, modèles entraînés.',
    status: 'active',
    crit: 'essentiel',
    cost: 'eleve',
    badges: ['Storage', 'Production'],
  },
];

const AI_MODULES = [
  {
    key: 'annotation',
    name: 'Annotation',
    icon: FaProjectDiagram,
    desc: 'Outil interne d\'annotation de frames vidéo pour datasets YOLO.',
    state: 'Actif',
    cost: 'Faible',
    deps: ['Cloud Run', 'Cloud Storage', 'Postgres'],
    gpu: '0%',
    runs: 1240,
    tags: ['IA', 'Backend'],
    flags: [],
  },
  {
    key: 'retexai',
    name: 'RetexAI',
    icon: FaBrain,
    desc: 'Résumé automatique de match (key events, narration IA, highlights).',
    state: 'Beta',
    cost: 'Moyen',
    deps: ['Cloud Run', 'Vertex AI', 'GCS'],
    gpu: '12%',
    runs: 87,
    tags: ['IA'],
    flags: ['beta', 'exp'],
  },
  {
    key: 'trainer',
    name: 'Trainer',
    icon: FaBolt,
    desc: 'Entraînement YOLOv8 sur dataset annoté (jobs GPU on-demand).',
    state: 'On-demand',
    cost: 'Élevé',
    deps: ['Cloud Run GPU', 'GCS', 'Annotation'],
    gpu: '94%',
    runs: 14,
    tags: ['GPU', 'IA'],
    flags: ['heavy'],
  },
  {
    key: 'yolo-infer',
    name: 'YOLO Inference Vidéo',
    icon: FaVideo,
    desc: 'Détection joueur + ballon temps quasi-réel sur flux Hikvision.',
    state: 'Actif',
    cost: 'Élevé',
    deps: ['Cloud Run', 'GCS', 'Trainer'],
    gpu: '78%',
    runs: 5421,
    tags: ['GPU', 'IA', 'Production'],
    flags: ['heavy'],
  },
  {
    key: 'ball-tracking',
    name: 'Tracking ballon',
    icon: FaFilm,
    desc: 'Suivi du ballon image par image, lissage Kalman, export trajectoire.',
    state: 'Actif',
    cost: 'Moyen',
    deps: ['YOLO Infer'],
    gpu: '34%',
    runs: 4810,
    tags: ['IA'],
    flags: [],
  },
];

const SAAS_FLAGS = [
  { key: 'maintenance', label: 'Mode maintenance', sub: 'Bloque l\'accès utilisateurs sauf admin', on: false },
  { key: 'beta',        label: 'Mode beta',        sub: 'Active les fonctionnalités expérimentales', on: true  },
  { key: 'landing',     label: 'Landing page',     sub: 'Page publique iasportvision.com',           on: true  },
  { key: 'analytics',   label: 'Analytics',        sub: 'GA4 + collecte interne (anonymisée)',       on: true  },
  { key: 'auth',        label: 'Authentification', sub: 'JWT + Google OAuth',                        on: true  },
];

const SAAS_STATS = [
  { k: 'Utilisateurs actifs', v: '1 284', d: '+8.4% ce mois' },
  { k: 'Sessions / jour',     v: '3 421',  d: '+12% vs hier' },
  { k: 'Taux de conversion',  v: '4.2%',   d: '+0.6 pt' },
  { k: 'Erreurs front',       v: '0.8%',   d: '-0.2 pt' },
];

const MONITORING = [
  { k: 'Erreurs backend',    v: 12, t: 'warn',  s: '24h' },
  { k: 'Erreurs ffmpeg',     v: 3,  t: 'ok',    s: '24h' },
  { k: 'Erreurs Hikvision',  v: 27, t: 'err',   s: '24h' },
  { k: 'Queues bloquées',    v: 1,  t: 'warn',  s: 'now'  },
  { k: 'Exports en attente', v: 4,  t: 'ok',    s: 'now'  },
  { k: 'Cloud Run failures', v: 2,  t: 'warn',  s: '24h' },
];

const TIMELINE = [
  { time: '14:32', level: 'err',  msg: 'Hikvision token expiré (camera-12). Refresh automatique en cours.' },
  { time: '14:18', level: 'warn', msg: 'Cloud Run scale-up (yolo-infer) suite à pic de requêtes.' },
  { time: '13:55', level: 'ok',   msg: 'Job training-#142 terminé : mAP@50 = 0.81.' },
  { time: '13:40', level: 'info', msg: 'Déploiement IASVWeb v0.2.4 (App Engine) terminé.' },
  { time: '13:12', level: 'warn', msg: 'Latence Cloud SQL > 250ms pendant 4 min.' },
  { time: '12:48', level: 'ok',   msg: 'Backup automatique Postgres réussi.' },
];

const LOGS = [
  { lvl: 'info', txt: '[appengine] POST /auth/login 200 — 84ms' },
  { lvl: 'info', txt: '[cloudrun]  POST /infer  200 — 612ms (gpu=T4)' },
  { lvl: 'warn', txt: '[hikvision] camera-12 token refresh required' },
  { lvl: 'err',  txt: '[ffmpeg]    pipe broken on stream cam-7 (retrying...)' },
  { lvl: 'ok',   txt: '[trainer]   epoch 42/80 mAP@50=0.79 loss=0.31' },
  { lvl: 'info', txt: '[gcs]       upload videos/match-2026-05-08.mp4 (842MB) ok' },
  { lvl: 'warn', txt: '[appengine] slow query SELECT * FROM annotations (312ms)' },
  { lvl: 'info', txt: '[cloudrun]  cold start yolo-infer (4.1s)' },
];

const SECURITY = [
  { k: 'JWT actif',                 ok: true,  desc: 'Tokens signés HS256, expiration 7j.' },
  { k: 'Routes admin protégées',    ok: true,  desc: 'Middleware requireAdmin + ProtectedRoute.' },
  { k: 'Cloud Run privé',           ok: false, desc: 'Endpoint inference exposé publiquement (à durcir).' },
  { k: 'CORS strict',               ok: true,  desc: 'ALLOWED_ORIGIN restreint au domaine SaaS.' },
  { k: 'Hikvision tokens chiffrés', ok: true,  desc: 'Stockés chiffrés en base + rotation auto.' },
  { k: 'API rate-limit',            ok: false, desc: 'Pas de rate-limit sur /api/videos (à ajouter).' },
];

const COSTS = [
  { svc: 'Cloud Run (GPU)',     usage: '142 h GPU',     pct: 78, amount: 312.40, level: 'danger' },
  { svc: 'Cloud Storage',       usage: '4.2 TB',        pct: 64, amount: 84.10,  level: 'warn'   },
  { svc: 'Cloud SQL',           usage: 'db-g1-small',   pct: 42, amount: 48.20,  level: 'ok'     },
  { svc: 'App Engine',          usage: '12 instances/h',pct: 28, amount: 21.60,  level: 'ok'     },
  { svc: 'Trafic réseau',       usage: '820 GB egress', pct: 55, amount: 36.80,  level: 'warn'   },
  { svc: 'Vertex AI (RetexAI)', usage: '1 240 calls',   pct: 18, amount: 12.10,  level: 'ok'     },
];

const HEAVY_FUNCS = [
  { f: 'YOLO temps réel',         note: 'Inference 25 fps sur flux 1080p',     impact: 'Élevé'   },
  { f: 'Vidéos 4K',               note: 'Encodage + stockage GCS',             impact: 'Élevé'   },
  { f: 'Inference GPU',           note: 'Cloud Run + T4 / L4',                 impact: 'Élevé'   },
  { f: 'Training IA',             note: 'YOLOv8 80 epochs / 10k images',       impact: 'Très élevé' },
  { f: 'Tracking ballon multi-cam', note: 'Fusion 3 caméras temps réel',       impact: 'Moyen'   },
];

// Categories side nav
const CATEGORIES = [
  { id: 'infra',      label: 'Infrastructure', icon: FaServer },
  { id: 'ai',         label: 'IA / Vision',    icon: FaBrain },
  { id: 'frontend',   label: 'Frontend / SaaS',icon: FaDesktop },
  { id: 'monitoring', label: 'Monitoring',     icon: FaChartLine },
  { id: 'security',   label: 'Sécurité',       icon: FaShieldAlt },
  { id: 'costs',      label: 'Coûts',          icon: FaCoins },
];

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function Switch({ on, onClick }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      tabIndex={0}
      className={`gcp-switch ${on ? 'on' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onClick?.(); } }}
    />
  );
}

function StatusChip({ status }) {
  const map = {
    active:   { cls: 'active',   icon: FaCheckCircle,    label: 'Actif' },
    disabled: { cls: 'disabled', icon: FaTimesCircle,    label: 'Désactivé' },
    error:    { cls: 'error',    icon: FaExclamationTriangle, label: 'Erreur' },
  };
  const s = map[status] || map.active;
  const Icon = s.icon;
  return <span className={`gcp-chip ${s.cls}`}><Icon /> {s.label}</span>;
}

function CritChip({ value }) {
  return <span className={`gcp-chip crit-${value}`}>{value}</span>;
}

function CostChip({ value }) {
  return <span className={`gcp-chip cost-${value}`}>{value}</span>;
}

function Badge({ kind, children }) {
  const map = {
    GPU: 'gpu', IA: 'ia', Production: 'prod', Backend: 'backend',
    Storage: 'storage', beta: 'beta', exp: 'exp', heavy: 'heavy',
  };
  return <span className={`gcp-badge ${map[kind] || ''}`}>{children || kind}</span>;
}

function Sparkline({ values }) {
  const max = Math.max(...values, 1);
  return (
    <div className="gcp-spark">
      {values.map((v, i) => (
        <span key={i} style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

function InfraCard({ item, on, onToggle }) {
  const Icon = item.icon;
  return (
    <div className="gcp-card">
      <div className="gcp-card-head">
        <div className="gcp-card-title">
          <span className="gcp-icon-circle"><Icon /></span>
          {item.name}
        </div>
        <Switch on={on} onClick={onToggle} />
      </div>
      <div className="gcp-card-desc">{item.desc}</div>

      <div className="gcp-badges">
        {item.badges.map((b) => <Badge key={b} kind={b}>{b}</Badge>)}
      </div>

      <div className="gcp-meta">
        <div>
          <div className="k">Statut</div>
          <div className="v"><StatusChip status={on ? item.status : 'disabled'} /></div>
        </div>
        <div>
          <div className="k">Criticité</div>
          <div className="v"><CritChip value={item.crit} /></div>
        </div>
        <div>
          <div className="k">Coût</div>
          <div className="v"><CostChip value={item.cost} /></div>
        </div>
      </div>

      <div className="gcp-actions">
        {on
          ? <button className="gcp-btn danger" onClick={onToggle}><FaStop /> Désactiver</button>
          : <button className="gcp-btn primary" onClick={onToggle}><FaPlay /> Activer</button>}
        <button className="gcp-btn"><FaCogs /> Configurer</button>
        <button className="gcp-btn"><FaFileAlt /> Logs</button>
      </div>
    </div>
  );
}

function AIModuleCard({ m }) {
  const Icon = m.icon;
  return (
    <div className="gcp-card">
      <div className="gcp-card-head">
        <div className="gcp-card-title">
          <span className="gcp-icon-circle"><Icon /></span>
          {m.name}
        </div>
        <span className="gcp-pill ok"><span className="gcp-dot" /> {m.state}</span>
      </div>
      <div className="gcp-card-desc">{m.desc}</div>

      <div className="gcp-badges">
        {m.tags.map((t) => <Badge key={t} kind={t}>{t}</Badge>)}
        {m.flags.includes('beta')  && <Badge kind="beta">Beta</Badge>}
        {m.flags.includes('exp')   && <Badge kind="exp">Expérimental</Badge>}
        {m.flags.includes('heavy') && <Badge kind="heavy">IA intensive</Badge>}
      </div>

      <div className="gcp-meta">
        <div><div className="k">Coût</div><div className="v">{m.cost}</div></div>
        <div><div className="k">GPU</div><div className="v">{m.gpu}</div></div>
        <div><div className="k">Traitements</div><div className="v">{m.runs.toLocaleString('fr-FR')}</div></div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--iasv-text-muted)' }}>
        <strong style={{ color: 'var(--iasv-text)' }}>Dépendances :</strong>{' '}
        {m.deps.join(' · ')}
      </div>

      <div className="gcp-actions">
        <button className="gcp-btn"><FaPlay /> Lancer</button>
        <button className="gcp-btn"><FaCogs /> Configurer</button>
        <button className="gcp-btn"><FaFileAlt /> Logs</button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Main page
// ----------------------------------------------------------------

export default function GCPPage() {
  const [active, setActive] = useState('infra');
  const [infraOn, setInfraOn] = useState(
    () => Object.fromEntries(INFRA.map((s) => [s.key, true])),
  );
  const [flags, setFlags] = useState(
    () => Object.fromEntries(SAAS_FLAGS.map((f) => [f.key, f.on])),
  );

  const totalCost = useMemo(
    () => COSTS.reduce((s, r) => s + r.amount, 0),
    [],
  );

  const scrollTo = (id) => {
    setActive(id);
    const el = document.getElementById(`gcp-sec-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleInfra = (k) => setInfraOn((s) => ({ ...s, [k]: !s[k] }));
  const toggleFlag  = (k) => setFlags((s) => ({ ...s, [k]: !s[k] }));

  const activeServices = Object.values(infraOn).filter(Boolean).length;

  return (
    <div className="gcp-shell">
      {/* Header */}
      <div className="gcp-header">
        <div className="gcp-header-left">
          <h1><FaCloud style={{ color: 'var(--gcp-accent)' }} /> GCP — Centre de contrôle</h1>
          <p>Pilotage infrastructure, IA, monitoring et coûts pour IA Sport Vision.</p>
        </div>
        <div className="gcp-header-right">
          <span className="gcp-pill ok"><span className="gcp-dot" /> {activeServices}/{INFRA.length} services actifs</span>
          <span className="gcp-pill warn"><span className="gcp-dot" /> 2 alertes</span>
          <span className="gcp-pill"><FaInfoCircle style={{ color: 'var(--gcp-accent)' }} /> ia-sport · europe-west1</span>
          <span className="gcp-pill"><FaCoins style={{ color: 'var(--gcp-warning)' }} /> ${totalCost.toFixed(2)} ce mois</span>
        </div>
      </div>

      {/* Side categories */}
      <aside className="gcp-side">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              className={active === c.id ? 'active' : ''}
              onClick={() => scrollTo(c.id)}
            >
              <span className="gcp-side-icon"><Icon /></span>
              {c.label}
            </button>
          );
        })}
      </aside>

      {/* Main */}
      <div className="gcp-main">
        {/* 1. Infrastructure */}
        <section id="gcp-sec-infra" className="gcp-section">
          <div className="gcp-section-title">
            <h2><FaServer style={{ color: 'var(--gcp-accent)' }} /> Infrastructure</h2>
            <small>{activeServices} actifs · {INFRA.length - activeServices} désactivés</small>
          </div>
          <div className="gcp-grid">
            {INFRA.map((it) => (
              <InfraCard
                key={it.key}
                item={it}
                on={infraOn[it.key]}
                onToggle={() => toggleInfra(it.key)}
              />
            ))}
          </div>
        </section>

        {/* 2. IA / Vision */}
        <section id="gcp-sec-ai" className="gcp-section">
          <div className="gcp-section-title">
            <h2><FaBrain style={{ color: 'var(--gcp-violet)' }} /> IA / Vision</h2>
            <small>{AI_MODULES.length} modules</small>
          </div>
          <div className="gcp-alert">
            <FaExclamationTriangle className="icon" style={{ color: 'var(--gcp-warning)' }} />
            <div>
              <strong>Trainer</strong> consomme <strong>94%</strong> du budget GPU mensuel.
              Pensez à planifier les jobs en heures creuses ou réduire <code>epochs</code>.
            </div>
          </div>
          <div className="gcp-grid">
            {AI_MODULES.map((m) => <AIModuleCard key={m.key} m={m} />)}
          </div>
        </section>

        {/* 3. Frontend / SaaS */}
        <section id="gcp-sec-frontend" className="gcp-section">
          <div className="gcp-section-title">
            <h2><FaDesktop style={{ color: 'var(--gcp-cyan)' }} /> Frontend / SaaS</h2>
            <small>IASVWeb · service App Engine <code>iasvweb</code></small>
          </div>

          <div className="gcp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {SAAS_STATS.map((s) => (
              <div key={s.k} className="gcp-stat">
                <div className="k">{s.k}</div>
                <div className="v">{s.v}</div>
                <div className="d">{s.d}</div>
              </div>
            ))}
          </div>

          <div className="gcp-grid" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {SAAS_FLAGS.map((f) => (
              <div className="gcp-switch-row" key={f.key}>
                <div>
                  <div className="label">{f.label}</div>
                  <div className="sub">{f.sub}</div>
                </div>
                <Switch on={!!flags[f.key]} onClick={() => toggleFlag(f.key)} />
              </div>
            ))}
          </div>

          <div className="gcp-card" style={{ marginTop: 16 }}>
            <div className="gcp-card-head">
              <div className="gcp-card-title">
                <span className="gcp-icon-circle"><FaChartLine /></span>
                Sessions sur 14 jours
              </div>
              <span className="gcp-pill ok"><span className="gcp-dot" /> En croissance</span>
            </div>
            <Sparkline values={[12, 18, 22, 17, 25, 28, 24, 30, 34, 31, 38, 42, 39, 47]} />
          </div>
        </section>

        {/* 4. Monitoring */}
        <section id="gcp-sec-monitoring" className="gcp-section">
          <div className="gcp-section-title">
            <h2><FaChartLine style={{ color: 'var(--gcp-success)' }} /> Monitoring</h2>
            <small>24h glissantes</small>
          </div>

          <div className="gcp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {MONITORING.map((m) => (
              <div className="gcp-stat" key={m.k}>
                <div className="k">{m.k}</div>
                <div className="v" style={{
                  color: m.t === 'err' ? 'var(--gcp-danger)'
                       : m.t === 'warn' ? 'var(--gcp-warning)'
                       : 'var(--gcp-success)',
                }}>{m.v}</div>
                <div className="d" style={{ color: 'var(--iasv-text-muted)' }}>fenêtre {m.s}</div>
              </div>
            ))}
          </div>

          <div className="gcp-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
            <div className="gcp-card">
              <div className="gcp-card-head">
                <div className="gcp-card-title">
                  <span className="gcp-icon-circle"><FaBolt /></span>
                  Timeline événements
                </div>
              </div>
              <div className="gcp-timeline">
                {TIMELINE.map((t, i) => (
                  <div key={i} className={`gcp-timeline-item ${t.level}`}>
                    <div className="time">{t.time}</div>
                    <div className="marker" />
                    <div>{t.msg}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gcp-card">
              <div className="gcp-card-head">
                <div className="gcp-card-title">
                  <span className="gcp-icon-circle"><FaFileAlt /></span>
                  Logs récents
                </div>
                <button className="gcp-btn">Tout voir</button>
              </div>
              <div className="gcp-log">
                {LOGS.map((l, i) => (
                  <div key={i}>
                    <span className={`lvl-${l.lvl}`}>[{l.lvl.toUpperCase()}]</span> {l.txt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Sécurité */}
        <section id="gcp-sec-security" className="gcp-section">
          <div className="gcp-section-title">
            <h2><FaShieldAlt style={{ color: 'var(--gcp-pink)' }} /> Sécurité</h2>
            <small>Niveau global : <strong style={{ color: 'var(--gcp-warning)' }}>Bon</strong> (2 actions recommandées)</small>
          </div>

          <div className="gcp-alert danger">
            <FaExclamationTriangle className="icon" style={{ color: 'var(--gcp-danger)' }} />
            <div>
              Cloud Run <strong>yolo-infer</strong> est exposé publiquement. À restreindre via IAM
              ou Identity-Aware Proxy.
            </div>
          </div>

          <div className="gcp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 16 }}>
            {SECURITY.map((s) => (
              <div className="gcp-card" key={s.k}>
                <div className="gcp-card-head">
                  <div className="gcp-card-title">
                    <span className="gcp-icon-circle">
                      {s.k.includes('JWT') ? <FaKey />
                       : s.k.includes('admin') ? <FaUserShield />
                       : s.k.includes('Cloud') ? <FaLock />
                       : s.k.includes('CORS') ? <FaGlobe />
                       : <FaShieldAlt />}
                    </span>
                    {s.k}
                  </div>
                  {s.ok
                    ? <span className="gcp-chip active"><FaCheckCircle /> OK</span>
                    : <span className="gcp-chip error"><FaExclamationTriangle /> À durcir</span>}
                </div>
                <div className="gcp-card-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Coûts */}
        <section id="gcp-sec-costs" className="gcp-section">
          <div className="gcp-section-title">
            <h2><FaCoins style={{ color: 'var(--gcp-warning)' }} /> Coûts</h2>
            <small>Estimation mois en cours</small>
          </div>

          <div className="gcp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="gcp-stat">
              <div className="k">Coût mensuel estimé</div>
              <div className="v">${totalCost.toFixed(2)}</div>
              <div className="d down">+18% vs mois dernier</div>
            </div>
            <div className="gcp-stat">
              <div className="k">Stockage vidéo</div>
              <div className="v">4.2 TB</div>
              <div className="d">+0.4 TB ce mois</div>
            </div>
            <div className="gcp-stat">
              <div className="k">IA processing</div>
              <div className="v">142 h GPU</div>
              <div className="d down">+22h vs prévu</div>
            </div>
            <div className="gcp-stat">
              <div className="k">Trafic réseau</div>
              <div className="v">820 GB</div>
              <div className="d">stable</div>
            </div>
          </div>

          <div className="gcp-card" style={{ marginTop: 16 }}>
            <div className="gcp-card-head">
              <div className="gcp-card-title">
                <span className="gcp-icon-circle"><FaChartLine /></span>
                Coût par service
              </div>
              <span className="gcp-pill"><FaInfoCircle style={{ color: 'var(--gcp-accent)' }} /> Mock data</span>
            </div>

            <table className="gcp-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Usage</th>
                  <th style={{ width: '32%' }}>Charge</th>
                  <th className="num">Montant</th>
                </tr>
              </thead>
              <tbody>
                {COSTS.map((c) => (
                  <tr key={c.svc}>
                    <td><strong>{c.svc}</strong></td>
                    <td style={{ color: 'var(--iasv-text-muted)' }}>{c.usage}</td>
                    <td>
                      <div className={`gcp-progress ${c.level === 'danger' ? 'danger' : c.level === 'warn' ? 'warn' : ''}`}>
                        <div style={{ width: `${c.pct}%` }} />
                      </div>
                    </td>
                    <td className="num">${c.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="gcp-card" style={{ marginTop: 16 }}>
            <div className="gcp-card-head">
              <div className="gcp-card-title">
                <span className="gcp-icon-circle" style={{ background: 'rgba(255,92,122,0.18)', color: 'var(--gcp-danger)', borderColor: 'rgba(255,92,122,0.35)' }}>
                  <FaFire />
                </span>
                Fonctions coûteuses
              </div>
              <span className="gcp-pill warn"><span className="gcp-dot" /> À surveiller</span>
            </div>
            <table className="gcp-table">
              <thead>
                <tr>
                  <th>Fonction</th>
                  <th>Détail</th>
                  <th>Impact</th>
                </tr>
              </thead>
              <tbody>
                {HEAVY_FUNCS.map((h) => (
                  <tr key={h.f}>
                    <td><strong>{h.f}</strong></td>
                    <td style={{ color: 'var(--iasv-text-muted)' }}>{h.note}</td>
                    <td>
                      <span className={`gcp-chip ${h.impact === 'Très élevé' || h.impact === 'Élevé' ? 'cost-eleve' : 'cost-moyen'}`}>
                        {h.impact}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
