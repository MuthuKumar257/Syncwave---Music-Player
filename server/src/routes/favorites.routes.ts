import { Router, Response } from 'express';
import { syncStore } from '../db/store';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { RecommendationEngineService } from '../services/recommendation/recommendationEngine.service';
import { SupabaseFavoritesService } from '../services/favorites/supabaseFavorites.service';
import { UnifiedTrack } from '../services/search/searchAggregator.service';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/favorites - Fetch authenticated user's favorite song IDs & full metadata
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const localFavorites = syncStore.getUserFavorites(userId);

  // Sync from Supabase in background or merge
  let cloudFavorites: UnifiedTrack[] = [];
  try {
    cloudFavorites = await SupabaseFavoritesService.getUserFavorites(userId);
  } catch {}

  const cloudFavIds = cloudFavorites.map((s) => s.id);
  // Merge preserving recent order
  const mergedIds = Array.from(new Set([...localFavorites, ...cloudFavIds]));

  const trackMap = new Map<string, UnifiedTrack>();
  for (const cf of cloudFavorites) {
    trackMap.set(cf.id, cf);
  }

  for (const id of localFavorites) {
    if (!trackMap.has(id)) {
      const s = syncStore.getSongById(id) || RecommendationEngineService.findTrackById(id);
      if (s) {
        trackMap.set(id, {
          id: s.id,
          title: s.title,
          artist: s.artist,
          composer: (s as any).composer,
          movieName: (s as any).movieName || (s as any).album,
          artworkUrl: s.artworkUrl || '',
          durationMs: s.durationMs || 240000,
          sourcePlatform: ((s as any).sourcePlatform || (s as any).source || 'OPEN_AUDIO') as any,
          sourceUrl: (s as any).sourceUrl || (s as any).externalUrl || '',
          isPlayableDirectly: true,
          versionType: 'ORIGINAL' as any,
          language: (s as any).language
        });
      }
    }
  }

  // Populate actual song objects in exact merged order
  const songs: UnifiedTrack[] = mergedIds.map((id) => {
    return (
      trackMap.get(id) || {
        id,
        title: id.replace(/_/g, ' '),
        artist: 'Unknown Artist',
        durationMs: 240000,
        artworkUrl: '',
        sourcePlatform: 'OPEN_AUDIO' as any,
        sourceUrl: '',
        isPlayableDirectly: true,
        versionType: 'ORIGINAL' as any
      }
    );
  });

  res.json({
    success: true,
    count: mergedIds.length,
    data: mergedIds,
    songs
  });
});

/**
 * POST /api/favorites/:targetId - Toggle or add song to favorites
 */
router.post('/:targetId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const targetId = req.params.targetId;

  // If client supplied song metadata, persist it to master songs store
  const trackData = req.body?.track || req.body?.song || req.body;
  if (trackData && (trackData.title || trackData.name)) {
    try {
      syncStore.saveSong({
        id: targetId,
        title: trackData.title || trackData.name,
        artist: trackData.artist || 'Unknown Artist',
        album: trackData.album || trackData.movieName,
        durationMs: trackData.durationMs || trackData.duration || 0,
        artworkUrl: trackData.artworkUrl,
        source: trackData.sourcePlatform || trackData.source || 'OPEN_AUDIO',
        externalUrl: trackData.sourceUrl || trackData.externalUrl,
        createdAt: trackData.createdAt || new Date().toISOString()
      });
    } catch {}
  }

  const action = req.body?.action as 'ADD' | 'REMOVE' | undefined;
  let isFavorite: boolean;

  if (action === 'ADD') {
    syncStore.addFavorite(userId, targetId);
    isFavorite = true;
  } else if (action === 'REMOVE') {
    syncStore.removeFavorite(userId, targetId);
    isFavorite = false;
  } else {
    isFavorite = syncStore.toggleFavorite(userId, targetId);
  }

  // Synchronize with Supabase asynchronously
  if (isFavorite) {
    const song = syncStore.getSongById(targetId) || RecommendationEngineService.findTrackById(targetId);
    void SupabaseFavoritesService.addFavorite(userId, targetId, {
      title: song?.title || trackData?.title,
      artist: song?.artist || trackData?.artist,
      artworkUrl: song?.artworkUrl || trackData?.artworkUrl,
      durationMs: song?.durationMs || trackData?.durationMs,
      composer: (song as any)?.composer || trackData?.composer,
      movieName: (song as any)?.movieName || (song as any)?.album || trackData?.movieName,
      language: (song as any)?.language || trackData?.language
    });
  } else {
    void SupabaseFavoritesService.removeFavorite(userId, targetId);
  }

  const resolvedSong =
    syncStore.getSongById(targetId) || RecommendationEngineService.findTrackById(targetId);

  res.json({
    success: true,
    targetId,
    isFavorite,
    song: resolvedSong || null
  });
});

/**
 * DELETE /api/favorites/:targetId - Remove song from favorites
 */
router.delete('/:targetId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const targetId = req.params.targetId;

  syncStore.removeFavorite(userId, targetId);
  void SupabaseFavoritesService.removeFavorite(userId, targetId);

  res.json({
    success: true,
    targetId,
    isFavorite: false
  });
});

export default router;
