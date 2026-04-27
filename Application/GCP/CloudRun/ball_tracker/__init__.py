"""
ball_tracker
============
Pipeline robuste de détection + tracking du ballon pour vidéo football amateur.

Modules :
- preprocessing : lecture vidéo, tiling, amélioration image
- detector     : YOLO multi-scale + tiling + filtrage faux positifs
- tracker      : Kalman filter, mémoire temporelle, états detected/predicted/lost
- context      : utilisation de la position des joueurs pour valider le ballon
- smoothing    : interpolation, lissage, validation physique
- pipeline     : orchestration complète
- cropper      : recadrage automatique de la vidéo avec ffmpeg
"""

from .pipeline import BallTrackingPipeline, run_ball_tracking

__all__ = ["BallTrackingPipeline", "run_ball_tracking"]
