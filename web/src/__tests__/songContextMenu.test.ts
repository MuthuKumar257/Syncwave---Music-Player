import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
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

vi.mock('../db/indexedDb', () => ({
  localDb: {
    savePlaylist: vi.fn().mockResolvedValue(undefined),
    getAllPlaylists: vi.fn().mockResolvedValue([]),
    getPlaylist: vi.fn().mockResolvedValue(undefined),
    deletePlaylist: vi.fn().mockResolvedValue(undefined),
    getAllSongs: vi.fn().mockResolvedValue([]),
    getAllFavorites: vi.fn().mockResolvedValue([])
  }
}));

const mockSongA: Song = {
  id: 'song_a',
  title: 'Song Alpha',
  artist: 'Artist One',
  album: 'Album One',
  durationMs: 200000,
  uri: 'https://example.com/a.mp3',
  source: 'YOUTUBE',
  createdAt: new Date().toISOString()
};

const mockSongB: Song = {
  id: 'song_b',
  title: 'Song Beta',
  artist: 'Artist Two',
  album: 'Album Two',
  durationMs: 220000,
  uri: 'https://example.com/b.mp3',
  source: 'YOUTUBE',
  createdAt: new Date().toISOString()
};

const mockSongC: Song = {
  id: 'song_c',
  title: 'Song Gamma',
  artist: 'Artist Three',
  album: 'Album Three',
  durationMs: 180000,
  uri: 'https://example.com/c.mp3',
  source: 'YOUTUBE',
  createdAt: new Date().toISOString()
};

describe('Song Context Menu Actions (Web)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePlayerStore.setState({
      queue: [mockSongA, mockSongC],
      queueIndex: 0,
      currentSong: mockSongA,
      isPlaying: true
    });
  });

  it('Play Next: inserts the selected song immediately after currently playing song', () => {
    const { playNextInQueue } = usePlayerStore.getState();
    playNextInQueue(mockSongB);

    const { queue, queueIndex } = usePlayerStore.getState();
    expect(queue).toHaveLength(3);
    expect(queue[0].id).toBe('song_a');
    expect(queue[1].id).toBe('song_b'); // Inserted as next
    expect(queue[2].id).toBe('song_c');
    expect(queueIndex).toBe(0);
  });

  it('Add to Queue: appends song to the end of the queue', () => {
    const { addToQueue } = usePlayerStore.getState();
    addToQueue(mockSongB);

    const { queue } = usePlayerStore.getState();
    expect(queue).toHaveLength(3);
    expect(queue[2].id).toBe('song_b'); // Appended at the end
  });

  it('Start Mix: starts playback of selected song and triggers mix generation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          recommendations: [mockSongB, mockSongC],
          reason: 'Auto mix recommendations',
          metrics: { discoveredCount: 2, duplicatesFiltered: 0, addedCount: 2 }
        }
      })
    } as any);

    const { startSongMix } = usePlayerStore.getState();
    await startSongMix(mockSongA);

    const { currentSong, isPlaying } = usePlayerStore.getState();
    expect(currentSong?.id).toBe('song_a');
    expect(isPlaying).toBe(true);
  });

  it('Save to Playlist: updates playlist song list in store', async () => {
    const initialPlaylist = {
      id: 'test_pl_1',
      name: 'Weekend Chill',
      songIds: [],
      songCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    useLibraryStore.setState({
      playlists: [initialPlaylist]
    });

    vi.spyOn(useLibraryStore.getState(), 'loadLibrary').mockImplementation(async () => {});

    await useLibraryStore.getState().addSongToPlaylist('test_pl_1', mockSongA.id);

    const pl = useLibraryStore.getState().playlists.find((p) => p.id === 'test_pl_1');
    expect(pl?.songIds).toContain(mockSongA.id);
  });

  it('Context-aware Remove from Queue: removes track from queue without deleting audio file', () => {
    const { removeFromQueue } = usePlayerStore.getState();
    removeFromQueue(1); // Remove mockSongC

    const { queue } = usePlayerStore.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe('song_a');
  });
});
