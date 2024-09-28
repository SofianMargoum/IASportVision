import React, { useState } from 'react';
import ListeVideo from './Video/ListeVideo';
import ListeVideoSidebar from './Video/ListeVideoSidebar';
import './css/Video.css';

const BackArrow = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 19l-7-7 7-7" stroke="#007bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Video = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  const handleBackClick = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="video-container">
      {/* Affichez ListeVideo si une vidéo est sélectionnée */}
      <div className={`liste-video ${selectedVideo ? 'active' : ''}`}>
        {selectedVideo && (
          <>
            <div className="video-header">
              <button className="back-button" onClick={handleBackClick}>
                <BackArrow />
                <span className="selected-video-title">{selectedVideo.name}</span>
              </button>
            </div>
            <ListeVideo selectedVideo={selectedVideo} />
          </>
        )}
      </div>

      {/* Affichez ListeVideoSidebar si aucune vidéo n'est sélectionnée */}
      <div className={`liste-video-sidebar ${!selectedVideo ? 'active' : ''}`}>
        <ListeVideoSidebar onVideoSelect={handleVideoSelect} />
      </div>
    </div>
  );
};

export default Video;
