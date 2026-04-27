import os
import subprocess
import threading
from datetime import datetime
from flask import Flask, request, jsonify, redirect, send_from_directory, Response
from google.cloud import storage
import cv2
from ultralytics import YOLO

try:
    from google.cloud import firestore
    HAS_FIRESTORE = True
except ImportError:
    HAS_FIRESTORE = False

try:
    from google.cloud import aiplatform
    HAS_VERTEX = True
except ImportError:
    HAS_VERTEX = False

try:
    import requests as _requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

from ball_tracker import run_ball_tracking
from ball_tracker.cropper import crop_video_around_ball

app = Flask(__name__)

GCS_BUCKET = os.environ.get("GCS_BUCKET", "ia-sport_cloudbuild")

# ---------------------------------------------------------------------------
# Annotation / Training config
# ---------------------------------------------------------------------------
ANNOTATION_BUCKET    = os.environ.get("ANNOTATION_BUCKET", "ia-sport-annotations")
TRAINER_IMAGE        = os.environ.get("TRAINER_IMAGE", "")
TRAINING_REGION      = os.environ.get("TRAINING_REGION", "europe-west1")
TRAINING_BUCKET      = os.environ.get("TRAINING_BUCKET", ANNOTATION_BUCKET)
MODEL_BUCKET         = os.environ.get("MODEL_BUCKET", ANNOTATION_BUCKET)
TRAINING_MACHINE     = os.environ.get("TRAINING_MACHINE", "n1-standard-8")
TRAINING_GPU_TYPE    = os.environ.get("TRAINING_GPU_TYPE", "NVIDIA_TESLA_T4")
TRAINING_GPU_COUNT   = int(os.environ.get("TRAINING_GPU_COUNT", "1"))
TRAINING_SERVICE_ACCOUNT = os.environ.get("TRAINING_SERVICE_ACCOUNT", "")
TRACKING_RELOAD_URL  = os.environ.get("TRACKING_RELOAD_URL", "")
ANNOT_RELOAD_TOKEN   = os.environ.get("TRACKING_RELOAD_TOKEN", "")
MIN_TRUE_BALL_TO_TRAIN = int(os.environ.get("MIN_TRUE_BALL_TO_TRAIN", "30"))
VALID_LABELS = {"true_ball", "false_positive", "no_ball"}

ANNOTATION_FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))

# Lazy singletons for Firestore / Storage used by annotation routes
_annot_db = None
_annot_storage = None

def _get_db():
    global _annot_db
    if _annot_db is None:
        _annot_db = firestore.Client(project=GCP_PROJECT, database="annotations")
    return _annot_db

def _get_storage():
    global _annot_storage
    if _annot_storage is None:
        _annot_storage = storage.Client()
    return _annot_storage

def _signed_url(gs_url: str, minutes: int = 30) -> str:
    if not gs_url or not gs_url.startswith("gs://"):
        return ""
    without = gs_url.replace("gs://", "", 1)
    bucket_name, blob_name = without.split("/", 1)
    bucket = _get_storage().bucket(bucket_name)
    blob = bucket.blob(blob_name)
    try:
        from datetime import timedelta as _td
        return blob.generate_signed_url(
            version="v4",
            expiration=_td(minutes=minutes),
            method="GET",
        )
    except Exception as e:
        print(f"[signed-url] fallback: {e}")
        return f"https://storage.googleapis.com/{bucket_name}/{blob_name}"

def _serialize_annot(doc) -> dict:
    data = doc.to_dict() or {}
    data["id"] = doc.id
    # Utilise le proxy Flask au lieu des signed URLs (évite les problèmes IAM sur Cloud Run)
    data["imageAnnotatedUrl"] = f"/api/frames/{doc.id}/image?type=annotated"
    data["imageRawUrl"] = f"/api/frames/{doc.id}/image?type=raw"
    return data

# ---------------------------------------------------------------------------
# Model registry (runtime hot-reload)
# ---------------------------------------------------------------------------
# Priorité de sélection du modèle YOLO :
#   1. Firestore `model_registry/active` (si GCP_PROJECT + use_registry)
#   2. variable d'env YOLO_MODEL_PATH
#   3. défaut yolov8n.pt
GCP_PROJECT = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT")
USE_MODEL_REGISTRY = os.environ.get("USE_MODEL_REGISTRY", "1") == "1"
RELOAD_TOKEN = os.environ.get("TRACKING_RELOAD_TOKEN", "")
LOCAL_MODEL_DIR = "/tmp/models"
os.makedirs(LOCAL_MODEL_DIR, exist_ok=True)

_model_lock = threading.Lock()
_current_model_info = {"runId": None, "modelUri": None, "localPath": None}


def _download_model(model_uri: str) -> str:
    """Télécharge un modèle .pt depuis gs://... vers /tmp/models/."""
    if not model_uri.startswith("gs://"):
        return model_uri  # chemin local déjà
    without = model_uri.replace("gs://", "", 1)
    bucket_name, blob_name = without.split("/", 1)
    local = os.path.join(LOCAL_MODEL_DIR, os.path.basename(blob_name))
    client = storage.Client()
    client.bucket(bucket_name).blob(blob_name).download_to_filename(local)
    print(f"[model] downloaded {model_uri} -> {local}")
    return local


def _resolve_initial_model() -> str:
    """Au démarrage : interroge Firestore pour le modèle actif, sinon fallback env."""
    if USE_MODEL_REGISTRY and HAS_FIRESTORE and GCP_PROJECT:
        try:
            db = firestore.Client(project=GCP_PROJECT, database="annotations")
            doc = db.collection("model_registry").document("active").get()
            if doc.exists:
                data = doc.to_dict() or {}
                uri = data.get("modelUri")
                if uri:
                    local = _download_model(uri)
                    _current_model_info.update({
                        "runId": data.get("runId"),
                        "modelUri": uri,
                        "localPath": local,
                    })
                    print(f"[model] using registry active: runId={data.get('runId')}")
                    return local
        except Exception as e:
            print(f"[model] registry lookup failed: {e}")
    fallback = os.environ.get("YOLO_MODEL_PATH", "yolov8n.pt")
    _current_model_info["localPath"] = fallback
    return fallback


YOLO_MODEL_PATH = _resolve_initial_model()
print(f"[yolo] Loading model: {YOLO_MODEL_PATH}")
yolo_model = YOLO(YOLO_MODEL_PATH)
print("[yolo] Model loaded.")


def _swap_model(new_uri: str, run_id: str = None):
    """Remplace le modèle en mémoire de manière thread-safe."""
    local = _download_model(new_uri)
    new_model = YOLO(local)
    with _model_lock:
        global yolo_model
        yolo_model = new_model
        _current_model_info.update({
            "runId": run_id, "modelUri": new_uri, "localPath": local,
        })
    print(f"[model] hot-swap ok -> runId={run_id} uri={new_uri}")


@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"}), 200


# ===========================================================================
# Annotation frontend (served at /annotation)
# ===========================================================================
@app.route("/annotation")
@app.route("/annotation/")
def annotation_index():
    return send_from_directory(ANNOTATION_FRONTEND_DIR, "index.html")

@app.route("/annotation/<path:filename>")
def annotation_static(filename):
    full = os.path.join(ANNOTATION_FRONTEND_DIR, filename)
    if os.path.isfile(full):
        return send_from_directory(ANNOTATION_FRONTEND_DIR, filename)
    return send_from_directory(ANNOTATION_FRONTEND_DIR, "index.html")


# ===========================================================================
# Annotation API
# ===========================================================================
@app.route("/api/videos", methods=["GET"])
def api_list_videos():
    try:
        seen = {}
        for d in _get_db().collection("annotations").select(["videoId", "status"]).stream():
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


@app.route("/api/frames", methods=["GET"])
def api_list_frames():
    video_id = request.args.get("videoId")
    status = request.args.get("status", "pending")
    order_by = request.args.get("orderBy", "confidence")
    limit = int(request.args.get("limit", 50))
    try:
        q = _get_db().collection("annotations")
        if video_id:
            q = q.where("videoId", "==", video_id)
        if status != "all":
            q = q.where("status", "==", status)
        # Tri en mémoire pour éviter les index composites Firestore
        items = [_serialize_annot(d) for d in q.stream()]
        reverse = order_by == "confidence"  # confidence ↑ = difficiles (valeurs basses) d'abord
        items.sort(key=lambda x: x.get(order_by, 0), reverse=not reverse)
        items = items[:limit]
        return jsonify({"status": "ok", "count": len(items), "items": items}), 200
    except Exception as e:
        print(f"[api/frames][error] {e}")
        return jsonify({"error": "list failed", "details": str(e)}), 500


@app.route("/api/frames/<doc_id>", methods=["GET"])
def api_get_frame(doc_id):
    try:
        doc = _get_db().collection("annotations").document(doc_id).get()
        if not doc.exists:
            return jsonify({"error": "not found"}), 404
        return jsonify(_serialize_annot(doc)), 200
    except Exception as e:
        return jsonify({"error": "get failed", "details": str(e)}), 500


@app.route("/api/frames/<doc_id>/image", methods=["GET"])
def api_get_image_redirect(doc_id):
    which = request.args.get("type", "annotated")
    try:
        doc = _get_db().collection("annotations").document(doc_id).get()
        if not doc.exists:
            return jsonify({"error": "not found"}), 404
        data = doc.to_dict()
        field = "imageAnnotated" if which == "annotated" else "imageRaw"
        gs = data.get(field)
        if not gs:
            return jsonify({"error": "no image"}), 404
        # Proxy direct depuis GCS — pas besoin de signed URL
        without = gs.replace("gs://", "", 1)
        bucket_name, blob_name = without.split("/", 1)
        blob = _get_storage().bucket(bucket_name).blob(blob_name)
        img_bytes = blob.download_as_bytes()
        return Response(img_bytes, mimetype="image/jpeg")
    except Exception as e:
        return jsonify({"error": "image failed", "details": str(e)}), 500


@app.route("/api/annotation", methods=["POST"])
def api_save_annotation():
    data = request.get_json(force=True) or {}
    doc_id = data.get("docId")
    label = data.get("label")
    corrected = data.get("correctedBox")
    if not doc_id or label not in VALID_LABELS:
        return jsonify({"error": "invalid payload",
                        "expected": {"docId": "str", "label": list(VALID_LABELS)}}), 400
    try:
        ref = _get_db().collection("annotations").document(doc_id)
        if not ref.get().exists:
            return jsonify({"error": "doc not found"}), 404
        update = {
            "label": label,
            "status": "annotated",
            "annotatedAt": datetime.utcnow().isoformat() + "Z",
        }
        if corrected is not None:
            try:
                update["correctedBox"] = {
                    "x": int(corrected["x"]), "y": int(corrected["y"]),
                    "w": int(corrected["w"]), "h": int(corrected["h"]),
                }
            except Exception:
                return jsonify({"error": "invalid correctedBox"}), 400
        ref.set(update, merge=True)
        return jsonify({"status": "ok", "id": doc_id}), 200
    except Exception as e:
        print(f"[api/annotation][error] {e}")
        return jsonify({"error": "save failed", "details": str(e)}), 500


@app.route("/api/stats", methods=["GET"])
def api_stats():
    video_id = request.args.get("videoId")
    try:
        q = _get_db().collection("annotations")
        if video_id:
            q = q.where("videoId", "==", video_id)
        total = pending = annotated = true_ball = fp = no_ball = 0
        for d in q.stream():
            row = d.to_dict()
            total += 1
            if row.get("status") == "annotated":
                annotated += 1
                lbl = row.get("label")
                if lbl == "true_ball": true_ball += 1
                elif lbl == "false_positive": fp += 1
                elif lbl == "no_ball": no_ball += 1
            else:
                pending += 1
        return jsonify({"status": "ok", "videoId": video_id, "total": total,
                        "pending": pending, "annotated": annotated,
                        "labels": {"true_ball": true_ball, "false_positive": fp, "no_ball": no_ball}}), 200
    except Exception as e:
        return jsonify({"error": "stats failed", "details": str(e)}), 500


# ---------------------------------------------------------------------------
# Training endpoints
# ---------------------------------------------------------------------------
@app.route("/api/train/readiness", methods=["GET"])
def api_train_readiness():
    video_ids_param = request.args.get("videoIds", "")
    ids = {v.strip() for v in video_ids_param.split(",") if v.strip()}
    try:
        n_true = n_fp = n_no = n_total = pending = 0
        for d in _get_db().collection("annotations").stream():
            row = d.to_dict()
            if ids and row.get("videoId") not in ids:
                continue
            if row.get("status") != "annotated":
                pending += 1
                continue
            n_total += 1
            lbl = row.get("label")
            if lbl == "true_ball": n_true += 1
            elif lbl == "false_positive": n_fp += 1
            elif lbl == "no_ball": n_no += 1
        ready = (n_true >= MIN_TRUE_BALL_TO_TRAIN and pending == 0)
        return jsonify({
            "ready": ready, "pending": pending, "annotated": n_total,
            "trueBall": n_true, "falsePositive": n_fp, "noBall": n_no,
            "minRequired": MIN_TRUE_BALL_TO_TRAIN,
            "reason": (None if ready else
                       ("annotations incomplètes" if pending > 0
                        else f"pas assez de true_ball ({n_true} < {MIN_TRUE_BALL_TO_TRAIN})")),
        }), 200
    except Exception as e:
        return jsonify({"error": "readiness failed", "details": str(e)}), 500


@app.route("/api/train", methods=["POST"])
def api_train_start():
    if not HAS_VERTEX:
        return jsonify({"error": "google-cloud-aiplatform not installed"}), 500
    if not TRAINER_IMAGE:
        return jsonify({"error": "TRAINER_IMAGE env var not set"}), 500

    data = request.get_json(silent=True) or {}
    base_model  = data.get("baseModel", "yolov8s.pt")
    epochs      = int(data.get("epochs", 80))
    imgsz       = int(data.get("imgsz", 1280))
    batch       = int(data.get("batch", 8))
    patience    = int(data.get("patience", 20))
    video_ids   = data.get("videoIds", "")
    if isinstance(video_ids, list):
        video_ids = ",".join(video_ids)
    run_id = data.get("runId") or datetime.utcnow().strftime("v%Y%m%d-%H%M%S")

    try:
        _get_db().collection("model_registry").document(run_id).set({
            "runId": run_id, "state": "queued",
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "baseModel": base_model, "epochs": epochs,
            "imgsz": imgsz, "batch": batch, "videoIds": video_ids,
        }, merge=True)

        aiplatform.init(
            project=GCP_PROJECT, location=TRAINING_REGION,
            staging_bucket=f"gs://{TRAINING_BUCKET}",
        )
        env_vars = {
            "GCP_PROJECT": GCP_PROJECT or "",
            "MODEL_BUCKET": MODEL_BUCKET,
            "RUN_ID": run_id, "BASE_MODEL": base_model,
            "EPOCHS": str(epochs), "IMGSZ": str(imgsz),
            "BATCH": str(batch), "PATIENCE": str(patience),
            "VIDEO_IDS": video_ids or "",
            "TRACKING_RELOAD_URL": TRACKING_RELOAD_URL or "",
            "TRACKING_RELOAD_TOKEN": ANNOT_RELOAD_TOKEN or "",
            "USE_GPU": "1" if TRAINING_GPU_TYPE else "0",
        }
        worker_pool = {
            "machine_spec": {"machine_type": TRAINING_MACHINE},
            "replica_count": 1,
            "container_spec": {
                "image_uri": TRAINER_IMAGE,
                # Vertex AI rejette les valeurs vides — on les filtre
                "env": [{"name": k, "value": v} for k, v in env_vars.items() if v],
            },
        }
        if TRAINING_GPU_TYPE:
            worker_pool["machine_spec"]["accelerator_type"] = TRAINING_GPU_TYPE
            worker_pool["machine_spec"]["accelerator_count"] = TRAINING_GPU_COUNT

        job = aiplatform.CustomJob(
            display_name=f"iasv-train-{run_id}",
            worker_pool_specs=[worker_pool],
        )
        job.submit(service_account=TRAINING_SERVICE_ACCOUNT or None)
        resource_name = job.resource_name
        _get_db().collection("model_registry").document(run_id).set({
            "vertexJobResource": resource_name,
            "state": "submitted",
            "submittedAt": datetime.utcnow().isoformat() + "Z",
        }, merge=True)
        return jsonify({"status": "ok", "runId": run_id,
                        "vertexJobResource": resource_name}), 202
    except Exception as e:
        print(f"[api/train][error] {e}")
        _get_db().collection("model_registry").document(run_id).set({
            "state": "failed", "error": str(e),
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        }, merge=True)
        return jsonify({"error": "train submit failed", "details": str(e)}), 500


@app.route("/api/train/status", methods=["GET"])
def api_train_status():
    run_id = request.args.get("runId")
    if not run_id:
        return jsonify({"error": "missing runId"}), 400
    try:
        doc = _get_db().collection("model_registry").document(run_id).get()
        if not doc.exists:
            return jsonify({"error": "run not found"}), 404
        return jsonify({"status": "ok", "run": doc.to_dict()}), 200
    except Exception as e:
        return jsonify({"error": "status failed", "details": str(e)}), 500


@app.route("/api/model/versions", methods=["GET"])
def api_model_versions():
    try:
        runs = []
        for d in _get_db().collection("model_registry").stream():
            if d.id == "active":
                continue
            runs.append({"runId": d.id, **(d.to_dict() or {})})
        runs.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
        active = _get_db().collection("model_registry").document("active").get()
        return jsonify({
            "status": "ok",
            "active": active.to_dict() if active.exists else None,
            "runs": runs[:50],
        }), 200
    except Exception as e:
        return jsonify({"error": "versions failed", "details": str(e)}), 500


@app.route("/api/model/activate", methods=["POST"])
def api_model_activate():
    data = request.get_json(force=True) or {}
    run_id = data.get("runId")
    if not run_id:
        return jsonify({"error": "missing runId"}), 400
    try:
        doc = _get_db().collection("model_registry").document(run_id).get()
        if not doc.exists:
            return jsonify({"error": "run not found"}), 404
        run = doc.to_dict()
        if not run.get("modelUri"):
            return jsonify({"error": "run has no modelUri"}), 400
        _get_db().collection("model_registry").document("active").set({
            "runId": run_id, "modelUri": run["modelUri"],
            "metrics": run.get("metrics", {}),
            "activatedAt": datetime.utcnow().isoformat() + "Z",
        })
        if TRACKING_RELOAD_URL and HAS_REQUESTS:
            headers = {"Content-Type": "application/json"}
            if ANNOT_RELOAD_TOKEN:
                headers["X-Reload-Token"] = ANNOT_RELOAD_TOKEN
            try:
                _requests.post(TRACKING_RELOAD_URL,
                               json={"modelUri": run["modelUri"], "runId": run_id},
                               headers=headers, timeout=60)
            except Exception as notify_err:
                print(f"[model/activate] notify failed: {notify_err}")
        return jsonify({"status": "ok", "runId": run_id}), 200
    except Exception as e:
        return jsonify({"error": "activate failed", "details": str(e)}), 500


@app.route("/admin/current-model", methods=["GET"])
def current_model():
    return jsonify(_current_model_info), 200


@app.route("/admin/reload-model", methods=["POST"])
def reload_model():
    """
    Recharge le modèle YOLO à chaud.
    Appelé :
      - par le Trainer à la fin d'un run (avec header X-Reload-Token)
      - par l'Annotation backend sur activation manuelle

    Body :
      {"modelUri": "gs://bucket/models/ball_vXXX.pt", "runId": "vXXX"}
    OU  {} (relit Firestore model_registry/active)
    """
    if RELOAD_TOKEN:
        token = request.headers.get("X-Reload-Token", "")
        if token != RELOAD_TOKEN:
            return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    model_uri = data.get("modelUri")
    run_id = data.get("runId")

    try:
        if not model_uri and HAS_FIRESTORE and GCP_PROJECT:
            db = firestore.Client(project=GCP_PROJECT, database="annotations")
            doc = db.collection("model_registry").document("active").get()
            if not doc.exists:
                return jsonify({"error": "no active model in registry"}), 404
            d = doc.to_dict() or {}
            model_uri = d.get("modelUri")
            run_id = d.get("runId")

        if not model_uri:
            return jsonify({"error": "missing modelUri"}), 400

        _swap_model(model_uri, run_id)
        return jsonify({"status": "ok", "current": _current_model_info}), 200

    except Exception as e:
        print(f"[reload-model][error] {e}")
        return jsonify({"error": "reload failed", "details": str(e)}), 500


def download_from_gcs(gs_url, local_path):
    # gs://bucket/path/to/file.mp4
    without_scheme = gs_url.replace("gs://", "", 1)
    bucket_name, blob_name = without_scheme.split("/", 1)

    print(f"[gcs] Downloading bucket={bucket_name}, blob={blob_name}")

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    blob.download_to_filename(local_path)

    return bucket_name, blob_name


@app.route("/process", methods=["POST"])
def process():
    data = request.get_json(force=True)

    if not data or "videoUrl" not in data:
        return jsonify({"error": "Missing 'videoUrl' in request body"}), 400

    video_url = data["videoUrl"]

    input_path = "/tmp/input.mp4"
    output_path = "/tmp/output.mp4"

    print(f"[process] Received videoUrl: {video_url}")

    try:
        # 1. Input
        if video_url.startswith("gs://"):
            download_from_gcs(video_url, input_path)
            ffmpeg_input = input_path
        else:
            ffmpeg_input = video_url

        # 2. ffmpeg crop
        cmd = [
            "ffmpeg",
            "-y",
            "-i", ffmpeg_input,
            "-vf", "crop=1280:720:0:0",
            output_path
        ]

        print(f"[process] Running command: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )

        print(f"[process] ffmpeg stdout: {result.stdout}")
        print(f"[process] ffmpeg stderr: {result.stderr}")

        if result.returncode != 0:
            return jsonify({
                "error": "ffmpeg failed",
                "details": result.stderr
            }), 500

        # 3. Upload output to GCS
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
        output_blob_name = f"outputs/output_{timestamp}.mp4"

        print(f"[gcs] Uploading output to bucket={GCS_BUCKET}, blob={output_blob_name}")

        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(output_blob_name)
        blob.upload_from_filename(output_path, content_type="video/mp4")

        output_gs_url = f"gs://{GCS_BUCKET}/{output_blob_name}"
        public_url = f"https://storage.googleapis.com/{GCS_BUCKET}/{output_blob_name}"

        return jsonify({
            "status": "ok",
            "input": video_url,
            "output": output_gs_url,
            "publicUrl": public_url
        }), 200

    except subprocess.TimeoutExpired:
        return jsonify({"error": "ffmpeg timed out"}), 504

    except FileNotFoundError:
        return jsonify({"error": "ffmpeg not found on system"}), 500

    except Exception as e:
        print(f"[error] {str(e)}")
        return jsonify({
            "error": "processing failed",
            "details": str(e)
        }), 500


@app.route("/detect", methods=["POST"])
def detect():
    data = request.get_json(force=True)

    if not data or "videoUrl" not in data:
        return jsonify({"error": "Missing 'videoUrl' in request body"}), 400

    video_url = data["videoUrl"]
    target_class = data.get("classId", None)  # None = toutes les classes
    frame_step = data.get("frameStep", 5)      # 1 frame sur N

    input_path = "/tmp/input.mp4"

    print(f"[detect] Received videoUrl: {video_url}, classId: {target_class}, frameStep: {frame_step}")

    try:
        # 1. Download video
        if video_url.startswith("gs://"):
            download_from_gcs(video_url, input_path)
        else:
            return jsonify({"error": "Only gs:// URLs are supported"}), 400

        # 2. Open video
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            return jsonify({"error": "Cannot open video file"}), 500

        positions = []
        frame_index = 0

        print(f"[detect] Starting frame-by-frame detection (step={frame_step})...")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Traiter 1 frame sur N
            if frame_index % frame_step == 0:
                results = yolo_model(frame, verbose=False)

                for result in results:
                    boxes = result.boxes
                    if boxes is None:
                        continue

                    for box in boxes:
                        cls_id = int(box.cls[0])

                        # Filtrer par classe si demandé
                        if target_class is not None and cls_id != int(target_class):
                            continue

                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        cx = int((x1 + x2) / 2)
                        cy = int((y1 + y2) / 2)

                        positions.append({
                            "frame": frame_index,
                            "classId": cls_id,
                            "x": cx,
                            "y": cy
                        })

            frame_index += 1

        cap.release()

        print(f"[detect] Done. {len(positions)} detections across {frame_index} frames.")

        return jsonify({
            "status": "ok",
            "positions": positions
        }), 200

    except Exception as e:
        print(f"[detect][error] {str(e)}")
        return jsonify({
            "error": "detection failed",
            "details": str(e)
        }), 500


@app.route("/track", methods=["POST"])
def track():
    data = request.get_json(force=True)

    if not data or "videoUrl" not in data:
        return jsonify({"error": "Missing 'videoUrl' in request body"}), 400

    video_url = data["videoUrl"]
    player_class = int(data.get("playerClassId", 0))
    ball_class = int(data.get("ballClassId", 32))
    frame_step = int(data.get("frameStep", 10))

    input_path = "/tmp/input.mp4"

    print(f"[track] videoUrl={video_url}, playerClassId={player_class}, ballClassId={ball_class}, frameStep={frame_step}")

    try:
        # 1. Download video
        if video_url.startswith("gs://"):
            download_from_gcs(video_url, input_path)
        else:
            return jsonify({"error": "Only gs:// URLs are supported"}), 400

        # 2. Open video
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            return jsonify({"error": "Cannot open video file"}), 500

        track_positions = []
        frame_index = 0

        print(f"[track] Starting tracking (players={player_class}, ball={ball_class}, step={frame_step})...")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_index % frame_step == 0:
                results = yolo_model(frame, verbose=False)

                players_x = []
                players_y = []
                best_ball = None  # (cx, cy, confidence)

                for result in results:
                    boxes = result.boxes
                    if boxes is None:
                        continue

                    for box in boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        cx = (x1 + x2) / 2
                        cy = (y1 + y2) / 2

                        if cls_id == player_class:
                            players_x.append(cx)
                            players_y.append(cy)
                        elif cls_id == ball_class:
                            if best_ball is None or conf > best_ball[2]:
                                best_ball = (cx, cy, conf)

                # Construire playersCenter
                players_center = None
                if players_x:
                    players_center = {
                        "x": int(sum(players_x) / len(players_x)),
                        "y": int(sum(players_y) / len(players_y)),
                        "count": len(players_x)
                    }

                # Construire ball
                ball = None
                if best_ball is not None:
                    ball = {
                        "x": int(best_ball[0]),
                        "y": int(best_ball[1]),
                        "confidence": round(best_ball[2], 3)
                    }

                # Déterminer lambda en fonction de la confidence du ballon
                if ball is not None:
                    if ball["confidence"] >= 0.7:
                        lam = 0.8
                    elif ball["confidence"] >= 0.4:
                        lam = 0.5
                    else:
                        lam = 0.0
                else:
                    lam = 0.0

                # Calcul de la position finale
                final = None
                if players_center is not None and ball is not None:
                    final_x = int(lam * ball["x"] + (1 - lam) * players_center["x"])
                    final_y = int(lam * ball["y"] + (1 - lam) * players_center["y"])
                    final = {"x": final_x, "y": final_y}
                elif players_center is not None:
                    final = {"x": players_center["x"], "y": players_center["y"]}
                elif ball is not None:
                    # Pas de joueurs mais ballon détecté → forcer lambda = 1
                    lam = 1.0
                    final = {"x": ball["x"], "y": ball["y"]}
                else:
                    # Aucune donnée exploitable → ignorer la frame
                    frame_index += 1
                    continue

                entry = {
                    "frame": frame_index,
                    "playersCenter": players_center,
                    "ball": ball,
                    "lambda": lam,
                    "final": final
                }
                track_positions.append(entry)

                print(f"[track] frame={frame_index} players={players_center} ball={ball} lambda={lam} final={final}")

            frame_index += 1

        cap.release()

        print(f"[track] Done. {len(track_positions)} tracked frames out of {frame_index} total.")

        return jsonify({
            "status": "ok",
            "track": track_positions
        }), 200

    except Exception as e:
        print(f"[track][error] {str(e)}")
        return jsonify({
            "error": "tracking failed",
            "details": str(e)
        }), 500


# ===========================================================================
# /track-ball : pipeline robuste de détection + tracking du ballon
# ---------------------------------------------------------------------------
# Body JSON :
# {
#   "videoUrl": "gs://bucket/input.mp4",
#   "ballClassId": 32,          // 32 = sports ball (COCO). Change si fine-tuné.
#   "playerClassId": 0,
#   "frameStep": 2,             // 1 = toutes les frames (lent mais plus précis)
#   "useTiles": true,           // tiling pour panoramiques
#   "tileSize": 1280,
#   "tileOverlap": 0.2,
#   "yoloImgsz": 1280,          // 1280 recommandé pour petits objets
#   "yoloConf": 0.15,           // bas volontairement, le tracker filtre
#   "applyClahe": false
# }
# ===========================================================================
@app.route("/track-ball", methods=["POST"])
def track_ball():
    data = request.get_json(force=True) or {}

    if "videoUrl" not in data:
        return jsonify({"error": "Missing 'videoUrl' in request body"}), 400

    video_url = data["videoUrl"]
    input_path = "/tmp/input.mp4"

    params = {
        "ball_class_id": int(data.get("ballClassId", 32)),
        "player_class_id": int(data.get("playerClassId", 0)),
        "frame_step": int(data.get("frameStep", 2)),
        "use_tiles": bool(data.get("useTiles", True)),
        "tile_size": int(data.get("tileSize", 1280)),
        "tile_overlap": float(data.get("tileOverlap", 0.2)),
        "yolo_imgsz": int(data.get("yoloImgsz", 1280)),
        "yolo_conf": float(data.get("yoloConf", 0.15)),
        "apply_clahe": bool(data.get("applyClahe", False)),
    }

    print(f"[track-ball] videoUrl={video_url} params={params}")

    try:
        if video_url.startswith("gs://"):
            download_from_gcs(video_url, input_path)
        else:
            return jsonify({"error": "Only gs:// URLs are supported"}), 400

        result = run_ball_tracking(
            video_path=input_path,
            yolo_model=yolo_model,
            **params,
        )

        # Upload automatique du JSON de tracking dans GCS
        # Le nom du blob est dérivé du nom de la vidéo source : foo.mp4 -> foo_track.json
        track_gs_url = None
        try:
            import json as _json
            video_basename = video_url.rstrip("/").split("/")[-1]
            video_name = os.path.splitext(video_basename)[0]
            track_blob_name = f"tracks/{video_name}_track.json"
            track_local = "/tmp/track.json"
            with open(track_local, "w") as f:
                _json.dump(result, f)
            client = storage.Client()
            bucket = client.bucket(GCS_BUCKET)
            blob = bucket.blob(track_blob_name)
            blob.upload_from_filename(track_local, content_type="application/json")
            track_gs_url = f"gs://{GCS_BUCKET}/{track_blob_name}"
            print(f"[track-ball] track JSON uploaded -> {track_gs_url}")
        except Exception as upload_err:
            print(f"[track-ball] JSON upload failed (non-fatal): {upload_err}")

        result["trackGsUrl"] = track_gs_url
        return jsonify(result), 200

    except Exception as e:
        print(f"[track-ball][error] {str(e)}")
        return jsonify({
            "error": "ball tracking failed",
            "details": str(e),
        }), 500


# ===========================================================================
# /track-ball-crop : tracking + recadrage automatique et upload GCS
# ---------------------------------------------------------------------------
# Body JSON : mêmes params que /track-ball plus :
# {
#   "cropWidth": 1280,
#   "cropHeight": 720,
#   "smoothingWindow": 31
# }
# ===========================================================================
@app.route("/track-ball-crop", methods=["POST"])
def track_ball_crop():
    data = request.get_json(force=True) or {}

    if "videoUrl" not in data:
        return jsonify({"error": "Missing 'videoUrl' in request body"}), 400

    video_url = data["videoUrl"]
    input_path = "/tmp/input.mp4"
    output_path = "/tmp/output_cropped.mp4"

    track_params = {
        "ball_class_id": int(data.get("ballClassId", 32)),
        "player_class_id": int(data.get("playerClassId", 0)),
        "frame_step": int(data.get("frameStep", 2)),
        "use_tiles": bool(data.get("useTiles", True)),
        "tile_size": int(data.get("tileSize", 1280)),
        "tile_overlap": float(data.get("tileOverlap", 0.2)),
        "yolo_imgsz": int(data.get("yoloImgsz", 1280)),
        "yolo_conf": float(data.get("yoloConf", 0.15)),
        "apply_clahe": bool(data.get("applyClahe", False)),
    }
    crop_width = int(data.get("cropWidth", 1280))
    crop_height = int(data.get("cropHeight", 720))
    smoothing_window = int(data.get("smoothingWindow", 31))

    print(f"[track-ball-crop] videoUrl={video_url}")

    try:
        if video_url.startswith("gs://"):
            download_from_gcs(video_url, input_path)
        else:
            return jsonify({"error": "Only gs:// URLs are supported"}), 400

        # 1. Tracking
        tracking_result = run_ball_tracking(
            video_path=input_path,
            yolo_model=yolo_model,
            **track_params,
        )

        # 2. Recadrage dynamique
        crop_info = crop_video_around_ball(
            input_path=input_path,
            output_path=output_path,
            track=tracking_result["track"],
            crop_width=crop_width,
            crop_height=crop_height,
            smoothing_window=smoothing_window,
        )

        # 3. Upload GCS
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
        output_blob_name = f"outputs/ball_cropped_{timestamp}.mp4"
        print(f"[gcs] Uploading {output_path} → gs://{GCS_BUCKET}/{output_blob_name}")

        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(output_blob_name)
        blob.upload_from_filename(output_path, content_type="video/mp4")

        return jsonify({
            "status": "ok",
            "tracking": {
                "stats": tracking_result["stats"],
                "video": tracking_result["video"],
            },
            "crop": crop_info,
            "output": f"gs://{GCS_BUCKET}/{output_blob_name}",
            "publicUrl": f"https://storage.googleapis.com/{GCS_BUCKET}/{output_blob_name}",
        }), 200

    except Exception as e:
        print(f"[track-ball-crop][error] {str(e)}")
        return jsonify({
            "error": "ball tracking + crop failed",
            "details": str(e),
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)