// api.js
// Fonction pour envoyer l'idToken au backend pour vérification
export const sendIdTokenToBackend = async (idToken) => {
  try {
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }), // Envoie le idToken au backend
    });

    if (!response.ok) {
      throw new Error('Échec de la vérification du token');
    }

    const data = await response.json();
    return data; // Réponse avec les informations de l'utilisateur
  } catch (error) {
    console.error('Error verifying Google token:', error);
    throw error;
  }
};

// Fonction pour appeler l'API de fusion d'images
export const mergeImages = async ({ logo1Url, logo2Url, finalFolder, finalName }) => {
  try {
    const queryParams = new URLSearchParams({
      logo1Url,
      logo2Url,
      finalFolder,
      ...(finalName && { finalName }), // Ajoute finalName seulement s'il est défini
    });

    const url = `https://ia-sport.oa.r.appspot.com//api/mergeImages?${queryParams.toString()}`;
    console.log('Fetching URL:', url); // Log de l'URL complète de la requête

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('Response status:', response.status); // Log du statut de la réponse
    console.log('Response headers:', response.headers); // Log des en-têtes de la réponse

    if (!response.ok) {
      const errorText = await response.text(); // Lire le texte d'erreur renvoyé par le serveur
      console.error('Server error response:', errorText);
      throw new Error('Échec de la fusion des images');
    }

    const data = await response.json();
    console.log('Response data:', data); // Log des données reçues
    return data; // Réponse avec l'URL de l'image fusionnée
  } catch (error) {
    console.error('Error merging images:', error.message, error.stack);
    throw error;
  }
};


// Fonction pour rechercher l'device
export const fetchDevice = async (nom) => {
  try {
    const queryParams = new URLSearchParams({
      ...(nom && { nom }), // Ajoute nom seulement s'il est défini
    });

    const url = `https://ia-sport.oa.r.appspot.com/api/device?${queryParams.toString()}`;
    console.log('Fetching URL:', url); // Log de l'URL complète de la requête

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('Response status:', response.status); // Log du statut de la réponse
    console.log('Response headers:', response.headers); // Log des en-têtes de la réponse

    if (!response.ok) {
      const errorText = await response.text(); // Lire le texte d'erreur renvoyé par le serveur
      console.error('Server error response:', errorText);
      throw new Error('Échec de la récupération de l\'device');
    }

    const data = await response.json();
    console.log('Response data:', data); // Log des données reçues
    return data; // Retourne les données de l'effectif
  } catch (error) {
    console.error('Error fetching device:', error.message, error.stack);
    throw error;
  }
};
// Fonction pour rechercher l'effectif
export const fetchEffectif = async (nom) => {
  try {
    const queryParams = new URLSearchParams({
      ...(nom && { nom }), // Ajoute nom seulement s'il est défini
    });

    const url = `https://ia-sport.oa.r.appspot.com/api/effectif?${queryParams.toString()}`;
    console.log('Fetching URL:', url); // Log de l'URL complète de la requête

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('Response status:', response.status); // Log du statut de la réponse
    console.log('Response headers:', response.headers); // Log des en-têtes de la réponse

    if (!response.ok) {
      const errorText = await response.text(); // Lire le texte d'erreur renvoyé par le serveur
      console.error('Server error response:', errorText);
      throw new Error('Échec de la récupération de l\'effectif');
    }

    const data = await response.json();
    console.log('Response data:', data); // Log des données reçues
    return data; // Retourne les données de l'effectif
  } catch (error) {
    console.error('Error fetching effectif:', error.message, error.stack);
    throw error;
  }
};
// Fonction pour ajouter un joueur à l'effectif
export const inputEffectif = async ({ nom, equipe, joueur }) => {
  try {
    const url = 'https://ia-sport.oa.r.appspot.com/api/inputEffectif'; // Remplacez par l'URL de votre API

    // Log des données envoyées
    console.log('Sending data to URL:', url);
    console.log('Data to send:', { nom, equipe, joueur });

    const response = await fetch(url, {
      method: 'POST', // Méthode POST pour ajouter un joueur
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nom, equipe, joueur }), // Conversion des données en JSON
    });

    // Logs pour débogage
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text(); // Lire le texte d'erreur renvoyé par le serveur
      console.error('Server error response:', errorText);
      throw new Error('Échec de l\'ajout du joueur');
    }

    const data = await response.json();
    console.log('Response data:', data); // Log des données reçues
    return data; // Retourne les données du joueur ajouté
  } catch (error) {
    console.error('Error adding player:', error.message, error.stack);
    throw error;
  }
};


// Fonction pour rechercher des clubs
export const searchClubs = async (searchTerm) => {
  try {
    const response = await fetch(`https://api-dofa.fff.fr/api/clubs?clNom=${searchTerm}`);
    const data = await response.json();
    return data['hydra:member'].map(club => ({
      name: club.name,
      logo: club.logo,
      cl_no: club.cl_no,
    }));
  } catch (error) {
    console.error('Error fetching clubs:', error);
    return [];
  }
};


// Fonction pour démarrer l'enregistrement
export const startRecording = async ({ username, password, ipAddress, port }) => {
  try {
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/start-recording', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, ipAddress, port }),
    });

    if (!response.ok) {
      throw new Error('Échec du démarrage de l\'enregistrement');
    }
    return response.json(); // Parse la réponse si nécessaire
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
};

// Fonction pour arrêter l'enregistrement
export const stopRecording = async ({ username, password, ipAddress, port }) => {
  try {
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/stop-recording', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, ipAddress, port }),
    });

    if (!response.ok) {
      throw new Error('Échec de l\'arrêt de l\'enregistrement');
    }
    return response.json(); // Parse la réponse si nécessaire
  } catch (error) {
    console.error('Error stopping recording:', error);
    throw error;
  }
};


// Fonction pour récupérer l'URI de lecture et la durée de la vidéo
export const getPlaybackURI = async ({ username, password, ipAddress, port }) => {
  try {
    // Effectuer la requête POST avec les paramètres dans le corps
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, ipAddress, port }),
    });

    if (!response.ok) {
      throw new Error('Échec de la récupération de l\'URI de lecture');
    }

    return await response.json(); // Parse la réponse en JSON
  } catch (error) {
    console.error('Error fetching playback URI:', error);
    throw error;
  }
};



// Fonction pour télécharger la vidéo
export const uploadVideo = async (filename, playbackURI, directory, duration) => {
  // Ajout d'un log pour afficher les paramètres
  console.log('Paramètres reçus :', {
    filename: directory + ` ${filename}.mp4`,
    cameraRtspUrl: playbackURI,
    directory: directory,
    duration: duration,
  });

  try {
    const response = await fetch('https://ia-sport.oa.r.appspot.com/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: directory + ` ${filename}.mp4`,
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

export const fetchCompetitionsForClub = async (cl_no) => {
  try {
    const response = await fetch(`https://api-dofa.fff.fr/api/clubs/${cl_no}/equipes`);
    const data = await response.json();

    // Extraire les informations des compétitions avec les détails supplémentaires
    const competitionDetails = data['hydra:member'].flatMap(team =>
      team.engagements
        .filter(engagement => engagement.competition.type === "CH")
        .map(engagement => ({
          competitionName: engagement.competition.name,
          cp_no: engagement.competition.cp_no,
          phaseNumber: engagement.phase?.number || null, // Vérifie si phase existe
          stageNumber: engagement.poule?.stage_number || null, // Vérifie si poule existe
        }))
    );

    return competitionDetails;
  } catch (error) {
    console.error('Error fetching competitions:', error);
    return [];
  }
};


export const fetchMatchesForClub = async ( cp_no, phaseId, pouleId, cl_no) => {
  try {
    const response = await fetch(`https://api-dofa.fff.fr/api/compets/${cp_no}/phases/${phaseId}/poules/${pouleId}/matchs?clNo=${cl_no}`);
    if (!response.ok) {
      throw new Error('Échec de la récupération des matchs');
    }
    const data = await response.json();

    return data['hydra:member'].map(match => {
      let homeCompetitionName = '';
      let awayCompetitionName = '';

      if (match.home && match.home.engagements) {
        for (let engagement of match.home.engagements) {
          homeCompetitionName = engagement.competition.name;
        }
      }

      if (match.away && match.away.engagements) {
        for (let engagement of match.away.engagements) {
          awayCompetitionName = engagement.competition.name;
        }
      }

      const competitionName = match.competition ? match.competition.name : '';
      const competitionNumber = match.competition ? match.competition.cp_no : '';
      const phaseNumber = match.phase ? match.phase.number : '';
      const pouleNumber = match.poule ? match.poule.stage_number : '';

      return {
        id: match['@id'].split('/').pop(), // Extraction de l'ID depuis l'URL
        date: match.date,
        time: match.time,
        home_score: match.home_score,
        away_score: match.away_score,
        season: match.competition ? match.competition.season : null, // Ajout de la saison
        homeTeam: match.home ? match.home.short_name : '',
        awayTeam: match.away ? match.away.short_name : '',
        homeLogo: match.home && match.home.club ? match.home.club.logo : '',
        awayLogo: match.away && match.away.club ? match.away.club.logo : '',
        competitionName,
        competitionNumber,
        phaseNumber,
        pouleNumber,
        homeCompetitionName,
        awayCompetitionName,
        venue: match.terrain ? `${match.terrain.name}, ${match.terrain.city}` : '',
      };
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
};



// Fonction pour récupérer le classement des journées pour une poule spécifique
export const fetchMatcheForClub = async (cl_no, competitionId, phaseId, pouleId) => {
  try {
    const response = await fetch(`https://api-dofa.fff.fr/api/compets/${competitionId}/phases/${phaseId}/poules/${pouleId}/matchs?clNo=${cl_no}`);
    if (!response.ok) {
      throw new Error('Échec de la récupération du classement des journées');
    }
    const data = await response.json();

    return data['hydra:member'].map(journee => ({
      journeeNumber: journee.cj_no,
      season: journee.season,
      date: journee.date,
      rank: journee.rank,
      points: journee.point_count,
      penaltyPoints: journee.penalty_point_count,
      wonGames: journee.won_games_count,
      drawGames: journee.draw_games_count,
      lostGames: journee.lost_games_count,
      forfeits: journee.forfeits_games_count,
      goalsFor: journee.goals_for_count,
      goalsAgainst: journee.goals_against_count,
      goalDifference: journee.goals_diff,
      totalGames: journee.total_games_count,
      teamName: journee.equipe.short_name,
      teamCategory: journee.equipe.category_label,
      teamGender: journee.equipe.category_gender,
      pouleName: journee.poule.name,
      stageNumber: journee.poule.stage_number,
    }));
  } catch (error) {
    console.error('Error fetching classement journées:', error);
    return [];
  }
};


// Fonction pour récupérer le classement des journées pour une poule spécifique
export const fetchClassementJournees = async (competitionId, phaseId, pouleId) => {
  try {
    const response = await fetch(`https://api-dofa.fff.fr/api/compets/${competitionId}/phases/${phaseId}/poules/${pouleId}/classement_journees`);
    if (!response.ok) {
      throw new Error('Échec de la récupération du classement des journées');
    }
    const data = await response.json();

    return data['hydra:member'].map(journee => ({
      journeeNumber: journee.cj_no,
      season: journee.season,
      date: journee.date,
      rank: journee.rank,
      points: journee.point_count,
      penaltyPoints: journee.penalty_point_count,
      wonGames: journee.won_games_count,
      drawGames: journee.draw_games_count,
      lostGames: journee.lost_games_count,
      forfeits: journee.forfeits_games_count,
      goalsFor: journee.goals_for_count,
      goalsAgainst: journee.goals_against_count,
      goalDifference: journee.goals_diff,
      totalGames: journee.total_games_count,
      teamName: journee.equipe.short_name,
      teamCategory: journee.equipe.category_label,
      teamGender: journee.equipe.category_gender,
      pouleName: journee.poule.name,
      stageNumber: journee.poule.stage_number,
    }));
  } catch (error) {
    console.error('Error fetching classement journées:', error);
    return [];
  }
};
