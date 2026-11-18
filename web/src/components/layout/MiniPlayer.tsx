import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Maximize2,
  Music,
  Heart,
  Download,
  Check,
  Loader2,
  MonitorSpeaker,
  Moon,
  ListMusic
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';
import { ArtworkImage } from '../common/ArtworkImage';
import { SleepTimerModal, formatCountdown } from '../player/SleepTimerModal';

export const MiniPlayer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    setNowPlayingOpen,
    isQueueOpen,
    setQueueOpen,
    sleepTimerRemainingSec
  } = usePlayerStore();

  const { favorites, toggleFavorite, downloadOnlineTrackToLocal, isDownloaded } = useLibraryStore();
  const {
    isRemoteMode,
    devices,
    activeDeviceId,
    myDeviceId,
    setDevicePickerOpen,
    transferPlayback
  } = usePlaybackSessionStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);

  const activeDevice = devices.find((d) => d.deviceId === activeDeviceId) || null;

  if (!currentSong && !isRemoteMode) return null;

  const isFav = currentSong ? favorites.includes(currentSong.id) : false;
  const downloaded = currentSong
    ? isDownloaded(currentSong.id) ||
      currentSong.isLocal ||
      currentSong.source === 'LOCAL' ||
      currentSong.source === 'DOWNLOADED'
    : false;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentSong || isDownloading || downloaded) return;
    setIsDownloading(true);
    try {
      await downloadOnlineTrackToLocal(currentSong);
    } catch {
      // Error surfaced cleanly via downloadError state in library store
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
    <div className="bg-surface border-t border-hairline px-3 md:px-4 py-1.5 md:py-2 flex flex-col z-30 select-none shrink-0">
      {/* Remote Playback Status Banner when another device owns audio */}
      {isRemoteMode && (
        <div className="mb-1.5 -mx-3 md:-mx-4 -mt-1.5 md:-mt-2 px-3 md:px-4 py-1 bg-accent/15 border-b border-accent/30 flex items-center justify-between gap-2 text-[10px] md:text-[11px]">
          <div className="flex items-center gap-1.5 text-accent font-medium min-w-0">
            <MonitorSpeaker className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Playing on {activeDevice?.deviceName || 'another device'} &bull; Remote
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void transferPlayback(myDeviceId)}
              className="px-2 py-0.5 rounded bg-accent text-black font-semibold hover:brightness-110 transition text-[10px]"
            >
              Play here
            </button>
            <button
              type="button"
              onClick={() => setDevicePickerOpen(true)}
              className="text-text-secondary hover:text-text-primary underline text-[10px]"
            >
              Switch
            </button>
          </div>
        </div>
      )}

      {/* 1. Thin Scrubber Progress Rail (Full Width) */}
      <div className="w-full -mt-1 mb-1 group cursor-pointer relative py-0.5">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="w-full h-1 bg-surface-elevated appearance-none cursor-pointer rounded overflow-hidden"
          style={{
            background: `linear-gradient(to right, #F59E0B 0%, #F59E0B ${progressPercent}%, rgba(237, 237, 237, 0.12) ${progressPercent}%, rgba(237, 237, 237, 0.12) 100%)`
          }}
        />
      </div>

      {/* ========================================================= */}
      {/* 2A. MOBILE COMPACT PLAYER CONTROLS ROW (md:hidden)        */}
      {/* Aligned single horizontal row with responsive controls    */}
      {/* ========================================================= */}
      <div className="flex md:hidden items-center justify-between h-12 gap-2 min-w-0">
        {/* Left: Small Song Thumbnail & Title */}
        <div
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
          onClick={() => currentSong && setNowPlayingOpen(true)}
          title="Open full player"
        >
          <div className="w-9 h-9 rounded-control bg-surface-elevated overflow-hidden shrink-0 relative flex items-center justify-center border border-hairline">
            {currentSong ? (
              <ArtworkImage
                src={currentSong.artworkUrl}
                alt={currentSong.title}
                iconClassName="w-4 h-4 text-text-muted"
              />
            ) : (
              <Music className="w-4 h-4 text-text-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-xs font-semibold text-text-primary truncate leading-tight">
              {currentSong?.title || 'Remote Session'}
            </p>
            <p className="text-[10px] text-text-muted truncate leading-tight mt-0.5">
              {currentSong?.artist || (activeDevice ? activeDevice.deviceName : 'SyncWave')}
            </p>
          </div>
        </div>

        {/* Right: Horizontally Aligned Touch Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Favourite Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (currentSong) toggleFavorite(currentSong.id);
            }}
            className="p-1.5 rounded-control text-text-muted hover:text-text-primary transition-colors tap-press"
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={`w-4 h-4 ${
                isFav ? 'text-accent fill-accent' : 'text-text-muted'
              }`}
            />
          </button>

          {/* Previous Song (shown on screens >= 360px) */}
          <button
            type="button"
            onClick={playPrevious}
            className="hidden sm:inline-flex p-1.5 rounded-control text-text-muted hover:text-text-primary transition-colors tap-press"
            title="Previous song"
            aria-label="Previous song"
          >
            <SkipBack className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Play / Pause Button (Prominent) */}
          <button
            type="button"
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-accent text-black hover:brightness-110 flex items-center justify-center transition-all active:scale-95 shadow-subtle shrink-0 tap-press"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Next Song */}
          <button
            type="button"
            onClick={playNext}
            className="p-1.5 rounded-control text-text-muted hover:text-text-primary transition-colors tap-press"
            title="Next song"
            aria-label="Next song"
          >
            <SkipForward className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Queue Button */}
          <button
            type="button"
            onClick={() => setQueueOpen(!isQueueOpen)}
            className={`p-1.5 rounded-control transition-colors tap-press ${
              isQueueOpen
                ? 'text-accent'
                : 'text-text-muted hover:text-text-primary'
            }`}
            title="Queue"
            aria-label="Toggle playback queue"
          >
            <ListMusic className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2B. DESKTOP FULL-FEATURED PLAYER (hidden md:flex)         */}
      {/* Preserves full desktop layout & volume controls           */}
      {/* ========================================================= */}
      <div className="hidden md:flex items-center justify-between gap-4 h-12">
        {/* Left: Song Metadata */}
        <div
          className="flex items-center gap-3 min-w-0 md:w-72 cursor-pointer group"
          onClick={() => currentSong && setNowPlayingOpen(true)}
        >
          <div className="w-10 h-10 rounded-control bg-surface-elevated overflow-hidden shrink-0 relative flex items-center justify-center border border-hairline">
            {currentSong ? (
              <ArtworkImage
                src={currentSong.artworkUrl}
                alt={currentSong.title}
                iconClassName="w-4 h-4 text-text-muted"
              />
            ) : (
              <Music className="w-4 h-4 text-text-muted" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-3.5 h-3.5 text-text-primary" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary truncate">
              {currentSong?.title || 'Remote Session Idle'}
            </p>
            <p className="text-xs text-text-muted truncate">
              {currentSong?.artist || `Connected to ${activeDevice?.deviceName || 'Active Device'}`}
            </p>
          </div>

          {currentSong && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleDownload}
                disabled={isDownloading || downloaded}
                className={`p-1 rounded-control transition-colors ${
                  downloaded
                    ? 'text-emerald-400'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title={downloaded ? 'Saved to Local' : 'Download song'}
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                ) : downloaded ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(currentSong.id);
                }}
                className="p-1 rounded-control text-text-muted hover:text-text-primary transition-colors"
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFav ? 'text-accent fill-accent' : 'text-text-muted'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 rounded-control transition-colors ${
                isShuffle ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={playPrevious}
              className="p-1.5 rounded-control text-text-muted hover:text-text-primary transition-colors"
              title="Previous"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-control bg-primary text-primary-dark hover:bg-white flex items-center justify-center transition-colors active:scale-95 shadow-subtle"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={playNext}
              className="p-1.5 rounded-control text-text-muted hover:text-text-primary transition-colors"
              title="Next"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-1.5 rounded-control transition-colors ${
                repeatMode !== 'OFF' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
              title="Repeat"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-text-muted font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Sleep Timer, Queue, Device Connect & Volume Slider */}
        <div className="flex items-center gap-2 md:w-64 justify-end">
          <button
            type="button"
            onClick={() => setShowSleepTimerModal(true)}
            className={`p-1.5 px-2 rounded-control border text-xs flex items-center gap-1 transition-colors ${
              sleepTimerRemainingSec > 0
                ? 'border-accent/40 bg-accent/10 text-accent font-mono'
                : 'border-hairline bg-surface-elevated text-text-secondary hover:text-text-primary'
            }`}
            title="Set sleep timer"
          >
            <Moon className="w-3.5 h-3.5" />
            {sleepTimerRemainingSec > 0 && (
              <span className="text-[11px] tabular-nums">{formatCountdown(sleepTimerRemainingSec)}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setQueueOpen(!isQueueOpen)}
            className={`p-1.5 px-2 rounded-control border text-xs flex items-center gap-1.5 transition-colors ${
              isQueueOpen
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-hairline bg-surface-elevated text-text-secondary hover:text-text-primary'
            }`}
            title="Playback Queue (Q)"
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px] font-medium">Queue</span>
          </button>

          <button
            type="button"
            onClick={() => setDevicePickerOpen(true)}
            className={`p-1.5 px-2 rounded-control border text-xs flex items-center gap-1.5 transition-colors ${
              isRemoteMode
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-hairline bg-surface-elevated text-text-secondary hover:text-text-primary'
            }`}
            title="Select playing device"
          >
            <MonitorSpeaker className="w-3.5 h-3.5" />
            <span className="hidden lg:inline max-w-[90px] truncate text-[11px] font-medium">
              {isRemoteMode ? activeDevice?.deviceName || 'Remote' : 'Devices'}
            </span>
          </button>

          <button
            onClick={toggleMute}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1 bg-surface-elevated appearance-none cursor-pointer rounded"
          />
        </div>
      </div>

      <SleepTimerModal
        isOpen={showSleepTimerModal}
        onClose={() => setShowSleepTimerModal(false)}
      />
    </div>
  );
};
