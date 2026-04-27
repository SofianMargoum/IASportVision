"""
Trainer : script exécuté dans un Vertex AI Custom Job (GPU recommandé).

Pipeline :
1. Export du dataset depuis Firestore (annotations validées) vers /workspace/dataset
2. Entraînement YOLO (ultralytics) -> runs/detect/<run>/weights/best.pt
3. Upload du best.pt vers gs://<MODEL_BUCKET>/models/ball_<version>.pt
4. Publication dans Firestore (collection model_registry) + activation
5. (optionnel) notification du service de tracking via POST /admin/reload-model

Variables d'environnement (définies par Vertex AI lors du submit) :
  GCP_PROJECT
  MODEL_BUCKET          (bucket GCS où publier les .pt)
  RUN_ID                (id unique, ex: v2026-04-24-001)
  BASE_MODEL            (ex: yolov8s.pt)
  EPOCHS                (défaut 80)
  IMGSZ                 (défaut 1280)
  BATCH                 (défaut 8)
  PATIENCE              (défaut 20)
  VIDEO_IDS             (csv, vide = tous)
  TRACKING_RELOAD_URL   (optionnel, ex: https://iasv-cloudrun-xxx-ew.a.run.app/admin/reload-model)
  TRACKING_RELOAD_TOKEN (optionnel, shared secret)
"""

import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from google.cloud import firestore, storage
import requests


PROJECT = os.environ["GCP_PROJECT"]
MODEL_BUCKET = os.environ["MODEL_BUCKET"]
RUN_ID = os.environ.get("RUN_ID") or datetime.utcnow().strftime("v%Y%m%d-%H%M%S")
BASE_MODEL = os.environ.get("BASE_MODEL", "yolov8s.pt")
EPOCHS = int(os.environ.get("EPOCHS", 80))
IMGSZ = int(os.environ.get("IMGSZ", 1280))
BATCH = int(os.environ.get("BATCH", 8))
PATIENCE = int(os.environ.get("PATIENCE", 20))
VIDEO_IDS = os.environ.get("VIDEO_IDS", "")
TRACKING_RELOAD_URL = os.environ.get("TRACKING_RELOAD_URL", "")
TRACKING_RELOAD_TOKEN = os.environ.get("TRACKING_RELOAD_TOKEN", "")


WORK = Path("/workspace")
WORK.mkdir(parents=True, exist_ok=True)
DATASET = WORK / "dataset"
RUNS = WORK / "runs"


def log(msg: str):
    print(f"[trainer][{datetime.utcnow().isoformat()}Z] {msg}", flush=True)


def set_run_state(state: str, **extra):
    """Publie l'état du run dans Firestore (model_registry/{RUN_ID})."""
    db = firestore.Client(project=PROJECT, database="annotations")
    doc = {
        "runId": RUN_ID,
        "state": state,
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        **extra,
    }
    db.collection("model_registry").document(RUN_ID).set(doc, merge=True)
    log(f"state -> {state} extra={extra}")


def export_dataset():
    log("exporting dataset from Firestore...")
    from export_yolo import export  # script copié dans l'image
    vids = [v.strip() for v in VIDEO_IDS.split(",") if v.strip()]
    export(project=PROJECT, video_ids=vids, out_dir=str(DATASET), val_ratio=0.15)
    n_train = len(list((DATASET / "images/train").glob("*")))
    n_val = len(list((DATASET / "images/val").glob("*")))
    log(f"dataset ready: train={n_train} val={n_val}")
    return n_train, n_val


def run_yolo():
    log(f"starting YOLO train base={BASE_MODEL} imgsz={IMGSZ} epochs={EPOCHS}")
    cmd = [
        "yolo", "detect", "train",
        f"model={BASE_MODEL}",
        f"data={DATASET}/dataset.yaml",
        f"imgsz={IMGSZ}",
        f"epochs={EPOCHS}",
        f"batch={BATCH}",
        f"patience={PATIENCE}",
        f"project={RUNS}",
        f"name={RUN_ID}",
        "mosaic=0.5",
        "mixup=0.1",
        "scale=0.3",
        "hsv_h=0.02", "hsv_s=0.7", "hsv_v=0.5",
        "degrees=5", "translate=0.1",
        "device=0" if os.environ.get("USE_GPU", "1") == "1" else "device=cpu",
        "exist_ok=True",
    ]
    log("CMD: " + " ".join(cmd))
    proc = subprocess.run(cmd, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"YOLO training failed (rc={proc.returncode})")
    best = RUNS / RUN_ID / "weights" / "best.pt"
    if not best.exists():
        raise FileNotFoundError(f"best.pt not found at {best}")
    log(f"training done, best = {best}")
    return best


def read_metrics():
    """Lit les métriques finales YOLO (results.csv)."""
    csv_path = RUNS / RUN_ID / "results.csv"
    if not csv_path.exists():
        return {}
    try:
        import csv
        with csv_path.open() as f:
            rows = list(csv.DictReader(f))
        if not rows:
            return {}
        last = rows[-1]
        keys = ["metrics/mAP50(B)", "metrics/mAP50-95(B)",
                "metrics/precision(B)", "metrics/recall(B)"]
        out = {}
        for k in keys:
            if k in last:
                try:
                    out[k.replace("metrics/", "").replace("(B)", "")] = float(last[k])
                except ValueError:
                    pass
        return out
    except Exception as e:
        log(f"metrics parse failed: {e}")
        return {}


def upload_model(best_path: Path) -> str:
    log(f"uploading {best_path} to gs://{MODEL_BUCKET}/models/ball_{RUN_ID}.pt")
    client = storage.Client(project=PROJECT)
    bucket = client.bucket(MODEL_BUCKET)
    blob_name = f"models/ball_{RUN_ID}.pt"
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(str(best_path))
    return f"gs://{MODEL_BUCKET}/{blob_name}"


def activate_model(model_uri: str, metrics: dict):
    """Marque ce modèle comme 'active' dans Firestore."""
    db = firestore.Client(project=PROJECT, database="annotations")
    db.collection("model_registry").document(RUN_ID).set({
        "modelUri": model_uri,
        "metrics": metrics,
        "baseModel": BASE_MODEL,
        "imgsz": IMGSZ,
        "epochs": EPOCHS,
        "batch": BATCH,
        "videoIds": [v for v in VIDEO_IDS.split(",") if v],
        "activatedAt": datetime.utcnow().isoformat() + "Z",
    }, merge=True)
    db.collection("model_registry").document("active").set({
        "runId": RUN_ID,
        "modelUri": model_uri,
        "metrics": metrics,
        "activatedAt": datetime.utcnow().isoformat() + "Z",
    })
    log(f"model activated: {model_uri}")


def notify_tracking(model_uri: str):
    if not TRACKING_RELOAD_URL:
        log("no TRACKING_RELOAD_URL -> skip notify")
        return
    try:
        headers = {"Content-Type": "application/json"}
        if TRACKING_RELOAD_TOKEN:
            headers["X-Reload-Token"] = TRACKING_RELOAD_TOKEN
        r = requests.post(
            TRACKING_RELOAD_URL,
            json={"modelUri": model_uri, "runId": RUN_ID},
            headers=headers,
            timeout=60,
        )
        log(f"tracking notify: {r.status_code} {r.text[:200]}")
    except Exception as e:
        log(f"tracking notify failed: {e}")


def main():
    try:
        set_run_state("starting", baseModel=BASE_MODEL, imgsz=IMGSZ,
                      epochs=EPOCHS, batch=BATCH)

        set_run_state("exporting")
        n_train, n_val = export_dataset()
        if n_train < 20:
            raise RuntimeError(f"Not enough training samples: {n_train}")

        set_run_state("training", nTrain=n_train, nVal=n_val)
        best = run_yolo()

        set_run_state("uploading")
        metrics = read_metrics()
        uri = upload_model(best)

        set_run_state("publishing", metrics=metrics, modelUri=uri)
        activate_model(uri, metrics)

        notify_tracking(uri)

        set_run_state("succeeded", metrics=metrics, modelUri=uri)
        log("DONE")
    except Exception as e:
        log(f"FAILED: {e}")
        set_run_state("failed", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
