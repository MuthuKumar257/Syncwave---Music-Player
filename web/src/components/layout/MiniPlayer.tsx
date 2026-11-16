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
    <div className="bg-surface border-t border-hairline px-4 py-2 flex flex-col z-30 select-none">
      {/* Remote Playback Status Banner when another device owns audio */}
      {isRemoteMode && (
        <div className="mb-2 -mx-4 -mt-2 px-4 py-1.5 bg-accent/15 border-b border-accent/30 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-accent font-medium min-w-0">
            <MonitorSpeaker className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Playing on {activeDevice?.deviceName || 'another device'} &bull; This browser is
              acting as a remote
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void transferPlayback(myDeviceId)}
              className="px-2 py-0.5 rounded bg-accent text-black font-semibold hover:brightness-110 transition"
            >
              Play here
            </button>
            <button
              type="button"
              onClick={() => setDevicePickerOpen(true)}
              className="text-text-secondary hover:text-text-primary underline"
            >
              Switch
            </button>
          </div>
        </div>
      )}

      {/* Scrubber Rail */}
      <div className="w-full -mt-2 mb-1 group cursor-pointer relative py-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="w-full h-1 bg-surface-elevated appearance-none cursor-pointer rounded overflow-hidden"
          style={{
            background: `linear-gradient(to right, #ededed 0%, #ededed ${progressPercent}%, rgba(237, 237, 237, 0.1) ${progressPercent}%, rgba(237, 237, 237, 0.1) 100%)`
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-4 h-12">
        {/* Left: Song Metadata */}
        <div
          className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:w-72 cursor-pointer group"
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

          <div className="min-w-0">
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
                title={
                  downloaded
                    ? 'Saved to Local (Plays offline)'
                    : 'Download online song to local library'
                }
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
              className={`hidden md:block p-1.5 rounded-control transition-colors ${
                isShuffle ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={playPrevious}
              className="p-1.5 rounded-control text-text-muted hover:text-text-primary transition-colors"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-control bg-primary text-primary-dark hover:bg-white flex items-center justify-center transition-colors active:scale-95 shadow-subtle"
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
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`hidden md:block p-1.5 rounded-control transition-colors ${
                repeatMode !== 'OFF' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] tabular-nums text-text-muted font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Sleep Timer, Device Connect & Audio Volume Control */}
        <div className="flex items-center gap-2 md:w-64 justify-end">
          <button
            type="button"
            onClick={() => setShowSleepTimerModal(true)}
            className={`p-1.5 px-2 rounded-control border text-xs flex items-center gap-1 transition-colors ${
              sleepTimerRemainingSec > 0
                ? 'border-accent/40 bg-accent/10 text-accent font-mono'
                : 'border-hairline bg-surface-elevated text-text-secondary hover:text-text-primary'
            }`}
            title="Set sleep timer (1-minute precision)"
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
            className="hidden md:block p-1.5 text-text-muted hover:text-text-primary transition-colors"
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
            className="hidden md:block w-20 h-1 bg-surface-elevated appearance-none cursor-pointer rounded"
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
