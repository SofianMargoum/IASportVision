/**
 * Stockage sécurisé du JWT via react-native-keychain.
 *
 * Pourquoi pas AsyncStorage ?
 *  - AsyncStorage écrit en clair sur le disque (SharedPreferences / fichiers).
 *  - Keychain utilise iOS Keychain / Android Keystore (chiffré au niveau OS).
 *
 * Si le module natif n'est pas (encore) lié, les fonctions retournent null
 * proprement et journalisent un warning en dev — l'app continue à tourner
 * mais l'utilisateur devra se reconnecter à chaque démarrage.
 */

let Keychain = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('react-native-keychain');
  // Sur Android, si l'autolinking n'a pas été fait au build, le JS est présent
  // mais les méthodes natives sont null. On considère le module indisponible.
  const looksUsable =
    mod &&
    typeof mod.setGenericPassword === 'function' &&
    typeof mod.getGenericPassword === 'function';
  if (looksUsable) {
    Keychain = mod;
  } else if (__DEV__) {
    console.warn(
      '[secureToken] react-native-keychain : module JS chargé mais natif non lié. ' +
        'Reconstruisez l\'app (Android: `npx react-native run-android` ; iOS: `cd ios && pod install`).'
    );
  }
} catch (e) {
  if (__DEV__) {
    console.warn(
      '[secureToken] react-native-keychain introuvable. ' +
        'Installez la dépendance et relancez `npx pod-install` (iOS).'
    );
  }
}

const SERVICE = 'iasv-auth-session';

function normalizeToken(value) {
  return typeof value === 'string' && value ? value : null;
}

function serializeSession({ accessToken, refreshToken }) {
  return JSON.stringify({
    accessToken: normalizeToken(accessToken),
    refreshToken: normalizeToken(refreshToken),
  });
}

function deserializeSession(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const accessToken = normalizeToken(parsed?.accessToken);
    const refreshToken = normalizeToken(parsed?.refreshToken);
    if (!accessToken && !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    // Migration douce : ancien format = access token brut seul.
    return { accessToken: raw, refreshToken: null };
  }
}

export async function saveAuthTokens({ accessToken, refreshToken }) {
  if (!normalizeToken(accessToken) && !normalizeToken(refreshToken)) return false;
  if (!Keychain) return false;
  try {
    await Keychain.setGenericPassword('auth', serializeSession({ accessToken, refreshToken }), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE?.AFTER_FIRST_UNLOCK ?? undefined,
    });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[secureToken] saveAuthTokens error:', e?.message);
    return false;
  }
}

export async function loadAuthTokens() {
  if (!Keychain) return null;
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (creds && creds.password) return deserializeSession(creds.password);
    return null;
  } catch (e) {
    if (__DEV__) console.warn('[secureToken] loadAuthTokens error:', e?.message);
    return null;
  }
}

export async function clearAuthTokens() {
  if (!Keychain) return false;
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[secureToken] clearAuthTokens error:', e?.message);
    return false;
  }
}

export async function saveToken(token) {
  return saveAuthTokens({ accessToken: token, refreshToken: null });
}

export async function loadToken() {
  const session = await loadAuthTokens();
  return session?.accessToken || null;
}

export async function clearToken() {
  return clearAuthTokens();
}
