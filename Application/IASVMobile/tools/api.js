// --- API HikConnect ---

const API_BASE = 'https://ia-sport.oa.r.appspot.com/api';
const DEFAULT_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 120000;

// Sécurité : on force HTTPS pour toute l'API.
if (!/^https:\/\//i.test(API_BASE)) {
  throw new Error('API_BASE must use HTTPS');
}

// --- Bearer token (JWT) en mémoire ---
// Renseigné par tools/secureToken après chargement du Keychain, ou par
// LoginForm après un login réussi. Jamais persisté ailleurs qu'en Keychain.
let CURRENT_AUTH_TOKEN = null;

export function setAuthToken(token) {
  CURRENT_AUTH_TOKEN = typeof token === 'string' && token ? token : null;
}

export function clearAuthToken() {
  CURRENT_AUTH_TOKEN = null;
}

export function getAuthToken() {
  return CURRENT_AUTH_TOKEN;
}

/**
 * Helper fetch sécurisé :
 *  - impose HTTPS
 *  - applique un timeout via AbortController
 *  - parse JSON en sécurité
 *  - normalise les erreurs (status / details) sans fuite d'infos sensibles
 *  - injecte automatiquement Authorization: Bearer <jwt> si dispo
 */
// Le JWT ne doit être envoyé qu'à NOTRE backend, jamais à des APIs tierces
// (FFF DOFA, Nominatim, etc.) — sinon ces APIs rejettent la requête (401)
// ou pire, on fuite le token à un tiers.
//
// On évite volontairement le constructeur `URL` : sur React Native/Hermes
// sans `react-native-url-polyfill`, `new URL()` peut échouer ou renvoyer
// un `.origin` vide. Un simple check de préfixe HTTPS sur l'origin de
// notre API est suffisant et fiable.
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
function isOwnApiUrl(url) {
  if (typeof url !== 'string') return false;
  return url === API_ORIGIN
    || url.startsWith(API_ORIGIN + '/')
    || url.startsWith(API_ORIGIN + '?');
}

async function secureFetch(url, { method = 'GET', headers, body, timeoutMs = DEFAULT_TIMEOUT_MS, parse = 'json' } = {}) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    throw new Error('Insecure or invalid URL');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const sendAuth = !!CURRENT_AUTH_TOKEN && isOwnApiUrl(url);
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        Accept: 'application/ld+json, application/json;q=0.9, */*;q=0.1',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(sendAuth ? { Authorization: `Bearer ${CURRENT_AUTH_TOKEN}` } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = null;
    if (parse === 'json') {
      data = await resp.json().catch(() => ({}));
    } else if (parse === 'text') {
      data = await resp.text().catch(() => '');
    }

    if (!resp.ok) {
      const err = new Error(
        (data && typeof data === 'object' && data.message) || `HTTP ${resp.status}`
      );
      err.status = resp.status;
      err.details = (data && typeof data === 'object' && (data.details ?? data)) || null;
      throw err;
    }

    // Erreur "métier" : 200 OK mais errorCode != '0'
    if (data && typeof data === 'object' && data.errorCode && data.errorCode !== '0') {
      const err = new Error(data.message || `Hik errorCode=${data.errorCode}`);
      err.status = 502;
      err.details = data;
      throw err;
    }

    return data;
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('Request timed out');
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Helper d'encodage défensif pour un segment de chemin
const encPath = (v) => encodeURIComponent(String(v ?? ''));

// L'API FFF DOFA renvoie tantôt une collection Hydra (`{"hydra:member":[...]}`),
// tantôt un tableau JSON brut. On normalise.
const extractList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.['hydra:member'])) return data['hydra:member'];
  return [];
};

// Validation de schéma d'URL externe (anti-SSRF côté client)
function assertHttpsUrl(value, fieldName = 'url') {
  if (typeof value !== 'string') throw new Error(`Invalid ${fieldName}`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${fieldName}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${fieldName} must use HTTPS`);
  }
  return parsed.toString();
}

/**
 * Source unique de vérité :
 * retourne toutes les caméras avec leurs infos device, area, channel, etc.
 */
export const fetchAllCameras = async () => {
  return secureFetch(`${API_BASE}/hikconnect/cameras`);
};

/**
 * Liste des caméras visibles par le user connecté (filtrage serveur).
 *  - admin            : toutes les caméras
 *  - autre rôle       : caméras du club du user uniquement
 * Le JWT doit avoir été injecté via setAuthToken().
 *
 * Renvoie un tableau de devices (format backend, snake_case + champ club).
 */
export const fetchDevices = async () => {
  // /devices est monté à la racine (pas sous /api), comme /auth/*.
  const ROOT_BASE = API_BASE.replace(/\/api\/?$/, '');
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[fetchDevices] token before secureFetch', !!getAuthToken());
  }
  const data = await secureFetch(`${ROOT_BASE}/devices`);
  return Array.isArray(data?.devices) ? data.devices : [];
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

  return secureFetch(`${API_BASE}/hikconnect/video/save-last-from-device`, {
    method: 'POST',
    body,
  });
}

// ===== Rolling chunked export during recording =====
export async function startRollingExport({
  deviceId,
  cameraId,
  beginTime,
  offset,
  voiceSwitch = 0,
  chunkSec = 60,
  lagSec = 120,
  directory,
  combinedFilename,
  homeLogoUrl,
  awayLogoUrl,
  label,
}) {
  const body = {
    deviceId,
    cameraId,
    beginTime,
    voiceSwitch,
    chunkSec,
    lagSec,
    ...(typeof offset === 'string' && offset ? { offset } : {}),
    ...(typeof directory === 'string' && directory ? { directory } : {}),
    ...(typeof combinedFilename === 'string' && combinedFilename ? { combinedFilename } : {}),
    ...(typeof homeLogoUrl === 'string' && homeLogoUrl ? { homeLogoUrl } : {}),
    ...(typeof awayLogoUrl === 'string' && awayLogoUrl ? { awayLogoUrl } : {}),
    ...(typeof label === 'string' && label ? { label } : {}),
  };

  return secureFetch(`${API_BASE}/hikconnect/video/rolling/start`, {
    method: 'POST',
    body,
  });
}

export async function tickRollingExport({ rollingId, index } = {}) {
  return secureFetch(`${API_BASE}/hikconnect/video/rolling/tick`, {
    method: 'POST',
    body: {
      rollingId,
      ...(index === null || index === undefined ? {} : { index }),
    },
  });
}

export async function getRollingQueue({ deviceId, cameraId } = {}) {
  if (!deviceId || !cameraId) {
    throw new Error('Missing deviceId or cameraId');
  }
  const url = `${API_BASE}/hikconnect/video/rolling/queue?deviceId=${encodeURIComponent(
    deviceId
  )}&cameraId=${encodeURIComponent(cameraId)}`;

  return secureFetch(url, { method: 'GET' });
}

export async function dismissRolling({ deviceId, cameraId, rollingId } = {}) {
  if (!deviceId || !cameraId || !rollingId) {
    throw new Error('Missing deviceId, cameraId or rollingId');
  }
  return secureFetch(`${API_BASE}/hikconnect/video/rolling/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, cameraId, rollingId }),
  });
}

export async function finalizeRollingExport({
  rollingId,
  directory,
  filename,
  stopTime,
  tailTryCount = 3,
  requireComplete,
  homeLogoUrl,
  awayLogoUrl,
  combinedFilename,
  label,
}) {
  return secureFetch(`${API_BASE}/hikconnect/video/rolling/finalize`, {
    method: 'POST',
    body: {
      rollingId,
      directory,
      filename,
      stopTime,
      tailTryCount,
      ...(requireComplete === null || requireComplete === undefined ? {} : { requireComplete }),
      ...(typeof homeLogoUrl === 'string' && homeLogoUrl ? { homeLogoUrl } : {}),
      ...(typeof awayLogoUrl === 'string' && awayLogoUrl ? { awayLogoUrl } : {}),
      ...(typeof combinedFilename === 'string' && combinedFilename ? { combinedFilename } : {}),
      ...(typeof label === 'string' && label ? { label } : {}),
    },
  });
}

/**
 * Fire-and-forget finalize. Returns 202 immediately. The backend handles
 * the heavy work via Cloud Tasks. The client polls /rolling/queue for
 * status (finalGcsPath / finalPublicUrl when ready).
 */
export async function finalizeRollingAsync({
  rollingId,
  directory,
  filename,
  stopTime,
  tailTryCount = 1,
  requireComplete = 1,
  homeLogoUrl,
  awayLogoUrl,
  combinedFilename,
  label,
}) {
  return secureFetch(`${API_BASE}/hikconnect/video/rolling/finalize-async`, {
    method: 'POST',
    body: {
      rollingId,
      directory,
      filename,
      stopTime,
      tailTryCount,
      requireComplete,
      ...(typeof homeLogoUrl === 'string' && homeLogoUrl ? { homeLogoUrl } : {}),
      ...(typeof awayLogoUrl === 'string' && awayLogoUrl ? { awayLogoUrl } : {}),
      ...(typeof combinedFilename === 'string' && combinedFilename ? { combinedFilename } : {}),
      ...(typeof label === 'string' && label ? { label } : {}),
    },
  });
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
  // Validation anti-SSRF côté client (le backend doit aussi valider)
  const safeUrl = assertHttpsUrl(sourceUrl, 'sourceUrl');

  if (typeof directory !== 'string' || !directory.trim()) {
    throw new Error('Invalid directory');
  }
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new Error('Invalid filename');
  }
  // Empêche path traversal côté client
  if (/[\\/]/.test(filename) || filename.includes('..')) {
    throw new Error('Invalid filename');
  }

  const body = {
    sourceUrl: safeUrl,
    directory,
    filename,
    ...(contentType ? { contentType } : {}),
  };

  const data = await secureFetch(`${API_BASE}/upload-from-url`, {
    method: 'POST',
    body,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });

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
  return secureFetch(`${API_BASE}/hikconnect/start-recording`, {
    method: 'PUT',
    body: { deviceId },
  });
}

// Arrêter l'enregistrement côté device HikConnect
export async function hikStopRecording({ deviceId }) {
  if (!deviceId) throw new Error('Missing deviceId');
  return secureFetch(`${API_BASE}/hikconnect/stop-recording`, {
    method: 'PUT',
    body: { deviceId },
  });
}

// Statut d'enregistrement côté device HikConnect
export async function hikGetRecordingStatus({ deviceId, cameraId, recordingStateToken }) {
  if (!deviceId) throw new Error('Missing deviceId');

  const data = await secureFetch(`${API_BASE}/hikconnect/recording-status`, {
    method: 'POST',
    body: {
      deviceId,
      ...(cameraId ? { cameraId } : {}),
      ...(recordingStateToken ? { recordingStateToken } : {}),
    },
  });

  return {
    isRecording: !!data?.isRecording,
    recordingTime: typeof data?.recordingTime === 'string' ? data.recordingTime : null,
  };
}

export const fetchVideosByClub = async (clubName) => {
  if (typeof clubName !== 'string' || !clubName.trim()) {
    throw new Error('Missing clubName');
  }
  const url = `${API_BASE}/videos?folder=${encodeURIComponent(clubName)}`;

  const data = await secureFetch(url);

  const sortedVideos = (data.videos || []).sort((a, b) => {
    const convertToISO = (dateStr) => {
      const [datePart, timePart] = String(dateStr || '').split(' ');
      const [day, month, year] = String(datePart || '').split('/');
      return `${year}-${month}-${day}T${timePart || '00:00:00'}`;
    };
    return new Date(convertToISO(b.creationDate)) - new Date(convertToISO(a.creationDate));
  });

  return sortedVideos;
};

export const deleteVideoByClub = async (clubName, videoName) => {
  if (typeof clubName !== 'string' || !clubName.trim()) throw new Error('Missing clubName');
  if (typeof videoName !== 'string' || !videoName.trim()) throw new Error('Missing videoName');
  if (/[\\/]/.test(videoName) || videoName.includes('..')) {
    throw new Error('Invalid videoName');
  }

  const url = `${API_BASE}/videos?folder=${encodeURIComponent(clubName)}&name=${encodeURIComponent(videoName)}`;

  const data = await secureFetch(url, { method: 'DELETE' });

  if (data?.status && data.status !== 'success') {
    const err = new Error(data?.message || 'Delete failed');
    err.status = 502;
    err.details = data;
    throw err;
  }

  return data;
};

export const renameVideoByClub = async (clubName, oldName, newName) => {
  if (typeof clubName !== 'string' || !clubName.trim()) throw new Error('Missing clubName');
  if (typeof oldName !== 'string' || !oldName.trim()) throw new Error('Missing oldName');
  if (typeof newName !== 'string' || !newName.trim()) throw new Error('Missing newName');
  if (/[\\/]/.test(oldName) || oldName.includes('..')) throw new Error('Invalid oldName');
  if (/[\\/]/.test(newName) || newName.includes('..')) throw new Error('Invalid newName');

  const data = await secureFetch(`${API_BASE}/videos/rename`, {
    method: 'PUT',
    body: { folder: clubName, oldName, newName },
  });

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
  // Validation : URLs externes -> HTTPS uniquement
  const safeLogo1 = assertHttpsUrl(logo1Url, 'logo1Url');
  const safeLogo2 = assertHttpsUrl(logo2Url, 'logo2Url');
  if (typeof finalFolder !== 'string' || !finalFolder.trim()) {
    throw new Error('Invalid finalFolder');
  }
  if (finalName != null) {
    if (typeof finalName !== 'string' || /[\\/]/.test(finalName) || finalName.includes('..')) {
      throw new Error('Invalid finalName');
    }
  }

  try {
    const queryParams = new URLSearchParams({
      logo1Url: safeLogo1,
      logo2Url: safeLogo2,
      finalFolder,
      ...(finalName ? { finalName } : {}),
    });

    const url = `${API_BASE}/mergeImages?${queryParams.toString()}`;
    return await secureFetch(url, { method: 'GET' });
  } catch (error) {
    if (__DEV__) console.error('Error merging images:', error?.message);
    throw error;
  }
};


// Fonction pour rechercher des clubs
export const searchClubs = async (searchTerm) => {
  // Validation pour limiter l'attaque par injection d'URL
  if (typeof searchTerm !== 'string') return [];
  const cleaned = searchTerm.trim().slice(0, 100);
  if (!cleaned) return [];

  try {
    const url = `https://api-dofa.fff.fr/api/clubs?clNom=${encodeURIComponent(cleaned)}`;
    const data = await secureFetch(url);
    return extractList(data).map((club) => ({
      name: club.name,
      logo: club.logo,
      cl_no: club.cl_no,
    }));
  } catch (error) {
    if (__DEV__) console.error('Error fetching clubs:', error?.message);
    return [];
  }
};

// Récupère un club par son cl_no (utile pour compléter logo/name quand
// d'autres endpoints ne les fournissent pas, ex. classement_journees).
export const fetchClubByClNo = async (cl_no) => {
  if (cl_no == null || cl_no === '') return null;
  try {
    const url = `https://api-dofa.fff.fr/api/clubs/${encPath(cl_no)}`;
    const data = await secureFetch(url);
    if (!data || typeof data !== 'object') return null;
    return {
      cl_no: data.cl_no || cl_no,
      name: data.name || '',
      logo: data.logo || '',
    };
  } catch (error) {
    if (__DEV__) console.error('Error fetching club by cl_no:', error?.message);
    return null;
  }
};

const normalizeCompetitionName = (name) =>
  String(name || '').replace(/\s+/g, ' ').trim();

export const fetchCompetitionsForClub = async (cl_no) => {
  if (cl_no == null || cl_no === '') return [];
  try {
    const url = `https://api-dofa.fff.fr/api/clubs/${encPath(cl_no)}/equipes`;
    const data = await secureFetch(url);

    // L'API FFF DOFA renvoie tantôt une collection Hydra (`{"hydra:member":[...]}`),
    // tantôt un tableau JSON brut. On gère les deux formats.
    const teams = extractList(data);

    const competitionDetails = teams.flatMap((team) =>
      (team?.engagements || [])
        .filter((engagement) => engagement?.competition?.type === 'CH')
        .map((engagement) => ({
          competitionName: normalizeCompetitionName(engagement.competition.name),
          cp_no: engagement.competition.cp_no,
          phaseNumber: engagement.phase?.number || null,
          stageNumber: engagement.poule?.stage_number || null,
        }))
    );

    return competitionDetails;
  } catch (error) {
    if (__DEV__) console.error('Error fetching competitions:', error?.message);
    return [];
  }
};


export const fetchMatchesForClub = async (cp_no, phaseId, pouleId, cl_no) => {
  if ([cp_no, phaseId, pouleId, cl_no].some((v) => v == null || v === '')) return [];
  try {
    const url =
      `https://api-dofa.fff.fr/api/compets/${encPath(cp_no)}` +
      `/phases/${encPath(phaseId)}` +
      `/poules/${encPath(pouleId)}` +
      `/matchs?clNo=${encodeURIComponent(cl_no)}`;
    const data = await secureFetch(url);

    return extractList(data).map((match) => {
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

      const homeClub = match.home && match.home.club ? match.home.club : null;
      const awayClub = match.away && match.away.club ? match.away.club : null;

      return {
        id: match['@id'] ? match['@id'].split('/').pop() : null,
        date: match.date,
        time: match.time,
        home_score: match.home_score,
        away_score: match.away_score,
        season: match.competition ? match.competition.season : null,
        homeTeam: match.home ? match.home.short_name : '',
        awayTeam: match.away ? match.away.short_name : '',
        homeLogo: homeClub ? homeClub.logo : '',
        awayLogo: awayClub ? awayClub.logo : '',
        homeClNo: homeClub ? homeClub.cl_no : null,
        awayClNo: awayClub ? awayClub.cl_no : null,
        homeClubName: homeClub ? (homeClub.name || match.home?.short_name || '') : '',
        awayClubName: awayClub ? (awayClub.name || match.away?.short_name || '') : '',
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
    if (__DEV__) console.error('Error fetching matches:', error?.message);
    return [];
  }
};


// Fonction pour récupérer le classement des journées pour une poule spécifique
export const fetchClassementJournees = async (competitionId, phaseId, pouleId) => {
  if ([competitionId, phaseId, pouleId].some((v) => v == null || v === '')) return [];
  try {
    const url =
      `https://api-dofa.fff.fr/api/compets/${encPath(competitionId)}` +
      `/phases/${encPath(phaseId)}` +
      `/poules/${encPath(pouleId)}` +
      `/classement_journees`;
    const data = await secureFetch(url);

    return extractList(data).map((journee) => {
      const equipe = journee.equipe || {};
      const club = equipe.club || {};
      return {
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
        teamName: equipe.short_name,
        teamCategory: equipe.category_label,
        teamGender: equipe.category_gender,
        clNo: club.cl_no || null,
        clubName: club.name || equipe.short_name || '',
        clubLogo: club.logo || '',
        pouleName: journee.poule ? journee.poule.name : '',
        stageNumber: journee.poule ? journee.poule.stage_number : '',
      };
    });
  } catch (error) {
    if (__DEV__) console.error('Error fetching classement journées:', error?.message);
    return [];
  }
};
