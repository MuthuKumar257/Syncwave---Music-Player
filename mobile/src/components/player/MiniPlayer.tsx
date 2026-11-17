import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDownloadStore } from '../../store/useDownloadStore';
import { usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/spacing';
import { SleepTimerModal } from './SleepTimerModal';
import { MoonIcon, QueueIcon, DeviceIcon, DownloadIcon } from '../common/Icon';

interface MiniPlayerProps {
  onPress: () => void;
  onOpenQueue?: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onPress, onOpenQueue }) => {
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    togglePlayPause,
    playNext,
    playPrevious,
    isMiniPlayerVisible,
    setSleepTimerModalVisible,
    sleepTimerRemainingSec,
    setQueueSheetVisible
  } = usePlayerStore();

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isFavorite, toggleFavorite } = useLibraryStore();
  const { isAuthenticated } = useAuthStore();
  const { downloadTrack, isDownloaded, getDownloadStatus } = useDownloadStore();
  const { isRemoteMode, devices, activeDeviceId, setDevicePickerVisible } =
    usePlaybackSessionStore();

  if ((!isMiniPlayerVisible || !currentTrack) && !isRemoteMode) return null;

  const trackId = currentTrack?.id || '';
  const isFav = trackId ? isFavorite(trackId) : false;
  const isDown = trackId ? isDownloaded(trackId) : false;
  const downloadStatus = trackId ? getDownloadStatus(trackId) : 'IDLE';
  const isDownloading = downloadStatus === 'DOWNLOADING';

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

  const handleToggleFavorite = async () => {
    if (!currentTrack) return;
    if (!isAuthenticated) {
      Alert.alert(
        'Sign in to Save Favorites',
        'Save your favorite songs and access them across all your devices by signing in to SyncWave.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: async () => {
              try {
                await AsyncStorage.setItem('@syncwave_pending_fav_track', JSON.stringify(currentTrack));
              } catch {}
              try {
                navigation.navigate('Login');
              } catch {}
            }
          }
        ]
      );
      return;
    }

    const added = await toggleFavorite(currentTrack);
    Alert.alert(
      added ? 'Added to Favorites' : 'Removed from Favorites',
      added
        ? `"${currentTrack.title}" added to your favorites.`
        : `"${currentTrack.title}" removed from your favorites.`
    );
  };

  const handleDownload = async () => {
    if (!currentTrack || isDown || isDownloading) return;
    const ok = await downloadTrack(currentTrack);
    if (ok) {
      Alert.alert('Downloaded', `"${currentTrack.title}" saved for offline listening.`);
    }
  };

  const handleOpenQueue = () => {
    if (onOpenQueue) {
      onOpenQueue();
    } else {
      setQueueSheetVisible(true);
    }
  };

  return (
    <View style={styles.outerContainer}>
      {/* 1. Thin Horizontal Progress Indicator (Full Width) */}
      <View style={styles.progressBarRail}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      {/* 2. Compact Player Controls Row */}
      <View style={styles.controlsRow}>
        {/* Left: Small Song Thumbnail & Title */}
        <TouchableOpacity
          style={styles.songMetadataArea}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Image
            source={{
              uri:
                currentTrack?.artworkUrl ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'
            }}
            style={styles.thumbnail}
          />
          <View style={styles.textContainer}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {currentTrack?.title || 'Remote Session'}
            </Text>
            <Text style={styles.songArtist} numberOfLines={1}>
              {isRemoteMode
                ? 'Connected to Device'
                : currentTrack?.composer || currentTrack?.artist || 'SyncWave'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right: Horizontally Aligned Compact Controls */}
        <View style={styles.buttonsGroup}>
          {/* Download Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleDownload}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel="Download track"
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : isDown ? (
              <Text style={styles.downloadedIcon}>✓</Text>
            ) : (
              <DownloadIcon size={14} color={Colors.textTertiary} strokeWidth={1.5} />
            )}
          </TouchableOpacity>

          {/* Favourite Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleToggleFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Text style={[styles.heartIcon, isFav && styles.heartActive]}>
              {isFav ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>

          {/* Previous Song */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={playPrevious}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel="Previous track"
          >
            <Text style={styles.iconText}>⏮</Text>
          </TouchableOpacity>

          {/* Play / Pause Button (Prominent) */}
          <TouchableOpacity
            style={styles.playPauseBtn}
            onPress={togglePlayPause}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Text style={styles.playPauseIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
          </TouchableOpacity>

          {/* Next Song */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={playNext}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel="Next track"
          >
            <Text style={styles.iconText}>⏭</Text>
          </TouchableOpacity>

          {/* Sleep Timer */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setSleepTimerModalVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel="Sleep timer"
          >
            <MoonIcon
              size={14}
              color={sleepTimerRemainingSec > 0 ? Colors.accent : Colors.textTertiary}
              strokeWidth={sleepTimerRemainingSec > 0 ? 2 : 1.5}
            />
          </TouchableOpacity>

          {/* Queue Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleOpenQueue}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel="Playback queue"
          >
            <QueueIcon size={14} color={Colors.textTertiary} strokeWidth={1.5} />
          </TouchableOpacity>

          {/* Device / Audio Output */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setDevicePickerVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel="Audio output devices"
          >
            <DeviceIcon
              size={14}
              color={isRemoteMode ? Colors.accent : Colors.textTertiary}
              strokeWidth={isRemoteMode ? 2 : 1.5}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sleep Timer Modal */}
      <SleepTimerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: Colors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineLight,
    width: '100%',
    zIndex: 90
  },
  progressBarRail: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(237, 237, 237, 0.12)'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accent
  },
  controlsRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm
  },
  songMetadataArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.xs,
    maxWidth: 140
  },
  thumbnail: {
    width: 32,
    height: 32,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceHover
  },
  textContainer: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center'
  },
  songTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  songArtist: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 1
  },
  buttonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  iconBtn: {
    width: 28,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconText: {
    fontSize: 13,
    color: Colors.textSecondary
  },
  activeAccentIcon: {
    color: Colors.accent
  },
  heartIcon: {
    fontSize: 15,
    color: Colors.textSecondary
  },
  heartActive: {
    color: '#EF4444'
  },
  downloadedIcon: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700'
  },
  playPauseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2
  },
  playPauseIcon: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '800',
    marginLeft: 1
  }
});
