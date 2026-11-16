import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../api/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

vi.mock('../audio/audioManager', () => ({
  audioManager: {
    playTrack: vi.fn().mockResolvedValue(undefined),
    togglePlayPause: vi.fn().mockResolvedValue(undefined),
    seekTo: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { success: true, preferences: {}, tracks: [], data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { success: true, tracks: [] } }),
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

const mockAsyncStorageStore: Record<string, string> = {};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockAsyncStorageStore[key] || null)),
    setItem: vi.fn((key: string, value: string) => {
      mockAsyncStorageStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockAsyncStorageStore[key];
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(mockAsyncStorageStore).forEach((k) => delete mockAsyncStorageStore[k]);
      return Promise.resolve();
    }),
  },
}));

const mockTracks: Track[] = [
  {
    id: 'mob_track_alpha',
    title: 'Adiye',
    artist: 'A. R. Rahman',
    album: 'Kadal',
    composer: 'A. R. Rahman',
    durationMs: 302000,
    sourcePlatform: 'YOUTUBE',
    sourceUrl: 'https://cdn.example.com/mob1.mp3',
    language: 'Tamil',
    isPlayableDirectly: true,
  },
  {
    id: 'mob_track_beta',
    title: 'Nenjukkul Peidhidum',
    artist: 'Harris Jayaraj',
    album: 'Vaaranam Aayiram',
    composer: 'Harris Jayaraj',
    durationMs: 370000,
    sourcePlatform: 'YOUTUBE',
    sourceUrl: 'https://cdn.example.com/mob2.mp3',
    language: 'Tamil',
    isPlayableDirectly: true,
  },
  {
    id: 'mob_track_gamma',
    title: 'Munbe Vaa',
    artist: 'A. R. Rahman',
    album: 'Sillunu Oru Kaadhal',
    composer: 'A. R. Rahman',
    durationMs: 350000,
    sourcePlatform: 'YOUTUBE',
    sourceUrl: 'https://cdn.example.com/mob3.mp3',
    language: 'Tamil',
    isPlayableDirectly: true,
  },
];

describe('Mobile Playback Session & Queue Restoration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.keys(mockAsyncStorageStore).forEach((k) => delete mockAsyncStorageStore[k]);
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      sessionPlayedTrackIds: [],
      isShuffle: false,
      repeatMode: 'OFF',
      isMiniPlayerVisible: false,
      isRestoringSession: false,
    });
  });

  it('persists session on state changes including queue, position, and reordering', async () => {
    usePlayerStore.setState({
      currentTrack: mockTracks[0],
      isPlaying: false,
      position: 140,
      duration: 302,
      queue: [mockTracks[0], mockTracks[2], mockTracks[1]],
      queueIndex: 0,
      sessionPlayedTrackIds: ['mob_track_alpha'],
      isShuffle: true,
      repeatMode: 'ALL',
      isMiniPlayerVisible: true,
    });

    const store = usePlayerStore.getState();
    store.persistCurrentSession(true);

    await new Promise((r) => setTimeout(r, 20));

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@syncwave_playback_session',
      expect.stringContaining('mob_track_alpha')
    );

    const savedRaw = mockAsyncStorageStore['@syncwave_playback_session'];
    expect(savedRaw).toBeDefined();
    const parsed = JSON.parse(savedRaw);
    expect(parsed.lastPlayedSongId).toBe('mob_track_alpha');
    expect(parsed.positionSec).toBe(140);
    expect(parsed.isShuffle).toBe(true);
    expect(parsed.repeatMode).toBe('ALL');
    expect(parsed.queue[1].id).toBe('mob_track_gamma');
  });

  it('restores session on launch as paused with mini-player and queue ready', async () => {
    const saved = {
      lastPlayedSongId: 'mob_track_alpha',
      currentTrack: mockTracks[0],
      positionSec: 95,
      isPlaying: false,
      queue: [mockTracks[0], mockTracks[2], mockTracks[1]],
      queueIndex: 0,
      sessionPlayedTrackIds: ['mob_track_alpha'],
      isShuffle: true,
      repeatMode: 'ONE',
      savedAt: Date.now(),
    };
    mockAsyncStorageStore['@syncwave_playback_session'] = JSON.stringify(saved);

    const store = usePlayerStore.getState();
    await store.restorePlaybackSession();

    const state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('mob_track_alpha');
    expect(state.position).toBe(95);
    expect(state.isPlaying).toBe(false); // Restored paused
    expect(state.isMiniPlayerVisible).toBe(true); // Mini-player immediately visible
    expect(state.queue.length).toBe(3);
    expect(state.queue[1].id).toBe('mob_track_gamma'); // Preserved reordered queue
    expect(state.sessionPlayedTrackIds).toContain('mob_track_alpha');
    expect(state.isShuffle).toBe(true);
    expect(state.repeatMode).toBe('ONE');
  });

  it('does not overwrite current playing track if playback already active', async () => {
    usePlayerStore.setState({
      currentTrack: mockTracks[1],
      isPlaying: true,
    });

    const store = usePlayerStore.getState();
    await store.restorePlaybackSession();

    expect(usePlayerStore.getState().currentTrack?.id).toBe('mob_track_beta');
  });
});
