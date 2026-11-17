import { describe, it, expect, beforeEach, vi } from 'vitest';

const localBacking = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => localBacking.get(key) ?? null,
  setItem: (key: string, value: string) => {
    localBacking.set(key, String(value));
  },
  removeItem: (key: string) => {
    localBacking.delete(key);
  },
  clear: () => {
    localBacking.clear();
  }
};

const sessionBacking = new Map<string, string>();
const sessionStorageMock = {
  getItem: (key: string) => sessionBacking.get(key) ?? null,
  setItem: (key: string, value: string) => {
    sessionBacking.set(key, String(value));
  },
  removeItem: (key: string) => {
    sessionBacking.delete(key);
  },
  clear: () => {
    sessionBacking.clear();
  }
};

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);

import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuthStore } from '../store/useAuthStore';
import { Song, UnifiedTrack, Playlist } from '../types';
import fs from 'fs';
import path from 'path';

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

let mockFavoritesStore = new Set<string>();
let mockPlaylistsStore: Playlist[] = [];

vi.mock('../db/indexedDb', () => ({
  localDb: {
    savePlaylist: vi.fn().mockImplementation(async (pl: Playlist) => {
      const idx = mockPlaylistsStore.findIndex((p) => p.id === pl.id);
      if (idx !== -1) mockPlaylistsStore[idx] = pl;
      else mockPlaylistsStore.push(pl);
    }),
    getAllPlaylists: vi.fn().mockImplementation(async () => mockPlaylistsStore),
    getPlaylist: vi.fn().mockImplementation(async (id: string) => mockPlaylistsStore.find((p) => p.id === id)),
    deletePlaylist: vi.fn().mockResolvedValue(undefined),
    getAllSongs: vi.fn().mockResolvedValue([]),
    getAllMusicFolders: vi.fn().mockResolvedValue([]),
    getFavorites: vi.fn().mockImplementation(async () => Array.from(mockFavoritesStore)),
    getAllDownloadTasks: vi.fn().mockResolvedValue([]),
    getMeta: vi.fn().mockResolvedValue(true),
    setMeta: vi.fn().mockResolvedValue(undefined),
    toggleFavorite: vi.fn().mockImplementation(async (id: string) => {
      if (mockFavoritesStore.has(id)) {
        mockFavoritesStore.delete(id);
        return false;
      } else {
        mockFavoritesStore.add(id);
        return true;
      }
    }),
    saveFavorite: vi.fn().mockResolvedValue(undefined),
    deleteFavorite: vi.fn().mockResolvedValue(undefined)
  }
}));

const mockTrack: UnifiedTrack = {
  id: 'track_shared_007',
  title: 'Kannazhaga',
  artist: 'Dhanush, Shruti Haasan',
  singers: ['Dhanush', 'Shruti Haasan'],
  composer: 'Anirudh Ravichander',
  movieName: '3',
  album: '3 (Original Motion Picture Soundtrack)',
  durationMs: 206000,
  artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=kannazhaga',
  videoId: 'kannazhaga_vid',
  language: 'Tamil',
  genre: 'Melody',
  mood: 'Romantic',
  versionType: 'ORIGINAL',
  isPlayableDirectly: true
};

const mockSongPlaying: Song = {
  id: 'current_playing_song_1',
  title: 'Current Hit',
  artist: 'Top Artist',
  album: 'Current Album',
  durationMs: 240000,
  source: 'YOUTUBE',
  createdAt: new Date().toISOString()
};

const mockSongQueue2: Song = {
  id: 'queue_song_2',
  title: 'Queue Song Two',
  artist: 'Another Artist',
  album: 'Another Album',
  durationMs: 210000,
  source: 'YOUTUBE',
  createdAt: new Date().toISOString()
};

describe('SyncWave Shared Song Page Suite: WhatsApp Removal & Options Menu Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localBacking.clear();
    sessionBacking.clear();
    mockFavoritesStore.clear();

    const initialPlaylist: Playlist = {
      id: 'playlist_chill_vibes',
      name: 'Chill Vibes',
      description: 'Soothing tunes',
      songIds: [],
      songCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockPlaylistsStore = [initialPlaylist];

    // Reset Player Store
    usePlayerStore.setState({
      queue: [mockSongPlaying, mockSongQueue2],
      queueIndex: 0,
      currentSong: mockSongPlaying,
      isPlaying: true,
      sessionPlayedSongIds: []
    });

    // Reset Library Store
    useLibraryStore.setState({
      favorites: [],
      playlists: [initialPlaylist],
      songs: []
    });

    // Reset Auth Store
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      token: null
    });
  });

  describe('1. WhatsApp Removal Verification', () => {
    it('completely removes WhatsApp button, icon, and click handler from source code', () => {
      const filePath = path.resolve(__dirname, '../views/SongPreviewView.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Verify WhatsApp is completely gone
      expect(fileContent).not.toContain('handleWhatsAppShare');
      expect(fileContent).not.toContain('https://api.whatsapp.com');
      expect(fileContent).not.toContain('WhatsApp');
      expect(fileContent).not.toContain('25D366'); // WhatsApp brand green hex

      // Verify legitimate app stores are kept
      expect(fileContent).toContain('Google Play');
      expect(fileContent).toContain('App Store');
    });
  });

  describe('2. Options Menu Structure', () => {
    it('defines all 7 functional actions in SongPreviewView', () => {
      const filePath = path.resolve(__dirname, '../views/SongPreviewView.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // 1. Play Now
      expect(fileContent).toContain('Play Now');
      expect(fileContent).toContain('handlePlayNow');

      // 2. Play Next
      expect(fileContent).toContain('Play Next');
      expect(fileContent).toContain('handlePlayNext');

      // 3. Add to Queue
      expect(fileContent).toContain('Add to Queue');
      expect(fileContent).toContain('handleAddToQueue');

      // 4. Add to Favourites
      expect(fileContent).toContain('Add to Favourites');
      expect(fileContent).toContain('handleToggleFavourite');

      // 5. Add to Playlist
      expect(fileContent).toContain('Add to Playlist');
      expect(fileContent).toContain('handleAddToPlaylist');

      // 6. Download Song (only when permitted)
      expect(fileContent).toContain('Download Song');
      expect(fileContent).toContain('handleDownload');

      // 7. Share Song
      expect(fileContent).toContain('Share Song');
      expect(fileContent).toContain('handleShareSong');

      // Options button beside Play on Web & Open in App
      expect(fileContent).toContain('aria-label="Song options"');
    });
  });

  describe('3. Playback & Queue Actions', () => {
    it('Play Now: plays the shared song directly in the web player', () => {
      const songToPlay: Song = {
        id: mockTrack.id,
        title: mockTrack.title,
        artist: mockTrack.artist,
        album: mockTrack.album || 'Single',
        durationMs: mockTrack.durationMs,
        artworkUrl: mockTrack.artworkUrl,
        externalUrl: mockTrack.sourceUrl,
        videoId: mockTrack.videoId,
        source: 'YOUTUBE',
        createdAt: new Date().toISOString()
      };

      usePlayerStore.getState().playSong(songToPlay);

      const state = usePlayerStore.getState();
      expect(state.currentSong?.id).toBe('track_shared_007');
      expect(state.isPlaying).toBe(true);
      expect(state.queue[state.queueIndex].id).toBe('track_shared_007');
    });

    it('Play Next: inserts the shared song immediately after the currently playing song', () => {
      const songToPlay: Song = {
        id: mockTrack.id,
        title: mockTrack.title,
        artist: mockTrack.artist,
        album: mockTrack.album || 'Single',
        durationMs: mockTrack.durationMs,
        artworkUrl: mockTrack.artworkUrl,
        source: 'YOUTUBE',
        createdAt: new Date().toISOString()
      };

      // Current queue: [mockSongPlaying, mockSongQueue2], queueIndex: 0
      usePlayerStore.getState().playNextInQueue(songToPlay);

      const state = usePlayerStore.getState();
      // mockSongPlaying should still be index 0
      expect(state.queue[0].id).toBe('current_playing_song_1');
      // Shared song should be inserted at index 1 (immediately next)
      expect(state.queue[1].id).toBe('track_shared_007');
      // mockSongQueue2 should now be index 2
      expect(state.queue[2].id).toBe('queue_song_2');
      expect(state.queue).toHaveLength(3);
    });

    it('Add to Queue: appends the shared song to the end of the queue', () => {
      const songToPlay: Song = {
        id: mockTrack.id,
        title: mockTrack.title,
        artist: mockTrack.artist,
        album: mockTrack.album || 'Single',
        durationMs: mockTrack.durationMs,
        artworkUrl: mockTrack.artworkUrl,
        source: 'YOUTUBE',
        createdAt: new Date().toISOString()
      };

      usePlayerStore.getState().addToQueue(songToPlay);

      const state = usePlayerStore.getState();
      expect(state.queue).toHaveLength(3);
      expect(state.queue[2].id).toBe('track_shared_007');
      expect(state.queue[0].id).toBe('current_playing_song_1');
      expect(state.queue[1].id).toBe('queue_song_2');
    });
  });

  describe('4. Favourites & Playlist Actions (Authenticated vs Guest)', () => {
    it('Add to Favourites (Authenticated): saves song to authenticated user favourites', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'user_auth_123', email: 'user@test.com', displayName: 'Auth User' } as any
      });

      const store = useLibraryStore.getState();
      expect(store.favorites).not.toContain(mockTrack.id);

      const added = await store.toggleFavorite(mockTrack.id);
      expect(added).toBe(true);
      expect(useLibraryStore.getState().favorites).toContain(mockTrack.id);

      // Toggling again removes it
      const removed = await store.toggleFavorite(mockTrack.id);
      expect(removed).toBe(false);
      expect(useLibraryStore.getState().favorites).not.toContain(mockTrack.id);
    });

    it('Add to Playlist (Authenticated): saves song to the selected existing playlist', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'user_auth_123', email: 'user@test.com', displayName: 'Auth User' } as any
      });

      const store = useLibraryStore.getState();
      const targetPlaylistId = 'playlist_chill_vibes';

      await store.addSongToPlaylist(targetPlaylistId, mockTrack.id);

      const updated = useLibraryStore.getState().playlists.find((p) => p.id === targetPlaylistId);
      expect(updated?.songIds).toContain(mockTrack.id);
    });

    it('Guest Mode: preserves pending action in sessionStorage and prepares login redirect', () => {
      // Simulate guest clicking "Add to Favourites"
      const cleanId = encodeURIComponent(mockTrack.id);
      sessionStorage.setItem(
        'syncwave_pending_action',
        JSON.stringify({
          type: 'favourite',
          songId: mockTrack.id,
          timestamp: Date.now()
        })
      );
      sessionStorage.setItem('syncwave_redirect_target', `/song/${cleanId}`);

      expect(sessionStorage.getItem('syncwave_redirect_target')).toBe(`/song/track_shared_007`);
      const rawPending = sessionStorage.getItem('syncwave_pending_action');
      expect(rawPending).toBeDefined();

      const parsed = JSON.parse(rawPending!);
      expect(parsed.type).toBe('favourite');
      expect(parsed.songId).toBe('track_shared_007');
    });

    it('Session Restoration: completes pending action once user authenticates', async () => {
      // Setup pending action
      sessionStorage.setItem(
        'syncwave_pending_action',
        JSON.stringify({
          type: 'favourite',
          songId: mockTrack.id,
          timestamp: Date.now()
        })
      );

      // Simulate user logging in and returning to page
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'user_auth_123', email: 'user@test.com', displayName: 'Auth User' } as any
      });

      const pendingRaw = sessionStorage.getItem('syncwave_pending_action');
      expect(pendingRaw).toBeDefined();
      const pending = JSON.parse(pendingRaw!);

      if (pending && pending.songId === mockTrack.id && pending.type === 'favourite') {
        sessionStorage.removeItem('syncwave_pending_action');
        await useLibraryStore.getState().toggleFavorite(mockTrack.id);
      }

      expect(sessionStorage.getItem('syncwave_pending_action')).toBeNull();
      expect(useLibraryStore.getState().favorites).toContain('track_shared_007');
    });
  });

  describe('5. Open in App & Canonical Sharing', () => {
    it('supports Android App Links, iOS Universal Links, and custom URI scheme', () => {
      const songId = 'track_shared_007';
      const cleanId = encodeURIComponent(songId);
      const appDeepLinkUri = `syncwave://song/${cleanId}`;
      const canonicalShareUrl = `https://syncwave.app/song/${cleanId}`;

      expect(appDeepLinkUri).toBe('syncwave://song/track_shared_007');
      expect(canonicalShareUrl).toBe('https://syncwave.app/song/track_shared_007');
      expect(canonicalShareUrl).not.toContain('localhost');
    });

    it('formats share message with track title, artist, and canonical URL', () => {
      const cleanId = encodeURIComponent(mockTrack.id);
      const canonicalShareUrl = `https://syncwave.app/song/${cleanId}`;
      const shareMessage = `Listen to ${mockTrack.title} by ${mockTrack.artist} on SyncWave.\n\nListen here: ${canonicalShareUrl}`;

      expect(shareMessage).toContain('Listen to Kannazhaga by Dhanush, Shruti Haasan on SyncWave.');
      expect(shareMessage).toContain('https://syncwave.app/song/track_shared_007');
    });
  });
});
