import React, { useState, useEffect } from 'react';
import { searchClubs } from './api'; // Importer la fonction de recherche des clubs
import './css/SearchClub.css';

const SearchClub = ({ onSelectClub }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clubs, setClubs] = useState([]);
  const [recentClubs, setRecentClubs] = useState([]);
  const [timeoutId, setTimeoutId] = useState(null);

  const handleSearch = async () => {
    if (searchTerm.trim() === '') {
      setClubs(recentClubs);
      return;
    }

    const clubData = await searchClubs(searchTerm);
    setClubs(clubData.slice(0, 3)); // Limite les résultats à 3
  };

  useEffect(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const id = setTimeout(() => {
      handleSearch();
    }, 1000);

    setTimeoutId(id);

    return () => clearTimeout(id);
  }, [searchTerm]);

  useEffect(() => {
    const savedRecentClubs = JSON.parse(localStorage.getItem('recentClubs')) || [];
    setRecentClubs(savedRecentClubs);
  }, []);

  const updateRecentClubs = (club) => {
    const updatedClubs = [club, ...recentClubs.filter(c => c.name !== club.name)].slice(0, 5);
    setRecentClubs(updatedClubs);
    localStorage.setItem('recentClubs', JSON.stringify(updatedClubs));
  };

  const handleClubClick = (club) => {
    setSearchTerm("");
    onSelectClub(club);
    updateRecentClubs(club);
  };

  return (
    <div className="search-club-container">
	
      <div className="input-container">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un club"
        />
      </div>
      <ul>
        {clubs.length === 0 && searchTerm === '' ? (
          recentClubs.map((club, index) => (
            <li key={index} onClick={() => handleClubClick(club)}>
              <img src={club.logo} alt={`${club.name} logo`} />
              <span>{club.name}</span>
            </li>
          ))
        ) : (
          clubs.map((club, index) => (
            <li key={index} onClick={() => handleClubClick(club)}>
              <img src={club.logo} alt={`${club.name} logo`} />
              <span>{club.name}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default SearchClub;
