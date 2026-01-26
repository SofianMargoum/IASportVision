// components/utils.js

export const getFilenameFromVideoUri = (uri) => {
  try {
    const decoded = decodeURIComponent(uri);
    const match = decoded.match(/\/([^\/]+\/[^\/]+)\.\w+$/);
    if (match && match[1]) {
      return `/${match[1]}.json`;
    }
    console.warn('❌ Aucun nom de fichier détecté dans l’URI :', uri);
    return 'zoommaps/unknown.json';
  } catch (error) {
    console.warn('❌ Erreur dans getFilenameFromVideoUri :', error);
    return 'zoommaps/invalid.json';
  }
};
export const smoothMoveTo = (
  positions,
  zoomableViewRef,
  lastPositionRef,
  currentAnimationIdRef,
  onComplete
) => {
  if (!Array.isArray(positions) || positions.length === 0) return;

  const totalDurationMs = 5000;
  const frameRate = 60;
  const totalFrames = (totalDurationMs / 1000) * frameRate;

  const animationId = ++currentAnimationIdRef.current;

  // On démarre depuis la dernière position connue (même si elle ne fait pas partie des positions)
  const start = lastPositionRef.current || positions[0];
  const fullPositions = [start, ...positions];

  let frame = 0;

  const animate = () => {
    if (animationId !== currentAnimationIdRef.current) return;

    const progress = frame / totalFrames;
    const totalSegments = fullPositions.length - 1;
    const segmentIndex = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

    const localT = (progress * totalSegments) - segmentIndex;
    const easedT = localT; // 👈 ici, pas d'easing, juste interpolation linéaire

    const p0 = fullPositions[segmentIndex];
    const p1 = fullPositions[segmentIndex + 1];

    const x = p0.x + (p1.x - p0.x) * easedT;
    const y = p0.y + (p1.y - p0.y) * easedT;

    zoomableViewRef.current?.moveTo?.(x, y);
    lastPositionRef.current = { x, y };

    if (frame < totalFrames) {
      frame++;
      requestAnimationFrame(animate);
    } else {
      if (onComplete) onComplete();
    }
  };

  animate();
};
