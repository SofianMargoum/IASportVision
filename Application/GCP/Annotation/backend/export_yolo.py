"""
export_yolo.py
==============
Exporte les annotations validées (Firestore) vers un dataset YOLO prêt
à être entraîné.

Format YOLO (1 ligne par box) :
    <class_id> <xc_norm> <yc_norm> <w_norm> <h_norm>
avec valeurs dans [0,1].

Règles :
- label "true_ball" (avec correctedBox si présente, sinon box d'origine) → ligne classe 0
- label "false_positive" ou "no_ball" → image exportée SANS box (hard negative)
  (utile : YOLO apprend aussi sur des fonds vides / pseudo-ballons)
- pending → ignoré

Structure générée :
  out/
    dataset.yaml
    images/train/...
    images/val/...
    labels/train/...
    labels/val/...
"""

import argparse
import os
import random
import tempfile
from pathlib import Path

from google.cloud import firestore, storage


def _parse_gs(gs_url: str):
    without = gs_url.replace("gs://", "", 1)
    return without.split("/", 1)


def _download(storage_client, gs_url: str, dst: str):
    bn, on = _parse_gs(gs_url)
    storage_client.bucket(bn).blob(on).download_to_filename(dst)


def export(project: str, video_ids, out_dir: str, val_ratio: float = 0.15):
    db = firestore.Client(project=project, database="annotations")
    storage_client = storage.Client(project=project)

    out = Path(out_dir)
    for split in ("train", "val"):
        (out / f"images/{split}").mkdir(parents=True, exist_ok=True)
        (out / f"labels/{split}").mkdir(parents=True, exist_ok=True)

    docs = []
    q = db.collection("annotations").where("status", "==", "annotated")
    for d in q.stream():
        data = d.to_dict()
        if video_ids and data.get("videoId") not in video_ids:
            continue
        docs.append(data)

    print(f"[export] {len(docs)} annotated docs")

    random.seed(42)
    random.shuffle(docs)
    n_val = max(1, int(len(docs) * val_ratio))
    val_set = set(range(n_val))

    counts = {"train": 0, "val": 0, "true_ball": 0, "negative": 0, "skipped": 0}

    for i, data in enumerate(docs):
        split = "val" if i in val_set else "train"
        label = data.get("label")
        if label not in {"true_ball", "false_positive", "no_ball"}:
            counts["skipped"] += 1
            continue

        W = int(data.get("videoWidth") or 0)
        H = int(data.get("videoHeight") or 0)
        if W <= 0 or H <= 0:
            counts["skipped"] += 1
            continue

        gs_raw = data.get("imageRaw")
        if not gs_raw:
            counts["skipped"] += 1
            continue

        stem = f"{data.get('videoId','vid')}_{int(data.get('frame',0)):07d}"
        img_path = out / f"images/{split}/{stem}.jpg"
        lbl_path = out / f"labels/{split}/{stem}.txt"

        try:
            _download(storage_client, gs_raw, str(img_path))
        except Exception as e:
            print(f"[export] download failed {gs_raw}: {e}")
            counts["skipped"] += 1
            continue

        if label == "true_ball":
            # Box source : correctedBox (priorité) sinon box d'origine
            box = data.get("correctedBox") or data.get("box") or {}
            bx = float(box.get("x", 0))
            by = float(box.get("y", 0))
            bw = float(box.get("w", 0))
            bh = float(box.get("h", 0))
            if bw <= 0 or bh <= 0:
                lbl_path.write_text("", encoding="utf-8")
                counts["negative"] += 1
            else:
                xc = (bx + bw / 2) / W
                yc = (by + bh / 2) / H
                nw = bw / W
                nh = bh / H
                lbl_path.write_text(f"0 {xc:.6f} {yc:.6f} {nw:.6f} {nh:.6f}\n",
                                    encoding="utf-8")
                counts["true_ball"] += 1
        else:
            # Hard negative : label vide
            lbl_path.write_text("", encoding="utf-8")
            counts["negative"] += 1

        counts[split] += 1

    # dataset.yaml
    yaml = (
        f"path: {out.resolve().as_posix()}\n"
        f"train: images/train\n"
        f"val:   images/val\n"
        f"names:\n  0: ball\n"
    )
    (out / "dataset.yaml").write_text(yaml, encoding="utf-8")

    print(f"[export] done. {counts}")
    print(f"[export] dataset.yaml written at {out/'dataset.yaml'}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--project", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--video-ids", default="", help="Comma separated videoIds (empty = all)")
    p.add_argument("--val-ratio", type=float, default=0.15)
    args = p.parse_args()

    ids = [v.strip() for v in args.video_ids.split(",") if v.strip()]
    export(args.project, ids, args.out, args.val_ratio)


if __name__ == "__main__":
    main()
