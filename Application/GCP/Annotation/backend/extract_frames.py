"""
extract_frames.py
=================
CLI : à partir d'un JSON produit par /track-ball et d'une vidéo, extrait
les frames "detected" (ou autres selon filtre), dessine la bounding box
centrée sur (x,y), uploade les images dans Cloud Storage et crée un
document Firestore par frame (statut = "pending").

Usage local :
    python extract_frames.py \
        --video gs://bucket/input.mp4 \
        --track gs://bucket/track.json \
        --video-id match_2026_04_24 \
        --bucket ia-sport-annotations \
        --project my-gcp-project

Design :
- on filtre par `source` (par défaut "detected") et seuil de confiance
- box par défaut : 80x80 px centrée sur (x,y) — ajustable via --box-size
- idempotent : on ne réécrit pas un document Firestore déjà annoté
"""

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime

import cv2
from google.cloud import firestore, storage


# ---------------------------------------------------------------------------
# GCS helpers
# ---------------------------------------------------------------------------
def _parse_gs(gs_url: str):
    without = gs_url.replace("gs://", "", 1)
    bucket, blob = without.split("/", 1)
    return bucket, blob


def _download_gs(storage_client, gs_url: str, local_path: str):
    bucket_name, blob_name = _parse_gs(gs_url)
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    blob.download_to_filename(local_path)
    print(f"[gcs] downloaded {gs_url} -> {local_path}")


def _upload_gs(storage_client, bucket_name: str, blob_name: str, local_path: str, content_type: str):
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(local_path, content_type=content_type)
    return f"gs://{bucket_name}/{blob_name}"


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
def extract(
    video_src: str,
    track_src: str,
    video_id: str,
    bucket_annot: str,
    project: str,
    sources=("detected",),
    min_conf: float = 0.0,
    max_conf: float = 1.01,
    box_size: int = 80,
    overwrite: bool = False,
):
    storage_client = storage.Client(project=project)
    db = firestore.Client(project=project, database="annotations")

    with tempfile.TemporaryDirectory() as tmp:
        # 1. Video
        if video_src.startswith("gs://"):
            video_path = os.path.join(tmp, "input.mp4")
            _download_gs(storage_client, video_src, video_path)
        else:
            video_path = video_src

        # 2. Track JSON
        if track_src.startswith("gs://"):
            track_path = os.path.join(tmp, "track.json")
            _download_gs(storage_client, track_src, track_path)
        else:
            track_path = track_src

        with open(track_path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        track = payload.get("track", payload if isinstance(payload, list) else [])
        print(f"[extract] {len(track)} entries in track JSON")

        # 3. Sélection
        selected = []
        for t in track:
            ball = t.get("ball") or {}
            src = ball.get("source") or t.get("source")
            conf = ball.get("confidence", t.get("confidence", 0.0))
            if src not in sources:
                continue
            if conf < min_conf or conf > max_conf:
                continue
            selected.append(t)
        # Priorité aux basses confiances (plus difficile = plus utile à annoter)
        selected.sort(key=lambda t: (t.get("ball") or {}).get("confidence", 0))
        print(f"[extract] {len(selected)} frames selected (sources={sources}, "
              f"conf in [{min_conf},{max_conf}])")

        # 4. Frames -> images
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0

        created = 0
        skipped = 0
        by_frame = {int(t["frame"]): t for t in selected}
        target_frames = sorted(by_frame.keys())

        if not target_frames:
            print("[extract] no frames to export")
            cap.release()
            return

        # Lecture séquentielle (plus rapide que seek aléatoire sur H.264)
        current = 0
        idx = 0
        while idx < len(target_frames):
            target = target_frames[idx]
            while current < target:
                ok = cap.grab()
                if not ok:
                    break
                current += 1
            if current != target:
                print(f"[extract] could not seek to frame {target}")
                break
            ok, frame = cap.retrieve()
            current += 1
            if not ok:
                break

            entry = by_frame[target]
            ball = entry.get("ball") or {}
            cx = int(ball.get("x", entry.get("x", 0)))
            cy = int(ball.get("y", entry.get("y", 0)))
            conf = float(ball.get("confidence", entry.get("confidence", 0.0)))
            source = ball.get("source", entry.get("source", "unknown"))

            doc_id = f"{video_id}__f{target:07d}"
            doc_ref = db.collection("annotations").document(doc_id)
            existing = doc_ref.get()
            if existing.exists and not overwrite:
                skipped += 1
                idx += 1
                continue

            # Dessin box
            half = box_size // 2
            x1 = max(0, cx - half); y1 = max(0, cy - half)
            x2 = min(W, cx + half); y2 = min(H, cy + half)

            annotated = frame.copy()
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.circle(annotated, (cx, cy), 3, (0, 255, 255), -1)
            label = f"{source} {conf:.2f}"
            cv2.putText(annotated, label, (x1, max(0, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            # Sauvegarde
            blob_annot = f"annotations/{video_id}/frame_{target:07d}.jpg"
            blob_raw = f"raw/{video_id}/frame_{target:07d}.jpg"
            local_annot = os.path.join(tmp, f"annot_{target}.jpg")
            local_raw = os.path.join(tmp, f"raw_{target}.jpg")
            cv2.imwrite(local_annot, annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
            cv2.imwrite(local_raw, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])

            gs_annot = _upload_gs(storage_client, bucket_annot, blob_annot,
                                  local_annot, "image/jpeg")
            gs_raw = _upload_gs(storage_client, bucket_annot, blob_raw,
                                local_raw, "image/jpeg")

            # Firestore
            doc_ref.set({
                "videoId": video_id,
                "videoSource": video_src,
                "frame": target,
                "time": round(target / fps, 3),
                "x": cx, "y": cy,
                "confidence": conf,
                "source": source,
                "boxSize": box_size,
                "box": {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1},
                "imageAnnotated": gs_annot,
                "imageRaw": gs_raw,
                "status": "pending",            # pending | annotated
                "label": None,                  # true_ball | false_positive | no_ball
                "correctedBox": None,
                "createdAt": datetime.utcnow().isoformat() + "Z",
                "videoWidth": W,
                "videoHeight": H,
            }, merge=True)

            created += 1
            idx += 1

        cap.release()
        print(f"[extract] done. created={created} skipped_existing={skipped}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--video", required=True, help="gs://... or local path")
    p.add_argument("--track", required=True, help="gs://... or local path (JSON)")
    p.add_argument("--video-id", required=True)
    p.add_argument("--bucket", required=True, help="GCS bucket for annotation images")
    p.add_argument("--project", required=True, help="GCP project id")
    p.add_argument("--sources", default="detected",
                   help="Comma separated: detected,predicted,lost")
    p.add_argument("--min-conf", type=float, default=0.0)
    p.add_argument("--max-conf", type=float, default=1.01)
    p.add_argument("--box-size", type=int, default=80)
    p.add_argument("--overwrite", action="store_true")
    args = p.parse_args()

    extract(
        video_src=args.video,
        track_src=args.track,
        video_id=args.video_id,
        bucket_annot=args.bucket,
        project=args.project,
        sources=tuple(s.strip() for s in args.sources.split(",") if s.strip()),
        min_conf=args.min_conf,
        max_conf=args.max_conf,
        box_size=args.box_size,
        overwrite=args.overwrite,
    )


if __name__ == "__main__":
    main()
