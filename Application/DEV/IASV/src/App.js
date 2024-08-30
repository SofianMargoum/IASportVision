import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FaVideo, FaSearch, FaList, FaUser, FaMedal } from 'react-icons/fa';
import { useSpring, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import Home from './components/Home';
import Explore from './components/Explore';
import Video from './components/Video';
import Resultat from './components/Resultat';
import Profile from './components/Profile';
import './css/App.css';

const App = () => {
  const [selectedClub, setSelectedClub] = useState(null);
  const [currentPage, setCurrentPage] = useState('/');
  const [previousPage, setPreviousPage] = useState('/');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const savedClub = JSON.parse(localStorage.getItem('selectedClub'));
    if (savedClub) {
      setSelectedClub(savedClub);
    }
  }, []);

  useEffect(() => {
    if (location.pathname !== currentPage) {
      setPreviousPage(currentPage);
      setCurrentPage(location.pathname);
    }
  }, [location.pathname]);

  const handleClubSelection = (club) => {
    setSelectedClub(club);
    localStorage.setItem('selectedClub', JSON.stringify(club));
  };

  const handleSwipe = (direction) => {
    const paths = ['/', '/resultat', '/video', '/explore', '/profile'];
    const currentIndex = paths.indexOf(location.pathname);

    if (direction === 'left' && currentIndex < paths.length - 1) {
      navigate(paths[currentIndex + 1]);
    } else if (direction === 'right' && currentIndex > 0) {
      navigate(paths[currentIndex - 1]);
    }
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const transition = useSpring({
    opacity: 1,
    transform: `translateX(${currentPage > previousPage ? '100%' : '-100%'})`,
    config: { duration: 300 },
  });

  return (
    <div className="app-container" {...handlers}>
      <header className="app-header">
        <div className="selected-club-label">
          {selectedClub ? (
            <>
              <img src={selectedClub.logo} alt={`${selectedClub.name} logo`} className="selected-club-logo" />
              <span>{selectedClub.name}</span>
            </>
          ) : (
            <p>No club selected</p>
          )}
        </div>
      </header>
      <div className="app-content">
          <Routes location={location}>
            <Route path="/" element={<Home selectedClub={selectedClub} />} />
            <Route path="/explore" element={<Explore onSelectClub={handleClubSelection} />} />
            <Route path="/video" element={<Video selectedClub={selectedClub} />} />
            <Route path="/resultat" element={<Resultat />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
      </div>
      <nav className="app-navbar">
        <ul>
          <li>
            <NavLink exact to="/" activeClassName="active"><FaVideo /></NavLink>
          </li>
          <li>
            <NavLink to="/resultat" activeClassName="active"><FaMedal /></NavLink>
          </li>
          <li>
            <NavLink to="/video" activeClassName="active"><FaList /></NavLink>
          </li>
          <li>
            <NavLink to="/explore" activeClassName="active"><FaSearch /></NavLink>
          </li>
          <li>
            <NavLink to="/profile" activeClassName="active"><FaUser /></NavLink>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default App;
