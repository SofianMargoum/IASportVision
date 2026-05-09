# IA Sport Vision — Plateforme web (IASVWeb)

Plateforme web SaaS pour les clubs de football, en miroir de l'application
mobile React Native (`IASVMobile`). Construite avec Create React App + React
Router + Context API.

## Architecture `src/`

```
src/
  api/         # Clients HTTP (auth, admin, vidéos, hikconnect)
  assets/
  components/
  constants/   # Rôles
  context/     # AuthContext (JWT en localStorage)
  hooks/
  layouts/     # AppLayout (sidebar, topbar, responsive)
  pages/       # Login, Dashboard, Clubs, Videos, Cameras, Users, Coach, Player, Supporter, Admin
  routes/      # ProtectedRoute (auth + rôles)
  styles/      # global.css (tokens, composants utilitaires)
  utils/       # permissions.js (matrices de droits)
```

## Configuration

Copiez `.env.example` en `.env.local` :

```
REACT_APP_API_BASE=https://ia-sport.oa.r.appspot.com
REACT_APP_BRAND=IA Sport Vision
```

> Aucun secret n'est stocké côté front. Le JWT est stocké dans `localStorage`
> (clé `iasv.jwt`) et envoyé en `Authorization: Bearer ...` uniquement vers
> `REACT_APP_API_BASE`.

## Commandes

```powershell
cd c:\perso\IA_Sport_Vision\Application\IASVWeb

# Nettoyage des anciennes deps React Native (recommandé après mise à jour du package.json)
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# Installation
npm install

# Démarrage (http://localhost:3000)
npm start

# Build de production
npm run build
```

## Endpoints backend utilisés

Réutilisés depuis App Engine (mêmes endpoints que le mobile) :

- `POST /auth/login`            (public)        → `{ token, user }`
- `GET  /auth/me`               (Bearer)        → `{ user }`
- `GET  /admin/users`           (Bearer admin)
- `POST /admin/users`           (Bearer admin)
- `GET  /admin/users/:id`       (Bearer admin)
- `PUT  /admin/users/:id`       (Bearer admin)
- `DELETE /admin/users/:id`     (Bearer admin, soft-delete)
- `GET  /api/videos?folder=...` (Bearer)
- `GET  /api/hikconnect/cameras`            (Bearer)
- `PUT  /api/hikconnect/start-recording`    (Bearer)
- `PUT  /api/hikconnect/stop-recording`     (Bearer)
- `POST /api/hikconnect/recording-status`   (Bearer)

## Endpoints à prévoir / clarifier (côté backend)

- `GET /api/clubs` — liste des clubs gérés par la plateforme (actuellement,
  le mobile interroge directement `api-dofa.fff.fr`).
- `GET /api/stats` — agrégats pour le dashboard.
- Politique CORS : autoriser l'origine du domaine web (variable d'env
  `ALLOWED_ORIGIN` côté App Engine).

## Rôles

Source unique de vérité dans `src/utils/permissions.js`, miroir simplifié de
`IASVMobile/tools/permissions.js`. Les pages réservées (Caméras, Utilisateurs,
Admin) sont à la fois masquées dans le menu et bloquées par `ProtectedRoute`.

## Anciens fichiers (à nettoyer)

Les fichiers historiques restent en place mais ne sont plus importés. Vous
pouvez les supprimer une fois la nouvelle UI validée :

- `src/components/` (ancien dossier mobile-like)
- `src/api.js`, `src/config.js` (à la racine de `src/`)
- `src/GoogleSignIn*.js`
- `src/css/` (anciennes feuilles de style)
- `src/img/`
