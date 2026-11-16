import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../src/store/usePlayerStore';
import { Track } from '../src/api/types';

// Mock audioManager
vi.mock('../src/audio/audioManager', () => ({
  audioManager: {
    playTrack: vi.fn().mockResolvedValue(undefined),
    togglePlayPause: vi.fn().mockResolvedValue(undefined),
    seekTo: vi.fn().mockResolvedValue(undefined)
  }
}));

const mockTracks: Track[] = [
  {
    id: 'track_1',
    title: 'Nenjukkul Peidhidum',
    artist: 'Harris Jayaraj, Hariharan',
    movieName: 'Vaaranam Aayiram',
    album: 'Vaaranam Aayiram',
    durationMs: 370000,
    sourcePlatform: 'YOUTUBE',
    sourceUrl: 'https://youtube.com/watch?v=1',
    isPlayableDirectly: true,
    artworkUrl: '',
    language: 'Tamil'
  },
  {
    id: 'track_2',
    title: 'Adiye',
    artist: 'A. R. Rahman, Sid Sriram',
    movieName: 'Kadal',
    album: 'Kadal',
    durationMs: 302000,
    sourcePlatform: 'SPOTIFY',
    sourceUrl: 'https://spotify.com/track/2',
    isPlayableDirectly: true,
    artworkUrl: '',
    language: 'Tamil'
  },
  {
    id: 'track_3',
    title: 'Kesariya',
    artist: 'Pritam, Arijit Singh',
    movieName: 'Brahmastra',
    album: 'Brahmastra',
    durationMs: 268000,
    sourcePlatform: 'YOUTUBE',
    sourceUrl: 'https://youtube.com/watch?v=3',
    isPlayableDirectly: true,
    artworkUrl: '',
    language: 'Hindi'
  }
];

describe('usePlayerStore - Playback & Queue State Machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      isShuffle: false,
      repeatMode: 'OFF',
      isMiniPlayerVisible: false
    });
  });

  it('plays a track and updates queue index and mini player visibility', async () => {
    const store = usePlayerStore.getState();
    await store.playTrack(mockTracks[1], mockTracks);

    const state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('track_2');
    expect(state.queueIndex).toBe(1);
    expect(state.isPlaying).toBe(true);
    expect(state.isMiniPlayerVisible).toBe(true);
    expect(state.queue.length).toBe(3);
  });

  it('toggles play/pause state properly', async () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({ isPlaying: true });

    await store.togglePlayPause();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    await store.togglePlayPause();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('advances to next track in queue and respects repeatMode ALL', async () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      queue: mockTracks,
      queueIndex: 0,
      currentTrack: mockTracks[0],
      repeatMode: 'OFF'
    });

    // Advance 0 -> 1
    await store.playNext();
    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().currentTrack?.id).toBe('track_2');

    // Advance 1 -> 2 (last track)
    await store.playNext();
    expect(usePlayerStore.getState().queueIndex).toBe(2);
    expect(usePlayerStore.getState().currentTrack?.id).toBe('track_3');

    // Advance beyond end with repeatMode OFF does not loop
    await store.playNext();
    expect(usePlayerStore.getState().queueIndex).toBe(2);

    // Turn repeatMode ALL on -> loops back to 0
    usePlayerStore.setState({ repeatMode: 'ALL' });
    await store.playNext();
    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(usePlayerStore.getState().currentTrack?.id).toBe('track_1');
  });

  it('handles playPrevious (seeking to 0 when >3s vs jumping to previous track)', async () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      queue: mockTracks,
      queueIndex: 1,
      currentTrack: mockTracks[1],
      position: 15
    });

    // When position > 3s, rewinds to 0 of current song
    await store.playPrevious();
    expect(usePlayerStore.getState().position).toBe(0);
    expect(usePlayerStore.getState().queueIndex).toBe(1);

    // When position <= 3s, moves to index 0
    await store.playPrevious();
    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(usePlayerStore.getState().currentTrack?.id).toBe('track_1');
  });

  it('cycles repeat mode: OFF -> ALL -> ONE -> OFF', () => {
    const store = usePlayerStore.getState();
    expect(store.repeatMode).toBe('OFF');

    store.toggleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe('ALL');

    store.toggleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe('ONE');

    store.toggleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe('OFF');
  });

  it('toggles shuffle mode state', () => {
    const store = usePlayerStore.getState();
    expect(store.isShuffle).toBe(false);

    store.toggleShuffle();
    expect(usePlayerStore.getState().isShuffle).toBe(true);

    store.toggleShuffle();
    expect(usePlayerStore.getState().isShuffle).toBe(false);
  });

  it('plays a track at a specific index immediately', async () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      queue: mockTracks,
      queueIndex: 0,
      currentTrack: mockTracks[0]
    });

    await store.playTrackAt(2);
    const state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('track_3');
    expect(state.queueIndex).toBe(2);
    expect(state.isPlaying).toBe(true);
  });

  it('removes track from queue and adjusts queueIndex accordingly', () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      queue: [...mockTracks],
      queueIndex: 2,
      currentTrack: mockTracks[2]
    });

    // Remove track before current index (index 0)
    store.removeFromQueue(0);
    let state = usePlayerStore.getState();
    expect(state.queue.length).toBe(2);
    expect(state.queueIndex).toBe(1);
    expect(state.queue[1].id).toBe('track_3');

    // Remove track at current index
    store.removeFromQueue(1);
    state = usePlayerStore.getState();
    expect(state.queue.length).toBe(1);
    expect(state.queueIndex).toBe(0);
  });

  it('reorders queue tracks correctly and updates queueIndex', () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      queue: [...mockTracks],
      queueIndex: 0,
      currentTrack: mockTracks[0]
    });

    // Move track 0 to position 2
    store.reorderQueue(0, 2);
    let state = usePlayerStore.getState();
    expect(state.queue[2].id).toBe('track_1');
    expect(state.queueIndex).toBe(2);

    // Move track 2 back to position 1
    store.reorderQueue(2, 1);
    state = usePlayerStore.getState();
    expect(state.queue[1].id).toBe('track_1');
    expect(state.queueIndex).toBe(1);
  });

  it('clears queue keeping only the currently playing song', () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      queue: [...mockTracks],
      queueIndex: 1,
      currentTrack: mockTracks[1]
    });

    store.clearQueue();
    const state = usePlayerStore.getState();
    expect(state.queue.length).toBe(1);
    expect(state.queue[0].id).toBe('track_2');
    expect(state.queueIndex).toBe(0);
  });

  it('computes next upcoming track accurately', () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      queue: mockTracks,
      queueIndex: 0,
      currentTrack: mockTracks[0],
      repeatMode: 'OFF',
      isShuffle: false
    });

    expect(store.getNextTrack()?.id).toBe('track_2');

    // Repeat one returns current track
    usePlayerStore.setState({ repeatMode: 'ONE' });
    expect(store.getNextTrack()?.id).toBe('track_1');
  });
});
