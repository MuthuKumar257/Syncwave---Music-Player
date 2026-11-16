import { create } from 'zustand';
import { Song } from '../types';

export type DevicePlatform = 'WEB' | 'MOBILE_RN' | 'ANDROID';

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

export interface SessionDeviceView {
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  lastSeenAt: number;
  isOnline: boolean;
  isActive: boolean;
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

export interface PendingCommand {
  id: string;
  seq: number;
  type: PlaybackCommandType;
  payload?: Record<string, unknown>;
  targetDeviceId: string;
  issuedByDeviceId: string;
  issuedAt: number;
}

interface SessionSnapshot {
  userId: string;
  activeDeviceId: string | null;
  revision: number;
  devices: SessionDeviceView[];
  playback: SessionPlaybackState;
  commands: PendingCommand[];
}

const DEVICE_ID_STORAGE_KEY = 'syncwave_web_device_id';

const getOrCreateDeviceId = (): string => {
  if (typeof localStorage === 'undefined') {
    return `web_${Math.random().toString(36).slice(2, 12)}`;
  }
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `web_${crypto.randomUUID()}`
      : `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
};

const detectBrowserDeviceName = (): string => {
  if (typeof navigator === 'undefined') return 'SyncWave Web';
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Desktop';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `Web • ${browser} (${os})`;
};

export const songToSessionTrack = (song: Song): SessionTrack => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  album: song.album,
  durationMs: song.durationMs,
  artworkUrl: song.artworkUrl,
  videoId: song.videoId,
  externalUrl: song.externalUrl,
  source: song.source,
});

export const sessionTrackToSong = (track: SessionTrack): Song => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  album: track.album || 'Single',
  durationMs: track.durationMs || 240000,
  artworkUrl: track.artworkUrl,
  videoId: track.videoId,
  externalUrl: track.externalUrl,
  source: (track.source as Song['source']) || 'YOUTUBE',
  createdAt: new Date().toISOString(),
});

type CommandHandler = (cmd: PendingCommand) => void;
type HaltAudioHandler = () => void;
type RemoteMirrorHandler = (playback: SessionPlaybackState) => void;

let commandHandler: CommandHandler | null = null;
let haltAudioHandler: HaltAudioHandler | null = null;
let remoteMirrorHandler: RemoteMirrorHandler | null = null;

export const registerPlaybackSessionBridge = (handlers: {
  onCommand: CommandHandler;
  onHaltLocalAudio: HaltAudioHandler;
  onMirrorRemotePlayback: RemoteMirrorHandler;
}) => {
  commandHandler = handlers.onCommand;
  haltAudioHandler = handlers.onHaltLocalAudio;
  remoteMirrorHandler = handlers.onMirrorRemotePlayback;
};

let activePollAbort: AbortController | null = null;
let activeHeartbeatTimer: number | null = null;
let lastTokenRef: string | null = null;
let highestAckSeq = 0;
const processedCommandSeqs = new Set<number>();

interface PlaybackSessionStoreState {
  myDeviceId: string;
  myDeviceName: string;
  isConnected: boolean;
  activeDeviceId: string | null;
  revision: number;
  devices: SessionDeviceView[];
  isRemoteMode: boolean;
  remotePlayback: SessionPlaybackState | null;
  isDevicePickerOpen: boolean;
  transferError: string | null;

  setDevicePickerOpen: (open: boolean) => void;
  startSessionSync: (token: string) => Promise<void>;
  stopSessionSync: () => Promise<void>;
  transferPlayback: (targetDeviceId: string) => Promise<boolean>;
  sendRemoteCommand: (type: PlaybackCommandType, payload?: Record<string, unknown>) => Promise<void>;
  publishActiveState: (state: Partial<SessionPlaybackState>) => Promise<void>;
}

const applySnapshotToStore = (
  set: (partial: Partial<PlaybackSessionStoreState>) => void,
  get: () => PlaybackSessionStoreState,
  snapshot: SessionSnapshot
) => {
  const { myDeviceId } = get();
  const isRemoteMode =
    snapshot.activeDeviceId !== null && snapshot.activeDeviceId !== myDeviceId;

  if (isRemoteMode) {
    haltAudioHandler?.();
    if (snapshot.playback) {
      remoteMirrorHandler?.(snapshot.playback);
    }
  }

  for (const cmd of snapshot.commands || []) {
    if (cmd.seq > highestAckSeq) highestAckSeq = cmd.seq;
    if (processedCommandSeqs.has(cmd.seq)) continue;
    processedCommandSeqs.add(cmd.seq);
    if (processedCommandSeqs.size > 120) {
      const oldest = Array.from(processedCommandSeqs).sort((a, b) => a - b)[0];
      if (oldest !== undefined) processedCommandSeqs.delete(oldest);
    }

    if (cmd.type === 'STOP_LOCAL') {
      haltAudioHandler?.();
    } else if (!isRemoteMode || cmd.type === 'SYNC_TAKEOVER') {
      commandHandler?.(cmd);
    }
  }

  set({
    isConnected: true,
    activeDeviceId: snapshot.activeDeviceId,
    revision: snapshot.revision,
    devices: snapshot.devices,
    isRemoteMode,
    remotePlayback: snapshot.playback,
    transferError: null,
  });
};

export const usePlaybackSessionStore = create<PlaybackSessionStoreState>((set, get) => ({
  myDeviceId: getOrCreateDeviceId(),
  myDeviceName: detectBrowserDeviceName(),
  isConnected: false,
  activeDeviceId: null,
  revision: 0,
  devices: [],
  isRemoteMode: false,
  remotePlayback: null,
  isDevicePickerOpen: false,
  transferError: null,

  setDevicePickerOpen: (open) => set({ isDevicePickerOpen: open, transferError: null }),

  startSessionSync: async (token: string) => {
    if (!token) return;
    if (lastTokenRef === token && get().isConnected) return;

    await get().stopSessionSync();
    lastTokenRef = token;

    const { myDeviceId, myDeviceName } = get();
    try {
      const res = await fetch('/api/playback-session/devices/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId: myDeviceId,
          deviceName: myDeviceName,
          platform: 'WEB',
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.session) {
        applySnapshotToStore(set, get, data.session as SessionSnapshot);
      }
    } catch {
      return;
    }

    const abortController = new AbortController();
    activePollAbort = abortController;

    const pollLoop = async () => {
      while (!abortController.signal.aborted && lastTokenRef === token) {
        try {
          const { revision } = get();
          const url = `/api/playback-session/poll?deviceId=${encodeURIComponent(
            myDeviceId
          )}&sinceRevision=${revision}&timeoutMs=15000&ackSeq=${highestAckSeq}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: abortController.signal,
          });
          if (res.status === 401) break;
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.session) {
              applySnapshotToStore(set, get, data.session as SessionSnapshot);
            }
          } else {
            await new Promise((r) => setTimeout(r, 2000));
          }
        } catch (err: any) {
          if (err?.name === 'AbortError' || abortController.signal.aborted) break;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    };

    void pollLoop();

    activeHeartbeatTimer = window.setInterval(() => {
      if (lastTokenRef !== token) return;
      fetch('/api/playback-session/devices/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deviceId: myDeviceId, ackSeq: highestAckSeq }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data.session) {
            applySnapshotToStore(set, get, data.session as SessionSnapshot);
          }
        })
        .catch(() => {});
    }, 20000);
  },

  stopSessionSync: async () => {
    const prevToken = lastTokenRef;
    lastTokenRef = null;
    if (activePollAbort) {
      activePollAbort.abort();
      activePollAbort = null;
    }
    if (activeHeartbeatTimer !== null) {
      window.clearInterval(activeHeartbeatTimer);
      activeHeartbeatTimer = null;
    }
    processedCommandSeqs.clear();
    highestAckSeq = 0;

    const { myDeviceId, isConnected } = get();
    set({
      isConnected: false,
      activeDeviceId: null,
      revision: 0,
      devices: [],
      isRemoteMode: false,
      remotePlayback: null,
    });

    if (prevToken && isConnected) {
      fetch('/api/playback-session/devices/unregister', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${prevToken}`,
        },
        body: JSON.stringify({ deviceId: myDeviceId }),
        keepalive: true,
      }).catch(() => {});
    }
  },

  transferPlayback: async (targetDeviceId: string) => {
    const token = lastTokenRef || (typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null);
    if (!token) return false;

    const { myDeviceId } = get();
    try {
      const res = await fetch('/api/playback-session/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deviceId: myDeviceId, targetDeviceId }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.session) {
        applySnapshotToStore(set, get, data.session as SessionSnapshot);
        return true;
      }
      set({ transferError: data.message || 'Could not switch playing device.' });
      return false;
    } catch {
      set({ transferError: 'Network error switching playing device.' });
      return false;
    }
  },

  sendRemoteCommand: async (type, payload) => {
    const token = lastTokenRef || (typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null);
    if (!token) return;

    const { myDeviceId } = get();
    try {
      const res = await fetch('/api/playback-session/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deviceId: myDeviceId, type, payload }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.session) {
        applySnapshotToStore(set, get, data.session as SessionSnapshot);
      }
    } catch {
      // Ignore transient network errors
    }
  },

  publishActiveState: async (stateUpdate) => {
    const token = lastTokenRef;
    const { isConnected, isRemoteMode, myDeviceId } = get();
    if (!token || !isConnected || isRemoteMode) return;

    try {
      const res = await fetch('/api/playback-session/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId: myDeviceId,
          ...stateUpdate,
        }),
      });

      if (res.status === 409) {
        // Server enforces single active device: immediately step down to Remote mode.
        const errData = await res.json().catch(() => ({}));
        haltAudioHandler?.();
        set({
          isRemoteMode: true,
          activeDeviceId: errData.activeDeviceId || get().activeDeviceId,
        });
      }
    } catch {
      // Ignore transient sync error
    }
  },
}));
