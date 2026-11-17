import { Dimensions, PixelRatio, ScaledSize } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ResponsiveMetrics {
  width: number;
  height: number;
  isSmallPhone: boolean;
  isStandardPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  cardWidth: number;
  screenPadding: number;
  sectionGap: number;
  playerHeight: number;
  bottomNavHeight: number;
}

export function getResponsiveMetrics(customDimensions?: ScaledSize): ResponsiveMetrics {
  const width = customDimensions?.width || Dimensions.get('window').width;
  const height = customDimensions?.height || Dimensions.get('window').height;

  const isSmallPhone = width < 360;
  const isStandardPhone = width >= 360 && width < 414;
  const isLargePhone = width >= 414 && width < 600;
  const isTablet = width >= 600;

  // Responsive card width for song carousels
  let cardWidth = 142;
  if (isSmallPhone) {
    cardWidth = 126;
  } else if (isLargePhone) {
    cardWidth = 152;
  } else if (isTablet) {
    cardWidth = 176;
  }

  // Responsive horizontal screen padding
  const screenPadding = isSmallPhone ? 12 : isTablet ? 24 : 16;
  const sectionGap = isSmallPhone ? 14 : isTablet ? 24 : 18;

  return {
    width,
    height,
    isSmallPhone,
    isStandardPhone,
    isLargePhone,
    isTablet,
    cardWidth,
    screenPadding,
    sectionGap,
    playerHeight: 48,
    bottomNavHeight: 52
  };
}

export const Responsive = getResponsiveMetrics();

export function scaleSize(size: number): number {
  const currentWidth = Dimensions.get('window').width;
  // Base scale on standard 375pt mobile width
  const scale = currentWidth / 375;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}
