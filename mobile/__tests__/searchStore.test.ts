import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSearchStore } from '../src/store/useSearchStore';

vi.mock('../src/api/searchApi', () => ({
  searchApi: {
    searchUniversal: vi.fn().mockResolvedValue({
      query: 'Vaaranam Aayiram',
      movies: [
        {
          id: 'movie_vaaranam_aayiram',
          movieName: 'Vaaranam Aayiram',
          releaseYear: 2008,
          language: 'Tamil',
          composer: 'Harris Jayaraj',
          artworkUrl: '',
          totalTracks: 0,
          tracks: []
        }
      ],
      songs: [],
      singers: [],
      musicDirectors: []
    }),
    getSuggestions: vi.fn().mockResolvedValue([
      { text: 'Vaaranam Aayiram', type: 'movie', subtitle: 'Harris Jayaraj (2008)' },
      { text: 'Nenjukkul Peidhidum', type: 'song', subtitle: 'Vaaranam Aayiram' }
    ])
  }
}));

describe('useSearchStore - Universal Movie & Song Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({
      query: '',
      results: null,
      suggestions: [],
      recentSearches: ['Leo', 'Vikram'],
      selectedPlatform: 'ALL',
      selectedLanguage: 'ALL',
      isSearching: false
    });
  });

  it('updates search query and triggers suggestions when query length >= 2', async () => {
    const store = useSearchStore.getState();
    store.setQuery('Vaa');

    expect(useSearchStore.getState().query).toBe('Vaa');
    // Allow async getSuggestions promise to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(useSearchStore.getState().suggestions.length).toBe(2);
  });

  it('clears suggestions when query is short (< 2 characters)', () => {
    const store = useSearchStore.getState();
    useSearchStore.setState({ suggestions: [{ text: 'Vaaranam', type: 'movie', subtitle: '' }] });

    store.setQuery('V');
    expect(useSearchStore.getState().suggestions).toEqual([]);
  });

  it('performs universal search and prepends to recent searches deduplicated', async () => {
    const store = useSearchStore.getState();
    await store.performSearch('Vaaranam Aayiram');

    const state = useSearchStore.getState();
    expect(state.results?.movies.length).toBe(1);
    expect(state.results?.movies[0].movieName).toBe('Vaaranam Aayiram');
    expect(state.recentSearches[0]).toBe('Vaaranam Aayiram');
    expect(state.recentSearches).toContain('Leo');
    expect(state.isSearching).toBe(false);
  });

  it('clears recent searches and results cleanly', () => {
    const store = useSearchStore.getState();
    store.clearRecentSearches();
    expect(useSearchStore.getState().recentSearches).toEqual([]);

    store.clearResults();
    expect(useSearchStore.getState().results).toBeNull();
    expect(useSearchStore.getState().query).toBe('');
  });
});
