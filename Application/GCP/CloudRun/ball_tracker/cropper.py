"""
Recadrage automatique de la vidéo autour du ballon.

Deux approches fournies :
- OpenCV : lit chaque frame, recadre dynamiquement avec interpolation de la
  position cible, et écrit une vidéo H.264 via cv2.VideoWriter
- FFmpeg : génère un filtre `crop` animé via une expression sendcmd / zoompan
  (plus complexe) OU via une approche simple frame-par-frame en images puis
  réassemblage (fallback)

Ici on implémente la voie OpenCV (la plus robuste et portable sur Cloud Run).
Pour les vidéos très longues, on peut basculer sur un pipeline FFmpeg.
"""

from typing import Dict, List, Tuple
import numpy as np
import cv2


def _build_target_series(
    track: List[dict],
    total_frames: int,
    default_xy: Tuple[float, float],
) -> List[Tuple[float, float]]:
    """
    Interpole la position cible pour CHAQUE frame de la vidéo.

    - track : liste d'entrées {frame, ball:{x,y,...}}
    - total_frames : nombre total de frames dans la vidéo
    - default_xy : position par défaut si track vide
    """
    if not track:
        return [default_xy] * total_frames

    frames = np.array([t["frame"] for t in track], dtype=float)
    xs = np.array([t["ball"]["x"] for t in track], dtype=float)
    ys = np.array([t["ball"]["y"] for t in track], dtype=float)

    all_frames = np.arange(total_frames, dtype=float)
    xs_interp = np.interp(all_frames, frames, xs)
    ys_interp = np.interp(all_frames, frames, ys)
    return list(zip(xs_interp.tolist(), ys_interp.tolist()))


def _smooth_target(
    series: List[Tuple[float, float]],
    window: int = 31,
) -> List[Tuple[float, float]]:
    """Moyenne glissante large pour des panoramiques doux (anti-saccades)."""
    if len(series) < window or window <= 1:
        return series
    xs = np.array([p[0] for p in series])
    ys = np.array([p[1] for p in series])
    kernel = np.ones(window) / window
    pad = window // 2
    xs = np.convolve(np.pad(xs, pad, mode="edge"), kernel, mode="valid")
    ys = np.convolve(np.pad(ys, pad, mode="edge"), kernel, mode="valid")
    return list(zip(xs.tolist(), ys.tolist()))


def crop_video_around_ball(
    input_path: str,
    output_path: str,
    track: List[dict],
    crop_width: int = 1280,
    crop_height: int = 720,
    smoothing_window: int = 31,
    fourcc: str = "mp4v",
) -> Dict:
    """
    Génère une vidéo recadrée autour du ballon.

    Parameters
    ----------
    input_path, output_path : chemins vidéo
    track : liste d'entrées au format produit par BallTrackingPipeline
    crop_width, crop_height : taille de la fenêtre de crop
    smoothing_window : largeur du lissage temporel (en frames) de la caméra virtuelle
    """
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open input video: {input_path}")

    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Position par défaut : centre de la frame
    default_xy = (W / 2.0, H / 2.0)

    # Série cible par frame + lissage
    series = _build_target_series(track, total, default_xy)
    series = _smooth_target(series, window=smoothing_window)

    # VideoWriter
    cw = min(crop_width, W)
    ch = min(crop_height, H)
    writer = cv2.VideoWriter(
        output_path,
        cv2.VideoWriter_fourcc(*fourcc),
        fps,
        (cw, ch),
    )
    if not writer.isOpened():
        cap.release()
        raise RuntimeError(f"Cannot open output video writer: {output_path}")

    frame_index = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            cx, cy = series[min(frame_index, len(series) - 1)]

            # Clamping de la fenêtre dans les bornes de l'image
            x1 = int(round(cx - cw / 2))
            y1 = int(round(cy - ch / 2))
            x1 = max(0, min(W - cw, x1))
            y1 = max(0, min(H - ch, y1))
            x2 = x1 + cw
            y2 = y1 + ch

            sub = frame[y1:y2, x1:x2]
            writer.write(sub)
            frame_index += 1
    finally:
        cap.release()
        writer.release()

    return {
        "status": "ok",
        "output": output_path,
        "frames_written": frame_index,
        "crop_size": [cw, ch],
        "fps": fps,
    }
