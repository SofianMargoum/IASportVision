import React from 'react';
import ListeVideo from './ListeVideo';

const Video = ({ selectedClub }) => {
  return (
    <div>
      <h1>Video</h1>
      <ListeVideo selectedClub={selectedClub} />
    </div>
  );
};

export default Video;
