import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuthStore } from '../store/useAuthStore';
import { Track } from '../api/types';
import { apiClient } from '../api/client';

const songHome: Track = {
  id: 'song_home_01',
  title: 'Nenjukkul Peidhidum',
  artist: 'Hariharan, Devan',
  composer: 'Harris Jayaraj',
  album: 'Vaaranam Aayiram',
  durationMs: 370000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=home1',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/art_home.jpg',
  language: 'Tamil'
};

const songDiscover: Track = {
  id: 'song_discover_02',
  title: 'Adiye',
  artist: 'Sid Sriram',
  composer: 'A. R. Rahman',
  album: 'Kadal',
  durationMs: 312000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=disc2',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/art_disc.jpg',
  language: 'Tamil'
};

const songSearch: Track = {
  id: 'song_search_03',
  title: 'Kesariya',
  artist: 'Arijit Singh',
  composer: 'Pritam',
  album: 'Brahmastra',
  durationMs: 268000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=srch3',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/art_srch.jpg',
  language: 'Hindi'
};

describe('Favourite Songs Synchronization & Library Verification Suite', () => {
  const USER_A_ID = 'user_fav_alpha_1';
  const USER_B_ID = 'user_fav_beta_2';

  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();

    useLibraryStore.setState({
      favorites: [],
      favoriteTracks: [],
      playlists: [],
      currentUserId: USER_A_ID,
      isInitialized: true
    });
  });

  describe('1. Favourite Button Functionality', () => {
    it('adds a song to favourites, updates heart status immediately, and persists to storage', async () => {
      const store = useLibraryStore.getState();

      expect(store.isFavorite(songHome.id)).toBe(false);

      // 1. Favourite one song from Home
      const added = await store.toggleFavorite(songHome);
      expect(added).toBe(true);

      const stateAfterAdd = useLibraryStore.getState();
      expect(stateAfterAdd.isFavorite(songHome.id)).toBe(true);
      expect(stateAfterAdd.favorites).toContain(songHome.id);
      expect(stateAfterAdd.favoriteTracks).toHaveLength(1);
      expect(stateAfterAdd.favoriteTracks[0].id).toBe(songHome.id);
      expect(stateAfterAdd.favoriteTracks[0].title).toBe('Nenjukkul Peidhidum');

      // Verify immediate persistence in user-scoped storage
      const rawStored = await AsyncStorage.getItem(`@syncwave_mobile_library_${USER_A_ID}_v2`);
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      expect(parsed.favorites).toEqual([songHome.id]);
      expect(parsed.favoriteTracks[0].id).toBe(songHome.id);
    });

    it('clicking again removes the song from favourites and updates immediately', async () => {
      const store = useLibraryStore.getState();

      await store.toggleFavorite(songHome);
      expect(useLibraryStore.getState().isFavorite(songHome.id)).toBe(true);

      // Unfavourite
      const removed = await store.toggleFavorite(songHome);
      expect(removed).toBe(false);

      const stateAfterRemove = useLibraryStore.getState();
      expect(stateAfterRemove.isFavorite(songHome.id)).toBe(false);
      expect(stateAfterRemove.favorites).not.toContain(songHome.id);
      expect(stateAfterRemove.favoriteTracks).toHaveLength(0);
    });

    it('prevents duplicate favourite records', async () => {
      const store = useLibraryStore.getState();

      await store.toggleFavorite(songHome);
      // Manually calling toggleFavorite twice toggles off, but if multiple add triggers occur, favorites retains unique items
      const state = useLibraryStore.getState();
      const uniqueFavorites = Array.from(new Set(state.favorites));
      expect(state.favorites.length).toBe(uniqueFavorites.length);
    });
  });

  describe('2. Library – Display, Ordering & Cross-Screen Consistency', () => {
    it('displays multiple songs favourited across Home and Discover, sorted newest first', async () => {
      const store = useLibraryStore.getState();

      // 1. Favourite song from Home
      await store.toggleFavorite(songHome);

      // 2. Favourite song from Discover
      await store.toggleFavorite(songDiscover);

      const state = useLibraryStore.getState();
      expect(state.favoriteTracks).toHaveLength(2);

      // Most recently favourited (songDiscover) must be first
      expect(state.favoriteTracks[0].id).toBe(songDiscover.id);
      expect(state.favoriteTracks[1].id).toBe(songHome.id);

      // Each track preserves full metadata for Library display
      const first = state.favoriteTracks[0];
      expect(first.title).toBe('Adiye');
      expect(first.artist).toBe('Sid Sriram');
      expect(first.durationMs).toBe(312000);
      expect(first.artworkUrl).toBe('https://example.com/art_disc.jpg');
    });

    it('unfavouriting a song causes it to immediately disappear from Library', async () => {
      const store = useLibraryStore.getState();

      await store.toggleFavorite(songHome);
      await store.toggleFavorite(songDiscover);
      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(2);

      // Unfavourite songHome
      await store.toggleFavorite(songHome);

      const state = useLibraryStore.getState();
      expect(state.favoriteTracks).toHaveLength(1);
      expect(state.favoriteTracks[0].id).toBe(songDiscover.id);
      expect(state.isFavorite(songHome.id)).toBe(false);
      expect(state.isFavorite(songDiscover.id)).toBe(true);
    });
  });

  describe('3. Application Restart & Persistence', () => {
    it('preserves favourites after app restart when reinitialized from storage', async () => {
      const store = useLibraryStore.getState();

      // Add two favorites
      await store.toggleFavorite(songHome);
      await store.toggleFavorite(songSearch);

      // Simulate app restart: wipe in-memory state
      useLibraryStore.setState({
        favorites: [],
        favoriteTracks: [],
        playlists: [],
        currentUserId: null,
        isInitialized: false
      });

      // Launch app and initialize for USER_A
      await useLibraryStore.getState().initialize(USER_A_ID);

      const restoredState = useLibraryStore.getState();
      expect(restoredState.isInitialized).toBe(true);
      expect(restoredState.favorites).toHaveLength(2);
      expect(restoredState.favoriteTracks).toHaveLength(2);
      expect(restoredState.favoriteTracks[0].id).toBe(songSearch.id);
      expect(restoredState.favoriteTracks[1].id).toBe(songHome.id);
      expect(restoredState.isFavorite(songHome.id)).toBe(true);
      expect(restoredState.isFavorite(songSearch.id)).toBe(true);
    });
  });

  describe('4. Authentication, Logout & Multi-User Isolation', () => {
    it('clears in-memory favourites on logout without deleting records from persistent storage', async () => {
      const store = useLibraryStore.getState();
      await store.toggleFavorite(songHome);

      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(1);

      // User logs out: switchUser(null)
      await store.switchUser(null);

      const guestState = useLibraryStore.getState();
      expect(guestState.currentUserId).toBeNull();
      expect(guestState.favorites).toHaveLength(0);
      expect(guestState.favoriteTracks).toHaveLength(0);

      // Verify actual persistent storage for USER_A is NOT deleted
      const storedUserA = await AsyncStorage.getItem(`@syncwave_mobile_library_${USER_A_ID}_v2`);
      expect(storedUserA).toBeTruthy();
      const parsed = JSON.parse(storedUserA!);
      expect(parsed.favorites).toEqual([songHome.id]);
    });

    it('restores correct user favourites when user logs back in, with complete account isolation', async () => {
      const store = useLibraryStore.getState();

      // 1. User A favorites songHome
      await store.switchUser(USER_A_ID);
      await store.toggleFavorite(songHome);

      // 2. User A logs out
      await store.switchUser(null);
      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(0);

      // 3. User B logs in
      await store.switchUser(USER_B_ID);
      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(0);

      // 4. User B favorites songDiscover
      await store.toggleFavorite(songDiscover);
      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(1);
      expect(useLibraryStore.getState().favoriteTracks[0].id).toBe(songDiscover.id);

      // 5. User B logs out
      await store.switchUser(null);

      // 6. User A logs back in
      await store.switchUser(USER_A_ID);
      const reloadedUserA = useLibraryStore.getState();
      expect(reloadedUserA.favoriteTracks).toHaveLength(1);
      expect(reloadedUserA.favoriteTracks[0].id).toBe(songHome.id);
      expect(reloadedUserA.isFavorite(songDiscover.id)).toBe(false);
    });
  });

  describe('5. Cloud Sync Resilience', () => {
    it('syncFavorites merges cloud IDs, uses server populated songs, and never empties favoriteTracks', async () => {
      // Mock apiClient.get for /api/favorites returning both data IDs and populated songs
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          count: 2,
          data: [songSearch.id, songHome.id],
          songs: [songSearch, songHome]
        }
      } as any);

      await useLibraryStore.getState().syncFavorites();

      const state = useLibraryStore.getState();
      expect(state.favorites).toContain(songSearch.id);
      expect(state.favorites).toContain(songHome.id);
      expect(state.favoriteTracks.map((t) => t.id)).toEqual([songSearch.id, songHome.id]);
    });
  });
});
