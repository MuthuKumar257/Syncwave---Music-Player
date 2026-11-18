import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 1. Setup DOM / Audio mocks for Node test environment
class MockAudioElement extends EventTarget {
  id = '';
  private _src = '';
  preload = '';
  crossOrigin = '';
  volume = 0.85;
  playbackRate = 1;
  currentTime = 0;
  duration = 300;
  paused = true;
  ended = false;
  readyState = 4;
  style = { display: '' };
  srcAssignmentCount = 0;

  get src() {
    return this._src;
  }

  set src(val: string) {
    this._src = val;
    this.srcAssignmentCount++;
  }

  play = vi.fn().mockImplementation(async () => {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  });

  pause = vi.fn().mockImplementation(() => {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  });

  load = vi.fn();
}

let mockAudioInstance: MockAudioElement;

// Mock window and document
(global as any).Audio = function () {
  if (!mockAudioInstance) {
    mockAudioInstance = new MockAudioElement();
  }
  return mockAudioInstance;
};

const mockMediaSession = {
  metadata: null as any,
  playbackState: 'none',
  actionHandlers: new Map<string, Function>(),
  setActionHandler: vi.fn((action: string, handler: Function | null) => {
    if (handler) {
      mockMediaSession.actionHandlers.set(action, handler);
    } else {
      mockMediaSession.actionHandlers.delete(action);
    }
  }),
  setPositionState: vi.fn()
};

if (typeof (global as any).navigator === 'undefined') {
  (global as any).navigator = {};
}
Object.defineProperty((global as any).navigator, 'mediaSession', {
  value: mockMediaSession,
  configurable: true,
  writable: true
});

(global as any).MediaMetadata = class MockMediaMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: any[];
  constructor(data: any) {
    this.title = data.title;
    this.artist = data.artist;
    this.album = data.album;
    this.artwork = data.artwork;
  }
};

const domElements = new Map<string, any>();
if (typeof (global as any).document === 'undefined') {
  (global as any).document = new EventTarget();
}
(global as any).document.getElementById = vi.fn((id: string) => domElements.get(id) || null);
(global as any).document.body = {
  appendChild: vi.fn((el: any) => {
    if (el?.id) domElements.set(el.id, el);
  })
};
(global as any).document.visibilityState = 'visible';

if (typeof (global as any).window === 'undefined') {
  (global as any).window = new EventTarget();
}

// Import stores and player after setting up global mocks
import { webAudioPlayer } from '../audio/WebAudioPlayer';
import { usePlayerStore } from '../store/usePlayerStore';
import { Song } from '../types';

describe('SyncWave Web Background Playback & Media Session Verification Suite', () => {
  const sampleSong1: Song = {
    id: 'song_bg_1',
    title: 'Nenjukkul Peidhidum',
    artist: 'Hariharan, Harris Jayaraj',
    album: 'Vaaranam Aayiram',
    durationMs: 310000,
    source: 'LOCAL',
    uri: 'https://cdn.example.com/audio1.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
    createdAt: new Date().toISOString()
  };

  const sampleSong2: Song = {
    id: 'song_bg_2',
    title: 'Adiye',
    artist: 'Sid Sriram, A. R. Rahman',
    album: 'Kadal',
    durationMs: 290000,
    source: 'LOCAL',
    uri: 'https://cdn.example.com/audio2.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
    createdAt: new Date().toISOString()
  };

  const sampleSong3: Song = {
    id: 'song_bg_3',
    title: 'Arabic Kuthu',
    artist: 'Anirudh Ravichander',
    album: 'Beast',
    durationMs: 279000,
    source: 'LOCAL',
    uri: 'https://cdn.example.com/audio3.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500',
    createdAt: new Date().toISOString()
  };

  beforeEach(() => {
    mockMediaSession.actionHandlers.clear();
    mockMediaSession.metadata = null;
    mockMediaSession.playbackState = 'none';
    mockMediaSession.setActionHandler.mockClear();
    mockMediaSession.setPositionState.mockClear();

    // Re-initialize player audio element and media session handlers
    webAudioPlayer.setupMediaSession();
    const audio = webAudioPlayer.getAudioElement();
    if (audio) {
      (audio as any).paused = true;
      audio.currentTime = 0;
    }

    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      userPlayInitiated: false,
      currentTime: 0,
      duration: 0,
      queue: [sampleSong1, sampleSong2, sampleSong3],
      queueIndex: 0,
      repeatMode: 'OFF',
      isShuffle: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 1. Persistent Audio Element Initialization
  it('uses one persistent HTMLAudioElement attached to DOM outside React hierarchy', () => {
    const audio = webAudioPlayer.getAudioElement();
    expect(audio).toBeDefined();
    expect(audio?.id).toBe('syncwave-persistent-audio');
    expect(audio?.preload).toBe('auto');
    expect(audio?.crossOrigin).toBe('anonymous');

    // Subsequent calls return the identical instance without recreating
    const secondCall = webAudioPlayer.getAudioElement();
    expect(secondCall).toBe(audio);
  });

  // 2. Background Playback & Visibility Independence
  it('does NOT pause audio on visibilitychange (tab switch, Chrome minimize, or lock screen)', () => {
    const audio = webAudioPlayer.getAudioElement();
    if (!audio) throw new Error('No audio element');

    usePlayerStore.getState().playSong(sampleSong1);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    const pauseSpy = vi.spyOn(audio, 'pause');

    // Simulate tab hidden / Chrome minimized
    (global as any).document.visibilityState = 'hidden';
    (global as any).document.dispatchEvent(new Event('visibilitychange'));

    // Verify playback was NOT paused
    expect(pauseSpy).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // Simulate window blur
    (global as any).window.dispatchEvent(new Event('blur'));
    expect(pauseSpy).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // Simulate tab return to visible -> state resynchronized
    (global as any).document.visibilityState = 'visible';
    (global as any).document.dispatchEvent(new Event('visibilitychange'));
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  // 3. Media Session Metadata Update
  it('updates Media Session metadata with title, artist, album, and multi-size artwork', async () => {
    await webAudioPlayer.play(sampleSong1);

    expect(mockMediaSession.metadata).toBeDefined();
    expect(mockMediaSession.metadata.title).toBe('Nenjukkul Peidhidum');
    expect(mockMediaSession.metadata.artist).toBe('Hariharan, Harris Jayaraj');
    expect(mockMediaSession.metadata.album).toBe('Vaaranam Aayiram');
    expect(mockMediaSession.metadata.artwork.length).toBeGreaterThanOrEqual(4);
    expect(mockMediaSession.playbackState).toBe('playing');
  });

  // 4. Media Session Action Handlers
  it('registers all required Media Session action handlers (play, pause, next, prev, seek)', () => {
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('previoustrack', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('seekto', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('seekbackward', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('seekforward', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('stop', expect.any(Function));
  });

  // 5. Media Control Trigger: Next Track
  it('advances queue and updates current song when user clicks next track on lock-screen/headset', () => {
    usePlayerStore.setState({
      queue: [sampleSong1, sampleSong2, sampleSong3],
      queueIndex: 0,
      currentSong: sampleSong1,
      isPlaying: true
    });

    const nextHandler = mockMediaSession.actionHandlers.get('nexttrack');
    expect(nextHandler).toBeDefined();

    // Trigger next track via Media Session API
    nextHandler!();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_bg_2');
    expect(usePlayerStore.getState().currentSong?.title).toBe('Adiye');
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  // 6. Media Control Trigger: Previous Track
  it('goes to previous track when user clicks previous track from lock screen controls', () => {
    usePlayerStore.setState({
      queue: [sampleSong1, sampleSong2, sampleSong3],
      queueIndex: 1,
      currentSong: sampleSong2,
      isPlaying: true,
      currentTime: 1 // below 3s threshold
    });

    const prevHandler = mockMediaSession.actionHandlers.get('previoustrack');
    expect(prevHandler).toBeDefined();

    // Trigger previous track
    prevHandler!();

    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_bg_1');
  });

  // 7. Track Ended: Continuous Background Queue Progression
  it('automatically transitions to next queue item when song finishes without requiring another tap', () => {
    const audio = webAudioPlayer.getAudioElement();

    usePlayerStore.setState({
      queue: [sampleSong1, sampleSong2, sampleSong3],
      queueIndex: 0,
      currentSong: sampleSong1,
      isPlaying: true,
      userPlayInitiated: true
    });

    // Simulate native ended event on the persistent audio element
    if (audio) {
      audio.dispatchEvent(new Event('ended'));
    }

    // Next song in queue should now be active and playing
    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_bg_2');
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  // 8. Protection Against Unnecessary Source Reload During Re-renders
  it('does NOT reload or reset audio element src when re-rendered with identical song and source', async () => {
    const audio = webAudioPlayer.getAudioElement() as any;
    if (!audio) throw new Error('No audio element');

    const initialAssignments = audio.srcAssignmentCount;

    // Initial play: sets source once
    await webAudioPlayer.play(sampleSong1);
    const afterFirstPlayAssignments = audio.srcAssignmentCount;
    expect(afterFirstPlayAssignments).toBeGreaterThanOrEqual(initialAssignments);

    // Simulated component re-render passing the exact same song and URL
    await webAudioPlayer.play(sampleSong1);

    // Source assignment count should remain identical (no buffer discard)
    expect(audio.srcAssignmentCount).toBe(afterFirstPlayAssignments);
  });

  // 9. Autoplay Policy: No Auto-start on Session Restoration
  it('never starts playback automatically upon session restoration without user gesture', async () => {
    const audio = webAudioPlayer.getAudioElement();
    const playSpy = audio ? vi.spyOn(audio, 'play') : vi.fn();

    // Store restores session with paused state
    await usePlayerStore.getState().restorePlaybackSession();

    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().userPlayInitiated).toBe(false);
    expect(playSpy).not.toHaveBeenCalled();
  });

  // 10. Prevention of Multiple Audio Instances
  it('halts secondary audio signals when persistent direct audio engine starts', () => {
    usePlayerStore.setState({
      activeAudioVideoId: 'prev_yt_id',
      isAudioStreamMode: true
    });

    // Play direct audio track
    usePlayerStore.getState().playSong(sampleSong1);

    // Should deactivate YouTube audio stream mode to prevent simultaneous audio
    expect(usePlayerStore.getState().activeAudioVideoId).toBeNull();
    expect(usePlayerStore.getState().isAudioStreamMode).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});
