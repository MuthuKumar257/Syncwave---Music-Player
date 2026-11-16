import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { Track } from '../api/types';

const mockTrackA: Track = {
  id: 'mob_track_a',
  title: 'Kannazhaga',
  artist: 'Dhanush, Shruti Haasan',
  movieName: '3',
  composer: 'Anirudh Ravichander',
  durationMs: 205000,
  sourcePlatform: 'SPOTIFY',
  sourceUrl: 'https://spotify.com/track/a',
  isPlayableDirectly: true,
  artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
  language: 'Tamil'
};

const mockTrackB: Track = {
  id: 'mob_track_b',
  title: 'Why This Kolaveri Di',
  artist: 'Dhanush',
  movieName: '3',
  composer: 'Anirudh Ravichander',
  durationMs: 245000,
  sourcePlatform: 'SPOTIFY',
  sourceUrl: 'https://spotify.com/track/b',
  isPlayableDirectly: true,
  artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
  language: 'Tamil'
};

const mockTrackC: Track = {
  id: 'mob_track_c',
  title: 'Po Ve Po',
  artist: 'Mohit Chauhan, Anirudh',
  movieName: '3',
  composer: 'Anirudh Ravichander',
  durationMs: 230000,
  sourcePlatform: 'SPOTIFY',
  sourceUrl: 'https://spotify.com/track/c',
  isPlayableDirectly: true,
  artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
  language: 'Tamil'
};

describe('Song Context Menu Actions (Mobile)', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      queue: [mockTrackA, mockTrackC],
      queueIndex: 0,
      currentTrack: mockTrackA,
      isPlaying: true
    });
  });

  it('Play Next: inserts the selected track immediately after currently playing track', () => {
    const { playNextInQueue } = usePlayerStore.getState();
    playNextInQueue(mockTrackB);

    const { queue, queueIndex } = usePlayerStore.getState();
    expect(queue).toHaveLength(3);
    expect(queue[0].id).toBe('mob_track_a');
    expect(queue[1].id).toBe('mob_track_b'); // Inserted as next
    expect(queue[2].id).toBe('mob_track_c');
    expect(queueIndex).toBe(0);
  });

  it('Add to Queue: appends track to the end of the queue', () => {
    const { addToQueue } = usePlayerStore.getState();
    addToQueue(mockTrackB);

    const { queue } = usePlayerStore.getState();
    expect(queue).toHaveLength(3);
    expect(queue[2].id).toBe('mob_track_b');
  });

  it('Start Mix: plays track and generates mix queue', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          recommendations: [mockTrackB, mockTrackC],
          reason: 'Mobile mix recommendations'
        }
      })
    } as any);

    const { startSongMix } = usePlayerStore.getState();
    await startSongMix(mockTrackA);

    const { currentTrack, isPlaying } = usePlayerStore.getState();
    expect(currentTrack?.id).toBe('mob_track_a');
    expect(isPlaying).toBe(true);
  });

  it('Save to Playlist: creates playlist and adds track via useLibraryStore', async () => {
    const { createPlaylist, addTrackToPlaylist, removeTrackFromPlaylist, isInPlaylist } =
      useLibraryStore.getState();

    const pl = await createPlaylist('Roadtrip Anthems');
    expect(pl.name).toBe('Roadtrip Anthems');

    const added = await addTrackToPlaylist(pl.id, mockTrackA);
    expect(added).toBe(true);
    expect(isInPlaylist(pl.id, mockTrackA.id)).toBe(true);

    // Try adding duplicate
    const duplicate = await addTrackToPlaylist(pl.id, mockTrackA);
    expect(duplicate).toBe(false);

    // Remove from playlist
    await removeTrackFromPlaylist(pl.id, mockTrackA.id);
    expect(isInPlaylist(pl.id, mockTrackA.id)).toBe(false);
  });

  it('Toggle Favorite: toggles favorite status correctly in useLibraryStore', async () => {
    const { toggleFavorite, isFavorite } = useLibraryStore.getState();

    const isFavNow = await toggleFavorite(mockTrackA);
    expect(isFavNow).toBe(true);
    expect(isFavorite(mockTrackA.id)).toBe(true);

    const isFavAfter = await toggleFavorite(mockTrackA);
    expect(isFavAfter).toBe(false);
    expect(isFavorite(mockTrackA.id)).toBe(false);
  });

  it('Context-aware Remove from Queue: removes track from queue', () => {
    const { removeFromQueue } = usePlayerStore.getState();
    removeFromQueue(1);

    const { queue } = usePlayerStore.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe('mob_track_a');
  });
});
