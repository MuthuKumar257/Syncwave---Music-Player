import React, { useState } from 'react';
import {
  X,
  Plus,
  Check,
  FolderPlus,
  ListMusic,
  Music2
} from 'lucide-react';
import { Song } from '../../types';
import { useLibraryStore } from '../../store/useLibraryStore';
import { ArtworkImage } from './ArtworkImage';

interface SaveToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
}

export const SaveToPlaylistModal: React.FC<SaveToPlaylistModalProps> = ({
  isOpen,
  onClose,
  song
}) => {
  const { playlists, createPlaylist, addSongToPlaylist, removeSongFromPlaylist } = useLibraryStore();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;

    try {
      const created = await createPlaylist(trimmed);
      await addSongToPlaylist(created.id, song.id);
      setNewPlaylistName('');
      setIsCreating(false);
      showToast(`Created & added to "${trimmed}"`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to create playlist');
    }
  };

  const handleTogglePlaylist = async (playlistId: string, playlistName: string, isAlreadyIn: boolean) => {
    try {
      if (isAlreadyIn) {
        await removeSongFromPlaylist(playlistId, song.id);
        showToast(`Removed from "${playlistName}"`);
      } else {
        await addSongToPlaylist(playlistId, song.id);
        showToast(`Added to "${playlistName}"`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Error updating playlist');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#18181b] border border-hairline rounded-card p-4 sm:p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 text-left select-none relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">Save to Playlist</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-control text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Song Preview */}
        <div className="flex items-center gap-3 p-2.5 rounded-control bg-surface border border-hairline/60">
          <div className="w-10 h-10 rounded-control overflow-hidden bg-surface-elevated shrink-0">
            <ArtworkImage src={song.artworkUrl} alt={song.title} iconClassName="w-4 h-4 text-text-muted" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-text-primary truncate">{song.title}</p>
            <p className="text-[11px] text-text-muted truncate">{song.artist}</p>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="px-3 py-1.5 rounded-control bg-accent/15 border border-accent/30 text-xs font-medium text-accent animate-in fade-in duration-150 flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* New Playlist Toggle / Input */}
        {isCreating ? (
          <form onSubmit={handleCreatePlaylist} className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-control bg-surface border border-hairline text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim()}
              className="px-3 py-1.5 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110 disabled:opacity-50 transition"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setIsCreating(false); setNewPlaylistName(''); }}
              className="px-2.5 py-1.5 rounded-control bg-surface border border-hairline text-xs text-text-muted hover:text-text-primary transition"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-control bg-surface border border-hairline text-xs font-medium text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <Plus className="w-4 h-4 text-accent" />
            <span>New Playlist</span>
          </button>
        )}

        {/* Playlists List */}
        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 divide-y divide-hairline/40">
          {playlists.length > 0 ? (
            playlists.map((playlist) => {
              const isSongInPlaylist = playlist.songIds.includes(song.id);
              return (
                <div
                  key={playlist.id}
                  onClick={() => handleTogglePlaylist(playlist.id, playlist.name, isSongInPlaylist)}
                  className="flex items-center justify-between p-2.5 rounded-control hover:bg-white/5 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ListMusic className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{playlist.name}</p>
                      <p className="text-[10px] text-text-muted">{playlist.songCount || playlist.songIds.length} tracks</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                      isSongInPlaylist
                        ? 'bg-accent border-accent text-black'
                        : 'border-hairline group-hover:border-hairlineLight'
                    }`}
                  >
                    {isSongInPlaylist && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-text-muted space-y-1">
              <Music2 className="w-6 h-6 text-text-muted mx-auto opacity-40" />
              <p>No playlists created yet.</p>
              <p className="text-[11px] text-text-secondary">Click &ldquo;New Playlist&rdquo; above to make one.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-hairline/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover border border-hairline text-xs font-medium text-text-primary transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
