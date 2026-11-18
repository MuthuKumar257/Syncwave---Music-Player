import { Song } from '../types';

export type PlaybackStatusListener = (status: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentSong: Song | null;
  isAutoplayBlocked: boolean;
  error?: string | null;
}) => void;

/**
 * WebAudioPlayer: Singleton persistent audio playback engine for SyncWave Web.
 *
 * Utilizes a single, persistent HTMLAudioElement outside React route lifecycles to guarantee:
 * 1. Uninterrupted playback when Chrome is minimized, tabs are switched, or phone screen is locked.
 * 2. Unbroken queue progression without triggering browser autoplay blocks between tracks.
 * 3. Complete Media Session API integration (lock screen, notification, headset controls).
 * 4. Protection against source reloading during React re-renders and route navigation.
 * 5. Instant UI resynchronization upon returning to the tab.
 */
class WebAudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private currentSong: Song | null = null;
  private currentBlobUrl: string | null = null;
  private currentResolvedUrl: string | null = null;

  private listeners: Set<PlaybackStatusListener> = new Set();
  private volume: number = 0.85;
  private crossfadeDurationSec: number = 3;
  private isCrossfading: boolean = false;
  private playbackRate: number = 1.0;

  // Track event callbacks
  private onTrackEndedCallback: (() => void) | null = null;
  private onPreviousTrackCallback: (() => void) | null = null;
  private onNextTrackCallback: (() => void) | null = null;

  // Autoplay recovery
  private isAutoplayBlocked: boolean = false;
  private pendingTrack: { song: Song; withCrossfade: boolean; startPosition?: number } | null = null;
  private hasRegisteredGesture: boolean = false;

  // Network resilience
  private retryCount: number = 0;
  private maxRetries: number = 2;
  private retryTimeoutId: any = null;
  private lastErrorMessage: string | null = null;
  private lastPositionUpdateTime: number = 0;

  constructor() {
    this.initPersistentAudio();
    this.setupMediaSession();
    this.setupLifecycleListeners();
  }

  /**
   * Initializes or attaches to the single persistent HTMLAudioElement in the DOM.
   * Placing it permanently outside the React router tree ensures route changes
   * never recreate or destroy the underlying media stream.
   */
  private initPersistentAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioElement) {
      const existing = typeof document !== 'undefined'
        ? (document.getElementById('syncwave-persistent-audio') as HTMLAudioElement | null)
        : null;

      if (existing) {
        this.audioElement = existing;
      } else {
        this.audioElement = new Audio();
        this.audioElement.id = 'syncwave-persistent-audio';
        this.audioElement.style.display = 'none';

        try {
          if (typeof document !== 'undefined' && document.body) {
            document.body.appendChild(this.audioElement);
          }
        } catch {
          // Fallback if document.body is not yet ready
        }
      }

      this.audioElement.preload = 'auto';
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.volume = this.volume;
      this.audioElement.playbackRate = this.playbackRate;

      this.attachAudioListeners(this.audioElement);
    }

    return this.audioElement;
  }

  /**
   * Attaches native media events once to the persistent audio element.
   */
  private attachAudioListeners(audio: HTMLAudioElement) {
    audio.addEventListener('play', () => {
      this.isAutoplayBlocked = false;
      this.retryCount = 0;
      this.lastErrorMessage = null;
      this.notify();
      this.updateMediaSessionPlaybackState('playing');
    });

    audio.addEventListener('playing', () => {
      this.isAutoplayBlocked = false;
      this.notify();
      this.updateMediaSessionPlaybackState('playing');
    });

    audio.addEventListener('pause', () => {
      this.notify();
      this.updateMediaSessionPlaybackState('paused');
    });

    audio.addEventListener('timeupdate', () => {
      this.notify();

      // Throttled Media Session position update (every ~1s)
      const now = Date.now();
      if (now - this.lastPositionUpdateTime > 1000) {
        this.lastPositionUpdateTime = now;
        this.updateMediaSessionPosition(audio.currentTime, audio.duration || 0);
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      this.notify();
      this.updateMediaSessionPosition(audio.currentTime, audio.duration || 0);
    });

    audio.addEventListener('durationchange', () => {
      this.notify();
      this.updateMediaSessionPosition(audio.currentTime, audio.duration || 0);
    });

    audio.addEventListener('ended', () => {
      this.notify();
      if (this.onTrackEndedCallback) {
        this.onTrackEndedCallback();
      }
    });

    audio.addEventListener('error', () => {
      const err = audio.error;
      const errorMsg = err
        ? `Audio error (code ${err.code}): ${err.message || 'Stream or network error'}`
        : 'Audio playback error';
      console.warn('[SyncWave WebAudioPlayer]', errorMsg);

      // Handle network interruption with automatic retry
      if (err && err.code === 2 /* MEDIA_ERR_NETWORK */ && this.retryCount < this.maxRetries && this.currentSong) {
        this.retryCount++;
        console.log(`[SyncWave WebAudioPlayer] Network drop detected. Retrying playback (${this.retryCount}/${this.maxRetries})...`);
        this.clearRetryTimeout();
        this.retryTimeoutId = setTimeout(() => {
          if (this.currentSong && !audio.ended) {
            const resumePos = audio.currentTime;
            audio.load();
            if (resumePos > 0) audio.currentTime = resumePos;
            audio.play().catch(() => {});
          }
        }, 1500);
      } else {
        this.lastErrorMessage = errorMsg;
        this.notify();
      }
    });
  }

  /**
   * Browser lifecycle listeners:
   * - Tab becomes visible: Resynchronizes UI state with hardware audio element.
   * - Network online: Restores playback if dropped during network loss.
   * - Never pauses on blur, visibilitychange, or hidden state.
   */
  private setupLifecycleListeners() {
    if (typeof window === 'undefined') return;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncStateWithHardware();
        }
      });
    }

    window.addEventListener('focus', () => {
      this.syncStateWithHardware();
    });

    window.addEventListener('online', () => {
      const audio = this.audioElement;
      if (audio && this.currentSong && this.lastErrorMessage) {
        console.log('[SyncWave WebAudioPlayer] Network restored. Resuming audio...');
        const resumePos = audio.currentTime;
        audio.load();
        if (resumePos > 0) audio.currentTime = resumePos;
        audio.play().catch(() => {});
      }
    });
  }

  /**
   * Resynchronizes store/UI listeners with the actual audio element state.
   */
  syncStateWithHardware() {
    const audio = this.audioElement;
    if (!audio) return;
    this.notify();
    this.updateMediaSessionPosition(audio.currentTime, audio.duration || 0);
    this.updateMediaSessionPlaybackState(audio.paused ? 'paused' : 'playing');
  }

  /**
   * Registers all supported browser Media Session API action handlers.
   */
  public setupMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;

    const safeSetAction = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Ignored if specific action is unsupported in this browser
      }
    };

    safeSetAction('play', () => {
      this.resume();
    });

    safeSetAction('pause', () => {
      this.pause();
    });

    safeSetAction('previoustrack', () => {
      if (this.onPreviousTrackCallback) {
        this.onPreviousTrackCallback();
      } else {
        this.seek(0);
      }
    });

    safeSetAction('nexttrack', () => {
      if (this.onNextTrackCallback) {
        this.onNextTrackCallback();
      }
    });

    safeSetAction('seekbackward', (details) => {
      const offset = details.seekOffset || 10;
      if (this.audioElement) {
        this.seek(Math.max(0, this.audioElement.currentTime - offset));
      }
    });

    safeSetAction('seekforward', (details) => {
      const offset = details.seekOffset || 10;
      if (this.audioElement) {
        const dur = this.audioElement.duration || 0;
        this.seek(Math.min(dur, this.audioElement.currentTime + offset));
      }
    });

    safeSetAction('seekto', (details) => {
      if (details.seekTime !== undefined) {
        this.seek(details.seekTime);
      }
    });

    safeSetAction('stop', () => {
      this.pause();
    });
  }

  /**
   * Updates Media Session metadata with title, artist, album, and multi-resolution artwork.
   */
  private updateMediaSessionMetadata(song: Song) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

    const artworkUrl = song.artworkUrl || '/default-artwork.png';
    const artworkList = [
      { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
      { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
      { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
      { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
      { src: artworkUrl, sizes: '384x384', type: 'image/jpeg' },
      { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
    ];

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Untitled Track',
        artist: song.artist || song.composer || 'SyncWave Artist',
        album: song.album || (song as any).movieName || 'SyncWave',
        artwork: artworkList
      });
      this.updateMediaSessionPlaybackState(this.audioElement?.paused ? 'paused' : 'playing');
    } catch {
      // Ignored
    }
  }

  private updateMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none') {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = state;
      } catch {}
    }
  }

  private updateMediaSessionPosition(position: number, duration: number) {
    if (
      typeof navigator !== 'undefined' &&
      'mediaSession' in navigator &&
      typeof navigator.mediaSession.setPositionState === 'function' &&
      duration > 0 &&
      Number.isFinite(duration) &&
      !isNaN(duration)
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: this.audioElement?.playbackRate || 1.0,
          position: Math.min(Math.max(0, position), duration)
        });
      } catch {}
    }
  }

  private clearRetryTimeout() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  setTrackEndedCallback(cb: () => void) {
    this.onTrackEndedCallback = cb;
  }

  setPreviousTrackCallback(cb: () => void) {
    this.onPreviousTrackCallback = cb;
  }

  setNextTrackCallback(cb: () => void) {
    this.onNextTrackCallback = cb;
  }

  hasActiveAudio(): boolean {
    return this.audioElement !== null && Boolean(this.audioElement.src);
  }

  subscribe(listener: PlaybackStatusListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const audio = this.audioElement;
    const isPlaying = !!(audio && !audio.paused && !audio.ended);
    const currentTime = audio ? audio.currentTime : 0;
    const rawDuration = audio ? audio.duration : 0;
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;

    const payload = {
      isPlaying,
      currentTime,
      duration,
      currentSong: this.currentSong,
      isAutoplayBlocked: this.isAutoplayBlocked,
      error: this.lastErrorMessage
    };

    this.listeners.forEach((listener) => listener(payload));
  }

  private setupFirstInteractionListener() {
    if (this.hasRegisteredGesture || typeof window === 'undefined') return;
    this.hasRegisteredGesture = true;

    const unlock = () => {
      this.hasRegisteredGesture = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.unlockAudio();
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  async unlockAudio(): Promise<void> {
    this.isAutoplayBlocked = false;
    if (this.pendingTrack) {
      const { song, withCrossfade, startPosition } = this.pendingTrack;
      this.pendingTrack = null;
      await this.play(song, withCrossfade, startPosition || 0);
    } else if (this.audioElement && this.audioElement.paused) {
      await this.audioElement.play().catch(() => {});
      this.notify();
    }
  }

  /**
   * Plays the given song using the persistent HTMLAudioElement.
   *
   * Guards:
   * - Prevents source reloading when called with identical song/URL during React re-renders.
   * - Smoothly fades volume when crossfading on the persistent element.
   * - Retains user gesture authorization across track transitions in background tabs.
   */
  async play(song: Song, withCrossfade = false, startPosition = 0): Promise<void> {
    const audio = this.initPersistentAudio();
    if (!audio) return;

    this.clearRetryTimeout();
    this.lastErrorMessage = null;

    // Helper: distinguish web pages from direct audio streams
    const isWebpageUrl = (u: string) =>
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com|music\.apple\.com)\//i.test(u);

    let srcUrl = song.uri && !isWebpageUrl(song.uri) ? song.uri : '';
    if (song.blob) {
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
      }
      this.currentBlobUrl = URL.createObjectURL(song.blob);
      srcUrl = this.currentBlobUrl;
    } else if (song.fileHandle && typeof song.fileHandle.getFile === 'function') {
      try {
        const file = await song.fileHandle.getFile();
        if (this.currentBlobUrl) {
          URL.revokeObjectURL(this.currentBlobUrl);
        }
        this.currentBlobUrl = URL.createObjectURL(file);
        srcUrl = this.currentBlobUrl;
      } catch (err) {
        console.warn('[SyncWave WebAudioPlayer] Unable to read local file handle:', song.title, err);
      }
    } else if (!srcUrl && (song as any).fullAudioUrl && !isWebpageUrl((song as any).fullAudioUrl)) {
      srcUrl = (song as any).fullAudioUrl;
    } else if (!srcUrl && (song as any).previewUrl && !isWebpageUrl((song as any).previewUrl)) {
      srcUrl = (song as any).previewUrl;
    } else if (!srcUrl && song.externalUrl && !isWebpageUrl(song.externalUrl)) {
      srcUrl = song.externalUrl;
    }

    if (!srcUrl) {
      console.warn('[SyncWave WebAudioPlayer] No playable direct audio stream available for song:', song.title);
      return;
    }

    // Unnecessary Reload Protection:
    // If the exact same song and source URL are already active, do not re-assign audio.src!
    const isSameSong = this.currentSong?.id === song.id;
    const isSameSrc = audio.src === srcUrl || (srcUrl && audio.src.endsWith(srcUrl));

    if (isSameSong && isSameSrc && !audio.ended && audio.readyState >= 1) {
      if (startPosition > 0 && Math.abs(audio.currentTime - startPosition) > 1.5) {
        audio.currentTime = startPosition;
      }
      if (audio.paused) {
        try {
          await audio.play();
          this.isAutoplayBlocked = false;
          this.notify();
          this.updateMediaSessionMetadata(song);
        } catch (err: any) {
          this.handlePlayError(err, song, withCrossfade, startPosition);
        }
      }
      return;
    }

    // Clean up old blob URL if switching to a remote URL
    if (!song.blob && this.currentBlobUrl && srcUrl !== this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    this.currentSong = song;
    this.currentResolvedUrl = srcUrl;

    if (withCrossfade && !audio.paused && audio.currentTime > 0) {
      await this.executeCrossfade(song, srcUrl, startPosition);
      return;
    }

    audio.src = srcUrl;
    audio.volume = this.volume;
    audio.playbackRate = this.playbackRate;
    if (startPosition > 0) {
      audio.currentTime = startPosition;
    }

    try {
      await audio.play();
      this.isAutoplayBlocked = false;
      this.updateMediaSessionMetadata(song);
      this.notify();
    } catch (err: any) {
      this.handlePlayError(err, song, withCrossfade, startPosition);
    }
  }

  /**
   * Crossfade execution on the persistent HTMLAudioElement.
   * Fades out existing audio, switches source, starts playback, and fades in new audio.
   * Preserves background execution context without spawning auxiliary audio elements.
   */
  private async executeCrossfade(newSong: Song, newSrc: string, startPosition = 0): Promise<void> {
    const audio = this.audioElement;
    if (!audio) return;

    this.isCrossfading = true;
    const targetVolume = this.volume;
    const steps = 8;
    const stepDurationMs = Math.max(30, Math.floor((this.crossfadeDurationSec * 1000) / (steps * 2)));

    // 1. Fade out current audio
    for (let i = steps; i >= 1; i--) {
      audio.volume = (targetVolume * i) / steps;
      await new Promise((r) => setTimeout(r, stepDurationMs));
    }

    // 2. Switch source on the persistent element
    audio.src = newSrc;
    if (startPosition > 0) {
      audio.currentTime = startPosition;
    }
    audio.volume = 0;

    try {
      await audio.play();
      this.isAutoplayBlocked = false;
      this.updateMediaSessionMetadata(newSong);
      this.notify();

      // 3. Fade in new audio
      for (let i = 1; i <= steps; i++) {
        audio.volume = (targetVolume * i) / steps;
        await new Promise((r) => setTimeout(r, stepDurationMs));
      }
      audio.volume = targetVolume;
    } catch (err: any) {
      audio.volume = targetVolume;
      this.handlePlayError(err, newSong, false, startPosition);
    } finally {
      this.isCrossfading = false;
    }
  }

  private handlePlayError(err: any, song: Song, withCrossfade: boolean, startPosition = 0) {
    if (err?.name === 'NotAllowedError') {
      // Browser Autoplay Policy: User gesture required before starting initial audio
      this.isAutoplayBlocked = true;
      this.pendingTrack = { song, withCrossfade, startPosition };
      this.notify();
      this.setupFirstInteractionListener();
    } else {
      console.warn('[SyncWave WebAudioPlayer] Audio play failed:', err);
      this.lastErrorMessage = err?.message || 'Audio playback failed';
      this.notify();
    }
  }

  pause() {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
      this.updateMediaSessionPlaybackState('paused');
      this.notify();
    }
  }

  resume() {
    if (this.audioElement && this.audioElement.paused) {
      this.audioElement.play().catch((err) => {
        if (err?.name === 'NotAllowedError') {
          this.isAutoplayBlocked = true;
          this.notify();
          this.setupFirstInteractionListener();
        }
      });
      this.updateMediaSessionPlaybackState('playing');
      this.notify();
    } else if (this.isAutoplayBlocked && this.pendingTrack) {
      this.unlockAudio();
    }
  }

  seek(seconds: number) {
    if (this.audioElement) {
      const dur = this.audioElement.duration || 0;
      const target = Math.max(0, Math.min(seconds, dur > 0 ? dur : seconds));
      this.audioElement.currentTime = target;
      this.notify();
      this.updateMediaSessionPosition(target, dur);
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioElement && !this.isCrossfading) {
      this.audioElement.volume = this.volume;
    }
  }

  setCrossfadeDuration(sec: number) {
    this.crossfadeDurationSec = Math.max(0, Math.min(12, sec));
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.audioElement) {
      this.audioElement.playbackRate = this.playbackRate;
      this.notify();
    }
  }

  getCurrentSong(): Song | null {
    return this.currentSong;
  }

  getVolume(): number {
    return this.volume;
  }

  getIsAutoplayBlocked(): boolean {
    return this.isAutoplayBlocked;
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.initPersistentAudio();
  }
}

export const webAudioPlayer = new WebAudioPlayer();
