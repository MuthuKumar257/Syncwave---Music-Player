import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Music,
  Heart,
  Trash2,
  FolderPlus,
  Download,
  WifiOff,
  Check,
  Loader2,
  X,
  ExternalLink,
  Sparkles,
  FolderOpen,
  RefreshCw,
  Star,
  AlertCircle,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Song, UnifiedTrack } from '../types';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { SongContextMenu } from '../components/common/SongContextMenu';

export const LibraryView: React.FC = () => {
  const navigate = useNavigate();
  const {
    songs,
    playlists,
    favorites,
    musicFolders,
    downloadTasks,
    downloadError,
    defaultFolderPromptDismissed,
    sourceFilter,
    isSyncing,
    lastSyncSummary,
    addLocalFiles,
    selectMusicFolder,
    importFallbackFolderFiles,
    reauthorizeMusicFolder,
    dismissDefaultFolderPrompt,
    setSourceFilter,
    syncLibrary,
    deleteSong,
    createPlaylist,
    deletePlaylist,
    toggleFavorite,
    searchQuery,
    setSearchQuery,
    downloadOnlineTrackToLocal,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    clearDownloadError,
    saveSongFileToDevice,
    isDownloaded
  } = useLibraryStore();

  const { playSong, setQueue, currentSong, isPlaying } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<'songs' | 'playlists' | 'favorites'>('songs');
  const [isDragging, setIsDragging] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistToDelete, setPlaylistToDelete] = useState<{ id: string; name: string } | null>(null);
  const [songToDelete, setSongToDelete] = useState<{ id: string; title: string; isDownloaded: boolean } | null>(null);

  // Online Download Modal State
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<UnifiedTrack[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [folderPickDefault, setFolderPickDefault] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const filteredSongs = songs.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.folderName || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'favorites' && !favorites.includes(s.id)) return false;
    if (activeTab === 'songs' && sourceFilter !== 'ALL') {
      const origin = s.originType || (s.source === 'DOWNLOADED' ? 'DOWNLOADED' : s.folderId ? 'FOLDER' : 'DEVICE');
      return origin === sourceFilter;
    }
    return true;
  });

  const handleSelectFolder = async (makeDefault = false) => {
    const result = await selectMusicFolder({ makeDefault });
    if (result === 'FALLBACK_REQUIRED') {
      setFolderPickDefault(makeDefault);
      folderInputRef.current?.click();
    }
  };

  const handleFolderFallbackChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await importFallbackFolderFiles(e.target.files, folderPickDefault);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await addLocalFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await addLocalFiles(e.target.files);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsCreatingPlaylist(false);
  };

  const handleOnlineSearch = async (searchTerm?: string) => {
    const q = searchTerm !== undefined ? searchTerm : onlineQuery;
    if (!q.trim()) return;
    setIsSearchingOnline(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setOnlineResults(data.songs || []);
      }
    } catch (err) {
      console.error('Online search error:', err);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleDownloadTrack = async (track: UnifiedTrack) => {
    if (downloadingTrackId || isDownloaded(track.id)) return;
    setDownloadingTrackId(track.id);
    try {
      await downloadOnlineTrackToLocal(track);
    } catch (err) {
      // Rejection/error message is surfaced in downloadError state
      console.warn('Download notice:', err instanceof Error ? err.message : err);
    } finally {
      setDownloadingTrackId(null);
    }
  };

  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const QUICK_ONLINE_SEARCHES = ['love songs', 'En Kannu Kulla', 'melody songs', 'sad songs', 'party songs'];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 select-none">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a,.opus,.wma,.alac"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '' } as any)}
        accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a,.opus,.wma,.alac"
        className="hidden"
        onChange={handleFolderFallbackChange}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium text-text-primary tracking-tight">
            Library
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Unified offline library combining downloaded Songs, local folders &amp; device files
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => handleSelectFolder(musicFolders.length === 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent text-black hover:brightness-110 text-xs font-semibold shadow-subtle transition"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Select Music Folder</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-primary hover:bg-white text-primary-dark text-xs font-medium shadow-subtle transition-colors duration-150"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add audio files</span>
          </button>
          <button
            onClick={() => setIsDownloadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover text-accent border border-hairline text-xs font-medium transition-colors duration-150"
            title="Search online songs and download to your offline Songs folder"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Download songs</span>
          </button>
          <button
            onClick={() => syncLibrary({ force: true })}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-hairline text-xs font-medium transition-colors duration-150"
            title="Scan folders & Songs directory for new, moved, or removed tracks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-accent' : 'text-text-muted'}`} />
            <span>{isSyncing ? 'Syncing' : 'Sync'}</span>
          </button>
          <button
            onClick={() => setIsCreatingPlaylist(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-hairline text-xs font-medium transition-colors duration-150"
          >
            <FolderPlus className="w-3.5 h-3.5 text-text-muted" />
            <span>New playlist</span>
          </button>
        </div>
      </div>

      {/* First-Launch Default Music Folder Selection Prompt */}
      {musicFolders.length === 0 && !defaultFolderPromptDismissed && (
        <div className="p-4 rounded-card bg-accent/10 border border-accent/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <FolderOpen className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                Choose your default local music folder
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                SyncWave scans subfolders for MP3, WAV, FLAC, AAC &amp; M4A tracks automatically on every launch and plays offline.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleSelectFolder(true)}
              className="px-3.5 py-1.5 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110 transition"
            >
              Select Default Folder
            </button>
            <button
              onClick={() => dismissDefaultFolderPrompt()}
              className="px-2.5 py-1.5 rounded-control text-xs text-text-muted hover:text-text-primary"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Configured Local Music Folders Strip */}
      {(musicFolders.length > 0 || lastSyncSummary) && (
        <div className="p-3.5 rounded-card bg-surface border border-hairline space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-text-secondary">
              Linked Music Folders ({musicFolders.length})
            </span>
            {lastSyncSummary && (
              <span className="text-[11px] font-mono text-emerald-400">{lastSyncSummary}</span>
            )}
          </div>
          {musicFolders.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {musicFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-control bg-surface-elevated border border-hairline text-xs"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-text-primary font-medium">{folder.name}</span>
                  {folder.isDefault && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-accent">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      Default
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-text-muted">
                    {folder.trackCount ?? 0}
                  </span>
                  {folder.permissionState === 'prompt' && (
                    <button
                      type="button"
                      onClick={() => reauthorizeMusicFolder(folder.id)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-medium hover:bg-accent/25"
                    >
                      <AlertCircle className="w-2.5 h-2.5" />
                      Grant Access
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full-Song Download Alert Banner (never shown inside playable songs) */}
      {downloadError && (
        <div className="p-3 rounded-card bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2 text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{downloadError}</span>
          </div>
          <button
            onClick={clearDownloadError}
            className="text-text-muted hover:text-text-primary p-0.5"
            aria-label="Dismiss download error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Incomplete / Resumable Downloads Queue (excluded from playable library until verified complete) */}
      {downloadTasks.length > 0 && (
        <div className="p-4 rounded-card bg-surface border border-hairline space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-primary">
              Full-Song Downloads Queue ({downloadTasks.length})
            </p>
            <span className="text-[11px] text-text-muted">
              Verified &amp; added to library only after full completion
            </span>
          </div>
          <div className="space-y-2">
            {downloadTasks.map((task) => {
              const pct =
                task.expectedBytes && task.expectedBytes > 0
                  ? Math.min(100, Math.round((task.bytesReceived / task.expectedBytes) * 100))
                  : 0;
              return (
                <div
                  key={task.id}
                  className="p-2.5 rounded-control bg-surface-elevated border border-hairline flex flex-col gap-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{task.title}</p>
                      <p className="text-[11px] text-text-muted truncate">
                        {task.artist} &bull; {task.fileFormat} &bull;{' '}
                        {task.status === 'verifying'
                          ? 'Verifying full audio duration & integrity...'
                          : task.status === 'downloading'
                            ? `Downloading (${pct}%)${task.expectedBytes ? ` • ${Math.round(task.bytesReceived / 1024)} / ${Math.round(task.expectedBytes / 1024)} KB` : ''}`
                            : task.status === 'paused'
                              ? `Paused at ${Math.round(task.bytesReceived / 1024)} KB`
                              : task.error || 'Interrupted — tap Resume to continue'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.status === 'downloading' ? (
                        <button
                          onClick={() => void pauseDownload(task.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-control bg-surface border border-hairline text-[11px] text-text-primary hover:bg-surface-hover"
                          title="Pause download"
                        >
                          <Pause className="w-3 h-3" />
                          Pause
                        </button>
                      ) : task.status === 'paused' || task.status === 'failed' ? (
                        <button
                          onClick={() => void resumeDownload(task.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-control bg-accent text-black text-[11px] font-semibold hover:brightness-110"
                          title="Resume or retry full download"
                        >
                          {task.status === 'failed' ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          {task.status === 'failed' ? 'Resume / Retry' : 'Resume'}
                        </button>
                      ) : null}
                      <button
                        onClick={() => void cancelDownload(task.id)}
                        className="p-1 rounded-control text-text-muted hover:text-semantic-error"
                        title="Discard incomplete download"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {task.expectedBytes && task.expectedBytes > 0 && (
                    <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-150"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Local Music & Download Online Songs Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Select Local Music Folder or Drop Files */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => handleSelectFolder(musicFolders.length === 0)}
          className={`border border-dashed rounded-card p-5 text-center cursor-pointer transition-colors relative overflow-hidden group ${
            isDragging
              ? 'border-accent bg-surface-elevated'
              : 'border-hairline hover:border-hairlineLight hover:bg-surface-elevated/40 bg-surface'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-surface-elevated border border-hairline flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <FolderOpen className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-text-primary tracking-tight">
              Select Local Music Folder
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
              <WifiOff className="w-3 h-3" />
              <span>Plays completely offline &bull; Auto-scans subfolders</span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Supports MP3, WAV, FLAC, AAC &amp; M4A. Click to pick a folder or drop files directly.
            </p>
          </div>
        </div>

        {/* Card 2: Download Option for Online Song to Local Songs Folder */}
        <div
          onClick={() => setIsDownloadModalOpen(true)}
          className="border border-hairline rounded-card p-5 text-center cursor-pointer transition-colors relative overflow-hidden group bg-surface hover:bg-surface-elevated/50 hover:border-accent/40"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-text-primary tracking-tight">
              Download Songs to Offline Folder
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-medium">
              <Download className="w-3 h-3" />
              <span>Saved automatically in Songs folder</span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Downloaded tracks appear immediately in your unified library and work offline.
            </p>
          </div>
        </div>
      </div>

      {/* Search, Tabs, and Unified Source Filter Pills */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('songs')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors ${
                activeTab === 'songs'
                  ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                  : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
              }`}
            >
              All songs ({songs.length})
            </button>
            <button
              onClick={() => setActiveTab('playlists')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors ${
                activeTab === 'playlists'
                  ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                  : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
              }`}
            >
              Playlists ({playlists.length})
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors ${
                activeTab === 'favorites'
                  ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                  : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
              }`}
            >
              Favorites ({favorites.length})
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter library"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-control pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-hairlineLight"
            />
          </div>
        </div>

        {activeTab === 'songs' && (
          <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
            {([
              { id: 'ALL', label: 'All Sources' },
              { id: 'DOWNLOADED', label: 'Downloaded (Songs)' },
              { id: 'FOLDER', label: 'Local Folders' },
              { id: 'DEVICE', label: 'Device Library' }
            ] as const).map((pill) => (
              <button
                key={pill.id}
                onClick={() => setSourceFilter(pill.id)}
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  sourceFilter === pill.id
                    ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                    : 'bg-surface border-hairline text-text-muted hover:text-text-primary'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Playlist Input Modal */}
      {isCreatingPlaylist && (
        <form onSubmit={handleCreatePlaylist} className="flex gap-2 max-w-sm">
          <input
            type="text"
            autoFocus
            required
            placeholder="Playlist name"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="flex-1 bg-surface-elevated border border-hairline rounded-control px-3 py-1.5 text-xs text-text-primary focus:outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-control bg-primary text-primary-dark text-xs font-medium"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingPlaylist(false)}
            className="px-2.5 py-1.5 rounded-control text-xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Song List Content */}
      {activeTab !== 'playlists' ? (
        <div className="bg-surface border border-hairline rounded-card overflow-hidden divide-y divide-hairline">
          {filteredSongs.map((song, idx) => {
            const isCurrentPlaying = currentSong?.id === song.id && isPlaying;
            const isFav = favorites.includes(song.id);

            return (
              <div
                key={song.id}
                onClick={() => setQueue(filteredSongs, idx)}
                className={`flex items-center justify-between p-2.5 px-4 hover:bg-surface-elevated cursor-pointer transition-colors group ${
                  isCurrentPlaying ? 'bg-surface-elevated' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <span className="w-5 text-right font-mono text-[11px] text-text-muted tabular-nums">
                    {idx + 1}
                  </span>

                  <div className="w-9 h-9 rounded-control bg-surface-elevated overflow-hidden shrink-0 flex items-center justify-center border border-hairline">
                    <ArtworkImage
                      src={song.artworkUrl}
                      alt={song.title}
                      iconClassName="w-3.5 h-3.5 text-text-muted"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p
                        className={`text-xs font-medium truncate ${
                          isCurrentPlaying ? 'text-accent' : 'text-text-primary'
                        }`}
                      >
                        {song.title}
                      </p>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                          song.originType === 'DOWNLOADED' || song.source === 'DOWNLOADED'
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : song.originType === 'FOLDER' || song.folderId
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-surface-elevated border-hairline text-text-secondary'
                        }`}
                      >
                        {song.originType === 'DOWNLOADED' || song.source === 'DOWNLOADED'
                          ? 'Downloaded · Songs'
                          : song.originType === 'FOLDER' || song.folderId
                            ? `Folder · ${song.folderName || 'Local'}`
                            : 'Device Library'}
                      </span>
                      {song.fileFormat && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-elevated border border-hairline text-text-muted">
                          {song.fileFormat}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      {song.artist} &bull; {song.album}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] text-text-muted tabular-nums mr-1">
                    {formatDuration(song.durationMs || 0)}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(song.id);
                    }}
                    className="p-1 rounded-control text-text-muted hover:text-text-primary transition-colors"
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        isFav ? 'text-accent fill-accent' : ''
                      }`}
                    />
                  </button>

                  <SongContextMenu
                    song={song}
                    context={
                      song.originType === 'DOWNLOADED' || song.source === 'DOWNLOADED' || isDownloaded(song.id)
                        ? 'download'
                        : activeTab === 'favorites'
                          ? 'liked'
                          : 'library'
                    }
                    buttonSize="sm"
                  />
                </div>
              </div>
            );
          })}

          {filteredSongs.length === 0 && (
            <p className="p-8 text-center text-xs text-text-muted">
              No matching audio files. Click &ldquo;Select Music Folder&rdquo;, &ldquo;Add audio files&rdquo;, or &ldquo;Download songs&rdquo; above.
            </p>
          )}
        </div>
      ) : (
        /* Playlists Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="p-3.5 rounded-card bg-surface border border-hairline hover:bg-surface-elevated transition-colors cursor-pointer group relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-control bg-surface-elevated border border-hairline flex items-center justify-center text-text-muted">
                    <Music className="w-4 h-4" />
                  </div>
                  {/* Delete Playlist Option */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaylistToDelete({ id: pl.id, name: pl.name });
                    }}
                    className="p-1.5 rounded-control text-text-muted hover:text-semantic-error hover:bg-semantic-error/10 transition-colors opacity-70 group-hover:opacity-100"
                    title={`Delete ${pl.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h4 className="text-sm font-medium text-text-primary truncate">{pl.name}</h4>
                <p className="text-[11px] font-mono text-text-muted mt-0.5 tabular-nums">
                  {pl.songCount} tracks
                </p>
              </div>
            </div>
          ))}

          {playlists.length === 0 && (
            <div className="col-span-full p-8 text-center bg-surface border border-hairline rounded-card">
              <p className="text-xs text-text-muted">No custom playlists created yet.</p>
              <button
                onClick={() => setIsCreatingPlaylist(true)}
                className="mt-3 px-3 py-1.5 rounded-control bg-primary text-primary-dark text-xs font-medium"
              >
                + Create Playlist
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Playlist Confirmation Modal */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-hairline rounded-card p-5 max-w-sm w-full space-y-4 shadow-elevated">
            <div className="flex items-center gap-2 text-semantic-error">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-text-primary">Delete Playlist</h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to delete <span className="text-text-primary font-medium">"{playlistToDelete.name}"</span>? The audio files will remain in your library.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPlaylistToDelete(null)}
                className="px-3 py-1.5 rounded-control bg-surface border border-hairline text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deletePlaylist(playlistToDelete.id);
                  setPlaylistToDelete(null);
                }}
                className="px-3 py-1.5 rounded-control bg-semantic-error text-white text-xs font-medium hover:bg-semantic-error/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Song Confirmation Modal */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-hairline rounded-card p-5 max-w-sm w-full space-y-4 shadow-elevated">
            <div className="flex items-center gap-2 text-semantic-error">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-text-primary">
                {songToDelete.isDownloaded ? 'Delete Downloaded Audio' : 'Remove from Library'}
              </h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {songToDelete.isDownloaded ? (
                <>
                  Are you sure you want to permanently delete <span className="text-text-primary font-medium">&ldquo;{songToDelete.title}&rdquo;</span> from your offline device storage?
                </>
              ) : (
                <>
                  Are you sure you want to remove <span className="text-text-primary font-medium">&ldquo;{songToDelete.title}&rdquo;</span> from your saved library? The audio file will remain untouched.
                </>
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSongToDelete(null)}
                className="px-3 py-1.5 rounded-control bg-surface border border-hairline text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteSong(songToDelete.id);
                  setSongToDelete(null);
                }}
                className="px-3.5 py-1.5 rounded-control bg-semantic-error text-white text-xs font-medium hover:bg-semantic-error/90 transition-colors shadow-subtle"
              >
                {songToDelete.isDownloaded ? 'Delete File' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Online Songs to Local Modal */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-hairline rounded-card p-6 max-w-xl w-full space-y-4 shadow-elevated max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-hairline">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-accent" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Download Online Song to Local
                </h3>
              </div>
              <button
                onClick={() => setIsDownloadModalOpen(false)}
                className="p-1 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Search songs by theme (e.g. <span className="text-accent font-medium">love songs</span>), movie, or artist. Downloaded songs are stored in IndexedDB and <span className="text-emerald-400 font-medium">play without internet</span>.
            </p>

            {/* Quick Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ONLINE_SEARCHES.map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    setOnlineQuery(chip);
                    handleOnlineSearch(chip);
                  }}
                  className="px-2.5 py-1 rounded-full text-[11px] font-mono border border-hairline bg-surface hover:bg-surface-elevated hover:border-hairlineLight text-text-secondary hover:text-text-primary transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Online Search Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleOnlineSearch();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search online songs (e.g. love songs, En Kannu Kulla)..."
                  value={onlineQuery}
                  onChange={(e) => setOnlineQuery(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-control pl-8 pr-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingOnline}
                className="px-4 py-2 rounded-control bg-primary text-primary-dark text-xs font-medium hover:bg-white transition-colors flex items-center gap-1.5"
              >
                {isSearchingOnline ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Search</span>
                )}
              </button>
            </form>

            {/* Search Results List */}
            {downloadError && (
              <div className="p-2.5 rounded-control bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-2 text-xs text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{downloadError}</span>
                </div>
                <button onClick={clearDownloadError} className="text-text-muted hover:text-text-primary">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-hairline min-h-[180px] bg-surface rounded-card border border-hairline p-1">
              {isSearchingOnline ? (
                <div className="flex flex-col items-center justify-center p-8 gap-2 text-text-muted">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  <p className="text-xs">Searching online catalog...</p>
                </div>
              ) : onlineResults.length > 0 ? (
                onlineResults.map((track) => {
                  const saved = isDownloaded(track.id);
                  const isCurDownloading = downloadingTrackId === track.id;
                  const canDownloadFull =
                    track.downloadAvailability === 'FULL_SONG' || Boolean(track.fullAudioUrl);
                  const statusLabel =
                    track.downloadAvailability === 'PREVIEW_ONLY'
                      ? '30s Preview Only'
                      : track.downloadAvailability === 'STREAM_ONLY'
                        ? 'Stream Only'
                        : null;

                  return (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-2.5 px-3 hover:bg-surface-elevated rounded-control transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                        <div className="w-9 h-9 rounded bg-surface-elevated overflow-hidden shrink-0 flex items-center justify-center border border-hairline">
                          <ArtworkImage
                            src={track.artworkUrl}
                            alt={track.title}
                            iconClassName="w-4 h-4 text-text-muted"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-text-muted truncate">
                            {track.artist} &bull; {track.album || track.movieName || 'Single'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-text-muted tabular-nums hidden sm:inline">
                          {formatDuration(track.durationMs || 0)}
                        </span>
                        <button
                          onClick={() => handleDownloadTrack(track)}
                          disabled={saved || isCurDownloading}
                          title={track.downloadReason || 'Download verified full-length song'}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-control text-xs font-medium border transition-colors ${
                            saved
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default'
                              : !canDownloadFull && statusLabel
                                ? 'bg-surface border-hairline text-text-muted hover:border-amber-500/40 hover:text-amber-300'
                                : 'bg-surface hover:bg-surface-elevated border-hairline text-text-primary hover:border-accent hover:text-accent'
                          }`}
                        >
                          {isCurDownloading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                              <span className="text-[11px]">Verifying...</span>
                            </>
                          ) : saved ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[11px]">Local</span>
                            </>
                          ) : !canDownloadFull && statusLabel ? (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[11px]">{statusLabel}</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5 text-accent" />
                              <span className="text-[11px]">Download{track.fileFormat ? ` ${track.fileFormat}` : ''}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted gap-1">
                  <Download className="w-6 h-6 text-text-muted opacity-40 mb-1" />
                  <p className="text-xs font-medium text-text-secondary">Search and download online songs</p>
                  <p className="text-[11px] text-text-muted">
                    Try searching "love songs" (En Kannu Kulla), "melody songs", or your favorite artist.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setIsDownloadModalOpen(false);
                  navigate('/discover');
                }}
                className="text-xs text-accent hover:underline flex items-center gap-1"
              >
                <span>Go to full Discover & Search</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={() => setIsDownloadModalOpen(false)}
                className="px-3 py-1.5 rounded-control bg-surface border border-hairline text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
