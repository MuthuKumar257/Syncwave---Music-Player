import TrackPlayer, { Event } from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';

export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    const store = usePlayerStore.getState();
    if (!store.isPlaying) {
      void store.togglePlayPause();
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    const store = usePlayerStore.getState();
    if (store.isPlaying) {
      void store.togglePlayPause();
    }
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    void usePlayerStore.getState().playNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    void usePlayerStore.getState().playPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    if (typeof event.position === 'number') {
      void usePlayerStore.getState().seekTo(event.position);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    const store = usePlayerStore.getState();
    if (store.isPlaying) {
      void store.togglePlayPause();
    }
  });
}
