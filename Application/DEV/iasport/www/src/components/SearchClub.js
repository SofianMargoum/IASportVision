import React, { useState } from 'react';
import './SearchClub.css';

const SearchClub = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clubs, setClubs] = useState([]);

  const handleSearch = async () => {
    const response = await fetch(`https://api-dofa.prd-aws.fff.fr/api/clubs?clNom=${searchTerm}`);
    const data = await response.json();
    const clubData = data['hydra:member'].map(club => ({
      name: club.name,
      logo: club.logo // Extraction du logo
    }));
    setClubs(clubData);
  };

  return (
    <div className="search-club-container">
      <div className="input-container">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for a club"
        />
        <button onClick={handleSearch}>Search</button>
      </div>
      <ul>
        {clubs.map((club, index) => (
          <li key={index}>
            <img src={club.logo} alt={`${club.name} logo`} />
            <span>{club.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchClub;
