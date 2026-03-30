// --- API HikConnect ---

const API_BASE = 'https://ia-sport.oa.r.appspot.com/api';

/**
 * Source unique de vérité :
 * retourne toutes les caméras avec leurs infos device, area, channel, etc.
 */
export const fetchAllCameras = async () => {
  const resp = await fetch(`${API_BASE}/hikconnect/cameras`);

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return resp.json();
};

export async function saveLastRecording({
  deviceId,
  cameraId,
  beginTime,
  endTime,
  voiceSwitch = 0,
  offset,
}) {
  const body = {
    deviceId,
    cameraId,
    voiceSwitch,
    ...(typeof offset === 'string' && offset ? { offset } : {}),
    ...(beginTime ? { beginTime } : {}),
    ...(endTime ? { endTime } : {}),
  };

  const resp = await fetch(`${API_BASE}/hikconnect/video/save-last-from-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));

  // HTTP error
  if (!resp.ok) {
    const err = new Error(data?.message || `HTTP ${resp.status}`);
    err.status = resp.status;
    err.details = data?.details ?? data;
    throw err;
  }

  // Business error (même si HTTP 200)
  if (data?.errorCode && data.errorCode !== '0') {
    const err = new Error(data?.message || `Hik errorCode=${data.errorCode}`);
    err.status = 502;
    err.details = data;
    throw err;
  }

  // Certains retours d’erreur sont "emballés" en {message, details:{errorCode,...}}
  if (data?.message && data?.details?.errorCode) {
    const err = new Error(data.message);
    err.status = 502;
    err.details = data.details;
    throw err;
  }

  return data;
}

/**
 * Upload vidéo depuis une URL HTTP(S) (ex: URL S3 signée HikConnect) vers GCS.
 *
 * Backend: POST /api/upload-from-url
 * Body:
 * {
 *   sourceUrl: "https://....mp4?X-Amz-....",
 *   directory: "F.C. VIDAUBAN",
 *   filename: "F.C. VIDAUBAN 0 - 0 U.S. LUCOISE.mp4",
 *   contentType: "video/mp4" // optionnel
 * }
 */
export async function uploadFromUrl({
  sourceUrl,
  directory,
  filename,
  contentType = 'video/mp4',
}) {
  const body = {
    sourceUrl,
    directory,
    filename,
    ...(contentType ? { contentType } : {}),
  };

  const resp = await fetch(`${API_BASE}/upload-from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const err = new Error(data?.message || `HTTP ${resp.status}`);
    err.status = resp.status;
    err.details = data?.details ?? data;
    throw err;
  }

  // Contrat route: {status:'success', ...} sinon {status:'error', ...}
  if (data?.status && data.status !== 'success') {
    const err = new Error(data?.message || 'Upload-from-url failed');
    err.status = 502;
    err.details = data;
    throw err;
  }

  return data;
}




// Démarrer l'enregistrement côté device HikConnect
export async function hikStartRecording({ deviceId }) {
  if (!deviceId) throw new Error('Missing deviceId');

  const resp = await fetch(`${API_BASE}/hikconnect/start-recording`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const err = new Error(data?.message || `HTTP ${resp.status}`);
    err.status = resp.status;
    err.details = data?.details ?? data;
    throw err;
  }

  // au cas où Hik répondrait errorCode != '0' dans un 200
  if (data?.errorCode && data.errorCode !== '0') {
    const err = new Error(data?.message || `Hik errorCode=${data.errorCode}`);
    err.status = 502;
    err.details = data;
    throw err;
  }

  return data;
}

// Arrêter l'enregistrement côté device HikConnect
export async function hikStopRecording({ deviceId }) {
  if (!deviceId) throw new Error('Missing deviceId');

  const resp = await fetch(`${API_BASE}/hikconnect/stop-recording`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const err = new Error(data?.message || `HTTP ${resp.status}`);
    err.status = resp.status;
    err.details = data?.details ?? data;
    throw err;
  }

  if (data?.errorCode && data.errorCode !== '0') {
    const err = new Error(data?.message || `Hik errorCode=${data.errorCode}`);
    err.status = 502;
    err.details = data;
    throw err;
  }

  return data;
}
export const uploadZoomMapToApi = async (zoomMapExport, filename) => {
  if (!filename) {
    console.error('❌ filename est requis pour uploadZoomMapToApi');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/uploadZoomMap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: filename,
        data: zoomMapExport,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ ZoomMap uploaded:', result.gcsUrl);
    } else {
      console.error('Erreur API:', result.message);
    }
  } catch (error) {
    console.error('Erreur fetch:', error);
  }
};

export const fetchVideosByClub = async (clubName) => {
  const url = `${API_BASE}/videos?folder=${encodeURIComponent(clubName)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des vidéos');
  }

  const data = await response.json();

  const sortedVideos = (data.videos || []).sort((a, b) => {
    const convertToISO = (dateStr) => {
      const [datePart, timePart] = dateStr.split(' ');
      const [day, month, year] = datePart.split('/');
      return `${year}-${month}-${day}T${timePart || '00:00:00'}`;
    };
    return new Date(convertToISO(b.creationDate)) - new Date(convertToISO(a.creationDate));
  });

  return sortedVideos;
};

export const deleteVideoByClub = async (clubName, videoName) => {
  if (!clubName) throw new Error('Missing clubName');
  if (!videoName) throw new Error('Missing videoName');

  const url = `${API_BASE}/videos?folder=${encodeURIComponent(clubName)}&name=${encodeURIComponent(videoName)}`;

  const resp = await fetch(url, { method: 'DELETE' });
  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const err = new Error(data?.message || `HTTP ${resp.status}`);
    err.status = resp.status;
    err.details = data?.details ?? data;
    throw err;
  }

  if (data?.status && data.status !== 'success') {
    const err = new Error(data?.message || 'Delete failed');
    err.status = 502;
    err.details = data;
    throw err;
  }

  return data;
};

export const renameVideoByClub = async (clubName, oldName, newName) => {
  if (!clubName) throw new Error('Missing clubName');
  if (!oldName) throw new Error('Missing oldName');
  if (!newName) throw new Error('Missing newName');

  const resp = await fetch(`${API_BASE}/videos/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: clubName, oldName, newName }),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const err = new Error(data?.message || `HTTP ${resp.status}`);
    err.status = resp.status;
    err.details = data?.details ?? data;
    throw err;
  }

  if (data?.status && data.status !== 'success') {
    const err = new Error(data?.message || 'Rename failed');
    err.status = 502;
    err.details = data;
    throw err;
  }

  return data;
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

    const url = `${API_BASE}/mergeImages?${queryParams.toString()}`;
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

const normalizeCompetitionName = (name) =>
  String(name || '').replace(/\s+/g, ' ').trim();

export const fetchCompetitionsForClub = async (cl_no) => {
  try {
    const response = await fetch(`https://api-dofa.fff.fr/api/clubs/${cl_no}/equipes`);
    const data = await response.json();

    // Extraire les informations des compétitions avec les détails supplémentaires
    const competitionDetails = data['hydra:member'].flatMap(team =>
      team.engagements
        .filter(engagement => engagement.competition.type === "CH")
        .map(engagement => ({
          competitionName: normalizeCompetitionName(engagement.competition.name),
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
        id: match['@id'] ? match['@id'].split('/').pop(): null, // Extraction de l'ID depuis l'URL
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
