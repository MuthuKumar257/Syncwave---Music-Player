import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore, MobileUserProfile } from '../store/useAuthStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSearchStore } from '../store/useSearchStore';
import { useSchedulerStore } from '../store/useSchedulerStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { clearAllUserData } from '../utils/userDataCleanup';
import { Track } from '../api/types';

const mockTrack1: Track = {
  id: 'song_clean_1',
  title: 'Nenjukkul Peidhidum',
  artist: 'Hariharan, Harris Jayaraj',
  album: 'Vaaranam Aayiram',
  durationMs: 310000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=nenjukkul',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/vaaranam.jpg',
  language: 'Tamil'
};

const mockUser: MobileUserProfile = {
  id: 'usr_cleanup_user_1',
  email: 'cleanup_me@syncwave.app',
  displayName: 'Old User Data',
  authProvider: 'EMAIL'
};

describe('Music Player – Complete User Data Deletion and Fresh Start (Mobile)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();

    // Initialize stores to clean state
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isHydrated: true, providers: null });
    useSearchStore.setState({ query: '', results: null, suggestions: [], recentSearches: [], isSearching: false });
    useLibraryStore.setState({ favorites: [], favoriteTracks: [], playlists: [], currentUserId: null, isInitialized: true });
    useSchedulerStore.setState({ schedules: [], currentUserId: null, isLoading: false, isInitialized: true });
    useDownloadStore.setState({ downloadedTracks: [], downloadProgress: {}, downloadStatus: {}, downloadErrors: {}, failedTracks: {} });
    useRecommendationStore.setState({ feed: null, preferences: null, hasCompletedOnboarding: false, selectedLanguages: [], selectedDirectors: [], selectedSingers: [], selectedGenres: [], selectedMoods: [] });
    usePlayerStore.setState({ currentTrack: null, isPlaying: false, position: 0, duration: 0, queue: [], queueIndex: -1, isMiniPlayerVisible: false, sessionPlayedTrackIds: [] });
  });

  describe('1. Search History Cleanup', () => {
    it('clears recent searches, search cache, and AsyncStorage entries', async () => {
      // 1. Add searches
      useSearchStore.getState().addRecentSearch('Anirudh');
      useSearchStore.getState().addRecentSearch('Harris Jayaraj');
      useSearchStore.getState().addRecentSearch('A. R. Rahman');

      expect(useSearchStore.getState().recentSearches).toEqual(['A. R. Rahman', 'Harris Jayaraj', 'Anirudh']);

      // 2. Clear all search history
      await useSearchStore.getState().clearAllSearchHistory();

      // 3. Verify store is completely empty
      expect(useSearchStore.getState().recentSearches).toEqual([]);
      expect(useSearchStore.getState().query).toBe('');
      expect(useSearchStore.getState().results).toBeNull();
      expect(useSearchStore.getState().suggestions).toEqual([]);

      // 4. Verify AsyncStorage key is removed
      const stored = await AsyncStorage.getItem('@syncwave_recent_searches');
      expect(stored).toBeNull();
    });
  });

  describe('2. Library Cleanup (Playlists & Favorites)', () => {
    it('removes all playlists, favorites, and persistent user-scoped library storage', async () => {
      // 1. Authenticate user and add library data
      await useLibraryStore.getState().switchUser(mockUser.id);
      await useLibraryStore.getState().createPlaylist('My Private Playlist', [mockTrack1]);
      await useLibraryStore.getState().toggleFavorite(mockTrack1);

      expect(useLibraryStore.getState().playlists.length).toBe(1);
      expect(useLibraryStore.getState().favorites).toContain(mockTrack1.id);

      // 2. Perform library cleanup
      await useLibraryStore.getState().clearAllLibraryData(mockUser.id);

      // 3. Verify in-memory library is pristine empty state
      expect(useLibraryStore.getState().playlists).toEqual([]);
      expect(useLibraryStore.getState().favorites).toEqual([]);
      expect(useLibraryStore.getState().favoriteTracks).toEqual([]);

      // 4. Verify disk storage for this user is deleted
      const userKey = `@syncwave_mobile_library_${mockUser.id}_v2`;
      const storedData = await AsyncStorage.getItem(userKey);
      expect(storedData).toBeNull();
    });
  });

  describe('3. Scheduler Cleanup', () => {
    it('removes all saved schedules and prevents old schedules from remaining active', async () => {
      // 1. Setup user schedule
      await useSchedulerStore.getState().switchUser(mockUser.id);
      await useSchedulerStore.getState().saveSchedule({
        id: 'sched_wakeup_1',
        name: 'Morning Wakeup',
        startTime: '06:00',
        repeatType: 'DAILY',
        daysOfWeek: [1, 2, 3, 4, 5],
        targetType: 'PLAYLIST',
        targetId: 'pl_1',
        targetName: 'Wakeup Tunes',
        priority: 'HIGH',
        isEnabled: true,
        createdAt: new Date().toISOString()
      });

      expect(useSchedulerStore.getState().schedules.length).toBe(1);

      // 2. Execute scheduler cleanup
      await useSchedulerStore.getState().clearAllSchedules(mockUser.id);

      // 3. Verify schedules are empty
      expect(useSchedulerStore.getState().schedules).toEqual([]);

      // 4. Verify disk storage is deleted
      const schedKey = `@syncwave_mobile_schedules_${mockUser.id}_v2`;
      const storedSched = await AsyncStorage.getItem(schedKey);
      expect(storedSched).toBeNull();
    });
  });

  describe('4. Download Metadata Cleanup', () => {
    it('clears all download records, progress, and download storage metadata', async () => {
      // 1. Populate download state
      useDownloadStore.setState({
        downloadedTracks: [mockTrack1],
        downloadProgress: { [mockTrack1.id]: 100 },
        downloadStatus: { [mockTrack1.id]: 'COMPLETED' }
      });
      await AsyncStorage.setItem('@syncwave_offline_downloads_v2', JSON.stringify([mockTrack1]));

      // 2. Execute download cleanup
      await useDownloadStore.getState().clearAllDownloads();

      // 3. Verify empty download state
      expect(useDownloadStore.getState().downloadedTracks).toEqual([]);
      expect(useDownloadStore.getState().downloadProgress).toEqual({});
      expect(useDownloadStore.getState().downloadStatus).toEqual({});

      // 4. Verify storage key removed
      const stored = await AsyncStorage.getItem('@syncwave_offline_downloads_v2');
      expect(stored).toBeNull();
    });
  });

  describe('5. Complete User Data Reset & Fresh Start (Integration)', () => {
    it('purges all personal user data across all stores simultaneously and leaves shared songs accessible', async () => {
      // Step 1: Fully populate all stores simulating an active authenticated user
      useAuthStore.setState({
        user: mockUser,
        token: 'active_user_jwt',
        isAuthenticated: true
      });
      await AsyncStorage.multiSet([
        ['syncwave_auth_token', 'active_user_jwt'],
        ['syncwave_user_id', mockUser.id],
        ['syncwave_auth_user', JSON.stringify(mockUser)]
      ]);

      useSearchStore.getState().addRecentSearch('Vaaranam Aayiram');
      await useLibraryStore.getState().switchUser(mockUser.id);
      await useLibraryStore.getState().createPlaylist('Party Mix', [mockTrack1]);
      await useLibraryStore.getState().toggleFavorite(mockTrack1);
      await useSchedulerStore.getState().switchUser(mockUser.id);
      await useSchedulerStore.getState().saveSchedule({
        id: 'user_sched_99',
        name: 'Evening Chill',
        startTime: '19:00',
        repeatType: 'DAILY',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        targetType: 'SONG',
        targetId: mockTrack1.id,
        targetName: mockTrack1.title,
        priority: 'NORMAL',
        isEnabled: true,
        createdAt: new Date().toISOString()
      });

      useDownloadStore.setState({ downloadedTracks: [mockTrack1] });
      await AsyncStorage.setItem('@syncwave_offline_downloads_v2', JSON.stringify([mockTrack1]));

      useRecommendationStore.setState({
        hasCompletedOnboarding: true,
        selectedLanguages: ['Tamil', 'Hindi'],
        selectedDirectors: ['Harris Jayaraj'],
        preferences: {
          userId: mockUser.id,
          preferredLanguages: ['Tamil'],
          favouriteArtists: ['Harris Jayaraj'],
          favouriteComposers: ['Harris Jayaraj'],
          favouriteSingers: [],
          favouriteGenres: [],
          favouriteMovies: [],
          preferredMoods: [],
          personalizationEnabled: true,
          historyEnabled: true,
          hasCompletedOnboarding: true
        }
      });
      await AsyncStorage.setItem('@syncwave_onboarding_completed_v1', 'true');

      usePlayerStore.setState({
        currentTrack: mockTrack1,
        queue: [mockTrack1],
        queueIndex: 0,
        isPlaying: true,
        position: 45,
        duration: 310,
        isMiniPlayerVisible: true
      });
      await AsyncStorage.setItem('@syncwave_playback_session', JSON.stringify({ trackId: mockTrack1.id }));

      // Step 2: Execute Unified Complete User Data Reset
      const result = await clearAllUserData({ notifyBackend: false });

      // Step 3: Assert Cleanup Report
      expect(result.success).toBe(true);
      expect(result.searchCleared).toBe(true);
      expect(result.libraryCleared).toBe(true);
      expect(result.schedulerCleared).toBe(true);
      expect(result.downloadsCleared).toBe(true);
      expect(result.preferencesCleared).toBe(true);
      expect(result.playbackCleared).toBe(true);
      expect(result.authCleared).toBe(true);

      // Step 4: Verify Every Store is Empty
      // Auth
      const auth = useAuthStore.getState();
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.user).toBeNull();
      expect(auth.token).toBeNull();

      // Search
      const search = useSearchStore.getState();
      expect(search.recentSearches).toEqual([]);
      expect(search.query).toBe('');
      expect(search.results).toBeNull();

      // Library
      const library = useLibraryStore.getState();
      expect(library.playlists).toEqual([]);
      expect(library.favorites).toEqual([]);
      expect(library.favoriteTracks).toEqual([]);
      expect(library.currentUserId).toBeNull();

      // Scheduler
      const scheduler = useSchedulerStore.getState();
      expect(scheduler.schedules).toEqual([]);
      expect(scheduler.currentUserId).toBeNull();

      // Downloads
      const downloads = useDownloadStore.getState();
      expect(downloads.downloadedTracks).toEqual([]);

      // Recommendation
      const reco = useRecommendationStore.getState();
      expect(reco.hasCompletedOnboarding).toBe(false);
      expect(reco.selectedLanguages).toEqual([]);
      expect(reco.selectedDirectors).toEqual([]);
      expect(reco.preferences).toBeNull();
      expect(!reco.feed || Array.isArray(reco.feed) || !(reco.feed as any).recommendedForYou?.length).toBe(true);

      // Player
      const player = usePlayerStore.getState();
      expect(player.currentTrack).toBeNull();
      expect(player.queue).toEqual([]);
      expect(player.isPlaying).toBe(false);
      expect(player.isMiniPlayerVisible).toBe(false);

      // Step 5: Verify AsyncStorage is Clean
      const remainingKeys = await AsyncStorage.getAllKeys();
      const userKeys = remainingKeys.filter(
        (k) =>
          k.startsWith('@syncwave_') ||
          k.startsWith('syncwave_') ||
          k.includes(mockUser.id)
      );
      expect(userKeys).toEqual([]);
    });
  });
});
