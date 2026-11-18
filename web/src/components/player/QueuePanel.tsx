import React, { useState } from 'react';
import {
  X,
  ListMusic,
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Music,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { ArtworkImage } from '../common/ArtworkImage';
import { SongContextMenu } from '../common/SongContextMenu';

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ isOpen, onClose }) => {
  const {
    queue,
    queueIndex,
    currentSong,
    isShuffle,
    repeatMode,
    getNextSong,
    playTrackAt,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    isGeneratingQueue
  } = usePlayerStore();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const nextSong = getNextSong();

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderQueue(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  };

  const handleConfirmClear = () => {
    clearQueue();
    setShowClearConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Main Drawer Container */}
      <div className="w-full max-w-md h-full bg-surface border-l border-hairline flex flex-col shadow-2xl relative select-none animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-hairline bg-surface-elevated">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary tracking-wide">
                Playback Queue
              </h2>
              <p className="text-[11px] font-mono text-text-muted">
                {queue.length} track{queue.length === 1 ? '' : 's'}
                {repeatMode === 'ONE' && ' • Repeat One'}
                {isShuffle && ' • Shuffled'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 1 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-2.5 py-1 text-xs text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded border border-hairline transition-colors flex items-center gap-1"
                title="Clear upcoming songs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              title="Close queue"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Clear Queue Confirmation Alert Modal */}
        {showClearConfirm && (
          <div className="p-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Clear all upcoming songs from queue?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-2 py-0.5 bg-red-500 text-white font-medium rounded hover:bg-red-600 transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-2 py-0.5 bg-surface-elevated text-text-muted hover:text-text-primary rounded border border-hairline transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator while recommendations are generating */}
        {isGeneratingQueue && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-control bg-accent/10 border border-accent/25 flex items-center justify-between gap-2 text-xs text-accent animate-pulse">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="font-medium">Generating upcoming recommendations...</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">Fetching 15–20 songs</span>
          </div>
        )}

        {/* Scrollable Queue Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
          {/* Section: Currently Playing */}
          {currentSong && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono tracking-wider uppercase text-accent font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  Now Playing
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-card bg-accent/10 border border-accent/30 shadow-subtle">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-[8px] bg-surface-elevated overflow-hidden shrink-0 flex items-center justify-center border border-accent/20">
                    <ArtworkImage
                      src={currentSong.artworkUrl}
                      alt={currentSong.title}
                      iconClassName="w-5 h-5 text-accent"
                    />
                  </div>
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {currentSong.title}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">
                      {currentSong.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-text-muted tabular-nums">
                  {formatTime((currentSong.durationMs || 0) / 1000)}
                </div>
              </div>
            </div>
          )}

          {/* Section: Up Next Songs */}
          <div>
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[10px] font-mono tracking-wider uppercase text-text-muted font-semibold">
                Upcoming Tracks
              </span>
              <span className="text-[11px] font-mono text-text-muted">
                Drag or use arrows to reorder
              </span>
            </div>

            {queue.length > 0 ? (
              <div className="space-y-1.5">
                {queue.map((song, index) => {
                  const isCurrent = currentSong?.id === song.id && index === queueIndex;
                  const isNext = nextSong?.id === song.id && !isCurrent;

                  return (
                    <div
                      key={`${song.id}_${index}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`group flex items-center justify-between p-2 rounded-control border transition-all ${
                        isCurrent
                          ? 'bg-accent/10 border-accent/30'
                          : isNext
                          ? 'bg-surface-elevated border-hairlineLight hover:border-accent/40'
                          : 'bg-surface hover:bg-surface-elevated border-hairline'
                      } ${draggedIndex === index ? 'opacity-40 border-dashed border-accent' : ''}`}
                    >
                      {/* Left: Drag Grip Handle & Move Controls */}
                      <div className="flex items-center gap-1 shrink-0 text-text-muted">
                        <span title="Drag to reorder" className="cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4 hover:text-text-primary" />
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => reorderQueue(index, index - 1)}
                            className="p-0.5 hover:text-text-primary disabled:opacity-20 disabled:hover:text-text-muted transition-colors"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={index === queue.length - 1}
                            onClick={() => reorderQueue(index, index + 1)}
                            className="p-0.5 hover:text-text-primary disabled:opacity-20 disabled:hover:text-text-muted transition-colors"
                            title="Move down"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Middle: Artwork, Title, Artist, Badges */}
                      <div
                        onClick={() => playTrackAt(index)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 px-2 cursor-pointer"
                        title={`Click to play: ${song.title}`}
                      >
                        <div className="w-8 h-8 rounded-[6px] bg-surface-elevated overflow-hidden shrink-0 flex items-center justify-center border border-hairline relative">
                          <ArtworkImage
                            src={song.artworkUrl}
                            alt={song.title}
                            iconClassName="w-3.5 h-3.5 text-text-muted"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-3 h-3 text-white fill-current ml-0.5" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={`text-xs font-medium truncate ${
                                isCurrent
                                  ? 'text-accent'
                                  : isNext
                                  ? 'text-text-primary'
                                  : 'text-text-secondary group-hover:text-text-primary'
                              }`}
                            >
                              {song.title}
                            </p>
                            {isNext && (
                              <span className="shrink-0 px-1 py-0.2 rounded text-[9px] font-mono bg-accent/20 border border-accent/40 text-accent uppercase">
                                Up Next
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted truncate mt-0.5">
                            {song.artist}
                          </p>
                        </div>
                      </div>

                      {/* Right: Duration & Remove action & Context Menu */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-mono text-text-muted tabular-nums mr-1">
                          {formatTime((song.durationMs || 0) / 1000)}
                        </span>
                        <SongContextMenu
                          song={song}
                          context="queue"
                          queueIndex={index}
                          buttonSize="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isGeneratingQueue ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-card bg-surface/50 border border-hairline/60">
                <Loader2 className="w-8 h-8 text-accent animate-spin mb-2" />
                <p className="text-xs text-text-primary font-medium">Generating upcoming queue...</p>
                <p className="text-[11px] text-text-muted mt-1">
                  Discovering matching songs by artist, director, and genre.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-card bg-surface/50 border border-hairline">
                <Music className="w-8 h-8 text-text-muted/60 mb-2" />
                <p className="text-xs text-text-muted">No upcoming songs in the queue</p>
                <p className="text-[11px] text-text-muted/70 mt-1">
                  Add songs from Search, Playlists, or Favorites to listen next.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
