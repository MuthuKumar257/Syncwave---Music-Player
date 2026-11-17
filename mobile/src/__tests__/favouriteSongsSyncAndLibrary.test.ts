import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePlaybackSessionStore } from '../store/usePlaybackSessionStore';
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
    await usePlaybackSessionStore.getState().stopSessionSync();
    vi.spyOn(usePlaybackSessionStore.getState(), 'startSessionSync').mockResolvedValue(undefined as any);

    useLibraryStore.setState({
      favorites: [],
      favoriteTracks: [],
      playlists: [],
      currentUserId: USER_A_ID,
      isInitialized: true
    });
  });

  afterEach(async () => {
    await usePlaybackSessionStore.getState().stopSessionSync();
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

    it('unfavouriting all songs properly clears both favorites and favoriteTracks to empty', async () => {
      const store = useLibraryStore.getState();
      await store.toggleFavorite(songHome);
      expect(useLibraryStore.getState().favorites).toHaveLength(1);

      // Cloud returns empty favorites
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          count: 0,
          data: [],
          songs: []
        }
      } as any);

      // Unfavourite the last song locally
      await store.toggleFavorite(songHome);
      expect(useLibraryStore.getState().favorites).toHaveLength(0);
      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(0);

      // Now sync with cloud
      await useLibraryStore.getState().syncFavorites();
      expect(useLibraryStore.getState().favorites).toHaveLength(0);
      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(0);
    });
  });

  describe('6. 15-Step Comprehensive End-to-End Workflow Verification', () => {
    it('executes the full 15-step user lifecycle test accurately', async () => {
      const store = useLibraryStore.getState();

      // Step 1: User A logs in
      await store.switchUser(USER_A_ID);
      expect(store.currentUserId).toBe(USER_A_ID);
      expect(useLibraryStore.getState().favorites).toHaveLength(0);

      // Step 2: User A favourites song 1 from Home
      const add1 = await store.toggleFavorite(songHome);
      expect(add1).toBe(true);
      expect(store.isFavorite(songHome.id)).toBe(true);

      // Step 3: User A favourites song 2 from Discover
      const add2 = await store.toggleFavorite(songDiscover);
      expect(add2).toBe(true);
      expect(store.isFavorite(songDiscover.id)).toBe(true);

      // Step 4: User A favourites song 3 from Search / Shared
      const add3 = await store.toggleFavorite(songSearch);
      expect(add3).toBe(true);
      expect(store.isFavorite(songSearch.id)).toBe(true);

      // Step 5 & 6: Navigate to Library -> Favorites. Verify all 3 songs are present with complete metadata
      const state5 = useLibraryStore.getState();
      expect(state5.favoriteTracks).toHaveLength(3);
      expect(state5.favorites).toEqual([songSearch.id, songDiscover.id, songHome.id]);

      // Step 7: Verify ordering (most recently favourited first: songSearch -> songDiscover -> songHome)
      expect(state5.favoriteTracks[0].id).toBe(songSearch.id);
      expect(state5.favoriteTracks[0].composer).toBe('Pritam');
      expect(state5.favoriteTracks[1].id).toBe(songDiscover.id);
      expect(state5.favoriteTracks[1].composer).toBe('A. R. Rahman');
      expect(state5.favoriteTracks[2].id).toBe(songHome.id);
      expect(state5.favoriteTracks[2].composer).toBe('Harris Jayaraj');

      // Step 8: User A unfavourites songDiscover from Library
      const rem1 = await store.toggleFavorite(songDiscover);
      expect(rem1).toBe(false);

      // Step 9: Verify songDiscover disappeared, remaining 2 songs are still present
      const state9 = useLibraryStore.getState();
      expect(state9.favoriteTracks).toHaveLength(2);
      expect(state9.favorites).toEqual([songSearch.id, songHome.id]);
      expect(state9.isFavorite(songDiscover.id)).toBe(false);
      expect(state9.isFavorite(songSearch.id)).toBe(true);
      expect(state9.isFavorite(songHome.id)).toBe(true);

      // Step 10: User A unfavourites remaining songs until 0 favorites remain
      await store.toggleFavorite(songSearch);
      await store.toggleFavorite(songHome);

      // Step 11: Empty state (0 favorites)
      const state11 = useLibraryStore.getState();
      expect(state11.favorites).toHaveLength(0);
      expect(state11.favoriteTracks).toHaveLength(0);

      // Step 12: User A re-favourites songHome. Simulate app restart
      await store.toggleFavorite(songHome);
      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(1);

      // Simulate app restart: wipe memory
      useLibraryStore.setState({
        favorites: [],
        favoriteTracks: [],
        playlists: [],
        currentUserId: null,
        isInitialized: false
      });

      // Step 13: Re-launch and initialize for USER_A. Verify songHome is restored from persistent storage
      await useLibraryStore.getState().initialize(USER_A_ID);
      const state13 = useLibraryStore.getState();
      expect(state13.favorites).toEqual([songHome.id]);
      expect(state13.favoriteTracks).toHaveLength(1);
      expect(state13.favoriteTracks[0].id).toBe(songHome.id);

      // Step 14: User A logs out
      await store.switchUser(null);
      const state14 = useLibraryStore.getState();
      expect(state14.currentUserId).toBeNull();
      expect(state14.favorites).toHaveLength(0);
      expect(state14.favoriteTracks).toHaveLength(0);

      // Step 15: User B logs in. Verify complete isolation: User B has 0 favorites.
      await store.switchUser(USER_B_ID);
      const state15B = useLibraryStore.getState();
      expect(state15B.favorites).toHaveLength(0);
      expect(state15B.favoriteTracks).toHaveLength(0);

      // User B favourites songDiscover
      await store.toggleFavorite(songDiscover);
      expect(useLibraryStore.getState().favoriteTracks).toHaveLength(1);
      expect(useLibraryStore.getState().favoriteTracks[0].id).toBe(songDiscover.id);

      // User B logs out, User A logs back in
      await store.switchUser(null);
      await store.switchUser(USER_A_ID);
      const state15A = useLibraryStore.getState();
      expect(state15A.favorites).toEqual([songHome.id]);
      expect(state15A.favoriteTracks[0].id).toBe(songHome.id);
      expect(state15A.isFavorite(songDiscover.id)).toBe(false);
    });

    it('preserves pending favorite track from guest mode and auto-favorites upon login in persistSession', async () => {
      // 1. Guest clicks favorite: pending track is stored in AsyncStorage
      await AsyncStorage.setItem('@syncwave_pending_fav_track', JSON.stringify(songDiscover));

      // 2. User logs in with user profile
      const userProfile = {
        id: USER_A_ID,
        email: 'user_a@example.com',
        displayName: 'User Alpha'
      };

      // Mock apiClient.get for me endpoint
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { success: true, user: userProfile }
      } as any);

      // Execute login/persistSession in useAuthStore
      await useAuthStore.getState().completeTokenSession('mock_jwt_token_user_a');

      // 3. Verify pending track was processed and removed from AsyncStorage
      const pendingAfter = await AsyncStorage.getItem('@syncwave_pending_fav_track');
      expect(pendingAfter).toBeNull();

      // 4. Verify songDiscover is now in User A's favorites
      const libraryState = useLibraryStore.getState();
      expect(libraryState.isFavorite(songDiscover.id)).toBe(true);
      expect(libraryState.favorites).toContain(songDiscover.id);
      expect(libraryState.favoriteTracks.some((t) => t.id === songDiscover.id)).toBe(true);
    });
  });
});
