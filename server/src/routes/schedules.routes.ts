import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { syncStore, MusicScheduleData } from '../db/store';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { SupabaseHistoryService } from '../services/history/supabaseHistory.service';

const router = Router();

const scheduleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in format HH:mm'),
  endTime: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  repeatType: z.enum(['ONCE', 'DAILY', 'WEEKDAYS', 'CUSTOM_DAYS']).default('DAILY'),
  daysOfWeek: z.array(z.number()).default([1, 2, 3, 4, 5]),
  targetType: z.enum(['PLAYLIST', 'SONG']).default('PLAYLIST'),
  targetId: z.string().min(1),
  targetName: z.string().min(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  isEnabled: z.boolean().default(true),
  transitionType: z.enum(['IMMEDIATE', 'CROSSFADE', 'FADE_OUT_IN']).default('CROSSFADE'),
  transitionSec: z.number().default(3),
  volume: z.number().default(0.8),
  missedPolicy: z.enum(['PLAY_IMMEDIATELY', 'SKIP', 'PLAY_IF_WITHIN_WINDOW']).default('SKIP')
});

// History routes use optionalAuth so scheduled logs go strictly to Supabase for both authenticated & guest clients
router.get('/history/all', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId || 'guest_default_user';
    const history = await SupabaseHistoryService.getUserScheduleHistory(userId);
    res.json({ success: true, storage: 'SUPABASE', count: history.length, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to load schedule history from Supabase', error: err.message });
  }
});

router.post('/:id/execution', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId || 'guest_default_user';
    const schedule = syncStore.getScheduleById(req.params.id);
    const { success, statusMessage, clientPlatform, scheduleName, targetName } = req.body;

    const { record, storedInSupabase } = await SupabaseHistoryService.recordScheduleHistory({
      userId,
      scheduleId: req.params.id,
      scheduleName: schedule?.name || scheduleName || 'Routine',
      targetName: schedule?.targetName || targetName || 'Music',
      success: !!success,
      statusMessage: statusMessage || 'Executed',
      clientPlatform: clientPlatform === 'ANDROID' ? 'ANDROID' : 'WEB'
    });

    if (schedule) {
      // High H4 IDOR protection: only mutate execution timestamp if schedule belongs to caller
      if (schedule.userId === userId || schedule.userId === 'guest_default_user') {
        schedule.lastExecutedAt = new Date().toISOString();
        syncStore.saveSchedule(schedule);
      }
    }

    res.status(201).json({ success: true, storage: 'SUPABASE', storedInSupabase, data: record });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to store schedule execution history in Supabase', error: err.message });
  }
});

router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const schedules = syncStore.getUserSchedules(req.userId!);
  res.json({ success: true, count: schedules.length, data: schedules });
});


router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const result = scheduleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  const data = result.data;
  const schedule: MusicScheduleData = {
    ...data,
    id: data.id || crypto.randomUUID(),
    userId: req.userId!,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = syncStore.saveSchedule(schedule);
  res.status(201).json({ success: true, data: saved });
});

router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const schedule = syncStore.getScheduleById(req.params.id);
  if (!schedule || schedule.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Schedule not found' });
    return;
  }
  res.json({ success: true, data: schedule });
});

router.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const schedule = syncStore.getScheduleById(req.params.id);
  if (!schedule || schedule.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Schedule not found' });
    return;
  }

  const result = scheduleSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors });
    return;
  }

  const updated: MusicScheduleData = {
    ...schedule,
    ...result.data,
    id: schedule.id,
    userId: schedule.userId,
    updatedAt: new Date().toISOString()
  };

  syncStore.saveSchedule(updated);
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const schedule = syncStore.getScheduleById(req.params.id);
  if (!schedule || schedule.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Schedule not found' });
    return;
  }

  syncStore.deleteSchedule(req.params.id);
  res.json({ success: true, message: 'Schedule deleted' });
});

router.post('/:id/enable', (req: AuthenticatedRequest, res: Response): void => {
  const schedule = syncStore.getScheduleById(req.params.id);
  if (!schedule || schedule.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Schedule not found' });
    return;
  }

  schedule.isEnabled = true;
  schedule.updatedAt = new Date().toISOString();
  syncStore.saveSchedule(schedule);
  res.json({ success: true, data: schedule });
});

router.post('/:id/disable', (req: AuthenticatedRequest, res: Response): void => {
  const schedule = syncStore.getScheduleById(req.params.id);
  if (!schedule || schedule.userId !== req.userId) {
    res.status(404).json({ success: false, message: 'Schedule not found' });
    return;
  }

  schedule.isEnabled = false;
  schedule.updatedAt = new Date().toISOString();
  syncStore.saveSchedule(schedule);
  res.json({ success: true, data: schedule });
});

export default router;
