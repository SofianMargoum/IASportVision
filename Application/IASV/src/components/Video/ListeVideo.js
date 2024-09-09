import React, { useState } from 'react';
import './css/ListeVideo.css';

const ListeVideo = ({ selectedVideo }) => {
  const [activeTab, setActiveTab] = useState('VIDEO');

  const handleClick = (event) => {
    const videoElement = event.target;
    if (videoElement.paused) {
      videoElement.play();
    } else {
      videoElement.pause();
    }
  };

  const handleDoubleClick = (event) => {
    const videoElement = event.target;

    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen();
    } else if (videoElement.mozRequestFullScreen) {
      videoElement.mozRequestFullScreen();
    } else if (videoElement.webkitRequestFullscreen) {
      videoElement.webkitRequestFullscreen();
    } else if (videoElement.msRequestFullscreen) {
      videoElement.msRequestFullscreen();
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="liste-video-container">   
      <div className="liste-video-wrapper">    
        <div className="liste-video-content">
          <nav className="tabs">
            <button
              className={activeTab === 'VIDEO' ? 'active' : ''}
              onClick={() => handleTabClick('VIDEO')}
            >
              Vidéo
            </button>
            <button
              className={activeTab === 'RESUME' ? 'active' : ''}
              onClick={() => handleTabClick('RESUME')}
            >
              Résumé
            </button>
            <button
              className={activeTab === 'STATSEQUIPES' ? 'active' : ''}
              onClick={() => handleTabClick('STATSEQUIPES')}
            >
              Stats Équipes
            </button>
            <button
              className={activeTab === 'STATSJOUEURS' ? 'active' : ''}
              onClick={() => handleTabClick('STATSJOUEURS')}
            >
              Stats Joueurs
            </button>
          </nav>

          <div className="tab-content">
            {activeTab === 'VIDEO' && selectedVideo ? (
              <video
                className="liste-video-content-video"
                src={selectedVideo.url}
                poster="/ImageDeConverture.jpg" 
                controls
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
              >
                <p>
                  Votre navigateur ne supporte pas la vidéo HTML5. Voici un{' '}
                  <a href={selectedVideo.url}>lien vers la vidéo</a> à la place.
                </p>
              </video>
            ) : activeTab === 'RESUME' ? (
              <div className="video-resume">
                <h3>Résumé</h3>
                <p>{selectedVideo ? selectedVideo.resume : 'Aucune résumé disponible'}</p>
              </div>
            ) : activeTab === 'STATSEQUIPES' ? (
              <div className="video-comments">
                <h3>Stats Équipes</h3>
                <p>Stats Équipes ici...</p>
              </div>
            ) : activeTab === 'STATSJOUEURS' ? (
              <div className="video-others">
                <h3>Stats Joueurs</h3>
                <p>Stats Joueurs ici...</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListeVideo;
