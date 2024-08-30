// api.js

// Fonction pour rechercher des clubs
export const searchClubs = async (searchTerm) => {
  try {
    const response = await fetch(`https://api-dofa.prd-aws.fff.fr/api/clubs?clNom=${searchTerm}`);
    const data = await response.json();
    return data['hydra:member'].map(club => ({
      name: club.name,
      logo: club.logo,
    }));
  } catch (error) {
    console.error('Error fetching clubs:', error);
    return [];
  }
};

// Fonction pour démarrer l'enregistrement
export const startRecording = async () => {
  try {
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/start-recording', {
      method: 'PUT'
    });
    if (!response.ok) {
      throw new Error('Échec du démarrage de l\'enregistrement');
    }
    return response;
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
};

// Fonction pour arrêter l'enregistrement
export const stopRecording = async () => {
  try {
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/stop-recording', {
      method: 'PUT'
    });
    if (!response.ok) {
      throw new Error('Échec de l\'arrêt de l\'enregistrement');
    }
    return response;
  } catch (error) {
    console.error('Error stopping recording:', error);
    throw error;
  }
};

// Fonction pour récupérer l'URI de lecture et la durée de la vidéo
export const getPlaybackURI = async () => {
  try {
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/search', {
      method: 'GET'
    });
    if (!response.ok) {
      throw new Error('Échec de la récupération de l\'URI de lecture');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching playback URI:', error);
    throw error;
  }
};

// Fonction pour télécharger la vidéo
export const uploadVideo = async (filename, playbackURI, directory, duration) => {
  try {
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: directory + `${filename}.mp4`,
        cameraRtspUrl: playbackURI,
        directory: directory,
        duration: duration,
      }),
    });
    if (!response.ok) {
      throw new Error('Échec du téléchargement de la vidéo');
    }
    return response;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};
