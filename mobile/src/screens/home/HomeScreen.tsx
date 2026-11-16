import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Track } from '../../api/types';
import { TrackCard } from '../../components/cards/TrackCard';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

const AVAILABLE_LANGUAGES = ['ALL', 'Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'English'] as const;

const SectionBlock: React.FC<{
  title: string;
  subtitle?: string;
  tracks: Track[];
  onPlay: (track: Track, queue: Track[]) => void;
  horizontal?: boolean;
}> = ({ title, subtitle, tracks, onPlay, horizontal = true }) => {
  if (!tracks || tracks.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderTextCol}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <Text style={styles.countText}>
          {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
        </Text>
      </View>

      {horizontal ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              size="standard"
              onPress={() => onPlay(track, tracks)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.verticalListContainer}>
          {tracks.slice(0, 8).map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              size="row"
              onPress={() => onPlay(track, tracks)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { feed, isLoadingFeed, fetchFeed } = useRecommendationStore();
  const { playTrack } = usePlayerStore();
  const { isAuthenticated } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchFeed(selectedLanguageFilter !== 'ALL' ? selectedLanguageFilter : undefined);
  }, [fetchFeed, selectedLanguageFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeed(selectedLanguageFilter !== 'ALL' ? selectedLanguageFilter : undefined);
    setRefreshing(false);
  };

  // Filter helper for public catalogue
  const filterByLang = (tracks: Track[]) => {
    if (selectedLanguageFilter === 'ALL') return tracks;
    return tracks.filter(
      (t) => (t.language || '').toLowerCase() === selectedLanguageFilter.toLowerCase()
    );
  };

  // Personalized tracks (authenticated only)
  const recommendedTracks = useMemo(() => feed?.recommendedForYou || [], [feed]);
  const basedOnHistory = useMemo(() => feed?.basedOnListeningHistory?.tracks || [], [feed]);
  const moreFromArtists = useMemo(() => feed?.moreFromFavouriteArtists || [], [feed]);
  const sameDirector = useMemo(() => feed?.sameMusicDirector?.tracks || [], [feed]);
  const directorName = useMemo(() => feed?.sameMusicDirector?.director || 'Top Composer', [feed]);
  const recentlyPlayed = useMemo(() => feed?.recentlyPlayed || [], [feed]);

  // Public / general tracks (available to everyone)
  const trending = useMemo(() => filterByLang(feed?.trendingInLanguages || []), [feed, selectedLanguageFilter]);
  const discoverNew = useMemo(() => filterByLang(feed?.discoverNewMusic || []), [feed, selectedLanguageFilter]);
  const similarSongs = useMemo(() => filterByLang(feed?.similarSongs || []), [feed, selectedLanguageFilter]);

  // Combined public catalog
  const publicSongs = useMemo(() => {
    const map = new Map<string, Track>();
    [...trending, ...discoverNew, ...similarSongs].forEach((t) => map.set(t.id, t));
    return Array.from(map.values());
  }, [trending, discoverNew, similarSongs]);

  const hasAnyContent = isAuthenticated
    ? recommendedTracks.length > 0 ||
      basedOnHistory.length > 0 ||
      moreFromArtists.length > 0 ||
      sameDirector.length > 0 ||
      trending.length > 0 ||
      recentlyPlayed.length > 0 ||
      discoverNew.length > 0
    : publicSongs.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>{isAuthenticated ? 'Home' : 'Explore Music'}</Text>
          <Text style={styles.headerSubtitle}>
            {isAuthenticated
              ? 'Smart recommendations tailored to your taste profile'
              : 'Public song catalogue & trending music releases'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {isAuthenticated ? (
            recommendedTracks.length > 0 ? (
              <TouchableOpacity
                style={styles.playAllButton}
                onPress={() => playTrack(recommendedTracks[0], recommendedTracks)}
                activeOpacity={0.8}
              >
                <Text style={styles.playAllText}>Play all</Text>
              </TouchableOpacity>
            ) : null
          ) : (
            <TouchableOpacity
              style={styles.signInHeaderBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.8}
            >
              <Text style={styles.signInHeaderBtnText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          !hasAnyContent && styles.emptyListContent
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {/* Guest Sign-In Banner */}
        {!isAuthenticated && (
          <View style={styles.guestBanner}>
            <View style={styles.guestBannerTextCol}>
              <Text style={styles.guestBannerTitle}>Welcome to SyncWave</Text>
              <Text style={styles.guestBannerSubtitle}>
                Sign in to unlock personalized daily mixes, save favorite songs, build custom playlists, and sync playback across your devices.
              </Text>
            </View>
            <View style={styles.guestBannerActions}>
              <TouchableOpacity
                style={styles.guestBannerPrimaryBtn}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.8}
              >
                <Text style={styles.guestBannerPrimaryBtnText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.guestBannerSecondaryBtn}
                onPress={() => navigation.navigate('SignUp')}
                activeOpacity={0.8}
              >
                <Text style={styles.guestBannerSecondaryBtnText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Public Language Selector Bar (always available in Guest mode) */}
        {!isAuthenticated && (
          <View style={styles.languageBarContainer}>
            <Text style={styles.languageBarLabel}>Available Languages:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageBarScroll}>
              {AVAILABLE_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguageFilter === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langPill, isSelected && styles.activeLangPill]}
                    onPress={() => setSelectedLanguageFilter(lang)}
                  >
                    <Text style={[styles.langPillText, isSelected && styles.activeLangPillText]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {isLoadingFeed && !hasAnyContent ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.stateTitle}>
              {isAuthenticated ? 'Loading personalized feed...' : 'Loading public song catalogue...'}
            </Text>
          </View>
        ) : !hasAnyContent ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>
              {isAuthenticated ? 'No recommended songs yet' : 'Public catalogue loading...'}
            </Text>
            <Text style={styles.stateSubtitle}>
              {isAuthenticated
                ? 'Pull down or refresh to build recommendations from your taste profile.'
                : 'Pull down or refresh to load public songs.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyActionText}>Refresh songs</Text>
            </TouchableOpacity>
          </View>
        ) : isAuthenticated ? (
          /* =========================================
             AUTHENTICATED USER PERSONALIZED EXPERIENCE
             ========================================= */
          <View style={styles.sectionsWrapper}>
            {/* 1. Recommended for You */}
            <SectionBlock
              title="Recommended for You"
              subtitle="Personalized mix based on your taste and favorites"
              tracks={recommendedTracks}
              onPlay={playTrack}
              horizontal={false}
            />

            {/* 2. Based on Your Listening History */}
            <SectionBlock
              title="Based on Your Listening History"
              subtitle={
                feed?.basedOnListeningHistory?.basedOn
                  ? `Inspired by ${feed.basedOnListeningHistory.basedOn}`
                  : 'Tracks inspired by your past listening'
              }
              tracks={basedOnHistory}
              onPlay={playTrack}
            />

            {/* 3. More from Your Favourite Artists */}
            <SectionBlock
              title="More from Your Favourite Artists"
              subtitle="Picks from your selected composers and singers"
              tracks={moreFromArtists}
              onPlay={playTrack}
            />

            {/* 4. Same Music Director */}
            <SectionBlock
              title={`Same Music Director (${directorName})`}
              subtitle={`Compositions by ${directorName}`}
              tracks={sameDirector}
              onPlay={playTrack}
            />

            {/* 5. Trending in Your Language */}
            <SectionBlock
              title="Trending in Your Language"
              subtitle="Popular tracks across your chosen languages"
              tracks={trending}
              onPlay={playTrack}
            />

            {/* 6. Recently Played */}
            <SectionBlock
              title="Recently Played"
              subtitle="Jump back into your recent listening sessions"
              tracks={recentlyPlayed}
              onPlay={playTrack}
            />

            {/* 7. Discover New Music */}
            <SectionBlock
              title="Discover New Music"
              subtitle="Fresh additions outside your frequent rotations"
              tracks={discoverNew}
              onPlay={playTrack}
            />
          </View>
        ) : (
          /* =========================================
             CLEAN GUEST MODE (PUBLIC SONGS ONLY)
             No personal playlists, favorites, history,
             or profile information.
             ========================================= */
          <View style={styles.sectionsWrapper}>
            {/* 1. Public Song Catalogue */}
            <SectionBlock
              title="Public Song Catalogue"
              subtitle="Stream and enjoy publicly available tracks"
              tracks={publicSongs.slice(0, 10)}
              onPlay={playTrack}
              horizontal={false}
            />

            {/* 2. Trending Releases */}
            <SectionBlock
              title="Trending Releases"
              subtitle="Popular hits across all available languages"
              tracks={trending}
              onPlay={playTrack}
            />

            {/* 3. New & Notable Music */}
            <SectionBlock
              title="New & Notable"
              subtitle="Newly added public tracks"
              tracks={discoverNew}
              onPlay={playTrack}
            />

            {/* 4. Featured Soundtracks */}
            <SectionBlock
              title="Featured Soundtracks"
              subtitle="Top film scores and memorable soundtracks"
              tracks={similarSongs}
              onPlay={playTrack}
            />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md
  },
  headerTitleContainer: {
    flex: 1
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs
  },
  playAllButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6
  },
  playAllText: {
    ...Typography.caption,
    color: '#000000',
    fontWeight: '600'
  },
  signInHeaderBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6
  },
  signInHeaderBtnText: {
    ...Typography.caption,
    color: '#000000',
    fontWeight: '700'
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: 96
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  guestBanner: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.lg
  },
  guestBannerTextCol: {
    marginBottom: Spacing.md
  },
  guestBannerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: 4
  },
  guestBannerSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18
  },
  guestBannerActions: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  guestBannerPrimaryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control
  },
  guestBannerPrimaryBtnText: {
    ...Typography.caption,
    color: '#000000',
    fontWeight: '700'
  },
  guestBannerSecondaryBtn: {
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control
  },
  guestBannerSecondaryBtnText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  languageBarContainer: {
    marginBottom: Spacing.lg
  },
  languageBarLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
    fontWeight: '600'
  },
  languageBarScroll: {
    flexDirection: 'row',
    gap: Spacing.xs
  },
  langPill: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.tag,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4
  },
  activeLangPill: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent
  },
  langPillText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500'
  },
  activeLangPillText: {
    color: '#000000',
    fontWeight: '700'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  sectionsWrapper: {
    gap: Spacing.xl
  },
  sectionContainer: {
    marginBottom: Spacing.md
  },
  sectionHeaderTextCol: {
    flex: 1,
    marginRight: Spacing.sm
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  horizontalScrollContent: {
    paddingRight: Spacing.md,
    paddingTop: Spacing.xs
  },
  verticalListContainer: {
    gap: 0
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary
  },
  countText: {
    ...Typography.monoSmall,
    color: Colors.textTertiary
  },
  stateCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm
  },
  stateTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    textAlign: 'center'
  },
  stateSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center'
  },
  emptyActionButton: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm
  },
  emptyActionText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '500'
  },
  footerSpacing: {
    height: 60
  }
});
