import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Volume2,
  VolumeX,
  ListMusic,
  Music,
  Download,
  Check,
  Loader2,
  MonitorSpeaker,
  Moon,
  Share2
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';
import { ArtworkImage } from '../common/ArtworkImage';
import { SongContextMenu } from '../common/SongContextMenu';
import { SleepTimerModal, formatCountdown } from './SleepTimerModal';
import { QueuePanel } from './QueuePanel';

export const NowPlayingModal: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    queue,
    isNowPlayingOpen,
    isQueueOpen,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    setNowPlayingOpen,
    setQueueOpen,
    playSong,
    sleepTimerRemainingSec,
    getNextSong,
    isGeneratingQueue
  } = usePlayerStore();

  const { favorites, toggleFavorite, downloadOnlineTrackToLocal, isDownloaded, downloadError } = useLibraryStore();
  const { isRemoteMode, devices, activeDeviceId, setDevicePickerOpen } = usePlaybackSessionStore();
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  if (!isNowPlayingOpen || !currentSong) return null;

  const handleDirectShare = async () => {
    if (!currentSong) return;
    const cleanId = encodeURIComponent(currentSong.id);
    const domain = window.location.origin.includes('localhost') ? 'https://syncwave.app' : window.location.origin;
    const shareUrl = `${domain}/song/${cleanId}`;
    const shareMessage = `Listen to ${currentSong.title} by ${currentSong.artist} on SyncWave.\n\nListen here: ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentSong.title} - SyncWave`,
          text: shareMessage,
          url: shareUrl
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    } catch {
      // Ignore
    }
  };

  const activeDevice = devices.find((d) => d.deviceId === activeDeviceId) || null;

  const isFav = favorites.includes(currentSong.id);
  const nextSong = getNextSong();

  const handleDownloadCurrentSong = async () => {
    if (!currentSong || isDownloading || isDownloaded(currentSong.id)) return;
    setIsDownloading(true);
    setLocalError(null);
    try {
      await downloadOnlineTrackToLocal(currentSong);
    } catch (err: any) {
      setLocalError(err?.message || downloadError || 'Full-song download unavailable for this source.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col justify-between p-6 md:p-10 select-none animate-in fade-in duration-150">
      {copiedToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-accent text-black px-4 py-2 rounded-full font-medium text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" /> Share link copied to clipboard!
        </div>
      )}
      {/* Top Bar */}
      <div className="flex items-center justify-between relative z-10">
        <button
          onClick={() => setNowPlayingOpen(false)}
          className="p-2 rounded-control bg-surface hover:bg-surface-elevated text-text-muted hover:text-text-primary border border-hairline transition-colors"
          title="Minimize player"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-[11px] font-mono text-text-muted">
            {isRemoteMode ? `Remote • ${activeDevice?.deviceName || 'Active Device'}` : 'Now playing'}
          </p>
          <p className="text-xs font-medium text-text-primary">
            {currentSong.album || 'Single'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDevicePickerOpen(true)}
            className={`p-2 rounded-control border transition-colors ${
              isRemoteMode
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-surface border-hairline text-text-muted hover:text-text-primary'
            }`}
            title="Connect to a device"
          >
            <MonitorSpeaker className="w-5 h-5" />
          </button>

          <button
            onClick={() => setQueueOpen(!isQueueOpen)}
            className={`p-2 rounded-control border transition-colors ${
              isQueueOpen
                ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                : 'bg-surface border-hairline text-text-muted hover:text-text-primary'
            }`}
            title="Toggle playback queue (Q)"
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Section: Hero Artwork */}
      <div className="my-auto flex flex-col items-center justify-center max-w-md mx-auto w-full relative z-10 py-4">
        <div className="w-64 h-64 md:w-80 md:h-80 rounded-card overflow-hidden bg-surface-elevated border border-hairline shadow-subtle relative flex items-center justify-center">
          <ArtworkImage
            src={currentSong.artworkUrl}
            alt={currentSong.title}
            iconClassName="w-12 h-12 text-text-muted"
          />
        </div>
      </div>

      {/* Bottom Track Controls & Sliders */}
      <div className="max-w-lg mx-auto w-full relative z-10 space-y-4">
        {/* Title & Artist & Favorite */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-medium text-text-primary truncate tracking-tight">
                {currentSong.title}
              </h2>
              {(isDownloaded(currentSong.id) || currentSong.isLocal || currentSong.source === 'LOCAL' || currentSong.source === 'DOWNLOADED') && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  Local Device
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted truncate mt-0.5">
              {currentSong.artist} &bull; {currentSong.album}
            </p>
            {localError && (
              <p className="text-[11px] text-amber-400 mt-1 leading-snug">
                {localError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadCurrentSong}
              disabled={isDownloading || isDownloaded(currentSong.id)}
              className={`p-2 rounded-control border transition-colors ${
                isDownloaded(currentSong.id)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default'
                  : 'bg-surface hover:bg-surface-elevated border-hairline text-text-muted hover:text-text-primary'
              }`}
              title={
                isDownloaded(currentSong.id)
                  ? 'Downloaded to local (plays offline)'
                  : 'Download to local for offline playback'
              }
            >
              {isDownloading ? (
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              ) : isDownloaded(currentSong.id) ? (
                <Check className="w-5 h-5" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => toggleFavorite(currentSong.id)}
              className="p-2 rounded-control bg-surface hover:bg-surface-elevated border border-hairline transition-colors"
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={`w-5 h-5 ${
                  isFav ? 'text-accent fill-accent' : 'text-text-muted'
                }`}
              />
            </button>
            <button
              onClick={handleDirectShare}
              className="p-2 rounded-control bg-surface hover:bg-surface-elevated border border-hairline transition-colors"
              title="Share song"
            >
              <Share2 className="w-5 h-5 text-text-muted hover:text-text-primary" />
            </button>
            <SongContextMenu song={currentSong} />
          </div>
        </div>

        {/* Scrubber Rail & Time Figures */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1 bg-surface-elevated appearance-none cursor-pointer rounded"
            style={{
              background: `linear-gradient(to right, #ededed 0%, #ededed ${progressPercent}%, rgba(237, 237, 237, 0.1) ${progressPercent}%, rgba(237, 237, 237, 0.1) 100%)`
            }}
          />
          <div className="flex justify-between text-[11px] font-mono tabular-nums text-text-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={toggleShuffle}
            className={`p-2 rounded-control transition-colors ${
              isShuffle ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={playPrevious}
            className="p-2 rounded-control text-text-muted hover:text-text-primary transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-control bg-primary text-primary-dark hover:bg-white flex items-center justify-center transition-colors active:scale-95 shadow-subtle"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={playNext}
            className="p-2 rounded-control text-text-muted hover:text-text-primary transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={toggleRepeat}
            className={`p-2 rounded-control transition-colors ${
              repeatMode !== 'OFF' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Volume slider & Sleep Timer */}
        <div className="flex items-center gap-3 pt-2 justify-center">
          <button
            type="button"
            onClick={() => setShowSleepTimerModal(true)}
            className={`px-2.5 py-1 rounded-control border text-[11px] flex items-center gap-1.5 transition-colors ${
              sleepTimerRemainingSec > 0
                ? 'bg-accent/15 border-accent/40 text-accent font-mono'
                : 'bg-surface border-hairline text-text-muted hover:text-text-primary'
            }`}
            title="Set sleep timer (1-minute precision)"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>{sleepTimerRemainingSec > 0 ? formatCountdown(sleepTimerRemainingSec) : 'Sleep timer'}</span>
          </button>

          <button onClick={toggleMute} className="text-text-muted hover:text-text-primary">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-36 h-1 bg-surface-elevated appearance-none cursor-pointer rounded"
          />
        </div>

        {/* Compact Up Next / Next Song Section */}
        <div className="pt-2 border-t border-hairline/60">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-mono tracking-wider uppercase text-text-muted flex items-center gap-1.5">
              <span>Up Next</span>
              {repeatMode === 'ONE' && (
                <span className="text-[10px] text-accent font-sans normal-case">(repeating)</span>
              )}
              {isShuffle && (
                <span className="text-[10px] text-text-muted font-sans normal-case">(shuffled)</span>
              )}
              {isGeneratingQueue && (
                <span className="flex items-center gap-1 text-[10px] text-accent font-sans normal-case">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>Loading...</span>
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setQueueOpen(true)}
              className="text-[11px] text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-surface-elevated"
              title="View full playback queue"
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue ({queue.length})</span>
            </button>
          </div>

          {nextSong ? (
            <div
              onClick={() => setQueueOpen(true)}
              className="group flex items-center justify-between p-2 rounded-control bg-surface hover:bg-surface-elevated border border-hairline hover:border-hairlineLight cursor-pointer transition-all active:scale-[0.99]"
              title={`Up Next: ${nextSong.title} by ${nextSong.artist}. Click to open playback queue.`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className="w-9 h-9 rounded-[6px] bg-surface-elevated overflow-hidden shrink-0 flex items-center justify-center border border-hairline relative"
                  onClick={(e) => {
                    e.stopPropagation();
                    playSong(nextSong, true);
                  }}
                  title="Play immediately"
                >
                  <ArtworkImage
                    src={nextSong.artworkUrl}
                    alt={nextSong.title}
                    iconClassName="w-4 h-4 text-text-muted"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                  </div>
                </div>
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs font-medium text-text-primary group-hover:text-white truncate">
                    {nextSong.title}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">
                    {nextSong.artist}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-text-muted tabular-nums">
                  {formatTime((nextSong.durationMs || 0) / 1000)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playSong(nextSong, true);
                  }}
                  className="text-[11px] text-accent hover:text-white px-2 py-0.5 rounded bg-accent/15 hover:bg-accent transition-colors font-medium opacity-0 group-hover:opacity-100"
                  title="Play next song immediately"
                >
                  Play
                </button>
              </div>
            </div>
          ) : isGeneratingQueue ? (
            <div className="flex items-center gap-2.5 p-2.5 rounded-control bg-surface/50 border border-hairline/50 text-text-muted animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent shrink-0" />
              <span className="text-xs text-text-secondary">Generating upcoming recommendations...</span>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-control bg-surface/50 border border-hairline/50 text-text-muted">
              <span className="text-xs italic">No upcoming songs</span>
              <button
                type="button"
                onClick={() => setQueueOpen(true)}
                className="text-[11px] text-text-muted hover:text-text-primary transition-colors underline"
              >
                Add songs to queue
              </button>
            </div>
          )}
        </div>
      </div>

      <SleepTimerModal
        isOpen={showSleepTimerModal}
        onClose={() => setShowSleepTimerModal(false)}
      />

      {/* Interactive Up Next Playback Queue Drawer */}
      <QueuePanel
        isOpen={isQueueOpen}
        onClose={() => setQueueOpen(false)}
      />
    </div>
  );
};
