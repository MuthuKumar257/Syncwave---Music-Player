import { create } from 'zustand';
import { UniversalSearchResults, Track } from '../api/types';
import { searchApi } from '../api/searchApi';
import { useLocalMusicStore } from './useLocalMusicStore';
import { useDownloadStore } from './useDownloadStore';

interface SearchState {
  query: string;
  results: UniversalSearchResults | null;
  suggestions: Array<{ text: string; type: string; subtitle: string }>;
  recentSearches: string[];
  selectedPlatform: string;
  selectedLanguage: string;
  isSearching: boolean;

  // Actions
  setQuery: (query: string) => void;
  setSelectedPlatform: (platform: string) => void;
  setSelectedLanguage: (language: string) => void;
  performSearch: (queryOverride?: string) => Promise<void>;
  fetchSuggestions: (query: string) => Promise<void>;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: null,
  suggestions: [],
  recentSearches: ['Vaaranam Aayiram', 'Leo', 'Nenjukkul Peidhidum', 'A. R. Rahman', 'Anirudh', 'Sid Sriram'],
  selectedPlatform: 'ALL',
  selectedLanguage: 'ALL',
  isSearching: false,

  setQuery: (query: string) => {
    set({ query });
    if (query.trim().length >= 2) {
      get().fetchSuggestions(query);
    } else {
      set({ suggestions: [] });
    }
  },

  setSelectedPlatform: (platform: string) => {
    set({ selectedPlatform: platform });
    if (get().query.trim()) {
      get().performSearch();
    }
  },

  setSelectedLanguage: (language: string) => {
    set({ selectedLanguage: language });
    if (get().query.trim()) {
      get().performSearch();
    }
  },

  performSearch: async (queryOverride?: string) => {
    const q = queryOverride || get().query;
    if (!q.trim()) return;

    set({ isSearching: true, suggestions: [] });
    get().addRecentSearch(q.trim());

    try {
      const results = await searchApi.searchUniversal(q.trim(), {
        platform: get().selectedPlatform,
        language: get().selectedLanguage !== 'ALL' ? get().selectedLanguage : undefined
      });

      const qLower = q.toLowerCase().trim();
      const localMatches: Track[] = (useLocalMusicStore.getState().localTracks || []).filter(
        (t) =>
          t.title.toLowerCase().includes(qLower) ||
          t.artist.toLowerCase().includes(qLower) ||
          (t.movieName && t.movieName.toLowerCase().includes(qLower)) ||
          (t.album && t.album.toLowerCase().includes(qLower))
      );
      const downloadMatches: Track[] = (useDownloadStore.getState().downloadedTracks || []).filter(
        (t) =>
          t.title.toLowerCase().includes(qLower) ||
          t.artist.toLowerCase().includes(qLower) ||
          (t.movieName && t.movieName.toLowerCase().includes(qLower)) ||
          (t.album && t.album.toLowerCase().includes(qLower))
      );

      const existingSongIds = new Set((results.songs || []).map((s) => s.id));
      const deduplicatedLocal = [...localMatches, ...downloadMatches].filter((t) => !existingSongIds.has(t.id));

      const mergedResults: UniversalSearchResults = {
        ...results,
        songs: [...deduplicatedLocal, ...(results.songs || [])],
        totalResults: (results.totalResults || 0) + deduplicatedLocal.length
      };

      set({ results: mergedResults, isSearching: false });
    } catch (error) {
      console.warn('[useSearchStore] performSearch error:', error);
      set({ isSearching: false });
    }
  },

  fetchSuggestions: async (query: string) => {
    try {
      const suggestions = await searchApi.getSuggestions(query);
      set({ suggestions });
    } catch {}
  },

  addRecentSearch: (query: string) => {
    const current = get().recentSearches.filter((item) => item.toLowerCase() !== query.toLowerCase());
    set({ recentSearches: [query, ...current].slice(0, 10) });
  },

  clearRecentSearches: () => set({ recentSearches: [] }),

  clearResults: () => set({ results: null, query: '', suggestions: [] })
}));
