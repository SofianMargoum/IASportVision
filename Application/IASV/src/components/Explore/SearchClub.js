import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './css/SearchClub.css';
import { debounce } from 'lodash';  // Utilisation de lodash pour le debounce
import { searchClubs, fetchCompetitionsForClub } from './../api';
import config from './../../config'; 

const SearchClub = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clubs, setClubs] = useState([]);
  const [recentClubs, setRecentClubs] = useState([]);
  const [competitionNames, setCompetitionNames] = useState([]);
  const [selectedClubName, setSelectedClubName] = useState(config.getSelectedClub()?.name || null);

  const scrollViewRef = useRef(null);
  const previousSearchTerm = useRef('');

  useEffect(() => {
    const savedRecentClubs = JSON.parse(localStorage.getItem('recentClubs')) || [];
    setRecentClubs(savedRecentClubs);
  }, []);

  useEffect(() => {
    const savedClub = config.getSelectedClub();
    if (savedClub) {
      handleClubClick(savedClub);
    }
  }, []);

  useEffect(() => {
    const savedCompetition = config.getSelectedCompetition();
    if (savedCompetition) {
      handleCompetitionClick(savedCompetition);
    }
  }, []);

  // Debounce de la recherche avec une durée plus longue
  const handleSearch = useCallback(
    debounce(async () => {
      // Vérifier la longueur du terme de recherche avant d'appeler l'API
      if (searchTerm.trim().length < 3) {
        setClubs(recentClubs);
        return;
      }
      
      // Vérification : si le terme n'a pas changé depuis l'appel précédent, on annule la recherche
      if (searchTerm === previousSearchTerm.current) {
        return;
      }
      
      previousSearchTerm.current = searchTerm; // Met à jour le terme précédent

      // Appel de l'API uniquement après que le terme ait atteint une certaine longueur
      const clubData = await searchClubs(searchTerm);

      if (clubData && searchTerm === previousSearchTerm.current) {  // Vérification supplémentaire
        setClubs(clubData.slice(0, 30));
      }
    }, 1), [searchTerm, recentClubs]
  );

  useEffect(() => {
    handleSearch();
    return () => handleSearch.cancel();  // Annuler les recherches pendantes
  }, [searchTerm, handleSearch]);

  const updateRecentClubs = useCallback((club) => {
    const updatedClubs = [club, ...recentClubs.filter(c => c.cl_no !== club.cl_no)].slice(0, 3);
    setRecentClubs(updatedClubs);
    localStorage.setItem('recentClubs', JSON.stringify(updatedClubs));
  }, [recentClubs]);

  const handleClubClick = useCallback(async (club) => {
    setSearchTerm('');
    setSelectedClubName(club.name);
    config.setSelectedClub(club);  
    updateRecentClubs(club);

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    let storedCompetitions = localStorage.getItem(`competitions_${club.cl_no}`);
    if (storedCompetitions) {
      storedCompetitions = JSON.parse(storedCompetitions);
    } else {
      storedCompetitions = await fetchCompetitionsForClub(club.cl_no);
      localStorage.setItem(`competitions_${club.cl_no}`, JSON.stringify(storedCompetitions));
    }

    setCompetitionNames(storedCompetitions);

    if (storedCompetitions.length > 0 && !config.getSelectedCompetition()) {
      handleCompetitionClick(storedCompetitions[0]);
    }
  }, [updateRecentClubs]);

  const handleCompetitionClick = useCallback((competitionName) => {
    config.setSelectedCompetition(competitionName);  

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const memoizedClubList = useMemo(() => (
    clubs.length === 0 && searchTerm === '' ? 
      recentClubs : clubs
  ), [clubs, recentClubs, searchTerm]);

  return (
    <div ref={scrollViewRef} className="search-club-container">
      
      
      <h4>Sélectionner un club</h4>
      <div className="input-container">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un club"
        />
      </div>
      <div className="suggestions">suggestions</div>
      <ul>
        {memoizedClubList.map((club) => (
          <li
            key={club.cl_no}
            onClick={() => handleClubClick(club)}
            className={club.name === selectedClubName ? 'selected' : ''}
          >
            <img src={club.logo} alt={`${club.name} logo`} />
            <span>{club.name}</span>
          </li>
        ))}
      </ul>

      {config.getSelectedClub() && (
        <div className="competition-list">
          <hr />
          <h4>Sélectionner une équipe</h4>
          <div className="suggestions">suggestions</div>
          <ul>
            {competitionNames.length === 0 ? (
              <li>Aucune compétition trouvée</li>
            ) : (
              competitionNames.map((name, index) => (
                <li 
                  key={index} 
                  onClick={() => handleCompetitionClick(name)}
                  className={name === config.getSelectedCompetition() ? 'selected' : ''}
                >
                  {name}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchClub);
