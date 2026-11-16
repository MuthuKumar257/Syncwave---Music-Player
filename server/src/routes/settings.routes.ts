import { Router, Response } from 'express';
import { z } from 'zod';
import { syncStore } from '../db/store';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const settingsUpdateSchema = z.object({
  isDarkMode: z.boolean().optional(),
  crossfadeEnabled: z.boolean().optional(),
  crossfadeDurationSec: z.number().min(0).max(15).optional(),
  playbackSpeed: z.number().min(0.25).max(3.0).optional()
});

router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const settings = syncStore.getUserSettings(req.userId!);
  res.json({ success: true, data: settings });
});

router.put('/', (req: AuthenticatedRequest, res: Response): void => {
  const result = settingsUpdateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  const updated = syncStore.updateUserSettings(req.userId!, result.data);
  res.json({ success: true, data: updated });
});

export default router;

