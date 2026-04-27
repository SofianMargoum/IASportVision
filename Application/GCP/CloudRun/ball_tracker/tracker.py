"""
Tracker temporel robuste pour le ballon.

Architecture :
- Kalman Filter à état (x, y, vx, vy) — vitesse constante
- Gating : accepte la détection la plus plausible dans un rayon dépendant
  de la vitesse et du temps écoulé
- Hystérésis d'état :
    TENTATIVE -> CONFIRMED -> COASTING (predicted) -> LOST
- Si aucune détection : on publie la position prédite jusqu'à `max_coast_frames`
- Scoring de confiance combinant :
    * confiance YOLO
    * cohérence temporelle (distance prédite vs mesurée)
    * ancienneté du dernier hit

Ce tracker est inspiré de SORT/ByteTrack mais limité à une cible unique
(le ballon) pour simplicité et robustesse.
"""

from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
import numpy as np

from .detector import Detection


class TrackState(str, Enum):
    TENTATIVE = "tentative"
    CONFIRMED = "detected"      # affiché comme "detected" dans le JSON
    COASTING = "predicted"      # position prédite (pas de détection)
    LOST = "lost"


@dataclass
class TrackOutput:
    frame: int
    time: float
    x: float
    y: float
    confidence: float
    source: str                 # "detected" | "predicted" | "lost"
    raw_detection_confidence: Optional[float] = None


class KalmanBallTracker:
    """
    Kalman filter simple :
      état : [x, y, vx, vy]
      obs  : [x, y]

    Temps continu approximé avec dt = n_frames_elapsed / fps (ou dt=1 si on
    travaille en index de frame, ce qui est le cas ici).
    """

    def __init__(
        self,
        process_noise: float = 1.0,
        measurement_noise: float = 4.0,
        initial_uncertainty: float = 100.0,
        min_hits_to_confirm: int = 3,
        max_coast_frames: int = 25,
        max_speed_px_per_step: float = 250.0,
        gating_base_radius: float = 80.0,
    ):
        self.x = np.zeros((4, 1))            # état
        self.P = np.eye(4) * initial_uncertainty
        self.Q = np.eye(4) * process_noise
        self.R = np.eye(2) * measurement_noise

        self.H = np.array([[1, 0, 0, 0],
                           [0, 1, 0, 0]], dtype=float)

        self.min_hits_to_confirm = min_hits_to_confirm
        self.max_coast_frames = max_coast_frames
        self.max_speed_px_per_step = max_speed_px_per_step
        self.gating_base_radius = gating_base_radius

        self.state = TrackState.LOST
        self.hits = 0
        self.coast = 0
        self.last_detection_conf: Optional[float] = None
        self.initialized = False

    # -----------------------------------------------------
    # Core Kalman
    # -----------------------------------------------------
    def _F(self, dt: float) -> np.ndarray:
        return np.array([[1, 0, dt, 0],
                         [0, 1, 0, dt],
                         [0, 0, 1, 0],
                         [0, 0, 0, 1]], dtype=float)

    def _predict(self, dt: float):
        F = self._F(dt)
        self.x = F @ self.x
        self.P = F @ self.P @ F.T + self.Q

    def _update(self, z: np.ndarray):
        y = z - self.H @ self.x
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(4) - K @ self.H) @ self.P

    # -----------------------------------------------------
    # Gating / sélection de la meilleure détection ballon
    # -----------------------------------------------------
    def _gating_radius(self, dt: float) -> float:
        """Rayon adaptatif : s'agrandit si on a perdu le ballon depuis plusieurs frames."""
        speed = float(np.hypot(self.x[2, 0], self.x[3, 0]))
        return self.gating_base_radius + speed * dt + 20.0 * self.coast

    def _pick_best_candidate(
        self,
        candidates: List[Detection],
        dt: float,
    ) -> Optional[Detection]:
        """
        Choisit la détection ballon la plus plausible :
        - doit être dans le rayon de gating
        - score = confidence - 0.002 * distance_prédite
        """
        if not candidates:
            return None

        if not self.initialized:
            # Pas encore de track → on prend la plus confiante
            return max(candidates, key=lambda d: d.confidence)

        px, py = self.x[0, 0], self.x[1, 0]
        radius = self._gating_radius(dt)

        scored = []
        for d in candidates:
            dist = float(np.hypot(d.x - px, d.y - py))
            if dist > radius:
                continue
            # vitesse implicite : rejeter si trop rapide
            if dist / max(dt, 1e-6) > self.max_speed_px_per_step:
                continue
            score = d.confidence - 0.002 * dist
            scored.append((score, d))

        if not scored:
            return None
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    # -----------------------------------------------------
    # Étape principale
    # -----------------------------------------------------
    def step(
        self,
        frame_index: int,
        time_sec: float,
        dt: float,
        ball_candidates: List[Detection],
        player_positions: Optional[List[tuple]] = None,
    ) -> TrackOutput:
        """
        Effectue une étape de tracking pour la frame courante.

        - dt : écart temporel (en "steps") depuis la dernière invocation
               (ex : frame_step si on travaille en indices de frame)
        - ball_candidates : détections ballon (déjà filtrées par le détecteur)
        - player_positions : [(x, y), ...] pour validation contextuelle
        """
        # 1. Prédiction
        if self.initialized:
            self._predict(dt)

        # 2. Choix du meilleur candidat
        best = self._pick_best_candidate(ball_candidates, dt)

        # 3. Validation contextuelle : plausibilité par rapport aux joueurs
        best = self._contextual_validate(best, player_positions)

        # 4. Update ou coasting
        if best is not None:
            z = np.array([[best.x], [best.y]])
            if not self.initialized:
                self.x = np.array([[best.x], [best.y], [0.0], [0.0]])
                self.initialized = True
            else:
                self._update(z)

            self.hits += 1
            self.coast = 0
            self.last_detection_conf = best.confidence

            if self.state in (TrackState.LOST, TrackState.TENTATIVE):
                if self.hits >= self.min_hits_to_confirm:
                    self.state = TrackState.CONFIRMED
                else:
                    self.state = TrackState.TENTATIVE
            else:
                self.state = TrackState.CONFIRMED

            source = "detected"
            confidence = float(best.confidence)
        else:
            # Aucune détection ballon exploitable
            if not self.initialized:
                # pas encore de track → on ne publie rien d'utile
                return TrackOutput(
                    frame=frame_index, time=time_sec,
                    x=0.0, y=0.0, confidence=0.0, source="lost",
                )
            self.coast += 1
            if self.coast > self.max_coast_frames:
                self.state = TrackState.LOST
                return TrackOutput(
                    frame=frame_index, time=time_sec,
                    x=float(self.x[0, 0]), y=float(self.x[1, 0]),
                    confidence=0.0, source="lost",
                )
            self.state = TrackState.COASTING
            source = "predicted"
            # Confiance dégradée avec l'ancienneté
            base = self.last_detection_conf or 0.5
            confidence = max(0.0, base * (1.0 - self.coast / (self.max_coast_frames + 1)))

        return TrackOutput(
            frame=frame_index,
            time=time_sec,
            x=float(self.x[0, 0]),
            y=float(self.x[1, 0]),
            confidence=round(confidence, 3),
            source=source,
            raw_detection_confidence=(best.confidence if best else None),
        )

    # -----------------------------------------------------
    # Validation contextuelle avec joueurs
    # -----------------------------------------------------
    def _contextual_validate(
        self,
        candidate: Optional[Detection],
        player_positions: Optional[List[tuple]],
    ) -> Optional[Detection]:
        """
        Heuristique simple : si le ballon détecté est très loin de TOUS les
        joueurs (ex : > 400 px), c'est probablement un faux positif.
        Désactivé quand le ballon a une confiance élevée (> 0.55).
        """
        if candidate is None:
            return None
        if candidate.confidence > 0.55:
            return candidate
        if not player_positions:
            return candidate

        min_d = min(
            float(np.hypot(candidate.x - px, candidate.y - py))
            for px, py in player_positions
        )
        if min_d > 400.0:
            return None  # rejeté comme faux positif
        return candidate
