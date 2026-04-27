# IA Sport Vision — Trainer

Container exécuté par **Vertex AI Custom Jobs** pour fine-tuner YOLO sur les
annotations validées et publier automatiquement le nouveau modèle.

## Flux complet

```
[Frontend annotation] ─── POST /api/train ───► [Annotation backend]
                                                       │
                                                       │ aiplatform.CustomJob.submit()
                                                       ▼
                                             [Vertex AI Custom Job]
                                                       │
                                                       │ run Trainer image
                                                       ▼
                                            ┌─────────────────────┐
                                            │  Trainer (ce dossier) │
                                            │  1. export Firestore  │
                                            │  2. yolo train        │
                                            │  3. upload best.pt    │
                                            │  4. Firestore active  │
                                            │  5. POST reload-model │
                                            └─────────────────────┘
                                                       │
                                                       ▼
                                             [CloudRun tracking]
                                                       │
                                                  reload à chaud
                                                       ▼
                                           YOLO = nouveau best.pt
```

## Variables d'environnement (fournies par Vertex AI au submit)

| Nom | Description |
|---|---|
| `GCP_PROJECT` | ID du projet GCP |
| `MODEL_BUCKET` | bucket GCS où publier `ball_<runId>.pt` |
| `RUN_ID` | id unique du run |
| `BASE_MODEL` | modèle de base, ex `yolov8s.pt` |
| `EPOCHS` / `IMGSZ` / `BATCH` / `PATIENCE` | hyperparamètres |
| `VIDEO_IDS` | csv de videoId à inclure (vide = tous) |
| `USE_GPU` | `1` pour entraînement GPU (défaut), `0` pour CPU |
| `TRACKING_RELOAD_URL` | URL du service CloudRun tracking |
| `TRACKING_RELOAD_TOKEN` | shared secret (header `X-Reload-Token`) |

## Build & push de l'image

```powershell
# Depuis le dossier Application/ (pour que le Dockerfile voie Annotation/ et Trainer/)
$PROJECT = "ia-sport-vision"
$REGION  = "europe-west1"
$REPO    = "iasv"
$IMAGE   = "$REGION-docker.pkg.dev/$PROJECT/$REPO/trainer:latest"

# 1. Créer le repo Artifact Registry (une seule fois)
gcloud artifacts repositories create $REPO `
  --location=$REGION --repository-format=docker

# 2. Authentifier Docker
gcloud auth configure-docker "$REGION-docker.pkg.dev"

# 3. Build + push
docker build -f Trainer/Dockerfile -t $IMAGE .
docker push $IMAGE
```

## Service Account pour le Vertex AI job

Le SA qui exécute le job doit avoir :
- `roles/datastore.user` (lire/écrire Firestore)
- `roles/storage.objectAdmin` (lire annotations + écrire modèles)
- `roles/artifactregistry.reader` (tirer l'image)
- `roles/aiplatform.user` (s'exécuter dans Vertex)

```powershell
$SA = "iasv-trainer@$PROJECT.iam.gserviceaccount.com"
gcloud iam service-accounts create iasv-trainer --display-name="IASV Trainer"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/datastore.user
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/storage.objectAdmin
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/artifactregistry.reader
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/aiplatform.user
```

## Configuration du backend d'annotation

Ajouter ces variables d'env au Cloud Run `iasv-annotation` :

```powershell
gcloud run services update iasv-annotation --region $REGION `
  --set-env-vars `
    GCP_PROJECT=$PROJECT,`
    TRAINER_IMAGE=$IMAGE,`
    TRAINING_REGION=$REGION,`
    TRAINING_BUCKET=ia-sport-annotations,`
    MODEL_BUCKET=ia-sport-models,`
    TRAINING_MACHINE=n1-standard-8,`
    TRAINING_GPU_TYPE=NVIDIA_TESLA_T4,`
    TRAINING_GPU_COUNT=1,`
    TRAINING_SERVICE_ACCOUNT=$SA,`
    TRACKING_RELOAD_URL=https://iasv-cloudrun-xxxxx-ew.a.run.app/admin/reload-model,`
    TRACKING_RELOAD_TOKEN=CHANGE_ME_SECRET,`
    MIN_TRUE_BALL_TO_TRAIN=30
```

## Configuration du service tracking (CloudRun)

```powershell
gcloud run services update iasv-cloudrun --region $REGION `
  --set-env-vars `
    GCP_PROJECT=$PROJECT,`
    USE_MODEL_REGISTRY=1,`
    TRACKING_RELOAD_TOKEN=CHANGE_ME_SECRET
```

Le Service Account du Cloud Run tracking doit aussi avoir
`roles/datastore.user` (pour lire `model_registry/active` au démarrage).

## Collections Firestore

### `annotations`
Documents produits par `extract_frames.py` (voir Annotation/).

### `model_registry`
- `active` (doc spécial) :
  ```json
  { "runId": "v20260424-153000", "modelUri": "gs://ia-sport-models/models/ball_v20260424-153000.pt",
    "metrics": {"mAP50": 0.84, "recall": 0.89}, "activatedAt": "..." }
  ```
- `<runId>` : 1 doc par run, progressivement enrichi (`state`, `metrics`, `error`…)

## CPU-only (option low-cost)

Si vous n'avez pas besoin de GPU :
```powershell
gcloud run services update iasv-annotation `
  --set-env-vars TRAINING_GPU_TYPE=,TRAINING_MACHINE=n1-highcpu-16
```
Et dans Dockerfile, changer la base en `python:3.11-slim` + `pip install torch --index-url https://download.pytorch.org/whl/cpu`.

## Tester localement le Trainer

```powershell
docker build -f Trainer/Dockerfile -t iasv-trainer-local .
docker run --rm `
  -e GCP_PROJECT=$PROJECT `
  -e MODEL_BUCKET=ia-sport-models `
  -e RUN_ID=local-test `
  -e BASE_MODEL=yolov8n.pt `
  -e EPOCHS=5 `
  -e USE_GPU=0 `
  -v "$PWD/sa-key.json:/tmp/key.json:ro" `
  -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/key.json `
  iasv-trainer-local
```
