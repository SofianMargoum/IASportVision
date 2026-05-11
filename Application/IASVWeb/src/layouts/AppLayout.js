import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaFutbol,
  FaVideo,
  FaUsers,
  FaCamera,
  FaUserShield,
  FaUserTie,
  FaRunning,
  FaHeart,
  FaPenNib,
  FaCloud,
  FaSignOutAlt,
  FaBars,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { canViewPage, PAGES } from '../utils/permissions';
import { ROLE_LABELS } from '../constants/roles';
import './AppLayout.css';

const NAV = [
  { to: '/dashboard', label: 'Tableau de bord', icon: FaTachometerAlt, page: PAGES.DASHBOARD },
  { to: '/clubs', label: 'Clubs', icon: FaFutbol, page: PAGES.CLUBS },
  { to: '/videos', label: 'Vidéos', icon: FaVideo, page: PAGES.VIDEOS },
  { to: '/cameras', label: 'Caméras', icon: FaCamera, page: PAGES.CAMERAS },
  { to: '/users', label: 'Utilisateurs', icon: FaUsers, page: PAGES.USERS },
  { to: '/coach', label: 'Espace coach', icon: FaUserTie, page: PAGES.COACH },
  { to: '/player', label: 'Espace joueur', icon: FaRunning, page: PAGES.PLAYER },
  { to: '/supporter', label: 'Espace supporter', icon: FaHeart, page: PAGES.SUPPORTER },
  { to: '/annotation', label: 'Annotation', icon: FaPenNib, page: PAGES.ANNOTATION },
  { to: '/gcp', label: 'GCP', icon: FaCloud, page: PAGES.GCP },
  { to: '/admin', label: 'Admin', icon: FaUserShield, page: PAGES.ADMIN },
];

export default function AppLayout() {
  const { user, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  const visibleItems = NAV.filter((item) => canViewPage(role, item.page, true));
  const brand = process.env.REACT_APP_BRAND || 'IA Sport Vision';

  return (
    <div className={`iasv-app ${open ? 'sidebar-open' : ''}`}>
      <aside className="iasv-sidebar">
        <div className="iasv-brand">
          <span className="iasv-brand-name">{brand}</span>
        </div>
        <nav className="iasv-nav">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `iasv-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon className="iasv-nav-icon" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="iasv-sidebar-footer">
          <div className="iasv-user">
            <div className="iasv-user-name">{user?.username || user?.email || 'Utilisateur'}</div>
            <div className="iasv-user-role">{ROLE_LABELS[role] || role}</div>
          </div>
          <button type="button" className="iasv-logout" onClick={handleLogout}>
            <FaSignOutAlt /> Se déconnecter
          </button>
        </div>
      </aside>

      <div className="iasv-main">
        <header className="iasv-topbar">
          <button
            type="button"
            className="iasv-burger"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <FaBars />
          </button>
          <div className="iasv-topbar-title">{brand}</div>
        </header>
        <main className="iasv-content">
          <Outlet />
        </main>
      </div>

      {open && <div className="iasv-overlay" onClick={() => setOpen(false)} />}
    </div>
  );
}
