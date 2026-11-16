export interface OpenAudioTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string;
  fullAudioUrl: string;
  externalUrl: string;
  fileFormat: string;
  fileSizeBytes?: number;
  license?: string;
}

const ARCHIVE_FORMAT_PRIORITY: Array<{ match: RegExp; format: string; score: number }> = [
  { match: /^flac$/i, format: 'FLAC', score: 6 },
  { match: /^apple lossless|alac$/i, format: 'ALAC', score: 5 },
  { match: /^24bit flac$/i, format: 'FLAC', score: 7 },
  { match: /^(vbr mp3|320kbps mp3|mp3)$/i, format: 'MP3', score: 4 },
  { match: /^(m4a|aac|mpeg-4 audio)$/i, format: 'M4A', score: 3 },
  { match: /^ogg vorbis$/i, format: 'OGG', score: 2 },
  { match: /^(wave|wav)$/i, format: 'WAV', score: 2 }
];

function parseArchiveDurationToMs(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1000 ? Math.round(raw) : Math.round(raw * 1000);
  }
  const str = String(raw || '').trim();
  if (!str) return 0;
  if (/^\d+(\.\d+)?$/.test(str)) {
    return Math.round(parseFloat(str) * 1000);
  }
  const parts = str.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000);
  if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
  return 0;
}

export class OpenAudioProvider {
  static async searchTracks(query: string, limit: number = 6): Promise<OpenAudioTrack[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const results: OpenAudioTrack[] = [];

    // 1. Official Jamendo Creative Commons v3.0 API when configured
    const jamendoClientId = process.env.JAMENDO_CLIENT_ID;
    if (jamendoClientId) {
      try {
        const jamendoUrl =
          `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(jamendoClientId)}` +
          `&format=json&limit=${limit}&search=${encodeURIComponent(cleanQuery)}&audioformat=mp32`;
        const res = await fetch(jamendoUrl, { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const data: any = await res.json();
          for (const item of data.results || []) {
            const durationMs = Number(item.duration || 0) * 1000;
            const dlUrl = item.audiodownload_allowed ? item.audiodownload || item.audio : '';
            if (!dlUrl || durationMs < 45000) continue;
            results.push({
              id: `jamendo_${item.id}`,
              title: item.name || 'Untitled Track',
              artist: item.artist_name || 'Jamendo Artist',
              album: item.album_name || 'Jamendo CC',
              durationMs,
              artworkUrl: item.album_image || item.image || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
              fullAudioUrl: dlUrl,
              externalUrl: item.shareurl || dlUrl,
              fileFormat: 'MP3',
              license: item.license_ccurl || 'Creative Commons'
            });
          }
        }
      } catch {
        // Non-fatal; continue to Internet Archive
      }
    }

    if (results.length >= limit) return results.slice(0, limit);

    // 2. Internet Archive public full-length audio API (public domain / open license)
    try {
      const searchQ = `mediatype:audio AND (subject:music OR collection:opensource_audio OR collection:audio_music) AND (${cleanQuery})`;
      const searchUrl =
        `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchQ)}` +
        `&fl[]=identifier,title,creator&rows=4&output=json`;

      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(2200) });
      if (!searchRes.ok) return results;

      const searchJson: any = await searchRes.json();
      const docs: any[] = searchJson.response?.docs || [];

      const metaList = await Promise.all(
        docs.slice(0, 3).map(async (doc) => {
          try {
            const metaRes = await fetch(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`, {
              signal: AbortSignal.timeout(2200)
            });
            if (!metaRes.ok) return null;
            return { doc, meta: await metaRes.json() };
          } catch {
            return null;
          }
        })
      );

      for (const entry of metaList) {
        if (!entry) continue;
        const { doc, meta } = entry;
        const files: any[] = Array.isArray(meta?.files) ? meta.files : [];

        // Group files by stem so we pick the highest quality format per song without duplicates
        const bestByStem = new Map<string, { file: any; format: string; score: number; durationMs: number }>();

        for (const f of files) {
          const name = String(f.name || '');
          if (!name || name.startsWith('_') || /sample|preview|snippet/i.test(name)) continue;
          const formatRule = ARCHIVE_FORMAT_PRIORITY.find((r) => r.match.test(String(f.format || '')));
          if (!formatRule) continue;

          const durationMs = parseArchiveDurationToMs(f.length);
          if (durationMs < 45000) continue; // Never return <45s previews/clips

          const stem = name.replace(/\.[^/.]+$/, '').toLowerCase();
          const currentBest = bestByStem.get(stem);
          if (!currentBest || formatRule.score > currentBest.score) {
            bestByStem.set(stem, { file: f, format: formatRule.format, score: formatRule.score, durationMs });
          }
        }

        for (const chosen of bestByStem.values()) {
          if (results.length >= limit) break;
          const fileName = String(chosen.file.name);
          const encodedPath = fileName.split('/').map(encodeURIComponent).join('/');
          const rawTitle = chosen.file.title || doc.title || fileName.replace(/\.[^/.]+$/, '');
          const artist =
            chosen.file.artist ||
            chosen.file.creator ||
            (Array.isArray(doc.creator) ? doc.creator[0] : doc.creator) ||
            'Archive Audio';

          results.push({
            id: `ia_${doc.identifier}_${fileName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32)}`,
            title: String(rawTitle),
            artist: String(artist),
            album: String(doc.title || 'Open Audio Archive'),
            durationMs: chosen.durationMs,
            artworkUrl: `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`,
            fullAudioUrl: `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodedPath}`,
            externalUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
            fileFormat: chosen.format,
            fileSizeBytes: chosen.file.size ? parseInt(String(chosen.file.size), 10) : undefined,
            license: meta?.metadata?.licenseurl || 'Public Domain / Open Audio'
          });
        }
      }
    } catch {
      // Return whatever open tracks resolved within timeout
    }

    return results.slice(0, limit);
  }
}
