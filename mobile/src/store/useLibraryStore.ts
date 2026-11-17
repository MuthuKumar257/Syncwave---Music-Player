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
  clearAllLibraryData: (userId?: string | null) => Promise<void>;
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
  addTracksToPlaylist: (playlistId: string, tracks: Track[]) => Promise<number>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderPlaylistTracks: (playlistId: string, fromIndex: number, toIndex: number) => Promise<void>;
  getPlaylistById: (playlistId: string) => MobilePlaylist | undefined;
  fetchPlaylistDetails: (playlistId: string) => Promise<MobilePlaylist | null>;
  isInPlaylist: (playlistId: string, trackId: string) => boolean;
}

const getStorageKey = (userId?: string | null) =>
  `@syncwave_mobile_library_${userId && userId.trim() ? userId.trim() : 'guest'}_v2`;

const getEffectiveUserId = (explicitUserId?: string | null): string | null => {
  if (explicitUserId !== undefined && explicitUserId !== null && explicitUserId.trim()) {
    return explicitUserId.trim();
  }
  const storeUser = useLibraryStore?.getState?.()?.currentUserId;
  if (storeUser && storeUser.trim()) return storeUser.trim();
  try {
    // Dynamic import to avoid top-level circular dependency with useAuthStore
    const { useAuthStore } = require('./useAuthStore');
    const authUser = useAuthStore.getState()?.user;
    if (authUser?.id) return String(authUser.id).trim();
  } catch {}
  return null;
};

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

export const resolveTracksFromAnywhere = (
  trackIds: string[],
  get: () => MobileLibraryState
): Track[] => {
  if (!Array.isArray(trackIds) || trackIds.length === 0) return [];

  const foundMap = new Map<string, Track>();

  // 1. Check favoriteTracks in current library state
  for (const t of get().favoriteTracks) {
    if (t?.id) foundMap.set(t.id, t);
  }

  // 2. Check tracks in any existing playlists
  for (const pl of get().playlists) {
    if (Array.isArray(pl.tracks)) {
      for (const t of pl.tracks) {
        if (t?.id && !foundMap.has(t.id)) foundMap.set(t.id, t);
      }
    }
  }

  // 3. Check localTracks if available
  try {
    const { useLocalMusicStore } = require('./useLocalMusicStore');
    const local = useLocalMusicStore.getState()?.localTracks || [];
    for (const t of local) {
      if (t?.id && !foundMap.has(t.id)) foundMap.set(t.id, t);
    }
  } catch {}

  // 4. Check feed tracks in useRecommendationStore if available
  try {
    const { useRecommendationStore } = require('./useRecommendationStore');
    const feed = useRecommendationStore.getState()?.feed;
    if (feed) {
      const candidates = [
        ...(feed.recommendedForYou || []),
        ...(feed.recentlyPlayed || []),
        ...(feed.trendingInLanguages || []),
        ...(feed.newReleases || []),
        ...(feed.discoverNewMusic || [])
      ];
      for (const t of candidates) {
        if (t?.id && !foundMap.has(t.id)) foundMap.set(t.id, t);
      }
    }
  } catch {}

  // 5. Build results preserving exact order of trackIds with safe fallback
  return trackIds.map((id) => {
    if (foundMap.has(id)) {
      return foundMap.get(id)!;
    }
    const cleanTitle = id
      .replace(/^(track_|song_|demo_|mob_track_)/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      id,
      title: cleanTitle || 'Song ' + id.substring(0, 8),
      artist: 'SyncWave Artist',
      durationMs: 210000,
      artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
      sourcePlatform: 'LOCAL' as const,
      sourceUrl: '',
      isPlayableDirectly: false
    };
  });
};

export const useLibraryStore = create<MobileLibraryState>((set, get) => ({
  favorites: [],
  favoriteTracks: [],
  playlists: [],
  currentUserId: null,
  isLoading: false,
  isInitialized: false,

  initialize: async (userId?: string | null) => {
    const targetUserId = getEffectiveUserId(userId);
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
    const targetUserId = getEffectiveUserId(userId);
    const key = getStorageKey(targetUserId);
    set({
      favorites: [],
      favoriteTracks: [],
      playlists: [],
      currentUserId: userId,
      isInitialized: false
    });
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },

  clearAllLibraryData: async (userId?: string | null) => {
    const targetUserId = getEffectiveUserId(userId);
    if (targetUserId) {
      try {
        await AsyncStorage.removeItem(getStorageKey(targetUserId));
      } catch {}
    }
    try {
      await AsyncStorage.removeItem(getStorageKey('guest'));
      await AsyncStorage.removeItem(getStorageKey(null));
    } catch {}

    set({
      favorites: [],
      favoriteTracks: [],
      playlists: [],
      currentUserId: null,
      isInitialized: true
    });
  },

  toggleFavorite: async (track: Track): Promise<boolean> => {
    if (!track || !track.id) return false;
    const prevFavorites = [...get().favorites];
    const prevFavoriteTracks = [...get().favoriteTracks];
    const isFav = get().isFavorite(track.id);

    let nextFavorites: string[];
    let nextFavoriteTracks: Track[];

    if (isFav) {
      // Optimistic remove
      nextFavorites = prevFavorites.filter((id) => id !== track.id);
      nextFavoriteTracks = prevFavoriteTracks.filter((t) => t.id !== track.id);
    } else {
      // Optimistic prepend (newest favourited first, deduplicate)
      nextFavorites = [track.id, ...prevFavorites.filter((id) => id !== track.id)];
      nextFavoriteTracks = [track, ...prevFavoriteTracks.filter((t) => t.id !== track.id)];
    }

    set({ favorites: nextFavorites, favoriteTracks: nextFavoriteTracks });

    // Persist to user-scoped storage immediately
    const targetUserId = getEffectiveUserId(get().currentUserId);
    const storageKey = getStorageKey(targetUserId);
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

    // Synchronize with server if authenticated
    if (targetUserId) {
      try {
        await apiClient.post(`/api/favorites/${encodeURIComponent(track.id)}`, {
          track,
          action: isFav ? 'REMOVE' : 'ADD'
        });
      } catch (err) {
        // Rollback state if server operation failed
        set({ favorites: prevFavorites, favoriteTracks: prevFavoriteTracks });
        try {
          await AsyncStorage.setItem(
            storageKey,
            JSON.stringify({
              favorites: prevFavorites,
              favoriteTracks: prevFavoriteTracks,
              playlists: get().playlists
            })
          );
        } catch {}
        throw err;
      }
    }

    return !isFav;
  },

  isFavorite: (trackId: string): boolean => {
    return get().favorites.includes(trackId);
  },

  syncFavorites: async (): Promise<void> => {
    const targetUserId = getEffectiveUserId(get().currentUserId);
    if (!targetUserId) return;

    try {
      const res = await apiClient.get<{
        success: boolean;
        count: number;
        data: string[];
        songs?: Track[];
      }>('/api/favorites');

      if (res.data?.success && Array.isArray(res.data?.data)) {
        const cloudFavIds = res.data.data;
        const serverSongs = Array.isArray(res.data.songs) ? res.data.songs : [];
        const localTracksMap = new Map<string, Track>();

        // 1. Existing local favoriteTracks
        for (const t of get().favoriteTracks) {
          if (t?.id) localTracksMap.set(t.id, t);
        }

        // 2. Server returned populated songs
        for (const s of serverSongs) {
          if (s?.id) localTracksMap.set(s.id, s);
        }

        // 3. Local music store tracks if available
        try {
          const { useLocalMusicStore } = require('./useLocalMusicStore');
          const locals = useLocalMusicStore.getState()?.localTracks || [];
          for (const l of locals) {
            if (l?.id && !localTracksMap.has(l.id)) localTracksMap.set(l.id, l);
          }
        } catch {}

        // Merge cloud favorites with local favorites (cloud takes priority in ordering)
        const mergedFavIds = Array.from(new Set([...cloudFavIds, ...get().favorites]));

        // Resolve all merged favorite IDs into full Track objects
        const resolvedTracks: Track[] = mergedFavIds
          .map((id) => localTracksMap.get(id) || resolveTracksFromAnywhere([id], get)[0])
          .filter(Boolean);

        set({ favorites: mergedFavIds, favoriteTracks: resolvedTracks });

        const storageKey = getStorageKey(targetUserId);
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            favorites: mergedFavIds,
            favoriteTracks: resolvedTracks,
            playlists: get().playlists
          })
        );
      }
    } catch {
      // Offline: retain current favorites
    }
  },

  syncPlaylists: async (): Promise<void> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/api/playlists');
      if (res.data.success && Array.isArray(res.data.data)) {
        const serverPlaylists: MobilePlaylist[] = res.data.data.map((p) => {
          const existing = get().playlists.find((item) => item.id === p.id);
          const serverSongs = Array.isArray(p.songs) ? p.songs : [];
          const serverSongIds = Array.isArray(p.songIds)
            ? p.songIds
            : serverSongs.map((s: any) => s.id);

          // Preserve existing hydrated tracks if server didn't supply them, or resolve from catalogue
          const resolvedTracks: Track[] =
            serverSongs.length > 0
              ? serverSongs
              : existing && existing.tracks.length > 0
              ? existing.tracks
              : resolveTracksFromAnywhere(serverSongIds, get);

          return {
            id: p.id,
            name: p.name,
            description: p.description || '',
            artworkUrl: p.artworkUrl || (resolvedTracks[0]?.artworkUrl ? resolvedTracks[0].artworkUrl : undefined),
            userId: p.userId,
            trackIds: serverSongIds.length > 0 ? serverSongIds : resolvedTracks.map((t) => t.id),
            tracks: resolvedTracks,
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString()
          };
        });

        if (serverPlaylists.length > 0) {
          // Merge local and server playlists
          const localOnly = get().playlists.filter(
            (lp) => !serverPlaylists.some((sp) => sp.id === lp.id) && !lp.id.startsWith('default_')
          );
          const merged = [...serverPlaylists, ...localOnly];
          set({ playlists: merged });

          const targetUserId = getEffectiveUserId(get().currentUserId);
          const storageKey = getStorageKey(targetUserId);
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
      artworkUrl: artworkUrl || (tracksToAdd[0]?.artworkUrl ? tracksToAdd[0].artworkUrl : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'),
      trackIds: tracksToAdd.map((t) => t.id),
      tracks: [...tracksToAdd],
      userId: getEffectiveUserId(get().currentUserId) || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = [newPl, ...get().playlists];
    set({ playlists: nextPlaylists });

    const targetUserId = getEffectiveUserId(get().currentUserId);
    const storageKey = getStorageKey(targetUserId);
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

    // Cloud sync with server
    try {
      const res = await apiClient.post<{ success: boolean; data: any }>('/api/playlists', {
        name: finalName,
        description,
        artworkUrl: newPl.artworkUrl,
        songIds: newPl.trackIds,
        songs: newPl.tracks
      });
      if (res.data.success && res.data.data?.id) {
        const serverPl = res.data.data;
        const replaced = get().playlists.map((p) =>
          p.id === newPl.id
            ? {
                ...p,
                id: serverPl.id,
                userId: serverPl.userId || p.userId
              }
            : p
        );
        set({ playlists: replaced });
        newPl.id = serverPl.id;
      }
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
      artworkUrl: pl.artworkUrl || track.artworkUrl,
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = get().playlists.map((p) => (p.id === playlistId ? updatedPl : p));
    set({ playlists: nextPlaylists });

    const targetUserId = getEffectiveUserId(get().currentUserId);
    const storageKey = getStorageKey(targetUserId);
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
        songId: track.id,
        song: track
      });
    } catch {}

    return true;
  },

  addTracksToPlaylist: async (playlistId: string, tracks: Track[]): Promise<number> => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl || !tracks || tracks.length === 0) return 0;

    const existingIds = new Set(pl.trackIds);
    const newTracks = tracks.filter((t) => !existingIds.has(t.id));
    if (newTracks.length === 0) return 0;

    const updatedTrackIds = [...pl.trackIds, ...newTracks.map((t) => t.id)];
    const updatedTracks = [...pl.tracks, ...newTracks];

    const updatedPl: MobilePlaylist = {
      ...pl,
      trackIds: updatedTrackIds,
      tracks: updatedTracks,
      artworkUrl: pl.artworkUrl || newTracks[0]?.artworkUrl,
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = get().playlists.map((p) => (p.id === playlistId ? updatedPl : p));
    set({ playlists: nextPlaylists });

    const targetUserId = getEffectiveUserId(get().currentUserId);
    const storageKey = getStorageKey(targetUserId);
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

    // Cloud sync in background
    try {
      for (const track of newTracks) {
        await apiClient.post(`/api/playlists/${encodeURIComponent(playlistId)}/songs`, {
          songId: track.id,
          song: track
        }).catch(() => {});
      }
    } catch {}

    return newTracks.length;
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

    const targetUserId = getEffectiveUserId(get().currentUserId);
    const storageKey = getStorageKey(targetUserId);
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

    const nextTrackIds = nextTracks.map((t) => t.id);

    const updatedPl: MobilePlaylist = {
      ...pl,
      tracks: nextTracks,
      trackIds: nextTrackIds,
      updatedAt: new Date().toISOString()
    };

    const nextPlaylists = get().playlists.map((p) => (p.id === playlistId ? updatedPl : p));
    set({ playlists: nextPlaylists });

    const targetUserId = getEffectiveUserId(get().currentUserId);
    const storageKey = getStorageKey(targetUserId);
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
      await apiClient.put(`/api/playlists/${encodeURIComponent(playlistId)}/reorder`, {
        songIds: nextTrackIds,
        fromIndex,
        toIndex
      }).catch(async () => {
        await apiClient.put(`/api/playlists/${encodeURIComponent(playlistId)}`, {
          songIds: nextTrackIds
        });
      });
    } catch {}
  },

  getPlaylistById: (playlistId: string): MobilePlaylist | undefined => {
    return get().playlists.find((p) => p.id === playlistId);
  },

  fetchPlaylistDetails: async (playlistId: string): Promise<MobilePlaylist | null> => {
    const existing = get().playlists.find((p) => p.id === playlistId);
    const effectiveUserId = getEffectiveUserId(get().currentUserId);

    // If guest or no authenticated user, hydrate existing tracks from local catalogue
    if (!effectiveUserId) {
      if (existing) {
        const hydratedTracks =
          existing.tracks.length > 0
            ? existing.tracks
            : resolveTracksFromAnywhere(existing.trackIds, get);
        const hydratedPl: MobilePlaylist = {
          ...existing,
          tracks: hydratedTracks
        };
        if (hydratedTracks.length !== existing.tracks.length) {
          const nextPlaylists = get().playlists.map((item) =>
            item.id === playlistId ? hydratedPl : item
          );
          set({ playlists: nextPlaylists });
        }
        return hydratedPl;
      }
      return null;
    }

    try {
      const res = await apiClient.get<{ success: boolean; data: any }>(
        `/api/playlists/${encodeURIComponent(playlistId)}`
      );
      if (
        res.data?.success &&
        res.data?.data &&
        typeof res.data.data === 'object' &&
        !Array.isArray(res.data.data) &&
        res.data.data.id
      ) {
        const p = res.data.data;
        const serverTracks: Track[] = Array.isArray(p.songs) ? p.songs : [];
        const serverSongIds: string[] = Array.isArray(p.songIds)
          ? p.songIds
          : serverTracks.map((t: Track) => t.id);

        const resolvedTracks =
          serverTracks.length > 0
            ? serverTracks
            : existing && existing.tracks.length > 0
            ? existing.tracks
            : resolveTracksFromAnywhere(serverSongIds, get);

        const updated: MobilePlaylist = {
          id: p.id,
          name: p.name || existing?.name || 'Untitled Playlist',
          description: p.description !== undefined ? p.description : existing?.description,
          artworkUrl: p.artworkUrl || (resolvedTracks[0]?.artworkUrl ? resolvedTracks[0].artworkUrl : existing?.artworkUrl),
          userId: p.userId || effectiveUserId,
          trackIds: serverSongIds.length > 0 ? serverSongIds : (existing?.trackIds || []),
          tracks: resolvedTracks,
          createdAt: p.createdAt || existing?.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString()
        };

        const nextPlaylists = get().playlists.some((item) => item.id === playlistId)
          ? get().playlists.map((item) => (item.id === playlistId ? updated : item))
          : [updated, ...get().playlists];

        set({ playlists: nextPlaylists });

        const storageKey = getStorageKey(effectiveUserId);
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            favorites: get().favorites,
            favoriteTracks: get().favoriteTracks,
            playlists: nextPlaylists
          })
        );
        return updated;
      }
    } catch (err) {
      if (existing) {
        const hydratedTracks =
          existing.tracks.length > 0
            ? existing.tracks
            : resolveTracksFromAnywhere(existing.trackIds, get);
        const hydratedPl: MobilePlaylist = { ...existing, tracks: hydratedTracks };
        return hydratedPl;
      }
      throw err;
    }

    if (existing) {
      const hydratedTracks =
        existing.tracks.length > 0
          ? existing.tracks
          : resolveTracksFromAnywhere(existing.trackIds, get);
      const hydratedPl: MobilePlaylist = { ...existing, tracks: hydratedTracks };
      return hydratedPl;
    }
    return null;

    return existing || null;
  },

  isInPlaylist: (playlistId: string, trackId: string): boolean => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl) return false;
    return pl.trackIds.includes(trackId) || pl.tracks.some((t) => t.id === trackId);
  }
}));

// Initialize store immediately
void useLibraryStore.getState().initialize();
