import React, { useState } from 'react';
import {
  Play,
  Plus,
  Check,
  Download,
  Loader2
} from 'lucide-react';
import { UnifiedTrack, Song } from '../../types';
import { useLibraryStore } from '../../store/useLibraryStore';
import { localDb } from '../../db/indexedDb';
import { ArtworkImage } from '../common/ArtworkImage';
import { SongContextMenu } from '../common/SongContextMenu';

interface SongVersionCardProps {
  track: UnifiedTrack;
  onPlay: (track: UnifiedTrack) => void;
  onAddToSchedule?: (track: UnifiedTrack) => void;
}

export const SongVersionCard: React.FC<SongVersionCardProps> = ({
  track,
  onPlay,
  onAddToSchedule
}) => {
  const [isAdded, setIsAdded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const { loadLibrary, downloadOnlineTrackToLocal, isDownloaded } = useLibraryStore();

  const isLocallySaved = isDownloaded(track.id) || isAdded;
  const isFullDownloadAvailable =
    track.downloadAvailability === 'FULL_SONG' || Boolean(track.fullAudioUrl);
  const restrictionLabel =
    track.downloadAvailability === 'PREVIEW_ONLY'
      ? '30s Preview Only'
      : track.downloadAvailability === 'STREAM_ONLY'
        ? 'Stream Only'
        : null;

  const handleSaveToLibrary = async () => {
    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || track.movieName || 'Single',
      durationMs: track.durationMs,
      artworkUrl: track.artworkUrl,
      uri: track.fullAudioUrl || track.previewUrl,
      externalUrl: track.sourceUrl,
      videoId: track.videoId || (track.id.startsWith('yt_') ? track.id.replace('yt_', '') : undefined),
      source: track.sourcePlatform === 'YOUTUBE' ? 'YOUTUBE' : track.sourcePlatform === 'OPEN_AUDIO' ? 'LOCAL' : 'SPOTIFY',
      fileFormat: track.fileFormat,
      createdAt: new Date().toISOString()
    };

    await localDb.saveSong(song);
    await loadLibrary();
    setIsAdded(true);
  };

  const handleDownloadToLocal = async () => {
    if (isDownloading || isLocallySaved) return;
    setDownloadNotice(null);
    if (!isFullDownloadAvailable && track.downloadReason) {
      setDownloadNotice(track.downloadReason);
      return;
    }
    setIsDownloading(true);
    try {
      await downloadOnlineTrackToLocal(track);
      setIsAdded(true);
    } catch (err: any) {
      setDownloadNotice(err?.message || 'Full-song download is not available for this source.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getVersionLabel = (type: string) => {
    switch (type) {
      case 'OFFICIAL_VIDEO': return 'Video';
      case 'LIVE': return 'Live';
      case 'COVER': return 'Cover';
      case 'REMIX': return 'Remix';
      case 'INSTRUMENTAL': return 'Instrumental';
      case 'BGM': return 'Score';
      default: return 'Original';
    }
  };

  return (
    <div className="p-3 rounded-card bg-surface border border-hairline hover:bg-surface-elevated group transition-colors duration-150 flex flex-col justify-between">
      <div>
        {/* Artwork Container (Nested Radius: 14 - 12 = 8px -> rounded-control) */}
        <div className="w-full aspect-square rounded-control bg-surface-elevated mb-2.5 overflow-hidden relative">
          <ArtworkImage
            src={track.artworkUrl}
            alt={track.title}
            className="w-full h-full object-cover"
          />

          {/* Version Badge */}
          <div className="absolute top-1.5 left-1.5 flex items-center pointer-events-none">
            <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono text-text-muted bg-surface-deepest/90 border border-hairline">
              {getVersionLabel(track.versionType)}
            </span>
          </div>

          {/* Overlay Play Button */}
          <button
            onClick={() => onPlay(track)}
            className="absolute right-2 bottom-2 w-8 h-8 rounded-control bg-primary text-primary-dark shadow-subtle flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            title="Play track"
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </button>
        </div>

        <h4 className="text-sm font-medium text-text-primary truncate" title={track.title}>
          {track.title}
        </h4>
        <p className="text-xs text-text-muted truncate mt-0.5">{track.artist}</p>
        <p className="text-[11px] font-mono text-text-muted mt-1 truncate tabular-nums">
          {formatDuration(track.durationMs)} &bull; {track.album || track.movieName || 'Single'}
        </p>
      </div>

      {/* Action Row */}
      <div className="pt-2 mt-2 border-t border-hairline flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          {/* Download Full Song to Local */}
          <button
            onClick={handleDownloadToLocal}
            disabled={isDownloading || isLocallySaved}
            className={`flex items-center gap-1 py-1 px-2 rounded-control transition-colors ${
              isLocallySaved
                ? 'text-accent bg-accent/10 border border-accent/20'
                : !isFullDownloadAvailable && restrictionLabel
                  ? 'text-text-muted/70 hover:text-amber-400 hover:bg-surface-elevated'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
            }`}
            title={
              isLocallySaved
                ? 'Verified full song in local library'
                : track.downloadReason || 'Download full-length song for offline playback'
            }
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                <span className="text-[11px]">Downloading</span>
              </>
            ) : isLocallySaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-accent" />
                <span className="text-[11px] font-medium">Local</span>
              </>
            ) : !isFullDownloadAvailable && restrictionLabel ? (
              <>
                <Download className="w-3.5 h-3.5 opacity-60" />
                <span className="text-[11px]">{restrictionLabel}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span className="text-[11px]">Download{track.fileFormat ? ` (${track.fileFormat})` : ''}</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {onAddToSchedule && (
            <button
              onClick={() => onAddToSchedule(track)}
              className="p-1 rounded-control text-text-muted hover:text-text-primary transition-colors"
              title="Add to Scheduler routine"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          <SongContextMenu song={track} buttonSize="sm" />
        </div>
      </div>
      {downloadNotice && (
        <p className="mt-1.5 text-[10px] text-amber-400 leading-snug">
          {downloadNotice}
        </p>
      )}
    </div>
  );
};
