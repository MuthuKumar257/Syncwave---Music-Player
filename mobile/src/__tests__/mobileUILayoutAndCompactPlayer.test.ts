import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getResponsiveMetrics } from '../utils/responsive';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../api/types';

describe('Mobile UI Layout and Responsive Player Verification Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePlayerStore.getState().clearSleepTimer();
  });

  afterEach(() => {
    vi.useRealTimers();
    usePlayerStore.getState().clearSleepTimer();
  });

  // 1. Responsive Breakpoints Verification
  it('correctly categorizes small Android phones, standard phones, large phones, and tablets', () => {
    // Small phone: width 340
    const smallPhone = getResponsiveMetrics({ width: 340, height: 680, scale: 2, fontScale: 1 });
    expect(smallPhone.isSmallPhone).toBe(true);
    expect(smallPhone.isStandardPhone).toBe(false);
    expect(smallPhone.cardWidth).toBe(126);
    expect(smallPhone.screenPadding).toBe(12);

    // Standard phone: width 375
    const stdPhone = getResponsiveMetrics({ width: 375, height: 812, scale: 3, fontScale: 1 });
    expect(stdPhone.isStandardPhone).toBe(true);
    expect(stdPhone.isSmallPhone).toBe(false);
    expect(stdPhone.cardWidth).toBe(142);
    expect(stdPhone.screenPadding).toBe(16);

    // Large phone: width 430
    const largePhone = getResponsiveMetrics({ width: 430, height: 932, scale: 3, fontScale: 1 });
    expect(largePhone.isLargePhone).toBe(true);
    expect(largePhone.cardWidth).toBe(152);

    // Tablet: width 768
    const tablet = getResponsiveMetrics({ width: 768, height: 1024, scale: 2, fontScale: 1 });
    expect(tablet.isTablet).toBe(true);
    expect(tablet.cardWidth).toBe(176);
    expect(tablet.screenPadding).toBe(24);
  });

  // 2. Compact Bottom Player Sleep Timer Integration
  it('sets and decrements sleep timer with second precision and pauses audio upon expiry', () => {
    const store = usePlayerStore.getState();

    // Start 15 minute timer
    store.setSleepTimer(15);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBe(15);
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBe(900);

    // Advance 60 seconds
    vi.advanceTimersByTime(60000);
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBe(840);

    // Fast-forward to end
    vi.advanceTimersByTime(840000);
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBe(0);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBeNull();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it('clears active sleep timer cleanly on request', () => {
    const store = usePlayerStore.getState();
    store.setSleepTimer(30);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBe(30);

    store.clearSleepTimer();
    expect(usePlayerStore.getState().sleepTimerMinutes).toBeNull();
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBe(0);
  });

  // 3. Compact Mini Player State & Controls
  it('manages mini player visibility and modal toggles correctly', () => {
    const store = usePlayerStore.getState();
    expect(store.isSleepTimerModalVisible).toBe(false);

    store.setSleepTimerModalVisible(true);
    expect(usePlayerStore.getState().isSleepTimerModalVisible).toBe(true);

    store.setSleepTimerModalVisible(false);
    expect(usePlayerStore.getState().isSleepTimerModalVisible).toBe(false);

    store.setQueueSheetVisible(true);
    expect(usePlayerStore.getState().isQueueSheetVisible).toBe(true);
  });

  // 4. Five Tab Navigation Configuration Integrity
  it('has linking and routing definitions for the 5 required tabs: Home, Discover, Library, Scheduler, Profile', async () => {
    const linkingModule = await import('../navigation/linking');
    const screens: any = linkingModule.linking.config?.screens;
    expect(screens).toBeDefined();
    expect(screens.MainTabs.screens.HomeTab).toBe('home');
    expect(screens.MainTabs.screens.DiscoverTab).toBe('discover');
    expect(screens.MainTabs.screens.LibraryTab).toBeDefined();
    expect(screens.MainTabs.screens.SchedulerTab).toBe('scheduler');
    expect(screens.MainTabs.screens.ProfileTab).toBe('profile');
  });

  // 5. Track Card Sizing & Square Artwork
  it('calculates compact and standard card dimensions without clipping', () => {
    const metrics = getResponsiveMetrics({ width: 375, height: 812, scale: 3, fontScale: 1 });
    const standardWidth = metrics.cardWidth;
    const compactWidth = Math.round(metrics.cardWidth * 0.88);

    expect(standardWidth).toBe(142);
    expect(compactWidth).toBe(125);
    // Two cards plus padding fit within standard mobile width without horizontal overflow
    expect(standardWidth * 2 + metrics.screenPadding * 2).toBeLessThan(375);
  });
});
