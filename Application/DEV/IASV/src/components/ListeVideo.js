import React, { useState, useEffect } from 'react';
import './css/ListeVideo.css';

const ListeVideo = ({ selectedClub }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fonction pour rechercher les vidéos
  const handleSearch = async () => {
    setLoading(true);
    const folder = selectedClub ? selectedClub.name : ''; // Utilisation de selectedClub
    const url = `https://ia-sport.oa.r.appspot.com/api/videos?folder=${encodeURIComponent(folder)}`;

    if (folder) {
      try {
        const response = await fetch(url);
        const data = await response.json();
        setVideos(data.videos || []); // Assurez-vous que data.videos existe
      } catch (error) {
        console.error("Erreur lors de la recherche des vidéos:", error);
        setVideos([]); // En cas d'erreur, vider les vidéos
      } finally {
        setLoading(false);
      }
    } else {
      // Si aucun club sélectionné, vider la liste des vidéos
      setVideos([]);
      setLoading(false);
    }
  };

  // Utiliser useEffect pour appeler handleSearch chaque fois que selectedClub change
  useEffect(() => {
    handleSearch();
  }, [selectedClub]);

  const handleDoubleClick = (event) => {
    const videoElement = event.target;

    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen();
    } else if (videoElement.mozRequestFullScreen) { // Firefox
      videoElement.mozRequestFullScreen();
    } else if (videoElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
      videoElement.webkitRequestFullscreen();
    } else if (videoElement.msRequestFullscreen) { // IE/Edge
      videoElement.msRequestFullscreen();
    }
  };

  const handleClick = (event) => {
    const videoElement = event.target;
    if (videoElement.paused) {
      videoElement.play();
    } else {
      videoElement.pause();
    }
  };

  return (
    <div className="liste-video-container">
      <ul className="liste-video-ul">
        {videos.length > 0 ? (
          videos.map((video, index) => (
            <li key={index} className="liste-video-li">
              <video 
                className="liste-video-video" 
                src={video.url} 
                controls
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
              >
                <p>Your browser doesn't support HTML5 video. Here is a <a href={video.url}>link to the video</a> instead.</p>
              </video>
              <div className="liste-video-overlay">{video.name}</div>
            </li>
          ))
        ) : (
          <p></p>
        )}
      </ul>
    </div>
  );
};

export default ListeVideo;
