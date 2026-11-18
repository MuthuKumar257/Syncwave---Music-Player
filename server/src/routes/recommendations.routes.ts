import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { RecommendationEngineService, SmartPlaylistRequest } from '../services/recommendation/recommendationEngine.service';
import { syncStore } from '../db/store';
import { SupabaseHistoryService } from '../services/history/supabaseHistory.service';

const preferencesUpdateSchema = z
  .object({
    preferredLanguages: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    favouriteArtists: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
    favouriteDirectors: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
    favouriteComposers: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
    favouriteSingers: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
    favouriteGenres: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    preferredMoods: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    preferredGenres: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    favouriteMovies: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    includeLanguageTracks: z.boolean().optional(),
    preferDirectAudio: z.boolean().optional(),
    onboardingCompleted: z.boolean().optional(),
    hasCompletedOnboarding: z.boolean().optional()
  })
  .passthrough();

const router = Router();

function getUserId(req: Request): string {
  return (req as AuthenticatedRequest).userId || 'guest_default_user';
}

/**
 * GET /api/recommendations
 * Comprehensive multi-category personalized recommendation feed
 */
router.get('/recommendations', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const timeOfDay = req.query.timeOfDay as string | undefined;
    const languageOverride = req.query.language as string | undefined;
    const refreshSeed = (req.query.seed || req.query.refresh) as string | undefined;

    const feed = await RecommendationEngineService.getPersonalizedFeed(userId, {
      timeOfDay,
      languageOverride,
      refreshSeed
    });

    res.json({
      success: true,
      data: feed
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/discover
 * Intelligent music discovery categories with exploratory language support
 */
router.get('/recommendations/discover', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const languageOverride = req.query.language as string | undefined;

    const discoverData = await RecommendationEngineService.getDiscoverFeed(userId, languageOverride);

    res.json({
      success: true,
      data: discoverData
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve discover recommendations',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/mood/:moodId
 * Retrieve complete curated playable tracks for a specific mood playlist
 */
router.get('/recommendations/mood/:moodId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const moodId = req.params.moodId;
    const moodPlaylist = await RecommendationEngineService.getMoodPlaylistById(userId, moodId);
    if (!moodPlaylist) {
      res.status(404).json({
        success: false,
        message: 'Mood playlist not found'
      });
      return;
    }

    res.json({
      success: true,
      moodPlaylist
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to load mood playlist',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/artist/:artistName
 * Retrieve full artist details with songs and movie/album groups
 */
router.get('/recommendations/artist/:artistName', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const artistName = decodeURIComponent(req.params.artistName || '');
    const artist = await RecommendationEngineService.getArtistDetailByName(userId, artistName);
    if (!artist) {
      res.status(404).json({
        success: false,
        message: 'Artist not found'
      });
      return;
    }

    res.json({
      success: true,
      artist
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to load artist details',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/daily-mix
 * Retrieve personalized daily mixes
 */
router.get('/recommendations/daily-mix', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const feed = await RecommendationEngineService.getPersonalizedFeed(userId);

    res.json({
      success: true,
      dailyMixes: feed.dailyMixes
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve daily mixes',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/languages
 * Language-specific recommendation breakdown
 */
router.get('/recommendations/languages', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const feed = await RecommendationEngineService.getPersonalizedFeed(userId);

    res.json({
      success: true,
      preferredLanguages: feed.preferredLanguages,
      languageSections: feed.languageSections
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve language recommendations',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/artists
 * Retrieve canonical Music Directors and Singers with language filtering, duplicate removal, search and pagination
 */
router.get('/recommendations/artists', optionalAuth, (req: Request, res: Response): void => {
  try {
    const role = req.query.role as 'DIRECTOR' | 'SINGER' | 'ALL' | undefined;
    const languagesParam = req.query.languages as string | undefined;
    const query = (req.query.q || req.query.query) as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const includeAll = req.query.includeAll === 'true' || req.query.all === 'true';

    let languages: string[] | undefined;
    if (languagesParam && languagesParam.trim()) {
      languages = languagesParam.split(',').map((l) => l.trim()).filter(Boolean);
    } else if (!includeAll) {
      // If no languages specified in query, read from authenticated user's profile if logged in
      const userId = (req as AuthenticatedRequest).userId;
      if (userId) {
        const userPrefs = syncStore.getUserPreferences(userId);
        if (userPrefs.preferredLanguages && userPrefs.preferredLanguages.length > 0) {
          languages = userPrefs.preferredLanguages;
        }
      }
    }

    const result = RecommendationEngineService.getPaginatedArtistsCatalog({
      role,
      languages,
      query,
      page,
      limit,
      includeAllLanguages: includeAll
    });

    res.json({
      success: true,
      count: result.artists.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
      selectedLanguages: result.selectedLanguages,
      artists: result.artists
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve artists',
      error: err.message
    });
  }
});

/**
 * POST /api/recommendations/listening-stat
 * Record detailed song listening stats (playCount, replayCount, skipCount, duration, isFavorite)
 */
router.post('/recommendations/listening-stat', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const {
      songId,
      songName,
      movieOrAlbum,
      musicDirector,
      singers,
      language,
      genre,
      playCount,
      replayCount,
      totalListeningDurationMs,
      skipCount,
      lastPlayedAt,
      isFavorite
    } = req.body;

    if (!songId || !songName) {
      res.status(400).json({ success: false, message: 'songId and songName are required' });
      return;
    }

    // Always record locally for instant real-time analytics & offline cache
    const stat = syncStore.recordSongListening(userId, {
      songId,
      songName,
      movieOrAlbum,
      musicDirector,
      singers,
      language,
      genre,
      playCount,
      replayCount,
      totalListeningDurationMs,
      skipCount,
      lastPlayedAt,
      isFavorite
    });

    const eventType =
      (replayCount || 0) > 0
        ? 'REPLAY'
        : (skipCount || 0) > 0
          ? 'SKIP'
          : 'PLAY';

    // Record listening event
    await SupabaseHistoryService.recordListeningEvent({
      userId,
      songId,
      songTitle: songName,
      artistName: singers?.[0] || musicDirector || 'Unknown Artist',
      musicDirector,
      language,
      genre,
      eventType,
      durationPlayedSec: Math.round((totalListeningDurationMs || 0) / 1000),
      totalDurationSec: 0,
      clientPlatform: 'WEB'
    }).catch(() => {});

    RecommendationEngineService.invalidateUserCache(userId);

    res.json({
      success: true,
      stat
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to record listening stat',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/listening-history
 * Retrieve user's detailed song listening history (backed by Supabase)
 */
router.get('/recommendations/listening-history', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to retrieve listening history'
      });
      return;
    }
    const userId = authReq.userId;
    const { history } = await SupabaseHistoryService.getUserPlayHistory(userId, 50);
    const memoryStats = syncStore.getUserSongStats(userId);

    // Build stats from Supabase play history when configured
    const stats =
      SupabaseHistoryService.isConfigured()
        ? history.map((h) => ({
            songId: h.songId,
            songName: h.songTitle,
            singers: [h.artistName],
            playCount: 1,
            replayCount: 0,
            totalListeningDurationMs: h.durationListenedMs,
            skipCount: 0,
            lastPlayedAt: h.playedAt,
            isFavorite: false
          }))
        : memoryStats;

    res.json({
      success: true,
      storage: 'SUPABASE',
      count: stats.length,
      stats
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve listening history stats',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/profile-stats  (and /api/users/me/stats)
 * Computes listener profile stats: Favourite Artist, Most Listened Artist, Most Rewatched Songs
 */
const handleProfileStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to view personal profile statistics'
      });
      return;
    }
    const userId = authReq.userId;
    const stats = await RecommendationEngineService.getProfileStats(userId);
    res.json({
      success: true,
      stats
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to compute listener profile stats',
      error: err.message
    });
  }
};

router.get('/recommendations/profile-stats', optionalAuth, handleProfileStats);
router.get('/users/me/stats', optionalAuth, handleProfileStats);

/**
 * GET /api/recommendations/similar/:songId
 * Content-based similar song discovery
 */
router.get('/recommendations/similar/:songId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId;
    const userId = getUserId(req);
    const limit = parseInt(req.query.limit as string, 10) || 8;
    const similar = RecommendationEngineService.getSimilarSongs(songId, limit, userId);

    res.json({
      success: true,
      songId,
      similarTracks: similar
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve similar songs',
      error: err.message
    });
  }
});

// In-flight mutex to deduplicate concurrent auto-queue generation requests for the same user & target
const inFlightAutoQueues = new Map<string, Promise<any>>();

async function getOrRunAutoQueue(userId: string, opts: any) {
  const key = `${userId}:${opts.songId || opts.songTitle || 'ref'}:${opts.language || ''}:${opts.limit || 20}`;
  if (inFlightAutoQueues.has(key)) {
    return inFlightAutoQueues.get(key)!;
  }
  const task = Promise.resolve().then(() => {
    return RecommendationEngineService.getAutoQueueRecommendations(userId, opts);
  });
  inFlightAutoQueues.set(key, task);
  try {
    const res = await task;
    return res;
  } finally {
    inFlightAutoQueues.delete(key);
  }
}

/**
 * POST /api/recommendations/auto-queue
 * Generates continuous playback queue based on current song, language, artist, mood, and session history
 */
router.post('/recommendations/auto-queue', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const {
      songId,
      songTitle,
      artist,
      director,
      language,
      genre,
      mood,
      excludeIds,
      limit
    } = req.body;

    const tracks = await getOrRunAutoQueue(userId, {
      songId,
      songTitle,
      artist,
      director,
      language,
      genre,
      mood,
      excludeIds: Array.isArray(excludeIds) ? excludeIds : undefined,
      limit: typeof limit === 'number' ? limit : 20
    });

    res.json({
      success: true,
      count: tracks.length,
      tracks
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate automatic queue',
      error: err.message
    });
  }
});

/**
 * GET /api/recommendations/auto-queue
 * Query-based continuous automatic queue endpoint
 */
router.get('/recommendations/auto-queue', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const songId = req.query.songId as string | undefined;
    const songTitle = (req.query.songTitle || req.query.title) as string | undefined;
    const artist = req.query.artist as string | undefined;
    const director = (req.query.director || req.query.composer) as string | undefined;
    const language = req.query.language as string | undefined;
    const genre = req.query.genre as string | undefined;
    const mood = req.query.mood as string | undefined;
    const excludeParam = req.query.exclude as string | undefined;
    const excludeIds = excludeParam ? excludeParam.split(',').map((s) => s.trim()) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;

    const tracks = await getOrRunAutoQueue(userId, {
      songId,
      songTitle,
      artist,
      director,
      language,
      genre,
      mood,
      excludeIds,
      limit
    });

    res.json({
      success: true,
      count: tracks.length,
      tracks
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate automatic queue',
      error: err.message
    });
  }
});

/**
 * POST /api/recommendations/generate-smart-playlist
 * Smart playlist generation by mood, language, composer, or duration
 */
router.post('/recommendations/generate-smart-playlist', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const requestData: SmartPlaylistRequest = req.body;

    const playlist = RecommendationEngineService.generateSmartPlaylist(userId, requestData);

    res.json({
      success: true,
      playlist
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate smart playlist',
      error: err.message
    });
  }
});

const VALID_FEEDBACK_TYPES = ['LIKE', 'DISLIKE', 'HIDE', 'NOT_INTERESTED', 'MORE_LIKE_THIS', 'LESS_LIKE_THIS'];

/**
 * POST /api/recommendations/feedback
 * Explicit user signals (Like, Dislike, Hide, Not Interested, More Like This, Less Like This)
 */
router.post('/recommendations/feedback', optionalAuth, (req: Request, res: Response): void => {
  const userId = getUserId(req);
  const { targetId, targetType, feedbackType } = req.body;

  if (!targetId || !feedbackType || !VALID_FEEDBACK_TYPES.includes(feedbackType)) {
    res.status(400).json({
      success: false,
      message: `targetId and a valid feedbackType (${VALID_FEEDBACK_TYPES.join(', ')}) are required`
    });
    return;
  }

  const recorded = syncStore.recordFeedback({
    userId,
    targetId,
    targetType: targetType || 'SONG',
    feedbackType
  });

  RecommendationEngineService.invalidateUserCache(userId);

  res.json({
    success: true,
    feedback: recorded
  });
});

/**
 * GET /api/recommendations/feedback
 * Retrieve active feedback history for the current user
 */
router.get('/recommendations/feedback', optionalAuth, (req: Request, res: Response): void => {
  const userId = getUserId(req);
  const feedbacks = syncStore.getUserFeedback(userId);
  res.json({
    success: true,
    count: feedbacks.length,
    feedbacks
  });
});

/**
 * DELETE /api/recommendations/feedback/:targetId
 * Remove explicit user feedback for a target
 */
router.delete('/recommendations/feedback/:targetId', optionalAuth, (req: Request, res: Response): void => {
  const userId = getUserId(req);
  const targetId = req.params.targetId;
  const removed = syncStore.removeFeedback(userId, targetId);
  RecommendationEngineService.invalidateUserCache(userId);
  res.json({
    success: true,
    removed,
    message: removed ? 'Feedback removed' : 'Feedback not found'
  });
});

/**
 * POST /api/recommendations/feedback/undo
 * Undo previous feedback signal
 */
router.post('/recommendations/feedback/undo', optionalAuth, (req: Request, res: Response): void => {
  const userId = getUserId(req);
  const targetId = req.body.targetId;
  if (!targetId) {
    res.status(400).json({ success: false, message: 'targetId is required to undo feedback' });
    return;
  }
  const removed = syncStore.removeFeedback(userId, targetId);
  RecommendationEngineService.invalidateUserCache(userId);
  res.json({
    success: true,
    undone: removed
  });
});

/**
 * GET /api/recommendations/config/weights
 * Retrieve current configurable recommendation weights
 */
router.get('/recommendations/config/weights', (_req: Request, res: Response): void => {
  const weights = syncStore.getRecommendationWeights();
  res.json({
    success: true,
    weights
  });
});

/**
 * PUT /api/recommendations/config/weights
 * Update recommendation weights dynamically
 */
router.put('/recommendations/config/weights', (req: Request, res: Response): void => {
  const updated = syncStore.setRecommendationWeights(req.body || {});
  RecommendationEngineService.invalidateUserCache();
  res.json({
    success: true,
    weights: updated
  });
});

/**
 * POST /api/listening-events
 * Implicit user interactions stored in Supabase (Play, Complete, Skip, Replay, Add to playlist)
 */
router.post('/listening-events', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const {
    songId,
    songTitle,
    artistName,
    language,
    genre,
    eventType,
    durationPlayedSec,
    totalDurationSec,
    clientPlatform
  } = req.body;

  if (!songId || !eventType) {
    res.status(400).json({ success: false, message: 'songId and eventType are required' });
    return;
  }

  try {
    const { event, storedInSupabase } = await SupabaseHistoryService.recordListeningEvent({
      userId,
      songId,
      songTitle: songTitle || 'Unknown Title',
      artistName: artistName || 'Unknown Artist',
      language,
      genre,
      eventType,
      durationPlayedSec: durationPlayedSec || 0,
      totalDurationSec: totalDurationSec || 0,
      clientPlatform: clientPlatform || 'WEB'
    });

    RecommendationEngineService.invalidateUserCache(userId);

    res.json({
      success: true,
      storage: 'SUPABASE',
      storedInSupabase,
      event
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to store listening event in Supabase',
      error: err.message
    });
  }
});

/**
 * GET /api/users/me/preferences
 * Retrieve authenticated user's music preferences & preferred languages
 */
router.get('/users/me/preferences', optionalAuth, (req: Request, res: Response): void => {
  const userId = getUserId(req);
  const preferences = syncStore.getUserPreferences(userId);

  res.json({
    success: true,
    preferences,
    data: preferences
  });
});

/**
 * PUT /api/users/me/preferences
 * Update preferred languages, favourite artists, genres, or personalization toggles
 */
router.put('/users/me/preferences', optionalAuth, (req: Request, res: Response): void => {
  const parsed = preferencesUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid music preferences payload',
      errors: parsed.error.errors
    });
    return;
  }

  const userId = getUserId(req);
  const data = { ...parsed.data };
  if (data.favouriteDirectors && !data.favouriteComposers) {
    data.favouriteComposers = data.favouriteDirectors;
  }
  if (data.preferredGenres && !data.favouriteGenres) {
    data.favouriteGenres = data.preferredGenres;
  }
  if (data.onboardingCompleted !== undefined && data.hasCompletedOnboarding === undefined) {
    data.hasCompletedOnboarding = data.onboardingCompleted;
  }
  const updated = syncStore.updateUserPreferences(userId, data);
  RecommendationEngineService.invalidateUserCache(userId);

  res.json({
    success: true,
    preferences: updated,
    data: updated
  });
});

/**
 * POST /api/users/me/preferences/reset
 * Reset personalized recommendations and clear listening interaction history
 */
router.post('/users/me/preferences/reset', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const reset = syncStore.resetUserPreferences(userId);
    await SupabaseHistoryService.clearUserHistory(userId);
    RecommendationEngineService.invalidateUserCache(userId);

    res.json({
      success: true,
      message: 'Music preferences and Supabase history successfully reset',
      preferences: reset
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to reset preferences and history',
      error: err.message
    });
  }
});

export default router;
