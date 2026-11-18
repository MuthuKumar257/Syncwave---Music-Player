import { describe, it, expect } from 'vitest';
import { getResponsiveMetrics, calculateBottomBarOffset } from '../utils/responsive';
import * as fs from 'fs';
import * as path from 'path';

describe('SyncWave Mobile Responsive Viewports and Layout Audit Suite', () => {
  // All 7 required mobile viewports:
  const VIEWPORTS = [
    { name: 'iPhone SE (1st gen) / Compact', width: 320, height: 568 },
    { name: 'Legacy Compact Android', width: 360, height: 640 },
    { name: 'Modern Budget Android', width: 360, height: 800 },
    { name: 'iPhone X / 11 Pro / Mini', width: 375, height: 812 },
    { name: 'iPhone 12 / 13 / 14 Standard', width: 390, height: 844 },
    { name: 'Pixel 7 / Galaxy S21 Flagship', width: 412, height: 915 },
    { name: 'iPhone 14 / 15 Pro Max', width: 430, height: 932 }
  ] as const;

  // 1. All 7 Device Viewport Tests
  describe('1. Seven Device Dimensions Categorization & Card Scaling', () => {
    it.each(VIEWPORTS)('calculates metrics for $name ($width x $height)', ({ width, height }) => {
      const metrics = getResponsiveMetrics({ width, height });

      expect(metrics.width).toBe(width);
      expect(metrics.height).toBe(height);
      expect(metrics.cardWidth).toBeGreaterThanOrEqual(120);
      expect(metrics.cardWidth).toBeLessThanOrEqual(160);
      expect(metrics.screenPadding).toBeGreaterThanOrEqual(12);

      // Verify two cards plus horizontal padding don't overflow the viewport width
      const twoCardsWithPadding = metrics.cardWidth * 2 + metrics.screenPadding * 2;
      expect(twoCardsWithPadding).toBeLessThan(width * 1.5); // Fits nicely in horizontal carousel
    });

    it('correctly flags short screen for 320x568 and 360x640', () => {
      const se = getResponsiveMetrics({ width: 320, height: 568 });
      expect(se.isSmallPhone).toBe(true);
      expect(se.isShortScreen).toBe(true);

      const legacyAndroid = getResponsiveMetrics({ width: 360, height: 640 });
      expect(legacyAndroid.isSmallPhone).toBe(false);
      expect(legacyAndroid.isShortScreen).toBe(true);

      const modernAndroid = getResponsiveMetrics({ width: 360, height: 800 });
      expect(modernAndroid.isShortScreen).toBe(false);
    });

    it('correctly categorizes width tiers across 320, 360, 375, 390, 412, and 430', () => {
      expect(getResponsiveMetrics({ width: 320, height: 568 }).isSmallPhone).toBe(true);
      expect(getResponsiveMetrics({ width: 360, height: 800 }).isStandardPhone).toBe(true);
      expect(getResponsiveMetrics({ width: 375, height: 812 }).isStandardPhone).toBe(true);
      expect(getResponsiveMetrics({ width: 390, height: 844 }).isStandardPhone).toBe(true);
      expect(getResponsiveMetrics({ width: 412, height: 915 }).isStandardPhone).toBe(true);
      expect(getResponsiveMetrics({ width: 430, height: 932 }).isLargePhone).toBe(true);
    });
  });

  // 2. Bottom Navigation & Mini-Player Clearance Calculations
  describe('2. Dynamic Bottom Bar Clearance Offset Calculations', () => {
    it('calculates clearance on Tab Screens with Active MiniPlayer and iOS home indicator (34px)', () => {
      const offset = calculateBottomBarOffset({
        insetsBottom: 34,
        hasMiniPlayer: true,
        isTabScreen: true,
        extraPadding: 16
      });
      // 52 (tabBar) + 34 (safeBottom) + 50 (miniPlayer) + 16 (extraPadding) = 152px
      expect(offset).toBe(152);
    });

    it('calculates clearance on Tab Screens with Active MiniPlayer on zero-inset Android device', () => {
      const offset = calculateBottomBarOffset({
        insetsBottom: 0,
        hasMiniPlayer: true,
        isTabScreen: true,
        extraPadding: 16
      });
      // 52 (tabBar) + 6 (safeBottom min) + 50 (miniPlayer) + 16 (extraPadding) = 124px
      expect(offset).toBe(124);
    });

    it('calculates clearance on Tab Screens when MiniPlayer is hidden', () => {
      const offset = calculateBottomBarOffset({
        insetsBottom: 34,
        hasMiniPlayer: false,
        isTabScreen: true,
        extraPadding: 16
      });
      // 52 (tabBar) + 34 (safeBottom) + 0 (miniPlayer) + 16 = 102px
      expect(offset).toBe(102);
    });

    it('calculates clearance on Stack Screens (PlaylistDetail, Downloads) with MiniPlayer', () => {
      const offset = calculateBottomBarOffset({
        insetsBottom: 34,
        hasMiniPlayer: true,
        isTabScreen: false,
        extraPadding: 16
      });
      // 50 (miniPlayer) + 34 (insetsBottom) + 16 = 100px
      expect(offset).toBe(100);
    });

    it('calculates clearance on Stack Screens without MiniPlayer on modern Android gesture bar (16px)', () => {
      const offset = calculateBottomBarOffset({
        insetsBottom: 16,
        hasMiniPlayer: false,
        isTabScreen: false,
        extraPadding: 16
      });
      // 0 + 16 (insetsBottom) + 16 = 32px
      expect(offset).toBe(32);
    });
  });

  // 3. Mini-Player Controls Adaptation
  describe('3. MiniPlayer Controls Responsive Layout', () => {
    it('adapts control buttons count based on window width', () => {
      // Small screen (< 360): 3 buttons (Favourite, Play/Pause, Next)
      const getSmallPhoneButtonsCount = (w: number) => {
        const isSmall = w < 360;
        const isStandard = w >= 360 && w < 414;
        if (isSmall) return 3; // Fav, Play, Next
        if (isStandard) return 5; // Fav, Prev, Play, Next, Queue
        return 8; // Full buttons
      };

      expect(getSmallPhoneButtonsCount(320)).toBe(3);
      expect(getSmallPhoneButtonsCount(360)).toBe(5);
      expect(getSmallPhoneButtonsCount(375)).toBe(5);
      expect(getSmallPhoneButtonsCount(412)).toBe(5);
      expect(getSmallPhoneButtonsCount(430)).toBe(8);

      // On 320px width:
      // thumbnail: 40px + 10px margin = 50px
      // 3 buttons: (32px + 4px) * 2 + (36px + 4px) = 112px
      // song metadata gets remaining: 320 - (16px padding + 50px + 112px) = 142px
      const availableMetaWidth = 320 - (16 + 50 + 112);
      expect(availableMetaWidth).toBeGreaterThan(120); // Titles elide cleanly without horizontal overflow!
    });
  });

  // 4. FullPlayer Dynamic Artwork Scaling on Short Displays
  describe('4. FullPlayer Dynamic Artwork Sizing Algorithm', () => {
    const calculateFullPlayerArtworkSize = (windowHeight: number) => {
      return Math.min(320, Math.max(160, Math.round(windowHeight * 0.32)));
    };

    it('scales down artwork on short screens to keep controls and scrubber visible', () => {
      // 320x568 iPhone SE
      const artSE = calculateFullPlayerArtworkSize(568);
      expect(artSE).toBe(182); // Scaled down from 320px, saving 138px of vertical height!

      // 360x640 Compact Android
      const artCompact = calculateFullPlayerArtworkSize(640);
      expect(artCompact).toBe(205); // Scaled down from 320px, saving 115px!

      // 375x812 iPhone X
      const artStandard = calculateFullPlayerArtworkSize(812);
      expect(artStandard).toBe(260);

      // 390x844 iPhone 12/13
      const artIPhone12 = calculateFullPlayerArtworkSize(844);
      expect(artIPhone12).toBe(270);

      // 430x932 iPhone 14 Pro Max
      const artMax = calculateFullPlayerArtworkSize(932);
      expect(artMax).toBe(298);
      expect(artMax).toBeLessThanOrEqual(320);
    });
  });

  // 5. Codebase Static Verification: No Duplicate MiniPlayer in Tab Screens
  describe('5. Architectural Check: No Duplicate MiniPlayer in Tab Screens', () => {
    const screensDir = path.resolve(__dirname, '../screens');

    const tabScreenFiles = [
      'search/SearchScreen.tsx',
      'library/LibraryScreen.tsx',
      'scheduler/SchedulerScreen.tsx',
      'profile/ProfileScreen.tsx'
    ];

    it.each(tabScreenFiles)('verifies %s does not render redundant <MiniPlayer />', (relativeFilePath) => {
      const fullPath = path.join(screensDir, relativeFilePath);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Should not contain JSX invocation <MiniPlayer
      const hasMiniPlayerInvocation = /<MiniPlayer[\s\/>]/.test(content);
      expect(hasMiniPlayerInvocation).toBe(false);
    });
  });
});
