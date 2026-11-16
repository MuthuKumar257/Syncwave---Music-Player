import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      resolve();
    };

    if (!document.getElementById('syncwave-yt-iframe-api')) {
      const script = document.createElement('script');
      script.id = 'syncwave-yt-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

/**
 * Audio-only background playback engine using the official YouTube IFrame Player API.
 * Keeps its hidden mount node permanently attached to the DOM so switching between
 * YouTube tracks, HTML5 audio fallbacks, and local files never leaves a detached player.
 */
export const YouTubeAudioEngine: React.FC = () => {
  const activeAudioVideoId = usePlayerStore((s) => s.activeAudioVideoId);
  const youtubeControlSignal = usePlayerStore((s) => s.youtubeControlSignal);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isRemoteMode = usePlaybackSessionStore((s) => s.isRemoteMode);

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const creatingRef = useRef(false);
  const pendingVideoRef = useRef<{ videoId: string; startSec: number } | null>(null);
  const loadedVideoRef = useRef<string | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  const clearProgressTimer = () => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const syncProgressNow = () => {
    const player = playerRef.current;
    if (!player || !readyRef.current || usePlaybackSessionStore.getState().isRemoteMode) return;
    if (!usePlayerStore.getState().isAudioStreamMode) return;
    try {
      const iframe = typeof player.getIframe === 'function' ? player.getIframe() : null;
      if (!iframe || !iframe.isConnected) return;
      const cur = typeof player.getCurrentTime === 'function' ? Number(player.getCurrentTime()) : 0;
      const dur = typeof player.getDuration === 'function' ? Number(player.getDuration()) : 0;
      const stateCode = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
      const playing = stateCode === 1;
      usePlayerStore.getState().syncExternalAudioState(cur, dur, playing);
    } catch {
      // Ignore transient iframe bridge reads before metadata ready
    }
  };

  const applyPendingLoad = (player: any) => {
    const pending = pendingVideoRef.current;
    if (!pending) return;
    const { volume, isMuted } = usePlayerStore.getState();
    try {
      if (isMuted) player.mute?.();
      else {
        player.unMute?.();
        player.setVolume?.(Math.round(volume * 100));
      }
      if (loadedVideoRef.current !== pending.videoId) {
        loadedVideoRef.current = pending.videoId;
        player.loadVideoById?.({ videoId: pending.videoId, startSeconds: pending.startSec });
      } else {
        if (pending.startSec > 0) {
          player.seekTo?.(pending.startSec, true);
        }
        player.playVideo?.();
      }
    } catch {
      // Ignore
    }
  };

  // Update MediaSession metadata + controls for OS/lock-screen audio controls
  useEffect(() => {
    if (!currentSong || !activeAudioVideoId || isRemoteMode) return;
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'SyncWave',
          artwork: currentSong.artworkUrl
            ? [{ src: currentSong.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
            : [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
        });
        navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume());
        navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().playNext());
        navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().playPrevious());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            usePlayerStore.getState().seek(details.seekTime);
          }
        });
      } catch {
        // Ignore unsupported browser MediaSession hooks
      }
    }
  }, [currentSong, activeAudioVideoId, isRemoteMode]);

  // Preload YouTube IFrame API script once on mount to avoid first-play delay
  useEffect(() => {
    void ensureYouTubeIframeApi();
  }, []);

  useEffect(() => {
    if (!activeAudioVideoId || isRemoteMode) {
      clearProgressTimer();
      pendingVideoRef.current = null;
      if (playerRef.current && readyRef.current) {
        try {
          const iframe = playerRef.current.getIframe?.();
          if (iframe && iframe.isConnected) {
            playerRef.current.stopVideo?.();
          }
        } catch {
          // Ignore
        }
      }
      loadedVideoRef.current = null;
      return;
    }

    const startSec = Math.max(0, Math.round(usePlayerStore.getState().currentTime || 0));
    pendingVideoRef.current = { videoId: activeAudioVideoId, startSec };

    let cancelled = false;

    void ensureYouTubeIframeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT?.Player) return;

      // Guard against detached iframe references if React remounted the host container
      if (playerRef.current) {
        try {
          const iframe = playerRef.current.getIframe?.();
          if (!iframe || !iframe.isConnected) {
            playerRef.current.destroy?.();
            playerRef.current = null;
            readyRef.current = false;
            creatingRef.current = false;
            loadedVideoRef.current = null;
          }
        } catch {
          playerRef.current = null;
          readyRef.current = false;
          creatingRef.current = false;
          loadedVideoRef.current = null;
        }
      }

      if (!playerRef.current && !creatingRef.current) {
        creatingRef.current = true;
        const initialVideoId = pendingVideoRef.current?.videoId || activeAudioVideoId;
        const iframe = document.createElement('iframe');
        iframe.id = 'syncwave-yt-player-frame';
        iframe.width = '200';
        iframe.height = '200';
        iframe.title = 'SyncWave background audio player';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';

        const attachPlayer = () => {
          if (playerRef.current || !hostRef.current || !iframe.isConnected || !window.YT?.Player) {
            creatingRef.current = false;
            return;
          }
          playerRef.current = new window.YT.Player(iframe, {
            events: {
              onReady: (e: any) => {
                creatingRef.current = false;
                readyRef.current = true;
                const pending = pendingVideoRef.current;
                if (!pending || usePlaybackSessionStore.getState().isRemoteMode) {
                  try {
                    e.target.stopVideo?.();
                  } catch {
                    // Ignore
                  }
                  return;
                }
                const { volume, isMuted } = usePlayerStore.getState();
                if (isMuted) e.target.mute?.();
                else {
                  e.target.unMute?.();
                  e.target.setVolume?.(Math.round(volume * 100));
                }
                if (pending.videoId !== initialVideoId) {
                  loadedVideoRef.current = pending.videoId;
                  e.target.loadVideoById?.({ videoId: pending.videoId, startSeconds: pending.startSec });
                } else {
                  loadedVideoRef.current = pending.videoId;
                  if (pending.startSec > 0) {
                    e.target.seekTo?.(pending.startSec, true);
                  }
                  e.target.playVideo?.();
                }
                clearProgressTimer();
                progressTimerRef.current = window.setInterval(syncProgressNow, 500);
              },
              onStateChange: (e: any) => {
                if (!usePlayerStore.getState().isAudioStreamMode) return;
                if (e.data === 1) {
                  syncProgressNow();
                  clearProgressTimer();
                  progressTimerRef.current = window.setInterval(syncProgressNow, 500);
                  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'playing';
                  }
                } else if (e.data === 2) {
                  clearProgressTimer();
                  const cur = typeof e.target.getCurrentTime === 'function' ? Number(e.target.getCurrentTime()) : undefined;
                  const dur = typeof e.target.getDuration === 'function' ? Number(e.target.getDuration()) : undefined;
                  usePlayerStore.getState().syncExternalAudioState(cur, dur, false);
                  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'paused';
                  }
                } else if (e.data === 0) {
                  clearProgressTimer();
                  usePlayerStore.getState().handleExternalAudioEnded();
                }
              },
              onError: () => {
                creatingRef.current = false;
                clearProgressTimer();
                loadedVideoRef.current = null;
                usePlayerStore.getState().handleExternalAudioError();
              },
            },
          });
        };

        // Wait for the iframe to commit to https://www.youtube.com before attaching
        // YT.Player so postMessage does not race against the initial about:blank origin.
        let attached = false;
        const onFrameReady = () => {
          if (attached) return;
          attached = true;
          attachPlayer();
        };
        iframe.addEventListener('load', onFrameReady, { once: true });
        window.setTimeout(onFrameReady, 3500);

        const params = new URLSearchParams({
          autoplay: '1',
          controls: '0',
          disablekb: '1',
          fs: '0',
          modestbranding: '1',
          playsinline: '1',
          rel: '0',
          enablejsapi: '1',
          origin: window.location.origin,
        });
        if (pendingVideoRef.current?.startSec) {
          params.set('start', String(pendingVideoRef.current.startSec));
        }
        iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(initialVideoId)}?${params.toString()}`;

        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(iframe);
      } else if (playerRef.current && readyRef.current) {
        applyPendingLoad(playerRef.current);
        clearProgressTimer();
        progressTimerRef.current = window.setInterval(syncProgressNow, 500);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeAudioVideoId, isRemoteMode]);

  // Execute Play / Pause / Seek / Volume commands against the audio engine
  useEffect(() => {
    if (!youtubeControlSignal || !playerRef.current || !readyRef.current) return;
    const player = playerRef.current;
    const { action, value } = youtubeControlSignal;
    try {
      const iframe = player.getIframe?.();
      if (!iframe || !iframe.isConnected) return;
      if (action === 'PAUSE') {
        player.pauseVideo?.();
      } else if (action === 'PLAY') {
        player.playVideo?.();
      } else if (action === 'SEEK' && typeof value === 'number') {
        player.seekTo?.(value, true);
      } else if (action === 'VOLUME' && typeof value === 'number') {
        if (value <= 0) {
          player.mute?.();
        } else {
          player.unMute?.();
          player.setVolume?.(Math.round(value * 100));
        }
      }
    } catch {
      // Ignore
    }
  }, [youtubeControlSignal]);

  useEffect(() => {
    return () => {
      clearProgressTimer();
      try {
        playerRef.current?.destroy?.();
      } catch {
        // Ignore
      }
      playerRef.current = null;
      readyRef.current = false;
      creatingRef.current = false;
      loadedVideoRef.current = null;
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-0 right-0 w-[200px] h-[200px] opacity-[0.001] pointer-events-none -z-50 overflow-hidden"
    >
      <div ref={hostRef} className="w-[200px] h-[200px]" />
    </div>
  );
};
