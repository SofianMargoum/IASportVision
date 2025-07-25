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
  targetX,
  targetY,
  zoomableViewRef,
  lastPositionRef,
  currentAnimationIdRef
) => {
  const MAX_STEPS = 40;
  const MIN_STEPS = 10;
  const DELAY = 16; // ~60 fps
  let step = 0;

  const animationId = ++currentAnimationIdRef.current;

  const current = lastPositionRef.current ?? { x: targetX, y: targetY };
  const dx = targetX - current.x;
  const dy = targetY - current.y;
  const distance = Math.hypot(dx, dy);

  // Auto-calcule le nombre de steps selon la distance
  const steps = Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.floor(distance / 10)));

  const easeInOutQuad = (t) =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  const animateStep = () => {
    if (animationId !== currentAnimationIdRef.current) return;

    if (step <= steps) {
      const t = step / steps;
      const easedT = easeInOutQuad(t);

      const x = current.x + dx * easedT;
      const y = current.y + dy * easedT;

      zoomableViewRef.current?.moveTo?.(x, y);
      lastPositionRef.current = { x, y };

      step++;
      setTimeout(animateStep, DELAY);
    }
  };

  animateStep();
};
