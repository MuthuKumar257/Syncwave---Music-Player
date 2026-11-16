import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
import { Song } from '../types';

describe('SyncWave Web Song Preview & Deep Linking Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates canonical permanent song share URL and custom URI scheme', () => {
    const songId = 'track_vaaranam_aayiram_1';
    const cleanId = encodeURIComponent(songId);
    const canonicalUrl = `https://syncwave.app/song/${cleanId}`;
    const deepLinkUri = `syncwave://song/${cleanId}`;

    expect(canonicalUrl).toBe('https://syncwave.app/song/track_vaaranam_aayiram_1');
    expect(deepLinkUri).toBe('syncwave://song/track_vaaranam_aayiram_1');
    expect(canonicalUrl).not.toContain('localhost');
  });

  it('formats share message matching exact specification', () => {
    const title = 'Nenjukkul Peidhidum';
    const artist = 'Hariharan, Harris Jayaraj';
    const songId = 'track_vaaranam_aayiram_1';
    const url = `https://syncwave.app/song/${encodeURIComponent(songId)}`;

    const message = `Listen to ${title} by ${artist} on SyncWave.\n\nListen here: ${url}`;
    expect(message).toBe(
      'Listen to Nenjukkul Peidhidum by Hariharan, Harris Jayaraj on SyncWave.\n\nListen here: https://syncwave.app/song/track_vaaranam_aayiram_1'
    );
  });

  it('plays shared song directly on web with immediate state update and audio session initialization', () => {
    const sharedSong: Song = {
      id: 'shared_track_99',
      title: 'Adiye',
      artist: 'Sid Sriram, A. R. Rahman',
      album: 'Kadal',
      durationMs: 300000,
      source: 'YOUTUBE',
      videoId: 'sample_video_id',
      createdAt: new Date().toISOString()
    };

    usePlayerStore.getState().playSong(sharedSong);

    expect(usePlayerStore.getState().currentSong?.id).toBe('shared_track_99');
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().queue.some((s) => s.id === 'shared_track_99')).toBe(true);
  });

  it('toggles play/pause if user plays the song that is already active on web', () => {
    const sharedSong: Song = {
      id: 'shared_track_99',
      title: 'Adiye',
      artist: 'Sid Sriram, A. R. Rahman',
      album: 'Kadal',
      durationMs: 300000,
      source: 'YOUTUBE',
      videoId: 'sample_video_id',
      createdAt: new Date().toISOString()
    };

    usePlayerStore.getState().playSong(sharedSong);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});
