import React from 'react';
import SearchClub from './SearchClub';

const Explore = ({ onSelectClub, selectedClub }) => {
  return (
    <div>
      <SearchClub onSelectClub={onSelectClub} />
    </div>
  );
};

export default Explore;
