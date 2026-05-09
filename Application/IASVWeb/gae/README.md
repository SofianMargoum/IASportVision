# IASVWeb — déploiement App Engine (service `iasvweb`)

Frontend statique SaaS (Create React App) servi par un mini serveur Express
sur App Engine standard `nodejs22`.

## Build & deploy (PowerShell, depuis `IASVWeb/`)

```powershell
# 1) Build production (à la racine IASVWeb)
npm install
npm run build

# 2) Copier le build dans le bundle de déploiement
Remove-Item -Recurse -Force gae\build -ErrorAction SilentlyContinue
Copy-Item -Recurse build gae\build

# 3) Déployer
gcloud app deploy gae\app.yaml --project ia-sport --quiet
```

## Domaines

```powershell
gcloud app domain-mappings create iasportvision.com `
  --service iasvweb --project ia-sport
gcloud app domain-mappings create www.iasportvision.com `
  --service iasvweb --project ia-sport
```

Puis configurer les enregistrements DNS chez OVH (A/AAAA pour le naked,
CNAME `ghs.googlehosted.com.` pour le `www`).
