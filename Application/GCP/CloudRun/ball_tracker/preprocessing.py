"""
Prétraitement vidéo.

Stratégies :
- lecture frame-par-frame efficace via cv2.VideoCapture
- découpage en tiles avec overlap pour détecter les petits objets (ballon)
  sur des vidéos panoramiques (ex : 5120x1440)
- amélioration locale du contraste (CLAHE) optionnelle pour frames sombres
- re-projection des coordonnées locales de tile → coordonnées globales frame
"""

from dataclasses import dataclass
from typing import Iterator, List, Tuple
import cv2
import numpy as np


@dataclass
class Tile:
    """Représente une sous-image (tile) extraite d'une frame."""
    image: np.ndarray
    x_offset: int  # offset X de la tile dans la frame d'origine
    y_offset: int  # offset Y de la tile dans la frame d'origine
    width: int
    height: int


def iter_frames(video_path: str, frame_step: int = 1) -> Iterator[Tuple[int, float, np.ndarray]]:
    """
    Itère sur les frames d'une vidéo.

    Yields
    ------
    (frame_index, timestamp_seconds, frame_bgr)
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_index = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_index % frame_step == 0:
                t = frame_index / fps
                yield frame_index, t, frame
            frame_index += 1
    finally:
        cap.release()


def get_video_info(video_path: str) -> dict:
    """Retourne fps / width / height / frame_count d'une vidéo."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")
    info = {
        "fps": cap.get(cv2.CAP_PROP_FPS) or 25.0,
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "frame_count": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
    }
    cap.release()
    return info


def enhance_frame(frame: np.ndarray, apply_clahe: bool = False) -> np.ndarray:
    """
    Amélioration optionnelle : CLAHE sur le canal luminance.
    Utile si la vidéo est sombre ou à faible contraste.
    """
    if not apply_clahe:
        return frame
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l2 = clahe.apply(l)
    merged = cv2.merge((l2, a, b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def make_tiles(
    frame: np.ndarray,
    tile_size: int = 1280,
    overlap: float = 0.2,
) -> List[Tile]:
    """
    Découpe une frame en tiles carrées avec overlap.

    Idéal pour panoramiques (5120x1440) : un ballon de 10 px sur une frame
    downscalée à 640 devient indétectable. Tiling → YOLO voit le ballon à
    sa vraie résolution.

    - tile_size  : côté (px) de la tile
    - overlap    : recouvrement horizontal/vertical (0..1)
    """
    h, w = frame.shape[:2]

    # Si la frame est déjà plus petite que la tile, on renvoie la frame entière
    if w <= tile_size and h <= tile_size:
        return [Tile(image=frame, x_offset=0, y_offset=0, width=w, height=h)]

    step = max(1, int(tile_size * (1 - overlap)))
    tiles: List[Tile] = []

    xs = list(range(0, max(w - tile_size, 0) + 1, step))
    ys = list(range(0, max(h - tile_size, 0) + 1, step))
    if xs[-1] + tile_size < w:
        xs.append(w - tile_size)
    if ys[-1] + tile_size < h:
        ys.append(h - tile_size)

    for y in ys:
        for x in xs:
            sub = frame[y:y + tile_size, x:x + tile_size]
            tiles.append(Tile(
                image=sub,
                x_offset=x,
                y_offset=y,
                width=sub.shape[1],
                height=sub.shape[0],
            ))
    return tiles
