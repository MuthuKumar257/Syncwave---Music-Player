import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalizedFeed, UserPreferences, ArtistItem } from '../api/types';
import { recommendationApi } from '../api/recommendationApi';

const ONBOARDING_KEY = '@syncwave_onboarding_completed_v1';

interface RecommendationState {
  feed: PersonalizedFeed | null;
  preferences: UserPreferences | null;
  hasCompletedOnboarding: boolean;
  selectedLanguages: string[];
  selectedDirectors: string[];
  selectedSingers: string[];
  selectedGenres: string[];
  selectedMoods: string[];
  artistsCatalog: ArtistItem[];
  isLoadingFeed: boolean;
  isLoadingArtists: boolean;

  // Actions
  initialize: () => Promise<void>;
  fetchFeed: (languageOverride?: string) => Promise<void>;
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
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  feed: null,
  preferences: null,
  hasCompletedOnboarding: false,
  selectedLanguages: [],
  selectedDirectors: [],
  selectedSingers: [],
  selectedGenres: [],
  selectedMoods: [],
  artistsCatalog: [],
  isLoadingFeed: false,
  isLoadingArtists: false,

  initialize: async () => {
    try {
      const token = await AsyncStorage.getItem('syncwave_auth_token');
      if (!token) {
        // Guest mode: do not retain previous user's personalized preferences
        set({
          preferences: null,
          hasCompletedOnboarding: true,
          selectedLanguages: [],
          selectedDirectors: [],
          selectedSingers: [],
          selectedGenres: [],
          selectedMoods: []
        });
        await get().fetchFeed();
        return;
      }

      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (completed === 'true') {
        set({ hasCompletedOnboarding: true });
      }

      // Fetch user preferences from backend
      try {
        const prefs = await recommendationApi.getUserPreferences();
        if (prefs) {
          set({
            preferences: prefs,
            hasCompletedOnboarding: Boolean(prefs.hasCompletedOnboarding),
            selectedLanguages: prefs.preferredLanguages?.length > 0 ? prefs.preferredLanguages : [],
            selectedDirectors: prefs.favouriteComposers?.length > 0 ? prefs.favouriteComposers : [],
            selectedSingers: prefs.favouriteSingers?.length > 0 ? prefs.favouriteSingers : [],
            selectedGenres: prefs.favouriteGenres?.length > 0 ? prefs.favouriteGenres : [],
            selectedMoods: prefs.preferredMoods?.length > 0 ? prefs.preferredMoods : []
          });
        }
      } catch {}

      // Fetch initial feed
      await get().fetchFeed();
    } catch (e) {
      console.warn('[useRecommendationStore] initialize failed:', e);
    }
  },

  resetForGuest: async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
    } catch {}
    set({
      feed: null,
      preferences: null,
      hasCompletedOnboarding: false,
      selectedLanguages: [],
      selectedDirectors: [],
      selectedSingers: [],
      selectedGenres: [],
      selectedMoods: [],
      isLoadingFeed: false
    });
    await get().fetchFeed();
  },

  fetchFeed: async (languageOverride?: string) => {
    set({ isLoadingFeed: true });
    try {
      const feed = await recommendationApi.getPersonalizedFeed(languageOverride);
      set({ feed, isLoadingFeed: false });
    } catch (error) {
      console.warn('[useRecommendationStore] fetchFeed error:', error);
      set({ isLoadingFeed: false });
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

  setSelectedLanguages: (languages: string[]) => set({ selectedLanguages: languages }),

  toggleLanguage: (lang: string) => {
    const current = get().selectedLanguages;
    if (current.includes(lang)) {
      if (current.length > 1) {
        set({ selectedLanguages: current.filter((l) => l !== lang) });
      }
    } else {
      set({ selectedLanguages: [...current, lang] });
    }
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
      await recommendationApi.updateUserPreferences({
        preferredLanguages: selectedLanguages,
        favouriteComposers: selectedDirectors,
        favouriteSingers: selectedSingers,
        favouriteArtists: Array.from(new Set([...selectedDirectors, ...selectedSingers])),
        favouriteGenres: selectedGenres,
        preferredMoods: selectedMoods,
        hasCompletedOnboarding: true
      });
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      set({ hasCompletedOnboarding: true });
      get().fetchFeed();
    } catch (error) {
      console.warn('[useRecommendationStore] savePreferences error:', error);
    }
  },

  skipOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    set({ hasCompletedOnboarding: true });
    get().fetchFeed();
  },

  resetPreferences: async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
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
  }
}));
