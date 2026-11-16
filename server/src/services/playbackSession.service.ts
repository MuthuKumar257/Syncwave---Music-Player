import crypto from 'crypto';

export type DevicePlatform = 'WEB' | 'MOBILE_RN' | 'ANDROID';

export type PlaybackCommandType =
  | 'PLAY_TRACK'
  | 'PLAY'
  | 'PAUSE'
  | 'TOGGLE_PLAY'
  | 'SEEK'
  | 'NEXT'
  | 'PREVIOUS'
  | 'SET_VOLUME'
  | 'TOGGLE_SHUFFLE'
  | 'TOGGLE_REPEAT'
  | 'SET_QUEUE'
  | 'STOP_LOCAL'
  | 'SYNC_TAKEOVER';

export interface SessionTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  artworkUrl?: string;
  videoId?: string;
  externalUrl?: string;
  source?: string;
}

export interface SessionPlaybackState {
  track: SessionTrack | null;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  queue: SessionTrack[];
  queueIndex: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'OFF' | 'ALL' | 'ONE';
  updatedAt: number;
  updatedByDeviceId: string | null;
}

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  lastSeenAt: number;
  registeredAt: number;
}

export interface SessionDeviceView {
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  lastSeenAt: number;
  isOnline: boolean;
  isActive: boolean;
}

export interface PendingCommand {
  id: string;
  seq: number;
  type: PlaybackCommandType;
  payload?: Record<string, unknown>;
  targetDeviceId: string;
  issuedByDeviceId: string;
  issuedAt: number;
}

export interface PlaybackSessionSnapshot {
  userId: string;
  activeDeviceId: string | null;
  revision: number;
  devices: SessionDeviceView[];
  playback: SessionPlaybackState;
  commands: PendingCommand[];
}

interface InternalUserSession {
  userId: string;
  activeDeviceId: string | null;
  revision: number;
  commandSeq: number;
  devices: Map<string, RegisteredDevice>;
  commands: PendingCommand[];
  playback: SessionPlaybackState;
}

interface PollWaiter {
  deviceId: string;
  resolve: () => void;
  timer: NodeJS.Timeout;
}

const DEVICE_OFFLINE_TTL_MS = 45_000;
const COMMAND_TTL_MS = 60_000;

const createInitialPlayback = (): SessionPlaybackState => ({
  track: null,
  isPlaying: false,
  positionSec: 0,
  durationSec: 0,
  queue: [],
  queueIndex: -1,
  volume: 0.85,
  isMuted: false,
  isShuffle: false,
  repeatMode: 'OFF',
  updatedAt: Date.now(),
  updatedByDeviceId: null,
});

class PlaybackSessionCoordinator {
  private sessions = new Map<string, InternalUserSession>();
  private waiters = new Map<string, Set<PollWaiter>>();

  private getOrCreateSession(userId: string): InternalUserSession {
    let session = this.sessions.get(userId);
    if (!session) {
      session = {
        userId,
        activeDeviceId: null,
        revision: 1,
        commandSeq: 0,
        devices: new Map(),
        commands: [],
        playback: createInitialPlayback(),
      };
      this.sessions.set(userId, session);
    }
    return session;
  }

  private pruneExpiredState(session: InternalUserSession, now = Date.now()): boolean {
    let changed = false;

    session.commands = session.commands.filter((cmd) => now - cmd.issuedAt <= COMMAND_TTL_MS);

    for (const [deviceId, device] of session.devices.entries()) {
      if (now - device.lastSeenAt > DEVICE_OFFLINE_TTL_MS) {
        session.devices.delete(deviceId);
        changed = true;
      }
    }

    if (session.activeDeviceId && !session.devices.has(session.activeDeviceId)) {
      const nextOnline = Array.from(session.devices.values())[0]?.deviceId ?? null;
      session.activeDeviceId = nextOnline;
      if (session.playback.isPlaying) {
        session.playback.isPlaying = false;
        session.playback.updatedAt = now;
      }
      changed = true;
    }

    if (changed) {
      session.revision += 1;
    }
    return changed;
  }

  private enqueueCommand(
    session: InternalUserSession,
    targetDeviceId: string,
    issuedByDeviceId: string,
    type: PlaybackCommandType,
    payload?: Record<string, unknown>
  ): PendingCommand {
    session.commandSeq += 1;
    const cmd: PendingCommand = {
      id: `cmd_${crypto.randomBytes(6).toString('hex')}`,
      seq: session.commandSeq,
      type,
      payload,
      targetDeviceId,
      issuedByDeviceId,
      issuedAt: Date.now(),
    };
    session.commands.push(cmd);
    if (session.commands.length > 64) {
      session.commands = session.commands.slice(-64);
    }
    return cmd;
  }

  private acknowledgeCommands(session: InternalUserSession, deviceId: string, ackSeq?: number): void {
    if (typeof ackSeq !== 'number' || !Number.isFinite(ackSeq) || ackSeq <= 0) return;
    session.commands = session.commands.filter(
      (cmd) => !(cmd.targetDeviceId === deviceId && cmd.seq <= ackSeq)
    );
  }

  private notifyWaiters(userId: string): void {
    const userWaiters = this.waiters.get(userId);
    if (!userWaiters || userWaiters.size === 0) return;
    for (const waiter of userWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    userWaiters.clear();
  }

  private buildSnapshot(session: InternalUserSession, forDeviceId?: string): PlaybackSessionSnapshot {
    const now = Date.now();
    const devices: SessionDeviceView[] = Array.from(session.devices.values())
      .sort((a, b) => a.registeredAt - b.registeredAt)
      .map((d) => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        platform: d.platform,
        lastSeenAt: d.lastSeenAt,
        isOnline: now - d.lastSeenAt <= DEVICE_OFFLINE_TTL_MS,
        isActive: session.activeDeviceId === d.deviceId,
      }));

    const commands = forDeviceId
      ? session.commands.filter((cmd) => cmd.targetDeviceId === forDeviceId)
      : [];

    return {
      userId: session.userId,
      activeDeviceId: session.activeDeviceId,
      revision: session.revision,
      devices,
      playback: { ...session.playback },
      commands,
    };
  }

  registerDevice(
    userId: string,
    input: {
      deviceId: string;
      deviceName: string;
      platform: DevicePlatform;
      makeActiveIfNone?: boolean;
    }
  ): PlaybackSessionSnapshot {
    const session = this.getOrCreateSession(userId);
    const now = Date.now();
    this.pruneExpiredState(session, now);

    const existing = session.devices.get(input.deviceId);
    session.devices.set(input.deviceId, {
      deviceId: input.deviceId,
      deviceName: input.deviceName.trim().slice(0, 80) || `${input.platform} Device`,
      platform: input.platform,
      lastSeenAt: now,
      registeredAt: existing?.registeredAt ?? now,
    });

    // Only claim active playback automatically if no online device is currently active.
    if (!session.activeDeviceId || !session.devices.has(session.activeDeviceId)) {
      if (input.makeActiveIfNone !== false) {
        session.activeDeviceId = input.deviceId;
      }
    }

    session.revision += 1;
    this.notifyWaiters(userId);
    return this.buildSnapshot(session, input.deviceId);
  }

  heartbeat(userId: string, deviceId: string, ackSeq?: number): PlaybackSessionSnapshot {
    const session = this.getOrCreateSession(userId);
    const now = Date.now();
    this.pruneExpiredState(session, now);
    this.acknowledgeCommands(session, deviceId, ackSeq);

    const device = session.devices.get(deviceId);
    if (device) {
      device.lastSeenAt = now;
    }
    return this.buildSnapshot(session, deviceId);
  }

  unregisterDevice(userId: string, deviceId: string): PlaybackSessionSnapshot {
    const session = this.getOrCreateSession(userId);
    const removed = session.devices.delete(deviceId);
    session.commands = session.commands.filter((cmd) => cmd.targetDeviceId !== deviceId);

    if (session.activeDeviceId === deviceId) {
      session.activeDeviceId = Array.from(session.devices.values())[0]?.deviceId ?? null;
      session.playback.isPlaying = false;
      session.playback.updatedAt = Date.now();
    }

    if (removed) {
      session.revision += 1;
      this.notifyWaiters(userId);
    }

    return this.buildSnapshot(session, deviceId);
  }

  getSnapshot(userId: string, deviceId?: string, ackSeq?: number): PlaybackSessionSnapshot {
    const session = this.getOrCreateSession(userId);
    const now = Date.now();
    const expiredChanged = this.pruneExpiredState(session, now);

    if (deviceId) {
      const device = session.devices.get(deviceId);
      if (device) {
        device.lastSeenAt = now;
      }
      this.acknowledgeCommands(session, deviceId, ackSeq);
    }

    if (expiredChanged) {
      this.notifyWaiters(userId);
    }
    return this.buildSnapshot(session, deviceId);
  }

  async waitForUpdate(
    userId: string,
    deviceId: string,
    sinceRevision: number,
    timeoutMs: number,
    ackSeq?: number,
    onAbortSignal?: (cleanup: () => void) => void
  ): Promise<PlaybackSessionSnapshot> {
    const session = this.getOrCreateSession(userId);
    const now = Date.now();
    this.pruneExpiredState(session, now);
    if (deviceId) {
      const d = session.devices.get(deviceId);
      if (d) d.lastSeenAt = now;
      this.acknowledgeCommands(session, deviceId, ackSeq);
    }

    const hasPendingCommands = session.commands.some((cmd) => cmd.targetDeviceId === deviceId);
    if (session.revision > sinceRevision || hasPendingCommands || timeoutMs <= 0) {
      return this.buildSnapshot(session, deviceId);
    }

    const boundedTimeout = Math.min(Math.max(timeoutMs, 100), 20_000);

    await new Promise<void>((resolve) => {
      let userWaiters = this.waiters.get(userId);
      if (!userWaiters) {
        userWaiters = new Set();
        this.waiters.set(userId, userWaiters);
      }

      const waiter: PollWaiter = {
        deviceId,
        resolve: () => resolve(),
        timer: setTimeout(() => {
          userWaiters?.delete(waiter);
          resolve();
        }, boundedTimeout),
      };

      userWaiters.add(waiter);

      onAbortSignal?.(() => {
        clearTimeout(waiter.timer);
        userWaiters?.delete(waiter);
        resolve();
      });
    });

    const refreshed = this.getOrCreateSession(userId);
    const endNow = Date.now();
    const d = refreshed.devices.get(deviceId);
    if (d) d.lastSeenAt = endNow;
    return this.buildSnapshot(refreshed, deviceId);
  }

  transferActiveDevice(
    userId: string,
    targetDeviceId: string,
    triggeredByDeviceId: string
  ): { ok: true; snapshot: PlaybackSessionSnapshot } | { ok: false; code: string; message: string } {
    const session = this.getOrCreateSession(userId);
    const now = Date.now();
    this.pruneExpiredState(session, now);

    const target = session.devices.get(targetDeviceId);
    if (!target) {
      return {
        ok: false,
        code: 'DEVICE_NOT_FOUND',
        message: 'Target playback device is offline or not registered on this account.',
      };
    }

    const previousActiveDeviceId = session.activeDeviceId;
    if (previousActiveDeviceId === targetDeviceId) {
      return { ok: true, snapshot: this.buildSnapshot(session, triggeredByDeviceId) };
    }

    session.activeDeviceId = targetDeviceId;

    // Immediately force the old active device to halt audio output (only 1 playing device at a time).
    if (previousActiveDeviceId && session.devices.has(previousActiveDeviceId)) {
      this.enqueueCommand(session, previousActiveDeviceId, triggeredByDeviceId, 'STOP_LOCAL', {
        reason: 'DEVICE_TRANSFERRED',
        newActiveDeviceId: targetDeviceId,
        newActiveDeviceName: target.deviceName,
      });
    }

    // Instruct the newly selected device to pick up current track seamlessly.
    if (session.playback.track) {
      this.enqueueCommand(session, targetDeviceId, triggeredByDeviceId, 'SYNC_TAKEOVER', {
        track: session.playback.track,
        positionSec: session.playback.positionSec,
        isPlaying: session.playback.isPlaying,
        queue: session.playback.queue,
        queueIndex: session.playback.queueIndex,
        volume: session.playback.volume,
        isMuted: session.playback.isMuted,
        isShuffle: session.playback.isShuffle,
        repeatMode: session.playback.repeatMode,
      });
    }

    session.playback.updatedAt = now;
    session.playback.updatedByDeviceId = triggeredByDeviceId;
    session.revision += 1;
    this.notifyWaiters(userId);

    return { ok: true, snapshot: this.buildSnapshot(session, triggeredByDeviceId) };
  }

  publishActiveState(
    userId: string,
    deviceId: string,
    updates: Partial<Omit<SessionPlaybackState, 'updatedAt' | 'updatedByDeviceId'>>
  ):
    | { ok: true; snapshot: PlaybackSessionSnapshot }
    | { ok: false; code: 'NOT_ACTIVE_DEVICE' | 'DEVICE_NOT_FOUND'; activeDeviceId: string | null; message: string } {
    const session = this.getOrCreateSession(userId);
    const now = Date.now();
    this.pruneExpiredState(session, now);

    const device = session.devices.get(deviceId);
    if (!device) {
      return {
        ok: false,
        code: 'DEVICE_NOT_FOUND',
        activeDeviceId: session.activeDeviceId,
        message: 'Device is not registered in this playback session.',
      };
    }

    device.lastSeenAt = now;

    if (!session.activeDeviceId) {
      session.activeDeviceId = deviceId;
    }

    if (session.activeDeviceId !== deviceId) {
      // Strictly reject competing playback updates from a non-active remote device.
      if (updates.isPlaying) {
        this.enqueueCommand(session, deviceId, session.activeDeviceId, 'STOP_LOCAL', {
          reason: 'ACTIVE_ELSEWHERE',
          activeDeviceId: session.activeDeviceId,
        });
        session.revision += 1;
        this.notifyWaiters(userId);
      }
      return {
        ok: false,
        code: 'NOT_ACTIVE_DEVICE',
        activeDeviceId: session.activeDeviceId,
        message: 'Another device is currently the active playing device for this account.',
      };
    }

    session.playback = {
      ...session.playback,
      ...updates,
      updatedAt: now,
      updatedByDeviceId: deviceId,
    };
    session.revision += 1;
    this.notifyWaiters(userId);

    return { ok: true, snapshot: this.buildSnapshot(session, deviceId) };
  }

  issueCommand(
    userId: string,
    issuedByDeviceId: string,
    type: PlaybackCommandType,
    payload?: Record<string, unknown>
  ):
    | { ok: true; command: PendingCommand; snapshot: PlaybackSessionSnapshot }
    | { ok: false; code: string; message: string } {
    const session = this.getOrCreateSession(userId);
    const now = Date.now();
    this.pruneExpiredState(session, now);

    const issuer = session.devices.get(issuedByDeviceId);
    if (issuer) {
      issuer.lastSeenAt = now;
    }

    if (!session.activeDeviceId || !session.devices.has(session.activeDeviceId)) {
      if (issuer) {
        session.activeDeviceId = issuedByDeviceId;
      } else {
        return {
          ok: false,
          code: 'NO_ACTIVE_DEVICE',
          message: 'No online playing device is available for this account.',
        };
      }
    }

    const targetDeviceId = session.activeDeviceId;

    // Reflect optimistic remote state changes cleanly on the session snapshot so remotes stay in sync.
    if (type === 'PLAY_TRACK' && payload?.track && typeof payload.track === 'object') {
      const nextTrack = payload.track as SessionTrack;
      const nextQueue = Array.isArray(payload.queue)
        ? (payload.queue as SessionTrack[])
        : session.playback.queue;
      const idx = nextQueue.findIndex((t) => t.id === nextTrack.id);
      session.playback.track = nextTrack;
      session.playback.queue = nextQueue.length > 0 ? nextQueue : [nextTrack];
      session.playback.queueIndex = idx >= 0 ? idx : 0;
      session.playback.isPlaying = true;
      session.playback.positionSec = 0;
      session.playback.durationSec = Math.round((nextTrack.durationMs || 240000) / 1000);
    } else if (type === 'PAUSE') {
      session.playback.isPlaying = false;
    } else if (type === 'PLAY') {
      session.playback.isPlaying = true;
    } else if (type === 'TOGGLE_PLAY') {
      session.playback.isPlaying = !session.playback.isPlaying;
    } else if (type === 'SEEK' && typeof payload?.positionSec === 'number') {
      session.playback.positionSec = Math.max(0, payload.positionSec);
    } else if (type === 'SET_VOLUME') {
      if (typeof payload?.volume === 'number') {
        session.playback.volume = Math.min(1, Math.max(0, payload.volume));
      }
      if (typeof payload?.isMuted === 'boolean') {
        session.playback.isMuted = payload.isMuted;
      }
    } else if (type === 'TOGGLE_SHUFFLE') {
      session.playback.isShuffle = !session.playback.isShuffle;
    } else if (type === 'TOGGLE_REPEAT') {
      const order: Array<'OFF' | 'ALL' | 'ONE'> = ['OFF', 'ALL', 'ONE'];
      const curIdx = order.indexOf(session.playback.repeatMode);
      session.playback.repeatMode = order[(curIdx + 1) % order.length];
    } else if (type === 'SET_QUEUE' && Array.isArray(payload?.queue)) {
      const nextQueue = payload.queue as SessionTrack[];
      const startIndex = typeof payload.startIndex === 'number' ? payload.startIndex : 0;
      session.playback.queue = nextQueue;
      session.playback.queueIndex = startIndex;
      if (nextQueue[startIndex]) {
        session.playback.track = nextQueue[startIndex];
        session.playback.isPlaying = true;
        session.playback.positionSec = 0;
      }
    }

    session.playback.updatedAt = now;
    session.playback.updatedByDeviceId = issuedByDeviceId;

    const command = this.enqueueCommand(session, targetDeviceId, issuedByDeviceId, type, payload);
    session.revision += 1;
    this.notifyWaiters(userId);

    return {
      ok: true,
      command,
      snapshot: this.buildSnapshot(session, issuedByDeviceId),
    };
  }

  resetForTests(): void {
    if (process.env.NODE_ENV !== 'test') return;
    for (const waiterSet of this.waiters.values()) {
      for (const w of waiterSet) {
        clearTimeout(w.timer);
      }
    }
    this.waiters.clear();
    this.sessions.clear();
  }
}

export const playbackSessionCoordinator = new PlaybackSessionCoordinator();
