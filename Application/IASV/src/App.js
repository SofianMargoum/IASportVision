// src/App.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FaVideo, FaSearch, FaList, FaUser, FaMedal } from 'react-icons/fa';
import Home from './components/Home';
import Explore from './components/Explore';
import Video from './components/Video';
import Resultat from './components/Resultat';
import Profile from './components/Profile';
import { GoogleOAuthProvider } from '@react-oauth/google'; // Importer GoogleOAuthProvider
import './css/App.css';
import config from './config';

const App = () => {
  const [selectedClub, setSelectedClub] = useState(config.getSelectedClub());
  const [selectedCompetition, setSelectedCompetition] = useState(config.getSelectedCompetition());
  const location = useLocation();
  const navigate = useNavigate();

  // Écouter les changements de club et de compétition
  useEffect(() => {
    const updateSelectedClub = (club) => setSelectedClub(club);
    const updateSelectedCompetition = (competition) => setSelectedCompetition(competition);

    // Ajout des gestionnaires d'événements
    config.onClubChange(updateSelectedClub);
    config.onCompetitionChange(updateSelectedCompetition);

    // Cleanup les gestionnaires lors de la destruction du composant
    return () => {
      config.onClubChange(() => {});
      config.onCompetitionChange(() => {});
    };
  }, []);

  // Détermine si les onglets doivent être désactivés
  const areTabsDisabled = !selectedClub || !selectedCompetition;

  // Redirige vers "Explore" si l'utilisateur essaie d'accéder à une page désactivée
  useEffect(() => {
    if (areTabsDisabled && location.pathname !== '/explore') {
      navigate('/explore');
    }
  }, [areTabsDisabled, location, navigate]);

  return (
    <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
      <div className="app-container">
        <header className="app-header">
          <div className="selected-club-label">
            <div className="logoMain">
              <img src="logo.png" alt="Main logo" className="my-logo" />
            </div>
            {selectedClub ? (
              <>
                <img src={selectedClub.logo} alt={`${selectedClub.name} logo`} className="selected-club-logo" />
                <div className="selected-club-text">
                  <div className="selected-club-name">{selectedClub.name}</div>
                  {selectedCompetition && (
                    <div className="selected-competition-label">{selectedCompetition}</div>
                  )}
                </div>
              </>
            ) : (
              <p></p>
            )}
          </div>
        </header>
        <div className="app-content">
          <Routes location={location}>
            <Route path="/" element={<Home selectedClub={selectedClub} />} />
            <Route
              path="/explore"
              element={
                <Explore 
                  selectedClub={selectedClub} 
                  selectedCompetition={selectedCompetition}
                />
              }
            />
            <Route path="/video" element={<Video selectedClub={selectedClub} />} />
            <Route 
              path="/resultat" 
              element={<Resultat club={selectedClub} competition={selectedCompetition} />} 
            />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
        <nav className="app-navbar">
          <ul>
            <li>
              <NavLink
                to="/"
                className={({ isActive }) => (isActive ? 'active' : '')}
                style={{ pointerEvents: areTabsDisabled ? 'none' : 'auto', opacity: areTabsDisabled ? 0.5 : 1 }}
              >
                <FaVideo />
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/resultat"
                className={({ isActive }) => (isActive ? 'active' : '')}
                style={{ pointerEvents: areTabsDisabled ? 'none' : 'auto', opacity: areTabsDisabled ? 0.5 : 1 }}
              >
                <FaMedal />
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/video"
                className={({ isActive }) => (isActive ? 'active' : '')}
                style={{ pointerEvents: areTabsDisabled ? 'none' : 'auto', opacity: areTabsDisabled ? 0.5 : 1 }}
              >
                <FaList />
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/explore"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <FaSearch />
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/profile"
                className={({ isActive }) => (isActive ? 'active' : '')}
                style={{ pointerEvents: areTabsDisabled ? 'none' : 'auto', opacity: areTabsDisabled ? 0.5 : 1 }}
              >
                <FaUser />
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </GoogleOAuthProvider>
  );
};

export default App;
