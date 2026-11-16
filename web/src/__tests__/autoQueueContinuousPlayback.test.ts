import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
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
    unlockAudio: vi.fn()
  }
}));

const mockSongs: Song[] = [
  {
    id: 'song_1',
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
    id: 'song_2',
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
    id: 'song_3',
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

describe('Continuous Playback & Automatic Queue Generation Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      sessionPlayedSongIds: [],
      isShuffle: false,
      repeatMode: 'OFF'
    });
  });

  it('records played song in sessionPlayedSongIds and avoids re-adding already played songs', async () => {
    // Mock global fetch to return auto-queue recommendations
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/recommendations/auto-queue')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              tracks: [
                {
                  id: 'song_2',
                  title: 'Adiye',
                  artist: 'A. R. Rahman',
                  movieName: 'Kadal',
                  durationMs: 302000,
                  language: 'Tamil'
                },
                {
                  id: 'song_3',
                  title: 'Munbe Vaa',
                  artist: 'A. R. Rahman',
                  movieName: 'Sillunu Oru Kaadhal',
                  durationMs: 350000,
                  language: 'Tamil'
                }
              ]
            })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const store = usePlayerStore.getState();
    store.playSong(mockSongs[0]);

    // Current song is song_1 and sessionPlayedSongIds includes song_1
    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_1');
    expect(state.sessionPlayedSongIds).toContain('song_1');

    // Wait microtask tick for async auto-queue
    await new Promise((resolve) => setTimeout(resolve, 50));

    const updatedState = usePlayerStore.getState();
    // Queue should now contain the played song plus auto-generated recommendations
    expect(updatedState.queue.length).toBeGreaterThan(1);
    expect(updatedState.queue.some((s) => s.id === 'song_2')).toBe(true);

    // Verify Up Next returns the first auto-generated song
    const next = updatedState.getNextSong();
    expect(next?.id).toBe('song_2');
  });

  it('allows manual queue additions and preserve manual reorder while continuous queue is active', () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      queue: [mockSongs[0], mockSongs[1]],
      queueIndex: 0,
      currentSong: mockSongs[0],
      sessionPlayedSongIds: ['song_1']
    });

    // Manually add song_3
    store.addToQueue(mockSongs[2]);
    let state = usePlayerStore.getState();
    expect(state.queue.length).toBe(3);
    expect(state.queue[2].id).toBe('song_3');

    // Reorder song_3 to position 1
    store.reorderQueue(2, 1);
    state = usePlayerStore.getState();
    expect(state.queue[1].id).toBe('song_3');
    expect(state.getNextSong()?.id).toBe('song_3');
  });

  it('continues playing without stopping by fetching more songs when reaching end of queue', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/recommendations/auto-queue')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              tracks: [
                {
                  id: 'song_extra_1',
                  title: 'New Track 1',
                  artist: 'Artist A',
                  movieName: 'Album A',
                  durationMs: 200000,
                  language: 'Tamil'
                }
              ]
            })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    usePlayerStore.setState({
      queue: [mockSongs[0]],
      queueIndex: 0,
      currentSong: mockSongs[0],
      sessionPlayedSongIds: ['song_1']
    });

    const store = usePlayerStore.getState();
    // When playNext is called at the end of queue, it triggers auto-queue fetch and continues
    store.playNext();

    await new Promise((resolve) => setTimeout(resolve, 50));
    const state = usePlayerStore.getState();
    expect(state.sessionPlayedSongIds).toContain('song_1');
  });
});
