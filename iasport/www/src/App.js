// App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { FaVideo, FaSearch, FaList, FaUser, FaMedal } from 'react-icons/fa'; // Importez les icônes nécessaires
import Home from './components/Home';
import Explore from './components/Explore';
import Notifications from './components/Notifications';
import Messages from './components/Messages';
import Profile from './components/Profile';
import './App.css'; // Importez votre fichier CSS ici

const App = () => {
  return (
    <Router>
      <div className="App">
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>

        <nav className="navbar">
          <ul>
            <li>
              <NavLink exact to="/" activeClassName="active"><FaVideo /></NavLink>
            </li>
            <li>
              <NavLink to="/messages" activeClassName="active"><FaMedal /></NavLink>
            </li>
            <li>
              <NavLink to="/notifications" activeClassName="active"><FaList /></NavLink>
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
    </Router>
  );
};

export default App;
