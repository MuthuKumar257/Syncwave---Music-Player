export interface SpotifyTrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string;
  previewUrl?: string;
  externalUrl: string;
  releaseYear?: number;
}

export interface SpotifyAlbumResult {
  id: string;
  name: string;
  artist: string;
  artworkUrl: string;
  releaseYear?: number;
  totalTracks: number;
  externalUrl: string;
}

export class SpotifyProvider {
  private static token: string | null = null;
  private static tokenExpiresAt: number = 0;

  private static async getAccessToken(): Promise<string | null> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt) {
      return this.token;
    }

    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (res.ok) {
        const data: any = await res.json();
        this.token = data.access_token;
        this.tokenExpiresAt = now + (data.expires_in - 60) * 1000;
        return this.token;
      }
    } catch (err) {
      console.warn('[SpotifyProvider] Failed to obtain access token:', err);
    }
    return null;
  }

  static async searchTracks(query: string, limit: number = 10): Promise<SpotifyTrackResult[]> {
    if (!query.trim()) return [];

    const token = await this.getAccessToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) return [];

      const data: any = await res.json();
      const items = data.tracks?.items || [];

      return items.map((t: any) => {
        const dateStr = t.album?.release_date || '';
        const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : undefined;

        return {
          id: `sp_${t.id}`,
          title: t.name,
          artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
          album: t.album?.name || 'Spotify Single',
          durationMs: t.duration_ms || 180000,
          artworkUrl:
            t.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
          previewUrl: t.preview_url || undefined,
          externalUrl: t.external_urls?.spotify || `https://open.spotify.com/search/${encodeURIComponent(t.name)}`,
          releaseYear: !isNaN(year as number) ? year : undefined
        };
      });
    } catch (err) {
      console.warn('[SpotifyProvider] Search tracks failed:', err);
      return [];
    }
  }

  static async searchAlbums(query: string, limit: number = 5): Promise<SpotifyAlbumResult[]> {
    if (!query.trim()) return [];

    const token = await this.getAccessToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) return [];

      const data: any = await res.json();
      const items = data.albums?.items || [];

      return items.map((a: any) => {
        const dateStr = a.release_date || '';
        const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : undefined;

        return {
          id: `sp_album_${a.id}`,
          name: a.name,
          artist: a.artists?.map((artist: any) => artist.name).join(', ') || 'Various Artists',
          artworkUrl:
            a.images?.[0]?.url || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
          releaseYear: !isNaN(year as number) ? year : undefined,
          totalTracks: a.total_tracks || 0,
          externalUrl: a.external_urls?.spotify || 'https://open.spotify.com'
        };
      });
    } catch (err) {
      console.warn('[SpotifyProvider] Search albums failed:', err);
      return [];
    }
  }
}
