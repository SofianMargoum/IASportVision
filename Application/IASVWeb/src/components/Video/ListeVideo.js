import React, { useState } from 'react';
import './css/ListeVideo.css';

const ListeVideo = ({ selectedVideo, resumeVideoUrl }) => {
  const [activeTab, setActiveTab] = useState('VIDEO');
  const [shareVisible, setShareVisible] = useState(false);

  const handleSave = () => {
    console.log("Données enregistrées !");
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = 'URL_DU_FICHIER_A_TELECHARGER'; // Remplacez par l'URL de votre fichier
    link.download = 'NOM_DU_FICHIER.extension'; // Remplacez par le nom souhaité du fichier
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleShareButtons = () => {
    setShareVisible((prev) => !prev);
  };

  // Fonction pour partager sur un réseau social
  const shareOnSocialMedia = (platform) => {
    let urlToShare;
    if (activeTab === 'VIDEO' && selectedVideo) {
        urlToShare = selectedVideo.url; // URL de la vidéo sélectionnée
    } else if (activeTab === 'RESUME') {
        urlToShare = resumeVideoUrl; // URL de la vidéo de résumé
    }

    // Assurez-vous que l'URL à partager est valide
    if (!urlToShare) {
        alert("Aucune vidéo disponible à partager.");
        return;
    }

    // Utiliser un encodeURIComponent pour s'assurer que l'URL est correctement formatée
    const encodedUrl = encodeURIComponent(urlToShare);

    switch (platform) {
        case 'facebook':
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
            break;
        case 'instagram':
            alert("Instagram ne prend pas en charge le partage direct via un lien. Vous pouvez copier l'URL et la partager manuellement.");
            break;
        case 'tiktok':
            // Le partage sur TikTok peut être complexe; il est souvent plus facile de partager un lien vers une vidéo existante
            window.open(`https://www.tiktok.com/share/video?url=${encodedUrl}`, '_blank');
            break;
        case 'youtube':
            // Il n'existe pas de méthode de partage directe comme pour Facebook. On peut encourager l'utilisateur à le faire manuellement
            alert("Pour partager sur YouTube, copiez l'URL et partagez-la manuellement.");
            break;
        default:
            break;
    }
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
              <div className="video-and-share-container">
                <video
                  className="liste-video-content-video"
                  src={selectedVideo.url}
                  poster="/ImageDeConverture-c.jpg"
                  controls
                >
                  <p>
                    Votre navigateur ne supporte pas la vidéo HTML5. Voici un{' '}
                    <a href={selectedVideo.url}>lien vers la vidéo</a> à la place.
                  </p>
                </video>

                <div className="share-buttons-container">
                  <table>
                    <tbody>
                      <tr>
                        <td><button className="option-button" onClick={handleSave}>
                          <i className="fa-regular fa-eye"></i>
                        </button></td>
                      </tr>
                      <tr>
                        <td><button className="option-button" onClick={handleSave}>
                          <i className="fa-regular fa-bookmark"></i>
                        </button></td>
                      </tr>
                      <tr>
                        <td><button className="option-button" onClick={handleDownload}>
                          <i className="fas fa-download"></i>
                        </button></td>
                      </tr>
                      <tr>
                        <td><button className="option-button" onClick={toggleShareButtons}>
                          <i className="fas fa-share-alt"></i>
                        </button></td>
                        <td>
                          <div className='divshare'>
                            <div className={`social-media-buttons ${shareVisible ? 'social-media-visible' : ''}`}>
                              <button className="facebook-button" onClick={() => shareOnSocialMedia('facebook')}>
                                <i className="fab fa-facebook-f"></i>
                              </button>
                              <button className="instagram-button" onClick={() => shareOnSocialMedia('instagram')}>
                                <i className="fab fa-instagram"></i>
                              </button>
                              <button className="tiktok-button" onClick={() => shareOnSocialMedia('tiktok')}>
                                <i className="fab fa-tiktok"></i>
                              </button>
                              <button className="youtube-button" onClick={() => shareOnSocialMedia('youtube')}>
                                <i className="fab fa-youtube"></i>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'RESUME' ? (
              <div className="video-and-share-container">
                <video
                  className="liste-video-content-video"
                  src={resumeVideoUrl}
                  poster="/ImageDeConverture-r.jpg"
                  controls
                >
                  <p>
                    Votre navigateur ne supporte pas la vidéo HTML5. Voici un{' '}
                    <a href={resumeVideoUrl}>lien vers la vidéo</a> à la place.
                  </p>
                </video>

                <div className="share-buttons-container">
                  <table>
                    <tbody>
                      <tr>
                        <td><button className="option-button" onClick={handleSave}>
                          <i className="fa-regular fa-eye"></i>
                        </button></td>
                      </tr>
                      <tr>
                        <td><button className="option-button" onClick={handleSave}>
                          <i className="fa-regular fa-bookmark"></i>
                        </button></td>
                      </tr>
                      <tr>
                        <td><button className="option-button" onClick={handleDownload}>
                          <i className="fas fa-download"></i>
                        </button></td>
                      </tr>
                      <tr>
                        <td><button className="option-button" onClick={toggleShareButtons}>
                          <i className="fas fa-share-alt"></i>
                        </button></td>
                        <td>
                          <div className='divshare'>
                            <div className={`social-media-buttons ${shareVisible ? 'social-media-visible' : ''}`}>
                              <button className="facebook-button" onClick={() => shareOnSocialMedia('facebook')}>
                                <i className="fab fa-facebook-f"></i>
                              </button>
                              <button className="instagram-button" onClick={() => shareOnSocialMedia('instagram')}>
                                <i className="fab fa-instagram"></i>
                              </button>
                              <button className="tiktok-button" onClick={() => shareOnSocialMedia('tiktok')}>
                                <i className="fab fa-tiktok"></i>
                              </button>
                              <button className="youtube-button" onClick={() => shareOnSocialMedia('youtube')}>
                                <i className="fab fa-youtube"></i>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'STATSEQUIPES' ? (
              <div className="video-comments">
                <img src="/stat equipe.jpg" alt="Stats Équipes" className="stats-equipe-image" />
              </div>
            ) : activeTab === 'STATSJOUEURS' ? (
              <div className="video-others">
                <img src="/stat joueur.jpg" alt="Stats Joueurs" className="stats-equipe-image" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListeVideo;
