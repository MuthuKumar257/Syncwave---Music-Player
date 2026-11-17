import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { SupabasePlaylistsService } from '../services/playlists/supabasePlaylists.service';

const router = Router();

const createPlaylistSchema = z.object({
  name: z.string().min(1),
  artworkUrl: z.string().optional(),
  description: z.string().optional(),
  songIds: z.array(z.string()).optional(),
  songs: z.array(z.any()).optional()
});

const updatePlaylistSchema = z.object({
  name: z.string().min(1).optional(),
  artworkUrl: z.string().optional(),
  description: z.string().optional(),
  isFavorite: z.boolean().optional(),
  songIds: z.array(z.string()).optional()
});

const reorderSchema = z.object({
  songIds: z.array(z.string()).optional(),
  fromIndex: z.number().optional(),
  toIndex: z.number().optional()
});

// All playlist routes require authentication
router.use(requireAuth);

/**
 * GET /api/playlists
 * Retrieve all playlists for authenticated user, with fully populated songs
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const playlists = await SupabasePlaylistsService.getUserPlaylists(req.userId!);
    res.json({ success: true, count: playlists.length, data: playlists });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch playlists' });
  }
});

/**
 * POST /api/playlists
 * Create a new playlist with optional initial songs
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = createPlaylistSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  try {
    const playlist = await SupabasePlaylistsService.createPlaylist(req.userId!, result.data);
    res.status(201).json({ success: true, data: playlist });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create playlist' });
  }
});

/**
 * GET /api/playlists/:id
 * Retrieve a single playlist by ID with verified user ownership and joined song objects
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const playlist = await SupabasePlaylistsService.getPlaylistById(req.params.id, req.userId!);
    if (!playlist) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    res.json({ success: true, data: playlist });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch playlist details' });
  }
});

/**
 * PUT /api/playlists/:id
 * Update playlist metadata or reorder songs
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = updatePlaylistSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  try {
    const updated = await SupabasePlaylistsService.updatePlaylist(req.params.id, req.userId!, result.data);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to update playlist' });
  }
});

/**
 * PUT /api/playlists/:id/reorder
 * Explicitly reorder songs in a playlist
 */
router.put('/:id/reorder', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = reorderSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  try {
    const existing = await SupabasePlaylistsService.getPlaylistById(req.params.id, req.userId!);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    let nextSongIds: string[];
    if (Array.isArray(result.data.songIds)) {
      nextSongIds = result.data.songIds;
    } else if (
      typeof result.data.fromIndex === 'number' &&
      typeof result.data.toIndex === 'number'
    ) {
      const { fromIndex, toIndex } = result.data;
      if (
        fromIndex < 0 ||
        fromIndex >= existing.songIds.length ||
        toIndex < 0 ||
        toIndex >= existing.songIds.length
      ) {
        res.status(400).json({ success: false, message: 'Invalid reorder index bounds' });
        return;
      }
      nextSongIds = [...existing.songIds];
      const [moved] = nextSongIds.splice(fromIndex, 1);
      nextSongIds.splice(toIndex, 0, moved);
    } else {
      res.status(400).json({ success: false, message: 'Either songIds or fromIndex/toIndex is required' });
      return;
    }

    const updated = await SupabasePlaylistsService.updatePlaylist(req.params.id, req.userId!, {
      songIds: nextSongIds
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to reorder playlist songs' });
  }
});

/**
 * DELETE /api/playlists/:id
 * Delete a playlist
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deleted = await SupabasePlaylistsService.deletePlaylist(req.params.id, req.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    res.json({ success: true, message: 'Playlist deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete playlist' });
  }
});

/**
 * POST /api/playlists/:id/songs (and /api/playlists/:id/tracks)
 * Add a song to the playlist, preventing duplicates
 */
router.post('/:id/songs', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const songId = req.body.songId || req.body.trackId;
  const songMetadata = req.body.song || req.body.track;

  if (!songId && !songMetadata?.id) {
    res.status(400).json({ success: false, message: 'songId or song object is required' });
    return;
  }

  const finalSongId = songId || songMetadata.id;

  try {
    const updated = await SupabasePlaylistsService.addSongToPlaylist(
      req.params.id,
      req.userId!,
      finalSongId,
      songMetadata
    );

    if (!updated) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to add song to playlist' });
  }
});

/**
 * DELETE /api/playlists/:id/songs/:songId
 * Remove a song from the playlist
 */
router.delete('/:id/songs/:songId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const updated = await SupabasePlaylistsService.removeSongFromPlaylist(
      req.params.id,
      req.userId!,
      req.params.songId
    );

    if (!updated) {
      res.status(404).json({ success: false, message: 'Playlist not found' });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to remove song from playlist' });
  }
});

export default router;
