import React, { useState, useEffect } from 'react';
import './css/ListeVideoSidebar.css';
import { getSelectedClub } from './../../config';

const ListeVideoSidebar = ({ onVideoSelect }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Supprimez useCallback pour le moment pour voir si cela améliore les choses
  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    const club = getSelectedClub();
    console.log('Selected Club:', club); // Vérifiez si un club est bien sélectionné
    const folder = club ? club.name : '';
    console.log('Club folder:', folder);

    if (folder) {
      const url = `https://ia-sport.oa.r.appspot.com/api/videos?folder=${encodeURIComponent(folder)}`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des vidéos');
        }

        const data = await response.json();
        console.log('API Data:', data);

        setVideos(data.videos || []);
        setSelectedVideo(data.videos[0] || null);

        // Sélectionner la première vidéo
        if (data.videos.length > 0) {
          onVideoSelect(data.videos[0]); 
        }
      } catch (error) {
        console.error("Erreur lors de la recherche des vidéos:", error);
        setError('Impossible de charger les vidéos. Veuillez réessayer plus tard.');
      } finally {
        setLoading(false);
      }
    } else {
      setVideos([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch(); // Appel direct sans useCallback
  }, []); // Aucun tableau de dépendance pour simplifier le flux

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    onVideoSelect(video); // Passer la vidéo sélectionnée au parent
  };

  return (
    <div className="liste-videoSidebar-container">
      {loading && <div className="loader">Chargement...</div>}
      {error && <div className="error-message">{error}</div>}
      {!loading && !error && (
        <div className="liste-videoSidebar-wrapper">
          <ul className="liste-videoSidebar-titles">
          <div className="liste-videoSidebar-titles-header">
          Toutes les matchs
          </div>
    
            {videos.length > 0 ? (
              videos.map((video, index) => (
                
                <li
                  key={index}
                  className={`liste-video-title ${selectedVideo === video ? 'selected' : ''}`}
                  onClick={() => handleVideoSelect(video)}
                >
                <img src="/ImageDeConverture.jpg" width="64" height="36"></img>
                
                <div className="liste-videoSidebar-title">
                <div className="liste-videoSidebar-title-creationDate">
                  {video.creationDate}
                  </div>
                <div className="liste-videoSidebar-title-name">
                {video.name}
                  </div>
                </div>
                </li>
              ))
            ) : (
              <p className="no-videos">Aucune vidéo disponible</p>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ListeVideoSidebar;
