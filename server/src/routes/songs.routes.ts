import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { syncStore, SongMetadata } from '../db/store';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { RecommendationEngineService } from '../services/recommendation/recommendationEngine.service';
import {
  normalizeLanguageList,
  isSongLanguageEligible
} from '../utils/languageEligibility';

const router = Router();

const songSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  artist: z.string().default('Unknown Artist'),
  album: z.string().default('Unknown Album'),
  durationMs: z.number().default(0),
  artworkUrl: z.string().optional(),
  source: z.enum(['LOCAL', 'DOWNLOADED', 'SPOTIFY', 'YOUTUBE']).default('LOCAL'),
  externalUrl: z.string().optional()
});

/**
 * Helper to ensure the master catalog is fully ingested and merged with store songs
 */
function getAllMasterSongs(): SongMetadata[] {
  let storeSongs = syncStore.getSongs();
  if (storeSongs.length <= 3) {
    RecommendationEngineService.seedMasterCatalogIntoStore();
    storeSongs = syncStore.getSongs();
  }

  // Deduplicate and ensure all master catalog songs are included with valid language metadata
  const songMap = new Map<string, SongMetadata>();
  for (const s of storeSongs) {
    if (s && s.id) {
      const validLang = s.language || (s as any).languages?.[0] || 'Tamil';
      songMap.set(s.id, {
        ...s,
        language: validLang,
        languages: [validLang]
      });
    }
  }

  const masterCatalog = RecommendationEngineService.getMasterCatalog();
  for (const t of masterCatalog) {
    if (!songMap.has(t.id)) {
      songMap.set(t.id, {
        id: t.id,
        title: t.title,
        artist: t.singers && t.singers.length > 0 ? t.singers.join(', ') : (t.artist || 'Unknown Artist'),
        album: t.movieName || t.album || 'Soundtrack',
        durationMs: t.durationMs || 240000,
        artworkUrl: t.artworkUrl,
        source: (t.sourcePlatform === 'YOUTUBE' ? 'YOUTUBE' : t.sourcePlatform === 'SPOTIFY' ? 'SPOTIFY' : 'LOCAL') as any,
        externalUrl: t.sourceUrl || '',
        language: t.language,
        languages: t.language ? [t.language] : [],
        composer: t.composer,
        movieName: t.movieName,
        movie: t.movieName,
        mood: t.mood,
        genre: t.genre,
        singers: t.singers,
        videoId: t.videoId,
        fullAudioUrl: t.fullAudioUrl,
        previewUrl: t.previewUrl,
        isPlayableDirectly: t.isPlayableDirectly,
        releaseYear: t.releaseYear,
        createdAt: new Date().toISOString()
      });
    }
  }

  return Array.from(songMap.values());
}

/**
 * GET /api/songs
 * Reliable base song feed with normalized language filtering, search, pagination, and safe diagnostics.
 */
router.get('/', optionalAuth, (req: Request, res: Response): void => {
  const userId = (req as AuthenticatedRequest).userId;
  const safeUserId = userId ? `${userId.slice(0, 8)}...` : 'guest_user';
  const allSongs = getAllMasterSongs();

  // Determine language filter
  const langQuery = (req.query.language as string) || (req.query.languages as string) || (req.headers['x-user-languages'] as string) || '';
  let activeLanguages: string[] = [];

  if (langQuery && langQuery !== 'ALL') {
    activeLanguages = normalizeLanguageList(langQuery.split(',').map((l) => l.trim()));
  } else if (req.headers['x-user-languages']) {
    activeLanguages = normalizeLanguageList((req.headers['x-user-languages'] as string).split(',').map((l) => l.trim()));
  } else if (userId) {
    const prefs = syncStore.getUserPreferences(userId);
    if (prefs.preferredLanguages && prefs.preferredLanguages.length > 0) {
      activeLanguages = normalizeLanguageList(prefs.preferredLanguages);
    }
  }

  // Filter by language
  let filtered = allSongs;
  if (activeLanguages.length > 0) {
    filtered = allSongs.filter((s) => isSongLanguageEligible(s, activeLanguages));
  }

  // Optional search query
  const query = ((req.query.q || req.query.search) as string)?.toLowerCase().trim();
  if (query) {
    filtered = filtered.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.artist.toLowerCase().includes(query) ||
        (s.composer && s.composer.toLowerCase().includes(query)) ||
        (s.movieName && s.movieName.toLowerCase().includes(query)) ||
        (s.album && s.album.toLowerCase().includes(query))
    );
  }

  // Optional category filter
  const category = (req.query.category as string)?.toLowerCase();
  if (category === 'trending') {
    filtered = filtered.filter((s) => (s.releaseYear || 2020) >= 2021);
  } else if (category === 'recent' || category === 'recently_added') {
    filtered = filtered.filter((s) => (s.releaseYear || 2020) >= 2022);
  }

  const totalMatched = filtered.length;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const paginated = filtered.slice(offset, offset + limit);

  // Safe development diagnostics (zero tokens or secrets)
  const diagnostics = {
    userId: safeUserId,
    selectedLanguages: activeLanguages,
    supabaseStatus: process.env.SUPABASE_URL ? 'CONNECTED' : 'IN_MEMORY_STORE',
    availableSongs: allSongs.length,
    languageMatched: totalMatched,
    responseCount: paginated.length,
    timestamp: new Date().toISOString()
  };

  console.log(
    `[HomeDiagnostics:Songs] User: ${diagnostics.userId}, Languages: [${diagnostics.selectedLanguages.join(
      ', '
    )}], Available: ${diagnostics.availableSongs}, Matched: ${diagnostics.languageMatched}, Returned: ${
      diagnostics.responseCount
    }`
  );

  res.json({
    success: true,
    count: paginated.length,
    totalAvailable: totalMatched,
    data: paginated,
    diagnostics
  });
});

/**
 * GET /api/songs/home-base (or /api/songs/base-feed)
 * High-reliability independent base Home feed providing separate sections:
 * - Recommended (Base)
 * - Trending in Your Languages
 * - Recently Added
 * - Popular Songs
 * - All Available Catalogue Songs
 */
const handleHomeBaseFeed = (req: Request, res: Response): void => {
  const userId = (req as AuthenticatedRequest).userId;
  const safeUserId = userId ? `${userId.slice(0, 8)}...` : 'guest_user';
  const allSongs = getAllMasterSongs();

  // Language resolution
  const langQuery = (req.query.language as string) || (req.query.languages as string) || (req.headers['x-user-languages'] as string) || '';
  let activeLanguages: string[] = [];

  if (langQuery && langQuery !== 'ALL') {
    activeLanguages = normalizeLanguageList(langQuery.split(',').map((l) => l.trim()));
  } else if (req.headers['x-user-languages']) {
    activeLanguages = normalizeLanguageList((req.headers['x-user-languages'] as string).split(',').map((l) => l.trim()));
  } else if (userId) {
    const prefs = syncStore.getUserPreferences(userId);
    if (prefs.preferredLanguages && prefs.preferredLanguages.length > 0) {
      activeLanguages = normalizeLanguageList(prefs.preferredLanguages);
    }
  }

  // Filter songs matching active languages, or all songs if no languages chosen
  const matchingSongs =
    activeLanguages.length > 0
      ? allSongs.filter((s) => isSongLanguageEligible(s, activeLanguages))
      : allSongs;

  // Separate sections
  const trending = matchingSongs
    .filter((s) => (s.releaseYear || 2020) >= 2021)
    .slice(0, 16);

  const recentlyAdded = matchingSongs
    .filter((s) => (s.releaseYear || 2020) >= 2022)
    .slice(0, 16);

  const popularSongs = matchingSongs
    .slice()
    .sort((a, b) => (b.releaseYear || 2020) - (a.releaseYear || 2020))
    .slice(0, 16);

  const recommendedBase = matchingSongs.slice(0, 16);

  const diagnostics = {
    userId: safeUserId,
    selectedLanguages: activeLanguages,
    supabaseStatus: process.env.SUPABASE_URL ? 'CONNECTED' : 'IN_MEMORY_STORE',
    availableSongs: allSongs.length,
    languageMatched: matchingSongs.length,
    responseCount: matchingSongs.length,
    timestamp: new Date().toISOString()
  };

  console.log(
    `[HomeDiagnostics:BaseFeed] User: ${diagnostics.userId}, Languages: [${diagnostics.selectedLanguages.join(
      ', '
    )}], Matched: ${matchingSongs.length}, Trending: ${trending.length}, Popular: ${popularSongs.length}`
  );

  res.json({
    success: true,
    data: {
      recommended: recommendedBase,
      trending: trending.length > 0 ? trending : matchingSongs.slice(0, 12),
      recentlyAdded: recentlyAdded.length > 0 ? recentlyAdded : matchingSongs.slice(0, 12),
      popularSongs: popularSongs.length > 0 ? popularSongs : matchingSongs.slice(0, 12),
      allAvailable: matchingSongs,
      languages: activeLanguages,
      requiresLanguageSelection: activeLanguages.length === 0
    },
    diagnostics
  });
};

router.get('/home-base', optionalAuth, handleHomeBaseFeed);
router.get('/base-feed', optionalAuth, handleHomeBaseFeed);

router.post('/', requireAuth, (req: Request, res: Response): void => {
  const result = songSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  // Enforce local-device-only policy: downloaded tracks must stay on local device storage
  if (result.data.source === 'DOWNLOADED' || result.data.id.startsWith('local_')) {
    res.status(400).json({
      success: false,
      message: 'Downloaded and local tracks are stored strictly on the local device and are not synced to Supabase/cloud.'
    });
    return;
  }

  const songData: SongMetadata = {
    ...result.data,
    createdAt: new Date().toISOString()
  };

  const saved = syncStore.saveSong(songData);
  res.status(201).json({ success: true, data: saved });
});

router.get('/:id', (req: Request, res: Response): void => {
  const songId = req.params.id?.trim();
  if (!songId) {
    res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid song ID provided' });
    return;
  }

  const song = syncStore.getSongById(songId);
  if (song) {
    const cleanId = encodeURIComponent(song.id);
    const shareUrl = `https://syncwave.app/song/${cleanId}`;
    const shareMessage = `Listen to ${song.title} by ${song.artist} on SyncWave.\n\nListen here: ${shareUrl}`;
    res.json({
      success: true,
      data: {
        ...song,
        shareUrl,
        shareMessage
      }
    });
    return;
  }

  // Fallback to recommendation master catalog
  const catalogTrack = RecommendationEngineService.findTrackById(songId);
  if (catalogTrack) {
    const cleanId = encodeURIComponent(catalogTrack.id);
    const shareUrl = `https://syncwave.app/song/${cleanId}`;
    const shareMessage = `Listen to ${catalogTrack.title} by ${catalogTrack.artist} on SyncWave.\n\nListen here: ${shareUrl}`;
    res.json({
      success: true,
      data: {
        ...catalogTrack,
        shareUrl,
        shareMessage
      }
    });
    return;
  }

  res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Song not found or unavailable' });
});

router.delete('/:id', optionalAuth, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.userId) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  const songId = req.params.id;
  const deleted = syncStore.deleteSong(songId);
  res.json({
    success: true,
    message: deleted ? 'Song deleted successfully' : 'Song removed from library',
    id: songId
  });
});

router.get('/:id/stats', optionalAuth, (req: Request, res: Response): void => {
  const userId = (req as AuthenticatedRequest).userId || (req.headers['x-user-id'] as string) || 'guest_default_user';
  const songId = req.params.id;
  const userStats = syncStore.getUserSongStats(userId);
  const songStat = userStats.find((s) => s.songId === songId);
  const isFavorite = syncStore.isFavorite(userId, songId);

  if (!songStat) {
    const song = syncStore.getSongById(songId);
    res.json({
      success: true,
      stats: {
        songId,
        songName: song?.title || 'Unknown Song',
        playCount: 0,
        replayCount: 0,
        totalListeningDurationMs: 0,
        averageListeningDurationMs: 0,
        completionPercentage: 0,
        completedCount: 0,
        skipCount: 0,
        lastPlayedAt: null,
        isFavorite
      }
    });
    return;
  }

  res.json({
    success: true,
    stats: {
      ...songStat,
      isFavorite: isFavorite || songStat.isFavorite
    }
  });
});

export default router;

