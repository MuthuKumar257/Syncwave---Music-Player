import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalizedFeed, UserPreferences, ArtistItem, Track } from '../api/types';
import { recommendationApi } from '../api/recommendationApi';

const ONBOARDING_KEY = '@syncwave_onboarding_completed_v1';
const PREFERENCES_STORAGE_KEY = '@syncwave_user_preferences_v1';

const persistLocalPreferences = async (state: Partial<RecommendationState>) => {
  try {
    const dataToStore = {
      preferredLanguages: state.selectedLanguages || [],
      favouriteComposers: state.selectedDirectors || [],
      favouriteSingers: state.selectedSingers || [],
      favouriteGenres: state.selectedGenres || [],
      preferredMoods: state.selectedMoods || [],
      hasCompletedOnboarding: Boolean(state.hasCompletedOnboarding)
    };
    await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (e) {
    console.warn('[useRecommendationStore] persistLocalPreferences error:', e);
  }
};

export interface MobileBaseHomeSections {
  recommended: Track[];
  trending: Track[];
  recentlyAdded: Track[];
  popularSongs: Track[];
  allAvailable: Track[];
  languages?: string[];
  requiresLanguageSelection?: boolean;
}

interface RecommendationState {
  feed: PersonalizedFeed | null;
  baseSections: MobileBaseHomeSections | null;
  baseCatalogue: Track[];
  preferences: UserPreferences | null;
  hasCompletedOnboarding: boolean;
  selectedLanguages: string[];
  selectedDirectors: string[];
  selectedSingers: string[];
  selectedGenres: string[];
  selectedMoods: string[];
  artistsCatalog: ArtistItem[];
  isLoadingFeed: boolean;
  isLoadingBase: boolean;
  isLoadingArtists: boolean;
  feedError: string | null;
  baseError: string | null;

  // Actions
  initialize: () => Promise<void>;
  fetchFeed: (languageOverride?: string) => Promise<void>;
  fetchBaseFeed: (languageOverride?: string) => Promise<void>;
  fetchArtists: (languages?: string[], query?: string) => Promise<void>;
  setSelectedLanguages: (languages: string[]) => void;
  toggleLanguage: (lang: string) => void;
  toggleDirector: (name: string) => void;
  toggleSinger: (name: string) => void;
  toggleGenre: (genre: string) => void;
  toggleMood: (mood: string) => void;
  toggleArtist: (name: string, role?: 'DIRECTOR' | 'SINGER') => void;
  selectAllDirectors: () => void;
  clearAllDirectors: () => void;
  selectAllSingers: () => void;
  clearAllSingers: () => void;
  selectAllArtists: () => void;
  clearAllArtists: () => void;
  savePreferences: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetPreferences: () => Promise<void>;
  resetForGuest: () => Promise<void>;
  markNotInterested: (songId: string) => Promise<void>;
  likeSong: (songId: string) => Promise<void>;
  dislikeSong: (songId: string) => Promise<void>;
  resetTasteProfile: () => Promise<void>;
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  feed: null,
  baseSections: null,
  baseCatalogue: [],
  preferences: null,
  hasCompletedOnboarding: false,
  selectedLanguages: [],
  selectedDirectors: [],
  selectedSingers: [],
  selectedGenres: [],
  selectedMoods: [],
  artistsCatalog: [],
  isLoadingFeed: false,
  isLoadingBase: false,
  isLoadingArtists: false,
  feedError: null,
  baseError: null,

  initialize: async () => {
    try {
      // 1. Immediately load cached preferences from AsyncStorage
      const cachedPrefsJson = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (cachedPrefsJson) {
        try {
          const cached = JSON.parse(cachedPrefsJson);
          if (cached) {
            set({
              selectedLanguages: cached.preferredLanguages || cached.selectedLanguages || [],
              selectedDirectors: cached.favouriteComposers || cached.selectedDirectors || [],
              selectedSingers: cached.favouriteSingers || cached.selectedSingers || [],
              selectedGenres: cached.favouriteGenres || cached.selectedGenres || [],
              selectedMoods: cached.preferredMoods || cached.selectedMoods || [],
              hasCompletedOnboarding: Boolean(cached.hasCompletedOnboarding)
            });
          }
        } catch (e) {
          console.warn('[useRecommendationStore] Failed to parse cached preferences', e);
        }
      }

      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (completed === 'true') {
        set({ hasCompletedOnboarding: true });
      }

      const token = await AsyncStorage.getItem('syncwave_auth_token');
      if (!token) {
        // Guest mode: PRESERVE user's local selected languages and taste profile!
        await Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
        return;
      }

      // Fetch user preferences from backend
      try {
        const prefs = await recommendationApi.getUserPreferences();
        if (prefs && prefs.preferredLanguages && prefs.preferredLanguages.length > 0) {
          const newLanguages = prefs.preferredLanguages;
          set({
            preferences: prefs,
            hasCompletedOnboarding: Boolean(prefs.hasCompletedOnboarding),
            selectedLanguages: newLanguages,
            selectedDirectors: prefs.favouriteComposers?.length > 0 ? prefs.favouriteComposers : get().selectedDirectors,
            selectedSingers: prefs.favouriteSingers?.length > 0 ? prefs.favouriteSingers : get().selectedSingers,
            selectedGenres: prefs.favouriteGenres?.length > 0 ? prefs.favouriteGenres : get().selectedGenres,
            selectedMoods: prefs.preferredMoods?.length > 0 ? prefs.preferredMoods : get().selectedMoods
          });
          await persistLocalPreferences(get());
        } else if (get().selectedLanguages.length > 0) {
          // Push local preferences to backend
          await get().savePreferences();
        }
      } catch (err) {
        console.warn('[useRecommendationStore] getUserPreferences error:', err);
      }

      // Fetch initial feed and base catalogue in parallel
      await Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
    } catch (e) {
      console.warn('[useRecommendationStore] initialize failed:', e);
    }
  },

  resetForGuest: async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      await AsyncStorage.removeItem(PREFERENCES_STORAGE_KEY);
    } catch {}
    set({
      feed: null,
      baseSections: null,
      baseCatalogue: [],
      preferences: null,
      hasCompletedOnboarding: false,
      selectedLanguages: [],
      selectedDirectors: [],
      selectedSingers: [],
      selectedGenres: [],
      selectedMoods: [],
      isLoadingFeed: false,
      isLoadingBase: false,
      feedError: null,
      baseError: null
    });
    await Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
  },

  fetchBaseFeed: async (languageOverride?: string) => {
    set({ isLoadingBase: true, baseError: null });
    try {
      const activeLanguages = get().selectedLanguages;
      const base = await recommendationApi.getBaseFeed(languageOverride, activeLanguages);
      set({
        baseSections: base,
        baseCatalogue: base.allAvailable || [],
        isLoadingBase: false,
        baseError: null
      });
    } catch (error: any) {
      console.warn('[useRecommendationStore] fetchBaseFeed error:', error);
      set({
        isLoadingBase: false,
        baseError: error?.message || 'Failed to load base catalogue'
      });
    }
  },

  fetchFeed: async (languageOverride?: string) => {
    const activeLanguages = get().selectedLanguages;
    // Non-blocking trigger of base catalogue feed
    get().fetchBaseFeed(languageOverride).catch(() => {});

    set({ isLoadingFeed: true, feedError: null });
    try {
      const feed = await recommendationApi.getPersonalizedFeed(languageOverride, activeLanguages);
      set({ feed, isLoadingFeed: false, feedError: null });
    } catch (error: any) {
      console.warn('[useRecommendationStore] fetchFeed error:', error);
      set({
        isLoadingFeed: false,
        feedError: error?.message || 'Failed to load personalized recommendations'
      });
    }
  },

  fetchArtists: async (languages?: string[], query?: string) => {
    set({ isLoadingArtists: true });
    try {
      const targetLangs = languages || get().selectedLanguages;
      const catalog = await recommendationApi.getArtistsCatalog({ languages: targetLangs, query });
      set({ artistsCatalog: catalog, isLoadingArtists: false });
    } catch (error) {
      console.warn('[useRecommendationStore] fetchArtists error:', error);
      set({ isLoadingArtists: false });
    }
  },

  setSelectedLanguages: (languages: string[]) => {
    set({ selectedLanguages: languages });
    void persistLocalPreferences({ ...get(), selectedLanguages: languages });
    void get().fetchArtists(languages);
    void Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
    import('./usePlayerStore').then((m) => m.usePlayerStore.getState().pruneQueueByLanguage?.()).catch(() => {});
  },

  toggleLanguage: (lang: string) => {
    const current = get().selectedLanguages;
    let next: string[];
    if (current.includes(lang)) {
      if (current.length > 1) {
        next = current.filter((l) => l !== lang);
      } else {
        next = current;
      }
    } else {
      next = [...current, lang];
    }
    set({ selectedLanguages: next });
    void persistLocalPreferences({ ...get(), selectedLanguages: next });
    void get().fetchArtists(next);
    void Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
    import('./usePlayerStore').then((m) => m.usePlayerStore.getState().pruneQueueByLanguage?.()).catch(() => {});
  },

  toggleDirector: (name: string) => {
    const current = get().selectedDirectors;
    if (current.includes(name)) {
      set({ selectedDirectors: current.filter((d) => d !== name) });
    } else {
      set({ selectedDirectors: [...current, name] });
    }
  },

  toggleSinger: (name: string) => {
    const current = get().selectedSingers;
    if (current.includes(name)) {
      set({ selectedSingers: current.filter((s) => s !== name) });
    } else {
      set({ selectedSingers: [...current, name] });
    }
  },

  selectAllDirectors: () => {
    const directors = get()
      .artistsCatalog.filter((a) => a.role === 'DIRECTOR' || (a.role as any) === 'MUSIC_DIRECTOR')
      .map((d) => d.name);
    set({ selectedDirectors: Array.from(new Set([...get().selectedDirectors, ...directors])) });
  },

  clearAllDirectors: () => set({ selectedDirectors: [] }),

  selectAllSingers: () => {
    const singers = get().artistsCatalog.filter((a) => a.role === 'SINGER').map((s) => s.name);
    set({ selectedSingers: Array.from(new Set([...get().selectedSingers, ...singers])) });
  },

  clearAllSingers: () => set({ selectedSingers: [] }),

  toggleArtist: (name: string, role?: 'DIRECTOR' | 'SINGER') => {
    const isDir = role ? role === 'DIRECTOR' : get().selectedDirectors.includes(name);
    if (isDir) {
      get().toggleDirector(name);
    } else {
      get().toggleSinger(name);
    }
  },

  selectAllArtists: () => {
    get().selectAllDirectors();
    get().selectAllSingers();
  },

  clearAllArtists: () => {
    get().clearAllDirectors();
    get().clearAllSingers();
  },

  toggleGenre: (genre: string) => {
    const current = get().selectedGenres;
    if (current.includes(genre)) {
      set({ selectedGenres: current.filter((g) => g !== genre) });
    } else {
      set({ selectedGenres: [...current, genre] });
    }
  },

  toggleMood: (mood: string) => {
    const current = get().selectedMoods;
    if (current.includes(mood)) {
      set({ selectedMoods: current.filter((m) => m !== mood) });
    } else {
      set({ selectedMoods: [...current, mood] });
    }
  },

  savePreferences: async () => {
    const { selectedLanguages, selectedDirectors, selectedSingers, selectedGenres, selectedMoods } = get();
    try {
      await persistLocalPreferences(get());
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      set({ hasCompletedOnboarding: true });

      await recommendationApi.updateUserPreferences({
        preferredLanguages: selectedLanguages,
        favouriteComposers: selectedDirectors,
        favouriteSingers: selectedSingers,
        favouriteArtists: Array.from(new Set([...selectedDirectors, ...selectedSingers])),
        favouriteGenres: selectedGenres,
        preferredMoods: selectedMoods,
        hasCompletedOnboarding: true
      });
      await Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
      import('./usePlayerStore').then(m => m.usePlayerStore.getState().pruneQueueByLanguage?.()).catch(() => {});
    } catch (error) {
      console.warn('[useRecommendationStore] savePreferences error:', error);
    }
  },

  skipOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    set({ hasCompletedOnboarding: true });
    await persistLocalPreferences(get());
    await Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
    import('./usePlayerStore').then(m => m.usePlayerStore.getState().pruneQueueByLanguage?.()).catch(() => {});
  },

  resetPreferences: async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      await AsyncStorage.removeItem(PREFERENCES_STORAGE_KEY);
    } catch {}
    set({
      hasCompletedOnboarding: false,
      selectedLanguages: [],
      selectedDirectors: [],
      selectedSingers: [],
      selectedGenres: [],
      selectedMoods: [],
      preferences: null,
      feed: null
    });
    await Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
  },

  markNotInterested: async (songId: string) => {
    try {
      await recommendationApi.sendFeedback(songId, 'NOT_INTERESTED', 'SONG');
      const currentFeed = get().feed;
      if (currentFeed) {
        const filterOut = (tracks?: any[]) => (tracks || []).filter((t: any) => t.id !== songId);
        set({
          feed: {
            ...currentFeed,
            madeForYou: filterOut(currentFeed.madeForYou),
            recommendedForYou: filterOut(currentFeed.recommendedForYou),
            trendingInLanguages: filterOut(currentFeed.trendingInLanguages),
            newReleases: filterOut(currentFeed.newReleases),
            discoverSomethingNew: filterOut(currentFeed.discoverSomethingNew),
            discoverNewMusic: filterOut(currentFeed.discoverNewMusic),
            songsYouMayLike: filterOut(currentFeed.songsYouMayLike),
            similarToFavouriteSongs: filterOut(currentFeed.similarToFavouriteSongs),
            similarSongs: filterOut(currentFeed.similarSongs)
          }
        });
      }
    } catch (e) {
      console.warn('[useRecommendationStore] markNotInterested error:', e);
    }
  },

  likeSong: async (songId: string) => {
    try {
      await recommendationApi.sendFeedback(songId, 'LIKE', 'SONG');
    } catch (e) {
      console.warn('[useRecommendationStore] likeSong error:', e);
    }
  },

  dislikeSong: async (songId: string) => {
    try {
      await recommendationApi.sendFeedback(songId, 'DISLIKE', 'SONG');
      const currentFeed = get().feed;
      if (currentFeed) {
        const filterOut = (tracks?: any[]) => (tracks || []).filter((t: any) => t.id !== songId);
        set({
          feed: {
            ...currentFeed,
            madeForYou: filterOut(currentFeed.madeForYou),
            recommendedForYou: filterOut(currentFeed.recommendedForYou),
            trendingInLanguages: filterOut(currentFeed.trendingInLanguages),
            newReleases: filterOut(currentFeed.newReleases),
            discoverSomethingNew: filterOut(currentFeed.discoverSomethingNew),
            discoverNewMusic: filterOut(currentFeed.discoverNewMusic),
            songsYouMayLike: filterOut(currentFeed.songsYouMayLike)
          }
        });
      }
    } catch (e) {
      console.warn('[useRecommendationStore] dislikeSong error:', e);
    }
  },

  resetTasteProfile: async () => {
    try {
      await recommendationApi.updateUserPreferences({
        preferredLanguages: [],
        favouriteComposers: [],
        favouriteSingers: [],
        favouriteArtists: [],
        favouriteGenres: [],
        preferredMoods: [],
        hasCompletedOnboarding: false
      });
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      await AsyncStorage.removeItem(PREFERENCES_STORAGE_KEY);
      set({
        hasCompletedOnboarding: false,
        selectedLanguages: [],
        selectedDirectors: [],
        selectedSingers: [],
        selectedGenres: [],
        selectedMoods: [],
        preferences: null,
        feed: null
      });
      await Promise.all([get().fetchFeed(), get().fetchBaseFeed()]);
    } catch (e) {
      console.warn('[useRecommendationStore] resetTasteProfile error:', e);
    }
  }
}));
