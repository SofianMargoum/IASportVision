"""
Détection ballon robuste.

Stratégies combinées :
1. YOLO multi-scale (imgsz élevé pour voir les petits objets)
2. Tiling optionnel : découpage de la frame panoramique en tiles
   et détection sur chaque tile (nécessaire pour ballon < 20 px)
3. Non-Maximum Suppression globale sur les détections reprojetées
4. Filtrage des faux positifs : taille, aspect ratio, score mini

Note : sans modèle fine-tuné, YOLOv8 COCO détecte "sports ball" (classId=32)
mais avec une fiabilité faible sur du foot amateur éloigné. Ce module est
pensé pour être compatible avec un modèle fine-tuné (recommandé) en
changeant simplement `ball_class_id`.
"""

from dataclasses import dataclass
from typing import List, Optional
import numpy as np

from .preprocessing import Tile


@dataclass
class Detection:
    x: float          # centre X dans la frame globale
    y: float          # centre Y dans la frame globale
    w: float          # largeur bbox
    h: float          # hauteur bbox
    confidence: float
    class_id: int


class BallDetector:
    def __init__(
        self,
        model,
        ball_class_id: int = 32,
        player_class_id: int = 0,
        conf_threshold: float = 0.15,
        imgsz: int = 1280,
        min_box_size: int = 3,
        max_box_size: int = 120,
        max_aspect_ratio: float = 2.2,
    ):
        """
        - model            : ultralytics.YOLO déjà chargé
        - ball_class_id    : 32 pour COCO "sports ball", à remplacer après fine-tuning
        - conf_threshold   : bas volontairement (0.15) — le tracker filtrera ensuite
        - imgsz            : résolution d'inférence YOLO (1280 = meilleur pour petits objets)
        - min/max_box_size : filtre géométrique anti faux-positifs (px)
        - max_aspect_ratio : un ballon est ~ rond (ratio ≈ 1)
        """
        self.model = model
        self.ball_class_id = ball_class_id
        self.player_class_id = player_class_id
        self.conf_threshold = conf_threshold
        self.imgsz = imgsz
        self.min_box_size = min_box_size
        self.max_box_size = max_box_size
        self.max_aspect_ratio = max_aspect_ratio

    # ---------------------------------------------------------------
    # Détection sur une frame complète (ou une tile)
    # ---------------------------------------------------------------
    def _run_yolo(self, image: np.ndarray):
        """Exécute YOLO avec les paramètres optimisés pour petit objet."""
        return self.model(
            image,
            imgsz=self.imgsz,
            conf=self.conf_threshold,
            verbose=False,
        )

    def _extract_detections(
        self,
        results,
        x_offset: int = 0,
        y_offset: int = 0,
    ) -> List[Detection]:
        """Convertit la sortie YOLO en liste de Detection (coords globales)."""
        out: List[Detection] = []
        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                bw = x2 - x1
                bh = y2 - y1

                # Filtres géométriques pour le ballon uniquement
                if cls_id == self.ball_class_id:
                    size = max(bw, bh)
                    if size < self.min_box_size or size > self.max_box_size:
                        continue
                    ar = max(bw, bh) / max(min(bw, bh), 1e-6)
                    if ar > self.max_aspect_ratio:
                        continue

                cx = (x1 + x2) / 2 + x_offset
                cy = (y1 + y2) / 2 + y_offset
                out.append(Detection(
                    x=cx, y=cy, w=bw, h=bh,
                    confidence=conf, class_id=cls_id,
                ))
        return out

    # ---------------------------------------------------------------
    # Détection avec tiling (robuste pour panoramiques)
    # ---------------------------------------------------------------
    def detect_with_tiles(
        self,
        frame: np.ndarray,
        tiles: Optional[List[Tile]] = None,
    ) -> List[Detection]:
        """
        Lance YOLO sur chaque tile, reprojette les détections dans la frame
        globale, puis applique une NMS simple pour dédupliquer les overlaps.
        """
        all_dets: List[Detection] = []

        if tiles is None or len(tiles) == 0:
            results = self._run_yolo(frame)
            all_dets.extend(self._extract_detections(results, 0, 0))
        else:
            for tile in tiles:
                results = self._run_yolo(tile.image)
                all_dets.extend(self._extract_detections(
                    results, tile.x_offset, tile.y_offset,
                ))

        return self._nms(all_dets, iou_threshold=0.4)

    # ---------------------------------------------------------------
    # NMS simple sur nos Detection
    # ---------------------------------------------------------------
    @staticmethod
    def _iou(a: Detection, b: Detection) -> float:
        ax1, ay1 = a.x - a.w / 2, a.y - a.h / 2
        ax2, ay2 = a.x + a.w / 2, a.y + a.h / 2
        bx1, by1 = b.x - b.w / 2, b.y - b.h / 2
        bx2, by2 = b.x + b.w / 2, b.y + b.h / 2
        ix1, iy1 = max(ax1, bx1), max(ay1, by1)
        ix2, iy2 = min(ax2, bx2), min(ay2, by2)
        iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
        inter = iw * ih
        union = a.w * a.h + b.w * b.h - inter
        return inter / union if union > 0 else 0.0

    def _nms(self, dets: List[Detection], iou_threshold: float) -> List[Detection]:
        # NMS par classe
        kept: List[Detection] = []
        by_class = {}
        for d in dets:
            by_class.setdefault(d.class_id, []).append(d)
        for _, items in by_class.items():
            items.sort(key=lambda d: d.confidence, reverse=True)
            while items:
                best = items.pop(0)
                kept.append(best)
                items = [d for d in items if self._iou(best, d) < iou_threshold]
        return kept

    # ---------------------------------------------------------------
    # Helpers de sélection
    # ---------------------------------------------------------------
    def split_players_and_ball(self, dets: List[Detection]):
        """Sépare les détections en (joueurs, candidats ballon)."""
        players = [d for d in dets if d.class_id == self.player_class_id]
        balls = [d for d in dets if d.class_id == self.ball_class_id]
        return players, balls
