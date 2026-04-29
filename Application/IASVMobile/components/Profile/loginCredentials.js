/**
 * ⚠️ AVERTISSEMENT SÉCURITÉ
 * --------------------------------------------------------------
 * Ce fichier contient les identifiants du mode démo en clair.
 * Tout secret ici est extractible depuis le bundle (RN ne chiffre rien).
 *
 * À FAIRE pour passer en production :
 *   1. Mettre en place une authentification serveur (POST /auth/login)
 *      qui retourne un token signé.
 *   2. Stocker le token via `react-native-keychain`, jamais AsyncStorage.
 *   3. Supprimer ce fichier.
 *
 * En attendant : ajoutez ce fichier à `.gitignore` et committez à la
 * place un `loginCredentials.example.js` sans secret réel.
 */

export const DEMO_CREDENTIALS = [
  {
    id: 'local',
    username: 'Fcmiramas',
    password: 'Miramas13.',
    name: 'Fcmiramas',
    email: 'miramas',
    photoAsset: 'fcmiramas.jpg',
  },
];
