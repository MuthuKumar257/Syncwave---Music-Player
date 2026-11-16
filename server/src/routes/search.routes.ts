import { Router, Request, Response } from 'express';
import { Readable } from 'node:stream';
import { SearchAggregatorService } from '../services/search/searchAggregator.service';
import { KNOWN_INDIAN_MOVIES, COMPOSER_ALIASES, KNOWN_TRACK_VIDEO_MAP } from '../services/search/indianCinema.helper';
import { ARTISTS_CATALOG } from '../services/recommendation/artistCatalog.data';
import { YouTubeProvider } from '../services/search/youtube.provider';
import { AppleMusicProvider } from '../services/search/appleMusic.provider';
import {
  isPreviewOrSampleUrl,
  isSafePublicHttpsUrl,
  isWebpageOnlyUrl,
  resolveFullDownloadSource
} from '../services/download/fullAudioResolver.service';

const router = Router();

/**
 * GET /api/search?q=...&type=...&platform=...&language=...&year=...
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const query = (req.query.q as string) || '';
  const type = (req.query.type as string) || undefined;
  const platform = (req.query.platform as string) || undefined;
  const language = (req.query.language as string) || undefined;
  const limit = parseInt(req.query.limit as string) || 15;

  if (!query.trim()) {
    res.json({
      success: true,
      query: '',
      intent: 'GENERAL',
      language: 'Other',
      movies: [],
      songs: [],
      totalResults: 0
    });
    return;
  }

  try {
    const results = await SearchAggregatorService.search(query, {
      type,
      platform,
      language,
      limit
    });

    res.json({
      success: true,
      ...results
    });
  } catch (err: any) {
    console.error('Universal search error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process universal search request',
      error: err.message
    });
  }
});

/**
 * GET /api/movies/:id/soundtracks
 */
router.get('/movies/:id/soundtracks', async (req: Request, res: Response): Promise<void> => {
  try {
    const soundtrack = await SearchAggregatorService.getMovieSoundtrackById(req.params.id);
    if (!soundtrack) {
      res.status(404).json({
        success: false,
        message: 'Soundtrack not found for specified movie ID'
      });
      return;
    }

    res.json({
      success: true,
      soundtrack
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve soundtrack',
      error: err.message
    });
  }
});

/**
 * GET /api/songs/:id/versions?title=...&artist=...
 */
router.get('/songs/:id/versions', async (req: Request, res: Response): Promise<void> => {
  const title = (req.query.title as string) || req.params.id.replace(/_/g, ' ');
  const artist = (req.query.artist as string) || '';

  try {
    const versions = await SearchAggregatorService.getSongVersions(title, artist);
    res.json({
      success: true,
      songTitle: title,
      artist,
      versions
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve song versions',
      error: err.message
    });
  }
});

/**
 * GET /api/artists/:id/songs
 */
router.get('/artists/:id/songs', async (req: Request, res: Response): Promise<void> => {
  const artistName = req.params.id.replace(/_/g, ' ');

  try {
    const results = await SearchAggregatorService.search(`${artistName} songs`, {
      type: 'SONG',
      limit: 20
    });

    res.json({
      success: true,
      artistName,
      songs: results.songs
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve artist songs',
      error: err.message
    });
  }
});

/**
 * GET /api/search/suggestions?q=...
 */
router.get('/suggestions', (req: Request, res: Response): void => {
  const q = ((req.query.q as string) || '').toLowerCase().trim();
  if (!q) {
    // Return trending suggestions
    res.json({
      success: true,
      query: '',
      suggestions: [
        { text: 'Vaaranam Aayiram', type: 'MOVIE', subtitle: 'Harris Jayaraj • Tamil' },
        { text: 'Nenjukkul Peidhidum', type: 'SONG', subtitle: 'Hariharan • Vaaranam Aayiram' },
        { text: 'Leo', type: 'MOVIE', subtitle: 'Anirudh Ravichander • Tamil' },
        { text: 'Naa Ready', type: 'SONG', subtitle: 'Vijay, Anirudh • Leo' },
        { text: 'Chaleya', type: 'SONG', subtitle: 'Arijit Singh • Jawan' },
        { text: 'Ala Vaikunthapurramuloo', type: 'MOVIE', subtitle: 'Thaman S • Telugu' },
        { text: 'A. R. Rahman', type: 'ARTIST', subtitle: 'Composer & Producer' }
      ]
    });
    return;
  }

  const matches: any[] = [];

  // Match known movies
  for (const movie of KNOWN_INDIAN_MOVIES) {
    if (
      movie.movieName.toLowerCase().includes(q) ||
      movie.aliases.some((a) => a.toLowerCase().includes(q))
    ) {
      matches.push({
        text: movie.movieName,
        type: 'MOVIE',
        subtitle: `${movie.composer} • ${movie.language} (${movie.year})`
      });
    }

    // Match track titles inside movie
    for (const track of movie.trackTitles) {
      if (track.toLowerCase().includes(q)) {
        matches.push({
          text: track,
          type: 'SONG',
          subtitle: `${movie.composer} • ${movie.movieName}`
        });
      }
    }
  }

  // Match composers
  for (const [canonical, aliases] of Object.entries(COMPOSER_ALIASES)) {
    if (canonical.toLowerCase().includes(q) || aliases.some((a) => a.includes(q))) {
      matches.push({
        text: canonical,
        type: 'ARTIST',
        subtitle: 'Music Director / Composer'
      });
    }
  }

  // Match curated singers & music directors from artist catalog
  for (const artist of ARTISTS_CATALOG) {
    if (artist.name.toLowerCase().includes(q)) {
      matches.push({
        text: artist.name,
        type: 'ARTIST',
        subtitle: `${artist.roleTitle} • ${artist.languages.slice(0, 2).join(', ')}`
      });
    }
    for (const track of artist.popularTracks) {
      if (track.toLowerCase().includes(q)) {
        matches.push({
          text: track,
          type: 'SONG',
          subtitle: `${artist.name} (${artist.roleTitle})`
        });
      }
    }
  }

  // Match lead singers listed inside movie soundtracks
  for (const movie of KNOWN_INDIAN_MOVIES) {
    for (const singer of movie.leadSingers) {
      if (singer.toLowerCase().includes(q)) {
        matches.push({
          text: singer,
          type: 'ARTIST',
          subtitle: `Playback Singer • ${movie.movieName}`
        });
      }
    }
  }

  // Deduplicate by text
  const unique = matches.filter(
    (item, index, self) => index === self.findIndex((t) => t.text.toLowerCase() === item.text.toLowerCase())
  );

  res.json({
    success: true,
    query: q,
    suggestions: unique.slice(0, 8)
  });
});

/**
 * GET /api/search/platforms
 */
router.get('/platforms', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    platforms: [
      {
        id: 'YOUTUBE',
        name: 'YouTube Music & Videos',
        badgeColor: '#EF4444',
        supportsPlaylists: true,
        supportsVideos: true,
        playbackMethod: 'OFFICIAL_EMBED'
      },
      {
        id: 'SPOTIFY',
        name: 'Spotify Web Catalog',
        badgeColor: '#22C55E',
        supportsPlaylists: true,
        supportsVideos: false,
        playbackMethod: 'PREVIEW_AND_DEEP_LINK'
      },
      {
        id: 'APPLE_MUSIC',
        name: 'Apple Music / iTunes',
        badgeColor: '#FA2D48',
        supportsPlaylists: true,
        supportsVideos: false,
        playbackMethod: 'DIRECT_AUDIO_PREVIEW'
      },
      {
        id: 'MUSICBRAINZ',
        name: 'MusicBrainz Encyclopedic Catalog',
        badgeColor: '#BA68C8',
        supportsPlaylists: false,
        supportsVideos: false,
        playbackMethod: 'METADATA_DISCOVERY'
      }
    ],
    supportedLanguages: [
      'Tamil',
      'Telugu',
      'Hindi',
      'Malayalam',
      'Kannada',
      'Bengali',
      'Marathi',
      'Punjabi',
      'English'
    ]
  });
});

/**
 * GET /api/search/resolve-stream?title=...&artist=...&excludeVideoId=...
 * Resolves any song to an embeddable FULL YouTube video stream (full length, NOT 30s)
 */
router.get('/resolve-stream', async (req: Request, res: Response): Promise<void> => {
  const title = ((req.query.title as string) || '').trim();
  const artist = ((req.query.artist as string) || '').trim();
  const excludeRaw = ((req.query.excludeVideoId as string) || '').trim();
  const excludedIds = new Set(
    excludeRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

  if (!title) {
    res.status(400).json({ success: false, message: 'Song title is required' });
    return;
  }

  // 1. Check curated catalog map first (unless excluded after an embed failure)
  const knownVideoId = KNOWN_TRACK_VIDEO_MAP[title];
  if (knownVideoId && !excludedIds.has(knownVideoId)) {
    res.json({
      success: true,
      videoId: knownVideoId,
      embedUrl: `https://www.youtube.com/embed/${knownVideoId}`,
      sourceUrl: `https://www.youtube.com/watch?v=${knownVideoId}`,
      title,
      artist,
      durationMs: 250000,
      isFullSong: true
    });
    return;
  }

  // 2. Query YouTube for an embeddable full song / lyric audio stream
  try {
    const queries = [
      `${title} ${artist} official full song`.trim(),
      `${title} ${artist} audio lyric song`.trim()
    ];

    for (const query of queries) {
      const results = await YouTubeProvider.searchTracks(query, 6);
      const candidates = results.filter((r) => r.videoId && !excludedIds.has(r.videoId));
      if (candidates.length === 0) continue;

      const checks = await Promise.all(
        candidates.slice(0, 4).map(async (c) => ({
          track: c,
          ok: await YouTubeProvider.isEmbeddable(c.videoId)
        }))
      );

      const playable = checks.find((c) => c.ok)?.track;
      if (playable) {
        res.json({
          success: true,
          videoId: playable.videoId,
          embedUrl: playable.embedUrl,
          sourceUrl: playable.externalUrl,
          title: playable.title,
          artist: playable.channelTitle,
          durationMs: playable.durationMs,
          isFullSong: true
        });
        return;
      }
    }
  } catch (err: any) {
    console.warn('[resolve-stream] YouTube resolution error:', err);
  }

  res.status(404).json({
    success: false,
    message: 'No embeddable YouTube stream found for track.'
  });
});

/**
 * GET /api/search/resolve-audio?title=...&artist=...
 * Resolves a direct M4A/MP3 audio stream URL for playback, explicitly reporting preview vs full-song status.
 */
router.get('/resolve-audio', async (req: Request, res: Response): Promise<void> => {
  const title = ((req.query.title as string) || '').trim();
  const artist = ((req.query.artist as string) || '').trim();

  if (!title) {
    res.status(400).json({ success: false, message: 'Song title is required' });
    return;
  }

  try {
    const queries = artist ? [`${title} ${artist}`.trim(), title] : [title];
    for (const query of queries) {
      const tracks = await AppleMusicProvider.searchTracks(query, 8);
      const withAudio = tracks.find((t) => Boolean(t.previewUrl));
      if (withAudio?.previewUrl) {
        const preview = isPreviewOrSampleUrl(withAudio.previewUrl);
        res.json({
          success: true,
          audioUrl: withAudio.previewUrl,
          title: withAudio.title,
          artist: withAudio.artist,
          artworkUrl: withAudio.artworkUrl,
          durationMs: withAudio.durationMs,
          isPreview: preview,
          downloadAllowed: !preview,
          downloadReason: preview
            ? 'Catalog source provides a 30-second preview clip only; full-song downloading is blocked to prevent saving partial audio.'
            : undefined
        });
        return;
      }
    }
  } catch (err) {
    console.warn('[resolve-audio] iTunes audio lookup failed:', err);
  }

  res.status(404).json({ success: false, message: 'Direct audio stream not found for track.' });
});

/**
 * GET /api/search/download-check
 * Checks whether a track has a verifiable full-length downloadable audio file.
 * Strictly rejects 15s/30s previews and stream-only platforms with clear reasons.
 */
router.get('/download-check', async (req: Request, res: Response): Promise<void> => {
  const title = ((req.query.title as string) || '').trim();
  if (!title) {
    res.status(400).json({ success: false, message: 'Track title is required' });
    return;
  }

  const expectedDurationMs = Number(req.query.expectedDurationMs || 0);
  const result = await resolveFullDownloadSource({
    title,
    artist: ((req.query.artist as string) || '').trim() || undefined,
    sourceUrl: ((req.query.sourceUrl as string) || '').trim() || undefined,
    previewUrl: ((req.query.previewUrl as string) || '').trim() || undefined,
    fullAudioUrl: ((req.query.fullAudioUrl as string) || '').trim() || undefined,
    sourcePlatform: ((req.query.sourcePlatform as string) || '').trim() || undefined,
    expectedDurationMs: Number.isFinite(expectedDurationMs) ? expectedDurationMs : 0
  });

  res.json({
    success: result.downloadable,
    ...result
  });
});

/**
 * GET /api/search/download-stream?url=...&expectedDurationMs=...
 * Streams full-length audio with HTTP Range (206 Partial Content) support for resumable downloads.
 * Rejects preview URLs, webpage URLs, unsafe internal URLs, and HTML/JSON error responses.
 */
router.get('/download-stream', async (req: Request, res: Response): Promise<void> => {
  const targetUrl = ((req.query.url as string) || '').trim();
  const expectedDurationMs = Number(req.query.expectedDurationMs || 0);

  if (!targetUrl) {
    res.status(400).json({ success: false, code: 'MISSING_URL', message: 'Download URL is required.' });
    return;
  }

  if (isPreviewOrSampleUrl(targetUrl)) {
    res.status(422).json({
      success: false,
      code: 'PREVIEW_ONLY',
      message: 'Preview or sample audio URLs cannot be downloaded as full-length songs.'
    });
    return;
  }

  if (isWebpageOnlyUrl(targetUrl)) {
    res.status(422).json({
      success: false,
      code: 'STREAM_ONLY',
      message: 'This source is stream-only and does not permit direct full-song downloads.'
    });
    return;
  }

  if (!isSafePublicHttpsUrl(targetUrl)) {
    res.status(400).json({
      success: false,
      code: 'INVALID_URL',
      message: 'Only public HTTPS audio URLs can be downloaded.'
    });
    return;
  }

  try {
    const upstreamHeaders: Record<string, string> = {};
    const rangeHeader = req.headers.range;
    if (typeof rangeHeader === 'string' && /^bytes=\d+-\d*$/.test(rangeHeader.trim())) {
      upstreamHeaders['Range'] = rangeHeader.trim();
    }

    // Safe redirect handler (max 3 hops) ensuring every redirect target complies with isSafePublicHttpsUrl (Critical C2 fix)
    let currentUrl = targetUrl;
    let redirectCount = 0;
    const maxRedirects = 3;
    let upstream: globalThis.Response | null = null;

    while (redirectCount <= maxRedirects) {
      if (!isSafePublicHttpsUrl(currentUrl)) {
        res.status(400).json({
          success: false,
          code: 'UNSAFE_REDIRECT',
          message: 'Redirect destination is not a safe public HTTPS URL.'
        });
        return;
      }

      const resAttempt = await fetch(currentUrl, {
        headers: upstreamHeaders,
        redirect: 'manual',
        signal: AbortSignal.timeout(30000)
      });

      if ([301, 302, 303, 307, 308].includes(resAttempt.status)) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          res.status(502).json({
            success: false,
            code: 'TOO_MANY_REDIRECTS',
            message: 'Audio upstream exceeded maximum redirect limit.'
          });
          return;
        }

        const location = resAttempt.headers.get('location');
        if (!location) {
          res.status(502).json({
            success: false,
            code: 'INVALID_REDIRECT',
            message: 'Upstream redirect missing location header.'
          });
          return;
        }

        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          res.status(400).json({
            success: false,
            code: 'MALFORMED_REDIRECT_URL',
            message: 'Redirect location URL is malformed.'
          });
          return;
        }
        continue;
      }

      upstream = resAttempt;
      break;
    }

    if (!upstream) {
      res.status(502).json({ success: false, code: 'NO_RESPONSE', message: 'No response from upstream audio server.' });
      return;
    }

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({
        success: false,
        code: 'UPSTREAM_ERROR',
        message: `Upstream audio server returned HTTP ${upstream.status}.`
      });
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      res.status(422).json({
        success: false,
        code: 'NON_AUDIO_RESPONSE',
        message: `Source returned non-audio content (${contentType}).`
      });
      return;
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
    res.setHeader('Accept-Ranges', acceptRanges);

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (expectedDurationMs > 0 && Number.isFinite(expectedDurationMs)) {
      res.setHeader('X-Expected-Duration-Ms', String(Math.round(expectedDurationMs)));
    }

    if (!upstream.body) {
      res.status(502).json({ success: false, message: 'Empty audio response body.' });
      return;
    }

    const nodeStream = Readable.fromWeb(upstream.body as any);
    req.on('close', () => {
      nodeStream.destroy();
    });
    nodeStream.on('error', () => {
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });
    nodeStream.pipe(res);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        code: 'NETWORK_ERROR',
        message: err?.message || 'Failed to stream complete audio file.'
      });
    }
  }
});

export default router;
