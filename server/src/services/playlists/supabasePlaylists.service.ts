import { syncStore, PlaylistData, SongMetadata } from '../../db/store';
import { RecommendationEngineService } from '../recommendation/recommendationEngine.service';
import { UnifiedTrack } from '../search/searchAggregator.service';

interface SupabaseCredentials {
  url: string;
  key: string;
}

export class SupabasePlaylistsService {
  private static getCredentials(): SupabaseCredentials | null {
    const rawUrl = process.env.SUPABASE_URL || '';
    const rawKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    const url = rawUrl.trim().replace(/\/+$/, '');
    const key = rawKey.trim();

    if (!url || !key) return null;

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return null;
      return { url, key };
    } catch {
      return null;
    }
  }

  public static isConfigured(): boolean {
    return Boolean(this.getCredentials());
  }

  private static async supabaseRequest<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
      query?: string;
      body?: unknown;
      prefer?: string;
    } = {}
  ): Promise<T | null> {
    const creds = this.getCredentials();
    if (!creds) return null;

    const querySuffix = options.query ? `?${options.query}` : '';
    const url = `${creds.url}/rest/v1/${path}${querySuffix}`;

    const headers: Record<string, string> = {
      apikey: creds.key,
      Authorization: `Bearer ${creds.key}`,
      'Content-Type': 'application/json'
    };

    if (options.prefer) {
      headers['Prefer'] = options.prefer;
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      signal: AbortSignal.timeout(6000),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Supabase playlists error (${res.status}): ${txt}`);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  /**
   * Resolve a track by ID from in-memory store, recommendation catalog, or Supabase songs table
   */
  public static async resolveTrack(songId: string): Promise<UnifiedTrack | null> {
    if (!songId) return null;

    // 1. In-memory syncStore
    const fromStore = syncStore.getSongById(songId);
    if (fromStore) {
      return {
        id: fromStore.id,
        title: fromStore.title,
        artist: fromStore.artist || 'Unknown Artist',
        album: fromStore.album || 'Unknown Album',
        durationMs: fromStore.durationMs || 0,
        artworkUrl: fromStore.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
        sourcePlatform: 'OPEN_AUDIO',
        sourceUrl: fromStore.externalUrl || '',
        versionType: 'ORIGINAL' as any,
        isPlayableDirectly: true
      };
    }

    // 2. Recommendation Master Catalog
    const fromCatalog = RecommendationEngineService.findTrackById(songId);
    if (fromCatalog) {
      return fromCatalog;
    }

    // 3. Supabase songs table
    if (this.isConfigured()) {
      try {
        const rows = await this.supabaseRequest<any[]>('songs', {
          method: 'GET',
          query: `id=eq.${encodeURIComponent(songId)}&limit=1`
        });
        if (Array.isArray(rows) && rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            title: r.title,
            artist: r.artist || 'Unknown Artist',
            album: r.album || 'Unknown Album',
            durationMs: Number(r.duration_ms) || 0,
            artworkUrl: r.artwork_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
            sourcePlatform: 'OPEN_AUDIO',
            sourceUrl: r.external_url || '',
            versionType: 'ORIGINAL' as any,
            isPlayableDirectly: true
          };
        }
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabasePlaylistsService] resolveTrack error:', err?.message || err);
        }
      }
    }

    return null;
  }

  /**
   * Upsert a song into Supabase and local store so foreign key relations succeed
   */
  public static async saveSong(song: Partial<SongMetadata> & { id: string; title: string }): Promise<void> {
    if (!song?.id) return;

    // Save to local store
    syncStore.saveSong({
      id: song.id,
      title: song.title,
      artist: song.artist || 'Unknown Artist',
      album: song.album || 'Unknown Album',
      durationMs: song.durationMs || 0,
      artworkUrl: song.artworkUrl,
      source: song.source || 'LOCAL',
      externalUrl: song.externalUrl || '',
      createdAt: song.createdAt || new Date().toISOString()
    });

    // Upsert into Supabase songs table
    if (this.isConfigured()) {
      try {
        await this.supabaseRequest('songs', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates',
          body: {
            id: song.id,
            title: song.title,
            artist: song.artist || 'Unknown Artist',
            album: song.album || 'Unknown Album',
            duration_ms: song.durationMs || 0,
            artwork_url: song.artworkUrl || null,
            source: song.source || 'LOCAL',
            external_url: song.externalUrl || null,
            created_at: new Date().toISOString()
          }
        });
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabasePlaylistsService] saveSong error:', err?.message || err);
        }
      }
    }
  }

  /**
   * Fetch all playlists belonging to a specific authenticated user
   */
  public static async getUserPlaylists(userId: string): Promise<Array<PlaylistData & { songs: UnifiedTrack[]; songCount: number; totalDurationMs: number }>> {
    if (!userId) return [];

    let playlists: PlaylistData[] = [];

    // Query Supabase if configured
    if (this.isConfigured()) {
      try {
        const rows = await this.supabaseRequest<any[]>('playlists', {
          method: 'GET',
          query: `user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
        });

        if (Array.isArray(rows) && rows.length > 0) {
          for (const row of rows) {
            // Fetch playlist_songs
            let songIds: string[] = [];
            try {
              const itemRows = await this.supabaseRequest<any[]>('playlist_songs', {
                method: 'GET',
                query: `playlist_id=eq.${encodeURIComponent(row.id)}&order=order_index.asc`
              });
              if (Array.isArray(itemRows)) {
                songIds = itemRows.map((ir) => ir.song_id);
              }
            } catch {}

            const pl: PlaylistData = {
              id: row.id,
              userId: row.user_id,
              name: row.name,
              description: row.description || '',
              artworkUrl: row.artwork_url || undefined,
              isFavorite: Boolean(row.is_favorite),
              songIds,
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString()
            };
            playlists.push(pl);
            // Synchronize into local syncStore
            syncStore.playlists.set(pl.id, pl);
          }
        }
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabasePlaylistsService] getUserPlaylists error:', err?.message || err);
        }
      }
    }

    // Fallback to in-memory store if Supabase returned nothing or is offline
    if (playlists.length === 0) {
      playlists = syncStore.getUserPlaylists(userId);
    }

    // Populate songs for each playlist
    const result = [];
    for (const pl of playlists) {
      const songs: UnifiedTrack[] = [];
      for (const sId of pl.songIds || []) {
        const track = await this.resolveTrack(sId);
        if (track) {
          songs.push(track);
        } else {
          // Graceful fallback for missing track metadata
          songs.push({
            id: sId,
            title: 'Track ' + sId.substring(0, 8),
            artist: 'Unknown Artist',
            album: 'SyncWave Playlist',
            durationMs: 0,
            artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
            sourcePlatform: 'OPEN_AUDIO',
            sourceUrl: '',
            versionType: 'ORIGINAL' as any,
            isPlayableDirectly: false
          });
        }
      }

      const totalDurationMs = songs.reduce((acc, s) => acc + (s.durationMs || 0), 0);
      result.push({
        ...pl,
        songs,
        songCount: songs.length,
        totalDurationMs
      });
    }

    return result;
  }

  /**
   * Fetch a single playlist by ID with verified user ownership and joined song objects
   */
  public static async getPlaylistById(
    playlistId: string,
    userId: string
  ): Promise<(PlaylistData & { songs: UnifiedTrack[]; songCount: number; totalDurationMs: number }) | null> {
    if (!playlistId || !userId) return null;

    let playlist: PlaylistData | undefined;

    // Query Supabase if configured
    if (this.isConfigured()) {
      try {
        const rows = await this.supabaseRequest<any[]>('playlists', {
          method: 'GET',
          query: `id=eq.${encodeURIComponent(playlistId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
        });

        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          let songIds: string[] = [];
          try {
            const itemRows = await this.supabaseRequest<any[]>('playlist_songs', {
              method: 'GET',
              query: `playlist_id=eq.${encodeURIComponent(row.id)}&order=order_index.asc`
            });
            if (Array.isArray(itemRows)) {
              songIds = itemRows.map((ir) => ir.song_id);
            }
          } catch {}

          playlist = {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            description: row.description || '',
            artworkUrl: row.artwork_url || undefined,
            isFavorite: Boolean(row.is_favorite),
            songIds,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString()
          };
          syncStore.playlists.set(playlist.id, playlist);
        }
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabasePlaylistsService] getPlaylistById error:', err?.message || err);
        }
      }
    }

    // Fallback to local store
    if (!playlist) {
      playlist = syncStore.getPlaylistById(playlistId);
    }

    if (!playlist || playlist.userId !== userId) {
      return null;
    }

    // Populate songs
    const songs: UnifiedTrack[] = [];
    for (const sId of playlist.songIds || []) {
      const track = await this.resolveTrack(sId);
      if (track) {
        songs.push(track);
      } else {
        songs.push({
          id: sId,
          title: 'Track ' + sId.substring(0, 8),
          artist: 'Unknown Artist',
          album: 'SyncWave Playlist',
          durationMs: 0,
          artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
          sourcePlatform: 'OPEN_AUDIO',
          sourceUrl: '',
          versionType: 'ORIGINAL' as any,
          isPlayableDirectly: false
        });
      }
    }

    const totalDurationMs = songs.reduce((acc, s) => acc + (s.durationMs || 0), 0);

    return {
      ...playlist,
      songs,
      songCount: songs.length,
      totalDurationMs
    };
  }

  /**
   * Create a new playlist with optional initial songs
   */
  public static async createPlaylist(
    userId: string,
    data: {
      name: string;
      description?: string;
      artworkUrl?: string;
      songIds?: string[];
      songs?: any[];
    }
  ): Promise<PlaylistData & { songs: UnifiedTrack[]; songCount: number; totalDurationMs: number }> {
    const rawSongIds = Array.isArray(data.songIds) ? data.songIds : [];
    const songsList = Array.isArray(data.songs) ? data.songs : [];

    // Save any passed song metadata
    for (const song of songsList) {
      if (song?.id) {
        await this.saveSong(song);
        if (!rawSongIds.includes(song.id)) {
          rawSongIds.push(song.id);
        }
      }
    }

    // Create in local store first
    const localPl = syncStore.createPlaylist(
      userId,
      data.name,
      data.artworkUrl,
      data.description,
      rawSongIds
    );

    // Persist in Supabase if configured
    if (this.isConfigured()) {
      try {
        await this.supabaseRequest('playlists', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates',
          body: {
            id: localPl.id,
            user_id: userId,
            name: localPl.name,
            description: localPl.description || null,
            artwork_url: localPl.artworkUrl || null,
            is_favorite: false,
            created_at: localPl.createdAt,
            updated_at: localPl.updatedAt
          }
        });

        // Insert playlist_songs entries
        for (let i = 0; i < rawSongIds.length; i++) {
          const songId = rawSongIds[i];
          await this.supabaseRequest('playlist_songs', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: {
              playlist_id: localPl.id,
              song_id: songId,
              order_index: i,
              added_at: new Date().toISOString()
            }
          }).catch(() => {});
        }
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabasePlaylistsService] createPlaylist error:', err?.message || err);
        }
      }
    }

    const songs: UnifiedTrack[] = [];
    for (const sId of localPl.songIds) {
      const track = await this.resolveTrack(sId);
      if (track) songs.push(track);
    }

    return {
      ...localPl,
      songs,
      songCount: songs.length,
      totalDurationMs: songs.reduce((acc, s) => acc + (s.durationMs || 0), 0)
    };
  }

  /**
   * Add a song to an existing playlist, preventing duplicates
   */
  public static async addSongToPlaylist(
    playlistId: string,
    userId: string,
    songId: string,
    songMetadata?: any
  ): Promise<(PlaylistData & { songs: UnifiedTrack[]; songCount: number; totalDurationMs: number }) | null> {
    const playlist = await this.getPlaylistById(playlistId, userId);
    if (!playlist) return null;

    // Save song metadata if provided
    if (songMetadata?.id) {
      await this.saveSong(songMetadata);
    }

    // Prevent duplicate entries
    if (!playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId);
      playlist.updatedAt = new Date().toISOString();
      syncStore.playlists.set(playlistId, playlist);

      // Persist in Supabase
      if (this.isConfigured()) {
        try {
          await this.supabaseRequest('playlist_songs', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: {
              playlist_id: playlistId,
              song_id: songId,
              order_index: playlist.songIds.length - 1,
              added_at: new Date().toISOString()
            }
          });
          await this.supabaseRequest('playlists', {
            method: 'PATCH',
            query: `id=eq.${encodeURIComponent(playlistId)}`,
            body: { updated_at: playlist.updatedAt }
          });
        } catch (err: any) {
          if (!err?.message?.includes('PGRST205')) {
            console.warn('[SupabasePlaylistsService] addSongToPlaylist error:', err?.message || err);
          }
        }
      }
    }

    return this.getPlaylistById(playlistId, userId);
  }

  /**
   * Remove a song from a playlist
   */
  public static async removeSongFromPlaylist(
    playlistId: string,
    userId: string,
    songId: string
  ): Promise<(PlaylistData & { songs: UnifiedTrack[]; songCount: number; totalDurationMs: number }) | null> {
    const playlist = await this.getPlaylistById(playlistId, userId);
    if (!playlist) return null;

    playlist.songIds = playlist.songIds.filter((id) => id !== songId);
    playlist.updatedAt = new Date().toISOString();
    syncStore.playlists.set(playlistId, playlist);

    // Persist in Supabase
    if (this.isConfigured()) {
      try {
        await this.supabaseRequest('playlist_songs', {
          method: 'DELETE',
          query: `playlist_id=eq.${encodeURIComponent(playlistId)}&song_id=eq.${encodeURIComponent(songId)}`
        });
        await this.supabaseRequest('playlists', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(playlistId)}`,
          body: { updated_at: playlist.updatedAt }
        });
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabasePlaylistsService] removeSongFromPlaylist error:', err?.message || err);
        }
      }
    }

    return this.getPlaylistById(playlistId, userId);
  }

  /**
   * Update playlist metadata and/or reorder its songs
   */
  public static async updatePlaylist(
    playlistId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      artworkUrl?: string;
      isFavorite?: boolean;
      songIds?: string[];
    }
  ): Promise<(PlaylistData & { songs: UnifiedTrack[]; songCount: number; totalDurationMs: number }) | null> {
    const existing = await this.getPlaylistById(playlistId, userId);
    if (!existing) return null;

    const nextSongIds = Array.isArray(updates.songIds) ? [...updates.songIds] : existing.songIds;

    const updatedPl: PlaylistData = {
      ...existing,
      name: updates.name !== undefined ? updates.name : existing.name,
      description: updates.description !== undefined ? updates.description : existing.description,
      artworkUrl: updates.artworkUrl !== undefined ? updates.artworkUrl : existing.artworkUrl,
      isFavorite: updates.isFavorite !== undefined ? updates.isFavorite : existing.isFavorite,
      songIds: nextSongIds,
      updatedAt: new Date().toISOString()
    };

    syncStore.playlists.set(playlistId, updatedPl);

    // Persist in Supabase
    if (this.isConfigured()) {
      try {
        await this.supabaseRequest('playlists', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(playlistId)}&user_id=eq.${encodeURIComponent(userId)}`,
          body: {
            name: updatedPl.name,
            description: updatedPl.description || null,
            artwork_url: updatedPl.artworkUrl || null,
            is_favorite: updatedPl.isFavorite,
            updated_at: updatedPl.updatedAt
          }
        });

        // If songIds were updated, update playlist_songs order
        if (Array.isArray(updates.songIds)) {
          // Delete existing entries and re-insert in exact order
          await this.supabaseRequest('playlist_songs', {
            method: 'DELETE',
            query: `playlist_id=eq.${encodeURIComponent(playlistId)}`
          });

          for (let i = 0; i < nextSongIds.length; i++) {
            await this.supabaseRequest('playlist_songs', {
              method: 'POST',
              prefer: 'resolution=merge-duplicates',
              body: {
                playlist_id: playlistId,
                song_id: nextSongIds[i],
                order_index: i,
                added_at: new Date().toISOString()
              }
            }).catch(() => {});
          }
        }
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabasePlaylistsService] updatePlaylist error:', err?.message || err);
        }
      }
    }

    return this.getPlaylistById(playlistId, userId);
  }

  /**
   * Delete a playlist and its associations
   */
  public static async deletePlaylist(playlistId: string, userId: string): Promise<boolean> {
    const existing = syncStore.getPlaylistById(playlistId);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    syncStore.deletePlaylist(playlistId);

    if (this.isConfigured()) {
      try {
        await this.supabaseRequest('playlist_songs', {
          method: 'DELETE',
          query: `playlist_id=eq.${encodeURIComponent(playlistId)}`
        });
        await this.supabaseRequest('playlists', {
          method: 'DELETE',
          query: `id=eq.${encodeURIComponent(playlistId)}&user_id=eq.${encodeURIComponent(userId)}`
        });
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabasePlaylistsService] deletePlaylist error:', err?.message || err);
        }
      }
    }

    return true;
  }
}
