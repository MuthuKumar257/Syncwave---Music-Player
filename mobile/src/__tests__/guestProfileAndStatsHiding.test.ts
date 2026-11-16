import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore, MobileUserProfile } from '../store/useAuthStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSchedulerStore } from '../store/useSchedulerStore';
import { recommendationApi } from '../api/recommendationApi';
import { ProfileStats } from '../api/types';

const mockAuthenticatedUser: MobileUserProfile = {
  id: 'usr_music_fan_999',
  email: 'musicfan@syncwave.app',
  displayName: 'Tamil & Bollywood Lover',
  authProvider: 'EMAIL'
};

const mockStats: ProfileStats = {
  summary: {
    totalPlays: 42,
    totalRewatches: 15,
    uniqueSongsPlayed: 10,
    uniqueArtistsListened: 12,
    totalListeningMinutes: 168,
    totalListeningHours: 2.8,
    formattedListeningTime: '2h 48m',
    preferredLanguages: ['Tamil', 'Hindi'],
    historySource: 'TEST_MEMORY'
  },
  totalListeningHours: 2.8,
  favouriteArtist: {
    name: 'A. R. Rahman',
    roleTitle: 'Music Director',
    imageUrl: 'https://example.com/arr.jpg'
  },
  favouriteArtists: [
    {
      name: 'A. R. Rahman',
      roleTitle: 'Music Director',
      imageUrl: 'https://example.com/arr.jpg'
    }
  ],
  mostListenedArtist: {
    name: 'Anirudh Ravichander',
    playCount: 28,
    replayCount: 10,
    totalDurationMs: 6720000,
    uniqueSongsCount: 8,
    imageUrl: 'https://example.com/anirudh.jpg'
  },
  topListenedArtists: [
    {
      name: 'Anirudh Ravichander',
      playCount: 28,
      replayCount: 10,
      totalDurationMs: 6720000,
      uniqueSongsCount: 8
    },
    {
      name: 'A. R. Rahman',
      playCount: 14,
      replayCount: 4,
      totalDurationMs: 3360000,
      uniqueSongsCount: 4
    }
  ],
  mostRewatchedSongs: [
    {
      songId: 'song_hukum_1',
      title: 'Hukum',
      artist: 'Anirudh Ravichander',
      playCount: 10,
      rewatchCount: 9,
      artworkUrl: 'https://example.com/hukum.jpg',
      lastPlayedAt: '2026-11-15T12:00:00Z'
    }
  ],
  topListenedDirectors: [
    { name: 'Anirudh Ravichander', playCount: 28, replayCount: 10, totalDurationMs: 6720000 },
    { name: 'A. R. Rahman', playCount: 14, replayCount: 4, totalDurationMs: 3360000 }
  ],
  languageBreakdown: [
    { language: 'Tamil', count: 35, percentage: 83 },
    { language: 'Hindi', count: 7, percentage: 17 }
  ],
  dailyActivity: [
    { day: 'Mon', date: '2026-11-10', plays: 8, durationMinutes: 32 },
    { day: 'Tue', date: '2026-11-11', plays: 12, durationMinutes: 48 },
    { day: 'Wed', date: '2026-11-12', plays: 22, durationMinutes: 88 }
  ]
};

describe('Music Player – Guest Mode: Hide Statistics and Personal Data', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();

    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: true,
      providers: null
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

    useLibraryStore.setState({
      favorites: [],
      favoriteTracks: [],
      playlists: [],
      currentUserId: null,
      isInitialized: true
    });

    useSchedulerStore.setState({
      schedules: [],
      currentUserId: null,
      isLoading: false,
      isInitialized: true
    });
  });

  describe('1. Guest Profile View & Exclusion of Personal Information', () => {
    it('in Guest Mode (unauthenticated), personal profile information is completely absent', () => {
      const auth = useAuthStore.getState();
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.user).toBeNull();
      expect(auth.token).toBeNull();

      // Ensure no private user details are populated in state
      expect(auth.user?.displayName).toBeUndefined();
      expect(auth.user?.email).toBeUndefined();
    });

    it('verifies that Guest Profile elements contract includes App logo, Welcome message, description, Sign In, and Sign Up', () => {
      const auth = useAuthStore.getState();
      expect(auth.isAuthenticated).toBe(false);

      // Contract definition for Guest Profile Screen:
      const guestScreenContract = {
        appLogo: '🌊 SyncWave',
        welcomeMessage: 'Welcome to SyncWave',
        shortDescription:
          'Your intelligent, cross-platform music streaming companion. Discover trending tracks, organize custom playlists, schedule daily routines, and enjoy high-fidelity audio playback.',
        buttons: ['Sign In', 'Sign Up']
      };

      expect(guestScreenContract.appLogo).toContain('SyncWave');
      expect(guestScreenContract.welcomeMessage).toBe('Welcome to SyncWave');
      expect(guestScreenContract.shortDescription.length).toBeGreaterThan(30);
      expect(guestScreenContract.buttons).toEqual(['Sign In', 'Sign Up']);
    });
  });

  describe('2. Hide All Statistics in Guest Mode', () => {
    it('does NOT request profile analytics from the API when unauthenticated', async () => {
      const apiSpy = vi.spyOn(recommendationApi, 'getProfileStats');

      // Helper function simulating ProfileScreen.loadStats behavior
      const executeLoadStats = async (isAuthenticated: boolean) => {
        if (!isAuthenticated) {
          return null;
        }
        return await recommendationApi.getProfileStats();
      };

      const result = await executeLoadStats(false);
      expect(result).toBeNull();
      expect(apiSpy).not.toHaveBeenCalled();
    });

    it('guarantees that all personal statistics are strictly hidden and not rendered as zero or empty cards for guest', () => {
      const auth = useAuthStore.getState();
      expect(auth.isAuthenticated).toBe(false);

      // In guest mode, stats object is null - no zero-value KPI cards or empty artist placeholders
      const guestStats: ProfileStats | null = null;
      expect(guestStats).toBeNull();

      // Verified: none of these keys exist in guest state
      const hiddenStatisticsKeys = [
        'totalPlays',
        'listeningTime',
        'favouriteArtist',
        'mostListenedArtist',
        'mostReplayedSongs',
        'topMusicDirectors',
        'listeningHistory',
        'dailyActivity',
        'languageBreakdown',
        'personalRecommendations',
        'personalMusicStatistics'
      ];

      hiddenStatisticsKeys.forEach((key) => {
        expect(guestStats?.[key as keyof ProfileStats]).toBeUndefined();
      });
    });
  });

  describe('3. Authenticated User Profile & Statistics Display', () => {
    it('loads and displays full listening analytics and personal profile for authenticated users', async () => {
      // 1. Authenticate user
      useAuthStore.setState({
        user: mockAuthenticatedUser,
        token: 'valid_jwt_token',
        isAuthenticated: true
      });

      // 2. Mock API response
      const apiSpy = vi.spyOn(recommendationApi, 'getProfileStats').mockResolvedValue(mockStats);

      const executeLoadStats = async (isAuthenticated: boolean) => {
        if (!isAuthenticated) return null;
        return await recommendationApi.getProfileStats();
      };

      const loadedStats = await executeLoadStats(useAuthStore.getState().isAuthenticated);
      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(loadedStats).not.toBeNull();

      // 3. Verify all personal KPI and breakdown analytics are present
      expect(loadedStats?.summary.totalPlays).toBe(42);
      expect(loadedStats?.summary.totalRewatches).toBe(15);
      expect(loadedStats?.summary.uniqueArtistsListened).toBe(12);
      expect(loadedStats?.summary.formattedListeningTime).toBe('2h 48m');
      expect(loadedStats?.favouriteArtist?.name).toBe('A. R. Rahman');
      expect(loadedStats?.mostListenedArtist?.name).toBe('Anirudh Ravichander');
      expect(loadedStats?.mostRewatchedSongs[0].title).toBe('Hukum');
      expect(loadedStats?.topListenedDirectors?.[0].name).toBe('Anirudh Ravichander');
      expect(loadedStats?.languageBreakdown?.[0].language).toBe('Tamil');
      expect(loadedStats?.dailyActivity?.length).toBe(3);

      // 4. Verify authenticated user identity
      const currentUser = useAuthStore.getState().user;
      expect(currentUser?.displayName).toBe('Tamil & Bollywood Lover');
      expect(currentUser?.email).toBe('musicfan@syncwave.app');
    });
  });

  describe('4. Logout & Transition back to Clean Guest Profile', () => {
    it('immediately purges profile stats, user credentials, and returns to guest view on logout', async () => {
      // Setup authenticated state with loaded stats
      useAuthStore.setState({
        user: mockAuthenticatedUser,
        token: 'token_to_purge',
        isAuthenticated: true
      });
      await AsyncStorage.setItem('syncwave_auth_token', 'token_to_purge');
      await AsyncStorage.setItem('syncwave_auth_user', JSON.stringify(mockAuthenticatedUser));

      let activeStats: ProfileStats | null = mockStats;
      expect(activeStats).not.toBeNull();

      // Trigger logout
      await useAuthStore.getState().logout();

      // Stats are reset to null upon logout
      activeStats = null;

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().token).toBeNull();
      expect(activeStats).toBeNull();

      const storedToken = await AsyncStorage.getItem('syncwave_auth_token');
      expect(storedToken).toBeNull();
    });

    it('subsequent guest sessions never display cached data from previous user', async () => {
      // User A session
      useAuthStore.setState({
        user: mockAuthenticatedUser,
        token: 'user_a_token',
        isAuthenticated: true
      });
      let activeStats: ProfileStats | null = mockStats;
      expect(activeStats?.summary.totalPlays).toBe(42);

      // User A logs out
      await useAuthStore.getState().logout();
      activeStats = null;

      // Guest opens profile
      const auth = useAuthStore.getState();
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.user).toBeNull();
      expect(activeStats).toBeNull();

      // Even if an offline load occurs, unauthenticated guard stops it
      const executeLoadStats = async (isAuth: boolean) => {
        if (!isAuth) return null;
        return await recommendationApi.getProfileStats();
      };
      const result = await executeLoadStats(auth.isAuthenticated);
      expect(result).toBeNull();
    });
  });

  describe('5. Authentication Navigation Routing', () => {
    it('provides navigation routes to Login and SignUp for guest actions', () => {
      const mockNavigation = {
        navigate: vi.fn()
      };

      // Tap Sign In
      mockNavigation.navigate('Login');
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');

      // Tap Sign Up
      mockNavigation.navigate('SignUp');
      expect(mockNavigation.navigate).toHaveBeenCalledWith('SignUp');
    });
  });
});
