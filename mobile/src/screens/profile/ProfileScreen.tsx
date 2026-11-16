import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { recommendationApi } from '../../api/recommendationApi';
import { ProfileStats, ProfileSongRewatchStat } from '../../api/types';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    selectedLanguages,
    selectedDirectors,
    selectedSingers,
    resetPreferences
  } = useRecommendationStore();
  const { playTrack } = usePlayerStore();
  const { user, isAuthenticated, hydrate, logout, updateProfile } = useAuthStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    if (!editDisplayName.trim()) return;
    setIsSavingProfile(true);
    setProfileError(null);
    const res = await updateProfile({ displayName: editDisplayName.trim() });
    setIsSavingProfile(false);
    if (res.ok) {
      setIsEditModalVisible(false);
    } else {
      setProfileError(res.error || 'Failed to update profile');
    }
  };

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const data = await recommendationApi.getProfileStats();
      setStats(data);
    } catch {
      // Fallback safely when offline
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadStats();
    } else {
      setStats(null);
    }
  }, [isAuthenticated, loadStats]);

  const handleReconfigure = () => {
    navigation.navigate('LanguageSelection');
  };

  const handleReset = async () => {
    await resetPreferences();
    navigation.navigate('LanguageSelection');
  };

  const handlePlayRewatched = (item: ProfileSongRewatchStat) => {
    playTrack({
      id: item.songId,
      title: item.title,
      artist: item.artist,
      album: 'Profile Rewatched',
      durationMs: 240000,
      artworkUrl: item.artworkUrl,
      sourcePlatform: 'YOUTUBE',
      sourceUrl: item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : 'https://www.youtube.com',
      isPlayableDirectly: true
    });
  };

  const fallbackFavArtist =
    stats?.favouriteArtist?.name || selectedDirectors[0] || selectedSingers[0] || null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.title}>Your Profile</Text>
            <Text style={styles.subtitle}>Listening stats, favourite artist &amp; settings</Text>
          </View>
          <TouchableOpacity onPress={loadStats} style={styles.refreshBtn}>
            {isLoadingStats ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={styles.editAction}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {isAuthenticated ? (user?.displayName || 'S').charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.userName}>
                {isAuthenticated ? (user?.displayName || 'SyncWave Listener') : 'Guest Listener'}
              </Text>
              {isAuthenticated && (
                <TouchableOpacity
                  onPress={() => {
                    setEditDisplayName(user?.displayName || '');
                    setProfileError(null);
                    setIsEditModalVisible(true);
                  }}
                  style={{ padding: 2 }}
                >
                  <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.userType}>
              {isAuthenticated && user?.email
                ? `${user.email} • ${user.authProvider === 'GOOGLE' ? 'Google' : 'Verified'}`
                : 'Sign in to access your listening analytics'}
            </Text>
          </View>
          {isAuthenticated ? (
            <TouchableOpacity
              onPress={() => void logout()}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: Radius.control,
                borderWidth: 1,
                borderColor: Colors.hairline,
              }}
            >
              <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                Sign out
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: Radius.control,
                backgroundColor: Colors.accent,
              }}
            >
              <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>Sign in</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isAuthenticated ? (
          /* =========================================
             CLEAN GUEST PROFILE VIEW
             Prompt to sign in, with no stale analytics
             or previous user personal stats.
             ========================================= */
          <View>
            <View style={styles.guestPromptCard}>
              <Text style={styles.guestPromptTitle}>Sign in to SyncWave</Text>
              <Text style={styles.guestPromptSubtitle}>
                Sign in to view your personalized listening statistics, top artists, listening history, and sync your music across all devices.
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

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Settings')}>
              <Text style={styles.actionRowTitle}>Audio &amp; Engine Settings</Text>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* =========================================
             AUTHENTICATED USER ANALYTICS & STATS
             ========================================= */
          <View>
            {/* KPI Stats Summary Row */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{stats?.summary.totalPlays ?? 0}</Text>
                <Text style={styles.kpiLabel}>Total Plays</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: Colors.accent }]}>
                  {stats?.summary.totalRewatches ?? 0}
                </Text>
                <Text style={styles.kpiLabel}>Rewatches</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>
                  {stats?.summary.uniqueArtistsListened ?? 0}
                </Text>
                <Text style={styles.kpiLabel}>Artists</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>
                  {stats?.summary?.formattedListeningTime ||
                    (typeof stats?.totalListeningHours === 'number' && stats.totalListeningHours > 0
                      ? `${stats.totalListeningHours}h`
                      : `${stats?.summary?.totalListeningMinutes ?? 0}m`)}
                </Text>
                <Text style={styles.kpiLabel}>Time</Text>
              </View>
            </View>

        {/* 1. Favourite Artist */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Favourite Artist</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MusicPreferences')}>
              <Text style={styles.editAction}>Edit</Text>
            </TouchableOpacity>
          </View>

          {fallbackFavArtist ? (
            <View style={styles.highlightRow}>
              {stats?.favouriteArtist?.imageUrl ? (
                <Image
                  source={{ uri: stats.favouriteArtist.imageUrl }}
                  style={styles.artistAvatar}
                />
              ) : (
                <View style={styles.artistAvatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{fallbackFavArtist[0]}</Text>
                </View>
              )}
              <View style={styles.highlightMeta}>
                <Text style={styles.highlightBadge}>#1 FAVOURITE ARTIST</Text>
                <Text style={styles.highlightName}>{fallbackFavArtist}</Text>
                <Text style={styles.cardCountText}>
                  {stats?.favouriteArtist?.roleTitle || 'Selected Artist'} &bull;{' '}
                  {selectedDirectors.length + selectedSingers.length} total favourites
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>No favourite artists selected yet.</Text>
          )}

          <View style={styles.tagsRow}>
            {[...selectedDirectors, ...selectedSingers].slice(0, 8).map((art) => (
              <View key={art} style={styles.tag}>
                <Text style={styles.tagText}>{art}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 2. Most Listened Artist */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Most Listened Artist</Text>
            <Text style={styles.cardCountText}>By plays</Text>
          </View>

          {stats?.mostListenedArtist ? (
            <View>
              <View style={styles.highlightRow}>
                {stats.mostListenedArtist.imageUrl ? (
                  <Image
                    source={{ uri: stats.mostListenedArtist.imageUrl }}
                    style={[styles.artistAvatar, { borderColor: '#34D399' }]}
                  />
                ) : (
                  <View style={[styles.artistAvatarPlaceholder, { borderColor: '#34D399' }]}>
                    <Text style={styles.avatarLetter}>{stats.mostListenedArtist.name[0]}</Text>
                  </View>
                )}
                <View style={styles.highlightMeta}>
                  <Text style={[styles.highlightBadge, { color: '#34D399' }]}>MOST PLAYED ARTIST</Text>
                  <Text style={styles.highlightName}>{stats.mostListenedArtist.name}</Text>
                  <Text style={styles.cardCountText}>
                    {stats.mostListenedArtist.playCount} plays &bull;{' '}
                    {stats.mostListenedArtist.uniqueSongsCount} songs
                  </Text>
                </View>
              </View>

              {stats.topListenedArtists.slice(0, 5).map((art, index) => (
                <View key={art.name} style={styles.listRow}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                  <Text style={styles.listTitle} numberOfLines={1}>{art.name}</Text>
                  <Text style={styles.listMetric}>{art.playCount} plays</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Play tracks to discover your most listened artist.</Text>
          )}
        </View>

        {/* 3. Most Number of Times Songs Rewatched */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Most Rewatched Songs</Text>
            <Text style={styles.cardCountText}>
              {stats?.mostRewatchedSongs.length ?? 0} songs
            </Text>
          </View>

          {stats?.mostRewatchedSongs && stats.mostRewatchedSongs.length > 0 ? (
            stats.mostRewatchedSongs.slice(0, 8).map((song, idx) => (
              <TouchableOpacity
                key={`${song.songId}_${idx}`}
                style={styles.songRewatchRow}
                onPress={() => handlePlayRewatched(song)}
                activeOpacity={0.75}
              >
                <Text style={[styles.rankText, idx === 0 && { color: Colors.accent }]}>
                  #{idx + 1}
                </Text>
                <Image source={{ uri: song.artworkUrl }} style={styles.songThumb} />
                <View style={styles.songMeta}>
                  <Text style={styles.listTitle} numberOfLines={1}>{song.title}</Text>
                  <Text style={styles.cardCountText} numberOfLines={1}>{song.artist}</Text>
                </View>
                <View style={styles.rewatchBadgeCol}>
                  <Text style={styles.rewatchCount}>{song.playCount} plays</Text>
                  {song.rewatchCount > 0 ? (
                    <Text style={styles.rewatchSub}>{song.rewatchCount} rewatched</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>
              Replay songs multiple times to see your top rewatched tracks here.
            </Text>
          )}
        </View>

        {/* 4. Top Music Directors */}
        {stats?.topListenedDirectors && stats.topListenedDirectors.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Top Music Directors</Text>
              <Text style={styles.cardCountText}>Ranked by plays</Text>
            </View>
            {stats.topListenedDirectors.slice(0, 5).map((dir, idx) => (
              <View key={dir.name} style={styles.listRow}>
                <Text style={styles.rankText}>#{idx + 1}</Text>
                <Text style={styles.listTitle} numberOfLines={1}>{dir.name}</Text>
                <Text style={styles.listMetric}>{dir.playCount} plays</Text>
              </View>
            ))}
          </View>
        )}

        {/* 5. Language Breakdown */}
        {stats?.languageBreakdown && stats.languageBreakdown.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Language Breakdown</Text>
              <Text style={styles.cardCountText}>Distribution</Text>
            </View>
            {stats.languageBreakdown.map((item) => (
              <View key={item.language} style={styles.listRow}>
                <Text style={styles.listTitle}>{item.language}</Text>
                <Text style={styles.listMetric}>{item.count} songs ({item.percentage}%)</Text>
              </View>
            ))}
          </View>
        )}

        {/* 6. Daily Activity (7 Days) */}
        {stats?.dailyActivity && stats.dailyActivity.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Daily Activity (Last 7 Days)</Text>
              <Text style={styles.cardCountText}>Plays per day</Text>
            </View>
            <View style={styles.activityGrid}>
              {stats.dailyActivity.map((day) => (
                <View key={day.date} style={styles.activityDayCol}>
                  <Text style={styles.activityPlays}>{day.plays > 0 ? day.plays : '-'}</Text>
                  <Text style={styles.activityDayName}>{day.day}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Selected Languages Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Preferred Music Languages</Text>
            <TouchableOpacity onPress={handleReconfigure}>
              <Text style={styles.editAction}>Change</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tagsRow}>
            {selectedLanguages.map((lang) => (
              <View key={lang} style={styles.tag}>
                <Text style={styles.tagText}>{lang}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.actionRowTitle}>Audio &amp; Engine Settings</Text>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>Reset Onboarding &amp; Recommendations</Text>
        </TouchableOpacity>
        </View>
        )}

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Persistent Mini Player */}
      <MiniPlayer onPress={() => navigation.navigate('FullPlayer')} />

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.modalCard}>
            <Text style={modalStyles.modalTitle}>Edit Profile</Text>
            {profileError ? (
              <Text style={modalStyles.errorText}>{profileError}</Text>
            ) : null}
            <Text style={modalStyles.label}>Display Name</Text>
            <TextInput
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              placeholder="Your display name"
              placeholderTextColor={Colors.textTertiary}
              style={modalStyles.input}
              maxLength={50}
              autoCapitalize="words"
            />
            <View style={modalStyles.btnRow}>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={modalStyles.cancelBtn}
              >
                <Text style={modalStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={isSavingProfile || !editDisplayName.trim()}
                style={[
                  modalStyles.saveBtn,
                  (isSavingProfile || !editDisplayName.trim()) && { opacity: 0.5 },
                ]}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={modalStyles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.lg,
  },
  modalTitle: {
    ...Typography.subheading,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    height: 42,
    marginBottom: Spacing.lg,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control,
  },
  saveText: {
    ...Typography.bodyMedium,
    color: '#000',
    fontWeight: '700',
  },
});

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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  refreshBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4
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
  content: {
    padding: Spacing.xl,
    paddingBottom: 80
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.circle,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.accent
  },
  userInfo: {
    marginLeft: Spacing.md,
    flex: 1
  },
  userName: {
    ...Typography.bodyMedium,
    fontSize: 16,
    color: Colors.textPrimary
  },
  userType: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    alignItems: 'center'
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  kpiLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary
  },
  cardCountText: {
    ...Typography.caption,
    fontFamily: Typography.monoSmall.fontFamily,
    color: Colors.textTertiary,
    marginTop: 2
  },
  editAction: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600'
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs
  },
  artistAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.accent
  },
  artistAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center'
  },
  highlightMeta: {
    marginLeft: Spacing.md,
    flex: 1
  },
  highlightBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.6
  },
  highlightName: {
    ...Typography.bodyMedium,
    fontSize: 16,
    color: Colors.textPrimary,
    marginTop: 2
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  rankText: {
    width: 26,
    fontFamily: Typography.monoSmall.fontFamily,
    fontSize: 12,
    color: Colors.textTertiary
  },
  listTitle: {
    ...Typography.body,
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13
  },
  listMetric: {
    ...Typography.caption,
    color: Colors.accent,
    fontFamily: Typography.monoSmall.fontFamily
  },
  songRewatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  songThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: Colors.surfaceRaised,
    marginRight: Spacing.sm
  },
  songMeta: {
    flex: 1,
    paddingRight: Spacing.sm
  },
  rewatchBadgeCol: {
    alignItems: 'flex-end'
  },
  rewatchCount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent
  },
  rewatchSub: {
    fontSize: 10,
    color: '#34D399'
  },
  emptyText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm
  },
  activityGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm
  },
  activityDayCol: {
    alignItems: 'center',
    gap: 4
  },
  activityPlays: {
    ...Typography.monoSmall,
    color: Colors.accent,
    fontWeight: '700'
  },
  activityDayName: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textTertiary
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm
  },
  tag: {
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.tag,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs
  },
  tagText: {
    ...Typography.caption,
    color: Colors.textSecondary
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  actionRowTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary
  },
  chevron: {
    fontSize: 16,
    color: Colors.textTertiary
  },
  resetButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm
  },
  resetButtonText: {
    ...Typography.caption,
    color: Colors.error
  },
  guestPromptCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg
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
    paddingHorizontal: Spacing.sm
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
