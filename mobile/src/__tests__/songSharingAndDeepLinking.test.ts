import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSongShareUrl, getSongShareMessage, shareSong, APP_DOMAIN, APP_NAME } from '../utils/shareUtils';
import { linking } from '../navigation/linking';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../api/types';

describe('SyncWave Mobile Song Sharing and Deep Linking Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Share URL Generation
  it('generates canonical share URL using permanent song ID without local paths', () => {
    const songId = 'track_vaaranam_aayiram_1';
    const url = getSongShareUrl(songId);
    expect(url).toBe('https://syncwave.app/song/track_vaaranam_aayiram_1');
    expect(url).not.toContain('localhost');
    expect(url).not.toContain('file://');
    expect(url).not.toContain('C:');
  });

  it('safely encodes special characters in song IDs', () => {
    const songId = 'song with spaces&special#chars';
    const url = getSongShareUrl(songId);
    expect(url).toBe(`https://syncwave.app/song/${encodeURIComponent('song with spaces&special#chars')}`);
  });

  // 2. Share Message Template
  it('formats share message matching exact specification', () => {
    const message = getSongShareMessage('Nenjukkul Peidhidum', 'Hariharan, Harris Jayaraj', 'track_1');
    expect(message).toBe(
      'Listen to Nenjukkul Peidhidum by Hariharan, Harris Jayaraj on SyncWave.\n\nListen here: https://syncwave.app/song/track_1'
    );
  });

  // 3. React Navigation Linking Configuration
  it('linking configuration supports HTTPS production domains, WWW and custom syncwave:// scheme', () => {
    expect(linking.prefixes).toContain('https://syncwave.app');
    expect(linking.prefixes).toContain('https://www.syncwave.app');
    expect(linking.prefixes).toContain('syncwave://');

    const screens: any = linking.config?.screens;
    expect(screens).toBeDefined();
    expect(screens.SongDetail.path).toBe('song/:songId');
    expect(screens.MainTabs.screens.SearchTab.path).toBe('artist/:artistId');
    expect(screens.MainTabs.screens.LibraryTab.path).toBe('playlist/:playlistId');
  });

  // 4. Playing a shared track while another track is already playing
  it('switching playback to a deep-linked track transitions smoothly', () => {
    const initialTrack: Track = {
      id: 'current_song_100',
      title: 'Current Playing Song',
      artist: 'Artist A',
      durationMs: 200000,
      sourcePlatform: 'YOUTUBE',
      sourceUrl: 'https://youtube.com/watch?v=123',
      isPlayableDirectly: true
    };

    const sharedTrack: Track = {
      id: 'deep_linked_song_200',
      title: 'Deep Linked Track',
      artist: 'Artist B',
      durationMs: 240000,
      sourcePlatform: 'YOUTUBE',
      sourceUrl: 'https://youtube.com/watch?v=456',
      isPlayableDirectly: true
    };

    usePlayerStore.setState({
      currentTrack: initialTrack,
      isPlaying: true,
      queue: [initialTrack],
      queueIndex: 0
    });

    expect(usePlayerStore.getState().currentTrack?.id).toBe('current_song_100');

    // Simulate playing the shared track
    usePlayerStore.getState().playTrack(sharedTrack);

    expect(usePlayerStore.getState().currentTrack?.id).toBe('deep_linked_song_200');
    expect(usePlayerStore.getState().currentTrack?.title).toBe('Deep Linked Track');
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});
