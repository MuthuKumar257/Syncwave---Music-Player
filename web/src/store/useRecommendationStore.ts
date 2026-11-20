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

export interface BaseHomeSections {
  recommended: UnifiedTrack[];
  trending: UnifiedTrack[];
  recentlyAdded: UnifiedTrack[];
  popularSongs: UnifiedTrack[];
  allAvailable: UnifiedTrack[];
  languages?: string[];
  requiresLanguageSelection?: boolean;
}

interface RecommendationStore {
  feed: PersonalizedFeed | null;
  baseSections: BaseHomeSections | null;
  baseCatalogue: UnifiedTrack[];
  preferences: UserMusicPreference | null;
  isLoading: boolean;
  isLoadingBase: boolean;
  isRefreshing: boolean;
  feedError: string | null;
  baseError: string | null;
  sectionErrors: Record<string, string>;
  lastRefreshedAt: number | null;
  hasCompletedOnboarding: boolean;
  isOnboardingOpen: boolean;
  activeLanguageFilter: string; // 'ALL' or specific language
  hiddenTrackIds: Set<string>;
  likedTrackIds: Set<string>;

  // Actions
  fetchFeed: (languageOverride?: string, options?: { isPullRefresh?: boolean; force?: boolean }) => Promise<void>;
  fetchBaseFeed: (languageOverride?: string) => Promise<void>;
  retryFeed: () => Promise<void>;
  retrySection: (sectionKey: string) => Promise<void>;
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
const BASE_FEED_CACHE_STORAGE_KEY = 'syncwave_home_base_cache_v1';
const PREFERENCES_STORAGE_KEY = 'syncwave_user_preferences_v1';

const loadCachedPreferences = (): UserMusicPreference | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCachedPreferences = (prefs: UserMusicPreference) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
};

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

const loadCachedBaseSections = (): BaseHomeSections | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(BASE_FEED_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sections?: BaseHomeSections };
    return parsed?.sections || null;
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

const saveCachedBaseSections = (sections: BaseHomeSections) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      BASE_FEED_CACHE_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), sections })
    );
  } catch {
    // Ignore storage quota errors
  }
};

let inFlightFeedRequest: Promise<void> | null = null;
let inFlightBaseRequest: Promise<void> | null = null;

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
  let userLangs = '';
  try {
    if (typeof localStorage !== 'undefined') {
      const p = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (p) {
        const parsed = JSON.parse(p);
        if (Array.isArray(parsed.preferredLanguages) && parsed.preferredLanguages.length > 0) {
          userLangs = parsed.preferredLanguages.join(',');
        }
      }
    }
  } catch {}
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userLangs ? { 'X-User-Languages': userLangs } : {})
  };
};

export const useRecommendationStore = create<RecommendationStore>((set, get) => {
  const initialBase = loadCachedBaseSections();
  const initialPrefs = loadCachedPreferences();
  const hasOnboarded =
    (typeof localStorage !== 'undefined' && localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true') ||
    Boolean(initialPrefs?.preferredLanguages && initialPrefs.preferredLanguages.length > 0);

  return {
    feed: loadCachedFeed(),
    baseSections: initialBase,
    baseCatalogue: initialBase?.allAvailable || [],
    preferences: initialPrefs,
    isLoading: false,
    isLoadingBase: false,
    isRefreshing: false,
    feedError: null,
    baseError: null,
    sectionErrors: {},
    lastRefreshedAt: null,
    hasCompletedOnboarding: hasOnboarded,
    isOnboardingOpen: !hasOnboarded,
    activeLanguageFilter: 'ALL',
    hiddenTrackIds: new Set(),
    likedTrackIds: new Set(),

    fetchBaseFeed: async (languageOverride?: string) => {
      if (inFlightBaseRequest) return inFlightBaseRequest;

      set({ isLoadingBase: true, baseError: null });

      const task = (async () => {
        try {
          const lang = languageOverride || get().activeLanguageFilter;
          const params = new URLSearchParams();
          if (lang && lang !== 'ALL') {
            params.set('language', lang);
          }
          const qs = params.toString();
          const res = await fetch(`/api/songs/home-base${qs ? `?${qs}` : ''}`, {
            headers: getAuthHeaders()
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const json = await res.json();
          if (json.success && json.data) {
            saveCachedBaseSections(json.data);
            set({
              baseSections: json.data,
              baseCatalogue: json.data.allAvailable || [],
              baseError: null,
              sectionErrors: { ...get().sectionErrors, baseFeed: '' }
            });
          } else {
            throw new Error(json.message || 'Invalid base catalogue payload');
          }
        } catch (err: any) {
          console.warn('[useRecommendationStore] Failed to fetch base feed:', err);
          set({
            baseError: err?.message || 'Unable to reach music catalogue service',
            sectionErrors: { ...get().sectionErrors, baseFeed: err?.message || 'Error loading catalogue' }
          });
        } finally {
          inFlightBaseRequest = null;
          set({ isLoadingBase: false });
        }
      })();

      inFlightBaseRequest = task;
      return task;
    },

    fetchFeed: async (languageOverride?: string, options?: { isPullRefresh?: boolean; force?: boolean }) => {
      // Trigger base catalogue fetch in parallel so songs are guaranteed available
      get().fetchBaseFeed(languageOverride).catch(() => {});

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
              sectionErrors: { ...get().sectionErrors, recommendations: '' },
              ...(needsLanguage ? { isOnboardingOpen: true, hasCompletedOnboarding: false } : {})
            });
          } else {
            throw new Error(json.message || 'Invalid recommendation payload');
          }
        } catch (err: any) {
          console.warn('[useRecommendationStore] Failed to fetch feed:', err);
          set({
            feedError: err?.message || 'Unable to reach recommendation service',
            sectionErrors: { ...get().sectionErrors, recommendations: err?.message || 'Error loading recommendations' }
          });
        } finally {
          inFlightFeedRequest = null;
          set({ isLoading: false, isRefreshing: false });
        }
      })();

      inFlightFeedRequest = requestTask;
      return requestTask;
    },

    retryFeed: async () => {
      await Promise.all([
        get().fetchFeed(undefined, { force: true }),
        get().fetchBaseFeed()
      ]);
    },

    retrySection: async (sectionKey: string) => {
      if (sectionKey === 'recommendations' || sectionKey === 'madeForYou') {
        await get().fetchFeed(undefined, { force: true });
      } else if (sectionKey === 'preferences') {
        await get().fetchPreferences();
      } else {
        await get().fetchBaseFeed();
      }
    },

    refreshHome: async () => {
      if (inFlightFeedRequest || get().isRefreshing) {
        return inFlightFeedRequest || Promise.resolve();
      }
      await Promise.all([
        get().fetchPreferences(),
        get().fetchFeed(undefined, { isPullRefresh: true, force: true }),
        get().fetchBaseFeed()
      ]);
    },

    fetchPreferences: async () => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
      if (!token) {
        const cached = loadCachedPreferences();
        if (cached) {
          const hasLangs = Boolean(
            cached.preferredLanguages && cached.preferredLanguages.length > 0
          );
          set({
            preferences: cached,
            hasCompletedOnboarding: hasLangs,
            isOnboardingOpen: !hasLangs,
            sectionErrors: { ...get().sectionErrors, preferences: '' }
          });
        } else {
          set({ preferences: null });
        }
        return;
      }

      try {
        const res = await fetch('/api/users/me/preferences', {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.preferences) {
            saveCachedPreferences(json.preferences);
            const hasLangs = Boolean(
              json.preferences.preferredLanguages && json.preferences.preferredLanguages.length > 0
            );
            set({
              preferences: json.preferences,
              hasCompletedOnboarding: hasLangs,
              isOnboardingOpen: !hasLangs,
              sectionErrors: { ...get().sectionErrors, preferences: '' }
            });
          }
        } else {
          // If server call fails, fallback to local cache if available
          const cached = loadCachedPreferences();
          if (cached) {
            set({ preferences: cached });
          }
          set({
            sectionErrors: { ...get().sectionErrors, preferences: `HTTP ${res.status}` }
          });
        }
      } catch (err: any) {
        console.warn('[useRecommendationStore] Failed to fetch preferences:', err);
        const cached = loadCachedPreferences();
        if (cached) {
          set({ preferences: cached });
        }
        set({
          sectionErrors: { ...get().sectionErrors, preferences: err?.message || 'Failed to fetch preferences' }
        });
      }
    },

    updatePreferences: async (updates) => {
      // 1. Merge with existing or default guest preferences
      const current = get().preferences || {
        userId: 'guest_user',
        preferredLanguages: [],
        favouriteArtists: [],
        favouriteGenres: [],
        favouriteComposers: [],
        favouriteSingers: [],
        favouriteMovies: [],
        preferredMoods: [],
        personalizationEnabled: true,
        historyEnabled: true,
        updatedAt: new Date().toISOString()
      };

      const merged: UserMusicPreference = {
        ...current,
        ...updates,
        preferredLanguages: updates.preferredLanguages ?? current.preferredLanguages,
        favouriteArtists: updates.favouriteArtists ?? current.favouriteArtists,
        favouriteGenres: updates.favouriteGenres ?? current.favouriteGenres,
        favouriteComposers: updates.favouriteComposers ?? current.favouriteComposers,
        favouriteSingers: updates.favouriteSingers ?? current.favouriteSingers,
        preferredMoods: updates.preferredMoods ?? current.preferredMoods,
        updatedAt: new Date().toISOString()
      };

      saveCachedPreferences(merged);
      const hasLangs = Boolean(merged.preferredLanguages && merged.preferredLanguages.length > 0);
      set({
        preferences: merged,
        hasCompletedOnboarding: hasLangs,
        isOnboardingOpen: !hasLangs
      });

      // Refresh personalized feed and base catalogue with updated preferences
      get().fetchFeed();
      get().fetchBaseFeed();
      useAnalyticsStore.getState().fetchStats(true).catch(() => {});
      import('./usePlayerStore').then(m => m.usePlayerStore.getState().pruneQueueByLanguage?.()).catch(() => {});

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
            saveCachedPreferences(json.preferences);
            set({ preferences: json.preferences });
          }
        }
      } catch (err) {
        console.warn('[useRecommendationStore] Failed to update preferences on server:', err);
      }
    },

    resetPreferences: async () => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(PREFERENCES_STORAGE_KEY);
        }
      } catch {}
      set({
        preferences: null,
        hiddenTrackIds: new Set(),
        likedTrackIds: new Set()
      });
      get().fetchFeed();
      get().fetchBaseFeed();
      useAnalyticsStore.getState().fetchStats(true).catch(() => {});

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
            get().fetchBaseFeed();
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
      get().fetchBaseFeed(lang);
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
          localStorage.removeItem(BASE_FEED_CACHE_STORAGE_KEY);
          localStorage.removeItem(ONBOARDING_STORAGE_KEY);
          localStorage.removeItem(PREFERENCES_STORAGE_KEY);
        }
      } catch {}
      set({
        feed: null,
        baseSections: null,
        baseCatalogue: [],
        preferences: null,
        lastRefreshedAt: null,
        hasCompletedOnboarding: false,
        isOnboardingOpen: false,
        feedError: null,
        baseError: null,
        sectionErrors: {},
        hiddenTrackIds: new Set(),
        likedTrackIds: new Set(),
        activeLanguageFilter: 'ALL'
      });
    }
  };
});
