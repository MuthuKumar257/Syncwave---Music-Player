export interface MusicBrainzRecording {
  id: string;
  title: string;
  artist: string;
  releaseTitle?: string;
  year?: number;
  disambiguation?: string;
  isrc?: string;
  score?: number;
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  artist: string;
  year?: number;
  type?: string; // 'Soundtrack', 'Album', etc.
  trackCount?: number;
}

export class MusicBrainzProvider {
  private static readonly BASE_URL = 'https://musicbrainz.org/ws/2';
  private static readonly USER_AGENT = 'SyncWaveMusicPlayer/1.0.0 ( https://github.com/syncwave/syncwave )';

  /**
   * Search recordings (tracks) with MusicBrainz metadata
   */
  static async searchRecordings(query: string, limit: number = 8): Promise<MusicBrainzRecording[]> {
    if (!query.trim()) return [];

    try {
      const url = `${this.BASE_URL}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/json'
        }
      });

      if (!res.ok) return [];

      const data: any = await res.json();
      const recordings = data.recordings || [];

      return recordings.map((rec: any) => {
        const artist = rec['artist-credit']?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
        const primaryRelease = rec.releases?.[0];
        const dateStr = primaryRelease?.date || rec['first-release-date'] || '';
        const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : undefined;
        const isrc = rec.isrcs?.[0];

        return {
          id: rec.id,
          title: rec.title,
          artist,
          releaseTitle: primaryRelease?.title,
          year: !isNaN(year as number) ? year : undefined,
          disambiguation: rec.disambiguation || primaryRelease?.disambiguation,
          isrc,
          score: rec.score
        };
      });
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        console.warn(`[MusicBrainz] Search timed out (6s), continuing with remaining sources.`);
      } else {
        console.warn('[MusicBrainz] Search recordings failed:', err?.message || err);
      }
      return [];
    }
  }

  /**
   * Search releases / soundtrack albums
   */
  static async searchSoundtracks(query: string, limit: number = 5): Promise<MusicBrainzRelease[]> {
    if (!query.trim()) return [];

    try {
      const q = `${query} AND (tag:soundtrack OR type:soundtrack)`;
      const url = `${this.BASE_URL}/release-group?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/json'
        }
      });

      if (!res.ok) return [];

      const data: any = await res.json();
      const groups = data['release-groups'] || [];

      return groups.map((g: any) => {
        const artist = g['artist-credit']?.map((a: any) => a.name).join(', ') || 'Various Artists';
        const dateStr = g['first-release-date'] || '';
        const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : undefined;

        return {
          id: g.id,
          title: g.title,
          artist,
          year: !isNaN(year as number) ? year : undefined,
          type: g['primary-type'] || 'Soundtrack'
        };
      });
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        console.warn(`[MusicBrainz] Soundtracks search timed out (6s), continuing with remaining sources.`);
      } else {
        console.warn('[MusicBrainz] Search soundtracks failed:', err?.message || err);
      }
      return [];
    }
  }
}
