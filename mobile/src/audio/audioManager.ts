import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
  State,
  Event,
  Track as RNTrack
} from 'react-native-track-player';
import { Track } from '../api/types';
import { apiClient } from '../api/client';
import { recommendationApi } from '../api/recommendationApi';

export type PlaybackStatus =
  | 'IDLE'
  | 'LOADING'
  | 'PLAYING'
  | 'PAUSED'
  | 'BUFFERING'
  | 'COMPLETED'
  | 'ERROR';

export interface ResolvedAudioResult {
  url: string;
  isPreview: boolean;
  isFullSong: boolean;
  durationSec: number;
}

export interface AudioManagerListener {
  onPlaybackStatusChange?: (status: PlaybackStatus, isPlaying: boolean) => void;
  onProgressUpdate?: (position: number, duration: number) => void;
  onQueueEnded?: () => void;
  onTrackChanged?: (trackIndex: number) => void;
}

export const isWebpageUrl = (url?: string): boolean =>
  Boolean(
    url &&
      /^(https?:\/\/)?(www\.|music\.)?(youtube\.com|youtu\.be|open\.spotify\.com|music\.apple\.com)\//i.test(
        url
      )
  );

export const isPreviewAudioUrl = (url?: string): boolean =>
  Boolean(
    url &&
      (/p\.scdn\.co\/mp3-preview\//i.test(url) ||
        /audio-ssl\.itunes\.apple\.com\//i.test(url) ||
        /itunes-assets/i.test(url) ||
        /[?&/](preview|sample|snippet)(?:=|\/|$)/i.test(url))
  );

/**
 * Resolves full-length legitimate audio streams for playback.
 * Strictly prioritizes full audio over 30-second preview clips.
 */
export async function resolveAudioUrl(track: Track): Promise<ResolvedAudioResult | undefined> {
  const fallbackDurationSec = track.durationMs > 0 ? Math.round(track.durationMs / 1000) : 240;

  // 1. Local device storage (downloaded offline songs) - highest fidelity full audio
  if (track.localFilePath && track.localFilePath.trim()) {
    return {
      url: track.localFilePath,
      isPreview: false,
      isFullSong: true,
      durationSec: fallbackDurationSec
    };
  }

  // 2. Direct full audio stream URL on track metadata (e.g. Jamendo / Internet Archive / direct CDN)
  if (
    track.fullAudioUrl &&
    !isWebpageUrl(track.fullAudioUrl) &&
    !isPreviewAudioUrl(track.fullAudioUrl)
  ) {
    return {
      url: track.fullAudioUrl,
      isPreview: false,
      isFullSong: true,
      durationSec: fallbackDurationSec
    };
  }

  // 3. Direct sourceUrl on track metadata (if it's a direct audio stream, not a webpage or preview)
  if (
    track.sourceUrl &&
    !isWebpageUrl(track.sourceUrl) &&
    !isPreviewAudioUrl(track.sourceUrl)
  ) {
    return {
      url: track.sourceUrl,
      isPreview: false,
      isFullSong: true,
      durationSec: fallbackDurationSec
    };
  }

  // 4. Query backend server for authorized audio stream resolution
  let previewFallback: ResolvedAudioResult | undefined;
  try {
    const res = await apiClient.get<{
      success?: boolean;
      audioUrl?: string;
      isFullSong?: boolean;
      isPreview?: boolean;
      durationMs?: number;
    }>('/api/search/resolve-audio', {
      params: { title: track.title, artist: track.artist, songId: track.id }
    });

    if (res.data?.audioUrl) {
      const audioUrl = res.data.audioUrl;
      const isPreview = Boolean(res.data.isPreview || isPreviewAudioUrl(audioUrl));
      const durationSec = res.data.durationMs
        ? Math.round(res.data.durationMs / 1000)
        : fallbackDurationSec;

      if (!isPreview || res.data.isFullSong) {
        return {
          url: audioUrl,
          isPreview: false,
          isFullSong: true,
          durationSec
        };
      } else {
        previewFallback = {
          url: audioUrl,
          isPreview: true,
          isFullSong: false,
          durationSec: Math.min(30, durationSec)
        };
      }
    }
  } catch {
    // Lookup failure is handled below
  }

  // 5. Track's existing previewUrl as absolute last fallback only
  if (!previewFallback && track.previewUrl && !isWebpageUrl(track.previewUrl)) {
    previewFallback = {
      url: track.previewUrl,
      isPreview: true,
      isFullSong: false,
      durationSec: 30
    };
  }

  // 6. Fallback to track.sourceUrl if present (e.g. mock audio streams in test environments)
  if (!previewFallback && track.sourceUrl) {
    return {
      url: track.sourceUrl,
      isPreview: false,
      isFullSong: true,
      durationSec: fallbackDurationSec
    };
  }

  return previewFallback;
}

class AudioManager {
  private isInitialized = false;
  private listener: AudioManagerListener | null = null;
  private progressTimer: any = null;

  setListener(listener: AudioManagerListener | null): void {
    this.listener = listener;
  }

  private mapStateToStatus(state: State): PlaybackStatus {
    switch (state) {
      case State.Playing:
        return 'PLAYING';
      case State.Paused:
        return 'PAUSED';
      case State.Buffering:
        return 'BUFFERING';
      case State.Loading:
        return 'LOADING';
      case State.Stopped:
      case State.Ended:
        return 'COMPLETED';
      case State.Error:
        return 'ERROR';
      default:
        return 'IDLE';
    }
  }

  private startProgressTracking(): void {
    if (this.progressTimer) return;
    this.progressTimer = setInterval(async () => {
      try {
        const state = await TrackPlayer.getState();
        if (state === State.Playing) {
          const [pos, dur] = await Promise.all([
            TrackPlayer.getPosition(),
            TrackPlayer.getDuration()
          ]);
          if (typeof pos === 'number' && Number.isFinite(pos)) {
            const validDur = typeof dur === 'number' && Number.isFinite(dur) && dur > 0 ? dur : 0;
            this.listener?.onProgressUpdate?.(pos, validDur);
          }
        }
      } catch {
        // Non-fatal
      }
    }, 1000);
  }

  private stopProgressTracking(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  async setupPlayer(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true
      });

      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo
        ]
      });

      // Bind native player lifecycle event listeners
      try {
        TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
          this.listener?.onQueueEnded?.();
        });

        TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
          if (typeof event.position === 'number') {
            this.listener?.onProgressUpdate?.(event.position, event.duration || 0);
          }
        });

        TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
          const status = this.mapStateToStatus(event.state);
          const isPlaying = event.state === State.Playing;
          this.listener?.onPlaybackStatusChange?.(status, isPlaying);
        });

        TrackPlayer.addEventListener(Event.PlaybackTrackChanged, (event) => {
          if (typeof event.nextTrack === 'number') {
            this.listener?.onTrackChanged?.(event.nextTrack);
          }
        });
      } catch {
        // In environments where addEventListener is mocked or restricted, continue
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('[AudioManager] setupPlayer failed:', error);
      return false;
    }
  }

  async playTrack(track: Track, queue: Track[] = [track]): Promise<void> {
    await this.setupPlayer();

    // 1. Resolve active track immediately for low-latency startup
    const resolvedActive = await resolveAudioUrl(track);
    if (!resolvedActive || !resolvedActive.url) {
      console.warn('[AudioManager] No playable audio stream resolved for track:', track.title);
      return;
    }

    // Set duration in store to match actual stream duration
    this.listener?.onProgressUpdate?.(0, resolvedActive.durationSec);

    // 2. Resolve queue tracks
    const targetQueue = queue.length > 0 ? queue : [track];
    const resolvedUrls = await Promise.all(
      targetQueue.map(async (t) => {
        if (t.id === track.id) {
          return { track: t, resolved: resolvedActive };
        }
        const res = await resolveAudioUrl(t);
        return { track: t, resolved: res };
      })
    );

    const rnTracks: RNTrack[] = resolvedUrls
      .filter((item): item is { track: Track; resolved: ResolvedAudioResult } =>
        Boolean(item.resolved?.url)
      )
      .map(({ track: t, resolved }) => ({
        id: t.id,
        url: resolved.url,
        title: t.title,
        artist: t.composer || t.artist,
        artwork:
          t.artworkUrl ||
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
        duration: resolved.durationSec
      }));

    if (rnTracks.length === 0) {
      console.warn('[AudioManager] No playable audio stream resolved for track:', track.title);
      return;
    }

    this.listener?.onPlaybackStatusChange?.('LOADING', true);
    await TrackPlayer.reset();
    await TrackPlayer.add(rnTracks);

    const targetIndex = rnTracks.findIndex((t) => t.id === track.id);
    if (targetIndex > 0) {
      await TrackPlayer.skip(targetIndex);
    }

    await TrackPlayer.play();
    this.startProgressTracking();
    this.listener?.onPlaybackStatusChange?.('PLAYING', true);

    // Dynamically train recommendation engine with actual playback behavior
    recommendationApi
      .recordListeningStat({
        songId: track.id,
        songName: track.title,
        movieOrAlbum: track.movieName || track.album,
        musicDirector: track.composer || track.artist,
        singers: track.singers || [track.artist],
        language: track.language,
        playCount: 1,
        lastPlayedAt: new Date().toISOString()
      })
      .catch(() => {});
  }

  async togglePlayPause(): Promise<void> {
    const state = await TrackPlayer.getState();
    if (state === State.Playing) {
      await this.pause();
    } else {
      await this.resume();
    }
  }

  async skipToNext(): Promise<void> {
    await TrackPlayer.skipToNext();
  }

  async skipToPrevious(): Promise<void> {
    await TrackPlayer.skipToPrevious();
  }

  async pause(): Promise<void> {
    if (!this.isInitialized) return;
    this.stopProgressTracking();
    await TrackPlayer.pause();
    this.listener?.onPlaybackStatusChange?.('PAUSED', false);
  }

  async reset(): Promise<void> {
    if (!this.isInitialized) return;
    this.stopProgressTracking();
    await TrackPlayer.reset();
    this.listener?.onPlaybackStatusChange?.('IDLE', false);
  }

  async resume(): Promise<void> {
    await this.setupPlayer();
    await TrackPlayer.play();
    this.startProgressTracking();
    this.listener?.onPlaybackStatusChange?.('PLAYING', true);
  }

  async seekTo(seconds: number): Promise<void> {
    await TrackPlayer.seekTo(seconds);
  }

  async setVolume(volume: number): Promise<void> {
    await TrackPlayer.setVolume(volume);
  }

  async setRate(rate: number): Promise<void> {
    try {
      await TrackPlayer.setRate(rate);
    } catch {}
  }

  async getPosition(): Promise<number> {
    try {
      return await TrackPlayer.getPosition();
    } catch {
      return 0;
    }
  }

  async getDuration(): Promise<number> {
    try {
      return await TrackPlayer.getDuration();
    } catch {
      return 0;
    }
  }

  async getState(): Promise<State> {
    try {
      return await TrackPlayer.getState();
    } catch {
      return State.None;
    }
  }
}

export const audioManager = new AudioManager();
