# Ball Tracking – IA Sport Vision

Pipeline robuste de **détection + tracking du ballon** pour vidéos de football amateur,
y compris panoramiques (ex : 5120×1440).

## Architecture

```
CloudRun/
├── app.py                     # endpoints Flask (/track-ball, /track-ball-crop)
├── ball_tracker/
│   ├── __init__.py
│   ├── preprocessing.py       # lecture vidéo, tiling, CLAHE
│   ├── detector.py            # YOLO multi-scale + tiling + NMS + filtres
│   ├── tracker.py             # Kalman filter + état detected/predicted/lost
│   ├── smoothing.py           # interpolation + moving average + vitesse max
│   ├── pipeline.py            # orchestrateur
│   └── cropper.py             # recadrage auto avec smoothing caméra
├── requirements.txt
└── Dockerfile
```

### Choix techniques

| Problème | Solution |
|---|---|
| Ballon < 20 px sur panoramique | **Tiling** 1280×1280 avec overlap 0.2 → YOLO voit le ballon à sa vraie résolution |
| YOLOv8n COCO peu fiable sur ballon foot | `conf=0.15` bas + **filtres géométriques** (taille, aspect ratio) + **fine-tuning** recommandé |
| Détection manquante sur certaines frames | **Kalman Filter** qui prédit (coasting) jusqu'à 25 frames |
| Faux positifs loin des joueurs | **Gating contextuel** : rejette si > 400 px du joueur le plus proche (sauf confiance ≥ 0.55) |
| Sauts incohérents | **Max speed** + **smoothing MA** fenêtre 5 |
| Trous courts | **Interpolation linéaire** pour gaps ≤ 8 frames |
| Caméra saccadée au crop | Moving average fenêtre 31 sur la trajectoire cible |

### États du tracker (dans le JSON)
- `detected` : bounding box YOLO trouvée et validée
- `predicted` : pas de détection, position issue du Kalman
- `lost` : coasting > seuil (track considéré perdu)

---

## Endpoints

### `POST /track-ball`

Tracking seul, retourne le JSON de la trajectoire.

**Request**
```json
{
  "videoUrl": "gs://ia-sport_cloudbuild/input.mp4",
  "ballClassId": 32,
  "playerClassId": 0,
  "frameStep": 2,
  "useTiles": true,
  "tileSize": 1280,
  "tileOverlap": 0.2,
  "yoloImgsz": 1280,
  "yoloConf": 0.15,
  "applyClahe": false
}
```

**Response**
```json
{
  "status": "ok",
  "video": { "width": 5120, "height": 1440, "fps": 25.0, "frame_count": 7500 },
  "stats": {
    "frames_processed": 3750,
    "elapsed_seconds": 412.3,
    "detected": 2130,
    "predicted": 1520,
    "lost": 100
  },
  "track": [
    {
      "frame": 0,
      "time": 0.0,
      "ball": { "x": 2560, "y": 720, "confidence": 0.63, "source": "detected" }
    },
    {
      "frame": 2,
      "time": 0.08,
      "ball": { "x": 2572, "y": 721, "confidence": 0.41, "source": "predicted" }
    }
  ]
}
```

### `POST /track-ball-crop`

Tracking + recadrage dynamique avec smoothing, upload GCS.

Paramètres supplémentaires :
```json
{
  "cropWidth": 1280,
  "cropHeight": 720,
  "smoothingWindow": 31
}
```

---

## Fine-tuning YOLO pour le ballon

COCO `sports ball` (class 32) est **très peu fiable** pour du foot amateur distant.
La qualité sera transformée par un fine-tuning.

### 1. Annotation

Outils recommandés :
- **CVAT** (open source, self-host ou cloud)
- **Roboflow** (freemium, excellent UX)
- **Label Studio**

Convention :
- 1 seule classe : `ball` (classId 0 dans le dataset, mais vous pouvez
  réutiliser 32 via un mapping)
- Bounding box serrée autour du ballon, même quand il est flou
- Annotez aussi les ballons **partiellement cachés** (≥ 30% visible)
- Variez les scènes : lumière, ombre, pluie, terrains, maillots

### 2. Volume minimum

| Objectif | Images annotées |
|---|---|
| Proof of concept | 300 – 500 |
| Modèle exploitable | 1 500 – 3 000 |
| Modèle robuste production | 8 000 – 15 000 |

Astuce : extrayez 1 frame / seconde de vos vidéos existantes (`ffmpeg -vf fps=1`).

### 3. Commande d'entraînement

```bash
yolo detect train \
  model=yolov8s.pt \
  data=ball.yaml \
  imgsz=1280 \
  epochs=100 \
  batch=8 \
  patience=20 \
  device=0 \
  mosaic=0.5 \
  mixup=0.1 \
  hsv_h=0.02 hsv_s=0.7 hsv_v=0.5 \
  degrees=5 translate=0.1 scale=0.3 \
  name=iasv_ball_v1
```

`ball.yaml` :
```yaml
path: /datasets/iasv_ball
train: images/train
val:   images/val
names:
  0: ball
```

**Choix clés :**
- `yolov8s` : compromis taille / précision pour un petit objet
- `imgsz=1280` : indispensable, sinon le ballon fait 1 pixel
- `mosaic=0.5` : augmente la densité de petits objets
- `scale=0.3` : augmentations de zoom modérées pour ne pas déformer un ballon déjà petit

### 4. Évaluation

```bash
yolo detect val model=runs/detect/iasv_ball_v1/weights/best.pt data=ball.yaml imgsz=1280
```

Métriques à surveiller :
- **mAP50** : doit dépasser 0.75 pour un usage correct
- **Recall** : critique (un ballon manqué ≠ tolérable) — viser > 0.85
- **Precision** : doit rester > 0.7 sinon le tracker sera pollué

### 5. Déploiement

1. Copier `best.pt` dans l'image Docker : `COPY models/best.pt /app/models/best.pt`
2. Définir la variable d'env : `YOLO_MODEL_PATH=/app/models/best.pt`
3. Dans la requête, mettre `"ballClassId": 0` (classId du modèle fine-tuné)

### 6. Boucle d'amélioration continue

1. Collectez les frames où le tracker est `predicted/lost` longtemps (hard negatives)
2. Ré-annotez-les
3. Ré-entraînez avec `model=best.pt` (transfer learning depuis votre modèle)

---

## Performance & Cloud Run

- CPU only : ~1–3 fps sur une 4K avec tiling (prévoir `frameStep=2` min)
- Mémoire : 2 Gi suffisant pour `yolov8s`, 4 Gi pour `yolov8m`
- Timeout : `--timeout 0` déjà dans le Dockerfile pour vidéos longues
- Pour accélérer : réduire `tileSize`, augmenter `frameStep`, ou GPU (T4)

Déploiement :
```bash
gcloud run deploy iasv-cloudrun \
  --source . \
  --region europe-west1 \
  --memory 4Gi \
  --cpu 4 \
  --timeout 3600 \
  --set-env-vars GCS_BUCKET=ia-sport_cloudbuild,YOLO_MODEL_PATH=/app/models/best.pt
```

---

## Pistes d'évolution

- **BoT-SORT / ByteTrack** : utile si on veut aussi tracker les joueurs individuellement
  pour affiner la validation contextuelle
- **Optical flow (Farneback, RAFT)** : pour rattraper le ballon entre deux frames
  quand YOLO échoue plusieurs fois d'affilée
- **Two-stream** : YOLO sur frame complète pour le contexte (joueurs) + YOLO tilé
  pour le ballon (éviter de refaire la détection joueurs sur chaque tile)
- **Sauvegarde intermédiaire du track en JSON sur GCS** pour permettre un re-run
  du crop sans retracker
