import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import axios from 'axios';
import { apiClient } from '../api/client';
import { Track } from '../api/types';

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

const MOBILE_DEVICE_ID_KEY = 'syncwave_mobile_device_id';

export const trackToSessionTrack = (t: Track): SessionTrack => ({
  id: t.id,
  title: t.title,
  artist: t.artist,
  album: t.movieName || t.album,
  durationMs: t.durationMs,
  artworkUrl: t.artworkUrl,
  externalUrl: t.sourceUrl,
  source: t.sourcePlatform,
});

export const sessionTrackToMobileTrack = (t: SessionTrack): Track => ({
  id: t.id,
  title: t.title,
  artist: t.artist,
  movieName: t.album,
  album: t.album || 'Single',
  durationMs: t.durationMs || 240000,
  sourcePlatform:
    t.source === 'SPOTIFY' || t.source === 'APPLE_MUSIC' || t.source === 'LOCAL_DEVICE'
      ? (t.source as Track['sourcePlatform'])
      : 'YOUTUBE',
  sourceUrl: t.externalUrl || (t.videoId ? `https://youtube.com/watch?v=${t.videoId}` : ''),
  isPlayableDirectly: true,
  artworkUrl: t.artworkUrl || '',
  language: 'Tamil',
});

type MobileCommandHandler = (cmd: PendingCommand) => void;
type MobileHaltHandler = () => void;
type MobileMirrorHandler = (playback: SessionPlaybackState) => void;

let commandHandler: MobileCommandHandler | null = null;
let haltHandler: MobileHaltHandler | null = null;
let mirrorHandler: MobileMirrorHandler | null = null;

export const registerMobilePlaybackSessionBridge = (handlers: {
  onCommand: MobileCommandHandler;
  onHaltLocalAudio: MobileHaltHandler;
  onMirrorRemotePlayback: MobileMirrorHandler;
}) => {
  commandHandler = handlers.onCommand;
  haltHandler = handlers.onHaltLocalAudio;
  mirrorHandler = handlers.onMirrorRemotePlayback;
};

let activeSessionToken: string | null = null;
let pollCancelled = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let highestAckSeq = 0;
const processedSeqs = new Set<number>();

const ensureDeviceId = async (): Promise<string> => {
  try {
    const existing = await AsyncStorage.getItem(MOBILE_DEVICE_ID_KEY);
    if (existing) return existing;
    const generated = `rn_${Platform.OS}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await AsyncStorage.setItem(MOBILE_DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `rn_${Platform.OS}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

const defaultDeviceName = (): string =>
  Platform.OS === 'ios' ? 'SyncWave iPhone App' : 'SyncWave Mobile App';

interface MobilePlaybackSessionState {
  myDeviceId: string;
  myDeviceName: string;
  isConnected: boolean;
  activeDeviceId: string | null;
  revision: number;
  devices: SessionDeviceView[];
  isRemoteMode: boolean;
  remotePlayback: SessionPlaybackState | null;
  isDevicePickerVisible: boolean;
  transferError: string | null;

  setDevicePickerVisible: (visible: boolean) => void;
  startSessionSync: (token: string) => Promise<void>;
  stopSessionSync: () => Promise<void>;
  transferPlayback: (targetDeviceId: string) => Promise<boolean>;
  sendRemoteCommand: (type: PlaybackCommandType, payload?: Record<string, unknown>) => Promise<void>;
  publishActiveState: (updates: Partial<SessionPlaybackState>) => Promise<void>;
}

const applySnapshot = (
  set: (partial: Partial<MobilePlaybackSessionState>) => void,
  get: () => MobilePlaybackSessionState,
  snapshot: SessionSnapshot
) => {
  const { myDeviceId } = get();
  const isRemoteMode =
    snapshot.activeDeviceId !== null && snapshot.activeDeviceId !== myDeviceId;

  if (isRemoteMode) {
    haltHandler?.();
    if (snapshot.playback) {
      mirrorHandler?.(snapshot.playback);
    }
  }

  for (const cmd of snapshot.commands || []) {
    if (cmd.seq > highestAckSeq) highestAckSeq = cmd.seq;
    if (processedSeqs.has(cmd.seq)) continue;
    processedSeqs.add(cmd.seq);
    if (processedSeqs.size > 100) {
      const oldest = Array.from(processedSeqs).sort((a, b) => a - b)[0];
      if (oldest !== undefined) processedSeqs.delete(oldest);
    }

    if (cmd.type === 'STOP_LOCAL') {
      haltHandler?.();
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

export const usePlaybackSessionStore = create<MobilePlaybackSessionState>((set, get) => ({
  myDeviceId: 'rn_pending',
  myDeviceName: defaultDeviceName(),
  isConnected: false,
  activeDeviceId: null,
  revision: 0,
  devices: [],
  isRemoteMode: false,
  remotePlayback: null,
  isDevicePickerVisible: false,
  transferError: null,

  setDevicePickerVisible: (visible) =>
    set({ isDevicePickerVisible: visible, transferError: null }),

  startSessionSync: async (token: string) => {
    if (!token) return;
    if (activeSessionToken === token && get().isConnected) return;

    await get().stopSessionSync();
    activeSessionToken = token;
    pollCancelled = false;

    const deviceId = await ensureDeviceId();
    set({ myDeviceId: deviceId });

    try {
      const regRes = await apiClient.post<{ success: boolean; session?: SessionSnapshot }>(
        '/api/playback-session/devices/register',
        {
          deviceId,
          deviceName: get().myDeviceName,
          platform: 'MOBILE_RN',
        }
      );
      if (regRes.data.success && regRes.data.session) {
        applySnapshot(set, get, regRes.data.session);
      }
    } catch {
      return;
    }

    const loop = async () => {
      while (!pollCancelled && activeSessionToken === token) {
        try {
          const res = await apiClient.get<{ success: boolean; session?: SessionSnapshot }>(
            '/api/playback-session/poll',
            {
              params: {
                deviceId,
                sinceRevision: get().revision,
                timeoutMs: 15000,
                ackSeq: highestAckSeq,
              },
              timeout: 22000,
            }
          );
          if (pollCancelled || activeSessionToken !== token) break;
          if (res.data.success && res.data.session) {
            applySnapshot(set, get, res.data.session);
          }
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 401) break;
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
    };

    void loop();

    heartbeatTimer = setInterval(() => {
      if (pollCancelled || activeSessionToken !== token) return;
      apiClient
        .post<{ success: boolean; session?: SessionSnapshot }>(
          '/api/playback-session/devices/heartbeat',
          { deviceId, ackSeq: highestAckSeq }
        )
        .then((res) => {
          if (res.data.success && res.data.session) {
            applySnapshot(set, get, res.data.session);
          }
        })
        .catch(() => {});
    }, 20000);
  },

  stopSessionSync: async () => {
    const prevToken = activeSessionToken;
    const prevId = get().myDeviceId;
    const wasConnected = get().isConnected;

    activeSessionToken = null;
    pollCancelled = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    processedSeqs.clear();
    highestAckSeq = 0;

    set({
      isConnected: false,
      activeDeviceId: null,
      revision: 0,
      devices: [],
      isRemoteMode: false,
      remotePlayback: null,
    });

    if (prevToken && wasConnected && prevId !== 'rn_pending') {
      apiClient
        .post('/api/playback-session/devices/unregister', { deviceId: prevId })
        .catch(() => {});
    }
  },

  transferPlayback: async (targetDeviceId: string) => {
    const { myDeviceId } = get();
    try {
      const res = await apiClient.post<{
        success: boolean;
        session?: SessionSnapshot;
        message?: string;
      }>('/api/playback-session/transfer', { deviceId: myDeviceId, targetDeviceId });
      if (res.data.success && res.data.session) {
        applySnapshot(set, get, res.data.session);
        return true;
      }
      set({ transferError: res.data.message || 'Could not switch playing device.' });
      return false;
    } catch {
      set({ transferError: 'Network error switching playing device.' });
      return false;
    }
  },

  sendRemoteCommand: async (type, payload) => {
    const { myDeviceId } = get();
    try {
      const res = await apiClient.post<{ success: boolean; session?: SessionSnapshot }>(
        '/api/playback-session/command',
        { deviceId: myDeviceId, type, payload }
      );
      if (res.data.success && res.data.session) {
        applySnapshot(set, get, res.data.session);
      }
    } catch {
      // Ignore transient network errors
    }
  },

  publishActiveState: async (updates) => {
    const { isConnected, isRemoteMode, myDeviceId } = get();
    if (!isConnected || isRemoteMode || !activeSessionToken) return;

    try {
      await apiClient.post('/api/playback-session/state', {
        deviceId: myDeviceId,
        ...updates,
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const activeDeviceId = (err.response.data as { activeDeviceId?: string } | undefined)
          ?.activeDeviceId;
        haltHandler?.();
        set({
          isRemoteMode: true,
          activeDeviceId: activeDeviceId || get().activeDeviceId,
        });
      }
    }
  },
}));
