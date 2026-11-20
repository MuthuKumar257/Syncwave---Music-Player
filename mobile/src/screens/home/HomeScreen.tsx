import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Track, DailyMixItem } from '../../api/types';
import { TrackCard } from '../../components/cards/TrackCard';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { useBottomBarOffset } from '../../utils/responsive';
import { filterTracksByLanguage } from '../../utils/languageEligibility';

const AVAILABLE_LANGUAGES = ['ALL', 'Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'English'] as const;

const DailyMixBlock: React.FC<{
  mixes: DailyMixItem[];
  onPlayMix: (mix: DailyMixItem) => void;
}> = ({ mixes, onPlayMix }) => {
  if (!mixes || mixes.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderTextCol}>
          <Text style={styles.sectionTitle}>Your Daily Mix</Text>
          <Text style={styles.sectionSubtitle}>Personalized daily rotations based on your taste and habits</Text>
        </View>
        <Text style={styles.countText}>{mixes.length} {mixes.length === 1 ? 'mix' : 'mixes'}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {mixes.map((mix) => (
          <TouchableOpacity
            key={mix.id}
            style={styles.dailyMixCard}
            onPress={() => onPlayMix(mix)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: mix.coverUrl }}
              style={styles.dailyMixCover}
              resizeMode="cover"
            />
            <View style={styles.dailyMixInfo}>
              <Text style={styles.dailyMixTitle} numberOfLines={1}>{mix.title}</Text>
              <Text style={styles.dailyMixSubtitle} numberOfLines={2}>{mix.subtitle}</Text>
              <Text style={styles.dailyMixCount}>{mix.tracks?.length || mix.trackCount} tracks</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const SectionBlock: React.FC<{
  title: string;
  subtitle?: string;
  tracks: Track[];
  onPlay: (track: Track, queue: Track[]) => void;
  horizontal?: boolean;
}> = ({ title, subtitle, tracks, onPlay, horizontal = true }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
              onPress={() => navigation.navigate('SongDetail', { songId: track.id, autoPlay: false })}
              onPlayPress={() => onPlay(track, tracks)}
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
              onPress={() => navigation.navigate('SongDetail', { songId: track.id, autoPlay: false })}
              onPlayPress={() => onPlay(track, tracks)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    feed,
    baseSections,
    baseCatalogue,
    isLoadingFeed,
    isLoadingBase,
    feedError,
    baseError,
    selectedLanguages,
    fetchFeed,
    fetchBaseFeed
  } = useRecommendationStore();
  const { playTrack } = usePlayerStore();
  const { isAuthenticated } = useAuthStore();
  const bottomOffset = useBottomBarOffset();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>('ALL');

  useEffect(() => {
    const lang = selectedLanguageFilter !== 'ALL' ? selectedLanguageFilter : undefined;
    fetchFeed(lang);
    fetchBaseFeed(lang);
  }, [fetchFeed, fetchBaseFeed, selectedLanguageFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    const lang = selectedLanguageFilter !== 'ALL' ? selectedLanguageFilter : undefined;
    await Promise.all([fetchFeed(lang), fetchBaseFeed(lang)]);
    setRefreshing(false);
  };

  // Strict language filtering helper:
  // When selectedLanguageFilter === 'ALL', strictly filters by user's selectedLanguages!
  // When selectedLanguageFilter !== 'ALL', strictly filters by that language!
  const filterByLang = useCallback(
    (tracks: Track[]): Track[] => {
      return filterTracksByLanguage(tracks, selectedLanguages, selectedLanguageFilter);
    },
    [selectedLanguages, selectedLanguageFilter]
  );

  // Personalized tracks (with base catalogue fallback)
  const madeForYou = useMemo(() => {
    const rec = feed?.madeForYou || feed?.recommendedForYou || [];
    const source = rec.length > 0 ? rec : (baseSections?.recommended || []);
    return filterByLang(source);
  }, [feed, baseSections, filterByLang]);

  const dailyMixes = useMemo(() => {
    const rawMixes = feed?.dailyMixes || [];
    return rawMixes
      .map((mix) => ({
        ...mix,
        tracks: filterByLang(mix.tracks || [])
      }))
      .filter((mix) => (mix.tracks?.length || 0) > 0);
  }, [feed, filterByLang]);

  const becauseYouListenedTo = useMemo(() => {
    const tracks = feed?.becauseYouListenedTo?.tracks || feed?.basedOnListeningHistory?.tracks || [];
    return filterByLang(tracks);
  }, [feed, filterByLang]);

  const basedOnArtist = feed?.becauseYouListenedTo?.basedOn || feed?.basedOnListeningHistory?.basedOn || '';
  const basedOnFavouriteArtists = useMemo(() => {
    const tracks = feed?.basedOnFavouriteArtists || feed?.moreFromFavouriteArtists || [];
    return filterByLang(tracks);
  }, [feed, filterByLang]);

  const basedOnFavouriteDirectors = useMemo(() => {
    const tracks = feed?.basedOnFavouriteDirectors || feed?.sameMusicDirector?.tracks || [];
    return filterByLang(tracks);
  }, [feed, filterByLang]);

  const directorName = useMemo(() => feed?.sameMusicDirector?.director || 'Top Composer', [feed]);
  const recentlyPlayed = useMemo(() => {
    return filterByLang(feed?.recentlyPlayed || []);
  }, [feed, filterByLang]);

  const favouriteSongs = useMemo(() => {
    return filterByLang(feed?.favouriteSongs || []);
  }, [feed, filterByLang]);

  const similarToFavouriteSongs = useMemo(() => {
    const tracks = feed?.similarToFavouriteSongs || feed?.similarSongs || [];
    return filterByLang(tracks);
  }, [feed, filterByLang]);

  const trending = useMemo(() => {
    const recTrending = feed?.trendingInLanguages || [];
    const source = recTrending.length > 0 ? recTrending : (baseSections?.trending || []);
    return filterByLang(source);
  }, [feed, baseSections, filterByLang]);

  const popularSongs = useMemo(() => {
    const recPop = feed?.popularSongs || [];
    const source = recPop.length > 0 ? recPop : (baseSections?.popularSongs || []);
    return filterByLang(source);
  }, [feed, baseSections, filterByLang]);

  const recentlyAdded = useMemo(() => {
    return filterByLang(baseSections?.recentlyAdded || []);
  }, [baseSections, filterByLang]);

  const exploreAllCatalogue = useMemo(() => {
    return filterByLang(baseSections?.allAvailable || baseCatalogue || []);
  }, [baseSections, baseCatalogue, filterByLang]);

  const newReleases = useMemo(() => {
    return filterByLang(feed?.newReleases || []);
  }, [feed, filterByLang]);

  const discoverNew = useMemo(() => {
    return filterByLang(feed?.discoverSomethingNew || feed?.discoverNewMusic || []);
  }, [feed, filterByLang]);

  const continueListening = useMemo(() => {
    return filterByLang(feed?.continueListening || []);
  }, [feed, filterByLang]);

  const songsYouMayLike = useMemo(() => {
    return filterByLang(feed?.songsYouMayLike || []);
  }, [feed, filterByLang]);

  const recommendedTracks = madeForYou;
  const similarSongs = similarToFavouriteSongs;

  // Featured recommendation track
  const featuredTrack = useMemo(() => {
    return madeForYou[0] || trending[0] || popularSongs[0] || null;
  }, [madeForYou, trending, popularSongs]);

  // Combined public catalog
  const publicSongs = useMemo(() => {
    if (exploreAllCatalogue.length > 0) return exploreAllCatalogue;
    const map = new Map<string, Track>();
    [...trending, ...discoverNew, ...similarToFavouriteSongs].forEach((t) => map.set(t.id, t));
    return Array.from(map.values());
  }, [exploreAllCatalogue, trending, discoverNew, similarToFavouriteSongs]);

  const hasAnyContent = isAuthenticated
    ? madeForYou.length > 0 ||
      dailyMixes.length > 0 ||
      becauseYouListenedTo.length > 0 ||
      basedOnFavouriteArtists.length > 0 ||
      basedOnFavouriteDirectors.length > 0 ||
      trending.length > 0 ||
      popularSongs.length > 0 ||
      recentlyAdded.length > 0 ||
      recentlyPlayed.length > 0 ||
      favouriteSongs.length > 0 ||
      exploreAllCatalogue.length > 0 ||
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

        {/* Language Selector Bar */}
        {selectedLanguages.length > 0 ? (
          <View style={styles.languageBarContainer}>
            <Text style={styles.languageBarLabel}>Your Languages:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageBarScroll}>
              {['ALL', ...selectedLanguages].map((lang) => {
                const isSelected = selectedLanguageFilter === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langPill, isSelected && styles.activeLangPill]}
                    onPress={() => setSelectedLanguageFilter(lang)}
                  >
                    <Text style={[styles.langPillText, isSelected && styles.activeLangPillText]}>
                      {lang === 'ALL' ? 'All Selected' : lang}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.langPill, { borderColor: Colors.accent }]}
                onPress={() => navigation.navigate('LanguageSelection')}
              >
                <Text style={[styles.langPillText, { color: Colors.accent }]}>+ Edit</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : !isAuthenticated ? (
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
        ) : null}

        {/* Error Notice if recommendation API had an issue */}
        {feedError ? (
          <View style={styles.errorNoticeContainer}>
            <View style={styles.errorNoticeCol}>
              <Text style={styles.errorNoticeTitle}>Could not refresh recommendations</Text>
              <Text style={styles.errorNoticeSubtitle}>{feedError}</Text>
            </View>
            <TouchableOpacity
              style={styles.errorNoticeRetryBtn}
              onPress={() => fetchFeed(selectedLanguageFilter !== 'ALL' ? selectedLanguageFilter : undefined)}
              activeOpacity={0.8}
            >
              <Text style={styles.errorNoticeRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Language Selection Prompt if 0 languages are selected */}
        {(feed?.requiresLanguageSelection || (isAuthenticated && selectedLanguages.length === 0)) ? (
          <View style={styles.languagePromptContainer}>
            <Text style={styles.languagePromptTitle}>Select Your Preferred Languages</Text>
            <Text style={styles.languagePromptSubtitle}>
              SyncWave tailors your music recommendations strictly to your chosen languages. Pick languages to unlock personalized daily mixes!
            </Text>
            <TouchableOpacity
              style={styles.languagePromptButton}
              onPress={() => navigation.navigate('LanguageSelection')}
              activeOpacity={0.8}
            >
              <Text style={styles.languagePromptButtonText}>Select Languages</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(isLoadingFeed || isLoadingBase) && !hasAnyContent ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.stateTitle}>
              {isAuthenticated ? 'Loading music catalogue & feed...' : 'Loading public song catalogue...'}
            </Text>
          </View>
        ) : !hasAnyContent ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>
              {isAuthenticated ? 'No songs available in selected languages' : 'Public catalogue empty'}
            </Text>
            <Text style={styles.stateSubtitle}>
              {isAuthenticated
                ? 'Try picking more languages or pulling down to refresh songs.'
                : 'Pull down or tap below to refresh songs.'}
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
            {/* Featured Recommendation Hero Banner */}
            {featuredTrack ? (
              <View style={styles.featuredHeroContainer}>
                <View style={styles.featuredTagRow}>
                  <View style={styles.accentDot} />
                  <Text style={styles.featuredTagText}>FEATURED RECOMMENDATION</Text>
                  {featuredTrack.language ? (
                    <Text style={styles.featuredLangText}>• {featuredTrack.language}</Text>
                  ) : null}
                </View>
                <View style={styles.featuredBodyRow}>
                  <Image
                    source={{
                      uri:
                        featuredTrack.artworkUrl ||
                        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'
                    }}
                    style={styles.featuredArtwork}
                  />
                  <View style={styles.featuredInfo}>
                    <Text style={styles.featuredTitle} numberOfLines={1}>
                      {featuredTrack.title}
                    </Text>
                    <Text style={styles.featuredArtist} numberOfLines={1}>
                      {featuredTrack.composer || featuredTrack.artist}
                    </Text>
                    <Text style={styles.featuredReason} numberOfLines={2}>
                      {featuredTrack.recommendationReason ||
                        `Curated for your profile based on your interest in ${featuredTrack.composer || featuredTrack.artist || 'music'}`}
                    </Text>
                    <TouchableOpacity
                      style={styles.featuredPlayBtn}
                      onPress={() => playTrack(featuredTrack)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.featuredPlayBtnText}>▶ Play Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {/* 1. Made for You */}
            <SectionBlock
              title="Made for You"
              subtitle="Personalized mix based on your taste and favorites"
              tracks={madeForYou}
              onPlay={playTrack}
              horizontal={false}
            />

            {/* 2. Your Daily Mix */}
            <DailyMixBlock
              mixes={dailyMixes}
              onPlayMix={(mix) => {
                if (mix.tracks && mix.tracks.length > 0) {
                  playTrack(mix.tracks[0], mix.tracks);
                }
              }}
            />

            {/* 3. Because You Listened To */}
            <SectionBlock
              title="Because You Listened To"
              subtitle={
                basedOnArtist
                  ? `Inspired by ${basedOnArtist}`
                  : 'Tracks inspired by your past listening'
              }
              tracks={becauseYouListenedTo}
              onPlay={playTrack}
            />

            {/* 4. Based on Your Favourite Artists */}
            <SectionBlock
              title="Based on Your Favourite Artists"
              subtitle="Picks from your selected singers and vocalists"
              tracks={basedOnFavouriteArtists}
              onPlay={playTrack}
            />

            {/* 5. Based on Your Favourite Music Directors */}
            <SectionBlock
              title="Based on Your Favourite Music Directors"
              subtitle={`Compositions by ${directorName}`}
              tracks={basedOnFavouriteDirectors}
              onPlay={playTrack}
            />

            {/* 6. Recently Played */}
            <SectionBlock
              title="Recently Played"
              subtitle="Jump back into your recent listening sessions"
              tracks={recentlyPlayed}
              onPlay={playTrack}
            />

            {/* 7. Your Favourite Songs */}
            <SectionBlock
              title="Your Favourite Songs"
              subtitle="The tracks you love and rewatch most"
              tracks={favouriteSongs}
              onPlay={playTrack}
            />

            {/* 8. Similar to Your Favourite Songs */}
            <SectionBlock
              title="Similar to Your Favourite Songs"
              subtitle="Fresh melodies closely matching your favourite tracks"
              tracks={similarToFavouriteSongs}
              onPlay={playTrack}
            />

            {/* 9. Trending in Your Languages */}
            <SectionBlock
              title="Trending in Your Languages"
              subtitle="Popular hits across your chosen languages"
              tracks={trending}
              onPlay={playTrack}
            />

            {/* 10. New Releases */}
            <SectionBlock
              title="New Releases"
              subtitle="Latest arrivals and soundtrack releases"
              tracks={newReleases}
              onPlay={playTrack}
            />

            {/* 11. Discover Something New */}
            <SectionBlock
              title="Discover Something New"
              subtitle="Fresh additions outside your frequent rotations"
              tracks={discoverNew}
              onPlay={playTrack}
            />

            {/* 12. Continue Listening */}
            <SectionBlock
              title="Continue Listening"
              subtitle="Pick up where you left off"
              tracks={continueListening}
              onPlay={playTrack}
            />

            {/* 13. Songs You May Like */}
            <SectionBlock
              title="Songs You May Like"
              subtitle="Recommended songs tailored to your listening pattern"
              tracks={songsYouMayLike}
              onPlay={playTrack}
            />

            {/* 14. Popular Songs (Base & Recommendations) */}
            <SectionBlock
              title="Popular Songs"
              subtitle="All-time popular soundtrack releases"
              tracks={popularSongs}
              onPlay={playTrack}
            />

            {/* 15. Recently Added (Independent Base Feed) */}
            <SectionBlock
              title="Recently Added"
              subtitle="Fresh additions to the music catalogue"
              tracks={recentlyAdded}
              onPlay={playTrack}
            />

            {/* 16. Explore Music Catalogue */}
            <SectionBlock
              title="Explore Music Catalogue"
              subtitle="Browse all available catalogue songs"
              tracks={exploreAllCatalogue}
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

            {/* 3. Popular Songs */}
            <SectionBlock
              title="Popular Songs"
              subtitle="Top streaming soundtrack favourites"
              tracks={popularSongs}
              onPlay={playTrack}
            />

            {/* 4. Recently Added */}
            <SectionBlock
              title="Recently Added"
              subtitle="New additions to the music catalogue"
              tracks={recentlyAdded}
              onPlay={playTrack}
            />

            {/* 5. New & Notable Music */}
            <SectionBlock
              title="New & Notable"
              subtitle="Newly added public tracks"
              tracks={discoverNew}
              onPlay={playTrack}
            />

            {/* 6. Featured Soundtracks */}
            <SectionBlock
              title="Featured Soundtracks"
              subtitle="Top film scores and memorable soundtracks"
              tracks={similarSongs}
              onPlay={playTrack}
            />

            {/* 7. Explore All Catalogue Songs */}
            <SectionBlock
              title="Explore All Songs"
              subtitle="Full music catalogue available in SyncWave"
              tracks={exploreAllCatalogue}
              onPlay={playTrack}
            />
          </View>
        )}

        <View style={{ height: bottomOffset }} />
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm
  },
  headerTitleContainer: {
    flex: 1
  },
  title: {
    ...Typography.h2,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: 110
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
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  guestBannerTextCol: {
    marginBottom: Spacing.sm
  },
  guestBannerTitle: {
    ...Typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2
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
    gap: Spacing.md
  },
  sectionContainer: {
    marginBottom: Spacing.sm
  },
  sectionHeaderTextCol: {
    flex: 1,
    marginRight: Spacing.sm
  },
  sectionSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 1
  },
  horizontalScrollContent: {
    paddingRight: Spacing.md,
    paddingTop: Spacing.xxs
  },
  verticalListContainer: {
    gap: 0
  },
  sectionTitle: {
    ...Typography.bodyMedium,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  countText: {
    ...Typography.monoSmall,
    fontSize: 10,
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
  dailyMixCard: {
    width: 140,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  dailyMixCover: {
    width: 140,
    height: 140
  },
  dailyMixInfo: {
    padding: Spacing.sm,
    gap: 2
  },
  dailyMixTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  dailyMixSubtitle: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textTertiary,
    lineHeight: 13
  },
  dailyMixCount: {
    ...Typography.monoSmall,
    fontSize: 9,
    color: Colors.accent,
    marginTop: 2
  },
  featuredHeroContainer: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.lg
  },
  featuredTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent
  },
  featuredTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 0.5
  },
  featuredLangText: {
    fontSize: 10,
    color: Colors.textTertiary
  },
  featuredBodyRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center'
  },
  featuredArtwork: {
    width: 84,
    height: 84,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised
  },
  featuredInfo: {
    flex: 1,
    gap: 3
  },
  featuredTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  featuredArtist: {
    fontSize: 12,
    color: Colors.textSecondary
  },
  featuredReason: {
    fontSize: 10,
    color: Colors.textTertiary,
    lineHeight: 13
  },
  featuredPlayBtn: {
    marginTop: 4,
    backgroundColor: Colors.accent,
    borderRadius: Radius.control,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start'
  },
  featuredPlayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000'
  },
  errorNoticeContainer: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: Colors.surfaceRaised,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm
  },
  errorNoticeCol: {
    flex: 1
  },
  errorNoticeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent
  },
  errorNoticeSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2
  },
  errorNoticeRetryBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: Radius.control
  },
  errorNoticeRetryText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent
  },
  languagePromptContainer: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.accent,
    borderWidth: 1,
    gap: Spacing.xs
  },
  languagePromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  languagePromptSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15
  },
  languagePromptButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.control
  },
  languagePromptButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000'
  },
  footerSpacing: {
    height: 110
  }
});
