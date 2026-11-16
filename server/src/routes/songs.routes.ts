import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { syncStore, SongMetadata } from '../db/store';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { RecommendationEngineService } from '../services/recommendation/recommendationEngine.service';

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

router.get('/', (req: Request, res: Response): void => {
  const songs = syncStore.getSongs();
  res.json({ success: true, count: songs.length, data: songs });
});

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

router.delete('/:id', (req: Request, res: Response): void => {
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

