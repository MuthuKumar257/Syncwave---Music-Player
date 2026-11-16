import React from 'react';
import { Play, Disc3 } from 'lucide-react';
import { DailyMixItem } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { ArtworkImage } from '../common/ArtworkImage';

interface DailyMixCardProps {
  mix: DailyMixItem;
}

export const DailyMixCard: React.FC<DailyMixCardProps> = ({ mix }) => {
  const { playSong } = usePlayerStore();

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mix.tracks || mix.tracks.length === 0) return;
    const first = mix.tracks[0];
    playSong({
      id: first.id,
      title: first.title,
      artist: first.artist,
      album: mix.title,
      durationMs: first.durationMs,
      artworkUrl: first.artworkUrl || mix.coverUrl,
      source: first.sourcePlatform,
      externalUrl: first.sourceUrl,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <div
      onClick={handlePlay}
      className="group relative flex-shrink-0 w-56 md:w-60 rounded-card bg-surface border border-hairline p-3 hover:bg-surface-elevated transition-colors duration-150 cursor-pointer select-none"
    >
      <div className="relative aspect-video rounded-control overflow-hidden mb-2.5 bg-surface-elevated">
        <ArtworkImage
          src={mix.coverUrl}
          alt={mix.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <button
          onClick={handlePlay}
          className="absolute right-2 bottom-2 w-8 h-8 rounded-control bg-primary text-primary-dark shadow-subtle flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          title="Play mix"
        >
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        </button>

        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-surface-deepest/90 text-[10px] font-mono text-text-muted border border-hairline">
          <Disc3 className="w-2.5 h-2.5 text-accent" />
          <span>Mix</span>
        </div>
      </div>

      <h4 className="text-sm font-medium text-text-primary truncate">
        {mix.title}
      </h4>
      <p className="text-xs text-text-muted line-clamp-2 mt-0.5 leading-relaxed">
        {mix.subtitle}
      </p>
    </div>
  );
};
