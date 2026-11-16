import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore, MobileUserProfile } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { useSchedulerStore, MobileSchedule } from '../store/useSchedulerStore';
import { useSearchStore } from '../store/useSearchStore';
import { queryClient } from '../api/queryClient';
import { cancelPendingUserRequests } from '../api/client';
import { resetToGuestHome } from '../navigation/navigationService';
import { Track } from '../api/types';

const mockTrackA: Track = {
  id: 'song_user_a_1',
  title: 'Uyire Uyire',
  artist: 'Hariharan',
  composer: 'A.R. Rahman',
  album: 'Bombay',
  durationMs: 310000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=uyire',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/uyire.jpg',
  language: 'Tamil'
};

const mockTrackB: Track = {
  id: 'song_user_b_2',
  title: 'Kesariya',
  artist: 'Arijit Singh',
  composer: 'Pritam',
  album: 'Brahmastra',
  durationMs: 268000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=kesariya',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/kesariya.jpg',
  language: 'Hindi'
};

const mockPublicTrack: Track = {
  id: 'song_public_3',
  title: 'Naatu Naatu',
  artist: 'Rahul Sipligunj',
  composer: 'M.M. Keeravani',
  album: 'RRR',
  durationMs: 215000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=naatu',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/naatu.jpg',
  language: 'Telugu'
};

const mockUserA: MobileUserProfile = {
  id: 'usr_alpha_111',
  email: 'usera@example.com',
  displayName: 'User Alpha',
  authProvider: 'EMAIL'
};

const mockUserB: MobileUserProfile = {
  id: 'usr_beta_222',
  email: 'userb@example.com',
  displayName: 'User Beta',
  authProvider: 'EMAIL'
};

describe('Music Player – Clean Guest Mode After Logout & Multi-User Isolation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();

    // Reset all stores to a clean baseline
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: true,
      providers: null
    });

    usePlayerStore.setState({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      position: 0,
      duration: 0,
      isMiniPlayerVisible: false,
      isQueueSheetVisible: false,
      sessionPlayedTrackIds: []
    });

    useLibraryStore.setState({
      favorites: [],
      favoriteTracks: [],
      playlists: [],
      currentUserId: null,
      isInitialized: true
    });

    useRecommendationStore.setState({
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

    useDownloadStore.setState({
      downloadedTracks: [],
      downloadProgress: {},
      downloadStatus: {},
      downloadErrors: {},
      failedTracks: {}
    });

    useSchedulerStore.setState({
      schedules: [],
      currentUserId: null,
      isLoading: false,
      isInitialized: true
    });

    useSearchStore.setState({
      query: '',
      results: null,
      suggestions: [],
      recentSearches: []
    });
  });

  describe('1. Logout Behaviour: Session, Memory, Player & Private Data Cleanup', () => {
    it('clears authenticated session, resets player, clears in-memory library & preferences without deleting files', async () => {
      // 1. Setup authenticated User A session
      useAuthStore.setState({
        user: mockUserA,
        token: 'jwt_token_user_a',
        isAuthenticated: true
      });
      await AsyncStorage.multiSet([
        ['syncwave_auth_token', 'jwt_token_user_a'],
        ['syncwave_user_id', mockUserA.id],
        ['syncwave_auth_user', JSON.stringify(mockUserA)]
      ]);

      // 2. Set up active player state for User A
      usePlayerStore.setState({
        currentTrack: mockTrackA,
        queue: [mockTrackA, mockTrackB],
        queueIndex: 0,
        isPlaying: true,
        position: 45,
        duration: 310,
        isMiniPlayerVisible: true,
        sessionPlayedTrackIds: [mockTrackA.id]
      });
      await AsyncStorage.setItem('@syncwave_playback_session', JSON.stringify({ trackId: mockTrackA.id }));

      // 3. Set up user library state
      await useLibraryStore.getState().switchUser(mockUserA.id);
      await useLibraryStore.getState().createPlaylist('User A Workout Mix', [mockTrackA]);
      await useLibraryStore.getState().toggleFavorite(mockTrackA);

      // Verify User A has active state
      expect(useLibraryStore.getState().playlists.length).toBeGreaterThanOrEqual(1);
      expect(useLibraryStore.getState().favorites).toContain(mockTrackA.id);

      // 4. Set up recommendation preferences
      useRecommendationStore.setState({
        hasCompletedOnboarding: true,
        selectedLanguages: ['Tamil'],
        selectedDirectors: ['A.R. Rahman'],
        selectedSingers: ['Hariharan'],
        feed: {
          greeting: 'Welcome',
          timeOfDay: 'EVENING',
          contextTitle: 'Good evening',
          contextDescription: 'Your personalized mix',
          preferredLanguages: ['Tamil'],
          recommendedForYou: [mockTrackA],
          trendingInLanguages: [mockPublicTrack],
          discoverNewMusic: [],
          newReleases: [],
          continueListening: [],
          similarSongs: [],
          basedOnListeningHistory: { basedOn: 'Uyire Uyire', tracks: [mockTrackA] },
          moreFromFavouriteArtists: [mockTrackA],
          sameMusicDirector: { director: 'A.R. Rahman', tracks: [mockTrackA] },
          favouriteArtists: [],
          favouriteMusicDirectors: [],
          favouriteSingers: [],
          movieSoundtracks: [],
          recentlyPlayed: [mockTrackA]
        }
      });

      // 5. Set up download state with an existing downloaded track and in-flight progress
      useDownloadStore.setState({
        downloadedTracks: [mockTrackA],
        downloadProgress: { [mockTrackB.id]: 65 },
        downloadStatus: { [mockTrackB.id]: 'DOWNLOADING' }
      });
      await AsyncStorage.setItem('@syncwave_offline_downloads_v2', JSON.stringify([mockTrackA]));

      // 6. Set up user scheduler routine
      await useSchedulerStore.getState().switchUser(mockUserA.id);
      await useSchedulerStore.getState().saveSchedule({
        id: 'user_a_morning',
        name: 'User A Alarm',
        startTime: '06:30',
        repeatType: 'DAILY',
        daysOfWeek: [1, 2, 3, 4, 5],
        targetType: 'PLAYLIST',
        targetId: 'pl_1',
        targetName: 'Wake Up',
        priority: 'HIGH',
        isEnabled: true,
        createdAt: new Date().toISOString()
      });
      expect(useSchedulerStore.getState().schedules.length).toBeGreaterThan(0);

      // 7. Set up search state
      useSearchStore.setState({
        query: 'Uyire',
        recentSearches: ['Uyire']
      });

      // --- EXECUTE LOGOUT ---
      await useAuthStore.getState().logout();

      // Assertions on Auth State:
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.token).toBeNull();
      expect(authState.user).toBeNull();

      // Auth storage keys must be cleared from AsyncStorage
      const [storedToken, storedUserId, storedUserJson] = await AsyncStorage.multiGet([
        'syncwave_auth_token',
        'syncwave_user_id',
        'syncwave_auth_user'
      ]);
      expect(storedToken[1]).toBeNull();
      expect(storedUserId[1]).toBeNull();
      expect(storedUserJson[1]).toBeNull();

      // Assertions on Player State:
      const playerState = usePlayerStore.getState();
      expect(playerState.isPlaying).toBe(false);
      expect(playerState.currentTrack).toBeNull();
      expect(playerState.queue).toEqual([]);
      expect(playerState.queueIndex).toBe(-1);
      expect(playerState.isMiniPlayerVisible).toBe(false);
      expect(playerState.sessionPlayedTrackIds).toEqual([]);
      const savedSession = await AsyncStorage.getItem('@syncwave_playback_session');
      expect(savedSession).toBeNull();

      // Assertions on Library State (In-memory cleared for Guest):
      const libraryState = useLibraryStore.getState();
      expect(libraryState.currentUserId).toBeNull();
      expect(libraryState.playlists).toEqual([]);
      expect(libraryState.favorites).toEqual([]);
      expect(libraryState.favoriteTracks).toEqual([]);

      // Assertions on Recommendation Preferences:
      const recoState = useRecommendationStore.getState();
      expect(recoState.hasCompletedOnboarding).toBe(false);
      expect(recoState.selectedLanguages).toEqual([]);
      expect(recoState.selectedDirectors).toEqual([]);
      expect(recoState.selectedSingers).toEqual([]);
      expect(recoState.preferences).toBeNull();

      // Assertions on Download Store:
      const downloadState = useDownloadStore.getState();
      // In-flight progress and transient status are cleared
      expect(downloadState.downloadProgress).toEqual({});
      expect(downloadState.downloadStatus).toEqual({});
      // Offline file persistence: Actual downloaded track files on disk are PRESERVED!
      expect(downloadState.downloadedTracks).toEqual([mockTrackA]);
      const savedDownloads = await AsyncStorage.getItem('@syncwave_offline_downloads_v2');
      expect(JSON.parse(savedDownloads!)).toEqual([mockTrackA]);

      // Assertions on Scheduler Store (Cleared from memory in Guest Mode):
      const schedulerState = useSchedulerStore.getState();
      expect(schedulerState.currentUserId).toBeNull();
      expect(schedulerState.schedules).toEqual([]);

      // Assertions on Search Store (Cleared from memory in Guest Mode):
      const searchState = useSearchStore.getState();
      expect(searchState.query).toBe('');
      expect(searchState.recentSearches).toEqual([]);
    });
  });

  describe('2. Data Preservation on Disk: User Playlists and Favorites are Not Deleted', () => {
    it('preserves user data in user-scoped disk storage despite being cleared from in-memory guest state', async () => {
      // 1. User A logs in and creates data
      await useLibraryStore.getState().switchUser(mockUserA.id);
      await useLibraryStore.getState().createPlaylist('A.R. Rahman Essentials', [mockTrackA]);
      await useLibraryStore.getState().toggleFavorite(mockTrackA);

      // Verify written to User A disk storage
      const userAStorageKey = `@syncwave_mobile_library_${mockUserA.id}_v2`;
      const rawUserAData = await AsyncStorage.getItem(userAStorageKey);
      expect(rawUserAData).not.toBeNull();
      const parsedUserAData = JSON.parse(rawUserAData!);
      expect(parsedUserAData.favorites).toContain(mockTrackA.id);
      expect(parsedUserAData.playlists.some((p: any) => p.name === 'A.R. Rahman Essentials')).toBe(true);

      // 2. Switch to Guest mode
      await useLibraryStore.getState().switchUser(null);

      // In-memory state is empty
      expect(useLibraryStore.getState().playlists).toEqual([]);
      expect(useLibraryStore.getState().favorites).toEqual([]);

      // But User A disk data still exists untouched!
      const userADataAfterLogout = await AsyncStorage.getItem(userAStorageKey);
      expect(userADataAfterLogout).not.toBeNull();
      const preservedData = JSON.parse(userADataAfterLogout!);
      expect(preservedData.favorites).toContain(mockTrackA.id);
      expect(preservedData.playlists.some((p: any) => p.name === 'A.R. Rahman Essentials')).toBe(true);
    });
  });

  describe('3. Guest Mode Isolation & Public Song Catalogue', () => {
    it('restricts feed to public content and excludes personalized user recommendations', () => {
      // Setup guest feed with public tracks and empty/absent personalized sections
      const guestFeed = {
        greeting: 'Welcome',
        timeOfDay: 'EVENING' as const,
        contextTitle: 'Welcome to SyncWave',
        contextDescription: 'Public catalogue',
        preferredLanguages: [],
        trendingInLanguages: [mockTrackA, mockPublicTrack],
        discoverNewMusic: [mockTrackB],
        similarSongs: [mockPublicTrack],
        newReleases: [],
        continueListening: [],
        movieSoundtracks: [],
        favouriteArtists: [],
        favouriteMusicDirectors: [],
        favouriteSingers: [],
        recommendedForYou: [],
        basedOnListeningHistory: undefined as any,
        moreFromFavouriteArtists: [],
        sameMusicDirector: undefined as any,
        recentlyPlayed: []
      };

      useRecommendationStore.setState({ feed: guestFeed });

      // Build public songs catalog as done in HomeScreen
      const filterByLang = (tracks: Track[], lang: string) => {
        if (lang === 'ALL') return tracks;
        return tracks.filter((t) => (t.language || '').toLowerCase() === lang.toLowerCase());
      };

      const allPublicSongs = [
        ...guestFeed.trendingInLanguages,
        ...guestFeed.discoverNewMusic,
        ...guestFeed.similarSongs
      ];

      expect(allPublicSongs.length).toBe(4);

      // Test Language Filtering for Guest Mode
      const tamilSongs = filterByLang(allPublicSongs, 'Tamil');
      expect(tamilSongs.every((t) => t.language === 'Tamil')).toBe(true);
      expect(tamilSongs.length).toBe(1);

      const teluguSongs = filterByLang(allPublicSongs, 'Telugu');
      expect(teluguSongs.every((t) => t.language === 'Telugu')).toBe(true);
      expect(teluguSongs.length).toBe(2);

      // Ensure NO personalized user sections are rendered
      expect(guestFeed.recommendedForYou.length).toBe(0);
      expect(guestFeed.basedOnListeningHistory).toBeUndefined();
      expect(guestFeed.moreFromFavouriteArtists.length).toBe(0);
      expect(guestFeed.sameMusicDirector).toBeUndefined();
      expect(guestFeed.recentlyPlayed.length).toBe(0);
    });
  });

  describe('4. Multi-User Switching & Strict Data Isolation', () => {
    it('ensures User B never sees User A data, and User A data is fully restored upon re-login', async () => {
      // Step 1: User A logs in
      useAuthStore.setState({ user: mockUserA, token: 'token_a', isAuthenticated: true });
      await useLibraryStore.getState().switchUser(mockUserA.id);
      await useSchedulerStore.getState().switchUser(mockUserA.id);
      await useLibraryStore.getState().createPlaylist('User A Workout', [mockTrackA]);
      await useLibraryStore.getState().toggleFavorite(mockTrackA);
      await useSchedulerStore.getState().saveSchedule({
        id: 'user_a_sched_1',
        name: 'User A Routine',
        startTime: '07:00',
        repeatType: 'DAILY',
        daysOfWeek: [1, 2, 3, 4, 5],
        targetType: 'PLAYLIST',
        targetId: 'pl_a',
        targetName: 'User A Workout',
        priority: 'NORMAL',
        isEnabled: true,
        createdAt: new Date().toISOString()
      });

      expect(useLibraryStore.getState().playlists.some((p) => p.name === 'User A Workout')).toBe(true);
      expect(useLibraryStore.getState().isFavorite(mockTrackA.id)).toBe(true);
      expect(useSchedulerStore.getState().schedules.some((s) => s.name === 'User A Routine')).toBe(true);

      // Step 2: User A logs out -> Clean Guest Mode
      await useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useLibraryStore.getState().playlists).toEqual([]);
      expect(useLibraryStore.getState().favorites).toEqual([]);
      expect(useSchedulerStore.getState().schedules).toEqual([]);

      // Step 3: User B logs in
      useAuthStore.setState({ user: mockUserB, token: 'token_b', isAuthenticated: true });
      await useLibraryStore.getState().switchUser(mockUserB.id);
      await useSchedulerStore.getState().switchUser(mockUserB.id);

      // Verify User B sees NO data from User A
      expect(useLibraryStore.getState().playlists.some((p) => p.name === 'User A Workout')).toBe(false);
      expect(useLibraryStore.getState().isFavorite(mockTrackA.id)).toBe(false);
      expect(useLibraryStore.getState().favorites).toEqual([]);
      expect(useSchedulerStore.getState().schedules.some((s) => s.name === 'User A Routine')).toBe(false);

      // User B creates their own data
      await useLibraryStore.getState().createPlaylist('User B Chill Study', [mockTrackB]);
      await useLibraryStore.getState().toggleFavorite(mockTrackB);
      await useSchedulerStore.getState().saveSchedule({
        id: 'user_b_sched_2',
        name: 'User B Focus',
        startTime: '10:00',
        repeatType: 'WEEKDAYS',
        daysOfWeek: [1, 2, 3, 4, 5],
        targetType: 'PLAYLIST',
        targetId: 'pl_b',
        targetName: 'User B Chill Study',
        priority: 'HIGH',
        isEnabled: true,
        createdAt: new Date().toISOString()
      });
      expect(useLibraryStore.getState().playlists.some((p) => p.name === 'User B Chill Study')).toBe(true);
      expect(useLibraryStore.getState().isFavorite(mockTrackB.id)).toBe(true);
      expect(useSchedulerStore.getState().schedules.some((s) => s.name === 'User B Focus')).toBe(true);

      // Step 4: User B logs out -> Clean Guest Mode
      await useAuthStore.getState().logout();
      expect(useLibraryStore.getState().playlists).toEqual([]);
      expect(useLibraryStore.getState().favorites).toEqual([]);
      expect(useSchedulerStore.getState().schedules).toEqual([]);

      // Step 5: User A logs back in
      useAuthStore.setState({ user: mockUserA, token: 'token_a_new', isAuthenticated: true });
      await useLibraryStore.getState().switchUser(mockUserA.id);
      await useSchedulerStore.getState().switchUser(mockUserA.id);

      // Verify User A original data is completely restored
      expect(useLibraryStore.getState().playlists.some((p) => p.name === 'User A Workout')).toBe(true);
      expect(useLibraryStore.getState().isFavorite(mockTrackA.id)).toBe(true);
      expect(useSchedulerStore.getState().schedules.some((s) => s.name === 'User A Routine')).toBe(true);

      // Verify User A CANNOT see User B data
      expect(useLibraryStore.getState().playlists.some((p) => p.name === 'User B Chill Study')).toBe(false);
      expect(useLibraryStore.getState().isFavorite(mockTrackB.id)).toBe(false);
      expect(useSchedulerStore.getState().schedules.some((s) => s.name === 'User B Focus')).toBe(false);
    });
  });

  describe('5. Guest Screen State & Login Prompts Verification', () => {
    it('enforces unauthenticated status guarding private screens and features', () => {
      const auth = useAuthStore.getState();
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.user).toBeNull();

      // Guest profile state: displayName defaults to 'Guest Listener', stats are unpopulated
      const profileDisplayName = auth.isAuthenticated ? auth.user?.displayName : 'Guest Listener';
      expect(profileDisplayName).toBe('Guest Listener');

      // Private library collections: Playlists, Favorites, and Downloads must be gated
      const library = useLibraryStore.getState();
      expect(library.playlists).toHaveLength(0);
      expect(library.favorites).toHaveLength(0);
      expect(library.favoriteTracks).toHaveLength(0);

      // Player queue is empty for guest
      const player = usePlayerStore.getState();
      expect(player.queue).toHaveLength(0);
      expect(player.currentTrack).toBeNull();
      expect(player.isPlaying).toBe(false);
    });
  });
});
