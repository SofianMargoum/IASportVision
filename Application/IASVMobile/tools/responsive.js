// tools/responsive.js
// Utilitaires responsive pour adapter l'UI à toutes les tailles/densités d'écrans Android.
// Inspiré de react-native-size-matters (sans dépendance externe).
//
// Usage :
//   import { scale, verticalScale, moderateScale, ms, vs, s } from '../tools/responsive';
//   fontSize: moderateScale(14)
//   padding: scale(12)
//   height: verticalScale(40)

import { Dimensions, PixelRatio, Platform } from 'react-native';

// Référence : iPhone 11 / écran "moyen" -> 375 x 812.
// On garde ces valeurs comme base car elles sont le standard de facto pour les libs RN.
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Largeur/hauteur de la "fenêtre" (hors barres système). On les recalcule à la volée
// pour gérer rotation et split-screen via getCurrentDimensions().
function getCurrentDimensions() {
  const { width, height } = Dimensions.get('window');
  // En paysage, on inverse pour garder une base "portrait" cohérente côté scaling.
  const shortDim = Math.min(width, height);
  const longDim = Math.max(width, height);
  return { shortDim, longDim, width, height };
}

/**
 * scale : met à l'échelle horizontalement par rapport à la largeur de référence.
 * Idéal pour : largeurs, paddings/margins horizontaux, tailles d'icônes.
 */
export const scale = (size) => {
  const { shortDim } = getCurrentDimensions();
  return (shortDim / guidelineBaseWidth) * size;
};

/**
 * verticalScale : met à l'échelle verticalement par rapport à la hauteur de référence.
 * Idéal pour : hauteurs, paddings/margins verticaux.
 */
export const verticalScale = (size) => {
  const { longDim } = getCurrentDimensions();
  return (longDim / guidelineBaseHeight) * size;
};

/**
 * moderateScale : scale "atténué" via un facteur (0.5 par défaut).
 * Idéal pour : font-size, border-radius, éléments qui ne doivent pas grossir trop fort
 * sur tablettes/grands écrans.
 */
export const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

/**
 * moderateVerticalScale : équivalent vertical du moderateScale.
 */
export const moderateVerticalScale = (size, factor = 0.5) =>
  size + (verticalScale(size) - size) * factor;

// Alias courts (compatibles size-matters)
export const s = scale;
export const vs = verticalScale;
export const ms = moderateScale;
export const mvs = moderateVerticalScale;

/**
 * Arrondit à un pixel physique (évite les sous-pixels flous).
 */
export const px = (size) => PixelRatio.roundToNearestPixel(size);

/**
 * Helpers de breakpoints.
 */
export const isTablet = () => {
  const { shortDim, longDim } = getCurrentDimensions();
  // Heuristique simple : la plus petite dimension >= 600dp -> tablette.
  return shortDim >= 600 || (Platform.OS === 'ios' && longDim / shortDim < 1.6);
};

export const isSmallDevice = () => {
  const { shortDim } = getCurrentDimensions();
  return shortDim < 360; // ex : vieux Android, petits Xiaomi/Oppo entry-level
};

export const isLandscape = () => {
  const { width, height } = Dimensions.get('window');
  return width > height;
};

/**
 * Retourne les dimensions "live" de la fenêtre.
 * Préférer useWindowDimensions() côté composant pour réagir aux changements.
 */
export const getWindow = () => Dimensions.get('window');
export const getScreen = () => Dimensions.get('screen');

export default {
  scale,
  verticalScale,
  moderateScale,
  moderateVerticalScale,
  s,
  vs,
  ms,
  mvs,
  px,
  isTablet,
  isSmallDevice,
  isLandscape,
  getWindow,
  getScreen,
};
