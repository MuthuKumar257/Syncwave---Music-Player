import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecommendationStore } from '../store/useRecommendationStore';
import type { UnifiedTrack } from '../types';

const sampleTrack: UnifiedTrack = {
  id: 'base_song_1',
  title: 'Nenjukkul Peidhidum',
  artist: 'Harris Jayaraj',
  composer: 'Harris Jayaraj',
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
};

describe('Home Screen Independent Base Song Feed & Error Resilience (Web)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useRecommendationStore.getState().resetForLogout();
  });

  it('loads base catalogue songs independently via fetchBaseFeed', async () => {
    const mockBasePayload = {
      success: true,
      data: {
        recommended: [sampleTrack],
        trending: [sampleTrack],
        recentlyAdded: [sampleTrack],
        popularSongs: [sampleTrack],
        allAvailable: [sampleTrack],
        languages: ['Tamil'],
        requiresLanguageSelection: false
      }
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/songs/home-base')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBasePayload)
        });
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      });
    });

    await useRecommendationStore.getState().fetchBaseFeed();

    const state = useRecommendationStore.getState();
    expect(state.baseSections).toBeDefined();
    expect(state.baseSections?.trending.length).toBe(1);
    expect(state.baseSections?.popularSongs.length).toBe(1);
    expect(state.baseCatalogue.length).toBe(1);
    expect(state.baseError).toBeNull();
  });

  it('displays available catalogue songs even if recommendations API returns 500 error', async () => {
    const mockBasePayload = {
      success: true,
      data: {
        recommended: [sampleTrack],
        trending: [sampleTrack],
        recentlyAdded: [sampleTrack],
        popularSongs: [sampleTrack],
        allAvailable: [sampleTrack]
      }
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/songs/home-base')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBasePayload)
        });
      }
      if (url.includes('/api/recommendations')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Recommendation Failure')
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });

    // Run fetchFeed (which also calls fetchBaseFeed in parallel)
    await useRecommendationStore.getState().fetchFeed();
    await useRecommendationStore.getState().fetchBaseFeed();

    const state = useRecommendationStore.getState();
    // Recommendations errored:
    expect(state.feedError).toBe('HTTP 500');
    // But base catalogue songs are safely loaded:
    expect(state.baseSections).toBeDefined();
    expect(state.baseCatalogue.length).toBe(1);
    expect(state.baseSections?.popularSongs[0].title).toBe('Nenjukkul Peidhidum');
  });

  it('retrySection triggers isolated section retry without blanking out other sections', async () => {
    let baseFetchAttempts = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/songs/home-base')) {
        baseFetchAttempts++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                recommended: [sampleTrack],
                trending: [sampleTrack],
                recentlyAdded: [sampleTrack],
                popularSongs: [sampleTrack],
                allAvailable: [sampleTrack]
              }
            })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { madeForYou: [] } })
      });
    });

    await useRecommendationStore.getState().retrySection('baseFeed');
    expect(baseFetchAttempts).toBe(1);
    expect(useRecommendationStore.getState().baseCatalogue.length).toBe(1);
  });

  it('resetForLogout purges base catalogue and sections completely', () => {
    useRecommendationStore.setState({
      baseSections: {
        recommended: [sampleTrack],
        trending: [sampleTrack],
        recentlyAdded: [sampleTrack],
        popularSongs: [sampleTrack],
        allAvailable: [sampleTrack]
      },
      baseCatalogue: [sampleTrack]
    });

    useRecommendationStore.getState().resetForLogout();

    const state = useRecommendationStore.getState();
    expect(state.baseSections).toBeNull();
    expect(state.baseCatalogue).toEqual([]);
    expect(state.feed).toBeNull();
  });
});
