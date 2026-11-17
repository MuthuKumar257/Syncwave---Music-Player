import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SongMenuButton } from '../../components/common/SongContextMenuModal';
import { shareSong } from '../../utils/shareUtils';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const FullPlayerScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    queue,
    queueIndex,
    isShuffle,
    repeatMode,
    isQueueSheetVisible,
    setQueueSheetVisible,
    playTrackAt,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    playTrack,
    getNextTrack,
    isGeneratingQueue
  } = usePlayerStore();

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPos, setSeekPos] = useState(0);
  const { isRemoteMode, devices, activeDeviceId, setDevicePickerVisible } =
    usePlaybackSessionStore();
  const activeDevice = devices.find((d) => d.deviceId === activeDeviceId);
  const nextTrack = getNextTrack();

  const { isFavorite, toggleFavorite } = useLibraryStore();
  const { isAuthenticated } = useAuthStore();
  const isCurrentFav = currentTrack ? isFavorite(currentTrack.id) : false;

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

    const isNowFav = await toggleFavorite(currentTrack);
    Alert.alert(
      isNowFav ? 'Added to Favorites' : 'Removed from Favorites',
      isNowFav
        ? `"${currentTrack.title}" has been saved to your favorite songs.`
        : `"${currentTrack.title}" has been removed from your favorites.`
    );
  };

  if (!currentTrack) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.closeHeader} onPress={() => navigation.goBack()}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No song is currently loaded</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentSec = isSeeking ? seekPos : position;
  const totalSec = duration > 0 ? duration : Math.round(currentTrack.durationMs / 1000);
  const progressRatio = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.headerDismiss}>▼</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerNowPlaying}>NOW PLAYING</Text>
          <Text style={styles.headerSource} numberOfLines={1}>
            {currentTrack.movieName || currentTrack.album || 'Single Release'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => void shareSong(currentTrack)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginRight: 8, padding: 4 }}
            accessibilityLabel="Share Song"
          >
            <Text style={{ fontSize: 18, color: Colors.textSecondary }}>↗</Text>
          </TouchableOpacity>
          <SongMenuButton track={currentTrack} context="default" />
          <TouchableOpacity
            onPress={() => setQueueSheetVisible(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginLeft: 4 }}
          >
            <Text style={styles.headerQueue}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Artwork */}
      <View style={styles.artworkContainer}>
        <Image
          source={{ uri: currentTrack.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800' }}
          style={styles.heroArtwork}
        />
      </View>

      {/* Song Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.titleRow}>
          <View style={styles.titleTextContainer}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.songArtist} numberOfLines={1}>
              {currentTrack.composer || currentTrack.artist}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleToggleFavorite}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginRight: 8, padding: 6 }}
              accessibilityLabel={isCurrentFav ? "Remove from favorites" : "Add to favorites"}
            >
              <Text style={{ fontSize: 22, color: isCurrentFav ? '#EF4444' : Colors.textSecondary }}>
                {isCurrentFav ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void shareSong(currentTrack)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginRight: 8, padding: 6 }}
              accessibilityLabel="Share Song"
            >
              <Text style={{ fontSize: 18, color: Colors.textSecondary }}>↗</Text>
            </TouchableOpacity>
            <SongMenuButton track={currentTrack} context="default" />
          </View>
        </View>

        {/* Tactile Scrubber Bar */}
        <View style={styles.scrubberContainer}>
          <TouchableOpacity
            style={styles.scrubberTouchArea}
            activeOpacity={1}
            onPress={(e) => {
              const { locationX } = e.nativeEvent;
              // Assume 300px width approximate scrubber
              const ratio = Math.max(0, Math.min(1, locationX / 320));
              const newSec = Math.round(ratio * totalSec);
              seekTo(newSec);
            }}
          >
            <View style={styles.scrubberTrack}>
              <View style={[styles.scrubberFill, { width: `${progressRatio * 100}%` }]} />
              <View style={[styles.scrubberThumb, { left: `${progressRatio * 100}%` }]} />
            </View>
          </TouchableOpacity>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(currentSec)}</Text>
            <Text style={styles.timeText}>{formatTime(totalSec)}</Text>
          </View>
        </View>

        {/* Playback Controls Deck */}
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={toggleShuffle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.modeButton, isShuffle && styles.activeModeButton]}>🔀</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={playPrevious} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navButton}>⏮</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.playPauseButton} onPress={togglePlayPause} activeOpacity={0.8}>
            <Text style={styles.playPauseIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={playNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navButton}>⏭</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleRepeat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.modeButton, repeatMode !== 'OFF' && styles.activeModeButton]}>
              {repeatMode === 'ONE' ? '🔂' : '🔁'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setDevicePickerVisible(true)}
          style={{
            marginTop: Spacing.sm,
            alignSelf: 'center',
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: Radius.control,
            borderWidth: 1,
            borderColor: isRemoteMode ? Colors.accent : Colors.hairline,
            backgroundColor: isRemoteMode ? Colors.accentMuted : Colors.surface,
          }}
        >
          <Text
            style={{
              color: isRemoteMode ? Colors.accent : Colors.textSecondary,
              fontSize: 11,
              fontWeight: '600',
            }}
          >
            {isRemoteMode
              ? `Playing on ${activeDevice?.deviceName || 'another device'} • Switch`
              : 'Connect / Select playing device'}
          </Text>
        </TouchableOpacity>

        {/* Next Song / Up Next Preview Card */}
        <View style={styles.upNextContainer}>
          <View style={styles.upNextHeaderRow}>
            <TouchableOpacity onPress={() => setQueueSheetVisible(true)}>
              <Text style={styles.upNextLabel}>
                UP NEXT {repeatMode === 'ONE' ? '(REPEATING)' : isShuffle ? '(SHUFFLED)' : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setQueueSheetVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.upNextQueueLink}>Queue ({queue.length}) ›</Text>
            </TouchableOpacity>
          </View>

          {nextTrack ? (
            <TouchableOpacity
              style={styles.upNextCard}
              activeOpacity={0.7}
              onPress={() => setQueueSheetVisible(true)}
            >
              <TouchableOpacity
                onPress={() => playTrack(nextTrack, queue)}
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri:
                      nextTrack.artworkUrl ||
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
                  }}
                  style={styles.upNextArtwork}
                />
              </TouchableOpacity>
              <View style={styles.upNextDetails}>
                <Text style={styles.upNextTitle} numberOfLines={1}>
                  {nextTrack.title}
                </Text>
                <Text style={styles.upNextArtist} numberOfLines={1}>
                  {nextTrack.composer || nextTrack.artist}
                </Text>
              </View>
              <View style={styles.upNextRightArea}>
                <Text style={styles.upNextDuration}>
                  {formatTime(Math.round((nextTrack.durationMs || 0) / 1000))}
                </Text>
                <SongMenuButton track={nextTrack} context="queue" size="sm" />
                <TouchableOpacity
                  onPress={() => playTrack(nextTrack, queue)}
                  style={styles.upNextPlayButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.upNextPlayButtonText}>▶</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ) : isGeneratingQueue ? (
            <TouchableOpacity
              style={styles.upNextEmptyCard}
              onPress={() => setQueueSheetVisible(true)}
            >
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: 8 }} />
              <Text style={styles.upNextEmptyText}>Generating recommendations...</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.upNextEmptyCard}
              onPress={() => setQueueSheetVisible(true)}
            >
              <Text style={styles.upNextEmptyText}>No upcoming songs • Tap to view queue</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Interactive Up Next Queue Bottom Sheet */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isQueueSheetVisible}
        onRequestClose={() => setQueueSheetVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setQueueSheetVisible(false)}
          />

          <View style={styles.bottomSheetContainer}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandleBar} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Playback Queue</Text>
                <Text style={styles.sheetSubtitle}>
                  {queue.length} track{queue.length === 1 ? '' : 's'}
                  {repeatMode === 'ONE' ? ' • Repeat One' : ''}
                  {isShuffle ? ' • Shuffled' : ''}
                </Text>
              </View>

              <View style={styles.sheetHeaderActions}>
                {queue.length > 1 && (
                  <TouchableOpacity
                    style={styles.clearQueueButton}
                    onPress={() => {
                      Alert.alert(
                        'Clear Queue',
                        'Clear all upcoming songs from queue?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Clear', style: 'destructive', onPress: clearQueue },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.clearQueueButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.sheetCloseButton}
                  onPress={() => setQueueSheetVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.sheetCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable Queue Content */}
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Currently Playing Card */}
              {currentTrack && (
                <View style={styles.sheetSection}>
                  <View style={styles.sheetSectionHeaderRow}>
                    <Text style={styles.nowPlayingBadge}>● NOW PLAYING</Text>
                  </View>
                  <View style={styles.currentTrackCard}>
                    <Image
                      source={{
                        uri:
                          currentTrack.artworkUrl ||
                          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
                      }}
                      style={styles.queueItemArtwork}
                    />
                    <View style={styles.queueItemDetails}>
                      <Text style={styles.currentTrackTitle} numberOfLines={1}>
                        {currentTrack.title}
                      </Text>
                      <Text style={styles.queueItemArtist} numberOfLines={1}>
                        {currentTrack.composer || currentTrack.artist}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.queueItemDuration}>
                        {formatTime(Math.round((currentTrack.durationMs || 0) / 1000))}
                      </Text>
                      <SongMenuButton track={currentTrack} context="default" size="sm" />
                    </View>
                  </View>
                </View>
              )}

              {/* Upcoming Tracks */}
              <View style={styles.sheetSection}>
                <View style={styles.sheetSectionHeaderRow}>
                  <Text style={styles.upcomingSectionTitle}>UPCOMING TRACKS</Text>
                  {isGeneratingQueue ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: 6 }} />
                      <Text style={[styles.reorderHint, { color: Colors.accent }]}>Loading recommendations...</Text>
                    </View>
                  ) : (
                    <Text style={styles.reorderHint}>Tap to play • ▲ ▼ to reorder</Text>
                  )}
                </View>

                {queue.length > 0 ? (
                  queue.map((track, index) => {
                    const isCurrent = currentTrack?.id === track.id && index === queueIndex;
                    const isNext = nextTrack?.id === track.id && !isCurrent;

                    return (
                      <View
                        key={`${track.id}_${index}`}
                        style={[
                          styles.queueItemRow,
                          isCurrent && styles.queueItemRowCurrent,
                          isNext && styles.queueItemRowNext,
                        ]}
                      >
                        {/* Reorder Buttons */}
                        <View style={styles.reorderButtonsCol}>
                          <TouchableOpacity
                            disabled={index === 0}
                            onPress={() => reorderQueue(index, index - 1)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text
                              style={[
                                styles.reorderArrow,
                                index === 0 && styles.reorderArrowDisabled,
                              ]}
                            >
                              ▲
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={index === queue.length - 1}
                            onPress={() => reorderQueue(index, index + 1)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text
                              style={[
                                styles.reorderArrow,
                                index === queue.length - 1 && styles.reorderArrowDisabled,
                              ]}
                            >
                              ▼
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Song Item clickable to play immediately */}
                        <TouchableOpacity
                          style={styles.queueItemClickableArea}
                          activeOpacity={0.7}
                          onPress={() => {
                            void playTrackAt(index);
                          }}
                        >
                          <Image
                            source={{
                              uri:
                                track.artworkUrl ||
                                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
                            }}
                            style={styles.queueItemArtwork}
                          />
                          <View style={styles.queueItemDetails}>
                            <View style={styles.titleWithBadgeRow}>
                              <Text
                                style={[
                                  styles.queueItemTitle,
                                  isCurrent && styles.queueItemTitleCurrent,
                                ]}
                                numberOfLines={1}
                              >
                                {track.title}
                              </Text>
                              {isNext && (
                                <View style={styles.upNextBadge}>
                                  <Text style={styles.upNextBadgeText}>UP NEXT</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.queueItemArtist} numberOfLines={1}>
                              {track.composer || track.artist}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Duration and Context Menu */}
                        <View style={styles.queueItemRightArea}>
                          <Text style={styles.queueItemDuration}>
                            {formatTime(Math.round((track.durationMs || 0) / 1000))}
                          </Text>
                          <SongMenuButton
                            track={track}
                            context="queue"
                            queueIndex={index}
                            size="sm"
                          />
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyQueueBox}>
                    <Text style={styles.emptyQueueText}>No upcoming songs in the queue</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md
  },
  headerDismiss: {
    fontSize: 16,
    color: Colors.textSecondary
  },
  headerTitleCenter: {
    alignItems: 'center'
  },
  headerNowPlaying: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    letterSpacing: 1
  },
  headerSource: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2
  },
  headerQueue: {
    fontSize: 18,
    color: Colors.textSecondary
  },
  artworkContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl
  },
  heroArtwork: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 340,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    backgroundColor: Colors.surfaceRaised
  },
  detailsContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg
  },
  titleTextContainer: {
    flex: 1,
    marginRight: Spacing.md
  },
  songTitle: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  songArtist: {
    ...Typography.bodyMedium,
    color: Colors.textTertiary,
    marginTop: 4
  },
  scrubberContainer: {
    marginBottom: Spacing.xl
  },
  scrubberTouchArea: {
    height: 30,
    justifyContent: 'center'
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.tag,
    position: 'relative'
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radius.tag
  },
  scrubberThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: Radius.circle,
    backgroundColor: Colors.accent,
    marginLeft: -7
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4
  },
  timeText: {
    ...Typography.monoSmall,
    color: Colors.textTertiary
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg
  },
  modeButton: {
    fontSize: 18,
    opacity: 0.5
  },
  activeModeButton: {
    opacity: 1
  },
  navButton: {
    fontSize: 22,
    color: Colors.textPrimary
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: Radius.circle,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8
  },
  playPauseIcon: {
    fontSize: 22,
    color: '#000000',
    marginLeft: 2
  },
  closeHeader: {
    padding: Spacing.xl
  },
  closeIcon: {
    fontSize: 20,
    color: Colors.textSecondary
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textTertiary
  },
  upNextContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  upNextHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  upNextLabel: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    fontSize: 10,
    letterSpacing: 1,
  },
  upNextQueueLink: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontSize: 11,
  },
  upNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  upNextArtwork: {
    width: 38,
    height: 38,
    borderRadius: Radius.small,
    backgroundColor: Colors.surfaceElevated,
  },
  upNextDetails: {
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.xs,
  },
  upNextTitle: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  upNextArtist: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  upNextDuration: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    fontSize: 11,
  },
  upNextRightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upNextPlayButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.control,
    backgroundColor: Colors.accentMuted,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  upNextPlayButtonText: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: '700',
  },
  upNextEmptyCard: {
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
  },
  upNextEmptyText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  bottomSheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    maxHeight: '80%',
    paddingBottom: Spacing.xl,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hairlineLight,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  sheetTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  sheetSubtitle: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  sheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearQueueButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.control,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  clearQueueButtonText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
  },
  sheetCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    padding: Spacing.lg,
  },
  sheetSection: {
    marginBottom: Spacing.lg,
  },
  sheetSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  nowPlayingBadge: {
    ...Typography.monoSmall,
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  currentTrackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  currentTrackTitle: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  upcomingSectionTitle: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  reorderHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10,
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.card,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginBottom: 6,
  },
  queueItemRowCurrent: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  queueItemRowNext: {
    borderColor: Colors.hairlineLight,
  },
  reorderButtonsCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 6,
  },
  reorderArrow: {
    fontSize: 11,
    color: Colors.textSecondary,
    paddingVertical: 1,
  },
  reorderArrowDisabled: {
    color: Colors.hairlineLight,
    opacity: 0.3,
  },
  queueItemClickableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueItemArtwork: {
    width: 36,
    height: 36,
    borderRadius: Radius.small,
    backgroundColor: Colors.surface,
  },
  queueItemDetails: {
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.xs,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueItemTitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  queueItemTitleCurrent: {
    color: Colors.accent,
  },
  upNextBadge: {
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  upNextBadgeText: {
    fontSize: 8,
    color: Colors.accent,
    fontWeight: '700',
  },
  queueItemArtist: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10,
    marginTop: 1,
  },
  queueItemRightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueItemDuration: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    fontSize: 10,
  },
  removeQueueButton: {
    padding: 4,
  },
  removeQueueButtonText: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  emptyQueueBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  emptyQueueText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
