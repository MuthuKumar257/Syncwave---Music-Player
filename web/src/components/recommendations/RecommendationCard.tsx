import React, { useState } from 'react';
import { Play, Heart, EyeOff } from 'lucide-react';
import { UnifiedTrack } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { ArtworkImage } from '../common/ArtworkImage';
import { SongContextMenu } from '../common/SongContextMenu';

interface RecommendationCardProps {
  track: UnifiedTrack;
  onPlayPreview?: (track: UnifiedTrack) => void;
  fullWidth?: boolean;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({ track, onPlayPreview, fullWidth = false }) => {
  const { playSong } = usePlayerStore();
  const { sendFeedback, likedTrackIds, hiddenTrackIds } = useRecommendationStore();

  const [isHidden, setIsHidden] = useState(hiddenTrackIds.has(track.id));
  const isLiked = likedTrackIds.has(track.id);

  if (isHidden) return null;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlayPreview) {
      onPlayPreview(track);
    } else {
      playSong({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.movieName || track.album || 'Soundtrack',
        durationMs: track.durationMs,
        artworkUrl: track.artworkUrl,
        source: track.sourcePlatform,
        externalUrl: track.sourceUrl,
        videoId: track.videoId || (track.id.startsWith('yt_') ? track.id.replace('yt_', '') : undefined),
        createdAt: new Date().toISOString()
      });
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    sendFeedback(track.id, 'LIKE', 'SONG');
  };

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHidden(true);
    sendFeedback(track.id, 'HIDE', 'SONG');
  };

  return (
    <div
      onClick={handlePlay}
      className={`group relative ${
        fullWidth ? 'w-full' : 'flex-shrink-0 w-44 md:w-48'
      } bg-surface border border-hairline rounded-card p-3 hover:bg-surface-elevated transition-colors duration-150 cursor-pointer select-none`}
    >
      {/* Artwork Container (Nested Radius: 14 - 12 = 8px -> rounded-control) */}
      <div className="relative aspect-square rounded-control overflow-hidden bg-surface-elevated mb-2.5">
        <ArtworkImage
          src={track.artworkUrl}
          alt={track.title}
          className="w-full h-full object-cover"
        />

        {/* Play Overlay Button */}
        <button
          onClick={handlePlay}
          className="absolute right-2 bottom-2 w-8 h-8 rounded-control bg-primary text-primary-dark shadow-subtle flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          title="Play"
        >
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        </button>

        {/* Language Badge */}
        {track.language && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-[4px] bg-surface-deepest/90 text-[10px] font-mono text-text-muted border border-hairline">
            {track.language}
          </span>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-0.5">
        <h4 className="text-sm font-medium text-text-primary truncate" title={track.title}>
          {track.title}
        </h4>
        <p className="text-xs text-text-secondary truncate" title={track.singers?.length ? track.singers.join(', ') : track.artist}>
          {track.singers && track.singers.length > 0 ? track.singers.join(', ') : track.artist}
        </p>
        <p className="text-[11px] text-text-muted truncate" title={track.movieName || track.album || track.artist}>
          {track.movieName || track.album || track.artist}
        </p>
        {track.recommendationReason && (
          <div className="pt-0.5">
            <span
              className="inline-block px-1.5 py-0.5 rounded-[4px] bg-accent/15 text-[9px] font-medium text-accent border border-accent/25 truncate max-w-full"
              title={track.recommendationReason}
            >
              {track.recommendationReason}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-hairline text-text-muted text-xs">
        <span className="font-mono text-[10px] truncate max-w-[90px] opacity-80">
          {track.composer || track.artist}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleLike}
            className={`p-1 rounded-control hover:text-text-primary transition-colors ${
              isLiked ? 'text-accent' : 'hover:bg-surface'
            }`}
            title="Like track"
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-accent' : ''}`} />
          </button>
          <button
            onClick={handleHide}
            className="p-1 rounded-control hover:text-text-primary hover:bg-surface transition-colors"
            title="Hide from recommendations"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
          <SongContextMenu song={track} buttonSize="sm" />
        </div>
      </div>
    </div>
  );
};
