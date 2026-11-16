import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
  State,
  Track as RNTrack
} from 'react-native-track-player';
import { Track } from '../api/types';
import { apiClient } from '../api/client';
import { recommendationApi } from '../api/recommendationApi';

const isWebpageUrl = (url?: string): boolean =>
  Boolean(url && /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com|music\.apple\.com)\//i.test(url));

async function resolveAudioUrl(track: Track): Promise<string | undefined> {
  if (track.previewUrl && !isWebpageUrl(track.previewUrl)) {
    return track.previewUrl;
  }
  try {
    const res = await apiClient.get<{ success?: boolean; audioUrl?: string }>('/api/search/resolve-audio', {
      params: { title: track.title, artist: track.artist }
    });
    if (res.data?.audioUrl) {
      return res.data.audioUrl;
    }
  } catch {
    // Keep undefined if lookup fails
  }
  return !isWebpageUrl(track.sourceUrl) ? track.sourceUrl : undefined;
}

class AudioManager {
  private isInitialized = false;

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

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('[AudioManager] setupPlayer failed:', error);
      return false;
    }
  }

  async playTrack(track: Track, queue: Track[] = [track]): Promise<void> {
    await this.setupPlayer();

    const resolvedUrls = await Promise.all(
      queue.map(async (t) => ({
        track: t,
        url: t.id === track.id ? await resolveAudioUrl(t) : t.previewUrl || (!isWebpageUrl(t.sourceUrl) ? t.sourceUrl : undefined)
      }))
    );

    const rnTracks: RNTrack[] = resolvedUrls
      .filter((item): item is { track: Track; url: string } => Boolean(item.url))
      .map(({ track: t, url }) => ({
        id: t.id,
        url,
        title: t.title,
        artist: t.composer || t.artist,
        artwork: t.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
        duration: Math.round(t.durationMs / 1000)
      }));

    if (rnTracks.length === 0) {
      console.warn('[AudioManager] No playable audio stream resolved for track:', track.title);
      return;
    }

    await TrackPlayer.reset();
    await TrackPlayer.add(rnTracks);

    const targetIndex = rnTracks.findIndex((t) => t.id === track.id);
    if (targetIndex > 0) {
      await TrackPlayer.skip(targetIndex);
    }

    await TrackPlayer.play();

    // Dynamically train recommendation engine with actual playback behavior
    recommendationApi.recordListeningStat({
      songId: track.id,
      songName: track.title,
      movieOrAlbum: track.movieName || track.album,
      musicDirector: track.composer || track.artist,
      singers: track.singers || [track.artist],
      language: track.language,
      playCount: 1,
      lastPlayedAt: new Date().toISOString()
    }).catch(() => {});
  }

  async togglePlayPause(): Promise<void> {
    const state = await TrackPlayer.getState();
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
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
    await TrackPlayer.pause();
  }

  async reset(): Promise<void> {
    if (!this.isInitialized) return;
    await TrackPlayer.reset();
  }

  async resume(): Promise<void> {
    await this.setupPlayer();
    await TrackPlayer.play();
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
}

export const audioManager = new AudioManager();
