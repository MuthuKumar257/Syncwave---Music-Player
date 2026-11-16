import { Router, Response } from 'express';
import { syncStore } from '../db/store';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { RecommendationEngineService } from '../services/recommendation/recommendationEngine.service';
import { SupabaseFavoritesService } from '../services/favorites/supabaseFavorites.service';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const localFavorites = syncStore.getUserFavorites(userId);

  // Sync from Supabase in background or merge
  let cloudFavorites: string[] = [];
  try {
    cloudFavorites = await SupabaseFavoritesService.getUserFavoriteIds(userId);
  } catch {}

  // Merge preserving recent order
  const mergedIds = Array.from(new Set([...localFavorites, ...cloudFavorites]));

  // Populate actual song objects
  const songs = mergedIds
    .map((id) => syncStore.getSongById(id) || RecommendationEngineService.findTrackById(id))
    .filter(Boolean);

  res.json({
    success: true,
    count: mergedIds.length,
    data: mergedIds,
    songs
  });
});

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
        source: trackData.sourcePlatform || trackData.source || 'LOCAL',
        externalUrl: trackData.sourceUrl || trackData.externalUrl,
        createdAt: trackData.createdAt || new Date().toISOString()
      });
    } catch {}
  }

  const isFavorite = syncStore.toggleFavorite(userId, targetId);

  // Synchronize with Supabase asynchronously
  if (isFavorite) {
    const song = syncStore.getSongById(targetId) || RecommendationEngineService.findTrackById(targetId);
    void SupabaseFavoritesService.addFavorite(userId, targetId, {
      title: song?.title,
      artist: song?.artist,
      artworkUrl: song?.artworkUrl,
      durationMs: song?.durationMs
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

export default router;
