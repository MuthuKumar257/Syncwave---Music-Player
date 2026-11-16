import React, { useEffect, useState, useCallback } from 'react';
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
  ArrowLeft
} from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { UnifiedTrack, Song } from '../types';

export const SongPreviewView: React.FC = () => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();

  const [track, setTrack] = useState<UnifiedTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const { currentSong, isPlaying, playSong, togglePlay } = usePlayerStore();
  const isThisSongPlaying = currentSong?.id === track?.id && isPlaying;

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

  const handlePlayOnWeb = () => {
    if (!track) return;
    if (currentSong?.id === track.id) {
      togglePlay();
    } else {
      const songToPlay: Song = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album || track.movieName || 'Single',
        durationMs: track.durationMs,
        artworkUrl: track.artworkUrl,
        externalUrl: track.sourceUrl,
        videoId: track.videoId || (track.id.startsWith('yt_') ? track.id.replace('yt_', '') : undefined),
        source: track.sourcePlatform === 'YOUTUBE' ? 'YOUTUBE' : 'SPOTIFY',
        composer: track.composer,
        language: track.language,
        genre: track.genre,
        mood: track.mood,
        versionType: track.versionType,
        createdAt: new Date().toISOString()
      };
      playSong(songToPlay);
    }
  };

  const cleanId = songId ? encodeURIComponent(songId) : '';
  const appDeepLinkUri = `syncwave://song/${cleanId}`;
  const canonicalShareUrl = `https://syncwave.app/song/${cleanId}`;
  const shareMessage = track
    ? `Listen to ${track.title} by ${track.artist} on SyncWave.\n\nListen here: ${canonicalShareUrl}`
    : `Listen on SyncWave: ${canonicalShareUrl}`;

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
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(shareMessage);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
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
        <h2 className="text-base font-semibold text-textSecondary animate-pulse">
          Loading shared track...
        </h2>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background text-text text-center">
        <div className="w-16 h-16 rounded-full bg-surfaceRaised flex items-center justify-center mb-4 border border-hairline">
          <Disc className="w-8 h-8 text-textSecondary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Song Unavailable</h1>
        <p className="text-sm text-textSecondary max-w-md mb-6">
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
      {copiedToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-accent text-black px-4 py-2 rounded-full font-medium text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" /> Share link copied to clipboard!
        </div>
      )}

      {/* Smart App Banner */}
      <div className="bg-gradient-to-r from-surfaceRaised via-surfaceHover to-surfaceRaised border-b border-hairline px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-md flex-shrink-0">
            <Radio className="w-5 h-5 text-black" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-textPrimary leading-tight">Listen on SyncWave App</p>
            <p className="text-[11px] text-textSecondary truncate">
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
            className="inline-flex items-center gap-2 text-xs font-medium text-textSecondary hover:text-textPrimary transition-colors"
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
          <div className="relative group w-56 h-56 md:w-64 md:h-64 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 bg-surfaceRaised border border-hairline">
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
                {isThisSongPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black translate-x-0.5" />}
              </div>
            </button>
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col text-center md:text-left min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-textPrimary tracking-tight mb-2">
              {track.title}
            </h1>
            <p className="text-base md:text-lg font-semibold text-accent mb-1">
              {track.composer || track.artist}
            </p>
            {track.movieName || track.album ? (
              <p className="text-xs md:text-sm text-textSecondary mb-4">
                {track.movieName ? `Soundtrack • ${track.movieName}` : `Album • ${track.album}`}
              </p>
            ) : null}

            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6">
              {track.language ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surfaceRaised border border-hairline text-textSecondary">
                  {track.language}
                </span>
              ) : null}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surfaceRaised border border-hairline text-textSecondary">
                {formatDuration(track.durationMs)}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surfaceRaised border border-hairline text-textSecondary">
                Full Fidelity
              </span>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-6">
              <button
                onClick={handlePlayOnWeb}
                className="px-6 py-3 bg-accent text-black font-bold rounded-full hover:brightness-110 transition-all flex items-center gap-2 shadow-lg"
              >
                {isThisSongPlaying ? (
                  <>
                    <Pause className="w-5 h-5 fill-black" /> Pause on Web
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-black" /> Play on Web
                  </>
                )}
              </button>

              <button
                onClick={handleOpenInApp}
                className="px-5 py-3 bg-surfaceRaised text-textPrimary border border-hairline font-semibold rounded-full hover:bg-surfaceHover transition-colors flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4 text-accent" /> Open in App
              </button>

              <button
                onClick={handleShare}
                className="p-3 bg-surfaceRaised text-textSecondary hover:text-textPrimary border border-hairline rounded-full hover:bg-surfaceHover transition-colors"
                title="Share this song"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* App Store / Play Store Install Badges */}
            <div className="pt-4 border-t border-hairline flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3">
              <span className="text-xs text-textTertiary font-medium">Get the app for best audio:</span>
              <div className="flex items-center gap-2">
                <a
                  href="https://play.google.com/store/apps/details?id=com.syncwave.music"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-black/60 border border-hairline rounded-lg text-xs font-semibold text-textSecondary hover:text-white hover:border-hairlineLight transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-accent" /> Google Play
                </a>
                <a
                  href="https://apps.apple.com/app/syncwave-music/id123456789"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-black/60 border border-hairline rounded-lg text-xs font-semibold text-textSecondary hover:text-white hover:border-hairlineLight transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-accent" /> App Store
                </a>
                <button
                  onClick={handleWhatsAppShare}
                  className="px-3 py-1.5 bg-[#25D366]/20 border border-[#25D366]/30 rounded-lg text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/30 transition-all flex items-center gap-1.5"
                >
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
