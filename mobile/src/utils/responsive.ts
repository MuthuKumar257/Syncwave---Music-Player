import { Dimensions, PixelRatio, ScaledSize, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/usePlayerStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ResponsiveMetrics {
  width: number;
  height: number;
  isSmallPhone: boolean;
  isStandardPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  isShortScreen: boolean;
  cardWidth: number;
  screenPadding: number;
  sectionGap: number;
  playerHeight: number;
  bottomNavHeight: number;
}

export function getResponsiveMetrics(customDimensions?: ScaledSize | { width: number; height: number }): ResponsiveMetrics {
  const width = customDimensions?.width || Dimensions.get('window').width;
  const height = customDimensions?.height || Dimensions.get('window').height;

  const isSmallPhone = width < 360;
  const isStandardPhone = width >= 360 && width < 414;
  const isLargePhone = width >= 414 && width < 600;
  const isTablet = width >= 600;
  const isShortScreen = height <= 640;

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
    isShortScreen,
    cardWidth,
    screenPadding,
    sectionGap,
    playerHeight: 48,
    bottomNavHeight: 52
  };
}

export const Responsive = getResponsiveMetrics();

/**
 * Hook to provide responsive metrics that dynamically react to window dimension changes
 * (orientation rotation, foldables, split-screen mode).
 */
export function useResponsiveMetrics(): ResponsiveMetrics {
  const { width, height } = useWindowDimensions();
  return getResponsiveMetrics({ width, height });
}

/**
 * Pure calculation function for bottom bar clearance offset.
 */
export function calculateBottomBarOffset(options: {
  insetsBottom: number;
  hasMiniPlayer: boolean;
  isTabScreen?: boolean;
  extraPadding?: number;
}): number {
  const { insetsBottom, hasMiniPlayer, isTabScreen = true, extraPadding = 16 } = options;
  const safeBottom = Math.max(insetsBottom, 6);
  const miniPlayerHeight = hasMiniPlayer ? 50 : 0;

  if (isTabScreen) {
    const tabHeight = 52 + safeBottom;
    return tabHeight + miniPlayerHeight + extraPadding;
  } else {
    return (hasMiniPlayer ? 50 : 0) + Math.max(insetsBottom, 12) + extraPadding;
  }
}

/**
 * Hook to compute the required bottom padding for scroll views so that content
 * is never obscured by the persistent mini-player and bottom tab navigation.
 */
export function useBottomBarOffset(options?: {
  isTabScreen?: boolean;
  extraPadding?: number;
}): number {
  const insets = useSafeAreaInsets();
  const isMiniPlayerVisible = usePlayerStore((s) => s.isMiniPlayerVisible);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const hasMiniPlayer = isMiniPlayerVisible && !!currentTrack;

  return calculateBottomBarOffset({
    insetsBottom: insets.bottom,
    hasMiniPlayer,
    isTabScreen: options?.isTabScreen ?? true,
    extraPadding: options?.extraPadding ?? 16
  });
}

export function scaleSize(size: number): number {
  const currentWidth = Dimensions.get('window').width;
  // Base scale on standard 375pt mobile width
  const scale = currentWidth / 375;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}
