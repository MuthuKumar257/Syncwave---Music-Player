import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play,
  Pause,
  Share2,
  Download,
  Smartphone,
  ExternalLink,
  Music,
  Check,
  Disc,
  Radio,
  ArrowLeft,
  MoreVertical,
  ListPlus,
  ListEnd,
  Heart,
  FolderPlus,
  Loader2
} from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuthStore } from '../store/useAuthStore';
import { UnifiedTrack, Song } from '../types';
import { SaveToPlaylistModal } from '../components/common/SaveToPlaylistModal';

const toSong = (t: UnifiedTrack): Song => ({
  id: t.id,
  title: t.title,
  artist: t.singers && t.singers.length > 0 ? t.singers.join(', ') : t.artist,
  album: t.movieName || t.album || 'Single',
  durationMs: t.durationMs || 240000,
  artworkUrl: t.artworkUrl,
  uri: t.fullAudioUrl || t.previewUrl,
  externalUrl: t.sourceUrl,
  videoId: t.videoId || (t.id.startsWith('yt_') ? t.id.replace('yt_', '') : undefined),
  source: t.sourcePlatform === 'YOUTUBE' ? 'YOUTUBE' : 'SPOTIFY',
  composer: t.composer,
  language: t.language,
  genre: t.genre,
  mood: t.mood,
  versionType: t.versionType,
  createdAt: new Date().toISOString()
});

export const SongPreviewView: React.FC = () => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();

  const [track, setTrack] = useState<UnifiedTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const { currentSong, isPlaying, playSong, togglePlay, playNextInQueue, addToQueue } = usePlayerStore();
  const { favorites, toggleFavorite, isDownloaded, downloadOnlineTrackToLocal, deleteSong } = useLibraryStore();
  const { isAuthenticated } = useAuthStore();

  const isThisSongPlaying = currentSong?.id === track?.id && isPlaying;
  const isFavourite = track ? favorites.includes(track.id) : false;
  const isSongDownloaded = track ? (isDownloaded(track.id) || (track.sourcePlatform as string) === 'DOWNLOADED') : false;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchTrack = useCallback(async () => {
    if (!songId) {
      setError('Invalid song link');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/songs/${encodeURIComponent(songId)}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setTrack(data.data);
      } else {
        setError(data.message || 'Song not found or unavailable');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load song preview');
    } finally {
      setIsLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    void fetchTrack();
  }, [fetchTrack]);

  // Handle pending guest actions after login redirect
  useEffect(() => {
    if (!isAuthenticated || !track) return;
    const pendingRaw = sessionStorage.getItem('syncwave_pending_action');
    if (!pendingRaw) return;
    try {
      const pending = JSON.parse(pendingRaw);
      if (pending && pending.songId === track.id) {
        sessionStorage.removeItem('syncwave_pending_action');
        if (pending.type === 'favourite') {
          void toggleFavorite(track.id).then((nowFav) => {
            showToast(nowFav ? `Added "${track.title}" to Liked Songs` : `Removed from Liked Songs`);
          });
        } else if (pending.type === 'playlist') {
          setIsPlaylistModalOpen(true);
        } else if (pending.type === 'play_next') {
          playNextInQueue(toSong(track));
          showToast(`Playing "${track.title}" next`);
        } else if (pending.type === 'add_queue') {
          addToQueue(toSong(track));
          showToast(`Added "${track.title}" to queue`);
        }
      }
    } catch {}
  }, [isAuthenticated, track, toggleFavorite, playNextInQueue, addToQueue]);

  // Close options menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const cleanId = songId ? encodeURIComponent(songId) : '';
  const appDeepLinkUri = `syncwave://song/${cleanId}`;
  const canonicalShareUrl = `https://syncwave.app/song/${cleanId}`;
  const shareMessage = track
    ? `Listen to ${track.title} by ${track.artist} on SyncWave.\n\nListen here: ${canonicalShareUrl}`
    : `Listen on SyncWave: ${canonicalShareUrl}`;

  // 1. Play Now / Play on Web
  const handlePlayOnWeb = () => {
    if (!track) return;
    if (currentSong?.id === track.id) {
      togglePlay();
    } else {
      playSong(toSong(track));
    }
  };

  const handlePlayNow = () => {
    if (!track) return;
    setIsMenuOpen(false);
    playSong(toSong(track));
    showToast(`Playing "${track.title}"`);
  };

  // 2. Play Next
  const handlePlayNext = () => {
    if (!track) return;
    setIsMenuOpen(false);
    playNextInQueue(toSong(track));
    showToast(`Playing "${track.title}" next`);
  };

  // 3. Add to Queue
  const handleAddToQueue = () => {
    if (!track) return;
    setIsMenuOpen(false);
    addToQueue(toSong(track));
    showToast(`Added "${track.title}" to queue`);
  };

  // 4. Add to Favourites
  const handleToggleFavourite = async () => {
    if (!track) return;
    setIsMenuOpen(false);
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'syncwave_pending_action',
        JSON.stringify({
          type: 'favourite',
          songId: track.id,
          timestamp: Date.now()
        })
      );
      sessionStorage.setItem('syncwave_redirect_target', `/song/${cleanId}`);
      showToast('Please sign in to save to favourites');
      navigate(`/login?redirect=${encodeURIComponent(`/song/${cleanId}`)}`);
      return;
    }
    const nowFav = await toggleFavorite(track.id);
    showToast(nowFav ? `Added "${track.title}" to Liked Songs` : `Removed "${track.title}" from Liked Songs`);
  };

  // 5. Add to Playlist
  const handleAddToPlaylist = () => {
    if (!track) return;
    setIsMenuOpen(false);
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'syncwave_pending_action',
        JSON.stringify({
          type: 'playlist',
          songId: track.id,
          timestamp: Date.now()
        })
      );
      sessionStorage.setItem('syncwave_redirect_target', `/song/${cleanId}`);
      showToast('Please sign in to manage playlists');
      navigate(`/login?redirect=${encodeURIComponent(`/song/${cleanId}`)}`);
      return;
    }
    setIsPlaylistModalOpen(true);
  };

  // 6. Download Song (only when permitted)
  const handleDownload = async () => {
    if (!track) return;
    setIsMenuOpen(false);
    const song = toSong(track);
    if (isSongDownloaded) {
      await deleteSong(song.id);
      showToast(`Removed "${track.title}" from downloads`);
      return;
    }
    setIsDownloading(true);
    try {
      await downloadOnlineTrackToLocal(song);
      showToast(`Downloaded "${track.title}"`);
    } catch (err: any) {
      showToast(err?.message || 'Download not permitted for this track');
    } finally {
      setIsDownloading(false);
    }
  };

  // 7. Share Song
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: track ? `${track.title} - SyncWave` : 'SyncWave Music',
          text: shareMessage,
          url: canonicalShareUrl
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareMessage);
      showToast('Share link copied to clipboard!');
    } catch {
      showToast('Could not copy link');
    }
  };

  const handleShareSong = async () => {
    setIsMenuOpen(false);
    await handleShare();
  };

  const handleOpenInApp = () => {
    // Attempt custom URI scheme
    window.location.href = appDeepLinkUri;
    // Fallback: If not handled after 2 seconds, redirect to Play Store / App Store
    setTimeout(() => {
      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isAndroid) {
        window.location.href = 'https://play.google.com/store/apps/details?id=com.syncwave.music';
      } else if (isIOS) {
        window.location.href = 'https://apps.apple.com/app/syncwave-music/id123456789';
      }
    }, 2000);
  };

  const formatDuration = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background text-text">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-semibold text-text-secondary animate-pulse">
          Loading shared track...
        </h2>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background text-text text-center">
        <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mb-4 border border-hairline">
          <Disc className="w-8 h-8 text-text-secondary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Song Unavailable</h1>
        <p className="text-sm text-text-secondary max-w-md mb-6">
          {error || 'This song link is invalid or may have been removed from the platform.'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-accent text-black font-semibold rounded-full hover:brightness-110 transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Browse Trending Music
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background text-text pb-28">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-accent text-black px-4 py-2 rounded-full font-medium text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" /> {toastMessage}
        </div>
      )}

      {/* Smart App Banner */}
      <div className="bg-gradient-to-r from-surface-elevated via-surface-hover to-surface-elevated border-b border-hairline px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-md flex-shrink-0">
            <Radio className="w-5 h-5 text-black" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text-primary leading-tight">Listen on SyncWave App</p>
            <p className="text-[11px] text-text-secondary truncate">
              Better background playback, lock-screen controls, and offline downloads
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenInApp}
          className="flex-shrink-0 px-3.5 py-1.5 bg-accent text-black text-xs font-bold rounded-full hover:brightness-110 transition-transform active:scale-95 flex items-center gap-1.5"
        >
          <Smartphone className="w-3.5 h-3.5" /> Open in App
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Navigation Bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <span className="text-[11px] font-bold text-accent uppercase tracking-wider bg-accent/10 px-2.5 py-1 rounded-full border border-accent/20">
            Shared Music Link
          </span>
        </div>

        {/* Hero Card */}
        <div className="bg-surface rounded-2xl border border-hairline p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start shadow-xl">
          {/* Artwork */}
          <div className="relative group w-56 h-56 md:w-64 md:h-64 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 bg-surface-elevated border border-hairline">
            <img
              src={
                track.artworkUrl ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800'
              }
              alt={track.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Play overlay */}
            <button
              onClick={handlePlayOnWeb}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              aria-label="Play on Web"
            >
              <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-black shadow-lg">
                {isThisSongPlaying ? (
                  <Pause className="w-6 h-6 fill-black" />
                ) : (
                  <Play className="w-6 h-6 fill-black translate-x-0.5" />
                )}
              </div>
            </button>
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col text-center md:text-left min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold text-text-primary tracking-tight mb-1.5">
              {track.title}
            </h1>
            <p className="text-base md:text-lg font-medium text-accent mb-1">
              {track.composer || track.artist}
            </p>
            {track.movieName || track.album ? (
              <p className="text-xs md:text-sm text-text-secondary mb-3">
                {track.movieName ? `Soundtrack • ${track.movieName}` : `Album • ${track.album}`}
              </p>
            ) : null}

            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-5">
              {track.language ? (
                <span className="px-2.5 py-0.5 rounded-control text-xs font-medium bg-surface-elevated border border-hairline text-text-secondary font-mono">
                  {track.language}
                </span>
              ) : null}
              <span className="px-2.5 py-0.5 rounded-control text-xs font-medium bg-surface-elevated border border-hairline text-text-secondary font-mono tabular-nums">
                {formatDuration(track.durationMs)}
              </span>
              <span className="px-2.5 py-0.5 rounded-control text-xs font-medium bg-surface-elevated border border-hairline text-text-secondary">
                Full Fidelity
              </span>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-5 relative">
              <button
                onClick={handlePlayOnWeb}
                className="px-5 py-2.5 bg-accent text-black font-semibold rounded-control hover:brightness-110 transition shadow-subtle flex items-center gap-2 tap-press"
              >
                {isThisSongPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-black" /> Pause on Web
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black" /> Play on Web
                  </>
                )}
              </button>

              <button
                onClick={handleOpenInApp}
                className="px-4 py-2.5 bg-surface-elevated text-text-primary border border-hairline font-medium rounded-control hover:bg-surface-hover transition flex items-center gap-2 tap-press"
              >
                <Smartphone className="w-4 h-4 text-accent" /> Open in App
              </button>

              {/* Options Menu Beside Play on Web and Open in App */}
              <div className="relative inline-block" ref={menuContainerRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className={`p-2.5 rounded-control border border-hairline transition flex items-center justify-center tap-press ${
                    isMenuOpen
                      ? 'bg-accent text-black border-accent'
                      : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                  aria-label="Song options"
                  title="Song options"
                  aria-haspopup="true"
                  aria-expanded={isMenuOpen}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 top-full mt-2 z-50 w-64 max-w-[calc(100vw-32px)] bg-[#18181b] border border-hairline/80 rounded-2xl shadow-2xl p-1.5 space-y-1 text-left select-none animate-in fade-in zoom-in-95 duration-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Song Preview Header in Menu */}
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.04] border border-white/5 mb-1">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-surface-elevated shrink-0 border border-hairline">
                          <img
                            src={
                              track.artworkUrl ||
                              'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800'
                            }
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-text-primary truncate">{track.title}</p>
                          <p className="text-[10px] text-text-secondary truncate">{track.artist}</p>
                        </div>
                      </div>

                      {/* 1. Play Now */}
                      <button
                        type="button"
                        onClick={handlePlayNow}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
                      >
                        <Play className="w-4 h-4 text-accent shrink-0 fill-accent" />
                        <span className="truncate">Play Now</span>
                      </button>

                      {/* 2. Play Next */}
                      <button
                        type="button"
                        onClick={handlePlayNext}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
                      >
                        <ListPlus className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
                        <span className="truncate">Play Next</span>
                      </button>

                      {/* 3. Add to Queue */}
                      <button
                        type="button"
                        onClick={handleAddToQueue}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
                      >
                        <ListEnd className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
                        <span className="truncate">Add to Queue</span>
                      </button>

                      {/* 4. Add to Favourites */}
                      <button
                        type="button"
                        onClick={handleToggleFavourite}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
                      >
                        <Heart
                          className={`w-4 h-4 shrink-0 ${
                            isFavourite ? 'text-accent fill-accent' : 'text-white/80 group-hover:text-white'
                          }`}
                        />
                        <span className="truncate">
                          {isFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
                        </span>
                      </button>

                      {/* 5. Add to Playlist */}
                      <button
                        type="button"
                        onClick={handleAddToPlaylist}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
                      >
                        <FolderPlus className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
                        <span className="truncate">Add to Playlist</span>
                      </button>

                      {/* 6. Download Song (only when permitted) */}
                      <button
                        type="button"
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:text-white hover:bg-white/10 transition-colors group disabled:opacity-50"
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

                      {/* 7. Share Song */}
                      <button
                        type="button"
                        onClick={handleShareSong}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:text-white hover:bg-white/10 transition-colors group"
                      >
                        <Share2 className="w-4 h-4 text-white/80 group-hover:text-white shrink-0" />
                        <span className="truncate">Share Song</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Quick Share Button */}
              <button
                onClick={handleShare}
                className="p-3 bg-surface-elevated text-text-secondary hover:text-text-primary border border-hairline rounded-full hover:bg-surface-hover transition-colors"
                title="Share this song"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* App Store / Play Store Install Badges */}
            <div className="pt-4 border-t border-hairline flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3">
              <span className="text-xs text-text-muted font-medium">Get the app for best audio:</span>
              <div className="flex items-center gap-2">
                <a
                  href="https://play.google.com/store/apps/details?id=com.syncwave.music"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-black/60 border border-hairline rounded-lg text-xs font-semibold text-text-secondary hover:text-white hover:border-hairlineLight transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-accent" /> Google Play
                </a>
                <a
                  href="https://apps.apple.com/app/syncwave-music/id123456789"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-black/60 border border-hairline rounded-lg text-xs font-semibold text-text-secondary hover:text-white hover:border-hairlineLight transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-accent" /> App Store
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save to Playlist Modal */}
      {track && (
        <SaveToPlaylistModal
          isOpen={isPlaylistModalOpen}
          onClose={() => setIsPlaylistModalOpen(false)}
          song={toSong(track)}
        />
      )}
    </div>
  );
};
