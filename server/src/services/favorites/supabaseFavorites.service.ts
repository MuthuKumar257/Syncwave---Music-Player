import { syncStore } from '../../db/store';
import { RecommendationEngineService } from '../recommendation/recommendationEngine.service';

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
   * Fetch favorite song IDs for a given authenticated user from Supabase
   */
  static async getUserFavoriteIds(userId: string): Promise<string[]> {
    if (!userId || !this.getCredentials()) return [];

    try {
      const rows = await this.supabaseRequest<Array<{ target_id: string; song_id?: string }>>(
        'favorites',
        {
          method: 'GET',
          query: `user_id=eq.${encodeURIComponent(userId)}&select=target_id&order=added_at.desc`
        }
      );
      if (Array.isArray(rows)) {
        return rows.map((r) => r.target_id || r.song_id!).filter(Boolean);
      }
    } catch (err: any) {
      // Graceful fallback: table might not exist yet in Supabase
      if (!err?.message?.includes('PGRST205')) {
        console.warn('[SupabaseFavoritesService] getUserFavoriteIds error:', err?.message || err);
      }
    }

    return [];
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
    }
  ): Promise<boolean> {
    if (!userId || !targetId || !this.getCredentials()) return false;

    try {
      await this.supabaseRequest('favorites', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: {
          user_id: userId,
          target_id: targetId,
          target_type: 'SONG',
          song_title: metadata?.title || undefined,
          artist_name: metadata?.artist || undefined,
          artwork_url: metadata?.artworkUrl || undefined,
          duration_ms: metadata?.durationMs || undefined,
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
    if (!userId || !targetId || !this.getCredentials()) return false;

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
