import { SongVersionType, IndianCinemaHelper } from './indianCinema.helper';

export interface YouTubeTrackResult {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  durationMs: number;
  artworkUrl: string;
  externalUrl: string;
  embedUrl: string;
  versionType: SongVersionType;
  isOfficial: boolean;
}

export class YouTubeProvider {
  /**
   * Search YouTube videos with version classification
   */
  static async searchTracks(query: string, limit: number = 12): Promise<YouTubeTrackResult[]> {
    if (!query.trim()) return [];

    try {
      // If YouTube Data API Key is configured, use official v3 endpoint
      if (process.env.YOUTUBE_API_KEY) {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=${limit}&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data: any = await res.json();
          return (data.items || []).map((item: any) => {
            const title = item.snippet?.title || '';
            const channel = item.snippet?.channelTitle || '';
            const versionType = IndianCinemaHelper.classifyVersion(title, channel);
            const isOfficial =
              /\b(vevo|official|channel|music|records|audio)\b/i.test(channel) ||
              /\b(official\s+video|official\s+audio)\b/i.test(title);

            return {
              id: `yt_${item.id?.videoId}`,
              videoId: item.id?.videoId,
              title,
              channelTitle: channel,
              durationMs: 210000,
              artworkUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
              externalUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
              embedUrl: `https://www.youtube.com/embed/${item.id?.videoId}`,
              versionType,
              isOfficial
            };
          });
        }
      }

      // Live search parsing with rich metadata
      const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

      const tracks: YouTubeTrackResult[] = [];
      for (const item of contents) {
        const vr = item.videoRenderer;
        if (!vr || !vr.videoId) continue;

        const title = vr.title?.runs?.[0]?.text || '';
        const channel = vr.ownerText?.runs?.[0]?.text || '';
        const durationStr = vr.lengthText?.simpleText || '3:30';
        const parts = durationStr.split(':').map(Number);
        const durationMs = parts.length === 2 ? (parts[0] * 60 + parts[1]) * 1000 : 210000;
        const thumbnail =
          vr.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

        const versionType = IndianCinemaHelper.classifyVersion(title, channel);
        const isOfficial =
          /\b(vevo|official|music|records|audio|sony|tseries|sun|lahari|aditya)\b/i.test(channel) ||
          /\b(official\s+video|official\s+audio)\b/i.test(title);

        tracks.push({
          id: `yt_${vr.videoId}`,
          videoId: vr.videoId,
          title,
          channelTitle: channel,
          durationMs,
          artworkUrl: thumbnail,
          externalUrl: `https://www.youtube.com/watch?v=${vr.videoId}`,
          embedUrl: `https://www.youtube.com/embed/${vr.videoId}`,
          versionType,
          isOfficial
        });

        if (tracks.length >= limit) break;
      }

      return tracks;
    } catch (err) {
      console.warn('[YouTubeProvider] Track search failed:', err);
      return [];
    }
  }

  /**
   * Search specifically for versions of a song: Cover, Live, Remix, Instrumental
   */
  static async searchSongVersions(songTitle: string, artistName: string = ''): Promise<{
    original: YouTubeTrackResult[];
    videos: YouTubeTrackResult[];
    live: YouTubeTrackResult[];
    covers: YouTubeTrackResult[];
    remixes: YouTubeTrackResult[];
    instrumental: YouTubeTrackResult[];
  }> {
    const baseQuery = `${songTitle} ${artistName}`.trim();
    const tracks = await this.searchTracks(baseQuery, 16);

    const original: YouTubeTrackResult[] = [];
    const videos: YouTubeTrackResult[] = [];
    const live: YouTubeTrackResult[] = [];
    const covers: YouTubeTrackResult[] = [];
    const remixes: YouTubeTrackResult[] = [];
    const instrumental: YouTubeTrackResult[] = [];

    for (const t of tracks) {
      switch (t.versionType) {
        case 'OFFICIAL_VIDEO':
          videos.push(t);
          break;
        case 'LIVE':
          live.push(t);
          break;
        case 'COVER':
          covers.push(t);
          break;
        case 'REMIX':
          remixes.push(t);
          break;
        case 'INSTRUMENTAL':
        case 'BGM':
        case 'KARAOKE':
          instrumental.push(t);
          break;
        default:
          original.push(t);
          break;
      }
    }

    if (original.length === 0 && tracks.length > 0) {
      original.push({ ...tracks[0], versionType: 'ORIGINAL' });
    }

    return {
      original,
      videos,
      live,
      covers,
      remixes,
      instrumental
    };
  }

  /**
   * Checks whether a YouTube video allows embedded playback cleanly (avoids Error 101/150/100).
   */
  static async isEmbeddable(videoId: string): Promise<boolean> {
    const cleanId = videoId.trim();
    if (!cleanId) return false;
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}`, {
        signal: AbortSignal.timeout(3500),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      if (!res.ok) return true;
      const html = await res.text();
      if (/"playableInEmbed"\s*:\s*false/i.test(html)) return false;
      if (/"status"\s*:\s*"(?:ERROR|UNPLAYABLE|LOGIN_REQUIRED)"/i.test(html)) return false;
      return true;
    } catch {
      // Fail-open on transient network timeouts/offline test environments
      return true;
    }
  }
}
