import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { MiniPlayer } from './components/layout/MiniPlayer';
import { NowPlayingModal } from './components/player/NowPlayingModal';
import { QueuePanel } from './components/player/QueuePanel';
import { YouTubeAudioEngine } from './components/player/YouTubeAudioEngine';
import { DevicePickerModal } from './components/player/DevicePickerModal';
import { HomeView } from './views/HomeView';
import { LibraryView } from './views/LibraryView';
import { SchedulerView } from './views/SchedulerView';
import { DiscoverView } from './views/DiscoverView';
import { ProfileView } from './views/ProfileView';
import { LoginView } from './views/LoginView';
import { SignUpView } from './views/SignUpView';
import { GoogleCallbackView } from './views/GoogleCallbackView';
import { SongPreviewView } from './views/SongPreviewView';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { Volume2 } from 'lucide-react';
import { webAudioPlayer } from './audio/WebAudioPlayer';
import { useLibraryStore } from './store/useLibraryStore';
import { useSchedulerStore } from './store/useSchedulerStore';
import { usePlayerStore } from './store/usePlayerStore';
import { useAuthStore } from './store/useAuthStore';
import { usePlaybackSessionStore } from './store/usePlaybackSessionStore';

export const App: React.FC = () => {
  const { loadLibrary, syncLibrary } = useLibraryStore();
  const { initScheduler } = useSchedulerStore();
  const { isAuthenticated, token } = useAuthStore();
  const { startSessionSync, stopSessionSync } = usePlaybackSessionStore();
  const {
    togglePlay,
    seek,
    currentTime,
    setVolume,
    volume,
    toggleMute,
    isAutoplayBlocked,
    unlockAudio,
    isQueueOpen,
    setQueueOpen,
    restorePlaybackSession,
    persistCurrentSession
  } = usePlayerStore();

  useEffect(() => {
    // Mount & initialize the singleton persistent HTMLAudioElement outside React route tree
    webAudioPlayer.getAudioElement();

    loadLibrary();
    initScheduler();
    void restorePlaybackSession();

    // Auto-synchronize local music folders & downloaded Songs folder in background
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        webAudioPlayer.syncStateWithHardware();
        void syncLibrary({ quiet: true });
      } else if (document.visibilityState === 'hidden') {
        persistCurrentSession(true);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    const handleBeforeUnload = () => {
      persistCurrentSession(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    const intervalId = window.setInterval(() => {
      void syncLibrary({ quiet: true });
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.clearInterval(intervalId);
    };
  }, [loadLibrary, syncLibrary, initScheduler, restorePlaybackSession, persistCurrentSession]);

  useEffect(() => {
    if (isAuthenticated && token) {
      void startSessionSync(token);
      const handleUnload = () => {
        void stopSessionSync();
      };
      window.addEventListener('beforeunload', handleUnload);
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
      };
    } else {
      void stopSessionSync();
    }
  }, [isAuthenticated, token, startSessionSync, stopSessionSync]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek(currentTime + 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek(Math.max(0, currentTime - 5));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        setQueueOpen(!isQueueOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seek, currentTime, setVolume, volume, toggleMute, isQueueOpen, setQueueOpen]);

  return (
    <div className="flex h-full w-full min-h-[100dvh] overflow-hidden bg-background text-text antialiased font-sans">
      {/* Autoplay Unlock Notice (Browser Audio Restriction Recovery) */}
      {isAutoplayBlocked && (
        <div
          onClick={unlockAudio}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-primary/95 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer border border-primary-light/40 animate-bounce backdrop-blur-md"
        >
          <Volume2 className="w-5 h-5 text-secondary animate-pulse" />
          <span className="text-xs font-bold">
            Scheduled routine ready &bull; Click anywhere to enable audio playback
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              unlockAudio();
            }}
            className="px-2.5 py-1 bg-white text-primary text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Play Now
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/discover" element={<DiscoverView />} />
            <Route path="/library" element={<LibraryView />} />
            <Route path="/scheduler" element={<SchedulerView />} />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/settings" element={<Navigate to="/profile?tab=settings" replace />} />
            <Route path="/song/:songId" element={<SongPreviewView />} />
            <Route path="/artist/:artistId" element={<DiscoverView />} />
            <Route path="/playlist/:playlistId" element={<LibraryView />} />
            <Route path="/login" element={<LoginView />} />
            <Route path="/signup" element={<SignUpView />} />
            <Route path="/auth/google/callback" element={<GoogleCallbackView />} />
          </Routes>
        </main>

        {/* Persistent Bottom MiniPlayer */}
        <MiniPlayer />

        {/* Mobile Navigation */}
        <BottomNav />
      </div>

      {/* Full-Screen Now Playing Modal */}
      <NowPlayingModal />

      {/* Global Interactive Up Next Queue Panel Drawer */}
      <QueuePanel isOpen={isQueueOpen} onClose={() => setQueueOpen(false)} />

      {/* Connect / Select Playing Device Modal */}
      <DevicePickerModal />

      {/* Background Audio-Only Streaming Engine (No blocking video popup) */}
      <YouTubeAudioEngine />

      {/* Music Taste Personalization & Onboarding Modal */}
      <OnboardingModal />
    </div>
  );
};

export default App;

