import { Router, Response } from 'express';
import { z } from 'zod';
import { syncStore } from '../db/store';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { RecommendationEngineService } from '../services/recommendation/recommendationEngine.service';

const router = Router();

const createPlaylistSchema = z.object({
  name: z.string().min(1),
  artworkUrl: z.string().optional(),
  description: z.string().optional(),
  songIds: z.array(z.string()).optional()
});

const updatePlaylistSchema = z.object({
  name: z.string().min(1).optional(),
  artworkUrl: z.string().optional(),
  description: z.string().optional(),
  isFavorite: z.boolean().optional(),
  songIds: z.array(z.string()).optional()
});

// All playlist routes require authentication
router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const playlists = syncStore.getUserPlaylists(req.userId!);
  res.json({ success: true, count: playlists.length, data: playlists });
});

router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const result = createPlaylistSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  const { name, artworkUrl } = result.data;
  const playlist = syncStore.createPlaylist(req.userId!, name, artworkUrl);
  res.status(201).json({ success: true, data: playlist });
});

router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const playlist = syncStore.getPlaylistById(req.params.id);
  if (!playlist || playlist.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Playlist not found' });
    return;
  }

  // Populate song objects from store or master catalog
  const songs = playlist.songIds
    .map(id => syncStore.getSongById(id) || RecommendationEngineService.findTrackById(id))
    .filter(Boolean);

  res.json({
    success: true,
    data: {
      ...playlist,
      songs,
      totalDurationMs: songs.reduce((acc, s) => acc + (s?.durationMs || 0), 0)
    }
  });
});

router.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const playlist = syncStore.getPlaylistById(req.params.id);
  if (!playlist || playlist.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Playlist not found' });
    return;
  }

  const result = updatePlaylistSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  const updated = syncStore.updatePlaylist(req.params.id, result.data);
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const playlist = syncStore.getPlaylistById(req.params.id);
  if (!playlist || playlist.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Playlist not found' });
    return;
  }

  syncStore.deletePlaylist(req.params.id);
  res.json({ success: true, message: 'Playlist deleted' });
});

router.post('/:id/songs', (req: AuthenticatedRequest, res: Response): void => {
  const { songId } = req.body;
  if (!songId) {
    res.status(400).json({ success: false, message: 'songId is required' });
    return;
  }

  const playlist = syncStore.getPlaylistById(req.params.id);
  if (!playlist || playlist.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Playlist not found' });
    return;
  }

  const updated = syncStore.addSongToPlaylist(req.params.id, songId);
  res.json({ success: true, data: updated });
});

router.delete('/:id/songs/:songId', (req: AuthenticatedRequest, res: Response): void => {
  const playlist = syncStore.getPlaylistById(req.params.id);
  if (!playlist || playlist.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Playlist not found' });
    return;
  }

  const updated = syncStore.removeSongFromPlaylist(req.params.id, req.params.songId);
  res.json({ success: true, data: updated });
});

export default router;

