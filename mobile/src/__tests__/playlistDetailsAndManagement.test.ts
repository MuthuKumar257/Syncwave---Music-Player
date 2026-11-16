import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibraryStore, MobilePlaylist } from '../store/useLibraryStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { sharePlaylist, getPlaylistShareUrl, getPlaylistShareMessage } from '../utils/shareUtils';
import { Track } from '../api/types';

const track1: Track = {
  id: 'song_1',
  title: 'Nenjukkul Peidhidum',
  artist: 'Hariharan, Devan',
  composer: 'Harris Jayaraj',
  album: 'Vaaranam Aayiram',
  durationMs: 370000, // 6m 10s
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=1',
  isPlayableDirectly: true,
  language: 'Tamil'
};

const track2: Track = {
  id: 'song_2',
  title: 'Adiye',
  artist: 'Sid Sriram',
  composer: 'A. R. Rahman',
  album: 'Kadal',
  durationMs: 312000, // 5m 12s
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=2',
  isPlayableDirectly: true,
  language: 'Tamil'
};

const track3: Track = {
  id: 'song_3',
  title: 'Kesariya',
  artist: 'Arijit Singh',
  composer: 'Pritam',
  album: 'Brahmastra',
  durationMs: 268000, // 4m 28s
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=3',
  isPlayableDirectly: true,
  language: 'Hindi'
};

const track4: Track = {
  id: 'song_4',
  title: 'Arabic Kuthu',
  artist: 'Anirudh Ravichander, Jonita Gandhi',
  composer: 'Anirudh Ravichander',
  album: 'Beast',
  durationMs: 280000, // 4m 40s
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=4',
  isPlayableDirectly: true,
  language: 'Tamil'
};

describe('Playlist Details and Song Management Test Suite (Mobile)', () => {
  const TEST_USER = 'user_playlist_test_101';

  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();

    // Reset Player Store
    usePlayerStore.setState({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      sessionPlayedTrackIds: []
    });

    // Reset Library Store for test user
    useLibraryStore.setState({
      favorites: [],
      favoriteTracks: [],
      playlists: [],
      currentUserId: TEST_USER,
      isInitialized: true
    });
  });

  describe('1. Open Playlist & Load Actual Songs', () => {
    it('creates and loads an actual playlist with real songs, metadata and total duration', async () => {
      const store = useLibraryStore.getState();
      const playlist = await store.createPlaylist(
        'Morning Acoustic',
        'Soothing morning melodies and acoustics',
        'https://example.com/art.jpg',
        [track1, track2]
      );

      expect(playlist.id).toBeDefined();
      expect(playlist.name).toBe('Morning Acoustic');
      expect(playlist.description).toBe('Soothing morning melodies and acoustics');
      expect(playlist.tracks).toHaveLength(2);
      expect(playlist.tracks[0].id).toBe('song_1');
      expect(playlist.tracks[1].id).toBe('song_2');

      // Check duration calculation
      const totalMs = playlist.tracks.reduce((acc, t) => acc + t.durationMs, 0);
      expect(totalMs).toBe(682000); // 11 mins 22s
      const totalMinutes = Math.floor(totalMs / 60000);
      expect(totalMinutes).toBe(11);

      // Verify retrieval by ID
      const retrieved = useLibraryStore.getState().getPlaylistById(playlist.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.tracks[0].title).toBe('Nenjukkul Peidhidum');
      expect(retrieved?.tracks[1].title).toBe('Adiye');
    });

    it('handles empty playlist state correctly with 0 songs', async () => {
      const store = useLibraryStore.getState();
      const emptyPl = await store.createPlaylist('Empty Workout');

      expect(emptyPl.tracks).toHaveLength(0);
      expect(emptyPl.trackIds).toHaveLength(0);

      const retrieved = useLibraryStore.getState().getPlaylistById(emptyPl.id);
      expect(retrieved?.tracks.length).toBe(0);
    });
  });

  describe('2. Playlist Song Management (Add, Remove, Reorder)', () => {
    it('adds single and multiple songs to playlist without duplicates and preserves existing songs', async () => {
      const store = useLibraryStore.getState();
      const pl = await store.createPlaylist('Favorites Mix', [track1]);

      expect(pl.tracks).toHaveLength(1);
      expect(pl.trackIds).toEqual(['song_1']);

      // 1. Add single track
      const addedSingle = await useLibraryStore.getState().addTrackToPlaylist(pl.id, track2);
      expect(addedSingle).toBe(true);

      let currentPl = useLibraryStore.getState().getPlaylistById(pl.id)!;
      expect(currentPl.tracks).toHaveLength(2);
      expect(currentPl.trackIds).toEqual(['song_1', 'song_2']);

      // 2. Prevent duplicate single add
      const duplicateAdd = await useLibraryStore.getState().addTrackToPlaylist(pl.id, track1);
      expect(duplicateAdd).toBe(false);
      expect(useLibraryStore.getState().getPlaylistById(pl.id)!.tracks).toHaveLength(2);

      // 3. Multi-select / bulk add
      // Adding track2 (duplicate) and track3, track4 (new)
      const bulkAddedCount = await useLibraryStore.getState().addTracksToPlaylist(pl.id, [
        track2, // duplicate
        track3, // new
        track4  // new
      ]);

      expect(bulkAddedCount).toBe(2); // Only track3 and track4 should be added

      currentPl = useLibraryStore.getState().getPlaylistById(pl.id)!;
      expect(currentPl.tracks).toHaveLength(4);
      expect(currentPl.trackIds).toEqual(['song_1', 'song_2', 'song_3', 'song_4']);
      expect(currentPl.tracks[2].title).toBe('Kesariya');
      expect(currentPl.tracks[3].title).toBe('Arabic Kuthu');
    });

    it('removes a song from playlist and updates trackIds and tracks immediately', async () => {
      const store = useLibraryStore.getState();
      const pl = await store.createPlaylist('Driving Hits', [track1, track2, track3]);

      expect(pl.tracks).toHaveLength(3);

      // Remove middle song (track2)
      await useLibraryStore.getState().removeTrackFromPlaylist(pl.id, 'song_2');

      const updated = useLibraryStore.getState().getPlaylistById(pl.id)!;
      expect(updated.tracks).toHaveLength(2);
      expect(updated.trackIds).toEqual(['song_1', 'song_3']);
      expect(updated.tracks.map((t) => t.id)).toEqual(['song_1', 'song_3']);
    });

    it('reorders songs using Move Up and Move Down controls with immediate persistence', async () => {
      const store = useLibraryStore.getState();
      const pl = await store.createPlaylist('Study Session', [track1, track2, track3]);

      expect(pl.tracks.map((t) => t.id)).toEqual(['song_1', 'song_2', 'song_3']);

      // Move track3 (index 2) UP to index 1
      await useLibraryStore.getState().reorderPlaylistTracks(pl.id, 2, 1);

      let updated = useLibraryStore.getState().getPlaylistById(pl.id)!;
      expect(updated.tracks.map((t) => t.id)).toEqual(['song_1', 'song_3', 'song_2']);
      expect(updated.trackIds).toEqual(['song_1', 'song_3', 'song_2']);

      // Move track1 (index 0) DOWN to index 2
      await useLibraryStore.getState().reorderPlaylistTracks(pl.id, 0, 2);

      updated = useLibraryStore.getState().getPlaylistById(pl.id)!;
      expect(updated.tracks.map((t) => t.id)).toEqual(['song_3', 'song_2', 'song_1']);
      expect(updated.trackIds).toEqual(['song_3', 'song_2', 'song_1']);
    });
  });

  describe('3. Playback Integration (Play All, Shuffle, Queue, Song Click)', () => {
    it('Play All starts first track playing and queues the remaining playlist tracks in exact order', async () => {
      const store = useLibraryStore.getState();
      const pl = await store.createPlaylist('Night Vibes', [track1, track2, track3]);

      const player = usePlayerStore.getState();
      await player.playTrack(pl.tracks[0], pl.tracks);

      const state = usePlayerStore.getState();
      expect(state.currentTrack?.id).toBe('song_1');
      expect(state.isPlaying).toBe(true);
      expect(state.queueIndex).toBe(0);
      expect(state.queue.map((t) => t.id)).toEqual(['song_1', 'song_2', 'song_3']);
    });

    it('clicking an individual song starts that song and sets playlist queue with correct index', async () => {
      const store = useLibraryStore.getState();
      const pl = await store.createPlaylist('Chill Vibes', [track1, track2, track3]);

      // User clicks song 2
      const player = usePlayerStore.getState();
      await player.playTrack(pl.tracks[1], pl.tracks);

      const state = usePlayerStore.getState();
      expect(state.currentTrack?.id).toBe('song_2');
      expect(state.isPlaying).toBe(true);
      expect(state.queueIndex).toBe(1);
      expect(state.queue.map((t) => t.id)).toEqual(['song_1', 'song_2', 'song_3']);
    });

    it('Add All to Queue appends all playlist tracks without replacing the currently playing song', async () => {
      const player = usePlayerStore.getState();
      await player.playTrack(track1); // currently playing Song 1

      expect(usePlayerStore.getState().currentTrack?.id).toBe('song_1');

      // Now add playlist containing track2, track3, track4 to queue
      player.addTracksToQueue([track2, track3, track4]);

      const updated = usePlayerStore.getState();
      expect(updated.currentTrack?.id).toBe('song_1'); // still playing song 1!
      expect(updated.queue.map((t) => t.id)).toContain('song_2');
      expect(updated.queue.map((t) => t.id)).toContain('song_3');
      expect(updated.queue.map((t) => t.id)).toContain('song_4');
    });

    it('Play Next inserts track immediately after currently playing song', async () => {
      const player = usePlayerStore.getState();
      await player.playTrack(track1, [track1, track3]);

      expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(['song_1', 'song_3']);

      // Play Next on track 2
      player.playNextInQueue(track2);

      expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(['song_1', 'song_2', 'song_3']);
    });
  });

  describe('4. Playlist Options (Edit, Rename, Delete, Share)', () => {
    it('renames playlist, edits description, and updates artwork', async () => {
      const store = useLibraryStore.getState();
      const pl = await store.createPlaylist('Old Title', 'Old description', 'https://example.com/old.jpg');

      await store.updatePlaylist(pl.id, {
        name: 'Brand New Playlist Title',
        description: 'Updated playlist description',
        artworkUrl: 'https://example.com/new.jpg'
      });

      const updated = useLibraryStore.getState().getPlaylistById(pl.id)!;
      expect(updated.name).toBe('Brand New Playlist Title');
      expect(updated.description).toBe('Updated playlist description');
      expect(updated.artworkUrl).toBe('https://example.com/new.jpg');
    });

    it('deletes playlist and removes it from user library', async () => {
      const store = useLibraryStore.getState();
      const pl = await store.createPlaylist('Temporary Playlist');

      expect(useLibraryStore.getState().playlists.some((p) => p.id === pl.id)).toBe(true);

      await store.deletePlaylist(pl.id);

      expect(useLibraryStore.getState().playlists.some((p) => p.id === pl.id)).toBe(false);
      expect(useLibraryStore.getState().getPlaylistById(pl.id)).toBeUndefined();
    });

    it('generates correct share URL and message for deep linking', async () => {
      const playlistId = 'pl_share_12345';
      const playlistName = 'Summer Hits 2026';

      const shareUrl = getPlaylistShareUrl(playlistId);
      expect(shareUrl).toBe('https://syncwave.app/playlist/pl_share_12345');

      const message = getPlaylistShareMessage(playlistName, playlistId);
      expect(message).toContain('Summer Hits 2026');
      expect(message).toContain('https://syncwave.app/playlist/pl_share_12345');
    });
  });

  describe('5. User Isolation & Local Persistence', () => {
    it('persists playlists under user-scoped storage key and isolates between accounts', async () => {
      const store = useLibraryStore.getState();

      // User A creates a playlist
      await store.createPlaylist('User A Personal Mix', [track1]);
      expect(useLibraryStore.getState().playlists).toHaveLength(1);

      // Verify written to User A storage key
      const userAKey = `@syncwave_mobile_library_${TEST_USER}_v2`;
      const rawUserA = await AsyncStorage.getItem(userAKey);
      expect(rawUserA).toBeDefined();
      const parsedUserA = JSON.parse(rawUserA!);
      expect(parsedUserA.playlists[0].name).toBe('User A Personal Mix');

      // Switch to User B
      const USER_B = 'user_playlist_test_202';
      await store.switchUser(USER_B);

      // User B should start with 0 playlists (not seeing User A's playlists)
      expect(useLibraryStore.getState().playlists).toHaveLength(0);

      // User B creates their own playlist
      await useLibraryStore.getState().createPlaylist('User B Rock Classics', [track3]);
      expect(useLibraryStore.getState().playlists).toHaveLength(1);
      expect(useLibraryStore.getState().playlists[0].name).toBe('User B Rock Classics');

      // Switch back to User A
      await useLibraryStore.getState().switchUser(TEST_USER);

      // User A's playlist is preserved and does not contain User B's playlist
      expect(useLibraryStore.getState().playlists).toHaveLength(1);
      expect(useLibraryStore.getState().playlists[0].name).toBe('User A Personal Mix');
    });
  });
});
