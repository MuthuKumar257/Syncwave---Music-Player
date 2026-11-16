export interface AppleMusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string;
  previewUrl?: string;
  externalUrl: string;
  releaseYear?: number;
  genre?: string;
  isrc?: string;
}

export interface AppleMusicSoundtrack {
  id: string;
  name: string;
  artist: string;
  artworkUrl: string;
  releaseYear?: number;
  trackCount: number;
  genre?: string;
  externalUrl: string;
}

export class AppleMusicProvider {
  private static readonly BASE_URL = 'https://itunes.apple.com';

  /**
   * Search tracks on Apple Music / iTunes catalog
   */
  static async searchTracks(query: string, limit: number = 10): Promise<AppleMusicTrack[]> {
    if (!query.trim()) return [];

    try {
      const url = `${this.BASE_URL}/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];

      const data: any = await res.json();
      const results = data.results || [];

      return results.map((item: any) => {
        const year = item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : undefined;
        const artworkUrl = (item.artworkUrl100 || '').replace('100x100bb', '600x600bb');

        return {
          id: `apple_${item.trackId}`,
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName || 'Single',
          durationMs: item.trackTimeMillis || 180000,
          artworkUrl: artworkUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
          previewUrl: item.previewUrl,
          externalUrl: item.trackViewUrl || item.collectionViewUrl || `https://music.apple.com`,
          releaseYear: !isNaN(year as number) ? year : undefined,
          genre: item.primaryGenreName
        };
      });
    } catch (err) {
      console.warn('[AppleMusicProvider] Track search failed:', err);
      return [];
    }
  }

  /**
   * Search movie albums / soundtracks
   */
  static async searchSoundtracks(query: string, limit: number = 5): Promise<AppleMusicSoundtrack[]> {
    if (!query.trim()) return [];

    try {
      const url = `${this.BASE_URL}/search?term=${encodeURIComponent(query + ' soundtrack')}&entity=album&limit=${limit}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];

      const data: any = await res.json();
      const results = data.results || [];

      return results.map((item: any) => {
        const year = item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : undefined;
        const artworkUrl = (item.artworkUrl100 || '').replace('100x100bb', '600x600bb');

        return {
          id: `apple_col_${item.collectionId}`,
          name: item.collectionName,
          artist: item.artistName,
          artworkUrl: artworkUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
          releaseYear: !isNaN(year as number) ? year : undefined,
          trackCount: item.trackCount || 0,
          genre: item.primaryGenreName,
          externalUrl: item.collectionViewUrl || 'https://music.apple.com'
        };
      });
    } catch (err) {
      console.warn('[AppleMusicProvider] Soundtrack search failed:', err);
      return [];
    }
  }

  /**
   * Lookup complete tracklist of an album / soundtrack
   */
  static async lookupSoundtrackTracks(collectionId: string): Promise<AppleMusicTrack[]> {
    try {
      const cleanId = collectionId.replace('apple_col_', '');
      const url = `${this.BASE_URL}/lookup?id=${cleanId}&entity=song`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];

      const data: any = await res.json();
      const results = (data.results || []).filter((item: any) => item.wrapperType === 'track');

      return results.map((item: any) => {
        const year = item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : undefined;
        const artworkUrl = (item.artworkUrl100 || '').replace('100x100bb', '600x600bb');

        return {
          id: `apple_${item.trackId}`,
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName,
          durationMs: item.trackTimeMillis || 180000,
          artworkUrl: artworkUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
          previewUrl: item.previewUrl,
          externalUrl: item.trackViewUrl || 'https://music.apple.com',
          releaseYear: !isNaN(year as number) ? year : undefined,
          genre: item.primaryGenreName
        };
      });
    } catch (err) {
      console.warn('[AppleMusicProvider] Lookup album tracks failed:', err);
      return [];
    }
  }
}
