import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { DownloadManager } from '../services/downloadManager';
import { Track } from '../api/types';

const trackA: Track = {
  id: 'track_A',
  title: 'Song A',
  artist: 'Artist A',
  album: 'Album A',
  durationMs: 200000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=A',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/artA.jpg',
  language: 'Tamil'
};

const trackB: Track = {
  id: 'track_B',
  title: 'Song B',
  artist: 'Artist B',
  album: 'Album B',
  durationMs: 180000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=B',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/artB.jpg',
  language: 'Tamil'
};

const trackC: Track = {
  id: 'track_C',
  title: 'Song C',
  artist: 'Artist C',
  album: 'Album C',
  durationMs: 240000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=C',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/artC.jpg',
  language: 'Tamil'
};

const trackD: Track = {
  id: 'track_D',
  title: 'Song D',
  artist: 'Artist D',
  album: 'Album D',
  durationMs: 210000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=D',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/artD.jpg',
  language: 'Tamil'
};

const trackE: Track = {
  id: 'track_E',
  title: 'Song E',
  artist: 'Artist E',
  album: 'Album E',
  durationMs: 195000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=E',
  isPlayableDirectly: true,
  artworkUrl: 'https://example.com/artE.jpg',
  language: 'Tamil'
};

describe('Comprehensive Queue, Favorites, Playlists & Downloads Verification Suite', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();

    usePlayerStore.setState({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      sessionPlayedTrackIds: []
    });

    useLibraryStore.setState({
      favorites: [],
      favoriteTracks: [],
      playlists: [],
      currentUserId: null
    });

    useDownloadStore.setState({
      downloadedTracks: [],
      downloadProgress: {},
      downloadStatus: {},
      downloadErrors: {},
      failedTracks: {}
    });
  });

  // 1. Play Next – Queue Priority
  describe('1. Play Next – Queue Priority', () => {
    it('inserts song immediately after currently playing song: [A (playing), B, C] + Play Next D => [A, D, B, C]', () => {
      // Set initial queue: A (playing), B, C
      usePlayerStore.setState({
        currentTrack: trackA,
        queue: [trackA, trackB, trackC],
        queueIndex: 0,
        isPlaying: true
      });

      const { playNextInQueue } = usePlayerStore.getState();
      playNextInQueue(trackD);

      const state = usePlayerStore.getState();
      expect(state.currentTrack?.id).toBe('track_A');
      expect(state.queueIndex).toBe(0);
      expect(state.queue.map((t) => t.id)).toEqual(['track_A', 'track_D', 'track_B', 'track_C']);
    });

    it('predictably handles multiple Play Next insertions', () => {
      usePlayerStore.setState({
        currentTrack: trackA,
        queue: [trackA, trackB, trackC],
        queueIndex: 0,
        isPlaying: true
      });

      const { playNextInQueue } = usePlayerStore.getState();
      playNextInQueue(trackD);
      playNextInQueue(trackE);

      const state = usePlayerStore.getState();
      // Most recent Play Next becomes the immediate next track
      expect(state.queue.map((t) => t.id)).toEqual(['track_A', 'track_E', 'track_D', 'track_B', 'track_C']);
    });

    it('prevents duplicate queue entries when using Play Next', () => {
      usePlayerStore.setState({
        currentTrack: trackA,
        queue: [trackA, trackB, trackC],
        queueIndex: 0,
        isPlaying: true
      });

      // Play Next for trackC which is already in the queue at index 2
      const { playNextInQueue } = usePlayerStore.getState();
      playNextInQueue(trackC);

      const state = usePlayerStore.getState();
      // trackC should move from index 2 to index 1 (immediately after A) without duplicating
      expect(state.queue.map((t) => t.id)).toEqual(['track_A', 'track_C', 'track_B']);
      expect(state.queue.filter((t) => t.id === 'track_C').length).toBe(1);
    });

    it('does not replace the currently playing song', () => {
      usePlayerStore.setState({
        currentTrack: trackA,
        queue: [trackA, trackB],
        queueIndex: 0,
        isPlaying: true
      });

      usePlayerStore.getState().playNextInQueue(trackD);
      const state = usePlayerStore.getState();
      expect(state.currentTrack?.id).toBe('track_A');
      expect(state.isPlaying).toBe(true);
    });
  });

  // 2. Add to Queue – Add to Last
  describe('2. Add to Queue – Add to Last', () => {
    it('appends song strictly to end of queue: [A, B, C] + Add to Queue D => [A, B, C, D]', () => {
      usePlayerStore.setState({
        currentTrack: trackA,
        queue: [trackA, trackB, trackC],
        queueIndex: 0,
        isPlaying: true
      });

      const { addToQueue } = usePlayerStore.getState();
      addToQueue(trackD);

      const state = usePlayerStore.getState();
      expect(state.queue.map((t) => t.id)).toEqual(['track_A', 'track_B', 'track_C', 'track_D']);
      expect(state.currentTrack?.id).toBe('track_A');
      expect(state.queueIndex).toBe(0);
    });

    it('never inserts immediately after currently playing song when queue has other tracks', () => {
      usePlayerStore.setState({
        currentTrack: trackA,
        queue: [trackA, trackB, trackC],
        queueIndex: 0,
        isPlaying: true
      });

      usePlayerStore.getState().addToQueue(trackD);
      const state = usePlayerStore.getState();
      expect(state.queue[1].id).toBe('track_B'); // NOT track_D
      expect(state.queue[state.queue.length - 1].id).toBe('track_D');
    });

    it('addTracksToQueue appends an entire list of tracks to the end of the queue', () => {
      usePlayerStore.setState({
        currentTrack: trackA,
        queue: [trackA, trackB],
        queueIndex: 0,
        isPlaying: true
      });

      usePlayerStore.getState().addTracksToQueue([trackC, trackD, trackE]);
      const state = usePlayerStore.getState();
      expect(state.queue.map((t) => t.id)).toEqual([
        'track_A',
        'track_B',
        'track_C',
        'track_D',
        'track_E'
      ]);
    });
  });

  // 3. Favourite Songs – Fix Not Showing & User Isolation
  describe('3. Favourite Songs – Fix Not Showing & User Isolation', () => {
    it('saves favorites, sorts recently favorited first, and persists metadata', async () => {
      const store = useLibraryStore.getState();
      await store.initialize('user_101');

      await store.toggleFavorite(trackA);
      await store.toggleFavorite(trackB);

      const state = useLibraryStore.getState();
      expect(state.isFavorite('track_A')).toBe(true);
      expect(state.isFavorite('track_B')).toBe(true);

      // Most recently favorited trackB should be first
      expect(state.favoriteTracks[0].id).toBe('track_B');
      expect(state.favoriteTracks[1].id).toBe('track_A');
      expect(state.favoriteTracks[0].artworkUrl).toBe(trackB.artworkUrl);
      expect(state.favoriteTracks[0].durationMs).toBe(trackB.durationMs);
    });

    it('strictly isolates user favourites when switching accounts', async () => {
      const store = useLibraryStore.getState();

      // User 1 logs in and favorites trackA
      await store.switchUser('user_alice');
      await store.toggleFavorite(trackA);
      expect(useLibraryStore.getState().isFavorite('track_A')).toBe(true);
      expect(useLibraryStore.getState().favoriteTracks.length).toBe(1);

      // User 2 logs in: User 1's favorites must NOT be visible
      await store.switchUser('user_bob');
      expect(useLibraryStore.getState().isFavorite('track_A')).toBe(false);
      expect(useLibraryStore.getState().favoriteTracks.length).toBe(0);

      // User 2 favorites trackB
      await store.toggleFavorite(trackB);
      expect(useLibraryStore.getState().isFavorite('track_B')).toBe(true);
      expect(useLibraryStore.getState().favoriteTracks.length).toBe(1);

      // User 1 logs back in: User 1's favorites are restored, User 2's are not shown
      await store.switchUser('user_alice');
      expect(useLibraryStore.getState().isFavorite('track_A')).toBe(true);
      expect(useLibraryStore.getState().isFavorite('track_B')).toBe(false);
    });
  });

  // 4. Playlist – View, Edit, Reorder & Queue
  describe('4. Playlist – View, Edit, Reorder & Queue', () => {
    it('creates, edits metadata, adds songs, removes songs, and reorders songs', async () => {
      const store = useLibraryStore.getState();
      await store.initialize('user_test');

      // 1. Create playlist
      const pl = await store.createPlaylist('Night Drive', 'Late night relaxing music', '', [trackA]);
      expect(pl.name).toBe('Night Drive');
      expect(pl.tracks.length).toBe(1);
      expect(pl.tracks[0].id).toBe('track_A');

      // 2. Add songs (prevent duplicate)
      const addedB = await store.addTrackToPlaylist(pl.id, trackB);
      expect(addedB).toBe(true);
      const addedBRepeat = await store.addTrackToPlaylist(pl.id, trackB);
      expect(addedBRepeat).toBe(false);

      const addedC = await store.addTrackToPlaylist(pl.id, trackC);
      expect(addedC).toBe(true);

      let currentPl = useLibraryStore.getState().getPlaylistById(pl.id);
      expect(currentPl?.tracks.map((t) => t.id)).toEqual(['track_A', 'track_B', 'track_C']);

      // 3. Reorder tracks: Move trackC (index 2) to index 0
      await store.reorderPlaylistTracks(pl.id, 2, 0);
      currentPl = useLibraryStore.getState().getPlaylistById(pl.id);
      expect(currentPl?.tracks.map((t) => t.id)).toEqual(['track_C', 'track_A', 'track_B']);

      // 4. Update metadata: Rename and change description
      await store.updatePlaylist(pl.id, {
        name: 'Midnight Cruising',
        description: 'Updated cruise vibes'
      });
      currentPl = useLibraryStore.getState().getPlaylistById(pl.id);
      expect(currentPl?.name).toBe('Midnight Cruising');
      expect(currentPl?.description).toBe('Updated cruise vibes');

      // 5. Remove song
      await store.removeTrackFromPlaylist(pl.id, 'track_A');
      currentPl = useLibraryStore.getState().getPlaylistById(pl.id);
      expect(currentPl?.tracks.map((t) => t.id)).toEqual(['track_C', 'track_B']);

      // 6. Add all songs from playlist to queue
      usePlayerStore.setState({
        currentTrack: trackD,
        queue: [trackD],
        queueIndex: 0
      });
      usePlayerStore.getState().addTracksToQueue(currentPl!.tracks);
      const playerState = usePlayerStore.getState();
      expect(playerState.queue.map((t) => t.id)).toEqual(['track_D', 'track_C', 'track_B']);
    });
  });

  // 5. Download – Validation, Progress, Offline Storage & Deletion
  describe('5. Download – Validation, Progress, Offline Storage & Deletion', () => {
    it('rejects preview clips under 45s or with preview URLs', async () => {
      const previewTrack: Track = {
        id: 'preview_1',
        title: 'Preview Song',
        artist: 'Artist P',
        durationMs: 30000, // 30s sample
        sourcePlatform: 'SPOTIFY',
        sourceUrl: 'https://p.scdn.co/mp3-preview/sample.mp3',
        isPlayableDirectly: true
      };

      const result = await DownloadManager.validateDownload(previewTrack);
      expect(result.canDownload).toBe(false);
      expect(result.reason).toContain('Preview');
    });

    it('downloads valid full-length track with progress and stores offline', async () => {
      const store = useDownloadStore.getState();
      expect(store.isDownloaded(trackA.id)).toBe(false);

      const success = await store.downloadTrack(trackA);
      expect(success).toBe(true);

      const updated = useDownloadStore.getState();
      expect(updated.isDownloaded(trackA.id)).toBe(true);
      expect(updated.getDownloadStatus(trackA.id)).toBe('COMPLETED');
      expect(updated.getDownloadProgress(trackA.id)).toBe(100);

      const savedTrack = updated.downloadedTracks.find((t) => t.id === trackA.id);
      expect(savedTrack?.sourcePlatform).toBe('DOWNLOADED');
      expect(savedTrack?.storageLocation).toBe('LOCAL_DEVICE');
      expect(savedTrack?.title).toBe(trackA.title);
      expect(savedTrack?.artist).toBe(trackA.artist);

      // Prevent duplicate download
      const duplicateAttempt = await updated.downloadTrack(trackA);
      expect(duplicateAttempt).toBe(true);
      expect(useDownloadStore.getState().downloadedTracks.length).toBe(1);
    });

    it('deletes downloaded track and cleans up status', async () => {
      const store = useDownloadStore.getState();
      await store.downloadTrack(trackB);
      expect(store.isDownloaded(trackB.id)).toBe(true);

      await store.deleteTrack(trackB.id);
      const afterDelete = useDownloadStore.getState();
      expect(afterDelete.isDownloaded(trackB.id)).toBe(false);
      expect(afterDelete.getDownloadStatus(trackB.id)).toBe('IDLE');
    });

    it('records failed downloads and allows retry', async () => {
      // Simulate failed download by setting an invalid preview track
      const invalidTrack: Track = {
        id: 'failed_test_track',
        title: 'Broken Stream',
        artist: 'Artist F',
        durationMs: 15000,
        sourcePlatform: 'YOUTUBE',
        sourceUrl: 'https://example.com/audio-preview.mp3',
        isPlayableDirectly: false
      };

      const store = useDownloadStore.getState();
      const success = await store.downloadTrack(invalidTrack);
      expect(success).toBe(false);

      const state = useDownloadStore.getState();
      expect(state.getDownloadStatus(invalidTrack.id)).toBe('FAILED');
      expect(state.getDownloadError(invalidTrack.id)).toBeDefined();

      // Retry
      const retryResult = await state.retryDownload(invalidTrack.id);
      expect(retryResult).toBe(false); // Still invalid
    });
  });
});
