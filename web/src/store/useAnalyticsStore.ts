import { create } from 'zustand';
import { ProfileStats, UserMusicPreference } from '../types';

interface RecordPlaybackParams {
  songId: string;
  songTitle: string;
  artistName: string;
  musicDirector?: string;
  language?: string;
  durationMs: number;
  completed?: boolean;
}

interface AnalyticsState {
  stats: ProfileStats | null;
  isLoading: boolean;
  isRecording: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  // Actions
  fetchStats: (force?: boolean) => Promise<ProfileStats | null>;
  recordPlaybackSession: (params: RecordPlaybackParams) => Promise<void>;
  updateTastePreferences: (updates: Partial<UserMusicPreference>) => Promise<void>;
  clearCache: () => void;
}

const ANALYTICS_CACHE_KEY = 'syncwave_analytics_stats_cache_v1';

const getStoredToken = (): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('syncwave_token');
  } catch {
    return null;
  }
};

const loadCachedStats = (): ProfileStats | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ANALYTICS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.stats || null;
  } catch {
    return null;
  }
};

const saveCachedStats = (stats: ProfileStats) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      ANALYTICS_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), stats })
    );
  } catch {
    // Ignore storage quota errors
  }
};

let inFlightStatsRequest: Promise<ProfileStats | null> | null = null;

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  stats: loadCachedStats(),
  isLoading: false,
  isRecording: false,
  error: null,
  lastFetchedAt: null,

  fetchStats: async (force = false) => {
    const now = Date.now();
    const last = get().lastFetchedAt;

    // Deduplicate rapid requests within 1000ms unless forced
    if (!force && last && now - last < 1000 && get().stats) {
      return get().stats;
    }

    if (inFlightStatsRequest) {
      return inFlightStatsRequest;
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    set({ isLoading: !get().stats });

    inFlightStatsRequest = (async () => {
      try {
        const res = await fetch('/api/recommendations/profile-stats', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.stats) {
            const stats = json.stats as ProfileStats;
            saveCachedStats(stats);
            set({
              stats,
              isLoading: false,
              error: null,
              lastFetchedAt: Date.now()
            });
            return stats;
          }
        }
        // If response is not ok, preserve existing or cached stats
        const fallback = get().stats || loadCachedStats();
        set({ isLoading: false, error: 'Could not refresh stats from server' });
        return fallback;
      } catch (err: any) {
        console.warn('[useAnalyticsStore] Failed to fetch stats, using cached data:', err);
        const fallback = get().stats || loadCachedStats();
        set({
          stats: fallback,
          isLoading: false,
          error: err?.message || 'Network error fetching stats'
        });
        return fallback;
      } finally {
        inFlightStatsRequest = null;
      }
    })();

    return inFlightStatsRequest;
  },

  recordPlaybackSession: async (params: RecordPlaybackParams) => {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    set({ isRecording: true });

    // Optimistically bump local stats for instantaneous UI response
    const currentStats = get().stats;
    if (currentStats) {
      const updatedTotalPlays = currentStats.summary.totalPlays + 1;
      const additionalMinutes = Math.max(1, Math.round(params.durationMs / 60000));
      const updatedTotalMinutes = currentStats.summary.totalListeningMinutes + additionalMinutes;
      const hours = Math.floor(updatedTotalMinutes / 60);
      const mins = updatedTotalMinutes % 60;
      const formattedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      set({
        stats: {
          ...currentStats,
          formattedListeningTime: formattedTime,
          summary: {
            ...currentStats.summary,
            totalPlays: updatedTotalPlays,
            totalListeningMinutes: updatedTotalMinutes,
            totalListeningHours: Number((updatedTotalMinutes / 60).toFixed(1)),
            formattedListeningTime: formattedTime
          }
        }
      });
    }

    try {
      // 1. Dual-write to history and recommendation engine
      await Promise.allSettled([
        fetch('/api/history', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            songId: params.songId,
            songTitle: params.songTitle,
            artistName: params.artistName,
            musicDirector: params.musicDirector || params.artistName,
            language: params.language,
            durationListenedMs: params.durationMs,
            completed: params.completed ?? false,
            clientPlatform: 'WEB'
          })
        }),
        fetch('/api/recommendations/listening-stat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            songId: params.songId,
            songName: params.songTitle,
            singers: [params.artistName],
            musicDirector: params.musicDirector || params.artistName,
            language: params.language,
            playCount: 1,
            replayCount: 0,
            totalListeningDurationMs: params.durationMs,
            lastPlayedAt: new Date().toISOString()
          })
        })
      ]);

      // 2. Fetch authoritative reconciled stats from server
      await get().fetchStats(true);
    } catch (err) {
      console.warn('[useAnalyticsStore] Error during recordPlaybackSession:', err);
    } finally {
      set({ isRecording: false });
    }
  },

  updateTastePreferences: async (updates: Partial<UserMusicPreference>) => {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      const res = await fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        // Immediately refresh stats so favouriteArtist updates reactively
        await get().fetchStats(true);
      }
    } catch (err) {
      console.warn('[useAnalyticsStore] Failed to update taste preferences:', err);
    }
  },

  clearCache: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ANALYTICS_CACHE_KEY);
      }
    } catch {}
    set({ stats: null, lastFetchedAt: null, error: null });
  }
}));
