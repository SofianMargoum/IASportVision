import React from 'react';
import SearchClub from './Explore/SearchClub';

const Explore = ({ selectedClub, selectedCompetition, onSelectClub, onCompetitionSelected }) => {
  return (
    <div>
      <SearchClub 
        selectedClub={selectedClub} 
        selectedCompetition={selectedCompetition} // Passez la compétition sélectionnée
        onSelectClub={onSelectClub}
        onCompetitionSelected={onCompetitionSelected} 
      />
    </div>
  );
};

export default Explore;
