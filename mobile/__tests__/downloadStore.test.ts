import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDownloadStore } from '../src/store/useDownloadStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '../src/api/types';

const sampleTrack: Track = {
  id: 'offline_track_1',
  title: 'Hukum',
  artist: 'Anirudh Ravichander',
  movieName: 'Jailer',
  album: 'Jailer',
  durationMs: 215000,
  sourcePlatform: 'YOUTUBE',
  sourceUrl: 'https://youtube.com/watch?v=hukum',
  isPlayableDirectly: true,
  artworkUrl: '',
  language: 'Tamil'
};

describe('useDownloadStore - Offline Storage Management', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
    useDownloadStore.setState({
      downloadedTracks: [],
      downloadProgress: {},
      downloadStatus: {},
      downloadErrors: {},
      failedTracks: {}
    });
  });

  it('downloads and saves track offline to AsyncStorage', async () => {
    const store = useDownloadStore.getState();
    expect(store.isDownloaded(sampleTrack.id)).toBe(false);

    await store.downloadTrack(sampleTrack);

    const state = useDownloadStore.getState();
    expect(state.isDownloaded(sampleTrack.id)).toBe(true);
    expect(state.downloadedTracks.length).toBe(1);
    expect(state.downloadedTracks[0].sourcePlatform).toBe('DOWNLOADED');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@syncwave_offline_downloads_v2',
      expect.stringContaining('offline_track_1')
    );
  });

  it('deletes track from offline list and updates AsyncStorage', async () => {
    const store = useDownloadStore.getState();
    useDownloadStore.setState({
      downloadedTracks: [{ ...sampleTrack, sourcePlatform: 'DOWNLOADED' }]
    });

    expect(store.isDownloaded(sampleTrack.id)).toBe(true);

    await store.deleteTrack(sampleTrack.id);

    const state = useDownloadStore.getState();
    expect(state.isDownloaded(sampleTrack.id)).toBe(false);
    expect(state.downloadedTracks.length).toBe(0);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@syncwave_offline_downloads_v2',
      '[]'
    );
  });

  it('initializes and restores stored tracks from AsyncStorage', async () => {
    const stored = [{ ...sampleTrack, sourcePlatform: 'DOWNLOADED' }];
    (AsyncStorage.getItem as any).mockResolvedValueOnce(JSON.stringify(stored));

    const store = useDownloadStore.getState();
    await store.initialize();

    expect(useDownloadStore.getState().downloadedTracks.length).toBe(1);
    expect(useDownloadStore.getState().downloadedTracks[0].id).toBe('offline_track_1');
  });
});
