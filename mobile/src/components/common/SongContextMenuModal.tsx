import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Track } from '../../api/types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useDownloadStore } from '../../store/useDownloadStore';
import { useSearchStore } from '../../store/useSearchStore';
import { SaveToPlaylistModal } from './SaveToPlaylistModal';
import { shareSong } from '../../utils/shareUtils';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export type SongMenuContext = 'default' | 'queue' | 'playlist' | 'liked' | 'download' | 'library';

interface SongContextMenuModalProps {
  visible: boolean;
  track: Track | null;
  context?: SongMenuContext;
  playlistId?: string;
  queueIndex?: number;
  onClose: () => void;
  onTrackDeleted?: (trackId: string) => void;
}

export const SongContextMenuModal: React.FC<SongContextMenuModalProps> = ({
  visible,
  track,
  context = 'default',
  playlistId,
  queueIndex,
  onClose,
  onTrackDeleted
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { playTrack, playNextInQueue, addToQueue, removeFromQueue } = usePlayerStore();
  const { isFavorite, toggleFavorite, removeTrackFromPlaylist } = useLibraryStore();
  const { isDownloaded, downloadTrack, deleteTrack, getDownloadError } = useDownloadStore();

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  if (!track) return null;

  const isFav = isFavorite(track.id);
  const isDown = isDownloaded(track.id);

  // 1. Play Now
  const handlePlayNow = () => {
    onClose();
    playTrack(track);
  };

  // 2. Play Next
  const handlePlayNext = () => {
    onClose();
    playNextInQueue(track);
    Alert.alert('Play Next', `"${track.title}" will play next.`);
  };

  // 3. Add to Queue
  const handleAddToQueue = () => {
    onClose();
    addToQueue(track);
    Alert.alert('Add to Queue', `"${track.title}" added to the end of queue.`);
  };

  // 4. Toggle Liked Songs
  const handleToggleFavorite = async () => {
    onClose();
    const isNowFav = await toggleFavorite(track);
    Alert.alert(
      isNowFav ? 'Added to Favorites' : 'Removed from Favorites',
      isNowFav
        ? `"${track.title}" has been saved to your favorite songs.`
        : `"${track.title}" has been removed from your favorites.`
    );
  };

  // 5. Download / Remove Download
  const handleDownloadAction = async () => {
    onClose();
    if (isDown) {
      await deleteTrack(track.id);
      Alert.alert('Download Removed', `"${track.title}" removed from offline downloads.`);
    } else {
      const ok = await downloadTrack(track);
      if (!ok) {
        const err = getDownloadError(track.id);
        Alert.alert('Download Not Available', err || 'Unable to download this track.');
      } else {
        Alert.alert('Downloaded', `"${track.title}" saved for offline listening.`);
      }
    }
  };

  // 6. Save to Playlist
  const handleSaveToPlaylist = () => {
    setIsPlaylistModalOpen(true);
  };

  // 7. Song Details
  const handleSongDetails = () => {
    onClose();
    navigation.navigate('SongDetail', { songId: track.id });
  };

  // 8. Share
  const handleShare = async () => {
    onClose();
    try {
      await shareSong(track);
    } catch (err) {
      console.warn('[SongContextMenuModal] Share error:', err);
    }
  };

  // 9. Context-aware Delete / Remove
  const handleDeleteAction = () => {
    if (context === 'queue') {
      onClose();
      if (typeof queueIndex === 'number') {
        removeFromQueue(queueIndex);
      } else {
        const queue = usePlayerStore.getState().queue;
        const idx = queue.findIndex((t) => t.id === track.id);
        if (idx !== -1) removeFromQueue(idx);
      }
      return;
    }

    if (context === 'playlist' && playlistId) {
      onClose();
      void removeTrackFromPlaylist(playlistId, track.id);
      return;
    }

    if (context === 'liked') {
      onClose();
      void toggleFavorite(track);
      return;
    }

    if (context === 'download' || isDown) {
      Alert.alert(
        'Delete Downloaded File',
        `Are you sure you want to permanently delete "${track.title}" from your device offline storage?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Permanently',
            style: 'destructive',
            onPress: async () => {
              onClose();
              await deleteTrack(track.id);
              if (onTrackDeleted) onTrackDeleted(track.id);
            }
          }
        ]
      );
      return;
    }

    // Default library remove
    Alert.alert(
      'Remove Song',
      `Remove "${track.title}" from your library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onClose();
            if (onTrackDeleted) onTrackDeleted(track.id);
          }
        }
      ]
    );
  };

  return (
    <>
      <Modal
        visible={visible && !isPlaylistModalOpen}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
          <View style={styles.menuCard}>
            {/* Song Header Thumbnail & Titles */}
            <View style={styles.header}>
              <Image
                source={{
                  uri:
                    track.artworkUrl ||
                    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'
                }}
                style={styles.artwork}
              />
              <View style={styles.headerInfo}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {track.composer || track.artist} {track.movieName ? `• ${track.movieName}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.headerCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Menu Options (Standardized & Functional) */}
            <View style={styles.optionsList}>
              {/* 1. Play Now */}
              <TouchableOpacity style={styles.menuRow} onPress={handlePlayNow} activeOpacity={0.7}>
                <Text style={styles.menuIcon}>▶</Text>
                <Text style={styles.menuLabel}>Play Now</Text>
              </TouchableOpacity>

              {/* 2. Play Next */}
              <TouchableOpacity style={styles.menuRow} onPress={handlePlayNext} activeOpacity={0.7}>
                <Text style={styles.menuIcon}>⏭</Text>
                <Text style={styles.menuLabel}>Play Next</Text>
              </TouchableOpacity>

              {/* 3. Add to Queue */}
              <TouchableOpacity style={styles.menuRow} onPress={handleAddToQueue} activeOpacity={0.7}>
                <Text style={styles.menuIcon}>＋</Text>
                <Text style={styles.menuLabel}>Add to Queue</Text>
              </TouchableOpacity>

              {/* 4. Add / Remove Favourites */}
              <TouchableOpacity style={styles.menuRow} onPress={handleToggleFavorite} activeOpacity={0.7}>
                <Text style={[styles.menuIcon, isFav && styles.heartActive]}>{isFav ? '♥' : '♡'}</Text>
                <Text style={[styles.menuLabel, isFav && styles.heartActiveText]}>
                  {isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                </Text>
              </TouchableOpacity>

              {/* 5. Add to Playlist */}
              <TouchableOpacity style={styles.menuRow} onPress={handleSaveToPlaylist} activeOpacity={0.7}>
                <Text style={styles.menuIcon}>≡＋</Text>
                <Text style={styles.menuLabel}>Add to Playlist</Text>
              </TouchableOpacity>

              {/* 6. Download / Remove Download */}
              <TouchableOpacity style={styles.menuRow} onPress={handleDownloadAction} activeOpacity={0.7}>
                <Text style={[styles.menuIcon, isDown && styles.downloadActive]}>
                  {isDown ? '✓' : '⬇'}
                </Text>
                <Text style={[styles.menuLabel, isDown && styles.downloadActiveText]}>
                  {isDown ? 'Remove from Downloads' : 'Download Song'}
                </Text>
              </TouchableOpacity>

              {/* 7. Song Details */}
              <TouchableOpacity style={styles.menuRow} onPress={handleSongDetails} activeOpacity={0.7}>
                <Text style={styles.menuIcon}>ℹ</Text>
                <Text style={styles.menuLabel}>Song Details</Text>
              </TouchableOpacity>

              {/* 8. Share */}
              <TouchableOpacity style={styles.menuRow} onPress={handleShare} activeOpacity={0.7}>
                <Text style={styles.menuIcon}>↗</Text>
                <Text style={styles.menuLabel}>Share</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* 9. Context-aware Delete / Remove */}
              <TouchableOpacity style={styles.menuRow} onPress={handleDeleteAction} activeOpacity={0.7}>
                <Text style={[styles.menuIcon, styles.deleteColor]}>🗑</Text>
                <Text style={[styles.menuLabel, styles.deleteColor]}>
                  {context === 'queue'
                    ? 'Remove from Queue'
                    : context === 'playlist'
                      ? 'Remove from Playlist'
                      : context === 'liked'
                        ? 'Remove from Favorites'
                        : context === 'download' || isDown
                          ? 'Delete Downloaded File'
                          : 'Remove from Library'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save to Playlist Modal */}
      <SaveToPlaylistModal
        visible={isPlaylistModalOpen}
        track={track}
        onClose={() => {
          setIsPlaylistModalOpen(false);
          onClose();
        }}
      />
    </>
  );
};

interface SongMenuButtonProps {
  track: Track;
  context?: SongMenuContext;
  playlistId?: string;
  queueIndex?: number;
  size?: 'sm' | 'md';
  onTrackDeleted?: (trackId: string) => void;
}

export const SongMenuButton: React.FC<SongMenuButtonProps> = ({
  track,
  context = 'default',
  playlistId,
  queueIndex,
  size = 'md',
  onTrackDeleted
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.triggerBtn, size === 'sm' && styles.triggerBtnSm]}
        onPress={(e) => {
          e.stopPropagation?.();
          setIsOpen(true);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
        accessibilityLabel="More options"
      >
        <Text style={[styles.triggerDots, size === 'sm' && styles.triggerDotsSm]}>⋮</Text>
      </TouchableOpacity>

      <SongContextMenuModal
        visible={isOpen}
        track={track}
        context={context}
        playlistId={playlistId}
        queueIndex={queueIndex}
        onClose={() => setIsOpen(false)}
        onTrackDeleted={onTrackDeleted}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject
  },
  menuCard: {
    width: '92%',
    maxWidth: 400,
    backgroundColor: '#18181b', // dark charcoal background
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a'
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: Radius.control,
    backgroundColor: '#27272a'
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.sm
  },
  songTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#ffffff'
  },
  songArtist: {
    ...Typography.caption,
    color: '#a1a1aa',
    marginTop: 2
  },
  headerCloseIcon: {
    fontSize: 16,
    color: '#a1a1aa',
    padding: 4
  },
  optionsList: {
    marginTop: Spacing.xs
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.control
  },
  menuIcon: {
    fontSize: 16,
    width: 26,
    textAlign: 'center',
    color: '#ffffff',
    marginRight: Spacing.sm
  },
  menuLabel: {
    ...Typography.body2,
    fontWeight: '500',
    color: '#ffffff'
  },
  heartActive: {
    color: Colors.accent
  },
  heartActiveText: {
    color: Colors.accent
  },
  downloadActive: {
    color: Colors.accent
  },
  downloadActiveText: {
    color: Colors.accent
  },
  deleteColor: {
    color: '#ef4444' // semantic red
  },
  divider: {
    height: 1,
    backgroundColor: '#27272a',
    marginVertical: 4
  },
  triggerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  triggerBtnSm: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  triggerDots: {
    fontSize: 18,
    color: '#a1a1aa',
    fontWeight: '700'
  },
  triggerDotsSm: {
    fontSize: 15
  }
});
