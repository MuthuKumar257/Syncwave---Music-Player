import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '../api/types';
import { apiClient } from '../api/client';

export interface MobilePlaylist {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  trackIds: string[];
  tracks: Track[];
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredLibraryData {
  favorites: string[];
  favoriteTracks: Track[];
  playlists: MobilePlaylist[];
}

interface MobileLibraryState {
  favorites: string[];
  favoriteTracks: Track[];
  playlists: MobilePlaylist[];
  currentUserId: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: (userId?: string | null) => Promise<void>;
  switchUser: (userId: string | null) => Promise<void>;
  resetForUser: (userId?: string | null) => Promise<void>;
  toggleFavorite: (track: Track) => Promise<boolean>;
  isFavorite: (trackId: string) => boolean;
  syncFavorites: () => Promise<void>;
  syncPlaylists: () => Promise<void>;
  createPlaylist: (
    name: string,
    descriptionOrTracks?: string | Track[],
    artworkUrl?: string,
    initialTracks?: Track[]
  ) => Promise<MobilePlaylist>;
  updatePlaylist: (
    playlistId: string,
    updates: { name?: string; description?: string; artworkUrl?: string }
  ) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<boolean>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderPlaylistTracks: (playlistId: string, fromIndex: number, toIndex: number) => Promise<void>;
  getPlaylistById: (playlistId: string) => MobilePlaylist | undefined;
  isInPlaylist: (playlistId: string, trackId: string) => boolean;
}

const getStorageKey = (userId?: string | null) =>
  `@syncwave_mobile_library_${userId && userId.trim() ? userId.trim() : 'guest'}_v2`;

const DEFAULT_PLAYLISTS: MobilePlaylist[] = [
  {
    id: 'default_chill_vibes',
    name: 'Chill Vibes',
    description: 'Relaxing background tunes and melodies',
    artworkUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
    trackIds: [],
    tracks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'default_driving_mix',
    name: 'Driving Mix',
    description: 'Energetic soundtracks and beats for the road',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
    trackIds: [],
    tracks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const useLibraryStore = create<MobileLibraryState>((set, get) => ({
  favorites: [],
  favoriteTracks: [],
  playlists: [],
  currentUserId: null,
  isLoading: false,
  isInitialized: false,

  initialize: async (userId?: string | null) => {
    const targetUserId = userId !== undefined ? userId : get().currentUserId;
    if (!targetUserId) {
      // Guest mode: clear personal favorites and playlists from memory
      set({
        favorites: [],
        favoriteTracks: [],
        playlists: [],
        currentUserId: null,
        isInitialized: true
      });
      return;
    }

    const storageKey = getStorageKey(targetUserId);

    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredLibraryData>;
        set({
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
          favoriteTracks: Array.isArray(parsed.favoriteTracks) ? parsed.favoriteTracks : [],
          playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
          currentUserId: targetUserId,
          isInitialized: true
        });
      } else {
        set({
          favorites: [],
          favoriteTracks: [],
          playlists: [],
          currentUserId: targetUserId,
          isInitialized: true
        });
      }
    } catch {
      set({ isInitialized: true, currentUserId: targetUserId });
    }

    // If authenticated, sync with cloud in background
    if (targetUserId) {
      void get().syncFavorites();
      void get().syncPlaylists();
    }
  },

  switchUser: async (userId: string | null) => {
    set({ isInitialized: false, currentUserId: userId });
    await get().initialize(userId);
  },

  resetForUser: async (userId = null) => {
    const key = getStorageKey(userId || get().currentUserId);
    set({
      favorites: [],
      favoriteTracks: [],
      playlists: DEFAULT_PLAYLISTS,
      currentUserId: userId,
      isInitialized: false
    });
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },

  toggleFavorite: async (track: Track): Promise<boolean> => {
    const isFav = get().isFavorite(track.id);
    let nextFavorites: string[];
    let nextFavoriteTracks: Track[];

    if (isFav) {
      // Remove from favourites
      nextFavorites = get().favorites.filter((id) => id !== track.id);
      nextFavoriteTracks = get().favoriteTracks.filter((t) => t.id !== track.id);
    } else {
      // Prepend to favourites (newest favourited first)
      nextFavorites = [track.id, ...get().favorites.filter((id) => id !== track.id)];
      nextFavoriteTracks = [track, ...get().favoriteTracks.filter((t) => t.id !== track.id)];
    }

    set({ favorites: nextFavorites, favoriteTracks: nextFavoriteTracks });

    // Persist to user-scoped storage
    const storageKey = getStorageKey(get().currentUserId);
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          favorites: nextFavorites,
          favoriteTracks: nextFavoriteTracks,
          playlists: get().playlists
        })
      );
    } catch {}

    // Synchronize with server if logged in
    try {
      await apiClient.post(`/api/favorites/${encodeURIComponent(track.id)}`);
    } catch {
      // Non-blocking offline support
    }

    return !isFav;
  },

  isFavorite: (trackId: string): boolean => {
    return get().favorites.includes(trackId);
  },

  syncFavorites: async (): Promise<void> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: string[] }>('/api/favorites');
      if (res.data.success && Array.isArray(res.data.data)) {
        const cloudFavIds = res.data.data;
        const localFavs = get().favorites;
        const localTracksMap = new Map<string, Track>(get().favoriteTracks.map((t) => [t.id, t]));

        // Combine IDs preserving recent order
        const mergedIds = Array.from(new Set([...localFavs, ...cloudFavIds]));

        // Ensure we retain or fetch tracks for every ID
        const resolvedTracks: Track[] = [];
        const missingIds: string[] = [];

        for (const id of mergedIds) {
          const existing = localTracksMap.get(id);
          if (existing) {
            resolvedTracks.push(existing);
          } else {
            missingIds.push(id);
          }
        }

        // Fetch metadata for newly synced cloud IDs
        if (missingIds.length > 0) {
          await Promise.allSettled(
            missingIds.slice(0, 20).map(async (id) => {
              try {
                const songRes = await apiClient.get<{ success: boolean; data: Track }>(
                  `/api/songs/${encodeURIComponent(id)}`
                );
                if (songRes.data.success && songRes.data.data) {
                  resolvedTracks.push(songRes.data.data);
                }
              } catch {}
            })
          );
        }

        set({ favorites: mergedIds, favoriteTracks: resolvedTracks });
        const storageKey = getStorageKey(get().currentUserId);
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            favorites: mergedIds,
            favoriteTracks: resolvedTracks,
            playlists: get().playlists
          })
        );
      }
    } catch {}
  },

  syncPlaylists: async (): Promise<void> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/api/playlists');
      if (res.data.success && Array.isArray(res.data.data)) {
        const serverPlaylists: MobilePlaylist[] = res.data.data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          artworkUrl: p.artworkUrl,
          userId: p.userId,
          trackIds: Array.isArray(p.songIds) ? p.songIds : [],
          tracks: Array.isArray(p.songs) ? p.songs : [],
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString()
        }));

        if (serverPlaylists.length > 0) {
          // Merge local and server playlists
          const localOnly = get().playlists.filter(
            (lp) => !serverPlaylists.some((sp) => sp.id === lp.id) && !lp.id.startsWith('default_')
          );
          const merged = [...serverPlaylists, ...localOnly];
          set({ playlists: merged });

          const storageKey = getStorageKey(get().currentUserId);
          await AsyncStorage.setItem(
            storageKey,
            JSON.stringify({
              favorites: get().favorites,
              favoriteTracks: get().favoriteTracks,
              playlists: merged
            })
          );
        }
      }
    } catch {}
  },

  createPlaylist: async (
    name: string,
    descriptionOrTracks?: string | Track[],
    artworkUrl = '',
    initialTracks: Track[] = []
  ): Promise<MobilePlaylist> => {
    const trimmed = name.trim();
    const finalName = trimmed || `Playlist #${get().playlists.length + 1}`;
    const newId = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let description = '';
    let tracksToAdd: Track[] = initialTracks;

    if (Array.isArray(descriptionOrTracks)) {
      tracksToAdd = descriptionOrTracks;
    } else if (typeof descriptionOrTracks === 'string') {
      description = descriptionOrTracks;
    }

    const newPl: MobilePlaylist = {
      id: newId,
      name: finalName,
      description,
      artworkUrl: artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
      trackIds: tracksToAdd.map((t) => t.id),
      tracks: [...tracksToAdd],
      userId: get().currentUserId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = [newPl, ...get().playlists];
    set({ playlists: nextPlaylists });

    const storageKey = getStorageKey(get().currentUserId);
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          favorites: get().favorites,
          favoriteTracks: get().favoriteTracks,
          playlists: nextPlaylists
        })
      );
    } catch {}

    // Cloud sync
    try {
      await apiClient.post('/api/playlists', {
        name: finalName,
        description,
        artworkUrl,
        songIds: newPl.trackIds
      });
    } catch {}

    return newPl;
  },

  updatePlaylist: async (
    playlistId: string,
    updates: { name?: string; description?: string; artworkUrl?: string }
  ): Promise<void> => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl) return;

    const updatedPl: MobilePlaylist = {
      ...pl,
      name: updates.name !== undefined ? updates.name.trim() || pl.name : pl.name,
      description: updates.description !== undefined ? updates.description : pl.description,
      artworkUrl: updates.artworkUrl !== undefined ? updates.artworkUrl : pl.artworkUrl,
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = get().playlists.map((p) => (p.id === playlistId ? updatedPl : p));
    set({ playlists: nextPlaylists });

    const storageKey = getStorageKey(get().currentUserId);
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          favorites: get().favorites,
          favoriteTracks: get().favoriteTracks,
          playlists: nextPlaylists
        })
      );
    } catch {}

    // Cloud sync
    try {
      await apiClient.put(`/api/playlists/${encodeURIComponent(playlistId)}`, updates);
    } catch {}
  },

  deletePlaylist: async (playlistId: string): Promise<void> => {
    const nextPlaylists = get().playlists.filter((p) => p.id !== playlistId);
    set({ playlists: nextPlaylists });

    const storageKey = getStorageKey(get().currentUserId);
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          favorites: get().favorites,
          favoriteTracks: get().favoriteTracks,
          playlists: nextPlaylists
        })
      );
    } catch {}

    try {
      await apiClient.delete(`/api/playlists/${encodeURIComponent(playlistId)}`);
    } catch {}
  },

  addTrackToPlaylist: async (playlistId: string, track: Track): Promise<boolean> => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl) return false;

    if (pl.trackIds.includes(track.id)) {
      return false; // Prevent duplicate entries in playlist
    }

    const updatedPl: MobilePlaylist = {
      ...pl,
      trackIds: [...pl.trackIds, track.id],
      tracks: [...pl.tracks, track],
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = get().playlists.map((p) => (p.id === playlistId ? updatedPl : p));
    set({ playlists: nextPlaylists });

    const storageKey = getStorageKey(get().currentUserId);
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          favorites: get().favorites,
          favoriteTracks: get().favoriteTracks,
          playlists: nextPlaylists
        })
      );
    } catch {}

    try {
      await apiClient.post(`/api/playlists/${encodeURIComponent(playlistId)}/songs`, {
        songId: track.id
      });
    } catch {}

    return true;
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string): Promise<void> => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl) return;

    const updatedPl: MobilePlaylist = {
      ...pl,
      trackIds: pl.trackIds.filter((id) => id !== trackId),
      tracks: pl.tracks.filter((t) => t.id !== trackId),
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = get().playlists.map((p) => (p.id === playlistId ? updatedPl : p));
    set({ playlists: nextPlaylists });

    const storageKey = getStorageKey(get().currentUserId);
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          favorites: get().favorites,
          favoriteTracks: get().favoriteTracks,
          playlists: nextPlaylists
        })
      );
    } catch {}

    try {
      await apiClient.delete(`/api/playlists/${encodeURIComponent(playlistId)}/songs/${encodeURIComponent(trackId)}`);
    } catch {}
  },

  reorderPlaylistTracks: async (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ): Promise<void> => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    if (fromIndex < 0 || fromIndex >= pl.tracks.length || toIndex < 0 || toIndex >= pl.tracks.length) return;

    const nextTracks = [...pl.tracks];
    const [movedTrack] = nextTracks.splice(fromIndex, 1);
    nextTracks.splice(toIndex, 0, movedTrack);

    const nextTrackIds = [...pl.trackIds];
    const [movedId] = nextTrackIds.splice(fromIndex, 1);
    nextTrackIds.splice(toIndex, 0, movedId);

    const updatedPl: MobilePlaylist = {
      ...pl,
      tracks: nextTracks,
      trackIds: nextTrackIds,
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = get().playlists.map((p) => (p.id === playlistId ? updatedPl : p));
    set({ playlists: nextPlaylists });

    const storageKey = getStorageKey(get().currentUserId);
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          favorites: get().favorites,
          favoriteTracks: get().favoriteTracks,
          playlists: nextPlaylists
        })
      );
    } catch {}

    try {
      await apiClient.put(`/api/playlists/${encodeURIComponent(playlistId)}`, {
        songIds: nextTrackIds
      });
    } catch {}
  },

  getPlaylistById: (playlistId: string): MobilePlaylist | undefined => {
    return get().playlists.find((p) => p.id === playlistId);
  },

  isInPlaylist: (playlistId: string, trackId: string): boolean => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl) return false;
    return pl.trackIds.includes(trackId) || pl.tracks.some((t) => t.id === trackId);
  }
}));

// Initialize store immediately
void useLibraryStore.getState().initialize();
