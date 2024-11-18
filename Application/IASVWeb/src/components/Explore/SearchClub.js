import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './css/SearchClub.css';
import { debounce } from 'lodash';
import { searchClubs, fetchCompetitionsForClub } from './../api';
import config from './../../config';  // Importer le fichier config

const SearchClub = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clubs, setClubs] = useState([]);
  const [recentClubs, setRecentClubs] = useState([]);
  const [competitionNames, setCompetitionNames] = useState([]);
  const [selectedClubName, setSelectedClubName] = useState(null); // Initialiser à null pour éviter la sélection automatique

  const scrollViewRef = useRef(null);
  const previousSearchTerm = useRef('');

  // Charger les clubs récents depuis config
  useEffect(() => {
    const savedRecentClubs = config.getRecentClubs();
    setRecentClubs(savedRecentClubs);
    
    // Si aucun terme de recherche n'est entré, afficher les clubs récents
    if (searchTerm.trim().length === 0) {
      setClubs(savedRecentClubs);
    }
  }, [searchTerm]);

  // Supprimez l'appel à handleClubClick pour éviter la sélection automatique
  useEffect(() => {
    // Ne rien faire ici pour la sélection automatique
  }, []);

  useEffect(() => {
    const savedCompetition = config.getSelectedCompetition();
    if (savedCompetition) {
      handleCompetitionClick(savedCompetition);
    }
  }, []);

  // Fonction pour gérer la sélection d'une compétition
  const handleCompetitionClick = useCallback((competitionName) => {
    config.setSelectedCompetition(competitionName);

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleSearch = useCallback(
    debounce(async () => {
      if (searchTerm.trim().length < 3) {
        setClubs(recentClubs);  // Si le terme de recherche est trop court, on affiche les clubs récents
        return;
      }

      if (searchTerm === previousSearchTerm.current) {
        return;
      }

      previousSearchTerm.current = searchTerm;
      const clubData = await searchClubs(searchTerm);

      if (clubData && searchTerm === previousSearchTerm.current) {
        setClubs(clubData.slice(0, 30));
      }
    }, 300), // Débouncer avec 300ms pour une meilleure expérience utilisateur
    [searchTerm, recentClubs]
  );

  useEffect(() => {
    handleSearch();
    return () => handleSearch.cancel();
  }, [searchTerm, handleSearch]);

  const handleClubClick = useCallback(async (club) => {
    setSearchTerm('');
    setSelectedClubName(club.name);
    config.setSelectedClub(club);  // Utilise config pour gérer le club sélectionné

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

    // Sélectionner automatiquement la première compétition si disponible
    if (storedCompetitions.length > 0) {
      handleCompetitionClick(storedCompetitions[0]);  // Sélectionner la première compétition
    }
  }, [handleCompetitionClick]);

  const memoizedClubList = useMemo(() => {
    return searchTerm.trim().length === 0 ? recentClubs : clubs;
  }, [clubs, recentClubs, searchTerm]);

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

      {config.getSelectedClub() && competitionNames.length > 0 && ( // Condition pour afficher la liste des compétitions seulement si des compétitions existent
        <div className="competition-list">
          <hr />
          <h4>Sélectionner une équipe</h4>
          <div className="suggestions">suggestions</div>
          <ul>
            {competitionNames.map((name, index) => (
              <li 
                key={index} 
                onClick={() => handleCompetitionClick(name)}
                className={name === config.getSelectedCompetition() ? 'selected' : ''}
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchClub);
