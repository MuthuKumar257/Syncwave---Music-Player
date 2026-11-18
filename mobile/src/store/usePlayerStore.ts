import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '../api/types';
import { audioManager, PlaybackStatus } from '../audio/audioManager';
import { recommendationApi } from '../api/recommendationApi';
import { useRecommendationStore } from './useRecommendationStore';
import {
  PendingCommand,
  registerMobilePlaybackSessionBridge,
  SessionPlaybackState,
  SessionTrack,
  sessionTrackToMobileTrack,
  trackToSessionTrack,
  usePlaybackSessionStore,
} from './usePlaybackSessionStore';

export function normalizeMobileLanguage(lang?: string | null): string {
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

export function isTrackLanguageEligible(track: { language?: string | null }, userLanguages: (string | null | undefined)[]): boolean {
  if (!userLanguages || userLanguages.length === 0) return false;
  const normUserLangs = userLanguages.map(normalizeMobileLanguage).filter(Boolean);
  if (normUserLangs.length === 0) return false;

  const trackLang = normalizeMobileLanguage(track.language);
  if (!trackLang) return false;
  return normUserLangs.includes(trackLang);
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  autoplay: boolean;
  playbackIntent: 'none' | 'play' | 'pause';
  playbackStatus: PlaybackStatus;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  userPlayInitiated: boolean;
  position: number;
  duration: number;
  playbackSpeed: number;
  queue: Track[];
  queueIndex: number;
  isShuffle: boolean;
  repeatMode: 'OFF' | 'ALL' | 'ONE';
  isMiniPlayerVisible: boolean;
  isQueueSheetVisible: boolean;
  isSleepTimerModalVisible: boolean;
  sleepTimerMinutes: number | null;
  sleepTimerRemainingSec: number;
  sessionPlayedTrackIds: string[];
  isRestoringSession: boolean;
  isGeneratingQueue: boolean;

  // Actions
  restorePlaybackSession: () => Promise<void>;
  persistCurrentSession: (immediate?: boolean) => void;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setPlaybackSpeed: (speed: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setQueue: (tracks: Track[]) => void;
  addToQueue: (track: Track) => void;
  addTracksToQueue: (tracks: Track[]) => void;
  playNextInQueue: (track: Track) => void;
  startSongMix: (track: Track) => Promise<void>;
  setPlaybackProgress: (position: number, duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTrack: (track: Track | null) => void;
  getNextTrack: () => Track | null;
  playTrackAt: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  clearSessionHistory: () => void;
  pruneQueueByLanguage: () => void;
  fetchMoreRecommendations: () => Promise<void>;
  setQueueSheetVisible: (visible: boolean) => void;
  setSleepTimerModalVisible: (visible: boolean) => void;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  resetForGuest: () => Promise<void>;
}

export function computeNextMobileTrack(
  queue: Track[],
  queueIndex: number,
  currentTrack: Track | null,
  isShuffle: boolean,
  repeatMode: 'OFF' | 'ALL' | 'ONE'
): Track | null {
  if (!queue || queue.length === 0) return null;

  let currentIndex = queueIndex;
  if (currentTrack && (currentIndex < 0 || currentIndex >= queue.length || queue[currentIndex]?.id !== currentTrack.id)) {
    const found = queue.findIndex((t) => t.id === currentTrack.id);
    if (found !== -1) currentIndex = found;
  }

  if (repeatMode === 'ONE' && currentTrack) {
    return currentTrack;
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

const syncActiveToServer = (get: () => PlayerState) => {
  const session = usePlaybackSessionStore.getState();
  if (!session.isConnected || session.isRemoteMode) return;
  const s = get();
  void session.publishActiveState({
    track: s.currentTrack ? trackToSessionTrack(s.currentTrack) : null,
    isPlaying: s.isPlaying,
    positionSec: Math.max(0, Math.round(s.position)),
    durationSec: Math.max(0, Math.round(s.duration)),
    queue: s.queue.slice(0, 50).map(trackToSessionTrack),
    queueIndex: s.queueIndex,
    isShuffle: s.isShuffle,
    repeatMode: s.repeatMode,
  });
};

const PLAYBACK_SESSION_STORAGE_KEY = '@syncwave_playback_session';

export interface MobilePersistedSession {
  lastPlayedSongId?: string;
  currentTrack: Track | null;
  positionSec: number;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  sessionPlayedTrackIds: string[];
  isShuffle: boolean;
  repeatMode: 'OFF' | 'ALL' | 'ONE';
  savedAt: number;
}

let lastMobileSessionPersistAt = 0;
let persistMobileSessionTimeoutId: ReturnType<typeof setTimeout> | null = null;

const persistMobilePlaybackSession = (get: () => PlayerState, immediate = false) => {
  const save = async () => {
    try {
      const state = get();
      if (!state.currentTrack && state.queue.length === 0) return;
      const sessionData: MobilePersistedSession = {
        lastPlayedSongId: state.currentTrack?.id,
        currentTrack: state.currentTrack,
        positionSec: Math.max(0, Math.round(state.position)),
        isPlaying: false, // restore as paused
        queue: state.queue,
        queueIndex: state.queueIndex,
        sessionPlayedTrackIds: state.sessionPlayedTrackIds || [],
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(PLAYBACK_SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch {}
  };

  if (immediate) {
    if (persistMobileSessionTimeoutId) {
      clearTimeout(persistMobileSessionTimeoutId);
      persistMobileSessionTimeoutId = null;
    }
    void save();
    lastMobileSessionPersistAt = Date.now();
    return;
  }

  const now = Date.now();
  if (now - lastMobileSessionPersistAt < 2000) {
    if (!persistMobileSessionTimeoutId) {
      persistMobileSessionTimeoutId = setTimeout(() => {
        persistMobileSessionTimeoutId = null;
        void save();
        lastMobileSessionPersistAt = Date.now();
      }, 2000);
    }
    return;
  }

  lastMobileSessionPersistAt = now;
  void save();
};

let mobileSleepTimerIntervalId: any = null;
let mobileSleepTimerEndsAt: number | null = null;

let isFetchingAutoQueue = false;

const fetchAndAppendAutoRecommendations = async (
  referenceTrack: Track,
  get: () => PlayerState,
  set: (partial: Partial<PlayerState> | ((state: PlayerState) => Partial<PlayerState>)) => void
) => {
  if (isFetchingAutoQueue) return;
  isFetchingAutoQueue = true;
  set({ isGeneratingQueue: true });
  console.log(`[usePlayerStore Mobile] Queue generation started for track: "${referenceTrack.title}" (${referenceTrack.id})`);

  try {
    const s = get();
    const playedSet = new Set(s.sessionPlayedTrackIds || []);
    playedSet.add(referenceTrack.id);
    const existingQueueIds = new Set(s.queue.map((t) => t.id));
    const excludeIds = Array.from(new Set([...playedSet, ...existingQueueIds]));

    const recommendations = await recommendationApi.getAutoQueueRecommendations({
      songId: referenceTrack.id,
      songTitle: referenceTrack.title,
      artist: referenceTrack.artist,
      director: referenceTrack.composer,
      language: referenceTrack.language,
      excludeIds,
      limit: 20,
    });

    console.log(`[usePlayerStore Mobile] Recommendation API response received: ${recommendations.length} tracks`);

    const userLangs = useRecommendationStore.getState().selectedLanguages?.length > 0
      ? useRecommendationStore.getState().selectedLanguages
      : useRecommendationStore.getState().preferences?.preferredLanguages || [];

    const validRecommendations = recommendations.filter((item: Track) => {
      if (userLangs.length > 0 && !isTrackLanguageEligible(item, userLangs)) {
        console.log(`[usePlayerStore Mobile] Dropped recommendation "${item.title}" outside user languages (${item.language})`);
        return false;
      }
      return true;
    });

    const freshQueue = get().queue;
    const freshQueueIds = new Set(freshQueue.map((t) => t.id));
    const currentPlayed = new Set(get().sessionPlayedTrackIds || []);
    const seenCandidateIds = new Set<string>();

    const uniqueNew: Track[] = [];
    let duplicatesFiltered = 0;

    for (const item of validRecommendations) {
      if (freshQueueIds.has(item.id) || currentPlayed.has(item.id) || seenCandidateIds.has(item.id)) {
        duplicatesFiltered++;
      } else {
        seenCandidateIds.add(item.id);
        uniqueNew.push(item);
      }
    }

    console.log(`[usePlayerStore Mobile] Number of duplicate songs filtered: ${duplicatesFiltered}`);
    console.log(`[usePlayerStore Mobile] Number of valid songs added to queue: ${uniqueNew.length}`);

    // Fallback: If recommendation API returned insufficient tracks, replenish from shuffled catalogue in user's languages
    if (uniqueNew.length < 5) {
      try {
        const baseFeed = await recommendationApi.getBaseFeed();
        const catalogCandidates: Track[] = [
          ...(baseFeed.allAvailable || []),
          ...(baseFeed.recommended || []),
          ...(baseFeed.trending || []),
          ...(baseFeed.popularSongs || [])
        ];

        const eligibleCatalog = catalogCandidates.filter((item: Track) => {
          if (userLangs.length > 0 && !isTrackLanguageEligible(item, userLangs)) {
            return false;
          }
          return true;
        });

        // Filter out tracks already in the active queue, already added to uniqueNew, or in currentPlayed
        let pool = eligibleCatalog.filter(
          (t) => !freshQueueIds.has(t.id) && !seenCandidateIds.has(t.id) && !currentPlayed.has(t.id)
        );

        // If eligible unplayed catalogue is exhausted, reset candidate played-exclusion so songs can cycle
        if (pool.length === 0) {
          console.log('[usePlayerStore Mobile] Eligible catalogue exhausted. Cycling shuffled catalogue songs.');
          pool = eligibleCatalog.filter(
            (t) => !freshQueueIds.has(t.id) && !seenCandidateIds.has(t.id) && t.id !== referenceTrack.id
          );
        }

        // Shuffle pool for varied listening
        const shuffledPool = pool.sort(() => Math.random() - 0.5);
        for (const item of shuffledPool) {
          if (!seenCandidateIds.has(item.id)) {
            seenCandidateIds.add(item.id);
            uniqueNew.push(item);
            if (uniqueNew.length >= 10) break;
          }
        }
      } catch (catErr) {
        console.warn('[usePlayerStore Mobile] Catalogue fallback fetch error:', catErr);
      }
    }

    if (uniqueNew.length > 0) {
      set({
        queue: [...freshQueue, ...uniqueNew],
        isGeneratingQueue: false
      });
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    } else {
      set({ isGeneratingQueue: false });
    }
  } catch (err: any) {
    console.error('[usePlayerStore Mobile] Queue generation failure:', err?.message || err);
    set({ isGeneratingQueue: false });
  } finally {
    isFetchingAutoQueue = false;
    set({ isGeneratingQueue: false });
  }
};

interface MobilePlayTrackingState {
  currentTrack: Track | null;
  accumulatedListeningSec: number;
  lastProgressTimestamp: number;
  hasCountedPlay: boolean;
  isReplay: boolean;
  unreportedDurationSec: number;
}

const mobilePlayTracking: MobilePlayTrackingState = {
  currentTrack: null,
  accumulatedListeningSec: 0,
  lastProgressTimestamp: 0,
  hasCountedPlay: false,
  isReplay: false,
  unreportedDurationSec: 0,
};

export const usePlayerStore = create<PlayerState>((set, get) => {
  const executeLocalPlayTrack = async (
    track: Track,
    queue: Track[] = [track],
    startSec = 0,
    forcedIndex?: number
  ) => {
    const prevTrack = get().currentTrack;
    const isReplay = prevTrack?.id === track.id;

    if (prevTrack && prevTrack.id !== track.id) {
      if (mobilePlayTracking.accumulatedListeningSec < 15) {
        recommendationApi.recordListeningStat({
          songId: prevTrack.id,
          songName: prevTrack.title,
          skipCount: 1,
        }).catch(() => {});
      }
      if (mobilePlayTracking.unreportedDurationSec > 0) {
        recommendationApi.recordListeningStat({
          songId: prevTrack.id,
          songName: prevTrack.title,
          totalListeningDurationMs: Math.round(mobilePlayTracking.unreportedDurationSec * 1000),
        }).catch(() => {});
      }
    }

    mobilePlayTracking.currentTrack = track;
    mobilePlayTracking.accumulatedListeningSec = 0;
    mobilePlayTracking.lastProgressTimestamp = Date.now();
    mobilePlayTracking.hasCountedPlay = false;
    mobilePlayTracking.isReplay = isReplay;
    mobilePlayTracking.unreportedDurationSec = 0;

    const targetQueue = queue.length > 0 ? queue : [track];
    const index =
      typeof forcedIndex === 'number' && forcedIndex >= 0
        ? forcedIndex
        : targetQueue.findIndex((t) => t.id === track.id);

    const currentSessionIds = get().sessionPlayedTrackIds || [];
    const updatedSessionIds = currentSessionIds.includes(track.id)
      ? currentSessionIds
      : [...currentSessionIds, track.id];

    set({
      currentTrack: track,
      queue: targetQueue,
      queueIndex: index >= 0 ? index : 0,
      isPlaying: true,
      playbackIntent: 'play',
      playbackStatus: 'LOADING',
      userPlayInitiated: true,
      isMiniPlayerVisible: true,
      duration: Math.round(track.durationMs / 1000),
      position: startSec,
      sessionPlayedTrackIds: updatedSessionIds,
    });

    await audioManager.playTrack(track, targetQueue);
    if (startSec > 0) {
      await audioManager.seekTo(startSec);
    }

    syncActiveToServer(get);
    persistMobilePlaybackSession(get, true);

    // Auto-fetch continuous queue if playing single song or fewer than 5 upcoming songs
    const remainingUpcoming = targetQueue.length - 1 - (index >= 0 ? index : 0);
    if (remainingUpcoming < 5) {
      void fetchAndAppendAutoRecommendations(track, get, set);
    }

    // Play count and listening duration are recorded in setPlaybackProgress upon meeting the >=30s threshold
  };

  const executeLocalTogglePlayPause = async () => {
    const s = get();
    const nextPlaying = !s.isPlaying;
    set({
      isPlaying: nextPlaying,
      playbackIntent: nextPlaying ? 'play' : 'pause',
      playbackStatus: nextPlaying ? 'PLAYING' : 'PAUSED',
      userPlayInitiated: nextPlaying
    });
    if (nextPlaying) {
      if (typeof audioManager.resume === 'function') {
        await audioManager.resume();
      } else {
        await audioManager.playTrack(s.currentTrack!, s.queue);
        if (s.position > 0) {
          await audioManager.seekTo(s.position);
        }
      }
    } else {
      if (typeof audioManager.pause === 'function') {
        await audioManager.pause();
      } else {
        await audioManager.togglePlayPause();
      }
    }
    syncActiveToServer(get);
    persistMobilePlaybackSession(get, true);
  };

  const executeLocalNext = async () => {
    const { queue, queueIndex, isShuffle, repeatMode, currentTrack } = get();
    if (queue.length === 0) return;

    if (repeatMode === 'ONE' && currentTrack) {
      await audioManager.seekTo(0);
      set({ position: 0 });
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
      return;
    }

    const nextTrack = computeNextMobileTrack(queue, queueIndex, currentTrack, isShuffle, repeatMode);
    if (!nextTrack) {
      // Reached the end of queue! Fetch auto recommendations and continue seamlessly
      if (currentTrack) {
        await fetchAndAppendAutoRecommendations(currentTrack, get, set);
        const refreshedQueue = get().queue;
        const refreshedNext = computeNextMobileTrack(refreshedQueue, queueIndex, currentTrack, isShuffle, repeatMode);
        if (refreshedNext) {
          const nextIndex = refreshedQueue.findIndex((t) => t.id === refreshedNext.id);
          const currentSessionIds = get().sessionPlayedTrackIds || [];
          const updatedSessionIds = currentSessionIds.includes(refreshedNext.id)
            ? currentSessionIds
            : [...currentSessionIds, refreshedNext.id];

          set({
            currentTrack: refreshedNext,
            queueIndex: nextIndex >= 0 ? nextIndex : queueIndex,
            isPlaying: true,
            sessionPlayedTrackIds: updatedSessionIds,
          });
          await audioManager.playTrack(refreshedNext, refreshedQueue);
          syncActiveToServer(get);
          persistMobilePlaybackSession(get, true);
        }
      }
      return;
    }

    const nextIndex = queue.findIndex((t) => t.id === nextTrack.id);
    const currentSessionIds = get().sessionPlayedTrackIds || [];
    const updatedSessionIds = currentSessionIds.includes(nextTrack.id)
      ? currentSessionIds
      : [...currentSessionIds, nextTrack.id];

    set({
      currentTrack: nextTrack,
      queueIndex: nextIndex >= 0 ? nextIndex : queueIndex,
      isPlaying: true,
      sessionPlayedTrackIds: updatedSessionIds,
    });
    await audioManager.playTrack(nextTrack, queue);
    syncActiveToServer(get);
    persistMobilePlaybackSession(get, true);

    // Pre-fetch more recommendations when queue has fewer than 5 remaining tracks
    const remaining = queue.length - 1 - (nextIndex >= 0 ? nextIndex : queueIndex);
    if (remaining < 5 && repeatMode !== 'ONE') {
      void fetchAndAppendAutoRecommendations(nextTrack, get, set);
    }
  };

  const executeLocalPrevious = async () => {
    const { queue, queueIndex, position } = get();
    if (position > 3) {
      await audioManager.seekTo(0);
      set({ position: 0 });
      syncActiveToServer(get);
      return;
    }
    if (queue.length === 0) return;

    const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      set({ currentTrack: prevTrack, queueIndex: prevIndex, isPlaying: true });
      await audioManager.playTrack(prevTrack, queue);
      syncActiveToServer(get);
    }
  };

  registerMobilePlaybackSessionBridge({
    onHaltLocalAudio: () => {
      if (typeof audioManager.pause === 'function') {
        void audioManager.pause();
      }
      set({ isPlaying: false });
    },
    onMirrorRemotePlayback: (remote: SessionPlaybackState) => {
      const mirroredTrack = remote.track ? sessionTrackToMobileTrack(remote.track) : null;
      const mirroredQueue = (remote.queue || []).map(sessionTrackToMobileTrack);
      set({
        currentTrack: mirroredTrack,
        isPlaying: remote.isPlaying,
        position: remote.positionSec,
        duration:
          remote.durationSec || (mirroredTrack ? Math.round(mirroredTrack.durationMs / 1000) : 0),
        queue: mirroredQueue,
        queueIndex: remote.queueIndex,
        isShuffle: remote.isShuffle,
        repeatMode: remote.repeatMode,
        isMiniPlayerVisible: mirroredTrack !== null || usePlaybackSessionStore.getState().isRemoteMode,
      });
    },
    onCommand: (cmd: PendingCommand) => {
      const payload = cmd.payload || {};
      switch (cmd.type) {
        case 'PLAY_TRACK': {
          const rawTrack = payload.track as SessionTrack | undefined;
          const rawQueue = Array.isArray(payload.queue)
            ? (payload.queue as SessionTrack[]).map(sessionTrackToMobileTrack)
            : undefined;
          if (rawTrack) {
            void executeLocalPlayTrack(sessionTrackToMobileTrack(rawTrack), rawQueue);
          }
          break;
        }
        case 'PLAY':
          if (!get().isPlaying) {
            set({ isPlaying: true });
            if (typeof audioManager.resume === 'function') {
              void audioManager.resume();
            } else {
              void audioManager.togglePlayPause();
            }
            syncActiveToServer(get);
          }
          break;
        case 'PAUSE':
          if (get().isPlaying) {
            set({ isPlaying: false });
            if (typeof audioManager.pause === 'function') {
              void audioManager.pause();
            } else {
              void audioManager.togglePlayPause();
            }
            syncActiveToServer(get);
          }
          break;
        case 'TOGGLE_PLAY':
          void executeLocalTogglePlayPause();
          break;
        case 'SEEK':
          if (typeof payload.positionSec === 'number') {
            set({ position: payload.positionSec });
            void audioManager.seekTo(payload.positionSec);
            syncActiveToServer(get);
          }
          break;
        case 'NEXT':
          void executeLocalNext();
          break;
        case 'PREVIOUS':
          void executeLocalPrevious();
          break;
        case 'TOGGLE_SHUFFLE':
          set((state) => ({ isShuffle: !state.isShuffle }));
          syncActiveToServer(get);
          break;
        case 'TOGGLE_REPEAT': {
          const modes: Array<'OFF' | 'ALL' | 'ONE'> = ['OFF', 'ALL', 'ONE'];
          const current = get().repeatMode;
          set({ repeatMode: modes[(modes.indexOf(current) + 1) % modes.length] });
          syncActiveToServer(get);
          break;
        }
        case 'SYNC_TAKEOVER': {
          const rawTrack = payload.track as SessionTrack | undefined;
          const rawQueue = Array.isArray(payload.queue)
            ? (payload.queue as SessionTrack[]).map(sessionTrackToMobileTrack)
            : [];
          const pos = typeof payload.positionSec === 'number' ? payload.positionSec : 0;
          const shouldPlay = Boolean(payload.isPlaying);
          if (rawTrack) {
            const converted = sessionTrackToMobileTrack(rawTrack);
            if (shouldPlay) {
              void executeLocalPlayTrack(converted, rawQueue.length > 0 ? rawQueue : [converted], pos);
            } else {
              set({
                currentTrack: converted,
                queue: rawQueue.length > 0 ? rawQueue : [converted],
                isPlaying: false,
                position: pos,
                duration: Math.round(converted.durationMs / 1000),
                isMiniPlayerVisible: true,
              });
              syncActiveToServer(get);
            }
          }
          break;
        }
        default:
          break;
      }
    },
  });

  if (typeof audioManager.setListener === 'function') {
    audioManager.setListener({
      onPlaybackStatusChange: (status, isPlaying) => {
        set({ playbackStatus: status, isPlaying });
      },
      onProgressUpdate: (pos, dur) => {
        get().setPlaybackProgress(pos, dur);
      },
      onQueueEnded: () => {
        const s = get();
        if (s.repeatMode === 'ONE' && s.currentTrack) {
          void audioManager.seekTo(0);
          void audioManager.resume();
        } else {
          void get().playNext();
        }
      },
      onTrackChanged: (trackIndex) => {
        const s = get();
        if (trackIndex >= 0 && trackIndex < s.queue.length) {
          const track = s.queue[trackIndex];
          if (track && track.id !== s.currentTrack?.id) {
            set({ currentTrack: track, queueIndex: trackIndex });
            const remaining = s.queue.length - 1 - trackIndex;
            if (remaining < 5 && s.repeatMode !== 'ONE') {
              void fetchAndAppendAutoRecommendations(track, get, set);
            }
          }
        }
      }
    });
  }

  return {
    currentTrack: null,
    isPlaying: false,
    autoplay: false,
    playbackIntent: 'none',
    playbackStatus: 'IDLE',
    setPlaybackStatus: (status: PlaybackStatus) => set({ playbackStatus: status }),
    userPlayInitiated: false,
    position: 0,
    duration: 0,
    playbackSpeed: 1.0,
    queue: [],
    queueIndex: -1,
    sessionPlayedTrackIds: [],
    isShuffle: false,
    repeatMode: 'OFF',
    isMiniPlayerVisible: false,
    isQueueSheetVisible: false,
    isSleepTimerModalVisible: false,
    sleepTimerMinutes: null,
    sleepTimerRemainingSec: 0,
    isRestoringSession: false,
    isGeneratingQueue: false,

    persistCurrentSession: (immediate = false) => persistMobilePlaybackSession(get, immediate),

    restorePlaybackSession: async () => {
      if (get().currentTrack) return;
      set({ isRestoringSession: true });
      try {
        const raw = await AsyncStorage.getItem(PLAYBACK_SESSION_STORAGE_KEY);
        if (!raw) return;
        const session: MobilePersistedSession = JSON.parse(raw);
        if (!session || !session.currentTrack) return;

        const restoredTrack = session.currentTrack;
        const restoredQueue = Array.isArray(session.queue) && session.queue.length > 0
          ? session.queue
          : [restoredTrack];
        const restoredIndex = typeof session.queueIndex === 'number' && session.queueIndex >= 0
          ? session.queueIndex
          : 0;
        const restoredPos = typeof session.positionSec === 'number' ? session.positionSec : 0;
        const restoredDuration = restoredTrack.durationMs ? Math.round(restoredTrack.durationMs / 1000) : 0;

        set({
          currentTrack: restoredTrack,
          queue: restoredQueue,
          queueIndex: restoredIndex,
          position: restoredPos,
          duration: restoredDuration,
          sessionPlayedTrackIds: Array.isArray(session.sessionPlayedTrackIds)
            ? session.sessionPlayedTrackIds
            : [restoredTrack.id],
          isShuffle: Boolean(session.isShuffle),
          repeatMode: session.repeatMode || 'OFF',
          isPlaying: false,
          autoplay: false,
          playbackIntent: 'none',
          userPlayInitiated: false,
          isMiniPlayerVisible: true,
        });

        syncActiveToServer(get);

        // Requirement 5: If restored queue is empty or has fewer than 5 upcoming songs, replenish automatically
        const upcomingCount = restoredQueue.length - 1 - restoredIndex;
        if (upcomingCount < 5 && restoredTrack) {
          void fetchAndAppendAutoRecommendations(restoredTrack, get, set);
        }
      } catch (err) {
        console.error('Failed to restore mobile playback session:', err);
      } finally {
        set({ isRestoringSession: false });
      }
    },

    playTrack: async (track: Track, queue?: Track[]) => {
      const isSingleTrackPlay = !queue || queue.length <= 1;
      if (isSingleTrackPlay) {
        set({ sessionPlayedTrackIds: [track.id] });
      }
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        const targetQueue = queue && queue.length > 0 ? queue : [track];
        await session.sendRemoteCommand('PLAY_TRACK', {
          track: trackToSessionTrack(track),
          queue: targetQueue.slice(0, 50).map(trackToSessionTrack),
        });
        return;
      }
      await executeLocalPlayTrack(track, queue && queue.length > 0 ? queue : [track]);
    },

    togglePlayPause: async () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        await session.sendRemoteCommand(get().isPlaying ? 'PAUSE' : 'PLAY');
        return;
      }
      await executeLocalTogglePlayPause();
    },

    playNext: async () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        await session.sendRemoteCommand('NEXT');
        return;
      }
      await executeLocalNext();
    },

    playPrevious: async () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        await session.sendRemoteCommand('PREVIOUS');
        return;
      }
      await executeLocalPrevious();
    },

    seekTo: async (seconds: number) => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        set({ position: seconds });
        await session.sendRemoteCommand('SEEK', { positionSec: seconds });
        return;
      }
      set({ position: seconds });
      await audioManager.seekTo(seconds);
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, false);
    },

    setVolume: async (volume: number) => {
      const clamped = Math.min(1, Math.max(0, volume));
      await audioManager.setVolume(clamped);
    },

    setPlaybackSpeed: async (speed: number) => {
      const clamped = Math.min(2.0, Math.max(0.5, speed));
      set({ playbackSpeed: clamped });
      await audioManager.setRate(clamped);
    },

    toggleShuffle: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('TOGGLE_SHUFFLE');
        return;
      }
      set((state) => ({ isShuffle: !state.isShuffle }));
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    },

    toggleRepeat: () => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('TOGGLE_REPEAT');
        return;
      }
      const modes: Array<'OFF' | 'ALL' | 'ONE'> = ['OFF', 'ALL', 'ONE'];
      const current = get().repeatMode;
      const next = modes[(modes.indexOf(current) + 1) % modes.length];
      set({ repeatMode: next });
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    },

    setQueue: (tracks: Track[]) => {
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        void session.sendRemoteCommand('SET_QUEUE', {
          queue: tracks.slice(0, 50).map(trackToSessionTrack),
          startIndex: 0,
        });
        return;
      }
      set({ queue: tracks });
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    },

    addToQueue: (track: Track) => {
      const current = get().queue;
      if (current.length === 0) {
        void get().playTrack(track, [track]);
        return;
      }
      if (current.some((t) => t.id === track.id)) return;
      set({ queue: [...current, track] });
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    },

    addTracksToQueue: (tracks: Track[]) => {
      if (!tracks || tracks.length === 0) return;
      const current = get().queue;
      if (current.length === 0) {
        void get().playTrack(tracks[0], tracks);
        return;
      }
      const existingIds = new Set(current.map((t) => t.id));
      const toAdd = tracks.filter((t) => !existingIds.has(t.id));
      if (toAdd.length === 0) return;
      set({ queue: [...current, ...toAdd] });
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    },

    playNextInQueue: (track: Track) => {
      const { queue, queueIndex } = get();
      if (queue.length === 0) {
        void get().playTrack(track, [track]);
        return;
      }
      const curIdx = Math.max(0, queueIndex);
      const currentPlaying = queue[curIdx];

      // If already playing this track, keep it as active
      if (currentPlaying && currentPlaying.id === track.id) {
        return;
      }

      // Remove existing occurrence from queue if present elsewhere
      const filtered = queue.filter((t, idx) => t.id !== track.id || idx === curIdx);
      const newCurIdx = Math.max(
        0,
        filtered.findIndex((t) => t.id === currentPlaying?.id)
      );

      // Insert immediately after the currently playing song
      filtered.splice(newCurIdx + 1, 0, track);
      set({ queue: filtered, queueIndex: newCurIdx });
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    },

    startSongMix: async (track: Track) => {
      await get().playTrack(track, [track]);
      set({ sessionPlayedTrackIds: [track.id] });
      await fetchAndAppendAutoRecommendations(track, get, set);
    },

    setPlaybackProgress: (position: number, duration: number) => {
      if (usePlaybackSessionStore.getState().isRemoteMode) return;
      const validDuration = duration > 0 ? duration : get().duration;
      set({ position, duration: validDuration });
      persistMobilePlaybackSession(get, false);

      const s = get();
      if (!s.isPlaying || !s.currentTrack) {
        mobilePlayTracking.lastProgressTimestamp = Date.now();
        return;
      }

      if (mobilePlayTracking.currentTrack?.id !== s.currentTrack.id) return;

      const now = Date.now();
      if (mobilePlayTracking.lastProgressTimestamp <= 0) {
        mobilePlayTracking.lastProgressTimestamp = now;
        return;
      }

      const deltaSec = Math.min(Math.max(0, (now - mobilePlayTracking.lastProgressTimestamp) / 1000), 2.5);
      mobilePlayTracking.lastProgressTimestamp = now;

      if (deltaSec > 0.1) {
        mobilePlayTracking.accumulatedListeningSec += deltaSec;
        mobilePlayTracking.unreportedDurationSec += deltaSec;

        const durationSec = duration > 0 ? duration : Math.round(s.currentTrack.durationMs / 1000);
        const threshold = durationSec > 0 && durationSec < 10 ? durationSec * 0.5 : 5;

        if (!mobilePlayTracking.hasCountedPlay && mobilePlayTracking.accumulatedListeningSec >= threshold) {
          mobilePlayTracking.hasCountedPlay = true;
          const director = s.currentTrack.composer || s.currentTrack.artist;
          recommendationApi
            .recordSupabaseHistory({
              songId: s.currentTrack.id,
              songTitle: s.currentTrack.title,
              artistName: s.currentTrack.artist,
              musicDirector: director,
              language: s.currentTrack.language,
              durationListenedMs: Math.round(mobilePlayTracking.accumulatedListeningSec * 1000),
              completed: false,
              isReplay: mobilePlayTracking.isReplay,
            })
            .catch(() => {});

          recommendationApi
            .recordListeningStat({
              songId: s.currentTrack.id,
              songName: s.currentTrack.title,
              movieOrAlbum: s.currentTrack.album || s.currentTrack.movieName,
              musicDirector: director,
              singers: s.currentTrack.singers || [s.currentTrack.artist],
              language: s.currentTrack.language,
              playCount: 1,
              replayCount: mobilePlayTracking.isReplay ? 1 : 0,
              totalListeningDurationMs: Math.round(mobilePlayTracking.accumulatedListeningSec * 1000),
              lastPlayedAt: new Date().toISOString(),
            })
            .catch(() => {});

          mobilePlayTracking.unreportedDurationSec = 0;
        } else if (mobilePlayTracking.unreportedDurationSec >= 15) {
          recommendationApi
            .recordListeningStat({
              songId: s.currentTrack.id,
              songName: s.currentTrack.title,
              totalListeningDurationMs: Math.round(mobilePlayTracking.unreportedDurationSec * 1000),
            })
            .catch(() => {});
          mobilePlayTracking.unreportedDurationSec = 0;
        }
      }
    },

    setIsPlaying: (isPlaying: boolean) => {
      if (usePlaybackSessionStore.getState().isRemoteMode) return;
      set({ isPlaying });
    },

    setCurrentTrack: (track: Track | null) =>
      set({ currentTrack: track, isMiniPlayerVisible: track !== null }),

    getNextTrack: () => {
      const { queue, queueIndex, currentTrack, isShuffle, repeatMode } = get();
      return computeNextMobileTrack(queue, queueIndex, currentTrack, isShuffle, repeatMode);
    },

    setQueueSheetVisible: (visible: boolean) => set({ isQueueSheetVisible: visible }),

    setSleepTimerModalVisible: (visible: boolean) => set({ isSleepTimerModalVisible: visible }),

    clearSleepTimer: () => {
      if (mobileSleepTimerIntervalId !== null) {
        clearInterval(mobileSleepTimerIntervalId);
        mobileSleepTimerIntervalId = null;
      }
      mobileSleepTimerEndsAt = null;
      set({ sleepTimerMinutes: null, sleepTimerRemainingSec: 0 });
    },

    setSleepTimer: (minutes: number) => {
      if (minutes <= 0) {
        get().clearSleepTimer();
        return;
      }
      if (mobileSleepTimerIntervalId !== null) {
        clearInterval(mobileSleepTimerIntervalId);
        mobileSleepTimerIntervalId = null;
      }
      const totalSec = minutes * 60;
      mobileSleepTimerEndsAt = Date.now() + totalSec * 1000;
      set({
        sleepTimerMinutes: minutes,
        sleepTimerRemainingSec: totalSec
      });

      mobileSleepTimerIntervalId = setInterval(() => {
        if (mobileSleepTimerEndsAt === null) return;
        const remainingSec = Math.max(0, Math.ceil((mobileSleepTimerEndsAt - Date.now()) / 1000));
        if (remainingSec <= 0) {
          get().clearSleepTimer();
          // Pause playback gracefully when sleep timer expires
          if (typeof audioManager.pause === 'function') {
            void audioManager.pause();
          }
          set({ isPlaying: false });
          return;
        }
        set({ sleepTimerRemainingSec: remainingSec });
      }, 1000);
    },

    playTrackAt: async (index: number) => {
      const { queue } = get();
      if (index < 0 || index >= queue.length) return;
      const target = queue[index];
      const session = usePlaybackSessionStore.getState();
      if (session.isRemoteMode) {
        await session.sendRemoteCommand('PLAY_TRACK', {
          track: trackToSessionTrack(target),
          queue: queue.slice(0, 50).map(trackToSessionTrack),
        });
        return;
      }
      await executeLocalPlayTrack(target, queue, 0, index);
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
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
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
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    },

    clearQueue: () => {
      const { currentTrack } = get();
      if (currentTrack) {
        set({ queue: [currentTrack], queueIndex: 0 });
        void fetchAndAppendAutoRecommendations(currentTrack, get, set);
      } else {
        set({ queue: [], queueIndex: -1 });
      }
      syncActiveToServer(get);
      persistMobilePlaybackSession(get, true);
    },

    clearSessionHistory: () => {
      const currentId = get().currentTrack?.id;
      set({ sessionPlayedTrackIds: currentId ? [currentId] : [] });
      persistMobilePlaybackSession(get, true);
    },

    pruneQueueByLanguage: () => {
      const userLangs = useRecommendationStore.getState().selectedLanguages?.length > 0
        ? useRecommendationStore.getState().selectedLanguages
        : useRecommendationStore.getState().preferences?.preferredLanguages || [];
      if (userLangs.length === 0) return;
      const { queue, queueIndex } = get();
      if (!queue || queue.length === 0) return;

      const current = queue[queueIndex];
      const validQueue = queue.filter((track, idx) => {
        if (idx === queueIndex) return true;
        return isTrackLanguageEligible(track, userLangs);
      });

      const newIndex = current ? validQueue.findIndex((t) => t.id === current.id) : 0;
      set({
        queue: validQueue,
        queueIndex: Math.max(0, newIndex)
      });
      persistMobilePlaybackSession(get, true);
    },

    fetchMoreRecommendations: async () => {
      const ref = get().currentTrack || get().queue[get().queue.length - 1];
      if (ref) {
        await fetchAndAppendAutoRecommendations(ref, get, set);
      }
    },

    resetForGuest: async () => {
      try {
        if (typeof audioManager.pause === 'function') {
          await audioManager.pause();
        }
        if (typeof audioManager.reset === 'function') {
          await audioManager.reset();
        }
      } catch {}
      await AsyncStorage.removeItem(PLAYBACK_SESSION_STORAGE_KEY);
      set({
        currentTrack: null,
        isPlaying: false,
        autoplay: false,
        playbackIntent: 'none',
        playbackStatus: 'IDLE',
        userPlayInitiated: false,
        position: 0,
        duration: 0,
        queue: [],
        queueIndex: -1,
        isMiniPlayerVisible: false,
        isQueueSheetVisible: false,
        sessionPlayedTrackIds: []
      });
    },
  };
});
