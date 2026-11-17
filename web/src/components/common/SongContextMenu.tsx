import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MoreVertical,
  Play,
  ListPlus,
  ListEnd,
  Heart,
  Download,
  FolderPlus,
  Info,
  Share2,
  Trash2,
  Check,
  Loader2,
  AlertTriangle,
  Ban
} from 'lucide-react';
import { Song, UnifiedTrack } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { ArtworkImage } from './ArtworkImage';
import { SaveToPlaylistModal } from './SaveToPlaylistModal';

export type SongMenuContext = 'default' | 'queue' | 'playlist' | 'liked' | 'download' | 'library';

export interface SongContextMenuProps {
  song: Song | UnifiedTrack;
  context?: SongMenuContext;
  queueIndex?: number;
  playlistId?: string;
  onRemove?: () => void;
  className?: string;
  buttonSize?: 'sm' | 'md';
}

const normalizeToSong = (item: Song | UnifiedTrack): Song => {
  if ('durationMs' in item && 'source' in item && typeof item.source === 'string') {
    return item as Song;
  }
  const track = item as UnifiedTrack;
  return {
    id: track.id,
    title: track.title,
    artist: track.singers && track.singers.length > 0 ? track.singers.join(', ') : track.artist,
    album: track.movieName || track.album || 'Single',
    durationMs: track.durationMs || 240000,
    artworkUrl: track.artworkUrl,
    uri: track.fullAudioUrl || track.previewUrl,
    source: track.sourcePlatform,
    externalUrl: track.sourceUrl,
    videoId: track.videoId || (track.id.startsWith('yt_') ? track.id.replace('yt_', '') : undefined),
    composer: track.composer,
    language: track.language,
    genre: track.genre,
    mood: track.mood,
    createdAt: new Date().toISOString()
  };
};

export const SongContextMenu: React.FC<SongContextMenuProps> = ({
  song: rawSong,
  context = 'default',
  queueIndex,
  playlistId,
  onRemove,
  className = '',
  buttonSize = 'md'
}) => {
  const song = normalizeToSong(rawSong);
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    playSong,
    playNextInQueue,
    addToQueue,
    removeFromQueue
  } = usePlayerStore();

  const {
    favorites,
    toggleFavorite,
    isDownloaded,
    downloadOnlineTrackToLocal,
    removeSongFromPlaylist,
    deleteSong
  } = useLibraryStore();

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const isLiked = favorites.includes(song.id);
  const isSongDownloaded = isDownloaded(song.id) || song.source === 'DOWNLOADED' || song.originType === 'DOWNLOADED';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Compute menu placement without overflowing viewport
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 360;

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 10) {
      top = rect.top - menuHeight - 6;
    }
    if (top < 10) top = 10;

    setMenuPosition({ top, left });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Actions
  const handlePlayNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    playSong(song);
    showToast(`Playing "${song.title}"`);
  };

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    playNextInQueue(song);
    showToast(`Playing "${song.title}" next`);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    addToQueue(song);
    showToast(`Added to queue`);
  };

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    await toggleFavorite(song.id);
    showToast(isLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs');
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (isSongDownloaded) {
      await deleteSong(song.id);
      showToast(`Removed "${song.title}" from downloads`);
      return;
    }
    setIsDownloading(true);
    try {
      await downloadOnlineTrackToLocal(song);
      showToast(`Downloaded "${song.title}"`);
    } catch (err: any) {
      showToast(err?.message || 'Download not available for this track');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenSaveToPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setIsPlaylistModalOpen(true);
  };

  const handleSongDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    navigate(`/song/${encodeURIComponent(song.id)}`);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    const cleanId = encodeURIComponent(song.id);
    const domain = window.location.origin.includes('localhost') ? 'https://syncwave.app' : window.location.origin;
    const shareUrl = `${domain}/song/${cleanId}`;
    const shareMessage = `Listen to ${song.title} by ${song.artist} on SyncWave.\n\nListen here: ${shareUrl}`;
    const shareData = {
      title: song.title,
      text: shareMessage,
      url: shareUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareMessage);
      showToast('Share link copied to clipboard!');
    } catch {
      showToast('Could not copy link');
    }
  };

  const handleNotInterested = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: song.id,
          targetType: 'SONG',
          feedbackType: 'NOT_INTERESTED'
        })
      });
      showToast("We'll recommend fewer songs like this");
    } catch {
      showToast('Feedback recorded');
    }
  };

  const handleRemoveOrDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);

    if (context === 'queue' && typeof queueIndex === 'number') {
      removeFromQueue(queueIndex);
      onRemove?.();
      showToast('Removed from queue');
      return;
    }

    if (context === 'playlist' && playlistId) {
      await removeSongFromPlaylist(playlistId, song.id);
      onRemove?.();
      showToast('Removed from playlist');
      return;
    }

    if (context === 'liked') {
      await toggleFavorite(song.id);
      onRemove?.();
      showToast('Removed from Liked Songs');
      return;
    }

    // If downloaded or in library: ask confirmation before permanent removal
    setShowDeleteConfirm(true);
  };

  const confirmPermanentDelete = async () => {
    await deleteSong(song.id);
    setShowDeleteConfirm(false);
    onRemove?.();
    showToast(isSongDownloaded ? 'Downloaded file deleted' : 'Removed from library');
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`rounded-control flex items-center justify-center transition-colors text-text-muted hover:text-text-primary hover:bg-white/10 ${
          buttonSize === 'sm' ? 'w-7 h-7 p-1' : 'w-8 h-8 p-1.5'
        } ${className}`}
        aria-label={`More options for ${song.title}`}
        title="More options"
      >
        <MoreVertical className={buttonSize === 'sm' ? 'w-4 h-4' : 'w-4 h-4'} />
      </button>

      {/* Floating Dark Charcoal Context Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          style={{ top: menuPosition.top, left: menuPosition.left }}
          className="fixed z-50 w-56 bg-[#18181b] border border-hairline/80 rounded-card shadow-2xl p-1.5 space-y-1 text-left select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Menu Song Header */}
          <div className="flex items-center gap-2.5 p-2 rounded-control bg-white/[0.04] border border-white/5 mb-1">
            <div className="w-8 h-8 rounded-control overflow-hidden bg-surface-elevated shrink-0">
              <ArtworkImage src={song.artworkUrl} alt={song.title} iconClassName="w-3.5 h-3.5 text-text-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-text-primary truncate">{song.title}</p>
              <p className="text-[10px] text-text-muted truncate">{song.artist}</p>
            </div>
          </div>

          {/* Action List */}
          <button
            type="button"
            onClick={handlePlayNow}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Play className="w-4 h-4 text-accent shrink-0" />
            <span className="truncate">Play Now</span>
          </button>

          <button
            type="button"
            onClick={handlePlayNext}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
          >
            <ListPlus className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
            <span className="truncate">Play Next</span>
          </button>

          <button
            type="button"
            onClick={handleAddToQueue}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
          >
            <ListEnd className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
            <span className="truncate">Add to Queue</span>
          </button>

          <button
            type="button"
            onClick={handleToggleLike}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Heart
              className={`w-4 h-4 shrink-0 ${
                isLiked ? 'text-accent fill-accent' : 'text-white/80 group-hover:text-white'
              }`}
            />
            <span className="truncate">{isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
            ) : isSongDownloaded ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Download className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
            )}
            <span className="truncate">
              {isDownloading
                ? 'Downloading...'
                : isSongDownloaded
                  ? 'Remove from Downloads'
                  : 'Download Song'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenSaveToPlaylist}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
          >
            <FolderPlus className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
            <span className="truncate">Save to Playlist</span>
          </button>

          <button
            type="button"
            onClick={handleSongDetails}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Info className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
            <span className="truncate">Song Details</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Share2 className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
            <span className="truncate">Share</span>
          </button>

          <button
            type="button"
            onClick={handleNotInterested}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Ban className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
            <span className="truncate">Not Interested</span>
          </button>

          {/* Context-Aware Remove/Delete option */}
          {(context !== 'default' || isSongDownloaded) && (
            <div className="pt-1 mt-1 border-t border-hairline/60">
              <button
                type="button"
                onClick={handleRemoveOrDelete}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs text-semantic-error hover:bg-semantic-error/15 transition-colors group"
              >
                <Trash2 className="w-4 h-4 text-semantic-error shrink-0" />
                <span className="truncate">
                  {context === 'queue'
                    ? 'Remove from Queue'
                    : context === 'playlist'
                      ? 'Remove from Playlist'
                      : context === 'liked'
                        ? 'Remove from Liked Songs'
                        : isSongDownloaded || context === 'download'
                          ? 'Delete Downloaded File'
                          : 'Remove from Library'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Save to Playlist Modal */}
      <SaveToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        song={song}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-[#18181b] border border-hairline rounded-card p-5 space-y-3 shadow-2xl animate-in zoom-in-95 duration-150 text-left select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-semantic-error">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-text-primary">
                {isSongDownloaded ? 'Delete Downloaded Audio' : 'Remove from Library'}
              </h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {isSongDownloaded ? (
                <>
                  Are you sure you want to permanently delete <span className="text-text-primary font-medium">&ldquo;{song.title}&rdquo;</span> from your device storage?
                </>
              ) : (
                <>
                  Are you sure you want to remove <span className="text-text-primary font-medium">&ldquo;{song.title}&rdquo;</span> from your library?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-control bg-surface border border-hairline text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPermanentDelete}
                className="px-3.5 py-1.5 rounded-control bg-semantic-error text-white text-xs font-medium hover:bg-semantic-error/90 transition-colors shadow-subtle"
              >
                {isSongDownloaded ? 'Delete File' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ephemeral Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 px-3.5 py-2 rounded-control bg-surface border border-accent/40 shadow-xl text-xs font-medium text-text-primary flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-4 h-4 text-accent shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};
