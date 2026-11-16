import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
import { indexedDb } from '../db/indexedDb';
import { Song } from '../types';

vi.mock('../audio/WebAudioPlayer', () => ({
  webAudioPlayer: {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    subscribe: vi.fn(),
    setTrackEndedCallback: vi.fn(),
    unlockAudio: vi.fn(),
    hasActiveAudio: vi.fn().mockReturnValue(false)
  }
}));

const mockSongs: Song[] = [
  {
    id: 'song_alpha',
    title: 'Nenjukkul Peidhidum',
    artist: 'Harris Jayaraj, Hariharan',
    album: 'Vaaranam Aayiram',
    durationMs: 370000,
    uri: 'https://cdn.example.com/audio1.mp3',
    source: 'OPEN_AUDIO',
    language: 'Tamil',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'song_beta',
    title: 'Adiye',
    artist: 'A. R. Rahman, Sid Sriram',
    album: 'Kadal',
    durationMs: 302000,
    uri: 'https://cdn.example.com/audio2.mp3',
    source: 'OPEN_AUDIO',
    language: 'Tamil',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'song_gamma',
    title: 'Munbe Vaa',
    artist: 'A. R. Rahman, Shreya Ghoshal',
    album: 'Sillunu Oru Kaadhal',
    durationMs: 350000,
    uri: 'https://cdn.example.com/audio3.mp3',
    source: 'OPEN_AUDIO',
    language: 'Tamil',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

(global as any).localStorage = mockLocalStorage;

describe('Persistent Playback Session & Queue Restoration (Web)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage.clear();
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      sessionPlayedSongIds: [],
      isShuffle: false,
      repeatMode: 'OFF',
      isRestoringSession: false
    });
  });

  it('persists playback session with queue, reordered order, and position', async () => {
    const setMetaSpy = vi.spyOn(indexedDb, 'setMeta').mockResolvedValue(undefined);

    usePlayerStore.setState({
      currentSong: mockSongs[0],
      isPlaying: false,
      currentTime: 125,
      duration: 370,
      queue: [mockSongs[0], mockSongs[2], mockSongs[1]], // Reordered
      queueIndex: 0,
      sessionPlayedSongIds: ['song_alpha'],
      isShuffle: true,
      repeatMode: 'ALL'
    });

    const store = usePlayerStore.getState();
    store.persistCurrentSession(true);

    // Wait microtask tick for async storage
    await new Promise((r) => setTimeout(r, 20));

    expect(setMetaSpy).toHaveBeenCalledWith('playback_session', expect.objectContaining({
      lastPlayedSongId: 'song_alpha',
      playbackPositionSec: 125,
      isShuffle: true,
      repeatMode: 'ALL',
      queue: expect.arrayContaining([expect.objectContaining({ id: 'song_gamma' })])
    }));

    // Verify localStorage fallback also written
    const stored = localStorage.getItem('syncwave_playback_session');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.lastPlayedSongId).toBe('song_alpha');
    expect(parsed.playbackPositionSec).toBe(125);
    expect(parsed.queue[1].id).toBe('song_gamma');
  });

  it('restores previous session on app launch as paused with exact queue and position', async () => {
    const savedSession = {
      lastPlayedSongId: 'song_alpha',
      currentSong: mockSongs[0],
      playbackPositionSec: 85,
      isPlaying: false,
      queue: [mockSongs[0], mockSongs[2], mockSongs[1]], // Gamma before Beta
      queueIndex: 0,
      sessionPlayedSongIds: ['song_alpha'],
      isShuffle: false,
      repeatMode: 'OFF',
      volume: 0.9,
      savedAt: Date.now()
    };

    vi.spyOn(indexedDb, 'getMeta').mockResolvedValue(savedSession);

    const store = usePlayerStore.getState();
    await store.restorePlaybackSession();

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_alpha');
    expect(state.currentTime).toBe(85);
    expect(state.isPlaying).toBe(false); // Restored as paused per browser autoplay policy
    expect(state.queue.length).toBe(3);
    expect(state.queue[1].id).toBe('song_gamma'); // Preserves exact reordered queue
    expect(state.sessionPlayedSongIds).toContain('song_alpha');

    // Up Next correctly shows the next song (song_gamma)
    const next = state.getNextSong();
    expect(next?.id).toBe('song_gamma');
  });

  it('does not overwrite active playback if current song already playing', async () => {
    usePlayerStore.setState({
      currentSong: mockSongs[1],
      isPlaying: true
    });

    const getMetaSpy = vi.spyOn(indexedDb, 'getMeta');
    const store = usePlayerStore.getState();
    await store.restorePlaybackSession();

    expect(getMetaSpy).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_beta');
  });
});
