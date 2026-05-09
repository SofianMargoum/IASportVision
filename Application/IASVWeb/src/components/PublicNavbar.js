import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './PublicNavbar.css';

const NAV_LINKS = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'produit', label: 'Produit' },
  { id: 'application', label: 'Application mobile' },
  { id: 'tarifs', label: 'Tarifs' },
  { id: 'contact', label: 'Contact' },
];

export default function PublicNavbar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className={`iasv-pubnav ${scrolled ? 'iasv-pubnav--scrolled' : ''}`}>
      <div className="iasv-pubnav__inner">
        <Link to="/" className="iasv-pubnav__brand" onClick={() => setOpen(false)}>
          <img src="/logo-blanc.png" alt="IA Sport Vision" />
        </Link>

        <nav className={`iasv-pubnav__links ${open ? 'is-open' : ''}`}>
          {NAV_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={handleAnchor(l.id)}>
              {l.label}
            </a>
          ))}
          <button
            type="button"
            className="iasv-pubnav__login"
            onClick={() => { setOpen(false); navigate('/login'); }}
          >
            Connexion
          </button>
        </nav>

        <button
          type="button"
          className={`iasv-pubnav__burger ${open ? 'is-open' : ''}`}
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}
