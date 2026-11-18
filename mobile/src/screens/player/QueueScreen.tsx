import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SongMenuButton } from '../../components/common/SongContextMenuModal';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const QueueScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    queue,
    queueIndex,
    currentTrack,
    repeatMode,
    isShuffle,
    getNextTrack,
    playTrackAt,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    isGeneratingQueue
  } = usePlayerStore();

  const nextTrack = getNextTrack();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleClearQueue = () => {
    Alert.alert(
      'Clear Queue',
      'Clear all upcoming songs from queue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearQueue },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Playback Queue</Text>
          <Text style={styles.headerSubtitle}>
            {queue.length} track{queue.length === 1 ? '' : 's'}
            {repeatMode === 'ONE' ? ' • Repeat One' : ''}
            {isShuffle ? ' • Shuffled' : ''}
          </Text>
        </View>
        {queue.length > 1 ? (
          <TouchableOpacity
            style={styles.clearHeaderButton}
            onPress={handleClearQueue}
          >
            <Text style={styles.clearHeaderButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Now Playing Section */}
        {currentTrack && (
          <View style={styles.section}>
            <Text style={styles.nowPlayingBadge}>● NOW PLAYING</Text>
            <View style={styles.currentTrackCard}>
              <Image
                source={{
                  uri:
                    currentTrack.artworkUrl ||
                    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
                }}
                style={styles.itemArtwork}
              />
              <View style={styles.itemDetails}>
                <Text style={styles.currentTrackTitle} numberOfLines={1}>
                  {currentTrack.title}
                </Text>
                <Text style={styles.itemArtist} numberOfLines={1}>
                  {currentTrack.composer || currentTrack.artist}
                </Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemDuration}>
                  {formatTime(Math.round((currentTrack.durationMs || 0) / 1000))}
                </Text>
                <SongMenuButton track={currentTrack} context="default" size="sm" />
              </View>
            </View>
          </View>
        )}

        {/* Upcoming Tracks Section */}
        <View style={styles.section}>
          <View style={styles.upcomingHeaderRow}>
            <Text style={styles.sectionTitle}>UPCOMING TRACKS</Text>
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

                  {/* Click to play immediately */}
                  <TouchableOpacity
                    style={styles.itemClickable}
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
                      style={styles.itemArtwork}
                    />
                    <View style={styles.itemDetails}>
                      <View style={styles.titleWithBadge}>
                        <Text
                          style={[
                            styles.itemTitle,
                            isCurrent && styles.itemTitleCurrent,
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
                      <Text style={styles.itemArtist} numberOfLines={1}>
                        {track.composer || track.artist}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Duration and Context Menu */}
                  <View style={styles.itemRight}>
                    <Text style={styles.itemDuration}>
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
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No upcoming songs in the queue.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  backButton: {
    ...Typography.body2,
    color: Colors.accent
  },
  headerCenter: {
    alignItems: 'center'
  },
  headerTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontSize: 16
  },
  headerSubtitle: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 2
  },
  clearHeaderButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.control,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  clearHeaderButtonText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600'
  },
  headerSpacer: {
    width: 48
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 48
  },
  section: {
    marginBottom: Spacing.lg
  },
  nowPlayingBadge: {
    ...Typography.monoSmall,
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.xs
  },
  currentTrackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent
  },
  currentTrackTitle: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '700'
  },
  upcomingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs
  },
  sectionTitle: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1
  },
  reorderHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.card,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginBottom: 6
  },
  queueItemRowCurrent: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted
  },
  queueItemRowNext: {
    borderColor: Colors.hairlineLight
  },
  reorderButtonsCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 6
  },
  reorderArrow: {
    fontSize: 11,
    color: Colors.textSecondary,
    paddingVertical: 1
  },
  reorderArrowDisabled: {
    color: Colors.hairlineLight,
    opacity: 0.3
  },
  itemClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemArtwork: {
    width: 36,
    height: 36,
    borderRadius: Radius.small,
    backgroundColor: Colors.surface
  },
  itemDetails: {
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.xs
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  itemTitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1
  },
  itemTitleCurrent: {
    color: Colors.accent
  },
  upNextBadge: {
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  upNextBadgeText: {
    fontSize: 8,
    color: Colors.accent,
    fontWeight: '700'
  },
  itemArtist: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10,
    marginTop: 1
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  itemDuration: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    fontSize: 10
  },
  removeButton: {
    padding: 4
  },
  removeButtonText: {
    color: Colors.textTertiary,
    fontSize: 12
  },
  emptyBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  emptyText: {
    ...Typography.caption,
    color: Colors.textTertiary
  }
});
