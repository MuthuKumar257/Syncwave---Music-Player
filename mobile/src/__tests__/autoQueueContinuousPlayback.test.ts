import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../api/types';
import { recommendationApi } from '../api/recommendationApi';

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
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const mockTracks: Track[] = [
  {
    id: 'mob_track_1',
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
    id: 'mob_track_2',
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
    id: 'mob_track_3',
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

describe('Mobile Automatic Queue Generation & Continuous Playback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    });
  });

  it('tracks played song in sessionPlayedTrackIds and auto-generates upcoming queue on single song selection', async () => {
    const spy = vi.spyOn(recommendationApi, 'getAutoQueueRecommendations').mockResolvedValue([
      mockTracks[1],
      mockTracks[2],
    ]);

    const store = usePlayerStore.getState();
    await store.playTrack(mockTracks[0]);

    const state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('mob_track_1');
    expect(state.sessionPlayedTrackIds).toContain('mob_track_1');

    // Wait for async auto-queue execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(spy).toHaveBeenCalled();
    const updated = usePlayerStore.getState();
    expect(updated.queue.length).toBe(3);
    expect(updated.queue.map((t) => t.id)).toEqual(['mob_track_1', 'mob_track_2', 'mob_track_3']);

    // Next track matches the first auto-generated song
    const next = updated.getNextTrack();
    expect(next?.id).toBe('mob_track_2');
  });

  it('allows adding to queue, reordering, and removing items', () => {
    usePlayerStore.setState({
      queue: [mockTracks[0], mockTracks[1]],
      queueIndex: 0,
      currentTrack: mockTracks[0],
      sessionPlayedTrackIds: ['mob_track_1'],
    });

    const store = usePlayerStore.getState();
    store.addToQueue(mockTracks[2]);

    let state = usePlayerStore.getState();
    expect(state.queue.length).toBe(3);
    expect(state.queue[2].id).toBe('mob_track_3');

    // Reorder mob_track_3 from index 2 to index 1
    store.reorderQueue(2, 1);
    state = usePlayerStore.getState();
    expect(state.queue[1].id).toBe('mob_track_3');
    expect(state.getNextTrack()?.id).toBe('mob_track_3');

    // Remove index 1
    store.removeFromQueue(1);
    state = usePlayerStore.getState();
    expect(state.queue.length).toBe(2);
    expect(state.queue[1].id).toBe('mob_track_2');
  });

  it('seamlessly fetches more tracks when reaching the end of the queue for continuous playback', async () => {
    const extraTrack: Track = {
      id: 'mob_track_extra',
      title: 'Continuous Track Extra',
      artist: 'A. R. Rahman',
      durationMs: 250000,
      sourcePlatform: 'YOUTUBE',
      sourceUrl: 'https://cdn.example.com/extra.mp3',
      language: 'Tamil',
      isPlayableDirectly: true,
    };

    vi.spyOn(recommendationApi, 'getAutoQueueRecommendations').mockResolvedValue([extraTrack]);

    usePlayerStore.setState({
      queue: [mockTracks[0]],
      queueIndex: 0,
      currentTrack: mockTracks[0],
      sessionPlayedTrackIds: ['mob_track_1'],
    });

    const store = usePlayerStore.getState();
    await store.playNext();

    const state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('mob_track_extra');
    expect(state.sessionPlayedTrackIds).toContain('mob_track_extra');
  });
});
