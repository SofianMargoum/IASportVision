# IA Sport Vision — Annotation Service

Interface web + backend pour **valider manuellement les détections ballon** et
alimenter une boucle d'amélioration de YOLO.

## Architecture GCP

```
┌──────────────────┐        ┌──────────────────────────┐
│ Cloud Run        │◄──────►│ Firestore                │
│ (backend Flask   │  REST  │  collection: annotations │
│  + frontend JS)  │        └──────────────────────────┘
└─────────┬────────┘                   ▲
          │ URLs signées               │
          ▼                            │
┌──────────────────┐                   │
│ Cloud Storage    │                   │
│  - raw/*.jpg     │                   │
│  - annotations/* │                   │
│  - videos / track│                   │
└──────────────────┘                   │
                                       │
   ┌──────── scripts locaux ───────────┘
   │  extract_frames.py (JSON+mp4 -> images + docs Firestore)
   │  export_yolo.py    (Firestore -> dataset YOLO)
```

**Choix techniques et justification :**

| Composant | Choix | Pourquoi |
|---|---|---|
| Backend | **Cloud Run** (Flask) | scale-to-zero, même tech stack que le tracker, déploiement source direct |
| DB | **Firestore** (native mode) | NoSQL managed, requêtes `where/order`, quota free tier généreux, idéal pour quelques 100k docs |
| Stockage images | **Cloud Storage** + **URLs signées V4** | pas de bucket public, contrôle d'accès fin |
| Frontend | **HTML/JS vanilla** | pas de build, servi par Flask, hit rate cache immédiat, 0 dépendance npm |
| Extraction images | **script local/Batch** | évite de saturer Cloud Run (OpenCV seek peut durer), peut être rejoué |
| Dataset YOLO | **script local** | export ponctuel avant chaque entraînement |

---

## Structure

```
Annotation/
├── Dockerfile
├── backend/
│   ├── app.py              # Flask : API + sert le frontend
│   ├── extract_frames.py   # CLI : JSON+mp4 -> images + Firestore
│   ├── export_yolo.py      # CLI : Firestore -> dataset YOLO
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── README.md
```

---

## Installation locale

```powershell
cd Annotation/backend
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt

$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\sa-key.json"
$env:GCP_PROJECT = "ia-sport-vision"
$env:ANNOTATION_BUCKET = "ia-sport-annotations"

python app.py
# -> http://localhost:8080
```

---

## Étape 1 — Extraire les frames à annoter

```powershell
python backend/extract_frames.py `
  --video gs://ia-sport_cloudbuild/match1.mp4 `
  --track gs://ia-sport_cloudbuild/match1_track.json `
  --video-id match1 `
  --bucket ia-sport-annotations `
  --project ia-sport-vision `
  --sources detected `
  --box-size 80
```

- `--sources detected,predicted` pour aussi valider les prédictions Kalman
- `--min-conf 0.0 --max-conf 0.4` pour **prioriser les cas douteux**
- idempotent : relancer n'écrase pas les docs déjà annotés

---

## Étape 2 — Déployer l'interface sur Cloud Run

```powershell
cd Annotation

gcloud run deploy iasv-annotation `
  --source . `
  --region europe-west1 `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --set-env-vars GCP_PROJECT=ia-sport-vision,ANNOTATION_BUCKET=ia-sport-annotations
```

Le frontend est automatiquement servi à la racine par Flask.

**Permissions requises** pour le Service Account du Cloud Run :
- `roles/datastore.user` (Firestore)
- `roles/storage.objectViewer` (lecture des images)
- `roles/iam.serviceAccountTokenCreator` (générer des URLs signées V4 sans clé)

---

## API REST

| Méthode | Path | Description |
|---|---|---|
| GET  | `/api/videos` | Liste des videoId et nombre pending |
| GET  | `/api/frames?videoId=&status=pending&orderBy=confidence&limit=50` | Liste des frames |
| GET  | `/api/frames/<id>` | Détail + URLs signées |
| GET  | `/api/frames/<id>/image?type=raw\|annotated` | Redirection 302 vers URL signée |
| POST | `/api/annotation` | Sauvegarde. Body : `{docId, label, correctedBox?}` |
| GET  | `/api/stats?videoId=` | Totaux pending/annotated + répartition labels |

**Exemple POST :**
```json
{
  "docId": "match1__f0000270",
  "label": "true_ball",
  "correctedBox": { "x": 1230, "y": 510, "w": 34, "h": 34 }
}
```

Labels valides : `true_ball`, `false_positive`, `no_ball`.

---

## UX

- **Navigation** : ← / → ou boutons
- **Raccourcis** :
  - `1` = vrai ballon
  - `2` = faux positif
  - `3` = ballon absent
  - `E` = toggle mode édition
- **Progression** affichée `12 / 35`
- **Tri par confiance croissante** par défaut → les frames douteuses passent d'abord
- **Filtrage par vidéo** via dropdown (chargé depuis Firestore)
- **Filtrage par statut** : `pending` / `annotated` / `all`
- **Mode édition** : clic pour créer une box, drag pour déplacer, poignée coin bas-droit pour redimensionner, bouton `Reset` pour revenir à la box d'origine
- Les frames déjà annotées disparaissent automatiquement de la liste `pending` après sauvegarde

---

## Étape 3 — Exporter les annotations en dataset YOLO

```powershell
python backend/export_yolo.py `
  --project ia-sport-vision `
  --out .\datasets\iasv_ball_v2 `
  --video-ids match1,match2
```

Structure produite :
```
datasets/iasv_ball_v2/
├── dataset.yaml
├── images/
│   ├── train/*.jpg
│   └── val/*.jpg
└── labels/
    ├── train/*.txt   # "0 xc yc w h" ou vide (hard negative)
    └── val/*.txt
```

**Règles d'export :**
- `true_ball` → ligne `0 xc yc w h` (correctedBox prioritaire si présente)
- `false_positive` / `no_ball` → fichier label **vide** (hard negative, utile à YOLO)
- `pending` → ignoré

---

## Étape 4 — Réentraîner YOLO

```bash
yolo detect train \
  model=yolov8s.pt \
  data=datasets/iasv_ball_v2/dataset.yaml \
  imgsz=1280 \
  epochs=100 \
  batch=8 \
  patience=20 \
  mosaic=0.5 \
  mixup=0.1 \
  name=iasv_ball_v2
```

Puis redéployer le nouveau `best.pt` dans le service de tracking :
```powershell
# dans CloudRun/
Copy-Item runs\detect\iasv_ball_v2\weights\best.pt .\models\ball_best.pt
gcloud run deploy iasv-cloudrun `
  --source . `
  --set-env-vars YOLO_MODEL_PATH=/app/models/ball_best.pt
```

---

## Boucle d'amélioration continue

```
    ┌─────────────────────────────────────────────┐
    │                                             │
    ▼                                             │
[Tracking] ─► [JSON avec detections]              │
                │                                 │
                ▼                                 │
     [extract_frames.py]                          │
                │                                 │
                ▼                                 │
   [Interface Cloud Run] ── humain ──►[Firestore annotations]
                                           │
                                           ▼
                                    [export_yolo.py]
                                           │
                                           ▼
                                    [YOLO train v_{N+1}]
                                           │
                                           ▼
                                    [Nouveau best.pt]
                                           │
                                           └── redéploie tracking ─┘
```

### Stratégie d'annotation intelligente (active learning)

1. **Première passe** : annotez d'abord les `detected` à basse confiance
   (`--min-conf 0 --max-conf 0.35`) → c'est là que le modèle hésite, donc le
   plus informatif.
2. **Deuxième passe** : annotez les `predicted` (Kalman a comblé) pour capturer
   les vrais ballons que YOLO a manqués.
3. **Hard negatives** : n'hésitez pas à conserver les `false_positive` — ils
   apprennent à YOLO ce qui **n'est pas** un ballon (écharpes, casquettes,
   cônes de signalisation, etc.).

### Mesurer la progression

À chaque itération, mesurez sur le **même match de test non annoté** :
- nb de `detected` sur 1000 frames
- % de frames `lost`
- distance moyenne détection vs vérité terrain (si vous annotez un mini-set de
  validation)

Un bon signe : le ratio `detected / predicted` augmente progressivement.

---

## Sécurité / bonnes pratiques

- Bucket **non public** ; accès via URLs signées V4 expirant sous 30 min
- Backend `--allow-unauthenticated` en POC ; en prod, placer derrière
  **Identity-Aware Proxy** ou activer Firebase Auth côté frontend
- Firestore : définir des **security rules** si accès client direct (pas notre
  cas ici, tout passe par le backend)
- Champ `annotator` à enrichir avec `request.headers['X-Goog-Authenticated-User-Email']`
  quand IAP est actif, pour tracer qui a annoté quoi
