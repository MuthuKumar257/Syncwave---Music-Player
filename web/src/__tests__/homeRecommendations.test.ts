import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecommendationStore } from '../store/useRecommendationStore';
import type { PersonalizedFeed, UnifiedTrack } from '../types';

const makeTrack = (id: string, title: string, composer: string): UnifiedTrack => ({
  id,
  title,
  artist: composer,
  composer,
  singers: ['Hariharan'],
  movieName: 'Vaaranam Aayiram',
  album: 'Vaaranam Aayiram',
  durationMs: 255000,
  artworkUrl: 'https://i.ytimg.com/vi/FzLpP8VBC6E/hqdefault.jpg',
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://www.youtube.com/watch?v=FzLpP8VBC6E',
  videoId: 'FzLpP8VBC6E',
  versionType: 'ORIGINAL',
  isPlayableDirectly: true,
  language: 'Tamil',
  releaseYear: 2008
});

const REQUIRED_12_MOODS = [
  'Happy',
  'Sad',
  'Romantic',
  'Love',
  'Motivation',
  'Energetic',
  'Relaxing',
  'Party',
  'Melancholic',
  'Devotional',
  'Focus',
  'Travel'
];

describe('Home Screen Recommendations & Pull-to-Refresh Store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useRecommendationStore.setState({
      feed: null,
      preferences: null,
      isLoading: false,
      isRefreshing: false,
      feedError: null,
      lastRefreshedAt: null
    });
  });

  it('prevents multiple simultaneous pull-to-refresh requests via in-flight lock', async () => {
    const sampleTrack = makeTrack('t1', 'Nenjukkul Peidhidum', 'Harris Jayaraj');
    const fakeFeed: PersonalizedFeed = {
      greeting: 'Good evening',
      timeOfDay: 'EVENING',
      contextTitle: 'Evening Hits',
      contextDescription: 'Tailored mix',
      preferredLanguages: ['Tamil'],
      recentlyPlayed: [sampleTrack],
      continueListening: [],
      recommendedForYou: [sampleTrack],
      basedOnListeningHistory: { basedOn: 'Harris Jayaraj', tracks: [sampleTrack] },
      favouriteArtists: [],
      recommendedSingers: [],
      recommendedMusicDirectors: [],
      moodPlaylists: REQUIRED_12_MOODS.map((m) => ({
        id: m.toLowerCase(),
        mood: m,
        title: `${m} Vibes`,
        description: `${m} playlist`,
        artworkUrl: sampleTrack.artworkUrl,
        accentColor: '#F59E0B',
        trackCount: 1,
        tracks: [sampleTrack]
      })),
      similarSongs: [sampleTrack],
      popularSongs: [sampleTrack],
      favouriteMusicDirectors: [],
      favouriteSingers: [],
      trendingInLanguages: [sampleTrack],
      newReleases: [sampleTrack],
      discoverNewMusic: [sampleTrack],
      movieSoundtracks: [],
      madeForYou: [sampleTrack],
      languageSections: [],
      becauseYouListenedTo: { basedOn: 'Harris Jayaraj', tracks: [sampleTrack] },
      favouriteArtistPicks: [],
      dailyMixes: [],
      timeBasedPicks: { contextName: 'Evening', description: 'Chill', tracks: [sampleTrack] },
      discoverNew: [sampleTrack]
    };

    let releaseFetch!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/recommendations')) {
        await gate;
        return new Response(JSON.stringify({ success: true, data: fakeFeed }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, preferences: { userId: 'u1', preferredLanguages: ['Tamil'] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const store = useRecommendationStore.getState();
    const p1 = store.refreshHome();
    const p2 = store.refreshHome();
    const p3 = store.fetchFeed(undefined, { isPullRefresh: true });

    releaseFetch();
    await Promise.all([p1, p2, p3]);

    const recommendationCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/recommendations')
    );
    expect(recommendationCalls.length).toBe(1);
    expect(useRecommendationStore.getState().isRefreshing).toBe(false);
    expect(useRecommendationStore.getState().feed?.moodPlaylists?.map((m) => m.mood)).toEqual(
      REQUIRED_12_MOODS
    );
  });

  it('captures network errors cleanly without wiping cached feed', async () => {
    const sampleTrack = makeTrack('t2', 'Mundhinam Paarthenae', 'Harris Jayaraj');
    useRecommendationStore.setState({
      feed: {
        greeting: 'Good morning',
        timeOfDay: 'MORNING',
        contextTitle: 'Morning',
        contextDescription: 'Fresh',
        preferredLanguages: ['Tamil'],
        recentlyPlayed: [sampleTrack],
        continueListening: [],
        recommendedForYou: [sampleTrack],
        basedOnListeningHistory: { basedOn: 'Harris Jayaraj', tracks: [] },
        favouriteMusicDirectors: [],
        favouriteSingers: [],
        trendingInLanguages: [],
        newReleases: [],
        discoverNewMusic: [],
        movieSoundtracks: [],
        madeForYou: [sampleTrack],
        languageSections: [],
        becauseYouListenedTo: { basedOn: 'Harris Jayaraj', tracks: [] },
        favouriteArtistPicks: [],
        dailyMixes: [],
        timeBasedPicks: { contextName: 'Morning', description: '', tracks: [] },
        discoverNew: []
      }
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Server error', { status: 503 }))
    );

    await useRecommendationStore.getState().fetchFeed(undefined, { isPullRefresh: true });
    const state = useRecommendationStore.getState();
    expect(state.feedError).toContain('HTTP 503');
    expect(state.feed?.madeForYou.length).toBe(1);
    expect(state.isRefreshing).toBe(false);
  });
});
