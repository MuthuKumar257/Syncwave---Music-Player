import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useDownloadStore } from '../../store/useDownloadStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TrackCard } from '../../components/cards/TrackCard';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const DownloadsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    downloadedTracks,
    downloadStatus,
    downloadProgress,
    downloadErrors,
    failedTracks,
    deleteTrack,
    retryDownload,
    initialize
  } = useDownloadStore();
  const { playTrack } = usePlayerStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const totalBytes = downloadedTracks.length * 4.5 * 1024 * 1024; // approx ~4.5 MB per track
  const storageMb = (totalBytes / (1024 * 1024)).toFixed(1);

  // Active downloading IDs
  const activeDownloadingIds = Object.keys(downloadStatus).filter(
    (id) => downloadStatus[id] === 'DOWNLOADING'
  );

  // Failed IDs
  const failedIds = Object.keys(failedTracks);

  const handleDeleteTrack = (track: any) => {
    Alert.alert(
      'Delete Downloaded Song',
      `Are you sure you want to delete "${track.title}" from your device storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteTrack(track.id);
            const { queue, removeFromQueue } = usePlayerStore.getState();
            const qIdx = queue.findIndex((t) => t.id === track.id);
            if (qIdx >= 0) {
              removeFromQueue(qIdx);
            }
          }
        }
      ]
    );
  };

  const handleRetry = async (trackId: string) => {
    const success = await retryDownload(trackId);
    if (!success) {
      const err = useDownloadStore.getState().getDownloadError(trackId);
      Alert.alert('Download Failed', err || 'Unable to download track.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Downloads</Text>
        <Text style={styles.subtitle}>Stored strictly on your local device &bull; Never synced to cloud</Text>

        <View style={styles.storageCard}>
          <View style={styles.storageTextRow}>
            <Text style={styles.storageLabel}>Offline Storage Used</Text>
            <Text style={styles.storageValue}>{storageMb} MB</Text>
          </View>
          <View style={styles.storageProgressBar}>
            <View
              style={[
                styles.storageProgressFill,
                { width: `${Math.min(100, downloadedTracks.length * 5)}%` }
              ]}
            />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isAuthenticated ? (
          <View style={styles.guestPromptCard}>
            <View style={styles.guestPromptIconCircle}>
              <Text style={styles.guestPromptIconText}>⬇️</Text>
            </View>
            <Text style={styles.guestPromptTitle}>Sign in for Downloads</Text>
            <Text style={styles.guestPromptSubtitle}>
              Sign in to your SyncWave account to access your offline music downloads and stream stored tracks without internet.
            </Text>
            <View style={styles.guestPromptActions}>
              <TouchableOpacity
                style={styles.guestPromptPrimaryBtn}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.8}
              >
                <Text style={styles.guestPromptPrimaryBtnText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.guestPromptSecondaryBtn}
                onPress={() => navigation.navigate('SignUp')}
                activeOpacity={0.8}
              >
                <Text style={styles.guestPromptSecondaryBtnText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            {/* Active Downloads Section */}
            {activeDownloadingIds.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Downloading ({activeDownloadingIds.length})</Text>
                {activeDownloadingIds.map((trackId) => {
                  const progress = downloadProgress[trackId] || 0;
                  return (
                    <View key={trackId} style={styles.progressCard}>
                      <View style={styles.progressHeader}>
                        <ActivityIndicator size="small" color={Colors.accent} />
                        <Text style={styles.progressText}>Downloading track... {progress}%</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Failed Downloads Section */}
            {failedIds.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: Colors.error }]}>Failed Downloads ({failedIds.length})</Text>
                {failedIds.map((trackId) => {
                  const track = failedTracks[trackId];
                  const errorMsg = downloadErrors[trackId] || 'Download failed';
                  if (!track) return null;
                  return (
                    <View key={trackId} style={styles.failedCard}>
                      <View style={styles.failedInfo}>
                        <Text style={styles.failedTitle} numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text style={styles.failedReason} numberOfLines={2}>
                          {errorMsg}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => void handleRetry(trackId)}
                      >
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Downloaded Tracks Section */}
            {downloadedTracks.length > 0 ? (
              <View>
                <View style={styles.downloadedHeaderRow}>
                  <Text style={styles.listHeader}>Available Offline ({downloadedTracks.length})</Text>
                  <TouchableOpacity
                    style={styles.playAllBtn}
                    onPress={() => playTrack(downloadedTracks[0], downloadedTracks)}
                  >
                    <Text style={styles.playAllBtnText}>▶ Play All</Text>
                  </TouchableOpacity>
                </View>

                {downloadedTracks.map((track) => (
                  <View key={track.id} style={styles.trackRowWrapper}>
                    <View style={styles.trackCardContainer}>
                      <TrackCard
                        track={track}
                        size="row"
                        context="download"
                        onPress={() => playTrack(track, downloadedTracks)}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteTrack(track)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.deleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              activeDownloadingIds.length === 0 &&
              failedIds.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No Downloaded Songs</Text>
                  <Text style={styles.emptySubtitle}>
                    Tap the download icon on any song to save it for offline listening without internet.
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Persistent Mini Player */}
      <MiniPlayer onPress={() => navigation.navigate('FullPlayer')} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  storageCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.control,
    padding: Spacing.md,
    marginTop: Spacing.md
  },
  storageTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  storageLabel: {
    ...Typography.caption,
    color: Colors.textSecondary
  },
  storageValue: {
    ...Typography.monoSmall,
    color: Colors.accent
  },
  storageProgressBar: {
    height: 4,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.tag,
    marginTop: Spacing.sm,
    overflow: 'hidden'
  },
  storageProgressFill: {
    height: '100%',
    backgroundColor: Colors.accent
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 80
  },
  sectionContainer: {
    marginBottom: Spacing.lg
  },
  sectionTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.sm
  },
  progressCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.control,
    padding: Spacing.md,
    marginBottom: Spacing.sm
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs
  },
  progressText: {
    ...Typography.caption,
    color: Colors.textSecondary
  },
  progressBarBg: {
    height: 4,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.tag,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accent
  },
  failedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: Radius.control,
    padding: Spacing.md,
    marginBottom: Spacing.sm
  },
  failedInfo: {
    flex: 1,
    marginRight: Spacing.md
  },
  failedTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  failedReason: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: 2
  },
  retryButton: {
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  retryButtonText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  downloadedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  listHeader: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary
  },
  playAllBtn: {
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  playAllBtnText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600'
  },
  trackRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs
  },
  trackCardContainer: {
    flex: 1
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm
  },
  deleteText: {
    fontSize: 14,
    color: Colors.textTertiary
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center'
  },
  emptyTitle: {
    ...Typography.title,
    color: Colors.textSecondary
  },
  emptySubtitle: {
    ...Typography.body2,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xl
  },
  guestPromptCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.lg
  },
  guestPromptIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  guestPromptIconText: {
    fontSize: 24,
    color: Colors.accent
  },
  guestPromptTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs
  },
  guestPromptSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md
  },
  guestPromptActions: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  guestPromptPrimaryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control
  },
  guestPromptPrimaryBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#000000'
  },
  guestPromptSecondaryBtn: {
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control
  },
  guestPromptSecondaryBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  footerSpacing: {
    height: 60
  }
});
