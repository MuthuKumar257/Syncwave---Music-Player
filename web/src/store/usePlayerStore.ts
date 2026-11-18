import { create } from 'zustand';
import { Song } from '../types';
import { webAudioPlayer } from '../audio/WebAudioPlayer';
import { useLibraryStore } from './useLibraryStore';
import { indexedDb } from '../db/indexedDb';
import { useAnalyticsStore } from './useAnalyticsStore';
import { useRecommendationStore } from './useRecommendationStore';
import {
  PendingCommand,
  registerPlaybackSessionBridge,
  SessionPlaybackState,
  SessionTrack,
  sessionTrackToSong,
  songToSessionTrack,
  usePlaybackSessionStore,
} from './usePlaybackSessionStore';

export function normalizeClientLanguage(lang?: string | null): string {
  if (!lang || typeof lang !== 'string') return '';
  const cleaned = lang.trim().toLowerCase();
  const map: Record<string, string> = {
    tamil: 'Tamil', ta: 'Tamil', tam: 'Tamil',
    telugu: 'Telugu', te: 'Telugu', tel: 'Telugu',
    hindi: 'Hindi', hi: 'Hindi', hin: 'Hindi',
    malayalam: 'Malayalam', ml: 'Malayalam', mal: 'Malayalam',
    kannada: 'Kannada', kn: 'Kannada', kan: 'Kannada',
    punjabi: 'Punjabi', pa: 'Punjabi', pan: 'Punjabi',
    marathi: 'Marathi', mr: 'Marathi', mar: 'Marathi',
    bengali: 'Bengali', bn: 'Bengali', ben: 'Bengali',
    english: 'English', en: 'English', eng: 'English'
  };
  return map[cleaned] || (cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
}

export function isSongLanguageEligibleClient(song: { language?: string | null }, userLanguages: (string | null | undefined)[]): boolean {
  if (!userLanguages || userLanguages.length === 0) return false;
  const normUserLangs = userLanguages.map(normalizeClientLanguage).filter(Boolean);
  if (normUserLangs.length === 0) return false;

  const songLang = normalizeClientLanguage(song.language);
  if (!songLang) return false;
  return normUserLangs.includes(songLang);
}

export interface AudioControlSignal {
  action: 'PLAY' | 'PAUSE' | 'SEEK' | 'VOLUME';
  value?: number;
  nonce: number;
}

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  autoplay: boolean;
  playbackIntent: 'none' | 'play' | 'pause';
  userPlayInitiated: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackSpeed: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'OFF' | 'ALL' | 'ONE';
  queue: Song[];
  queueIndex: number;
  sessionPlayedSongIds: string[];
  isNowPlayingOpen: boolean;
  isQueueOpen: boolean;
  isAutoplayBlocked: boolean;
  activeAudioVideoId: string | null;
  isAudioStreamMode: boolean;
  youtubeControlSignal: AudioControlSignal | null;
  sleepTimerMinutes: number | null;
  sleepTimerRemainingSec: number;
  isRestoringSession: boolean;
  isGeneratingQueue: boolean;

  // Actions
  restorePlaybackSession: () => Promise<void>;
  persistCurrentSession: (immediate?: boolean) => void;
  unlockAudio: () => void;
  setSleepTimer: (minutes: number) => void;
  setSleepTimerUntilTime: (time24: string) => void;
  clearSleepTimer: () => void;
  playSong: (song: Song, crossfade?: boolean) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleMute: () => void;
  setQueue: (songs: Song[], startIndex?: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setNowPlayingOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  getNextSong: () => Song | null;
  playTrackAt: (index: number) => void;
  playNextInQueue: (song: Song) => void;
  startSongMix: (song: Song) => Promise<void>;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  fetchMoreRecommendations: () => Promise<void>;
  clearSessionHistory: () => void;
  pruneQueueByLanguage: () => void;
  resetForGuest: () => void;
  syncExternalAudioState: (currentTime?: number, duration?: number, isPlaying?: boolean) => void;
  handleExternalAudioEnded: () => void;
  handleExternalAudioError: () => void;
}

export function computeNextSong(
  queue: Song[],
  queueIndex: number,
  currentSong: Song | null,
  isShuffle: boolean,
  repeatMode: 'OFF' | 'ALL' | 'ONE'
): Song | null {
  if (!queue || queue.length === 0) return null;

  let currentIndex = queueIndex;
  if (currentSong && (currentIndex < 0 || currentIndex >= queue.length || queue[currentIndex]?.id !== currentSong.id)) {
    const found = queue.findIndex((s) => s.id === currentSong.id);
    if (found !== -1) currentIndex = found;
  }

  // In Repeat One mode, the next track to automatically play is the current song
  if (repeatMode === 'ONE' && currentSong) {
    return currentSong;
  }

  if (isShuffle) {
    if (queue.length <= 1) return repeatMode === 'ALL' ? queue[0] : null;
    const nextIdx = (currentIndex + 1) % queue.length;
    return queue[nextIdx] || null;
  }

  const nextIdx = currentIndex + 1;
  if (nextIdx < queue.length) {
    return queue[nextIdx];
  }
  if (repeatMode === 'ALL' && queue.length > 0) {
    return queue[0];
  }
  return null;
}

let lastStateSyncAt = 0;
let sleepTimerIntervalId: ReturnType<typeof setInterval> | null = null;
let sleepTimerEndsAtMs: number | null = null;
const failedVideoIdsBySong = new Map<string, Set<string>>();

const isWebpageUrl = (url?: string): boolean =>
  Boolean(url && /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com|music\.apple\.com)\//i.test(url));

const fallbackToDirectAudio = async (
  song: Song,
  crossfade: boolean,
  get: () => PlayerState,
  set: (partial: Partial<PlayerState>) => void
) => {
  if (usePlaybackSessionStore.getState().isRemoteMode || get().currentSong?.id !== song.id) return;

  const directUri = song.uri && !isWebpageUrl(song.uri) ? song.uri : null;
  if (directUri) {
    set({ activeAudioVideoId: null, isAudioStreamMode: false });
    await webAudioPlayer.play({ ...song, uri: directUri }, crossfade);
    publishLocalPlaybackState(get, true);
    return;
  }

  try {
    const res = await fetch(
      `/api/search/resolve-audio?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`
    );
    const data = res.ok ? await res.json() : null;
    if (usePlaybackSessionStore.getState().isRemoteMode || get().currentSong?.id !== song.id) return;

    if (data?.audioUrl) {
      set({
        activeAudioVideoId: null,
        isAudioStreamMode: false,
        duration: data.isPreview
          ? Math.round((data.actualAudioDurationMs || 30000) / 1000)
          : Math.round((data.durationMs || song.durationMs || 0) / 1000),
      });
      await webAudioPlayer.play({ ...song, uri: data.audioUrl }, crossfade);
      publishLocalPlaybackState(get, true);
      return;
    }
  } catch {
    // Ignore and stop cleanly below
  }

  if (get().currentSong?.id === song.id) {
    set({ activeAudioVideoId: null, isAudioStreamMode: false, isPlaying: false });
    publishLocalPlaybackState(get, true);
  }
};

const publishLocalPlaybackState = (get: () => PlayerState, force = false) => {
  const sessionStore = usePlaybackSessionStore.getState();
  if (!sessionStore.isConnected || sessionStore.isRemoteMode) return;

  const now = Date.now();
  if (!force && now - lastStateSyncAt < 3000) return;
  lastStateSyncAt = now;

  const s = get();
  void sessionStore.publishActiveState({
    track: s.currentSong ? songToSessionTrack(s.currentSong) : null,
    isPlaying: s.isPlaying,
    positionSec: Math.max(0, Math.round(s.currentTime)),
    durationSec: Math.max(0, Math.round(s.duration)),
    queue: s.queue.slice(0, 50).map(songToSessionTrack),
    queueIndex: s.queueIndex,
    volume: s.volume,
    isMuted: s.isMuted,
    isShuffle: s.isShuffle,
    repeatMode: s.repeatMode,
  });
};

let lastSessionPersistAt = 0;
let persistSessionTimeoutId: ReturnType<typeof setTimeout> | null = null;

const persistPlaybackSession = (get: () => PlayerState, immediate = false) => {
  const save = async () => {
    try {
      const state = get();
      if (!state.currentSong && state.queue.length === 0) return;
      const sessionData = {
        lastPlayedSongId: state.currentSong?.id,
        currentSong: state.currentSong,
        playbackPositionSec: Math.max(0, state.currentTime),
        isPlaying: false, // Ensure app reload starts paused
        queue: state.queue,
        queueIndex: state.queueIndex,
        sessionPlayedSongIds: state.sessionPlayedSongIds || [],
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode,
        volume: state.volume,
        isAudioStreamMode: state.isAudioStreamMode,
        activeAudioVideoId: state.activeAudioVideoId,
        savedAt: Date.now(),
      };

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('syncwave_playback_session', JSON.stringify(sessionData));
        }
      } catch {}

      await indexedDb.setMeta('playback_session', sessionData);
    } catch {}
  };

  if (immediate) {
    if (persistSessionTimeoutId) {
      clearTimeout(persistSessionTimeoutId);
      persistSessionTimeoutId = null;
    }
    void save();
    lastSessionPersistAt = Date.now();
    return;
  }

  const now = Date.now();
  if (now - lastSessionPersistAt < 2000) {
    if (!persistSessionTimeoutId) {
      persistSessionTimeoutId = setTimeout(() => {
        persistSessionTimeoutId = null;
        void save();
        lastSessionPersistAt = Date.now();
      }, 2000);
    }
    return;
  }

  lastSessionPersistAt = now;
  void save();
};

let isFetchingAutoQueue = false;

const fetchAndAppendAutoRecommendations = async (
  referenceSong: Song,
  get: () => PlayerState,
  set: (partial: Partial<PlayerState> | ((state: PlayerState) => Partial<PlayerState>)) => void
) => {
  if (isFetchingAutoQueue) return;
  isFetchingAutoQueue = true;
  set({ isGeneratingQueue: true });
  console.log(`[usePlayerStore] Queue generation started for song: "${referenceSong.title}" (${referenceSong.id})`);

  try {
    const s = get();
    const playedSet = new Set(s.sessionPlayedSongIds || []);
    playedSet.add(referenceSong.id);
    const existingQueueIds = new Set(s.queue.map((song) => song.id));
    const excludeIds = Array.from(new Set([...playedSet, ...existingQueueIds]));

    const candidates: Song[] = [];
    const userPreferredLangs = useRecommendationStore.getState().preferences?.preferredLanguages || [];

    // 1. If local audio track, check local indexedDb library songs
    const isLocal = Boolean(
      referenceSong.blob ||
      referenceSong.fileHandle ||
      referenceSong.source === 'LOCAL' ||
      referenceSong.source === 'DOWNLOADED'
    );

    if (isLocal) {
      try {
        const librarySongs = useLibraryStore.getState().songs || [];
        const localMatches = librarySongs.filter((cand) => {
          if (excludeIds.includes(cand.id)) return false;
          if (userPreferredLangs.length > 0 && !isSongLanguageEligibleClient(cand, userPreferredLangs)) {
            return false;
          }
          const sameArtist =
            cand.artist &&
            referenceSong.artist &&
            cand.artist.toLowerCase() === referenceSong.artist.toLowerCase();
          const sameAlbum =
            cand.album &&
            referenceSong.album &&
            cand.album.toLowerCase() === referenceSong.album.toLowerCase();
          const sameLang =
            cand.language &&
            referenceSong.language &&
            cand.language.toLowerCase() === referenceSong.language.toLowerCase();
          return sameArtist || sameAlbum || sameLang;
        });
        candidates.push(...localMatches);
      } catch {
        // ignore
      }
    }

    // 2. Fetch from backend auto-queue endpoint with Authorization token
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const res = await fetch('/api/recommendations/auto-queue', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          songId: referenceSong.id,
          songTitle: referenceSong.title,
          artist: referenceSong.artist,
          director: referenceSong.composer,
          language: referenceSong.language,
          genre: referenceSong.genre,
          mood: referenceSong.mood,
          excludeIds,
          limit: 20,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawTracks = Array.isArray(data.tracks) ? data.tracks : [];
        console.log(`[usePlayerStore] Recommendation API response received: ${rawTracks.length} tracks`);
        const mapped: Song[] = rawTracks
          .filter((t: any) => t && t.id && t.title)
          .map((t: any) => {
            const vid = t.videoId || (t.id.startsWith('yt_') ? t.id.replace('yt_', '') : undefined);
            return {
              id: t.id,
              title: t.title,
              artist: t.artist || t.composer || 'Unknown Artist',
              album: t.movieName || t.album || 'Single',
              durationMs: t.durationMs || 240000,
              uri: t.fullAudioUrl || t.sourceUrl || '',
              artworkUrl: t.artworkUrl || '',
              videoId: vid,
              source: vid ? 'YOUTUBE' : (t.sourcePlatform || 'OPEN_AUDIO'),
              language: t.language,
              genre: t.genre,
              mood: t.mood,
              composer: t.composer,
              createdAt: new Date().toISOString(),
            };
          });

        const validTracks = mapped.filter((cand: Song) => {
          if (userPreferredLangs.length > 0 && !isSongLanguageEligibleClient(cand, userPreferredLangs)) {
            console.log(`[usePlayerStore] Dropped song candidate "${cand.title}" outside user languages (${cand.language})`);
            return false;
          }
          return true;
        });

        candidates.push(...validTracks);
      } else {
        console.warn(`[usePlayerStore] Recommendation API returned status ${res.status}`);
      }
    } catch (err: any) {
      console.error('[usePlayerStore] Recommendation API fetch error:', err?.message || err);
    }

    // Deduplicate against current queue & session history
    const freshQueue = get().queue;
    const freshQueueIds = new Set(freshQueue.map((item) => item.id));
    const currentPlayed = new Set(get().sessionPlayedSongIds || []);
    const seenCandidateIds = new Set<string>();

    const uniqueNewSongs: Song[] = [];
    let duplicatesFiltered = 0;

    for (const cand of candidates) {
      if (freshQueueIds.has(cand.id) || currentPlayed.has(cand.id) || seenCandidateIds.has(cand.id)) {
        duplicatesFiltered++;
      } else {
        seenCandidateIds.add(cand.id);
        uniqueNewSongs.push(cand);
      }
    }

    console.log(`[usePlayerStore] Number of songs discovered: ${candidates.length}`);
    console.log(`[usePlayerStore] Number of duplicate songs filtered: ${duplicatesFiltered}`);
    console.log(`[usePlayerStore] Number of valid songs added to queue: ${uniqueNewSongs.length}`);

    if (uniqueNewSongs.length > 0) {
      set({
        queue: [...freshQueue, ...uniqueNewSongs],
        isGeneratingQueue: false
      });
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    } else {
      set({ isGeneratingQueue: false });
    }
  } catch (err: any) {
    console.error('[usePlayerStore] Queue generation failure:', err?.message || err);
    set({ isGeneratingQueue: false });
  } finally {
    isFetchingAutoQueue = false;
    set({ isGeneratingQueue: false });
  }
};

interface PlayTrackingState {
  currentSong: Song | null;
  accumulatedListeningSec: number;
  lastProgressTimestamp: number;
  hasCountedPlay: boolean;
  isReplay: boolean;
  unreportedDurationSec: number;
}

const playTracking: PlayTrackingState = {
  currentSong: null,
  accumulatedListeningSec: 0,
  lastProgressTimestamp: 0,
  hasCountedPlay: false,
  isReplay: false,
  unreportedDurationSec: 0,
};

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const flushListeningStats = (song: Song, additionalDurationMs: number, completed = false) => {
  if (additionalDurationMs <= 0 && !completed) return;
  const director = song.composer || song.artist;
  fetch('/api/recommendations/listening-stat', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      songId: song.id,
      songName: song.title,
      movieOrAlbum: song.album,
      musicDirector: director,
      singers: [song.artist],
      language: song.language,
      genre: song.genre,
      totalListeningDurationMs: Math.max(0, Math.round(additionalDurationMs)),
      completed,
    }),
  }).then(() => {
    useAnalyticsStore.getState().fetchStats(true).catch(() => {});
  }).catch(() => {});
};

const triggerPlayCount = (song: Song, isReplay: boolean, accumulatedSec: number) => {
  const authHeaders = getAuthHeaders();
  const director = song.composer || song.artist;

  // 1. History
  fetch('/api/history', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      songId: song.id,
      songTitle: song.title,
      artistName: song.artist,
      musicDirector: director,
      language: song.language,
      durationListenedMs: Math.max(0, Math.round(accumulatedSec * 1000)),
      completed: false,
      clientPlatform: 'WEB',
    }),
  }).then(() => {
    useAnalyticsStore.getState().fetchStats(true).catch(() => {});
  }).catch(() => {});

  // 2. Play Count Stat (counted ONLY after reaching threshold)
  fetch('/api/recommendations/listening-stat', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      songId: song.id,
      songName: song.title,
      movieOrAlbum: song.album,
      musicDirector: director,
      singers: [song.artist],
      language: song.language,
      genre: song.genre,
      playCount: 1,
      replayCount: isReplay ? 1 : 0,
      totalListeningDurationMs: Math.max(0, Math.round(accumulatedSec * 1000)),
      lastPlayedAt: new Date().toISOString(),
    }),
  }).then(() => {
    useAnalyticsStore.getState().fetchStats(true).catch(() => {});
  }).catch(() => {});

  // 3. Listening Event
  fetch('/api/listening-events', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      songId: song.id,
      songTitle: song.title,
      artistName: song.artist,
      musicDirector: director,
      language: song.language,
      eventType: isReplay ? 'REPLAY' : 'PLAY',
      durationPlayedSec: Math.max(0, Math.round(accumulatedSec)),
      clientPlatform: 'WEB',
    }),
  }).catch(() => {});
};

const trackProgress = (currentSong: Song | null, durationSec: number, isPlaying: boolean) => {
  if (!currentSong || !isPlaying) {
    playTracking.lastProgressTimestamp = Date.now();
    return;
  }

  if (playTracking.currentSong?.id !== currentSong.id) {
    return;
  }

  const now = Date.now();
  if (playTracking.lastProgressTimestamp <= 0) {
    playTracking.lastProgressTimestamp = now;
    return;
  }

  const deltaSec = Math.min(Math.max(0, (now - playTracking.lastProgressTimestamp) / 1000), 2.5);
  playTracking.lastProgressTimestamp = now;

  if (deltaSec > 0.1) {
    playTracking.accumulatedListeningSec += deltaSec;
    playTracking.unreportedDurationSec += deltaSec;

    // Meaningful play threshold: >= 5 seconds (or >= 50% for short clips < 10s)
    const threshold = durationSec > 0 && durationSec < 10 ? durationSec * 0.5 : 5;
    if (!playTracking.hasCountedPlay && playTracking.accumulatedListeningSec >= threshold) {
      playTracking.hasCountedPlay = true;
      triggerPlayCount(currentSong, playTracking.isReplay, playTracking.accumulatedListeningSec);
      playTracking.unreportedDurationSec = 0;
    } else if (playTracking.unreportedDurationSec >= 15) {
      flushListeningStats(currentSong, playTracking.unreportedDurationSec * 1000, false);
      playTracking.unreportedDurationSec = 0;
    }
  }
};

const handleTrackEnded = (get: () => PlayerState) => {
  const { currentSong } = get();
  if (currentSong && playTracking.currentSong?.id === currentSong.id) {
    if (!playTracking.hasCountedPlay) {
      playTracking.hasCountedPlay = true;
      triggerPlayCount(currentSong, playTracking.isReplay, playTracking.accumulatedListeningSec);
    }
    const director = currentSong.composer || currentSong.artist;
    fetch('/api/history', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        songId: currentSong.id,
        songTitle: currentSong.title,
        artistName: currentSong.artist,
        musicDirector: director,
        language: currentSong.language,
        durationListenedMs: Math.max(0, Math.round(playTracking.accumulatedListeningSec * 1000)),
        completed: true,
        clientPlatform: 'WEB',
      }),
    }).then(() => {
      useAnalyticsStore.getState().fetchStats(true).catch(() => {});
    }).catch(() => {});

    flushListeningStats(currentSong, playTracking.unreportedDurationSec * 1000, true);
    playTracking.unreportedDurationSec = 0;
  }
};

export const usePlayerStore = create<PlayerState>((set, get) => {
  const emitAudioSignal = (action: AudioControlSignal['action'], value?: number) => {
    set({
      youtubeControlSignal: {
        action,
        value,
        nonce: Date.now() + Math.random(),
      },
    });
  };

  const executeLocalPlaySong = (
    song: Song,
    crossfade = false,
    initialPositionSec = 0,
    forcedQueueIndex?: number
  ) => {
    const prevSong = get().currentSong;
    const isReplay = prevSong?.id === song.id;

    if (prevSong && prevSong.id !== song.id) {
      if (playTracking.accumulatedListeningSec < 15) {
        fetch('/api/recommendations/listening-stat', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            songId: prevSong.id,
            songName: prevSong.title,
            skipCount: 1,
          }),
        }).catch(() => {});
      }
      if (playTracking.unreportedDurationSec > 0) {
        flushListeningStats(prevSong, playTracking.unreportedDurationSec * 1000, false);
      }
    }

    playTracking.currentSong = song;
    playTracking.accumulatedListeningSec = 0;
    playTracking.lastProgressTimestamp = Date.now();
    playTracking.hasCountedPlay = false;
    playTracking.isReplay = isReplay;
    playTracking.unreportedDurationSec = 0;

    const isLocalAudio = Boolean(song.blob || song.fileHandle || song.source === 'LOCAL' || song.source === 'DOWNLOADED');
    failedVideoIdsBySong.delete(song.id);

    // Record played song in session history to prevent duplicate repeats during this listening session
    const currentSession = get().sessionPlayedSongIds || [];
    if (!currentSession.includes(song.id)) {
      set({ sessionPlayedSongIds: [...currentSession, song.id] });
    }

    // Keep queue & queueIndex strictly synchronized with the currently playing track
    const currentQueue = get().queue;
    if (
      typeof forcedQueueIndex === 'number' &&
      forcedQueueIndex >= 0 &&
      forcedQueueIndex < currentQueue.length
    ) {
      set({ queueIndex: forcedQueueIndex });
    } else {
      const existingIndex = currentQueue.findIndex((s) => s.id === song.id);
      if (existingIndex >= 0) {
        set({ queueIndex: existingIndex });
      } else if (currentQueue.length === 0) {
        set({ queue: [song], queueIndex: 0 });
      } else {
        const currIdx = Math.max(0, get().queueIndex);
        const newQueue = [...currentQueue];
        newQueue.splice(currIdx + 1, 0, song);
        set({ queue: newQueue, queueIndex: currIdx + 1 });
      }
    }

    const isDirectAudioSource = (u?: string | null): boolean => {
      if (!u || typeof u !== 'string') return false;
      return !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com|music\.apple\.com)\//i.test(u);
    };

    const hasDirectAudio = Boolean(
      song.blob ||
      song.fileHandle ||
      song.source === 'LOCAL' ||
      song.source === 'DOWNLOADED' ||
      isDirectAudioSource(song.uri) ||
      isDirectAudioSource((song as any).fullAudioUrl) ||
      isDirectAudioSource((song as any).previewUrl) ||
      isDirectAudioSource(song.externalUrl)
    );

    const fallbackToYouTubeOrDirect = (targetSong: Song, withCrossfade: boolean, posSec: number) => {
      let resolvedVideoId = targetSong.videoId;
      if (!resolvedVideoId) {
        if (targetSong.id.startsWith('yt_')) {
          resolvedVideoId = targetSong.id.replace('yt_', '');
        } else if (targetSong.externalUrl) {
          const match = targetSong.externalUrl.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (match) resolvedVideoId = match[1];
        }
      }

      if (resolvedVideoId) {
        webAudioPlayer.pause();
        set({
          currentSong: { ...targetSong, videoId: resolvedVideoId },
          isPlaying: true,
          playbackIntent: 'play',
          userPlayInitiated: true,
          currentTime: posSec,
          activeAudioVideoId: resolvedVideoId,
          isAudioStreamMode: true,
          duration: Math.round((targetSong.durationMs || 0) / 1000) || 240,
        });
        publishLocalPlaybackState(get, true);
        persistPlaybackSession(get, true);
      } else {
        fetch(
          `/api/search/resolve-stream?title=${encodeURIComponent(targetSong.title)}&artist=${encodeURIComponent(targetSong.artist)}`
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (usePlaybackSessionStore.getState().isRemoteMode || get().currentSong?.id !== targetSong.id) return;
            if (data && data.videoId) {
              webAudioPlayer.pause();
              set({
                currentSong: { ...targetSong, videoId: data.videoId },
                isPlaying: true,
                currentTime: posSec,
                activeAudioVideoId: data.videoId,
                isAudioStreamMode: true,
                duration: Math.round((data.durationMs || 240000) / 1000),
              });
              publishLocalPlaybackState(get, true);
              persistPlaybackSession(get, true);
            } else {
              void fallbackToDirectAudio(targetSong, withCrossfade, get, set);
            }
          })
          .catch(() => {
            void fallbackToDirectAudio(targetSong, withCrossfade, get, set);
          });
      }
    };

    if (hasDirectAudio) {
      // Primary playback engine: Persistent HTMLAudioElement (WebAudioPlayer)
      // Halts YouTube engine so multiple audio elements never play simultaneously
      if (get().activeAudioVideoId) {
        emitAudioSignal('PAUSE');
      }
      set({
        activeAudioVideoId: null,
        isAudioStreamMode: false,
        currentSong: song,
        isPlaying: true,
        playbackIntent: 'play',
        userPlayInitiated: true,
        currentTime: initialPositionSec,
        duration: Math.round((song.durationMs || 0) / 1000) || 0,
      });
      const playPromise = webAudioPlayer.play(song, crossfade, initialPositionSec);
      if (playPromise && typeof playPromise.then === 'function') {
        void playPromise.then(() => {
          if (initialPositionSec > 0) webAudioPlayer.seek(initialPositionSec);
        });
      } else if (initialPositionSec > 0) {
        webAudioPlayer.seek(initialPositionSec);
      }
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    } else {
      let resolvedVideoId = song.videoId;
      if (!resolvedVideoId) {
        if (song.id.startsWith('yt_')) {
          resolvedVideoId = song.id.replace('yt_', '');
        } else if (song.externalUrl) {
          const match = song.externalUrl.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (match) resolvedVideoId = match[1];
        }
      }

      if (resolvedVideoId) {
        fallbackToYouTubeOrDirect(song, crossfade, initialPositionSec);
      } else {
        // Immediate synchronous state update
        set({
          currentSong: song,
          isPlaying: true,
          playbackIntent: 'play',
          userPlayInitiated: true,
          currentTime: initialPositionSec,
          activeAudioVideoId: null,
          isAudioStreamMode: false,
          duration: Math.round((song.durationMs || 0) / 1000) || 240,
        });

        // 1. Attempt to resolve direct HTTPS audio stream first for background Chrome/mobile playback
        fetch(
          `/api/search/resolve-audio?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (usePlaybackSessionStore.getState().isRemoteMode || get().currentSong?.id !== song.id) return;
            if (data && data.audioUrl && isDirectAudioSource(data.audioUrl)) {
              // Direct audio stream successfully resolved!
              if (get().activeAudioVideoId) emitAudioSignal('PAUSE');
              const resolvedDuration = data.isPreview
                ? Math.round((data.actualAudioDurationMs || 30000) / 1000)
                : Math.round((data.durationMs || song.durationMs || 0) / 1000) || 240;

              const updatedSong = { ...song, uri: data.audioUrl };
              set({
                activeAudioVideoId: null,
                isAudioStreamMode: false,
                currentSong: updatedSong,
                isPlaying: true,
                playbackIntent: 'play',
                userPlayInitiated: true,
                currentTime: initialPositionSec,
                duration: resolvedDuration,
              });
              void webAudioPlayer.play(updatedSong, crossfade, initialPositionSec);
              publishLocalPlaybackState(get, true);
              persistPlaybackSession(get, true);
              return;
            }

            // 2. Direct audio not found. Fall back to secondary YouTube Audio Engine
            fallbackToYouTubeOrDirect(song, crossfade, initialPositionSec);
          })
          .catch(() => {
            fallbackToYouTubeOrDirect(song, crossfade, initialPositionSec);
          });
      }
    }

    // Play counting (>=30s or >=50%), duration accumulation, and completion
    // are tracked in trackProgress and handleTrackEnded rather than on initial track load
  };

  const executeLocalPause = () => {
    webAudioPlayer.pause();
    if (get().isAudioStreamMode) {
      emitAudioSignal('PAUSE');
    }
    const currentSong = get().currentSong;
    if (currentSong && playTracking.unreportedDurationSec > 3) {
      flushListeningStats(currentSong, playTracking.unreportedDurationSec * 1000, false);
      playTracking.unreportedDurationSec = 0;
    }
    set({
      isPlaying: false,
      playbackIntent: 'pause',
      userPlayInitiated: false,
    });
    publishLocalPlaybackState(get, true);
    persistPlaybackSession(get, true);
  };

  const executeLocalResume = () => {
    playTracking.lastProgressTimestamp = Date.now();
    const s = get();
    if (s.isAudioStreamMode && s.activeAudioVideoId) {
      emitAudioSignal('PLAY');
      set({ isPlaying: true, playbackIntent: 'play', userPlayInitiated: true });
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
      return;
    }
    if (s.currentSong) {
      if (s.currentSong.videoId || (s.currentSong.source === 'YOUTUBE' && !s.currentSong.blob)) {
        executeLocalPlaySong(s.currentSong, false, s.currentTime, s.queueIndex);
      } else {
        if (!webAudioPlayer.hasActiveAudio()) {
          executeLocalPlaySong(s.currentSong, false, s.currentTime, s.queueIndex);
        } else {
          webAudioPlayer.resume();
          set({ isPlaying: true, playbackIntent: 'play', userPlayInitiated: true });
          publishLocalPlaybackState(get, true);
          persistPlaybackSession(get, true);
        }
      }
    } else if (s.queue.length > 0) {
      executeLocalPlaySong(s.queue[0]);
    }
  };

  const executeLocalSeek = (seconds: number) => {
    if (get().isAudioStreamMode) {
      emitAudioSignal('SEEK', seconds);
    } else {
      webAudioPlayer.seek(seconds);
    }
    set({ currentTime: seconds });
    publishLocalPlaybackState(get, true);
    persistPlaybackSession(get, false);
  };

  const executeLocalSetVolume = (vol: number) => {
    const clamped = Math.min(1, Math.max(0, vol));
    webAudioPlayer.setVolume(clamped);
    if (get().isAudioStreamMode) {
      emitAudioSignal('VOLUME', clamped);
    }
    set({ volume: clamped, isMuted: clamped === 0 });
    publishLocalPlaybackState(get, true);
    persistPlaybackSession(get, false);
  };

  const executeLocalNext = async () => {
    const { queue, queueIndex, isShuffle, repeatMode, currentSong } = get();
    if (queue.length === 0) return;

    if (repeatMode === 'ONE' && currentSong) {
      executeLocalSeek(0);
      executeLocalResume();
      return;
    }

    let nextSong = computeNextSong(queue, queueIndex, currentSong, isShuffle, repeatMode);

    // If at end of queue, automatically fetch more recommendations immediately for continuous playback!
    if (!nextSong && currentSong) {
      await fetchAndAppendAutoRecommendations(currentSong, get, set);
      const updated = get();
      nextSong = computeNextSong(updated.queue, updated.queueIndex, updated.currentSong, isShuffle, repeatMode);
    }

    if (!nextSong) {
      set({ isPlaying: false });
      publishLocalPlaybackState(get, true);
      return;
    }

    const nextIndex = get().queue.findIndex((s) => s.id === nextSong!.id);
    const resolvedIndex = nextIndex >= 0 ? nextIndex : get().queueIndex;
    set({ queueIndex: resolvedIndex });
    executeLocalPlaySong(nextSong, true, 0, resolvedIndex);

    // Pre-fetch more recommendations in background when nearing end of queue (fewer than 5 songs remaining)
    const remaining = get().queue.length - 1 - resolvedIndex;
    if (remaining < 5 && repeatMode !== 'ONE') {
      void fetchAndAppendAutoRecommendations(nextSong, get, set);
    }
  };

  const executeLocalPrevious = () => {
    const { queue, queueIndex, currentTime } = get();
    if (currentTime > 3) {
      executeLocalSeek(0);
      return;
    }
    if (queue.length === 0) return;

    const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    set({ queueIndex: prevIndex });
    executeLocalPlaySong(queue[prevIndex]);
  };

  // Register cross-device playback session coordinator bridge
  registerPlaybackSessionBridge({
    onHaltLocalAudio: () => {
      webAudioPlayer.pause();
      emitAudioSignal('PAUSE');
      set({
        isPlaying: false,
        activeAudioVideoId: null,
        isAudioStreamMode: false,
      });
    },

    onMirrorRemotePlayback: (remote: SessionPlaybackState) => {
      const mirroredSong = remote.track ? sessionTrackToSong(remote.track) : null;
      const mirroredQueue = (remote.queue || []).map(sessionTrackToSong);
      set({
        currentSong: mirroredSong,
        isPlaying: remote.isPlaying,
        currentTime: remote.positionSec,
        duration: remote.durationSec || (mirroredSong ? Math.round(mirroredSong.durationMs / 1000) : 0),
        queue: mirroredQueue,
        queueIndex: remote.queueIndex,
        volume: remote.volume,
        isMuted: remote.isMuted,
        isShuffle: remote.isShuffle,
        repeatMode: remote.repeatMode,
        activeAudioVideoId: null,
        isAudioStreamMode: false,
      });
    },

    onCommand: (cmd: PendingCommand) => {
      const payload = cmd.payload || {};
      switch (cmd.type) {
        case 'PLAY_TRACK': {
          const rawTrack = payload.track as SessionTrack | undefined;
          const rawQueue = Array.isArray(payload.queue) ? (payload.queue as SessionTrack[]) : null;
          if (rawQueue) {
            const converted = rawQueue.map(sessionTrackToSong);
            const idx = rawTrack ? converted.findIndex((t) => t.id === rawTrack.id) : 0;
            set({ queue: converted, queueIndex: idx >= 0 ? idx : 0 });
          }
          if (rawTrack) {
            executeLocalPlaySong(sessionTrackToSong(rawTrack));
          }
          break;
        }
        case 'PLAY':
          executeLocalResume();
          break;
        case 'PAUSE':
          executeLocalPause();
          break;
        case 'TOGGLE_PLAY':
          if (get().isPlaying) executeLocalPause();
          else executeLocalResume();
          break;
        case 'SEEK':
          if (typeof payload.positionSec === 'number') {
            executeLocalSeek(payload.positionSec);
          }
          break;
        case 'NEXT':
          executeLocalNext();
          break;
        case 'PREVIOUS':
          executeLocalPrevious();
          break;
        case 'SET_VOLUME':
          if (typeof payload.volume === 'number') {
            executeLocalSetVolume(payload.volume);
          }
          break;
        case 'TOGGLE_SHUFFLE':
          set((state) => ({ isShuffle: !state.isShuffle }));
          publishLocalPlaybackState(get, true);
          break;
        case 'TOGGLE_REPEAT': {
          const modes: Array<'OFF' | 'ALL' | 'ONE'> = ['OFF', 'ALL', 'ONE'];
          set((state) => ({
            repeatMode: modes[(modes.indexOf(state.repeatMode) + 1) % modes.length],
          }));
          publishLocalPlaybackState(get, true);
          break;
        }
        case 'SET_QUEUE': {
          const rawQueue = Array.isArray(payload.queue) ? (payload.queue as SessionTrack[]) : [];
          const startIndex = typeof payload.startIndex === 'number' ? payload.startIndex : 0;
          const songs = rawQueue.map(sessionTrackToSong);
          set({ queue: songs, queueIndex: startIndex });
          if (songs[startIndex]) {
            executeLocalPlaySong(songs[startIndex]);
          }
          break;
        }
        case 'SYNC_TAKEOVER': {
          const rawTrack = payload.track as SessionTrack | undefined;
          const rawQueue = Array.isArray(payload.queue) ? (payload.queue as SessionTrack[]) : [];
          const convertedQueue = rawQueue.map(sessionTrackToSong);
          const pos = typeof payload.positionSec === 'number' ? payload.positionSec : 0;
          const shouldPlay = Boolean(payload.isPlaying);
          if (convertedQueue.length > 0) {
            set({
              queue: convertedQueue,
              queueIndex: typeof payload.queueIndex === 'number' ? payload.queueIndex : 0,
            });
          }
          if (rawTrack) {
            const convertedSong = sessionTrackToSong(rawTrack);
            if (shouldPlay) {
              executeLocalPlaySong(convertedSong, false, pos);
            } else {
              set({
                currentSong: convertedSong,
                isPlaying: false,
                currentTime: pos,
                duration: Math.round(convertedSong.durationMs / 1000) || 240,
              });
              publishLocalPlaybackState(get, true);
            }
          }
          break;
        }
        default:
          break;
      }
    },
  });

  // Sync with webAudioPlayer status events only when active locally with HTML5 Audio
  webAudioPlayer.subscribe((status) => {
    const state = get();
    if (!state) return;
    if (usePlaybackSessionStore.getState().isRemoteMode) return;
    if (state.isAudioStreamMode) return;
    const resolvedDuration =
      status.duration > 0
        ? status.duration
        : status.currentSong?.durationMs
          ? Math.round(status.currentSong.durationMs / 1000)
          : 0;
    set({
      isPlaying: status.isPlaying,
      currentTime: status.currentTime,
      duration: resolvedDuration,
      currentSong: status.currentSong,
      isAutoplayBlocked: status.isAutoplayBlocked,
    });
    trackProgress(status.currentSong || state.currentSong, resolvedDuration, status.isPlaying);
    if (status.isPlaying) {
      publishLocalPlaybackState(get, false);
      persistPlaybackSession(get, false);
    }
  });

  // Track ended handler for HTML5 Audio
  webAudioPlayer.setTrackEndedCallback(() => {
    if (usePlaybackSessionStore.getState().isRemoteMode) return;
    handleTrackEnded(get);
    const { repeatMode, playNext, currentSong } = get();
    if (repeatMode === 'ONE' && currentSong) {
      webAudioPlayer.seek(0);
      webAudioPlayer.resume();
    } else {
      playNext();
    }
  });

  // Media Session & remote control track navigation callbacks
  if (typeof (webAudioPlayer as any).setPreviousTrackCallback === 'function') {
    (webAudioPlayer as any).setPreviousTrackCallback(() => {
      if (usePlaybackSessionStore.getState().isRemoteMode) return;
      get().playPrevious();
    });
  }

  if (typeof (webAudioPlayer as any).setNextTrackCallback === 'function') {
    (webAudioPlayer as any).setNextTrackCallback(() => {
      if (usePlaybackSessionStore.getState().isRemoteMode) return;
      get().playNext();
    });
  }

  return {
    currentSong: null,
    isPlaying: false,
    autoplay: false,
    playbackIntent: 'none',
    userPlayInitiated: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    playbackSpeed: 1.0,
    isMuted: false,
    isShuffle: false,
    repeatMode: 'OFF',
    queue: [],
    queueIndex: -1,
    sessionPlayedSongIds: [],
    isNowPlayingOpen: false,
    isQueueOpen: false,
    isAutoplayBlocked: false,
    activeAudioVideoId: null,
    isAudioStreamMode: false,
    youtubeControlSignal: null,
    sleepTimerMinutes: null,
    sleepTimerRemainingSec: 0,
    isRestoringSession: false,
    isGeneratingQueue: false,

    persistCurrentSession: (immediate = false) => persistPlaybackSession(get, immediate),

    restorePlaybackSession: async () => {
      if (get().currentSong) return;
      set({ isRestoringSession: true });
      try {
        let sessionData: any = null;
        try {
          sessionData = await indexedDb.getMeta('playback_session');
        } catch {}

        if (!sessionData) {
          try {
            const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_playback_session') : null;
            if (raw) sessionData = JSON.parse(raw);
          } catch {}
        }

        if (!sessionData || !sessionData.currentSong) return;

        const restoredSong: Song = sessionData.currentSong;
        const restoredQueue: Song[] = Array.isArray(sessionData.queue) && sessionData.queue.length > 0
          ? sessionData.queue
          : [restoredSong];
        const restoredIndex = typeof sessionData.queueIndex === 'number' && sessionData.queueIndex >= 0
          ? sessionData.queueIndex
          : 0;
        const restoredPos = typeof sessionData.playbackPositionSec === 'number' ? sessionData.playbackPositionSec : 0;
        const restoredDuration = restoredSong.durationMs ? Math.round(restoredSong.durationMs / 1000) : 0;

        set({
          currentSong: restoredSong,
          queue: restoredQueue,
          queueIndex: restoredIndex,
          currentTime: restoredPos,
          duration: restoredDuration,
          sessionPlayedSongIds: Array.isArray(sessionData.sessionPlayedSongIds)
            ? sessionData.sessionPlayedSongIds
            : [restoredSong.id],
          isShuffle: Boolean(sessionData.isShuffle),
          repeatMode: sessionData.repeatMode || 'OFF',
          volume: typeof sessionData.volume === 'number' ? sessionData.volume : 0.85,
          isPlaying: false,
          autoplay: false,
          playbackIntent: 'none',
          userPlayInitiated: false,
          activeAudioVideoId: sessionData.activeAudioVideoId || (restoredSong.videoId ? restoredSong.videoId : null),
          isAudioStreamMode: Boolean(sessionData.isAudioStreamMode || restoredSong.videoId),
        });

        publishLocalPlaybackState(get, true);

        // Requirement 5: If restored queue is empty or has fewer than 5 upcoming songs, replenish automatically
        const upcomingCount = restoredQueue.length - 1 - restoredIndex;
        if (upcomingCount < 5 && restoredSong) {
          void fetchAndAppendAutoRecommendations(restoredSong, get, set);
        }
      } catch (err) {
        console.error('Failed to restore playback session:', err);
      } finally {
        set({ isRestoringSession: false });
      }
    },

    unlockAudio: () => webAudioPlayer.unlockAudio(),

    clearSleepTimer: () => {
      if (sleepTimerIntervalId !== null) {
        clearInterval(sleepTimerIntervalId);
        sleepTimerIntervalId = null;
      }
      sleepTimerEndsAtMs = null;
      set({ sleepTimerMinutes: null, sleepTimerRemainingSec: 0 });
    },

    setSleepTimer: (minutes: number) => {
      const exactMinutes = Math.trunc(minutes);
      if (!Number.isFinite(exactMinutes) || exactMinutes <= 0) {
        get().clearSleepTimer();
        return;
      }
      if (sleepTimerIntervalId !== null) {
        clearInterval(sleepTimerIntervalId);
        sleepTimerIntervalId = null;
      }
      const totalSec = exactMinutes * 60;
      sleepTimerEndsAtMs = Date.now() + totalSec * 1000;
      set({
        sleepTimerMinutes: exactMinutes,
        sleepTimerRemainingSec: totalSec,
      });
      sleepTimerIntervalId = setInterval(() => {
        if (sleepTimerEndsAtMs === null) return;
        const remainingSec = Math.max(0, Math.ceil((sleepTimerEndsAtMs - Date.now()) / 1000));
        if (remainingSec <= 0) {
          get().clearSleepTimer();
          executeLocalPause();
          return;
        }
        set({ sleepTimerRemainingSec: remainingSec });
      }, 1000);
    },

    setSleepTimerUntilTime: (time24: string) => {
      const parts = time24.split(':');
      const targetHour = parseInt(parts[0] || '', 10);
      const targetMinute = parseInt(parts[1] || '', 10);
      if (isNaN(targetHour) || isNaN(targetMinute)) return;
      const now = new Date();
      const target = new Date(now);
      target.setHours(Math.min(23, Math.max(0, targetHour)), Math.min(59, Math.max(0, targetMinute)), 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      const diffSec = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000));
      const approxMinutes = Math.max(1, Math.ceil(diffSec / 60));
      if (sleepTimerIntervalId !== null) {
        clearInterval(sleepTimerIntervalId);
        sleepTimerIntervalId = null;
      }
      sleepTimerEndsAtMs = target.getTime();
      set({
        sleepTimerMinutes: approxMinutes,
        sleepTimerRemainingSec: diffSec,
      });
      sleepTimerIntervalId = setInterval(() => {
        if (sleepTimerEndsAtMs === null) return;
        const remainingSec = Math.max(0, Math.ceil((sleepTimerEndsAtMs - Date.now()) / 1000));
        if (remainingSec <= 0) {
          get().clearSleepTimer();
          executeLocalPause();
          return;
        }
        set({ sleepTimerRemainingSec: remainingSec });
      }, 1000);
    },

    playSong: (song: Song, crossfade = false) => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('PLAY_TRACK', {
          track: songToSessionTrack(song),
        });
        return;
      }
      set({
        queue: [song],
        queueIndex: 0,
        sessionPlayedSongIds: [song.id],
      });
      executeLocalPlaySong(song, crossfade, 0, 0);

      // Automatically generate continuous queue in the background
      void fetchAndAppendAutoRecommendations(song, get, set);
    },

    togglePlay: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand(get().isPlaying ? 'PAUSE' : 'PLAY');
        return;
      }
      if (get().isPlaying) {
        executeLocalPause();
      } else {
        executeLocalResume();
      }
    },

    pause: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('PAUSE');
        return;
      }
      executeLocalPause();
    },

    resume: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('PLAY');
        return;
      }
      executeLocalResume();
    },

    seek: (seconds: number) => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('SEEK', { positionSec: Math.max(0, seconds) });
        set({ currentTime: Math.max(0, seconds) });
        return;
      }
      executeLocalSeek(seconds);
    },

    setVolume: (vol: number) => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        const clamped = Math.min(1, Math.max(0, vol));
        set({ volume: clamped, isMuted: clamped === 0 });
        void session.sendRemoteCommand('SET_VOLUME', { volume: clamped, isMuted: clamped === 0 });
        return;
      }
      executeLocalSetVolume(vol);
    },

    setPlaybackSpeed: (speed: number) => {
      const clamped = Math.min(2.0, Math.max(0.5, speed));
      webAudioPlayer.setPlaybackRate(clamped);
      set({ playbackSpeed: clamped });
    },

    toggleMute: () => {
      const nextVol = get().isMuted ? 0.85 : 0;
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        set({ isMuted: !get().isMuted, volume: nextVol });
        void session.sendRemoteCommand('SET_VOLUME', { volume: nextVol, isMuted: nextVol === 0 });
        return;
      }
      executeLocalSetVolume(nextVol);
    },

    setQueue: (songs: Song[], startIndex = 0) => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('SET_QUEUE', {
          queue: songs.slice(0, 50).map(songToSessionTrack),
          startIndex,
        });
        return;
      }
      const targetIndex = Math.max(0, Math.min(startIndex, songs.length - 1));
      const target = songs[targetIndex] || songs[0];
      set({
        queue: songs,
        queueIndex: targetIndex,
        sessionPlayedSongIds: target ? [target.id] : [],
      });
      if (target) {
        executeLocalPlaySong(target, false, 0, targetIndex);
        if (songs.length - 1 - targetIndex < 5) {
          void fetchAndAppendAutoRecommendations(target, get, set);
        }
      }
    },

    playNext: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('NEXT');
        return;
      }
      executeLocalNext();
    },

    playPrevious: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('PREVIOUS');
        return;
      }
      executeLocalPrevious();
    },

    toggleShuffle: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('TOGGLE_SHUFFLE');
        return;
      }
      set((state) => ({ isShuffle: !state.isShuffle }));
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    },

    toggleRepeat: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('TOGGLE_REPEAT');
        return;
      }
      set((state) => {
        const modes: Array<'OFF' | 'ALL' | 'ONE'> = ['OFF', 'ALL', 'ONE'];
        const nextMode = modes[(modes.indexOf(state.repeatMode) + 1) % modes.length];
        return { repeatMode: nextMode };
      });
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    },

    setNowPlayingOpen: (open: boolean) => set({ isNowPlayingOpen: open }),

    setQueueOpen: (open: boolean) => set({ isQueueOpen: open }),

    getNextSong: () => {
      const { queue, queueIndex, currentSong, isShuffle, repeatMode } = get();
      return computeNextSong(queue, queueIndex, currentSong, isShuffle, repeatMode);
    },

    playTrackAt: (index: number) => {
      const { queue, repeatMode } = get();
      if (index < 0 || index >= queue.length) return;
      const target = queue[index];
      executeLocalPlaySong(target, true, 0, index);
      const remaining = queue.length - 1 - index;
      if (remaining < 5 && repeatMode !== 'ONE') {
        void fetchAndAppendAutoRecommendations(target, get, set);
      }
    },

    playNextInQueue: (song: Song) => {
      const { queue, queueIndex, playSong } = get();
      if (queue.length === 0) {
        playSong(song);
        return;
      }
      const curIdx = Math.max(0, queueIndex);
      // Remove any existing duplicate later in the queue
      const newQueue = queue.filter((s, idx) => s.id !== song.id || idx === curIdx);
      newQueue.splice(curIdx + 1, 0, song);
      set({ queue: newQueue });
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    },

    startSongMix: async (song: Song) => {
      get().playSong(song);
      set({ sessionPlayedSongIds: [song.id] });
      await fetchAndAppendAutoRecommendations(song, get, set);
    },

    addToQueue: (song: Song) => {
      const { queue } = get();
      if (queue.some((s) => s.id === song.id)) return;
      set({ queue: [...queue, song] });
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    },

    removeFromQueue: (index: number) => {
      const { queue, queueIndex } = get();
      if (index < 0 || index >= queue.length) return;
      const newQueue = queue.filter((_, idx) => idx !== index);
      let newIndex = queueIndex;
      if (index < queueIndex) {
        newIndex = Math.max(0, queueIndex - 1);
      } else if (index === queueIndex) {
        newIndex = Math.min(queueIndex, Math.max(0, newQueue.length - 1));
      }
      set({ queue: newQueue, queueIndex: newIndex });
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    },

    reorderQueue: (fromIndex: number, toIndex: number) => {
      const { queue, queueIndex } = get();
      if (
        fromIndex < 0 ||
        fromIndex >= queue.length ||
        toIndex < 0 ||
        toIndex >= queue.length ||
        fromIndex === toIndex
      ) {
        return;
      }
      const newQueue = [...queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);

      let newQueueIndex = queueIndex;
      if (queueIndex === fromIndex) {
        newQueueIndex = toIndex;
      } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
        newQueueIndex = queueIndex - 1;
      } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
        newQueueIndex = queueIndex + 1;
      }

      set({ queue: newQueue, queueIndex: newQueueIndex });
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    },

    clearQueue: () => {
      const { currentSong } = get();
      if (currentSong) {
        set({ queue: [currentSong], queueIndex: 0 });
        void fetchAndAppendAutoRecommendations(currentSong, get, set);
      } else {
        set({ queue: [], queueIndex: -1 });
      }
      publishLocalPlaybackState(get, true);
      persistPlaybackSession(get, true);
    },

    fetchMoreRecommendations: async () => {
      const { currentSong } = get();
      if (currentSong) {
        await fetchAndAppendAutoRecommendations(currentSong, get, set);
      }
    },

    clearSessionHistory: () => {
      const { currentSong } = get();
      set({ sessionPlayedSongIds: currentSong ? [currentSong.id] : [] });
      persistPlaybackSession(get, true);
    },

    syncExternalAudioState: (currentTime, duration, isPlaying) => {
      if (usePlaybackSessionStore.getState().isRemoteMode) return;
      const s = get();
      const currentSong = s.currentSong;
      const currentDuration =
        typeof duration === 'number' && !isNaN(duration) && duration > 0 ? duration : s.duration;
      const activePlaying = typeof isPlaying === 'boolean' ? isPlaying : s.isPlaying;

      set((prev) => ({
        currentTime:
          typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0
            ? currentTime
            : prev.currentTime,
        duration: currentDuration,
        isPlaying: activePlaying,
      }));

      trackProgress(currentSong, currentDuration, activePlaying);

      if (activePlaying) {
        publishLocalPlaybackState(get, false);
        persistPlaybackSession(get, false);
      } else if (isPlaying === false) {
        publishLocalPlaybackState(get, true);
        persistPlaybackSession(get, true);
      }
    },

    handleExternalAudioEnded: () => {
      if (usePlaybackSessionStore.getState().isRemoteMode) return;
      handleTrackEnded(get);
      const { repeatMode, currentSong, queue } = get();
      if (repeatMode === 'ONE' && currentSong) {
        executeLocalSeek(0);
        executeLocalResume();
      } else if (queue.length > 0) {
        executeLocalNext();
      } else {
        set({ isPlaying: false });
        publishLocalPlaybackState(get, true);
      }
    },

    handleExternalAudioError: () => {
      const s = get();
      const song = s.currentSong;
      if (!song) {
        set({ isPlaying: false });
        return;
      }

      const failedSet = failedVideoIdsBySong.get(song.id) ?? new Set<string>();
      if (s.activeAudioVideoId) {
        failedSet.add(s.activeAudioVideoId);
      }
      failedVideoIdsBySong.set(song.id, failedSet);

      if (failedSet.size < 2) {
        const exclude = Array.from(failedSet).join(',');
        fetch(
          `/api/search/resolve-stream?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(
            song.artist
          )}&excludeVideoId=${encodeURIComponent(exclude)}`
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (usePlaybackSessionStore.getState().isRemoteMode || get().currentSong?.id !== song.id) return;
            if (data?.videoId && !failedSet.has(data.videoId)) {
              set({
                currentSong: { ...song, videoId: data.videoId },
                activeAudioVideoId: data.videoId,
                isAudioStreamMode: true,
                isPlaying: true,
                duration: Math.round((data.durationMs || song.durationMs || 240000) / 1000),
              });
              publishLocalPlaybackState(get, true);
            } else {
              void fallbackToDirectAudio(song, false, get, set);
            }
          })
          .catch(() => {
            void fallbackToDirectAudio(song, false, get, set);
          });
        return;
      }

      void fallbackToDirectAudio(song, false, get, set);
    },

    pruneQueueByLanguage: () => {
      const userPreferredLangs = useRecommendationStore.getState().preferences?.preferredLanguages || [];
      if (userPreferredLangs.length === 0) return;
      const { queue, queueIndex } = get();
      if (!queue || queue.length === 0) return;

      const current = queue[queueIndex];
      const validQueue = queue.filter((song, idx) => {
        // Keep current active song to avoid abrupt interruption
        if (idx === queueIndex) return true;
        return isSongLanguageEligibleClient(song, userPreferredLangs);
      });

      const newIndex = current ? validQueue.findIndex((s) => s.id === current.id) : 0;
      set({
        queue: validQueue,
        queueIndex: Math.max(0, newIndex)
      });
      persistPlaybackSession(get, true);
    },

    resetForGuest: () => {
      try {
        emitAudioSignal('PAUSE');
        webAudioPlayer.pause();
      } catch {}
      try {
        localStorage.removeItem('syncwave_playback_session');
      } catch {}
      set({
        isPlaying: false,
        autoplay: false,
        playbackIntent: 'none',
        userPlayInitiated: false,
        currentSong: null,
        queue: [],
        queueIndex: 0,
        currentTime: 0,
        activeAudioVideoId: null,
        isAudioStreamMode: false,
      });
    },
  };
});
