import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { audioManager, resolveAudioUrl, isPreviewAudioUrl } from '../audio/audioManager';
import { recommendationApi } from '../api/recommendationApi';
import { apiClient } from '../api/client';
import { Track } from '../api/types';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const mockFullTrack: Track = {
  id: 'full_track_001',
  title: 'Nenjukkul Peidhidum',
  artist: 'Harris Jayaraj',
  composer: 'Harris Jayaraj',
  movieName: 'Vaaranam Aayiram',
  album: 'Vaaranam Aayiram',
  durationMs: 370000, // 6m 10s
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://cdn.syncwave.app/full/nenjukkul.m4a',
  fullAudioUrl: 'https://cdn.syncwave.app/full/nenjukkul.m4a',
  previewUrl: 'https://audio-ssl.itunes.apple.com/preview/nenjukkul_30s.m4a',
  language: 'Tamil',
  isPlayableDirectly: true,
};

const mockPreviewOnlyTrack: Track = {
  id: 'preview_only_002',
  title: 'Sample Track With Preview Only',
  artist: 'Sample Artist',
  composer: 'Sample Composer',
  durationMs: 240000,
  sourcePlatform: 'SPOTIFY',
  sourceUrl: 'https://open.spotify.com/track/12345',
  previewUrl: 'https://p.scdn.co/mp3-preview/preview_snippet_30s.mp3',
  language: 'Tamil',
  isPlayableDirectly: true,
};

const mockDownloadedTrack: Track = {
  id: 'downloaded_track_003',
  title: 'Offline Downloaded Anthem',
  artist: 'A. R. Rahman',
  composer: 'A. R. Rahman',
  durationMs: 310000,
  sourcePlatform: 'DOWNLOADED',
  sourceUrl: 'https://cdn.example.com/stream.mp3',
  localFilePath: 'file:///var/mobile/Containers/Data/SyncWave/audio_003.m4a',
  previewUrl: 'https://audio-ssl.itunes.apple.com/sample_30s.m4a',
  language: 'Tamil',
  isPlayableDirectly: true,
};

describe('Full Song Playback & Automatic Queue Generation Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      playbackStatus: 'IDLE',
      sessionPlayedTrackIds: [],
      isShuffle: false,
      repeatMode: 'OFF',
    });
    useRecommendationStore.setState({
      selectedLanguages: ['Tamil', 'Telugu'],
      preferences: {
        preferredLanguages: ['Tamil', 'Telugu'],
        favouriteComposers: ['Harris Jayaraj', 'A. R. Rahman'],
        favouriteArtists: [],
      } as any,
    });
  });

  describe('1. 30-Second Playback Limitation Permanent Fix', () => {
    it('accurately identifies preview and snippet URLs', () => {
      expect(isPreviewAudioUrl('https://p.scdn.co/mp3-preview/123456789.mp3')).toBe(true);
      expect(isPreviewAudioUrl('https://audio-ssl.itunes.apple.com/itunes-assets/sample.m4a')).toBe(true);
      expect(isPreviewAudioUrl('https://cdn.example.com/audio?preview=true')).toBe(true);
      expect(isPreviewAudioUrl('https://cdn.syncwave.app/full/master_song.mp3')).toBe(false);
      expect(isPreviewAudioUrl('file:///data/user/0/com.syncwave/files/song.m4a')).toBe(false);
    });

    it('prioritizes local downloaded file path over 30s preview and web sources', async () => {
      const resolved = await resolveAudioUrl(mockDownloadedTrack);
      expect(resolved).toBeDefined();
      expect(resolved?.url).toBe(mockDownloadedTrack.localFilePath);
      expect(resolved?.isFullSong).toBe(true);
      expect(resolved?.isPreview).toBe(false);
      expect(resolved?.durationSec).toBe(310);
    });

    it('prioritizes fullAudioUrl over previewUrl and rejects 30-second clips', async () => {
      const resolved = await resolveAudioUrl(mockFullTrack);
      expect(resolved).toBeDefined();
      expect(resolved?.url).toBe(mockFullTrack.fullAudioUrl);
      expect(resolved?.isFullSong).toBe(true);
      expect(resolved?.isPreview).toBe(false);
      expect(resolved?.durationSec).toBe(370);
      expect(resolved?.url).not.toContain('preview');
    });

    it('resolves full-length stream via backend API and sets full duration', async () => {
      const trackWithoutDirectUrl: Track = {
        id: 'online_track_004',
        title: 'Chinna Chinna Aasai',
        artist: 'A. R. Rahman',
        composer: 'A. R. Rahman',
        durationMs: 295000,
        sourcePlatform: 'YOUTUBE',
        sourceUrl: 'https://www.youtube.com/watch?v=nPhnTTQkTG0',
        language: 'Tamil',
        isPlayableDirectly: true,
      };

      (apiClient.get as any).mockResolvedValueOnce({
        data: {
          success: true,
          audioUrl: 'https://cdn.syncwave.app/audio/chinna_chinna_aasai_full.m4a',
          isFullSong: true,
          isPreview: false,
          durationMs: 295000,
        },
      });

      const resolved = await resolveAudioUrl(trackWithoutDirectUrl);
      expect(resolved).toBeDefined();
      expect(resolved?.isFullSong).toBe(true);
      expect(resolved?.isPreview).toBe(false);
      expect(resolved?.url).toBe('https://cdn.syncwave.app/audio/chinna_chinna_aasai_full.m4a');
      expect(resolved?.durationSec).toBe(295);
    });

    it('uses previewUrl ONLY as emergency fallback when no full song exists, clamping preview duration', async () => {
      (apiClient.get as any).mockRejectedValueOnce(new Error('Network error'));
      const resolved = await resolveAudioUrl(mockPreviewOnlyTrack);
      expect(resolved).toBeDefined();
      expect(resolved?.isPreview).toBe(true);
      expect(resolved?.isFullSong).toBe(false);
      expect(resolved?.durationSec).toBe(30);
    });

    it('updates position and duration continuously via setPlaybackProgress', () => {
      const store = usePlayerStore.getState();
      store.setCurrentTrack(mockFullTrack);
      store.setIsPlaying(true);

      store.setPlaybackProgress(45, 370);
      let state = usePlayerStore.getState();
      expect(state.position).toBe(45);
      expect(state.duration).toBe(370);

      // Advances past 30 seconds smoothly without stopping
      store.setPlaybackProgress(120, 370);
      state = usePlayerStore.getState();
      expect(state.position).toBe(120);
      expect(state.duration).toBe(370);
    });
  });

  describe('2. Centralized Playback State Machine', () => {
    it('manages transitions across state machine correctly', async () => {
      const store = usePlayerStore.getState();
      expect(store.playbackStatus).toBe('IDLE');
      expect(store.isPlaying).toBe(false);

      store.setPlaybackStatus('LOADING');
      expect(usePlayerStore.getState().playbackStatus).toBe('LOADING');

      store.setPlaybackStatus('PLAYING');
      store.setIsPlaying(true);
      expect(usePlayerStore.getState().playbackStatus).toBe('PLAYING');
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      store.setPlaybackStatus('PAUSED');
      store.setIsPlaying(false);
      expect(usePlayerStore.getState().playbackStatus).toBe('PAUSED');
      expect(usePlayerStore.getState().isPlaying).toBe(false);

      store.setPlaybackStatus('BUFFERING');
      expect(usePlayerStore.getState().playbackStatus).toBe('BUFFERING');

      store.setPlaybackStatus('COMPLETED');
      expect(usePlayerStore.getState().playbackStatus).toBe('COMPLETED');

      store.setPlaybackStatus('ERROR');
      expect(usePlayerStore.getState().playbackStatus).toBe('ERROR');
    });

    it('preserves playback state and queue across backgrounding and session persistence', async () => {
      const store = usePlayerStore.getState();
      await store.playTrack(mockFullTrack, [mockFullTrack, mockDownloadedTrack]);

      store.setPlaybackProgress(75, 370);
      store.persistCurrentSession(true);

      const state = usePlayerStore.getState();
      expect(state.currentTrack?.id).toBe('full_track_001');
      expect(state.queue.length).toBe(2);
      expect(state.sessionPlayedTrackIds).toContain('full_track_001');
    });
  });

  describe('3. Smart Automatic Queue Generation & Continuous Playback', () => {
    it('generates upcoming queue matching user language and preferences on song play', async () => {
      const autoTracks: Track[] = [
        {
          id: 'auto_track_1',
          title: 'Adiye',
          artist: 'A. R. Rahman',
          composer: 'A. R. Rahman',
          durationMs: 302000,
          sourcePlatform: 'YOUTUBE',
          sourceUrl: 'https://cdn.example.com/adiye.mp3',
          language: 'Tamil',
          isPlayableDirectly: true,
        },
        {
          id: 'auto_track_2',
          title: 'Samajavaragamana',
          artist: 'Thaman S',
          composer: 'Thaman S',
          durationMs: 245000,
          sourcePlatform: 'YOUTUBE',
          sourceUrl: 'https://cdn.example.com/samaja.mp3',
          language: 'Telugu',
          isPlayableDirectly: true,
        },
      ];

      vi.spyOn(recommendationApi, 'getAutoQueueRecommendations').mockResolvedValue(autoTracks);

      const store = usePlayerStore.getState();
      await store.playTrack(mockFullTrack);

      expect(usePlayerStore.getState().currentTrack?.id).toBe('full_track_001');
      expect(usePlayerStore.getState().sessionPlayedTrackIds).toContain('full_track_001');

      await new Promise((resolve) => setTimeout(resolve, 60));

      const updated = usePlayerStore.getState();
      expect(updated.queue.length).toBe(3);
      expect(updated.queue.map((t) => t.id)).toEqual(['full_track_001', 'auto_track_1', 'auto_track_2']);
      // Enforces eligible languages
      expect(updated.queue.every((t) => ['Tamil', 'Telugu'].includes(t.language || ''))).toBe(true);
    });

    it('falls back to shuffled catalogue when recommendation engine returns insufficient tracks', async () => {
      // Recommendation API returns empty
      vi.spyOn(recommendationApi, 'getAutoQueueRecommendations').mockResolvedValue([]);

      const catalogueSongs: Track[] = [
        {
          id: 'cat_song_1',
          title: 'Roja Janeman',
          artist: 'A. R. Rahman',
          durationMs: 280000,
          sourcePlatform: 'LOCAL',
          sourceUrl: 'https://cdn.example.com/roja.mp3',
          language: 'Tamil',
          isPlayableDirectly: true,
        },
        {
          id: 'cat_song_2',
          title: 'Butta Bomma',
          artist: 'Thaman S',
          durationMs: 230000,
          sourcePlatform: 'LOCAL',
          sourceUrl: 'https://cdn.example.com/butta.mp3',
          language: 'Telugu',
          isPlayableDirectly: true,
        },
      ];

      vi.spyOn(recommendationApi, 'getBaseFeed').mockResolvedValue({
        recommended: [catalogueSongs[0]],
        trending: [catalogueSongs[1]],
        recentlyAdded: [],
        popularSongs: [],
        allAvailable: catalogueSongs,
      });

      const store = usePlayerStore.getState();
      await store.playTrack(mockFullTrack);

      await new Promise((resolve) => setTimeout(resolve, 60));

      const updated = usePlayerStore.getState();
      expect(updated.queue.length).toBeGreaterThanOrEqual(2);
      expect(updated.queue.map((t) => t.id)).toContain('full_track_001');
    });

    it('advances seamlessly to next song when playNext is called at the end of the queue', async () => {
      const continuationTrack: Track = {
        id: 'continuous_track_99',
        title: 'Endless Symphony',
        artist: 'Harris Jayaraj',
        durationMs: 320000,
        sourcePlatform: 'YOUTUBE',
        sourceUrl: 'https://cdn.example.com/continuous.mp3',
        language: 'Tamil',
        isPlayableDirectly: true,
      };

      vi.spyOn(recommendationApi, 'getAutoQueueRecommendations').mockResolvedValue([continuationTrack]);

      usePlayerStore.setState({
        queue: [mockFullTrack],
        queueIndex: 0,
        currentTrack: mockFullTrack,
        sessionPlayedTrackIds: ['full_track_001'],
      });

      const store = usePlayerStore.getState();
      await store.playNext();

      const state = usePlayerStore.getState();
      expect(state.currentTrack?.id).toBe('continuous_track_99');
      expect(state.isPlaying).toBe(true);
      expect(state.sessionPlayedTrackIds).toContain('continuous_track_99');
    });

    it('supports full queue manipulations: playNextInQueue, addToQueue, reorderQueue, removeFromQueue', () => {
      usePlayerStore.setState({
        queue: [mockFullTrack, mockDownloadedTrack],
        queueIndex: 0,
        currentTrack: mockFullTrack,
      });

      const store = usePlayerStore.getState();

      const nextInsert: Track = {
        id: 'insert_track_x',
        title: 'Priority Next Track',
        artist: 'Ilaiyaraaja',
        durationMs: 270000,
        sourcePlatform: 'LOCAL',
        sourceUrl: 'https://cdn.example.com/priority.mp3',
        language: 'Tamil',
        isPlayableDirectly: true,
      };

      store.playNextInQueue(nextInsert);
      let state = usePlayerStore.getState();
      // Inserted immediately after current song at index 1
      expect(state.queue[1].id).toBe('insert_track_x');
      expect(state.queue[2].id).toBe('downloaded_track_003');

      // Reorder index 1 to index 2
      store.reorderQueue(1, 2);
      state = usePlayerStore.getState();
      expect(state.queue[2].id).toBe('insert_track_x');

      // Remove index 2
      store.removeFromQueue(2);
      state = usePlayerStore.getState();
      expect(state.queue.length).toBe(2);
      expect(state.queue.map((t) => t.id)).toEqual(['full_track_001', 'downloaded_track_003']);
    });
  });
});
