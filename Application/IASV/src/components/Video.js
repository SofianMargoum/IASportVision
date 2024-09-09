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
  // Créez un état pour la vidéo sélectionnée
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Fonction pour mettre à jour la vidéo sélectionnée
  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  // Fonction pour revenir à la liste des vidéos
  const handleBackClick = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="video-container">
      {/* Affichez ListeVideoSidebar si aucune vidéo n'est sélectionnée */}
      <div className={`liste-video-sidebar ${!selectedVideo ? 'active' : ''}`}>
        <ListeVideoSidebar onVideoSelect={handleVideoSelect} />
      </div>
      
      {/* Affichez ListeVideo si une vidéo est sélectionnée */}
      <div className={`liste-video ${selectedVideo ? 'active' : ''}`}>
        {selectedVideo && (
          <>
            <div className="video-header">
              <button className="back-button" onClick={handleBackClick}>
                <BackArrow />
                {/* Ajoutez ici le titre de la vidéo à côté du bouton back */}
                <span className="selected-video-title">{selectedVideo.name}</span>
              </button>
            </div>
            <ListeVideo selectedVideo={selectedVideo} />
          </>
        )}
      </div>
    </div>
  );
};

export default Video;
