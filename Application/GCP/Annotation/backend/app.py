"""
Backend Flask pour la validation manuelle des détections ballon.

Endpoints :
  GET  /api/frames?videoId=...&status=pending&limit=50&orderBy=confidence
  GET  /api/frames/<docId>
  GET  /api/frames/<docId>/image     (redirection vers URL signée GCS)
  POST /api/annotation               body: {docId, label, correctedBox?}
  GET  /api/stats?videoId=...
  GET  /                             sert le frontend statique

Firestore collection : "annotations"
Document fields : voir extract_frames.py
"""

import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, redirect, send_from_directory
from google.cloud import firestore, storage

try:
    # Vertex AI n'est utilisé que pour le endpoint /api/train
    from google.cloud import aiplatform
    HAS_VERTEX = True
except ImportError:
    HAS_VERTEX = False


PROJECT = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT")
BUCKET = os.environ.get("ANNOTATION_BUCKET", "ia-sport-annotations")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
STATIC_DIR = os.path.abspath(STATIC_DIR)

# -- Training config --------------------------------------------------------
TRAINER_IMAGE = os.environ.get("TRAINER_IMAGE", "")            # ex: europe-docker.pkg.dev/<proj>/iasv/trainer:latest
TRAINING_REGION = os.environ.get("TRAINING_REGION", "europe-west1")
TRAINING_BUCKET = os.environ.get("TRAINING_BUCKET", BUCKET)     # staging Vertex + modèles
MODEL_BUCKET = os.environ.get("MODEL_BUCKET", BUCKET)
TRAINING_MACHINE = os.environ.get("TRAINING_MACHINE", "n1-standard-8")
TRAINING_GPU_TYPE = os.environ.get("TRAINING_GPU_TYPE", "NVIDIA_TESLA_T4")  # "" pour CPU
TRAINING_GPU_COUNT = int(os.environ.get("TRAINING_GPU_COUNT", "1"))
TRAINING_SERVICE_ACCOUNT = os.environ.get("TRAINING_SERVICE_ACCOUNT", "")    # obligatoire pour Vertex
TRACKING_RELOAD_URL = os.environ.get("TRACKING_RELOAD_URL", "")
TRACKING_RELOAD_TOKEN = os.environ.get("TRACKING_RELOAD_TOKEN", "")

MIN_TRUE_BALL_TO_TRAIN = int(os.environ.get("MIN_TRUE_BALL_TO_TRAIN", "30"))

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")

db = firestore.Client(project=PROJECT)
storage_client = storage.Client(project=PROJECT)

VALID_LABELS = {"true_ball", "false_positive", "no_ball"}


# ---------------------------------------------------------------------------
# Frontend (servi depuis le même service pour simplifier)
# ---------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/<path:filename>", methods=["GET"])
def frontend_file(filename):
    # Sert les fichiers du frontend (app.js, styles.css, favicon, etc.)
    full = os.path.join(STATIC_DIR, filename)
    if os.path.isfile(full):
        return send_from_directory(STATIC_DIR, filename)
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/healthz", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _signed_url(gs_url: str, minutes: int = 30) -> str:
    if not gs_url or not gs_url.startswith("gs://"):
        return ""
    without = gs_url.replace("gs://", "", 1)
    bucket_name, blob_name = without.split("/", 1)
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    try:
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=minutes),
            method="GET",
        )
    except Exception as e:
        # En dev local sans credentials signés : fallback URL publique
        print(f"[signed-url] fallback: {e}")
        return f"https://storage.googleapis.com/{bucket_name}/{blob_name}"


def _serialize(doc) -> dict:
    data = doc.to_dict() or {}
    data["id"] = doc.id
    # URLs signées
    if data.get("imageAnnotated"):
        data["imageAnnotatedUrl"] = _signed_url(data["imageAnnotated"])
    if data.get("imageRaw"):
        data["imageRawUrl"] = _signed_url(data["imageRaw"])
    return data


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
@app.route("/api/frames", methods=["GET"])
def list_frames():
    video_id = request.args.get("videoId")
    status = request.args.get("status", "pending")   # pending | annotated | all
    order_by = request.args.get("orderBy", "confidence")  # confidence | frame
    limit = int(request.args.get("limit", 50))

    try:
        q = db.collection("annotations")
        if video_id:
            q = q.where("videoId", "==", video_id)
        if status != "all":
            q = q.where("status", "==", status)
        if order_by == "confidence":
            q = q.order_by("confidence")  # confiance la plus basse d'abord
        else:
            q = q.order_by("frame")
        q = q.limit(limit)

        items = [_serialize(d) for d in q.stream()]
        return jsonify({"status": "ok", "count": len(items), "items": items}), 200
    except Exception as e:
        print(f"[api/frames][error] {e}")
        return jsonify({"error": "list failed", "details": str(e)}), 500


@app.route("/api/frames/<doc_id>", methods=["GET"])
def get_frame(doc_id):
    try:
        doc = db.collection("annotations").document(doc_id).get()
        if not doc.exists:
            return jsonify({"error": "not found"}), 404
        return jsonify(_serialize(doc)), 200
    except Exception as e:
        return jsonify({"error": "get failed", "details": str(e)}), 500


@app.route("/api/frames/<doc_id>/image", methods=["GET"])
def get_image_redirect(doc_id):
    """Redirige vers une URL signée de l'image annotée (pour <img src=>)."""
    which = request.args.get("type", "annotated")   # annotated | raw
    try:
        doc = db.collection("annotations").document(doc_id).get()
        if not doc.exists:
            return jsonify({"error": "not found"}), 404
        data = doc.to_dict()
        field = "imageAnnotated" if which == "annotated" else "imageRaw"
        gs = data.get(field)
        if not gs:
            return jsonify({"error": "no image"}), 404
        return redirect(_signed_url(gs), code=302)
    except Exception as e:
        return jsonify({"error": "image failed", "details": str(e)}), 500


@app.route("/api/annotation", methods=["POST"])
def save_annotation():
    data = request.get_json(force=True) or {}
    doc_id = data.get("docId")
    label = data.get("label")
    corrected = data.get("correctedBox")   # {x,y,w,h} optionnel
    annotator = data.get("annotator", "anonymous")

    if not doc_id or label not in VALID_LABELS:
        return jsonify({
            "error": "invalid payload",
            "expected": {"docId": "str", "label": list(VALID_LABELS)},
        }), 400

    try:
        ref = db.collection("annotations").document(doc_id)
        snap = ref.get()
        if not snap.exists:
            return jsonify({"error": "doc not found"}), 404

        update = {
            "label": label,
            "status": "annotated",
            "annotatedAt": datetime.utcnow().isoformat() + "Z",
            "annotator": annotator,
        }
        if corrected is not None:
            # Validation minimale
            try:
                cb = {
                    "x": int(corrected["x"]),
                    "y": int(corrected["y"]),
                    "w": int(corrected["w"]),
                    "h": int(corrected["h"]),
                }
            except Exception:
                return jsonify({"error": "invalid correctedBox"}), 400
            update["correctedBox"] = cb

        ref.set(update, merge=True)
        return jsonify({"status": "ok", "id": doc_id}), 200
    except Exception as e:
        print(f"[api/annotation][error] {e}")
        return jsonify({"error": "save failed", "details": str(e)}), 500


@app.route("/api/stats", methods=["GET"])
def stats():
    video_id = request.args.get("videoId")
    try:
        q = db.collection("annotations")
        if video_id:
            q = q.where("videoId", "==", video_id)
        total = pending = annotated = 0
        true_ball = fp = no_ball = 0
        for d in q.stream():
            data = d.to_dict()
            total += 1
            if data.get("status") == "annotated":
                annotated += 1
                lbl = data.get("label")
                if lbl == "true_ball": true_ball += 1
                elif lbl == "false_positive": fp += 1
                elif lbl == "no_ball": no_ball += 1
            else:
                pending += 1
        return jsonify({
            "status": "ok",
            "videoId": video_id,
            "total": total,
            "pending": pending,
            "annotated": annotated,
            "labels": {
                "true_ball": true_ball,
                "false_positive": fp,
                "no_ball": no_ball,
            },
        }), 200
    except Exception as e:
        return jsonify({"error": "stats failed", "details": str(e)}), 500


@app.route("/api/videos", methods=["GET"])
def list_videos():
    """Liste les videoId distincts présents dans Firestore."""
    try:
        seen = {}
        for d in db.collection("annotations").select(["videoId", "status"]).stream():
            data = d.to_dict()
            vid = data.get("videoId")
            if not vid:
                continue
            if vid not in seen:
                seen[vid] = {"videoId": vid, "total": 0, "pending": 0}
            seen[vid]["total"] += 1
            if data.get("status") != "annotated":
                seen[vid]["pending"] += 1
        return jsonify({"status": "ok", "videos": list(seen.values())}), 200
    except Exception as e:
        return jsonify({"error": "list videos failed", "details": str(e)}), 500


# ===========================================================================
# Training endpoints
# ===========================================================================
@app.route("/api/train/readiness", methods=["GET"])
def train_readiness():
    """Renvoie si on a assez d'annotations true_ball pour lancer un entraînement."""
    video_ids = request.args.get("videoIds", "")
    ids = {v.strip() for v in video_ids.split(",") if v.strip()}

    try:
        q = db.collection("annotations").where("status", "==", "annotated")
        n_true = n_fp = n_no = n_total = 0
        pending = 0
        all_q = db.collection("annotations")
        for d in all_q.stream():
            data = d.to_dict()
            if ids and data.get("videoId") not in ids:
                continue
            if data.get("status") != "annotated":
                pending += 1
                continue
            n_total += 1
            lbl = data.get("label")
            if lbl == "true_ball": n_true += 1
            elif lbl == "false_positive": n_fp += 1
            elif lbl == "no_ball": n_no += 1

        ready = (n_true >= MIN_TRUE_BALL_TO_TRAIN and pending == 0)
        return jsonify({
            "ready": ready,
            "pending": pending,
            "annotated": n_total,
            "trueBall": n_true,
            "falsePositive": n_fp,
            "noBall": n_no,
            "minRequired": MIN_TRUE_BALL_TO_TRAIN,
            "reason": (
                None if ready
                else ("annotations incomplètes" if pending > 0
                      else f"pas assez de true_ball ({n_true} < {MIN_TRUE_BALL_TO_TRAIN})")
            ),
        }), 200
    except Exception as e:
        return jsonify({"error": "readiness failed", "details": str(e)}), 500


@app.route("/api/train", methods=["POST"])
def train_start():
    """
    Déclenche un Vertex AI Custom Job qui :
      - exporte le dataset depuis Firestore
      - entraîne YOLO
      - publie best.pt dans gs://MODEL_BUCKET/models/ball_<runId>.pt
      - marque ce modèle comme actif dans Firestore (model_registry/active)
      - notifie le service de tracking
    """
    if not HAS_VERTEX:
        return jsonify({
            "error": "google-cloud-aiplatform not installed",
            "details": "pip install google-cloud-aiplatform",
        }), 500
    if not TRAINER_IMAGE:
        return jsonify({
            "error": "TRAINER_IMAGE env var not set",
            "hint": "ex: europe-docker.pkg.dev/<proj>/iasv/trainer:latest",
        }), 500

    data = request.get_json(silent=True) or {}
    base_model = data.get("baseModel", "yolov8s.pt")
    epochs = int(data.get("epochs", 80))
    imgsz = int(data.get("imgsz", 1280))
    batch = int(data.get("batch", 8))
    patience = int(data.get("patience", 20))
    video_ids = data.get("videoIds", "")
    if isinstance(video_ids, list):
        video_ids = ",".join(video_ids)

    run_id = data.get("runId") or datetime.utcnow().strftime("v%Y%m%d-%H%M%S")

    try:
        # Marqueur dans Firestore AVANT le submit pour que le frontend
        # puisse déjà poller.
        db.collection("model_registry").document(run_id).set({
            "runId": run_id,
            "state": "queued",
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "baseModel": base_model,
            "epochs": epochs,
            "imgsz": imgsz,
            "batch": batch,
            "videoIds": video_ids,
        }, merge=True)

        aiplatform.init(
            project=PROJECT,
            location=TRAINING_REGION,
            staging_bucket=f"gs://{TRAINING_BUCKET}",
        )

        env_vars = {
            "GCP_PROJECT": PROJECT,
            "MODEL_BUCKET": MODEL_BUCKET,
            "RUN_ID": run_id,
            "BASE_MODEL": base_model,
            "EPOCHS": str(epochs),
            "IMGSZ": str(imgsz),
            "BATCH": str(batch),
            "PATIENCE": str(patience),
            "VIDEO_IDS": video_ids,
            "TRACKING_RELOAD_URL": TRACKING_RELOAD_URL,
            "TRACKING_RELOAD_TOKEN": TRACKING_RELOAD_TOKEN,
            "USE_GPU": "1" if TRAINING_GPU_TYPE else "0",
        }

        worker_pool = {
            "machine_spec": {
                "machine_type": TRAINING_MACHINE,
            },
            "replica_count": 1,
            "container_spec": {
                "image_uri": TRAINER_IMAGE,
                "env": [{"name": k, "value": v} for k, v in env_vars.items()],
            },
        }
        if TRAINING_GPU_TYPE:
            worker_pool["machine_spec"]["accelerator_type"] = TRAINING_GPU_TYPE
            worker_pool["machine_spec"]["accelerator_count"] = TRAINING_GPU_COUNT

        job = aiplatform.CustomJob(
            display_name=f"iasv-train-{run_id}",
            worker_pool_specs=[worker_pool],
        )
        # submit() rend la main immédiatement, le job continue côté Vertex.
        job.submit(
            service_account=TRAINING_SERVICE_ACCOUNT or None,
        )

        resource_name = job.resource_name
        db.collection("model_registry").document(run_id).set({
            "vertexJobResource": resource_name,
            "state": "submitted",
            "submittedAt": datetime.utcnow().isoformat() + "Z",
        }, merge=True)

        return jsonify({
            "status": "ok",
            "runId": run_id,
            "vertexJobResource": resource_name,
        }), 202

    except Exception as e:
        print(f"[api/train][error] {e}")
        db.collection("model_registry").document(run_id).set({
            "state": "failed",
            "error": str(e),
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        }, merge=True)
        return jsonify({"error": "train submit failed", "details": str(e)}), 500


@app.route("/api/train/status", methods=["GET"])
def train_status():
    run_id = request.args.get("runId")
    if not run_id:
        return jsonify({"error": "missing runId"}), 400
    try:
        doc = db.collection("model_registry").document(run_id).get()
        if not doc.exists:
            return jsonify({"error": "run not found"}), 404
        return jsonify({"status": "ok", "run": doc.to_dict()}), 200
    except Exception as e:
        return jsonify({"error": "status failed", "details": str(e)}), 500


@app.route("/api/model/versions", methods=["GET"])
def model_versions():
    try:
        runs = []
        for d in db.collection("model_registry").stream():
            if d.id == "active":
                continue
            runs.append({"runId": d.id, **(d.to_dict() or {})})
        runs.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
        active = db.collection("model_registry").document("active").get()
        return jsonify({
            "status": "ok",
            "active": active.to_dict() if active.exists else None,
            "runs": runs[:50],
        }), 200
    except Exception as e:
        return jsonify({"error": "versions failed", "details": str(e)}), 500


@app.route("/api/model/activate", methods=["POST"])
def model_activate():
    """Permet de réactiver manuellement une version ancienne (rollback)."""
    data = request.get_json(force=True) or {}
    run_id = data.get("runId")
    if not run_id:
        return jsonify({"error": "missing runId"}), 400
    try:
        doc = db.collection("model_registry").document(run_id).get()
        if not doc.exists:
            return jsonify({"error": "run not found"}), 404
        run = doc.to_dict()
        if not run.get("modelUri"):
            return jsonify({"error": "run has no modelUri"}), 400
        db.collection("model_registry").document("active").set({
            "runId": run_id,
            "modelUri": run["modelUri"],
            "metrics": run.get("metrics", {}),
            "activatedAt": datetime.utcnow().isoformat() + "Z",
        })
        # Notifier le tracking
        if TRACKING_RELOAD_URL:
            import requests
            headers = {"Content-Type": "application/json"}
            if TRACKING_RELOAD_TOKEN:
                headers["X-Reload-Token"] = TRACKING_RELOAD_TOKEN
            try:
                requests.post(TRACKING_RELOAD_URL, json={
                    "modelUri": run["modelUri"], "runId": run_id,
                }, headers=headers, timeout=60)
            except Exception as e:
                print(f"[model/activate] notify failed: {e}")
        return jsonify({"status": "ok", "runId": run_id}), 200
    except Exception as e:
        return jsonify({"error": "activate failed", "details": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
