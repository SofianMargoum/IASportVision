"""
Post-traitement de la trajectoire ballon :
- interpolation linéaire des gaps courts
- lissage (moving average ou Savitzky-Golay si scipy dispo)
- suppression des sauts physiquement impossibles
"""

from typing import List
import numpy as np

from .tracker import TrackOutput


def enforce_max_speed(
    track: List[TrackOutput],
    max_speed_px_per_step: float = 300.0,
) -> List[TrackOutput]:
    """Remplace les positions qui impliquent une vitesse irréaliste par la précédente."""
    if len(track) < 2:
        return track
    out = [track[0]]
    for i in range(1, len(track)):
        prev = out[-1]
        cur = track[i]
        dt = max(cur.frame - prev.frame, 1)
        dist = float(np.hypot(cur.x - prev.x, cur.y - prev.y))
        if dist / dt > max_speed_px_per_step and cur.source != "detected":
            # on remplace par la position précédente (coasting effectif)
            cur.x = prev.x
            cur.y = prev.y
            cur.source = "predicted"
            cur.confidence = max(0.0, prev.confidence * 0.8)
        out.append(cur)
    return out


def interpolate_gaps(track: List[TrackOutput], max_gap: int = 8) -> List[TrackOutput]:
    """
    Interpolation linéaire pour remplir les petits trous de détection.
    Les outputs existent déjà (le Kalman produit du 'predicted'), donc ici
    on lisse les enchaînements lost→detected en recalculant les predicted.
    """
    if len(track) < 3:
        return track

    xs = np.array([t.x for t in track], dtype=float)
    ys = np.array([t.y for t in track], dtype=float)
    sources = [t.source for t in track]

    # Détecter les plages "predicted"/"lost" entourées de "detected"
    i = 0
    while i < len(track):
        if sources[i] != "detected":
            j = i
            while j < len(track) and sources[j] != "detected":
                j += 1
            # plage [i, j) non-détectée
            if i > 0 and j < len(track) and (j - i) <= max_gap:
                x0, y0 = xs[i - 1], ys[i - 1]
                x1, y1 = xs[j], ys[j]
                for k in range(i, j):
                    t = (k - i + 1) / (j - i + 1)
                    xs[k] = x0 + t * (x1 - x0)
                    ys[k] = y0 + t * (y1 - y0)
            i = j
        else:
            i += 1

    for k, o in enumerate(track):
        o.x = float(xs[k])
        o.y = float(ys[k])
    return track


def smooth_moving_average(track: List[TrackOutput], window: int = 5) -> List[TrackOutput]:
    """Moyenne glissante centrée sur x et y (préserve l'objet TrackOutput)."""
    if len(track) < window or window <= 1:
        return track
    xs = np.array([t.x for t in track], dtype=float)
    ys = np.array([t.y for t in track], dtype=float)
    kernel = np.ones(window) / window
    pad = window // 2
    xs_p = np.pad(xs, pad, mode="edge")
    ys_p = np.pad(ys, pad, mode="edge")
    xs_s = np.convolve(xs_p, kernel, mode="valid")
    ys_s = np.convolve(ys_p, kernel, mode="valid")
    for k, o in enumerate(track):
        o.x = float(xs_s[k])
        o.y = float(ys_s[k])
    return track


def postprocess(track: List[TrackOutput]) -> List[TrackOutput]:
    """Pipeline complet de post-traitement."""
    track = enforce_max_speed(track)
    track = interpolate_gaps(track, max_gap=8)
    track = smooth_moving_average(track, window=5)
    return track
