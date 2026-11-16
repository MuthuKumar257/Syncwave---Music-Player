import React, { useState } from 'react';
import {
  Film,
  Play,
  Disc3,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Volume2
} from 'lucide-react';
import { MovieSoundtrack, UnifiedTrack, Song } from '../../types';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { localDb } from '../../db/indexedDb';
import { ArtworkImage } from '../common/ArtworkImage';
import { SongContextMenu } from '../common/SongContextMenu';

interface MovieSoundtrackCardProps {
  soundtrack: MovieSoundtrack;
  onPlayTrack: (track: UnifiedTrack) => void;
  onAddToSchedule?: (track: UnifiedTrack) => void;
}

export const MovieSoundtrackCard: React.FC<MovieSoundtrackCardProps> = ({
  soundtrack,
  onPlayTrack,
  onAddToSchedule
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());

  const { loadLibrary } = useLibraryStore();
  const { setQueue } = usePlayerStore();

  const handlePlayAll = () => {
    const playableSongs: Song[] = soundtrack.tracks
      .filter((t) => t.isPlayableDirectly && (t.previewUrl || t.sourceUrl))
      .map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: `${soundtrack.movieName} Soundtrack`,
        durationMs: t.durationMs,
        artworkUrl: t.artworkUrl || soundtrack.artworkUrl,
        uri: t.previewUrl,
        externalUrl: t.sourceUrl,
        videoId: t.videoId || (t.id.startsWith('yt_') ? t.id.replace('yt_', '') : undefined),
        source: t.sourcePlatform === 'YOUTUBE' ? 'YOUTUBE' : 'SPOTIFY',
        createdAt: new Date().toISOString()
      }));

    if (playableSongs.length > 0) {
      setQueue(playableSongs, 0);
    } else if (soundtrack.tracks.length > 0) {
      onPlayTrack(soundtrack.tracks[0]);
    }
  };

  const handleSaveToLibrary = async (track: UnifiedTrack) => {
    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: `${soundtrack.movieName} (Soundtrack)`,
      durationMs: track.durationMs,
      artworkUrl: track.artworkUrl || soundtrack.artworkUrl,
      uri: track.previewUrl,
      externalUrl: track.sourceUrl,
      source: track.sourcePlatform === 'YOUTUBE' ? 'YOUTUBE' : 'SPOTIFY',
      createdAt: new Date().toISOString()
    };

    await localDb.saveSong(song);
    await loadLibrary();
    setAddedTrackIds((prev) => new Set(prev).add(track.id));
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-surface rounded-card border border-hairline overflow-hidden shadow-subtle">
      {/* Movie Banner Header */}
      <div className="p-4 md:p-5 border-b border-hairline flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-3.5 items-center min-w-0">
          {/* Movie Poster (80px, 8px radius) */}
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-control bg-surface-elevated overflow-hidden shrink-0 border border-hairline relative flex items-center justify-center">
            <ArtworkImage
              src={soundtrack.artworkUrl}
              alt={soundtrack.movieName}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1 left-1 bg-surface-deepest/90 px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono text-text-muted border border-hairline">
              OST
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-accent">
                {soundtrack.language}
              </span>
              {soundtrack.releaseYear && (
                <>
                  <span className="text-text-muted text-xs">&bull;</span>
                  <span className="text-[11px] font-mono text-text-muted tabular-nums">
                    {soundtrack.releaseYear}
                  </span>
                </>
              )}
            </div>

            <h3 className="text-base md:text-lg font-medium text-text-primary tracking-tight truncate">
              {soundtrack.movieName}
            </h3>

            <p className="text-xs text-text-muted flex items-center gap-1.5 truncate">
              <span>{soundtrack.composer}</span>
              <span>&bull;</span>
              <span className="tabular-nums">{soundtrack.totalTracks} tracks</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-primary text-primary-dark text-xs font-medium hover:bg-white transition-colors duration-150"
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            <span>Play all</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover text-text-muted hover:text-text-primary border border-hairline transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Track List */}
      {isExpanded && (
        <div className="divide-y divide-hairline">
          {soundtrack.tracks.map((track, idx) => {
            const isAdded = addedTrackIds.has(track.id);

            return (
              <div
                key={track.id}
                className="p-2.5 px-4 flex items-center justify-between hover:bg-surface-elevated transition-colors group text-xs"
              >
                {/* Index & Title */}
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer pr-3"
                  onClick={() => onPlayTrack(track)}
                >
                  <span className="w-5 text-right font-mono text-[11px] text-text-muted tabular-nums">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      {track.artist}
                    </p>
                  </div>
                </div>

                {/* Right Metadata & Action */}
                <div className="flex items-center gap-3 shrink-0">
                  {track.durationMs && (
                    <span className="font-mono text-[11px] text-text-muted tabular-nums">
                      {formatDuration(track.durationMs)}
                    </span>
                  )}

                  <button
                    onClick={() => handleSaveToLibrary(track)}
                    className="p-1 rounded-control text-text-muted hover:text-text-primary transition-colors"
                    title={isAdded ? 'Added to library' : 'Save to library'}
                  >
                    {isAdded ? (
                      <Check className="w-3.5 h-3.5 text-accent" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <SongContextMenu song={track} buttonSize="sm" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
