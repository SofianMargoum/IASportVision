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

const SERVICE = 'iasv-auth-jwt';

export async function saveToken(token) {
  if (typeof token !== 'string' || !token) return false;
  if (!Keychain) return false;
  try {
    await Keychain.setGenericPassword('jwt', token, {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE?.AFTER_FIRST_UNLOCK ?? undefined,
    });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[secureToken] saveToken error:', e?.message);
    return false;
  }
}

export async function loadToken() {
  if (!Keychain) return null;
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (creds && creds.password) return creds.password;
    return null;
  } catch (e) {
    if (__DEV__) console.warn('[secureToken] loadToken error:', e?.message);
    return null;
  }
}

export async function clearToken() {
  if (!Keychain) return false;
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[secureToken] clearToken error:', e?.message);
    return false;
  }
}
