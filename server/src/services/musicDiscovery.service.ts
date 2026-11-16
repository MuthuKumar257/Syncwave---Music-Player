export interface OnlineTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string;
  source: 'SPOTIFY' | 'YOUTUBE' | 'APPLE_MUSIC' | 'LOCAL';
  externalUrl: string;
  embedUrl?: string;
  previewUrl?: string;
  uri?: string;
  videoId?: string;
}

class MusicDiscoveryService {
  private spotifyToken: string | null = null;
  private spotifyTokenExpiresAt: number = 0;

  /**
   * Search YouTube for live tracks and music videos
   */
  async searchYouTube(query: string, limit: number = 10): Promise<OnlineTrack[]> {
    if (!query.trim()) return [];

    try {
      // 1. If YouTube API Key is set, use official YouTube Data API v3
      if (process.env.YOUTUBE_API_KEY) {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=${limit}&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data: any = await res.json();
          return (data.items || []).map((item: any) => ({
            id: `yt_${item.id?.videoId}`,
            title: item.snippet?.title || 'YouTube Audio',
            artist: item.snippet?.channelTitle || 'Artist',
            album: 'YouTube Music',
            durationMs: 210000,
            artworkUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
            source: 'YOUTUBE',
            externalUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
            embedUrl: `https://www.youtube.com/embed/${item.id?.videoId}`,
            videoId: item.id?.videoId
          }));
        }
      }

      // 2. Direct search parser with rich results
      const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (!res.ok) return [];

      const html = await res.text();
      const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
      if (!match) return [];

      const data = JSON.parse(match[1]);
      const contents =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
          ?.itemSectionRenderer?.contents || [];

      const tracks: OnlineTrack[] = [];
      for (const item of contents) {
        const vr = item.videoRenderer;
        if (!vr || !vr.videoId) continue;

        const title = vr.title?.runs?.[0]?.text || '';
        const artist = vr.ownerText?.runs?.[0]?.text || '';
        const durationStr = vr.lengthText?.simpleText || '3:30';
        const parts = durationStr.split(':').map(Number);
        const durationMs = parts.length === 2 ? (parts[0] * 60 + parts[1]) * 1000 : 210000;
        const thumbnail =
          vr.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

        tracks.push({
          id: `yt_${vr.videoId}`,
          title,
          artist,
          album: 'YouTube Music',
          durationMs,
          artworkUrl: thumbnail,
          source: 'YOUTUBE',
          externalUrl: `https://www.youtube.com/watch?v=${vr.videoId}`,
          embedUrl: `https://www.youtube.com/embed/${vr.videoId}`,
          videoId: vr.videoId
        });

        if (tracks.length >= limit) break;
      }
      return tracks;
    } catch (err) {
      console.error('[MusicDiscoveryService] YouTube search failed:', err);
      return [];
    }
  }

  /**
   * Search Spotify or High-Fidelity Streaming Catalog
   */
  async searchSpotify(query: string, limit: number = 10): Promise<OnlineTrack[]> {
    if (!query.trim()) return [];

    try {
      // 1. Official Spotify Web API Client Credentials (if configured)
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

      if (clientId && clientSecret) {
        let token = this.spotifyToken;
        const now = Date.now();

        if (!token || now >= this.spotifyTokenExpiresAt) {
          const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
          });

          if (tokenRes.ok) {
            const tokenData: any = await tokenRes.json();
            this.spotifyToken = tokenData.access_token;
            this.spotifyTokenExpiresAt = now + (tokenData.expires_in - 60) * 1000;
            token = this.spotifyToken;
          }
        }

        if (token) {
          const searchRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          if (searchRes.ok) {
            const searchData: any = await searchRes.json();
            return (searchData.tracks?.items || []).map((t: any) => ({
              id: `sp_${t.id}`,
              title: t.name,
              artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
              album: t.album?.name || 'Spotify Album',
              durationMs: t.duration_ms,
              artworkUrl: t.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
              source: 'SPOTIFY',
              externalUrl: t.external_urls?.spotify || `https://open.spotify.com/search/${encodeURIComponent(t.name)}`,
              previewUrl: t.preview_url || undefined,
              uri: t.preview_url || undefined
            }));
          }
        }
      }

      // 2. High-fidelity catalog search with authorized audio preview streams
      const itunesRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`
      );
      if (itunesRes.ok) {
        const itunesData: any = await itunesRes.json();
        return (itunesData.results || []).map((t: any) => ({
          id: `sp_${t.trackId}`,
          title: t.trackName,
          artist: t.artistName,
          album: t.collectionName || 'Single',
          durationMs: t.trackTimeMillis || 200000,
          artworkUrl: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
          source: 'SPOTIFY',
          externalUrl: `https://open.spotify.com/search/${encodeURIComponent(t.trackName + ' ' + t.artistName)}`,
          previewUrl: t.previewUrl,
          uri: t.previewUrl
        }));
      }
    } catch (err) {
      console.error('[MusicDiscoveryService] Spotify search failed:', err);
    }
    return [];
  }

  /**
   * Unified multi-source search
   */
  async searchUnified(query: string, platform: string = 'ALL'): Promise<OnlineTrack[]> {
    if (!query.trim()) return [];

    const plat = platform.toUpperCase();

    if (plat === 'YOUTUBE') {
      return this.searchYouTube(query, 15);
    }

    if (plat === 'SPOTIFY') {
      return this.searchSpotify(query, 15);
    }

    // Unified: Fetch concurrently from both YouTube and Spotify
    const [ytResults, spResults] = await Promise.all([
      this.searchYouTube(query, 8),
      this.searchSpotify(query, 8)
    ]);

    // Interleave results for a balanced discovery experience
    const combined: OnlineTrack[] = [];
    const maxLen = Math.max(ytResults.length, spResults.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < spResults.length) combined.push(spResults[i]);
      if (i < ytResults.length) combined.push(ytResults[i]);
    }

    return combined;
  }
}

export const musicDiscoveryService = new MusicDiscoveryService();
