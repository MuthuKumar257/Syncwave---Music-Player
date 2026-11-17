import { syncStore } from '../../db/store';
import { RecommendationEngineService } from '../recommendation/recommendationEngine.service';
import { UnifiedTrack } from '../search/searchAggregator.service';

interface SupabaseCredentials {
  url: string;
  key: string;
}

export class SupabaseFavoritesService {
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

  private static async supabaseRequest<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
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
      throw new Error(`Supabase favorites error (${res.status}): ${txt}`);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  /**
   * Fetch fully populated favorite song objects for an authenticated user
   */
  static async getUserFavorites(userId: string): Promise<UnifiedTrack[]> {
    if (!userId) return [];

    const creds = this.getCredentials();
    if (creds) {
      try {
        const rows = await this.supabaseRequest<
          Array<{
            target_id: string;
            song_id?: string;
            song_title?: string;
            artist_name?: string;
            artwork_url?: string;
            duration_ms?: number | string;
            composer?: string;
            movie_name?: string;
            language?: string;
            added_at?: string;
          }>
        >('favorites', {
          method: 'GET',
          query: `user_id=eq.${encodeURIComponent(userId)}&order=added_at.desc`
        });

        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((r) => {
            const id = r.target_id || r.song_id || 'unknown';
            const local = syncStore.getSongById(id) || RecommendationEngineService.findTrackById(id);
            return {
              id,
              title: r.song_title || local?.title || id.replace(/_/g, ' '),
              artist: r.artist_name || local?.artist || 'Unknown Artist',
              composer: r.composer || (local as any)?.composer,
              movieName: r.movie_name || (local as any)?.movieName || (local as any)?.album,
              artworkUrl: r.artwork_url || local?.artworkUrl || '',
              durationMs: Number(r.duration_ms) || local?.durationMs || 240000,
              sourcePlatform: ((local as any)?.sourcePlatform || (local as any)?.source || 'OPEN_AUDIO') as any,
              sourceUrl: (local as any)?.sourceUrl || (local as any)?.externalUrl || '',
              isPlayableDirectly: true,
              versionType: 'ORIGINAL' as any,
              language: (r.language as any) || (local as any)?.language
            };
          });
        }
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabaseFavoritesService] getUserFavorites cloud error:', err?.message || err);
        }
      }
    }

    // Fallback: Resolve from local memory / persistent store
    const localIds = syncStore.getUserFavorites(userId);
    return localIds
      .map((id) => {
        const s = syncStore.getSongById(id) || RecommendationEngineService.findTrackById(id);
        if (s) {
          return {
            id: s.id,
            title: s.title,
            artist: s.artist,
            composer: (s as any).composer,
            movieName: (s as any).movieName || (s as any).album,
            artworkUrl: s.artworkUrl || '',
            durationMs: s.durationMs || 240000,
            sourcePlatform: ((s as any).sourcePlatform || (s as any).source || 'OPEN_AUDIO') as any,
            sourceUrl: (s as any).sourceUrl || (s as any).externalUrl || '',
            isPlayableDirectly: true,
            versionType: 'ORIGINAL' as any,
            language: (s as any).language
          };
        }
        return {
          id,
          title: id.replace(/_/g, ' '),
          artist: 'Unknown Artist',
          durationMs: 240000,
          artworkUrl: '',
          sourcePlatform: 'OPEN_AUDIO' as any,
          sourceUrl: '',
          isPlayableDirectly: true,
          versionType: 'ORIGINAL' as any
        };
      });
  }

  /**
   * Fetch favorite song IDs for a given authenticated user from Supabase
   */
  static async getUserFavoriteIds(userId: string): Promise<string[]> {
    if (!userId) return syncStore.getUserFavorites(userId);

    const creds = this.getCredentials();
    if (creds) {
      try {
        const rows = await this.supabaseRequest<Array<{ target_id: string; song_id?: string }>>(
          'favorites',
          {
            method: 'GET',
            query: `user_id=eq.${encodeURIComponent(userId)}&select=target_id&order=added_at.desc`
          }
        );
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((r) => r.target_id || r.song_id!).filter(Boolean);
        }
      } catch (err: any) {
        if (!err?.message?.includes('PGRST205')) {
          console.warn('[SupabaseFavoritesService] getUserFavoriteIds error:', err?.message || err);
        }
      }
    }

    return syncStore.getUserFavorites(userId);
  }

  /**
   * Save a favorite record to Supabase
   */
  static async addFavorite(
    userId: string,
    targetId: string,
    metadata?: {
      title?: string;
      artist?: string;
      artworkUrl?: string;
      durationMs?: number;
      composer?: string;
      movieName?: string;
      language?: string;
    }
  ): Promise<boolean> {
    if (!userId || !targetId) return false;

    // 1. Keep in-memory store synchronized immediately
    syncStore.addFavorite(userId, targetId);
    if (metadata?.title) {
      try {
        syncStore.saveSong({
          id: targetId,
          title: metadata.title,
          artist: metadata.artist || 'Unknown Artist',
          album: metadata.movieName || 'Unknown Album',
          durationMs: metadata.durationMs || 0,
          artworkUrl: metadata.artworkUrl,
          source: 'YOUTUBE',
          createdAt: new Date().toISOString()
        });
      } catch {}
    }

    // 2. Cloud Supabase synchronization
    const creds = this.getCredentials();
    if (!creds) return true;

    try {
      // Upsert master song record first to satisfy any foreign keys
      await this.supabaseRequest('songs', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: {
          id: targetId,
          title: metadata?.title || 'Unknown Title',
          artist: metadata?.artist || 'Unknown Artist',
          artwork_url: metadata?.artworkUrl,
          duration_ms: metadata?.durationMs || 0,
          created_at: new Date().toISOString()
        }
      }).catch(() => {});

      // Insert / merge into favorites
      await this.supabaseRequest('favorites', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: {
          user_id: userId,
          target_id: targetId,
          target_type: 'SONG',
          song_id: targetId,
          song_title: metadata?.title || undefined,
          artist_name: metadata?.artist || undefined,
          artwork_url: metadata?.artworkUrl || undefined,
          duration_ms: metadata?.durationMs || undefined,
          composer: metadata?.composer || undefined,
          movie_name: metadata?.movieName || undefined,
          language: metadata?.language || undefined,
          added_at: new Date().toISOString()
        }
      });
      return true;
    } catch (err: any) {
      if (!err?.message?.includes('PGRST205')) {
        console.warn('[SupabaseFavoritesService] addFavorite error:', err?.message || err);
      }
      return false;
    }
  }

  /**
   * Delete a favorite record from Supabase
   */
  static async removeFavorite(userId: string, targetId: string): Promise<boolean> {
    if (!userId || !targetId) return false;

    // Remove from in-memory store immediately
    syncStore.removeFavorite(userId, targetId);

    const creds = this.getCredentials();
    if (!creds) return true;

    try {
      await this.supabaseRequest('favorites', {
        method: 'DELETE',
        query: `user_id=eq.${encodeURIComponent(userId)}&target_id=eq.${encodeURIComponent(targetId)}`
      });
      return true;
    } catch (err: any) {
      if (!err?.message?.includes('PGRST205')) {
        console.warn('[SupabaseFavoritesService] removeFavorite error:', err?.message || err);
      }
      return false;
    }
  }
}
