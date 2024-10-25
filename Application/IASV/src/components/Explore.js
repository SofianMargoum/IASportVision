import React from 'react';
import SearchClub from './Explore/SearchClub';
import './css/Explore.css'; // N'oubliez pas d'importer le fichier CSS

const Explore = ({ selectedClub, selectedCompetition, onSelectClub, onCompetitionSelected }) => {
  return (
    <div className="scrollable-div"> {/* Appliquer la classe CSS ici */}
      <SearchClub 
        selectedClub={selectedClub} 
        selectedCompetition={selectedCompetition} 
        onSelectClub={onSelectClub}
        onCompetitionSelected={onCompetitionSelected} 
      />
    </div>
  );
};

export default Explore;
