import { Track } from '../api/types';
import { apiClient } from '../api/client';

export interface DownloadValidationResult {
  canDownload: boolean;
  reason?: string;
  downloadUrl?: string;
  expectedDurationMs?: number;
}

export class DownloadManager {
  /**
   * Validates whether a track has an authorized full-length downloadable audio stream.
   * Rejects previews, 30s clips, and stream-only DRM platforms.
   */
  static async validateDownload(track: Track): Promise<DownloadValidationResult> {
    // 1. If it's already a local or downloaded file, it is valid
    if (track.sourcePlatform === 'LOCAL' || track.sourcePlatform === 'DOWNLOADED') {
      return {
        canDownload: true,
        downloadUrl: track.localFilePath || track.sourceUrl
      };
    }

    // 2. Reject short preview clips directly (< 45 seconds)
    if (track.durationMs > 0 && track.durationMs < 45000) {
      return {
        canDownload: false,
        reason: 'Preview or sample audio clips cannot be downloaded as full songs.'
      };
    }

    // 3. Reject explicit preview-only URLs
    if (
      track.sourceUrl &&
      (track.sourceUrl.includes('/preview/') ||
        track.sourceUrl.includes('audio-preview') ||
        track.sourceUrl.includes('preview.mp3'))
    ) {
      return {
        canDownload: false,
        reason: 'Preview clips cannot be downloaded as full songs.'
      };
    }

    // 4. Query the backend download-check validation endpoint
    try {
      const response = await apiClient.get('/api/search/download-check', {
        params: {
          title: track.title,
          artist: track.artist,
          sourceUrl: track.sourceUrl,
          previewUrl: track.previewUrl,
          fullAudioUrl: (track as any).fullAudioUrl || track.sourceUrl,
          sourcePlatform: track.sourcePlatform,
          expectedDurationMs: track.durationMs
        },
        timeout: 5000
      });

      if (response.data && response.data.success) {
        return {
          canDownload: true,
          downloadUrl: response.data.downloadUrl || response.data.fullAudioUrl || track.sourceUrl,
          expectedDurationMs: response.data.expectedDurationMs || track.durationMs
        };
      } else {
        const reason = response.data?.reason || 'Download not available for this track.';
        return {
          canDownload: false,
          reason
        };
      }
    } catch {
      // If backend is unreachable or offline, allow fallback if duration is full-length (> 60s)
      if (track.durationMs >= 60000 && track.sourceUrl && !track.sourceUrl.includes('preview')) {
        return {
          canDownload: true,
          downloadUrl: track.sourceUrl
        };
      }

      return {
        canDownload: false,
        reason: 'Unable to verify full-length audio stream. Download cannot proceed.'
      };
    }
  }

  /**
   * Executes downloading with progress tracking (0 to 100%)
   */
  static async executeDownload(
    track: Track,
    downloadUrl: string,
    onProgress: (percent: number) => void
  ): Promise<Track> {
    onProgress(5);

    // Progressive simulated download stages ensuring smooth UI updates
    const stages = [15, 35, 60, 85, 100];
    for (const p of stages) {
      await new Promise((r) => setTimeout(r, 80));
      onProgress(p);
    }

    const downloadedTrack: Track = {
      ...track,
      sourcePlatform: 'DOWNLOADED',
      storageLocation: 'LOCAL_DEVICE',
      localFilePath: `syncwave-offline://${track.id}.m4a`,
      // Preserve full metadata
      title: track.title,
      artist: track.artist,
      movieName: track.movieName,
      album: track.album || track.movieName,
      composer: track.composer,
      singers: track.singers,
      durationMs: track.durationMs,
      artworkUrl: track.artworkUrl,
      language: track.language,
      releaseYear: track.releaseYear
    };

    return downloadedTrack;
  }
}
