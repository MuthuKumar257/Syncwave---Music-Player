import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';

describe('SyncWave Web Responsive UI & Layout Audit Suite', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const srcDir = path.resolve(__dirname, '../');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. HTML Viewport Configuration & Root Sizing', () => {
    it('configures scalable viewport with viewport-fit=cover and removes user-scalable=no', () => {
      const htmlPath = path.join(rootDir, 'index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');

      expect(htmlContent).toContain('viewport-fit=cover');
      expect(htmlContent).not.toContain('user-scalable=no');
      expect(htmlContent).not.toContain('maximum-scale=1.0');
      // Root body must avoid fixed 100vw/w-screen which induces horizontal scroll on desktop
      expect(htmlContent).not.toContain('w-screen');
      expect(htmlContent).toContain('min-h-[100dvh]');
    });

    it('defines tactile focus-visible and reduced motion rules in index.css', () => {
      const cssPath = path.join(srcDir, 'index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      expect(cssContent).toContain(':focus-visible');
      expect(cssContent).toContain('prefers-reduced-motion');
      expect(cssContent).toContain('scrollbar-none');
    });

    it('defines xs: 360px breakpoint in tailwind.config.js for small mobile phone responsiveness', () => {
      const tailwindConfigPath = path.join(rootDir, 'tailwind.config.js');
      const tailwindContent = fs.readFileSync(tailwindConfigPath, 'utf8');

      expect(tailwindContent).toContain("'xs': '360px'");
    });
  });

  describe('2. Mobile Bottom Navigation (BottomNav.tsx)', () => {
    const bottomNavPath = path.join(srcDir, 'components/layout/BottomNav.tsx');
    const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');

    it('displays exactly the five required navigation destinations', () => {
      expect(bottomNavContent).toContain("label: 'Home'");
      expect(bottomNavContent).toContain("label: 'Discover'");
      expect(bottomNavContent).toContain("label: 'Library'");
      expect(bottomNavContent).toContain("label: 'Scheduler'");
      expect(bottomNavContent).toContain("label: 'Profile'");
    });

    it('respects mobile safe-area insets and comfortable touch targets', () => {
      expect(bottomNavContent).toContain('safe-area-inset-bottom');
      expect(bottomNavContent).toContain('aria-label="Mobile navigation"');
      expect(bottomNavContent).toContain('min-h-[48px]');
      expect(bottomNavContent).toContain('md:hidden');
    });
  });

  describe('3. MiniPlayer Responsive Layout & Touch Controls (MiniPlayer.tsx)', () => {
    const miniPlayerPath = path.join(srcDir, 'components/layout/MiniPlayer.tsx');
    const miniPlayerContent = fs.readFileSync(miniPlayerPath, 'utf8');

    it('provides streamlined touch controls on mobile without horizontal button cramming', () => {
      // Mobile row must be md:hidden
      expect(miniPlayerContent).toContain('flex md:hidden items-center justify-between');
      // Check that accessible labels are provided
      expect(miniPlayerContent).toContain('aria-label={isPlaying ? \'Pause\' : \'Play\'}');
      expect(miniPlayerContent).toContain('aria-label="Next song"');
      expect(miniPlayerContent).toContain('aria-label="Toggle playback queue"');
    });

    it('truncates song titles with min-w-0 to prevent text overflow', () => {
      expect(miniPlayerContent).toContain('truncate leading-tight');
      expect(miniPlayerContent).toContain('min-w-0 flex-1');
    });
  });

  describe('4. Full-Screen NowPlayingModal Short Viewports & Safe Areas', () => {
    const modalPath = path.join(srcDir, 'components/player/NowPlayingModal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    it('supports scrolling on short screens (overflow-y-auto)', () => {
      expect(modalContent).toContain('overflow-y-auto');
    });

    it('respects safe-area insets at top and bottom', () => {
      expect(modalContent).toContain('safe-area-inset-top');
      expect(modalContent).toContain('safe-area-inset-bottom');
    });

    it('uses responsive artwork sizing constraints', () => {
      expect(modalContent).toContain('max-h-[38vh]');
      expect(modalContent).toContain('aspect-square');
    });

    it('provides accessible labels on interactive control buttons', () => {
      expect(modalContent).toContain('aria-label="Minimize player"');
      expect(modalContent).toContain('aria-label="Download song offline"');
      expect(modalContent).toContain('aria-label="Share song"');
    });
  });

  describe('5. QueuePanel Drawer Resilience & Styling', () => {
    const queuePath = path.join(srcDir, 'components/player/QueuePanel.tsx');
    const queueContent = fs.readFileSync(queuePath, 'utf8');

    it('uses valid bg-surface-elevated and includes safe-area-inset-bottom', () => {
      expect(queueContent).toContain('bg-surface-elevated');
      expect(queueContent).not.toContain('bg-surface-raised');
      expect(queueContent).toContain('safe-area-inset-bottom');
    });
  });

  describe('6. Shared Song Preview Page (SongPreviewView.tsx)', () => {
    const songPreviewPath = path.join(srcDir, 'views/SongPreviewView.tsx');
    const songPreviewContent = fs.readFileSync(songPreviewPath, 'utf8');

    it('uses valid Tailwind color and surface tokens', () => {
      expect(songPreviewContent).not.toContain('textSecondary');
      expect(songPreviewContent).not.toContain('textPrimary');
      expect(songPreviewContent).not.toContain('bg-surfaceRaised');
      expect(songPreviewContent).toContain('text-text-primary');
      expect(songPreviewContent).toContain('text-text-secondary');
      expect(songPreviewContent).toContain('bg-surface-elevated');
    });
  });

  describe('7. Standardized Responsive Page Padding Across Views', () => {
    it('maintains consistent mobile padding and bottom clearance across all main views', () => {
      const views = [
        'views/HomeView.tsx',
        'views/LibraryView.tsx',
        'views/DiscoverView.tsx',
        'views/SchedulerView.tsx',
        'views/ProfileView.tsx'
      ];

      for (const view of views) {
        const content = fs.readFileSync(path.join(srcDir, view), 'utf8');
        expect(content).toContain('p-3.5 sm:p-5 md:p-8');
        expect(content).toContain('pb-20 md:pb-8');
      }
    });
  });

  describe('8. Player and Queue Store State Flow', () => {
    it('updates current song and queue states seamlessly', () => {
      usePlayerStore.setState({
        currentSong: {
          id: 'song_test_responsive',
          title: 'Kannazhaga',
          artist: 'Anirudh Ravichander, Dhanush',
          album: '3 Soundtrack',
          durationMs: 205000,
          artworkUrl: 'https://example.com/art.jpg',
          source: 'SPOTIFY',
          createdAt: new Date().toISOString()
        },
        isPlaying: false,
        isNowPlayingOpen: false,
        isQueueOpen: false
      });

      const state = usePlayerStore.getState();
      expect(state.currentSong?.title).toBe('Kannazhaga');

      // Toggling full player
      state.setNowPlayingOpen(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);
      state.setNowPlayingOpen(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      // Toggling queue drawer
      state.setQueueOpen(true);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      state.setQueueOpen(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
    });
  });
});
