"""
Orchestration complète du tracking ballon.

Étapes :
1. Info vidéo + itération frame par frame (step configurable)
2. (optionnel) Tiling pour panoramiques
3. YOLO sur frame ou tiles → détections
4. Séparation joueurs / ballon
5. Tracker Kalman → TrackOutput
6. Post-traitement (vitesse max, interpolation, smoothing)
7. Sérialisation JSON-compatible
"""

from dataclasses import asdict
from typing import Dict, List, Optional
import time

from .preprocessing import iter_frames, get_video_info, make_tiles, enhance_frame
from .detector import BallDetector
from .tracker import KalmanBallTracker, TrackOutput
from .smoothing import postprocess


class BallTrackingPipeline:
    def __init__(
        self,
        yolo_model,
        ball_class_id: int = 32,
        player_class_id: int = 0,
        frame_step: int = 2,
        use_tiles: bool = True,
        tile_size: int = 1280,
        tile_overlap: float = 0.2,
        yolo_imgsz: int = 1280,
        yolo_conf: float = 0.15,
        apply_clahe: bool = False,
    ):
        self.detector = BallDetector(
            model=yolo_model,
            ball_class_id=ball_class_id,
            player_class_id=player_class_id,
            conf_threshold=yolo_conf,
            imgsz=yolo_imgsz,
        )
        self.tracker = KalmanBallTracker()
        self.frame_step = frame_step
        self.use_tiles = use_tiles
        self.tile_size = tile_size
        self.tile_overlap = tile_overlap
        self.apply_clahe = apply_clahe

    def run(self, video_path: str) -> Dict:
        info = get_video_info(video_path)
        fps = info["fps"]

        print(f"[pipeline] video {video_path} "
              f"{info['width']}x{info['height']} @ {fps:.2f}fps, "
              f"{info['frame_count']} frames")
        print(f"[pipeline] frame_step={self.frame_step}, "
              f"use_tiles={self.use_tiles}, "
              f"tile_size={self.tile_size}")

        track: List[TrackOutput] = []
        t_start = time.time()
        last_frame_index = 0
        processed = 0

        for frame_index, time_sec, frame in iter_frames(video_path, self.frame_step):
            frame = enhance_frame(frame, apply_clahe=self.apply_clahe)

            # 1. Tiling ou frame complète
            tiles = None
            if self.use_tiles:
                tiles = make_tiles(frame, self.tile_size, self.tile_overlap)

            # 2. YOLO multi-tiles + NMS
            dets = self.detector.detect_with_tiles(frame, tiles)

            # 3. Séparation
            players, balls = self.detector.split_players_and_ball(dets)
            player_pos = [(p.x, p.y) for p in players]

            # 4. Kalman step
            dt = (frame_index - last_frame_index) if last_frame_index > 0 else 1
            last_frame_index = frame_index

            out = self.tracker.step(
                frame_index=frame_index,
                time_sec=time_sec,
                dt=float(dt),
                ball_candidates=balls,
                player_positions=player_pos,
            )
            track.append(out)
            processed += 1

            if processed % 50 == 0:
                print(f"[pipeline] frame={frame_index} state={self.tracker.state.value} "
                      f"balls={len(balls)} players={len(players)} "
                      f"x={out.x:.0f} y={out.y:.0f} conf={out.confidence}")

        # 5. Post-traitement
        track = postprocess(track)

        elapsed = time.time() - t_start
        print(f"[pipeline] done. {processed} frames processed in {elapsed:.1f}s "
              f"({processed / max(elapsed, 1e-6):.2f} fps processing)")

        return {
            "status": "ok",
            "video": {
                "width": info["width"],
                "height": info["height"],
                "fps": info["fps"],
                "frame_count": info["frame_count"],
            },
            "stats": {
                "frames_processed": processed,
                "elapsed_seconds": round(elapsed, 2),
                "detected": sum(1 for t in track if t.source == "detected"),
                "predicted": sum(1 for t in track if t.source == "predicted"),
                "lost": sum(1 for t in track if t.source == "lost"),
            },
            "track": [self._serialize(t) for t in track],
        }

    @staticmethod
    def _serialize(t: TrackOutput) -> dict:
        return {
            "frame": int(t.frame),
            "time": round(float(t.time), 3),
            "ball": {
                "x": int(round(t.x)),
                "y": int(round(t.y)),
                "confidence": float(t.confidence),
                "source": t.source,
            },
        }


def run_ball_tracking(
    video_path: str,
    yolo_model,
    **kwargs,
) -> Dict:
    """Helper fonctionnel (pratique pour les appels depuis Flask)."""
    pipeline = BallTrackingPipeline(yolo_model=yolo_model, **kwargs)
    return pipeline.run(video_path)
