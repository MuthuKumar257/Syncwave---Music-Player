import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import {
  DevicePlatform,
  PlaybackCommandType,
  playbackSessionCoordinator,
} from '../services/playbackSession.service';

const router = Router();

const devicePlatformSchema = z.enum(['WEB', 'MOBILE_RN', 'ANDROID']);

const registerDeviceSchema = z.object({
  deviceId: z.string().trim().min(3).max(128),
  deviceName: z.string().trim().min(1).max(80),
  platform: devicePlatformSchema,
  makeActiveIfNone: z.boolean().optional(),
});

const heartbeatSchema = z.object({
  deviceId: z.string().trim().min(3).max(128),
  ackSeq: z.number().int().nonnegative().optional(),
});

const unregisterSchema = z.object({
  deviceId: z.string().trim().min(3).max(128),
});

const transferSchema = z.object({
  deviceId: z.string().trim().min(3).max(128),
  targetDeviceId: z.string().trim().min(3).max(128),
});

const trackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().default('Unknown Artist'),
  album: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  artworkUrl: z.string().optional(),
  videoId: z.string().optional(),
  externalUrl: z.string().optional(),
  source: z.string().optional(),
});

const stateUpdateSchema = z.object({
  deviceId: z.string().trim().min(3).max(128),
  track: trackSchema.nullable().optional(),
  isPlaying: z.boolean().optional(),
  positionSec: z.number().nonnegative().optional(),
  durationSec: z.number().nonnegative().optional(),
  queue: z.array(trackSchema).max(200).optional(),
  queueIndex: z.number().int().min(-1).optional(),
  volume: z.number().min(0).max(1).optional(),
  isMuted: z.boolean().optional(),
  isShuffle: z.boolean().optional(),
  repeatMode: z.enum(['OFF', 'ALL', 'ONE']).optional(),
});

const commandSchema = z.object({
  deviceId: z.string().trim().min(3).max(128),
  type: z.enum([
    'PLAY_TRACK',
    'PLAY',
    'PAUSE',
    'TOGGLE_PLAY',
    'SEEK',
    'NEXT',
    'PREVIOUS',
    'SET_VOLUME',
    'TOGGLE_SHUFFLE',
    'TOGGLE_REPEAT',
    'SET_QUEUE',
  ]),
  payload: z.record(z.unknown()).optional(),
});

router.use(requireAuth);

router.post('/devices/register', (req: AuthenticatedRequest, res: Response) => {
  const parsed = registerDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid device registration payload.' });
    return;
  }

  const snapshot = playbackSessionCoordinator.registerDevice(req.userId!, {
    deviceId: parsed.data.deviceId,
    deviceName: parsed.data.deviceName,
    platform: parsed.data.platform as DevicePlatform,
    makeActiveIfNone: parsed.data.makeActiveIfNone,
  });

  res.json({ success: true, session: snapshot });
});

router.post('/devices/heartbeat', (req: AuthenticatedRequest, res: Response) => {
  const parsed = heartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid heartbeat payload.' });
    return;
  }

  const snapshot = playbackSessionCoordinator.heartbeat(
    req.userId!,
    parsed.data.deviceId,
    parsed.data.ackSeq
  );
  res.json({ success: true, session: snapshot });
});

router.post('/devices/unregister', (req: AuthenticatedRequest, res: Response) => {
  const parsed = unregisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid deviceId.' });
    return;
  }

  const snapshot = playbackSessionCoordinator.unregisterDevice(req.userId!, parsed.data.deviceId);
  res.json({ success: true, session: snapshot });
});

router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;
  const ackSeqRaw = typeof req.query.ackSeq === 'string' ? Number(req.query.ackSeq) : undefined;
  const ackSeq = typeof ackSeqRaw === 'number' && Number.isFinite(ackSeqRaw) ? ackSeqRaw : undefined;

  const snapshot = playbackSessionCoordinator.getSnapshot(req.userId!, deviceId, ackSeq);
  res.json({ success: true, session: snapshot });
});

router.get('/poll', async (req: AuthenticatedRequest, res: Response) => {
  const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : '';
  const sinceRevision = Number(req.query.sinceRevision ?? 0) || 0;
  const timeoutMs = Number(req.query.timeoutMs ?? 15000) || 15000;
  const ackSeqRaw = typeof req.query.ackSeq === 'string' ? Number(req.query.ackSeq) : undefined;
  const ackSeq = typeof ackSeqRaw === 'number' && Number.isFinite(ackSeqRaw) ? ackSeqRaw : undefined;

  if (!deviceId) {
    res.status(400).json({ success: false, message: 'deviceId query parameter is required.' });
    return;
  }

  const snapshot = await playbackSessionCoordinator.waitForUpdate(
    req.userId!,
    deviceId,
    sinceRevision,
    timeoutMs,
    ackSeq,
    (cleanup) => {
      req.on('close', cleanup);
    }
  );

  if (!res.headersSent && !res.writableEnded) {
    res.json({ success: true, session: snapshot });
  }
});

router.post('/transfer', (req: AuthenticatedRequest, res: Response) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid transfer request payload.' });
    return;
  }

  const result = playbackSessionCoordinator.transferActiveDevice(
    req.userId!,
    parsed.data.targetDeviceId,
    parsed.data.deviceId
  );

  if (!result.ok) {
    res.status(404).json({ success: false, code: result.code, message: result.message });
    return;
  }

  res.json({ success: true, session: result.snapshot });
});

router.post('/state', (req: AuthenticatedRequest, res: Response) => {
  const parsed = stateUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid playback state payload.' });
    return;
  }

  const { deviceId, ...updates } = parsed.data;
  const result = playbackSessionCoordinator.publishActiveState(req.userId!, deviceId, updates);

  if (!result.ok) {
    const status = result.code === 'NOT_ACTIVE_DEVICE' ? 409 : 404;
    res.status(status).json({
      success: false,
      code: result.code,
      activeDeviceId: result.activeDeviceId,
      message: result.message,
    });
    return;
  }

  res.json({ success: true, session: result.snapshot });
});

router.post('/command', (req: AuthenticatedRequest, res: Response) => {
  const parsed = commandSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid remote command payload.' });
    return;
  }

  const result = playbackSessionCoordinator.issueCommand(
    req.userId!,
    parsed.data.deviceId,
    parsed.data.type as PlaybackCommandType,
    parsed.data.payload
  );

  if (!result.ok) {
    res.status(409).json({ success: false, code: result.code, message: result.message });
    return;
  }

  res.json({
    success: true,
    command: result.command,
    session: result.snapshot,
  });
});

export default router;
