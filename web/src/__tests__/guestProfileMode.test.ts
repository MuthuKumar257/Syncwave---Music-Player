import { describe, it, expect, beforeEach, vi } from 'vitest';

const storageBacking = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageBacking.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageBacking.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageBacking.delete(key);
  },
  clear: () => {
    storageBacking.clear();
  }
};

vi.stubGlobal('localStorage', localStorageMock);

import { useAnalyticsStore } from '../store/useAnalyticsStore';
import { useRecommendationStore } from '../store/useRecommendationStore';

describe('Guest Profile Mode & Analytics Store Auth Protection', () => {
  beforeEach(() => {
    storageBacking.clear();
    vi.restoreAllMocks();
    useAnalyticsStore.getState().clearCache();
    useRecommendationStore.setState({
      preferences: null,
      feed: null,
      isLoading: false
    });
  });

  it('fetchStats does NOT make API call or throw 401 when unauthenticated (guest mode)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await useAnalyticsStore.getState().fetchStats(true);

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useAnalyticsStore.getState().stats).toBeNull();
    expect(useAnalyticsStore.getState().isLoading).toBe(false);
    expect(useAnalyticsStore.getState().error).toBeNull();
  });

  it('fetchPreferences does NOT call API when unauthenticated', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await useRecommendationStore.getState().fetchPreferences();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useRecommendationStore.getState().preferences).toBeNull();
  });

  it('recordPlaybackSession does NOT send data to backend when unauthenticated', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await useAnalyticsStore.getState().recordPlaybackSession({
      songId: 'guest_song_1',
      songTitle: 'Test Song',
      artistName: 'Test Artist',
      durationMs: 120000
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useAnalyticsStore.getState().isRecording).toBe(false);
  });

  it('fetchStats makes authenticated request when syncwave_token is present', async () => {
    localStorageMock.setItem('syncwave_token', 'valid_test_token_123');

    const mockStats = {
      favouriteArtist: { name: 'Harris Jayaraj', roleTitle: 'Music Director', imageUrl: '' },
      favouriteArtists: [],
      mostListenedArtist: null,
      topListenedArtists: [],
      mostReplayedSongs: [],
      topMusicDirectors: [],
      hourlyListeningHeatmap: [],
      formattedListeningTime: '1h 30m',
      summary: {
        totalPlays: 12,
        totalListeningMinutes: 90,
        totalListeningHours: 1.5,
        totalRewatches: 3,
        uniqueArtistsListened: 5,
        favouriteArtistName: 'Harris Jayaraj',
        formattedListeningTime: '1h 30m'
      }
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, stats: mockStats })
    } as any);

    const result = await useAnalyticsStore.getState().fetchStats(true);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/recommendations/profile-stats',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid_test_token_123'
        })
      })
    );
    expect(result).toEqual(mockStats);
    expect(useAnalyticsStore.getState().stats).toEqual(mockStats);
  });

  it('clearCache removes cached data from localStorage and resets state', () => {
    localStorageMock.setItem('syncwave_analytics_stats_cache_v1', JSON.stringify({ stats: { dummy: true } }));
    useAnalyticsStore.setState({ error: 'Some error', lastFetchedAt: 123456789 });

    useAnalyticsStore.getState().clearCache();

    expect(localStorageMock.getItem('syncwave_analytics_stats_cache_v1')).toBeNull();
    expect(useAnalyticsStore.getState().stats).toBeNull();
    expect(useAnalyticsStore.getState().lastFetchedAt).toBeNull();
    expect(useAnalyticsStore.getState().error).toBeNull();
  });
});
