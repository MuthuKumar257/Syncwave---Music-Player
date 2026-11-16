import { create } from 'zustand';
import { Track } from '../api/types';

interface LocalMusicState {
  localTracks: Track[];
  isScanning: boolean;
  scanMessage: string | null;

  // Actions
  scanLocalTracks: () => Promise<void>;
  clearMessage: () => void;
}

export const useLocalMusicStore = create<LocalMusicState>((set) => ({
  localTracks: [
    {
      id: 'local_sample_1',
      title: 'Morning Acoustic Breeze',
      artist: 'SyncWave Local Session',
      movieName: 'Local Storage',
      album: 'Internal Audio',
      durationMs: 245000,
      sourcePlatform: 'LOCAL',
      sourceUrl: '',
      isPlayableDirectly: true,
      artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
      language: 'Instrumental'
    },
    {
      id: 'local_sample_2',
      title: 'Late Night Focus Beats',
      artist: 'Lofi Chords',
      movieName: 'Local Storage',
      album: 'Internal Audio',
      durationMs: 198000,
      sourcePlatform: 'LOCAL',
      sourceUrl: '',
      isPlayableDirectly: true,
      artworkUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
      language: 'Instrumental'
    }
  ],
  isScanning: false,
  scanMessage: null,

  scanLocalTracks: async () => {
    set({ isScanning: true, scanMessage: null });
    // In real native environment, reads MediaStore (Android) or MPMediaQuery (iOS)
    await new Promise((r) => setTimeout(r, 800));

    set((state) => ({
      isScanning: false,
      scanMessage: `Successfully scanned and indexed ${state.localTracks.length} local audio files.`
    }));
  },

  clearMessage: () => set({ scanMessage: null })
}));
