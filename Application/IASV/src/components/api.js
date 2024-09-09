// api.js

// Fonction pour rechercher des clubs
export const searchClubs = async (searchTerm) => {
  try {
    const response = await fetch(`https://api-dofa.prd-aws.fff.fr/api/clubs?clNom=${searchTerm}`);
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
export const fetchCompetitionsForClub = async (cl_no) => {
  try {
    const response = await fetch(`https://api-dofa.prd-aws.fff.fr/api/clubs/${cl_no}/equipes`);
    const data = await response.json();

    // Extraire les noms des compétitions dont le type est "CH"
    const competitionNames = data['hydra:member'].flatMap(team =>
      team.engagements
        .filter(engagement => engagement.competition.type === "CH")
        .map(engagement => engagement.competition.name)
    );

    return competitionNames;
  } catch (error) {
    console.error('Error fetching competitions:', error);
    return [];
  }
};

export const fetchMatchesForClub = async (cl_no) => {
  try {
    const response = await fetch(`https://api-dofa.prd-aws.fff.fr/api/clubs/${cl_no}/matchs`);
    if (!response.ok) {
      throw new Error('Échec de la récupération des matchs');
    }
    const data = await response.json();

    return data['hydra:member']
      .filter(match => 
        ( match.away && match.away.short_name && match.home && match.home.short_name)
      )
      .map(match => {
        var homeCompetitionName = '';
        var awayCompetitionName = '';
         
          if(match.home && match.home.engagements ){
            for(let i = 0 ; i < match.home.engagements.length ; i++){
              homeCompetitionName = match.home.engagements[i].competition.type === 'CH' ? match.home.engagements[i].competition.name : homeCompetitionName;
            } 
          }
          if(match.away && match.away.engagements){                  
            for(let i = 0 ; i < match.away.engagements.length ;i++){
              awayCompetitionName = match.away.engagements[i].competition.type === 'CH' ? match.away.engagements[i].competition.name : awayCompetitionName;
            }
          }
          var competitionName = match.competition  ? match.competition.name :'';
        return {
          id: match['@id'].split('/').pop(), // Extraction de l'ID depuis l'URL
          date: match.date,
          time: match.time,
          home_score: match.home_score,
          away_score: match.away_score,
          season: match.competition.season, // Ajout de la saison
          homeTeam: match.home && match.home.short_name ? match.home.short_name : '', // Vérifie l'existence
          awayTeam: match.away && match.away.short_name ? match.away.short_name : '', // Vérifie l'existence
          homeLogo: match.home && match.home.club.logo ? match.home.club.logo : '', // Vérifie l'existence
          awayLogo: match.away && match.away.club.logo ? match.away.club.logo : '', // Vérifie l'existence
          competitionName, // Ajout du nom de la compétition de l'équipe à domicile
          homeCompetitionName, // Ajout du nom de la compétition de l'équipe à domicile
          awayCompetitionName, // Ajout du nom de la compétition de l'équipe à l'extérieur
        };
      });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
};
