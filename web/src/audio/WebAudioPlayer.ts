import { Song } from '../types';

export type PlaybackStatusListener = (status: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentSong: Song | null;
  isAutoplayBlocked: boolean;
}) => void;

class WebAudioPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private currentGain: GainNode | null = null;

  private currentSong: Song | null = null;
  private listeners: Set<PlaybackStatusListener> = new Set();
  private volume: number = 0.85;
  private crossfadeDurationSec: number = 3;
  private isCrossfading: boolean = false;
  private onTrackEndedCallback: (() => void) | null = null;

  // Autoplay recovery
  private isAutoplayBlocked: boolean = false;
  private pendingTrack: { song: Song; withCrossfade: boolean } | null = null;
  private hasRegisteredGesture: boolean = false;

  constructor() {
    this.setupMediaSession();
  }

  private initAudioContext() {
    if (typeof window === 'undefined') return;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      // Catch silently - browser will permit resumption once user interacts with page
      this.audioCtx.resume().catch(() => {});
    }
  }

  setTrackEndedCallback(cb: () => void) {
    this.onTrackEndedCallback = cb;
  }

  hasActiveAudio(): boolean {
    return this.currentAudio !== null;
  }

  subscribe(listener: PlaybackStatusListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const isPlaying = !!(this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended);
    const currentTime = this.currentAudio ? this.currentAudio.currentTime : 0;
    const rawDuration = this.currentAudio ? this.currentAudio.duration : 0;
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;

    const payload = {
      isPlaying,
      currentTime,
      duration,
      currentSong: this.currentSong,
      isAutoplayBlocked: this.isAutoplayBlocked
    };

    this.listeners.forEach((listener) => listener(payload));
    this.updateMediaSessionPosition(currentTime, duration);
  }

  private setupMediaSession() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      });
    }
  }

  private updateMediaSessionMetadata(song: Song) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album || 'SyncWave',
        artwork: song.artworkUrl
          ? [{ src: song.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [{ src: '/default-artwork.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  private updateMediaSessionPosition(position: number, duration: number) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && duration > 0 && !isNaN(duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: this.currentAudio?.playbackRate || 1.0,
          position: Math.min(position, duration)
        });
      } catch (e) {
        // Ignored if state updates too frequently or media not ready
      }
    }
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
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (e) {
        // Ignored
      }
    }

    if (this.pendingTrack) {
      const { song, withCrossfade } = this.pendingTrack;
      this.pendingTrack = null;
      this.isAutoplayBlocked = false;
      await this.play(song, withCrossfade);
    } else {
      this.isAutoplayBlocked = false;
      this.notify();
    }
  }

  async play(song: Song, withCrossfade = false): Promise<void> {
    this.initAudioContext();

    // Determine audio source URL (blob URL if local audio file, or direct audio stream URL)
    const isWebpageUrl = (u: string) =>
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com|music\.apple\.com)\//i.test(u);

    let srcUrl = song.uri && !isWebpageUrl(song.uri) ? song.uri : '';
    if (song.blob) {
      srcUrl = URL.createObjectURL(song.blob);
    } else if (song.fileHandle && typeof song.fileHandle.getFile === 'function') {
      try {
        const file = await song.fileHandle.getFile();
        srcUrl = URL.createObjectURL(file);
      } catch (err) {
        console.warn('Unable to read local file handle:', song.title, err);
      }
    } else if (!srcUrl && song.externalUrl && !isWebpageUrl(song.externalUrl)) {
      srcUrl = song.externalUrl;
    }

    if (!srcUrl) {
      console.warn('No playable audio stream available for song:', song.title);
      return;
    }

    if (withCrossfade && this.currentAudio && !this.currentAudio.paused && this.audioCtx) {
      await this.executeCrossfade(song, srcUrl);
      return;
    }

    // Direct playback
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
    }

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = srcUrl;
    audio.volume = this.volume;

    audio.onloadedmetadata = () => this.notify();
    audio.ondurationchange = () => this.notify();
    audio.ontimeupdate = () => this.notify();
    audio.onended = () => {
      this.notify();
      if (this.onTrackEndedCallback) {
        this.onTrackEndedCallback();
      }
    };
    audio.onerror = (e) => {
      console.error('Audio playback error', e);
      this.notify();
    };

    try {
      await audio.play();
      this.isAutoplayBlocked = false;
      this.currentAudio = audio;
      this.currentSong = song;
      this.updateMediaSessionMetadata(song);
      this.notify();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // Browser Autoplay Policy: requires a user interaction gesture
        this.isAutoplayBlocked = true;
        this.pendingTrack = { song, withCrossfade };
        this.currentSong = song;
        this.notify();
        this.setupFirstInteractionListener();
      } else {
        console.warn('Audio play request failed:', err);
      }
    }
  }

  private async executeCrossfade(newSong: Song, newSrc: string): Promise<void> {
    if (!this.audioCtx) return;

    this.isCrossfading = true;
    const oldAudio = this.currentAudio;
    const newAudio = new Audio(newSrc);
    newAudio.crossOrigin = 'anonymous';

    const now = this.audioCtx.currentTime;
    const fadeDuration = this.crossfadeDurationSec;

    try {
      // Connect old audio node to gain
      const oldSourceNode = this.audioCtx.createMediaElementSource(oldAudio!);
      const oldGainNode = this.audioCtx.createGain();
      oldSourceNode.connect(oldGainNode);
      oldGainNode.connect(this.audioCtx.destination);
      oldGainNode.gain.setValueAtTime(this.volume, now);
      oldGainNode.gain.linearRampToValueAtTime(0.001, now + fadeDuration);

      // Connect new audio node to gain
      const newSourceNode = this.audioCtx.createMediaElementSource(newAudio);
      const newGainNode = this.audioCtx.createGain();
      newSourceNode.connect(newGainNode);
      newGainNode.connect(this.audioCtx.destination);
      newGainNode.gain.setValueAtTime(0.001, now);
      newGainNode.gain.linearRampToValueAtTime(this.volume, now + fadeDuration);

      await newAudio.play();

      newAudio.ontimeupdate = () => this.notify();
      newAudio.onended = () => {
        this.notify();
        if (this.onTrackEndedCallback) {
          this.onTrackEndedCallback();
        }
      };

      setTimeout(() => {
        if (oldAudio) {
          oldAudio.pause();
          oldAudio.src = '';
        }
        this.currentAudio = newAudio;
        this.currentSong = newSong;
        this.isCrossfading = false;
        this.updateMediaSessionMetadata(newSong);
        this.notify();
      }, fadeDuration * 1000);
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        this.isAutoplayBlocked = true;
        this.pendingTrack = { song: newSong, withCrossfade: false };
        this.currentSong = newSong;
        this.notify();
        this.setupFirstInteractionListener();
        return;
      }
      if (oldAudio) oldAudio.pause();
      this.currentAudio = newAudio;
      this.currentSong = newSong;
      newAudio.volume = this.volume;
      await newAudio.play().catch(() => {});
      this.notify();
    }
  }

  pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      this.notify();
    }
  }

  resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.initAudioContext();
      this.currentAudio.play().catch(console.error);
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      this.notify();
    } else if (this.isAutoplayBlocked && this.pendingTrack) {
      this.unlockAudio();
    }
  }

  seek(seconds: number) {
    if (this.currentAudio) {
      this.currentAudio.currentTime = Math.max(0, Math.min(seconds, this.currentAudio.duration || 0));
      this.notify();
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  setCrossfadeDuration(sec: number) {
    this.crossfadeDurationSec = Math.max(0, Math.min(12, sec));
  }

  setPlaybackRate(rate: number) {
    if (this.currentAudio) {
      this.currentAudio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
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
}

export const webAudioPlayer = new WebAudioPlayer();
