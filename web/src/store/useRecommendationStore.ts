import { create } from 'zustand';
import {
  PersonalizedFeed,
  UserMusicPreference,
  SmartPlaylistRequest,
  SmartPlaylistResponse,
  UnifiedTrack,
  ArtistItem,
  SongListeningStat
} from '../types';
import { useAnalyticsStore } from './useAnalyticsStore';

interface RecommendationStore {
  feed: PersonalizedFeed | null;
  preferences: UserMusicPreference | null;
  isLoading: boolean;
  isRefreshing: boolean;
  feedError: string | null;
  lastRefreshedAt: number | null;
  hasCompletedOnboarding: boolean;
  isOnboardingOpen: boolean;
  activeLanguageFilter: string; // 'ALL' or specific language
  hiddenTrackIds: Set<string>;
  likedTrackIds: Set<string>;

  // Actions
  fetchFeed: (languageOverride?: string, options?: { isPullRefresh?: boolean; force?: boolean }) => Promise<void>;
  refreshHome: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (updates: Partial<UserMusicPreference>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  sendFeedback: (targetId: string, feedbackType: 'LIKE' | 'DISLIKE' | 'HIDE', targetType?: 'SONG' | 'SOUNDTRACK' | 'ARTIST') => Promise<void>;
  logListeningEvent: (event: {
    songId: string;
    songTitle: string;
    artistName: string;
    language?: string;
    eventType: 'PLAY' | 'COMPLETE' | 'SKIP' | 'REPLAY' | 'LIKE' | 'ADD_TO_PLAYLIST';
    durationPlayedSec?: number;
    totalDurationSec?: number;
  }) => Promise<void>;
  recordSongListeningStat: (stat: Partial<SongListeningStat> & { songId: string; songName: string }) => Promise<void>;
  fetchArtistsCatalog: (options?: { role?: 'DIRECTOR' | 'SINGER'; languages?: string[]; query?: string }) => Promise<ArtistItem[]>;
  generateSmartPlaylist: (req: SmartPlaylistRequest) => Promise<SmartPlaylistResponse | null>;
  setLanguageFilter: (lang: string) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  resetForLogout: () => void;
}

const ONBOARDING_STORAGE_KEY = 'syncwave_onboarding_completed_v1';
const FEED_CACHE_STORAGE_KEY = 'syncwave_home_feed_cache_v1';

const loadCachedFeed = (): PersonalizedFeed | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(FEED_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { feed?: PersonalizedFeed };
    return parsed?.feed || null;
  } catch {
    return null;
  }
};

const saveCachedFeed = (feed: PersonalizedFeed) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      FEED_CACHE_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), feed })
    );
  } catch {
    // Ignore storage quota errors
  }
};

let inFlightFeedRequest: Promise<void> | null = null;

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const useRecommendationStore = create<RecommendationStore>((set, get) => ({
  feed: loadCachedFeed(),
  preferences: null,
  isLoading: false,
  isRefreshing: false,
  feedError: null,
  lastRefreshedAt: null,
  hasCompletedOnboarding: typeof localStorage !== 'undefined' && localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true',
  isOnboardingOpen: typeof localStorage === 'undefined' ? false : localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'true',
  activeLanguageFilter: 'ALL',
  hiddenTrackIds: new Set(),
  likedTrackIds: new Set(),

  fetchFeed: async (languageOverride?: string, options?: { isPullRefresh?: boolean; force?: boolean }) => {
    // Prevent multiple simultaneous refresh/fetch requests
    if (inFlightFeedRequest) {
      return inFlightFeedRequest;
    }

    const isPullRefresh = Boolean(options?.isPullRefresh);
    const hasExistingFeed = Boolean(get().feed);
    set({
      isLoading: !hasExistingFeed && !isPullRefresh,
      isRefreshing: isPullRefresh,
      feedError: null
    });

    const requestTask = (async () => {
      try {
        const lang = languageOverride || get().activeLanguageFilter;
        const params = new URLSearchParams();
        if (lang && lang !== 'ALL') {
          params.set('language', lang);
        }
        if (isPullRefresh || options?.force) {
          params.set('seed', String(Date.now()));
        }
        const qs = params.toString();
        const res = await fetch(`/api/recommendations${qs ? `?${qs}` : ''}`, {
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (json.success && json.data) {
          saveCachedFeed(json.data);
          const needsLanguage = Boolean(json.data.requiresLanguageSelection);
          set({
            feed: json.data,
            lastRefreshedAt: Date.now(),
            feedError: null,
            ...(needsLanguage ? { isOnboardingOpen: true, hasCompletedOnboarding: false } : {})
          });
        } else {
          throw new Error(json.message || 'Invalid recommendation payload');
        }
      } catch (err: any) {
        console.warn('[useRecommendationStore] Failed to fetch feed:', err);
        set({
          feedError: err?.message || 'Unable to reach recommendation service'
        });
      } finally {
        inFlightFeedRequest = null;
        set({ isLoading: false, isRefreshing: false });
      }
    })();

    inFlightFeedRequest = requestTask;
    return requestTask;
  },

  refreshHome: async () => {
    if (inFlightFeedRequest || get().isRefreshing) {
      return inFlightFeedRequest || Promise.resolve();
    }
    await Promise.all([
      get().fetchPreferences(),
      get().fetchFeed(undefined, { isPullRefresh: true, force: true })
    ]);
  },

  fetchPreferences: async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
    if (!token) {
      set({ preferences: null });
      return;
    }

    try {
      const res = await fetch('/api/users/me/preferences', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.preferences) {
          const hasLangs = Boolean(
            json.preferences.preferredLanguages && json.preferences.preferredLanguages.length > 0
          );
          set({
            preferences: json.preferences,
            hasCompletedOnboarding: hasLangs,
            isOnboardingOpen: !hasLangs
          });
        }
      }
    } catch (err) {
      console.warn('[useRecommendationStore] Failed to fetch preferences:', err);
    }
  },

  updatePreferences: async (updates) => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
    if (!token) return;

    try {
      const res = await fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.preferences) {
          set({ preferences: json.preferences });
          // Refresh personalized feed with updated preferences
          get().fetchFeed();
          // Immediately update analytics dashboard
          useAnalyticsStore.getState().fetchStats(true).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[useRecommendationStore] Failed to update preferences:', err);
    }
  },

  resetPreferences: async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
    if (!token) return;

    try {
      const res = await fetch('/api/users/me/preferences/reset', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          set({
            preferences: json.preferences,
            hiddenTrackIds: new Set(),
            likedTrackIds: new Set()
          });
          get().fetchFeed();
          useAnalyticsStore.getState().fetchStats(true).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[useRecommendationStore] Failed to reset preferences:', err);
    }
  },

  recordSongListeningStat: async (stat) => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
    if (!token) return;

    try {
      await fetch('/api/recommendations/listening-stat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(stat)
      });
    } catch {
      // Background non-blocking
    }
  },

  fetchArtistsCatalog: async (options) => {
    try {
      const params = new URLSearchParams();
      if (options?.role) params.set('role', options.role);
      if (options?.languages && options.languages.length > 0) params.set('languages', options.languages.join(','));
      if (options?.query) params.set('q', options.query);
      const res = await fetch(`/api/recommendations/artists?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.artists) {
          return json.artists;
        }
      }
    } catch (err) {
      console.warn('[useRecommendationStore] Failed to fetch artists catalog:', err);
    }
    return [];
  },

  sendFeedback: async (targetId, feedbackType, targetType = 'SONG') => {
    try {
      if (feedbackType === 'HIDE' || feedbackType === 'DISLIKE') {
        const newHidden = new Set(get().hiddenTrackIds);
        newHidden.add(targetId);
        set({ hiddenTrackIds: newHidden });
      } else if (feedbackType === 'LIKE') {
        const newLiked = new Set(get().likedTrackIds);
        newLiked.add(targetId);
        set({ likedTrackIds: newLiked });
      }

      await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, targetType, feedbackType })
      });
    } catch (err) {
      console.warn('[useRecommendationStore] Feedback failed:', err);
    }
  },

  logListeningEvent: async (event) => {
    try {
      await fetch('/api/listening-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          clientPlatform: 'WEB'
        })
      });
    } catch {
      // Non-blocking background log
    }
  },

  generateSmartPlaylist: async (req) => {
    try {
      const res = await fetch('/api/recommendations/generate-smart-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.playlist) {
          return json.playlist;
        }
      }
    } catch (err) {
      console.warn('[useRecommendationStore] Failed to generate smart playlist:', err);
    }
    return null;
  },

  setLanguageFilter: (lang) => {
    set({ activeLanguageFilter: lang });
    get().fetchFeed(lang);
  },

  setOnboardingCompleted: (completed) => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, completed ? 'true' : 'false');
    set({ hasCompletedOnboarding: completed, isOnboardingOpen: !completed });
  },

  openOnboarding: () => {
    set({ isOnboardingOpen: true });
  },

  closeOnboarding: () => {
    set({ isOnboardingOpen: false });
  },

  resetForLogout: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(FEED_CACHE_STORAGE_KEY);
        localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      }
    } catch {}
    set({
      feed: null,
      preferences: null,
      lastRefreshedAt: null,
      hasCompletedOnboarding: false,
      isOnboardingOpen: false,
      hiddenTrackIds: new Set(),
      likedTrackIds: new Set(),
      activeLanguageFilter: 'ALL'
    });
  }
}));
