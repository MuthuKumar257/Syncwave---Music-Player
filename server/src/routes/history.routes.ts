import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { SupabaseHistoryService } from '../services/history/supabaseHistory.service';

const router = Router();

function getUserId(req: Request): string {
  return (req as AuthenticatedRequest).userId || 'guest_default_user';
}

const recordHistorySchema = z.object({
  songId: z.string().min(1),
  songTitle: z.string().min(1),
  artistName: z.string().default('Unknown Artist'),
  musicDirector: z.string().optional(),
  language: z.string().optional(),
  playedAt: z.string().optional(),
  durationListenedMs: z.number().default(0),
  completed: z.boolean().default(false),
  clientPlatform: z.enum(['ANDROID', 'WEB', 'MOBILE']).default('WEB')
});

const supabaseConfigSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseKey: z.string().min(10)
});

/**
 * GET /api/history/status
 * Reports Supabase-only history storage & local-device-only downloads policy
 */
router.get('/status', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    ...SupabaseHistoryService.getStatus()
  });
});

/**
 * POST /api/history/supabase-config
 * Dynamically connects a Supabase project URL + key for History storage
 */
router.post('/supabase-config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const result = supabaseConfigSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  const verification = await SupabaseHistoryService.configureAndVerify(
    result.data.supabaseUrl,
    result.data.supabaseKey
  );

  if (!verification.ok) {
    res.status(400).json({
      success: false,
      message: verification.error,
      status: verification.status
    });
    return;
  }

  res.json({
    success: true,
    message: 'Supabase history storage connected successfully',
    status: verification.status
  });
});

function sanitizeErrorMessage(err: any): string {
  if (process.env.NODE_ENV === 'production') {
    return 'Database service temporarily unavailable';
  }
  const raw = String(err?.message || 'Database operation failed');
  // Strip out low-level PostgREST code / schema leaks
  return raw.replace(/\{"code":"PGRST\d+".*\}/, 'Database query failed');
}

/**
 * GET /api/history
 * Reads playback history strictly from Supabase
 */
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const { history, source } = await SupabaseHistoryService.getUserPlayHistory(userId, limit);

    res.json({
      success: true,
      storage: 'SUPABASE',
      source,
      count: history.length,
      data: history
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve history from Supabase',
      error: sanitizeErrorMessage(err)
    });
  }
});

/**
 * POST /api/history
 * Persists playback history strictly to Supabase (no local storage)
 */
router.post('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const result = recordHistorySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  try {
    const userId = getUserId(req);
    const normalizedPlatform =
      result.data.clientPlatform === 'ANDROID' ? 'ANDROID' : 'WEB';

    const { record, storedInSupabase } = await SupabaseHistoryService.recordPlayHistory({
      userId,
      songId: result.data.songId,
      songTitle: result.data.songTitle,
      artistName: result.data.artistName,
      musicDirector: result.data.musicDirector,
      language: result.data.language,
      playedAt: result.data.playedAt,
      durationListenedMs: result.data.durationListenedMs,
      completed: result.data.completed,
      clientPlatform: normalizedPlatform
    });

    res.status(201).json({
      success: true,
      storage: 'SUPABASE',
      storedInSupabase,
      data: record
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to store play history in Supabase',
      error: sanitizeErrorMessage(err)
    });
  }
});

/**
 * DELETE /api/history
 * Clears user history tables strictly inside Supabase
 */
router.delete('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    await SupabaseHistoryService.clearUserHistory(userId);
    res.json({
      success: true,
      storage: 'SUPABASE',
      message: 'Listening history cleared in Supabase'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear history in Supabase',
      error: sanitizeErrorMessage(err)
    });
  }
});

export default router;
