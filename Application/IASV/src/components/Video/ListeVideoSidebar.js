import React, { useState, useEffect } from 'react';
import './css/ListeVideoSidebar.css';
import { getSelectedClub } from './../../config';

// Fonction pour reformater la date si nécessaire (exemple si la date est au format "dd/MM/yyyy")
const parseDate = (dateString) => {
  // Essayez de créer un objet Date avec le format ISO si c'est déjà dans ce format
  const date = new Date(dateString);

  if (isNaN(date)) {
    // Si ce n'est pas un format compatible, essayez de le parser manuellement
    const parts = dateString.split('/');
    // Vérifiez si c'est un format "dd/MM/yyyy"
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Mois dans Date commence à 0
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }

  return date;
};

const ListeVideoSidebar = ({ onVideoSelect }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

        // Tri des vidéos par date de création (la plus récente en premier)
        const sortedVideos = (data.videos || []).sort((a, b) => parseDate(b.creationDate) - parseDate(a.creationDate));

        setVideos(sortedVideos);
        setSelectedVideo(sortedVideos[0] || null);

        // Sélectionner la première vidéo
        if (sortedVideos.length > 0) {
          onVideoSelect(sortedVideos[0]); 
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
              Tous les matchs
            </div>
            {videos.length > 0 ? (
              videos.map((video, index) => (
                <li
                  key={index}
                  className={`liste-video-title ${selectedVideo === video ? 'selected' : ''}`}
                  onClick={() => handleVideoSelect(video)}
                >
                  <img src="/ImageDeConverture.jpg" width="64" height="36" alt="Vidéo de couverture" />
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
