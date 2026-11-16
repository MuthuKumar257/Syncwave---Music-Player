import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '../api/types';
import { DownloadManager } from '../services/downloadManager';

const DOWNLOADS_KEY = '@syncwave_offline_downloads_v2';

export type DownloadStatus = 'IDLE' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED';

interface DownloadState {
  downloadedTracks: Track[];
  downloadProgress: Record<string, number>; // trackId -> percent (0 - 100)
  downloadStatus: Record<string, DownloadStatus>; // trackId -> status
  downloadErrors: Record<string, string>; // trackId -> error message
  failedTracks: Record<string, Track>; // trackId -> Track for retry

  // Actions
  initialize: () => Promise<void>;
  downloadTrack: (track: Track) => Promise<boolean>;
  retryDownload: (trackId: string) => Promise<boolean>;
  deleteTrack: (trackId: string) => Promise<void>;
  isDownloaded: (trackId: string) => boolean;
  getDownloadStatus: (trackId: string) => DownloadStatus;
  getDownloadProgress: (trackId: string) => number;
  getDownloadError: (trackId: string) => string | undefined;
  resetForGuest: () => void;
  clearAllDownloads: () => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloadedTracks: [],
  downloadProgress: {},
  downloadStatus: {},
  downloadErrors: {},
  failedTracks: {},

  initialize: async () => {
    try {
      const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
      if (raw) {
        const parsed: Track[] = JSON.parse(raw);
        const statusMap: Record<string, DownloadStatus> = {};
        parsed.forEach((t) => {
          statusMap[t.id] = 'COMPLETED';
        });
        set({
          downloadedTracks: parsed,
          downloadStatus: statusMap
        });
      }
    } catch (err) {
      console.warn('[useDownloadStore] Initialize error:', err);
    }
  },

  downloadTrack: async (track: Track): Promise<boolean> => {
    // Prevent duplicate downloads
    if (get().isDownloaded(track.id)) {
      return true;
    }

    if (get().downloadStatus[track.id] === 'DOWNLOADING') {
      return false;
    }

    // Set starting state
    set((state) => ({
      downloadStatus: { ...state.downloadStatus, [track.id]: 'DOWNLOADING' },
      downloadProgress: { ...state.downloadProgress, [track.id]: 0 },
      downloadErrors: { ...state.downloadErrors, [track.id]: '' }
    }));

    // 1. Validate audio source
    const validation = await DownloadManager.validateDownload(track);
    if (!validation.canDownload) {
      const reason = validation.reason || 'Track cannot be downloaded.';
      set((state) => ({
        downloadStatus: { ...state.downloadStatus, [track.id]: 'FAILED' },
        downloadErrors: { ...state.downloadErrors, [track.id]: reason },
        failedTracks: { ...state.failedTracks, [track.id]: track }
      }));
      return false;
    }

    // 2. Execute download with progress callbacks
    try {
      const targetUrl = validation.downloadUrl || track.sourceUrl;
      const downloadedTrack = await DownloadManager.executeDownload(
        track,
        targetUrl,
        (progress) => {
          set((state) => ({
            downloadProgress: { ...state.downloadProgress, [track.id]: progress }
          }));
        }
      );

      const currentList = get().downloadedTracks.filter((t) => t.id !== track.id);
      const updatedList = [downloadedTrack, ...currentList];

      set((state) => {
        const newProgress = { ...state.downloadProgress };
        delete newProgress[track.id];
        const newFailed = { ...state.failedTracks };
        delete newFailed[track.id];
        const newErrors = { ...state.downloadErrors };
        delete newErrors[track.id];

        return {
          downloadedTracks: updatedList,
          downloadStatus: { ...state.downloadStatus, [track.id]: 'COMPLETED' },
          downloadProgress: newProgress,
          failedTracks: newFailed,
          downloadErrors: newErrors
        };
      });

      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updatedList));
      return true;
    } catch (err: any) {
      const errorMsg = err?.message || 'Download failed. Please check your connection and retry.';
      set((state) => ({
        downloadStatus: { ...state.downloadStatus, [track.id]: 'FAILED' },
        downloadErrors: { ...state.downloadErrors, [track.id]: errorMsg },
        failedTracks: { ...state.failedTracks, [track.id]: track }
      }));
      return false;
    }
  },

  retryDownload: async (trackId: string): Promise<boolean> => {
    const track = get().failedTracks[trackId];
    if (!track) {
      return false;
    }
    return get().downloadTrack(track);
  },

  deleteTrack: async (trackId: string) => {
    const updated = get().downloadedTracks.filter((t) => t.id !== trackId);
    set((state) => {
      const newStatus = { ...state.downloadStatus };
      delete newStatus[trackId];
      const newProgress = { ...state.downloadProgress };
      delete newProgress[trackId];
      const newErrors = { ...state.downloadErrors };
      delete newErrors[trackId];
      const newFailed = { ...state.failedTracks };
      delete newFailed[trackId];

      return {
        downloadedTracks: updated,
        downloadStatus: newStatus,
        downloadProgress: newProgress,
        downloadErrors: newErrors,
        failedTracks: newFailed
      };
    });

    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
  },

  isDownloaded: (trackId: string) => {
    return get().downloadedTracks.some((t) => t.id === trackId);
  },

  getDownloadStatus: (trackId: string): DownloadStatus => {
    if (get().isDownloaded(trackId)) return 'COMPLETED';
    return get().downloadStatus[trackId] || 'IDLE';
  },

  getDownloadProgress: (trackId: string): number => {
    return get().downloadProgress[trackId] ?? (get().isDownloaded(trackId) ? 100 : 0);
  },

  getDownloadError: (trackId: string): string | undefined => {
    return get().downloadErrors[trackId];
  },

  resetForGuest: () => {
    set({
      downloadProgress: {},
      downloadStatus: {},
      downloadErrors: {},
      failedTracks: {}
    });
  },

  clearAllDownloads: async () => {
    set({
      downloadedTracks: [],
      downloadProgress: {},
      downloadStatus: {},
      downloadErrors: {},
      failedTracks: {}
    });
    try {
      await AsyncStorage.removeItem(DOWNLOADS_KEY);
    } catch {}
  }
}));
