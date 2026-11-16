import { Router, Response } from 'express';
import { syncStore } from '../db/store';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const favorites = syncStore.getUserFavorites(req.userId!);
  res.json({ success: true, count: favorites.length, data: favorites });
});

router.post('/:targetId', (req: AuthenticatedRequest, res: Response): void => {
  const isFavorite = syncStore.toggleFavorite(req.userId!, req.params.targetId);
  res.json({ success: true, targetId: req.params.targetId, isFavorite });
});

export default router;

