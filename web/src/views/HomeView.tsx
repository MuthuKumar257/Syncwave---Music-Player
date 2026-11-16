import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  Play,
  Music2,
  ChevronRight,
  ChevronDown,
  X,
  Disc3,
  User,
  Sparkles,
  WifiOff,
  Loader2,
  ArrowDown
} from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { RecommendationCard } from '../components/recommendations/RecommendationCard';
import { SongContextMenu } from '../components/common/SongContextMenu';
import { ArtworkImage } from '../components/common/ArtworkImage';
import {
  ArtistRecommendationCard,
  MoodPlaylistCard,
  Song,
  UnifiedTrack
} from '../types';

export const toPlayerSong = (track: UnifiedTrack): Song => ({
  id: track.id,
  title: track.title,
  artist: track.singers && track.singers.length > 0 ? track.singers.join(', ') : track.artist,
  album: track.movieName || track.album || 'Soundtrack',
  durationMs: track.durationMs,
  artworkUrl: track.artworkUrl,
  uri: track.fullAudioUrl || track.previewUrl,
  source: track.sourcePlatform,
  externalUrl: track.sourceUrl,
  videoId: track.videoId || (track.id.startsWith('yt_') ? track.id.replace('yt_', '') : undefined),
  composer: track.composer,
  language: track.language,
  genre: track.genre,
  mood: track.mood,
  versionType: track.versionType,
  createdAt: new Date().toISOString()
});

type SeeAllModalState =
  | { kind: 'TRACKS'; title: string; subtitle?: string; tracks: UnifiedTrack[] }
  | { kind: 'ARTISTS'; title: string; subtitle?: string; artists: ArtistRecommendationCard[] }
  | { kind: 'MOODS'; title: string; subtitle?: string; moods: MoodPlaylistCard[] }
  | null;

const PULL_THRESHOLD_PX = 68;
const MAX_PULL_PX = 112;

export const HomeView: React.FC = () => {
  const { setQueue, currentSong, isPlaying } = usePlayerStore();
  const {
    feed,
    preferences,
    isLoading,
    isRefreshing,
    feedError,
    hiddenTrackIds,
    fetchFeed,
    fetchPreferences,
    refreshHome,
    logListeningEvent,
    openOnboarding
  } = useRecommendationStore();

  // Interactive modals
  const [seeAllModal, setSeeAllModal] = useState<SeeAllModalState>(null);
  const [seeAllVisibleCount, setSeeAllVisibleCount] = useState(12);
  const [selectedArtist, setSelectedArtist] = useState<ArtistRecommendationCard | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodPlaylistCard | null>(null);

  // Pull-to-refresh gesture state (touch + pointer drag + top wheel overscroll)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  const wheelOverscrollRef = useRef(0);
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchPreferences();
    fetchFeed();
  }, [fetchPreferences, fetchFeed]);

  const filterVisible = useCallback(
    (tracks?: UnifiedTrack[]) => (tracks || []).filter((t) => !hiddenTrackIds.has(t.id)),
    [hiddenTrackIds]
  );

  const recentlyPlayed = useMemo(() => filterVisible(feed?.recentlyPlayed), [feed, filterVisible]);
  const recommendedForYou = useMemo(
    () =>
      filterVisible(
        feed?.recommendedForYou && feed.recommendedForYou.length > 0
          ? feed.recommendedForYou
          : feed?.madeForYou
      ),
    [feed, filterVisible]
  );
  const basedOnListeningHistory = useMemo(
    () => ({
      basedOn: feed?.basedOnListeningHistory?.basedOn || 'your recent tracks',
      tracks: filterVisible(feed?.basedOnListeningHistory?.tracks),
    }),
    [feed, filterVisible]
  );
  const moreFromFavouriteArtists = useMemo(
    () => filterVisible(feed?.moreFromFavouriteArtists),
    [feed, filterVisible]
  );
  const sameMusicDirector = useMemo(
    () => ({
      director: feed?.sameMusicDirector?.director || 'Top Composer',
      tracks: filterVisible(feed?.sameMusicDirector?.tracks),
    }),
    [feed, filterVisible]
  );
  const favouriteArtists = useMemo(() => feed?.favouriteArtists || [], [feed]);
  const recommendedSingers = useMemo(() => feed?.recommendedSingers || [], [feed]);
  const recommendedMusicDirectors = useMemo(() => feed?.recommendedMusicDirectors || [], [feed]);
  const moodPlaylists = useMemo(() => feed?.moodPlaylists || [], [feed]);
  const similarSongs = useMemo(() => filterVisible(feed?.similarSongs), [feed, filterVisible]);
  const popularSongs = useMemo(() => filterVisible(feed?.popularSongs), [feed, filterVisible]);
  const trendingInLanguages = useMemo(
    () => filterVisible(feed?.trendingInLanguages),
    [feed, filterVisible]
  );
  const discoverNewMusic = useMemo(
    () =>
      filterVisible(
        feed?.discoverNewMusic && feed.discoverNewMusic.length > 0
          ? feed.discoverNewMusic
          : feed?.discoverNew
      ),
    [feed, filterVisible]
  );

  const triggerPullRefresh = useCallback(() => {
    if (isRefreshing) return;
    setPullDistance(0);
    refreshHome();
  }, [isRefreshing, refreshHome]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const scroller = scrollContainerRef.current;
    if (!scroller || scroller.scrollTop > 0 || isRefreshing) {
      dragStartYRef.current = null;
      return;
    }
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null || isRefreshing) return;
    const scroller = scrollContainerRef.current;
    if (!scroller || scroller.scrollTop > 0) {
      dragStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - dragStartYRef.current;
    if (delta > 0) {
      const damped = Math.min(MAX_PULL_PX, delta * 0.52);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (dragStartYRef.current === null) return;
    dragStartYRef.current = null;
    if (pullDistance >= PULL_THRESHOLD_PX && !isRefreshing) {
      triggerPullRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'mouse') return;
    // Only engage mouse pull-drag if not clicking an interactive button/card
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;
    const scroller = scrollContainerRef.current;
    if (!scroller || scroller.scrollTop > 0 || isRefreshing) return;
    dragStartYRef.current = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null || isRefreshing || e.buttons === 0) return;
    const scroller = scrollContainerRef.current;
    if (!scroller || scroller.scrollTop > 0) {
      dragStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const delta = e.clientY - dragStartYRef.current;
    if (delta > 6) {
      setPullDistance(Math.min(MAX_PULL_PX, delta * 0.5));
    }
  };

  const handlePointerUp = () => {
    if (dragStartYRef.current === null) return;
    dragStartYRef.current = null;
    if (pullDistance >= PULL_THRESHOLD_PX && !isRefreshing) {
      triggerPullRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const scroller = scrollContainerRef.current;
    if (!scroller || scroller.scrollTop > 0 || isRefreshing) {
      wheelOverscrollRef.current = 0;
      return;
    }
    if (e.deltaY < -8) {
      wheelOverscrollRef.current = Math.min(
        MAX_PULL_PX + 20,
        wheelOverscrollRef.current + Math.abs(e.deltaY) * 0.35
      );
      setPullDistance(Math.min(MAX_PULL_PX, wheelOverscrollRef.current));
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
      if (wheelOverscrollRef.current >= PULL_THRESHOLD_PX) {
        wheelOverscrollRef.current = 0;
        triggerPullRefresh();
      } else {
        wheelResetTimerRef.current = setTimeout(() => {
          wheelOverscrollRef.current = 0;
          setPullDistance(0);
        }, 280);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
    };
  }, []);

  const handlePlayTracksAt = (tracks: UnifiedTrack[], index: number) => {
    if (tracks.length === 0) return;
    const safeIdx = Math.max(0, Math.min(index, tracks.length - 1));
    const songs = tracks.map(toPlayerSong);
    setQueue(songs, safeIdx);
    const chosen = tracks[safeIdx];
    logListeningEvent({
      songId: chosen.id,
      songTitle: chosen.title,
      artistName: chosen.composer || chosen.artist,
      language: chosen.language,
      eventType: 'PLAY',
      durationPlayedSec: 30,
      totalDurationSec: Math.round((chosen.durationMs || 240000) / 1000)
    });
  };

  const openSeeAll = (modal: Exclude<SeeAllModalState, null>) => {
    setSeeAllVisibleCount(12);
    setSeeAllModal(modal);
  };

  const openArtistDetail = (artist: ArtistRecommendationCard) => {
    setSelectedArtist(artist);
  };

  const openMoodDetail = (mood: MoodPlaylistCard) => {
    setSelectedMood(mood);
  };

  const activeLangSummary =
    preferences?.preferredLanguages && preferences.preferredLanguages.length > 0
      ? preferences.preferredLanguages.join(' • ')
      : feed?.preferredLanguages && feed.preferredLanguages.length > 0
      ? feed.preferredLanguages.join(' • ')
      : 'Select Languages';

  const hasAnyContent =
    recentlyPlayed.length > 0 ||
    recommendedForYou.length > 0 ||
    basedOnListeningHistory.tracks.length > 0 ||
    moreFromFavouriteArtists.length > 0 ||
    sameMusicDirector.tracks.length > 0 ||
    similarSongs.length > 0 ||
    trendingInLanguages.length > 0 ||
    discoverNewMusic.length > 0 ||
    moodPlaylists.length > 0 ||
    popularSongs.length > 0;

  return (
    <div
      ref={scrollContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      data-testid="home-scroll-container"
      className="flex-1 overflow-y-auto p-5 md:p-8 space-y-8 select-none relative"
    >
      {/* Native Pull-to-Refresh Status Pill */}
      {(pullDistance > 8 || isRefreshing) && (
        <div
          data-testid="pull-to-refresh-indicator"
          style={{
            height: isRefreshing ? 44 : Math.max(28, Math.round(pullDistance * 0.55)),
            opacity: isRefreshing ? 1 : Math.min(1, pullDistance / 36)
          }}
          className="w-full flex items-center justify-center transition-all duration-150"
        >
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-elevated border border-hairline text-xs font-medium text-text-primary shadow-subtle">
            {isRefreshing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                <span>Refreshing recommendations...</span>
              </>
            ) : pullDistance >= PULL_THRESHOLD_PX ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>Release to refresh</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-3.5 h-3.5 text-text-muted" />
                <span>Pull down to refresh</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Non-blocking Network Error Notice (Zero Refresh button; swipe down to retry) */}
      {feedError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-card bg-surface border border-amber-500/30 text-xs text-text-secondary">
          <WifiOff className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="flex-1">
            {feed ? `Showing cached recommendations (${feedError}).` : `Unable to load recommendations (${feedError}).`} Pull down from top to retry.
          </span>
        </div>
      )}

      {/* Prompt to select languages if 0 languages are selected */}
      {(feed?.requiresLanguageSelection || (preferences && preferences.preferredLanguages?.length === 0)) && (
        <div data-testid="language-selection-prompt" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-card bg-surface border border-accent/40 shadow-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="w-4 h-4" />
              <h2 className="text-sm font-semibold text-text-primary">Select Your Music Languages</h2>
            </div>
            <p className="text-xs text-text-muted">
              SyncWave tailors your Home recommendations strictly to your chosen languages. Pick your languages to customize your experience!
            </p>
          </div>
          <button
            onClick={openOnboarding}
            className="flex items-center gap-2 px-4 py-2 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110 transition shadow-sm shrink-0"
          >
            <span>Choose Languages &amp; Taste</span>
          </button>
        </div>
      )}

      {/* 1. PERSONALIZED GREETING */}
      <section data-section="personalized-greeting" className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-elevated border border-hairline text-[11px] font-mono text-accent">
            <Sparkles className="w-3 h-3" />
            <span>{feed?.contextTitle || 'Personalised Radio'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-text-primary tracking-tight">
            {feed?.greeting || 'Welcome back'}
          </h1>
          <p className="text-xs md:text-sm text-text-muted leading-relaxed">
            {feed?.contextDescription || 'Smart recommendations tailored to your listening history & moods'} •{' '}
            <span className="text-text-secondary">{activeLangSummary}</span>
          </p>
        </div>

        {recommendedForYou.length > 0 && (
          <button
            onClick={() => handlePlayTracksAt(recommendedForYou, 0)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110 transition-all shadow-subtle"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Play Recommended For You
          </button>
        )}
      </section>

      {/* Initial Skeleton Loader */}
      {isLoading && !hasAnyContent ? (
        <div className="space-y-8" data-testid="home-skeleton-loader">
          {[1, 2, 3].map((row) => (
            <div key={row} className="space-y-3">
              <div className="h-5 w-44 rounded bg-surface-elevated animate-pulse" />
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 w-44 md:w-48 bg-surface border border-hairline rounded-card p-3 animate-pulse"
                  >
                    <div className="aspect-square rounded-control bg-surface-elevated mb-2.5" />
                    <div className="h-3.5 w-3/4 bg-surface-elevated rounded mb-1.5" />
                    <div className="h-3 w-1/2 bg-surface-elevated rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !hasAnyContent ? (
        <div className="rounded-card bg-surface border border-hairline p-10 text-center space-y-2.5">
          <Music2 className="w-9 h-9 text-text-muted mx-auto opacity-60" />
          <h3 className="text-sm font-medium text-text-primary">No recommendations available yet</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Play songs or select your preferred languages and artists in Profile settings, then pull down from the top to refresh your feed.
          </p>
        </div>
      ) : (
        <div className="space-y-9">
          {/* 1. RECOMMENDED FOR YOU */}
          {recommendedForYou.length > 0 && (
            <TrackCarouselSection
              sectionKey="recommended-for-you"
              title="Recommended for You"
              subtitle="Personalised mix scored from your selected artists, languages & style preferences"
              tracks={recommendedForYou}
              onPlayTrack={(idx) => handlePlayTracksAt(recommendedForYou, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: 'Recommended for You',
                  subtitle: feed?.contextDescription,
                  tracks: recommendedForYou
                })
              }
            />
          )}

          {/* 2. BASED ON YOUR LISTENING HISTORY */}
          {basedOnListeningHistory.tracks.length > 0 && (
            <TrackCarouselSection
              sectionKey="based-on-listening-history"
              title="Based on Your Listening History"
              subtitle={`Inspired by your plays of ${basedOnListeningHistory.basedOn}`}
              tracks={basedOnListeningHistory.tracks}
              onPlayTrack={(idx) => handlePlayTracksAt(basedOnListeningHistory.tracks, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: 'Based on Your Listening History',
                  subtitle: `Inspired by your plays of ${basedOnListeningHistory.basedOn}`,
                  tracks: basedOnListeningHistory.tracks
                })
              }
            />
          )}

          {/* 3. MORE FROM YOUR FAVOURITE ARTISTS */}
          {moreFromFavouriteArtists.length > 0 && (
            <TrackCarouselSection
              sectionKey="more-from-favourite-artists"
              title="More from Your Favourite Artists"
              subtitle="Fresh and popular picks from your selected artists and composers"
              tracks={moreFromFavouriteArtists}
              onPlayTrack={(idx) => handlePlayTracksAt(moreFromFavouriteArtists, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: 'More from Your Favourite Artists',
                  subtitle: 'Top tracks from your chosen artists',
                  tracks: moreFromFavouriteArtists
                })
              }
            />
          )}

          {/* 4. SAME MUSIC DIRECTOR */}
          {sameMusicDirector.tracks.length > 0 && (
            <TrackCarouselSection
              sectionKey="same-music-director"
              title={`Same Music Director (${sameMusicDirector.director})`}
              subtitle={`Signature compositions and soundtracks by ${sameMusicDirector.director}`}
              tracks={sameMusicDirector.tracks}
              onPlayTrack={(idx) => handlePlayTracksAt(sameMusicDirector.tracks, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: `Same Music Director (${sameMusicDirector.director})`,
                  subtitle: `Compositions by ${sameMusicDirector.director}`,
                  tracks: sameMusicDirector.tracks
                })
              }
            />
          )}

          {/* RECENTLY PLAYED */}
          {recentlyPlayed.length > 0 && (
            <TrackCarouselSection
              sectionKey="recently-played"
              title="Recently Played"
              subtitle="Jump right back into tracks from your listening sessions"
              tracks={recentlyPlayed}
              onPlayTrack={(idx) => handlePlayTracksAt(recentlyPlayed, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: 'Recently Played',
                  subtitle: 'Your recent listening history',
                  tracks: recentlyPlayed
                })
              }
            />
          )}

          {/* 4. FAVOURITE ARTISTS */}
          {favouriteArtists.length > 0 && (
            <ArtistCarouselSection
              sectionKey="favourite-artists"
              title="Favourite Artists"
              subtitle="Your saved composers and playback voices"
              artists={favouriteArtists}
              onSelectArtist={openArtistDetail}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'ARTISTS',
                  title: 'Favourite Artists',
                  subtitle: 'Tap any artist to explore songs & albums',
                  artists: favouriteArtists
                })
              }
            />
          )}

          {/* 5. RECOMMENDED SINGERS */}
          {recommendedSingers.length > 0 && (
            <ArtistCarouselSection
              sectionKey="recommended-singers"
              title="Recommended Singers"
              subtitle="Voices matching your taste & new vocal discoveries"
              artists={recommendedSingers}
              onSelectArtist={openArtistDetail}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'ARTISTS',
                  title: 'Recommended Singers',
                  subtitle: 'Singers curated for your selected languages',
                  artists: recommendedSingers
                })
              }
            />
          )}

          {/* 6. RECOMMENDED MUSIC DIRECTORS */}
          {recommendedMusicDirectors.length > 0 && (
            <ArtistCarouselSection
              sectionKey="recommended-music-directors"
              title="Recommended Music Directors"
              subtitle="Signature composers & soundtracks in your style"
              artists={recommendedMusicDirectors}
              onSelectArtist={openArtistDetail}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'ARTISTS',
                  title: 'Recommended Music Directors',
                  subtitle: 'Explore composer discographies & movie albums',
                  artists: recommendedMusicDirectors
                })
              }
            />
          )}

          {/* 7. MOOD-BASED PLAYLISTS (All 12 Moods) */}
          {moodPlaylists.length > 0 && (
            <section data-section="mood-based-playlists" className="space-y-3">
              <SectionHeader
                title="Mood-Based Playlists"
                subtitle="Curated soundscapes for every feeling, activity & moment"
                onSeeAll={() =>
                  openSeeAll({
                    kind: 'MOODS',
                    title: 'All Mood Playlists',
                    subtitle: '12 mood collections crafted from playable songs',
                    moods: moodPlaylists
                  })
                }
              />
              <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-thin">
                {moodPlaylists.map((mood) => (
                  <button
                    key={mood.id}
                    type="button"
                    data-mood={mood.mood}
                    onClick={() => openMoodDetail(mood)}
                    className="group flex-shrink-0 w-48 md:w-52 text-left rounded-card bg-surface border border-hairline overflow-hidden hover:border-accent/60 hover:bg-surface-elevated transition-all"
                  >
                    <div className="relative h-28 overflow-hidden bg-surface-elevated">
                      <ArtworkImage
                        src={mood.artworkUrl}
                        alt={mood.mood}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(180deg, transparent 15%, rgba(16,16,18,0.88) 100%)`
                        }}
                      />
                      <span
                        className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider text-black"
                        style={{ backgroundColor: mood.accentColor }}
                      >
                        {mood.mood}
                      </span>
                      <span className="absolute bottom-2 left-3 text-sm font-semibold text-white">
                        {mood.title}
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                        {mood.description}
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary pt-1">
                        <span>{mood.tracks.length} tracks</span>
                        <span className="text-accent group-hover:translate-x-0.5 transition-transform">
                          Open mix →
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 8. SIMILAR SONGS */}
          {similarSongs.length > 0 && (
            <TrackCarouselSection
              sectionKey="similar-songs"
              title="Similar Songs"
              subtitle="Matches your recent movies, liked tracks & composer sound"
              tracks={similarSongs}
              onPlayTrack={(idx) => handlePlayTracksAt(similarSongs, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: 'Similar Songs',
                  subtitle: 'Tracks inspired by what you listen to most',
                  tracks: similarSongs
                })
              }
            />
          )}

          {/* 9. POPULAR SONGS */}
          {popularSongs.length > 0 && (
            <TrackCarouselSection
              sectionKey="popular-songs"
              title="Popular Songs"
              subtitle="Most loved hits from your favourite artists & cinema charts"
              tracks={popularSongs}
              onPlayTrack={(idx) => handlePlayTracksAt(popularSongs, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: 'Popular Songs',
                  subtitle: 'All-time favourites & chart-topping hits',
                  tracks: popularSongs
                })
              }
            />
          )}

          {/* 10. TRENDING IN SELECTED LANGUAGES */}
          {trendingInLanguages.length > 0 && (
            <TrackCarouselSection
              sectionKey="trending-in-selected-languages"
              title="Trending in Selected Languages"
              subtitle={`Hot tracks across ${activeLangSummary}`}
              tracks={trendingInLanguages}
              onPlayTrack={(idx) => handlePlayTracksAt(trendingInLanguages, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: 'Trending in Selected Languages',
                  subtitle: activeLangSummary,
                  tracks: trendingInLanguages
                })
              }
            />
          )}

          {/* 11. DISCOVER NEW MUSIC */}
          {discoverNewMusic.length > 0 && (
            <TrackCarouselSection
              sectionKey="discover-new-music"
              title="Discover New Music"
              subtitle="Fresh artists & soundtracks outside your usual rotation"
              tracks={discoverNewMusic}
              onPlayTrack={(idx) => handlePlayTracksAt(discoverNewMusic, idx)}
              onSeeAll={() =>
                openSeeAll({
                  kind: 'TRACKS',
                  title: 'Discover New Music',
                  subtitle: 'Handpicked fresh releases & hidden gems',
                  tracks: discoverNewMusic
                })
              }
            />
          )}
        </div>
      )}

      {/* SEE ALL MODAL WITH PAGINATION */}
      {seeAllModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSeeAllModal(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[86vh] rounded-card bg-surface border border-hairline flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{seeAllModal.title}</h2>
                {seeAllModal.subtitle && (
                  <p className="text-xs text-text-muted mt-0.5">{seeAllModal.subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {seeAllModal.kind === 'TRACKS' && seeAllModal.tracks.length > 0 && (
                  <button
                    onClick={() => handlePlayTracksAt(seeAllModal.tracks, 0)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Play All
                  </button>
                )}
                <button
                  onClick={() => setSeeAllModal(null)}
                  className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {seeAllModal.kind === 'TRACKS' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                    {seeAllModal.tracks.slice(0, seeAllVisibleCount).map((track, idx) => (
                      <RecommendationCard
                        key={`${track.id}_${idx}`}
                        track={track}
                        fullWidth
                        onPlayPreview={() => handlePlayTracksAt(seeAllModal.tracks, idx)}
                      />
                    ))}
                  </div>
                  {seeAllModal.tracks.length > seeAllVisibleCount && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={() => setSeeAllVisibleCount((c) => c + 12)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-surface-elevated border border-hairline text-xs font-medium text-text-primary hover:border-accent/60"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                        Show more ({seeAllModal.tracks.length - seeAllVisibleCount} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}

              {seeAllModal.kind === 'ARTISTS' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {seeAllModal.artists.slice(0, seeAllVisibleCount).map((artist) => (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => {
                          setSeeAllModal(null);
                          openArtistDetail(artist);
                        }}
                        className="p-3.5 rounded-card bg-surface-elevated/60 border border-hairline hover:border-accent/60 flex flex-col items-center text-center gap-2.5 transition-all"
                      >
                        <div className="w-24 h-24 rounded-full overflow-hidden border border-hairline bg-surface">
                          <ArtworkImage
                            src={artist.imageUrl}
                            alt={artist.name}
                            fallbackLabel={artist.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 w-full">
                          <p className="text-sm font-medium text-text-primary truncate">{artist.name}</p>
                          <p className="text-[11px] text-text-muted truncate">
                            {artist.roleTitle || artist.role}
                          </p>
                          <p className="text-[10px] font-mono text-accent mt-0.5">
                            {artist.tracks.length} songs • {artist.albums?.length || 1} albums
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {seeAllModal.artists.length > seeAllVisibleCount && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={() => setSeeAllVisibleCount((c) => c + 12)}
                        className="px-4 py-2 rounded-control bg-surface-elevated border border-hairline text-xs font-medium text-text-primary"
                      >
                        Show more artists
                      </button>
                    </div>
                  )}
                </>
              )}

              {seeAllModal.kind === 'MOODS' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {seeAllModal.moods.map((mood) => (
                    <button
                      key={mood.id}
                      type="button"
                      onClick={() => {
                        setSeeAllModal(null);
                        openMoodDetail(mood);
                      }}
                      className="rounded-card bg-surface-elevated/60 border border-hairline overflow-hidden text-left hover:border-accent/60 transition-all"
                    >
                      <div className="relative h-28">
                        <ArtworkImage src={mood.artworkUrl} alt={mood.mood} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                        <span
                          className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase text-black"
                          style={{ backgroundColor: mood.accentColor }}
                        >
                          {mood.mood}
                        </span>
                        <p className="absolute bottom-2 left-3 text-sm font-semibold text-white">{mood.title}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-text-muted line-clamp-2">{mood.description}</p>
                        <p className="text-[10px] font-mono text-accent mt-2">{mood.tracks.length} playable songs</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ARTIST DETAIL MODAL (Songs & Albums) */}
      {selectedArtist && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedArtist(null)}
        >
          <div
            data-testid="artist-detail-modal"
            className="w-full max-w-3xl max-h-[88vh] rounded-card bg-surface border border-hairline flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-4 p-5 border-b border-hairline bg-surface-elevated/50">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-accent/40 flex-shrink-0 bg-surface">
                <ArtworkImage
                  src={selectedArtist.imageUrl}
                  alt={selectedArtist.name}
                  fallbackLabel={selectedArtist.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-hairline text-[10px] font-mono text-accent uppercase">
                  <User className="w-3 h-3" />
                  {selectedArtist.roleTitle || selectedArtist.role}
                </span>
                <h2 className="text-xl font-semibold text-text-primary mt-1 truncate">
                  {selectedArtist.name}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {selectedArtist.languages?.join(' • ') || 'Multi-language'} • {selectedArtist.tracks.length} Songs
                  {selectedArtist.albums && selectedArtist.albums.length > 0
                    ? ` • ${selectedArtist.albums.length} Albums`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedArtist.tracks.length > 0 && (
                  <button
                    onClick={() => handlePlayTracksAt(selectedArtist.tracks, 0)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Play All
                  </button>
                )}
                <button
                  onClick={() => setSelectedArtist(null)}
                  className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Albums / Movies */}
              {selectedArtist.albums && selectedArtist.albums.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Albums & Movie Soundtracks
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {selectedArtist.albums.map((album) => (
                      <button
                        key={album.id}
                        type="button"
                        onClick={() => handlePlayTracksAt(album.tracks, 0)}
                        className="flex-shrink-0 w-40 rounded-card bg-surface-elevated border border-hairline p-2.5 text-left hover:border-accent/60 transition-all"
                      >
                        <div className="aspect-square rounded-control overflow-hidden bg-surface mb-2 relative">
                          <ArtworkImage src={album.artworkUrl} alt={album.name} className="w-full h-full object-cover" />
                          <span className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-control bg-accent text-black flex items-center justify-center shadow">
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                          </span>
                        </div>
                        <p className="text-xs font-medium text-text-primary truncate">{album.name}</p>
                        <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                          <Disc3 className="w-3 h-3" />
                          <span>{album.releaseYear || 'Album'} • {album.tracks.length} tracks</span>
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Artist Songs List */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Popular & Recommended Songs
                </h3>
                <div className="divide-y divide-hairline rounded-card border border-hairline overflow-hidden">
                  {selectedArtist.tracks.map((track, idx) => {
                    const active = isPlaying && currentSong?.id === track.id;
                    const song = toPlayerSong(track);
                    return (
                      <div
                        key={track.id}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-elevated transition-colors group"
                      >
                        <button
                          type="button"
                          onClick={() => handlePlayTracksAt(selectedArtist.tracks, idx)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <span className="w-5 text-xs font-mono text-text-muted text-center">
                            {idx + 1}
                          </span>
                          <div className="w-10 h-10 rounded-control overflow-hidden flex-shrink-0 bg-surface-elevated">
                            <ArtworkImage src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${active ? 'text-accent' : 'text-text-primary'}`}>
                              {track.title}
                            </p>
                            <p className="text-xs text-text-muted truncate">
                              {track.singers?.join(', ') || track.artist} • {track.movieName || track.album}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlayTracksAt(selectedArtist.tracks, idx)}
                          className="p-1.5 rounded-full hover:bg-white/10 text-accent flex-shrink-0"
                          aria-label="Play song"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                        <SongContextMenu song={song} buttonSize="sm" context="default" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOOD COLLECTION MODAL */}
      {selectedMood && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedMood(null)}
        >
          <div
            data-testid="mood-detail-modal"
            className="w-full max-w-3xl max-h-[88vh] rounded-card bg-surface border border-hairline flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-44 overflow-hidden flex items-end p-5">
              <ArtworkImage
                src={selectedMood.artworkUrl}
                alt={selectedMood.mood}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/25" />
              <button
                onClick={() => setSelectedMood(null)}
                className="absolute top-3.5 right-3.5 p-2 rounded-control bg-black/50 text-white hover:bg-black/75"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="relative z-10 flex flex-wrap items-end justify-between gap-4 w-full">
                <div className="space-y-1 max-w-lg">
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider text-black"
                    style={{ backgroundColor: selectedMood.accentColor }}
                  >
                    {selectedMood.mood} Mood
                  </span>
                  <h2 className="text-2xl font-semibold text-white">{selectedMood.title}</h2>
                  <p className="text-xs text-zinc-300">{selectedMood.description}</p>
                </div>
                {selectedMood.tracks.length > 0 && (
                  <button
                    onClick={() => handlePlayTracksAt(selectedMood.tracks, 0)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Play All ({selectedMood.tracks.length})
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {selectedMood.tracks.map((track, idx) => {
                const active = isPlaying && currentSong?.id === track.id;
                const song = toPlayerSong(track);
                return (
                  <div
                    key={`${track.id}_${idx}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-left hover:bg-surface-elevated transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => handlePlayTracksAt(selectedMood.tracks, idx)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <span className="w-5 text-xs font-mono text-text-muted text-center">{idx + 1}</span>
                      <div className="w-11 h-11 rounded-control overflow-hidden bg-surface-elevated flex-shrink-0">
                        <ArtworkImage src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${active ? 'text-accent' : 'text-text-primary'}`}>
                          {track.title}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {track.singers?.join(', ') || track.artist} • {track.movieName || track.album}
                        </p>
                      </div>
                    </button>
                    {track.language && (
                      <span className="px-2 py-0.5 rounded bg-surface-elevated border border-hairline text-[10px] font-mono text-text-muted">
                        {track.language}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePlayTracksAt(selectedMood.tracks, idx)}
                      className="p-1.5 rounded-full hover:bg-white/10 text-accent flex-shrink-0"
                      aria-label="Play song"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                    <SongContextMenu song={song} buttonSize="sm" context="default" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, onSeeAll }) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      <h2 className="text-base md:text-lg font-semibold text-text-primary tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
    </div>
    {onSeeAll && (
      <button
        type="button"
        onClick={onSeeAll}
        className="flex items-center gap-0.5 text-xs font-medium text-accent hover:underline flex-shrink-0"
      >
        <span>See All</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

interface TrackCarouselSectionProps {
  sectionKey: string;
  title: string;
  subtitle?: string;
  tracks: UnifiedTrack[];
  onPlayTrack: (index: number) => void;
  onSeeAll: () => void;
}

const TrackCarouselSection: React.FC<TrackCarouselSectionProps> = ({
  sectionKey,
  title,
  subtitle,
  tracks,
  onPlayTrack,
  onSeeAll
}) => (
  <section data-section={sectionKey} className="space-y-3">
    <SectionHeader title={title} subtitle={subtitle} onSeeAll={onSeeAll} />
    <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-thin">
      {tracks.slice(0, 12).map((track, idx) => (
        <RecommendationCard
          key={`${sectionKey}_${track.id}_${idx}`}
          track={track}
          onPlayPreview={() => onPlayTrack(idx)}
        />
      ))}
    </div>
  </section>
);

interface ArtistCarouselSectionProps {
  sectionKey: string;
  title: string;
  subtitle?: string;
  artists: ArtistRecommendationCard[];
  onSelectArtist: (artist: ArtistRecommendationCard) => void;
  onSeeAll: () => void;
}

const ArtistCarouselSection: React.FC<ArtistCarouselSectionProps> = ({
  sectionKey,
  title,
  subtitle,
  artists,
  onSelectArtist,
  onSeeAll
}) => (
  <section data-section={sectionKey} className="space-y-3">
    <SectionHeader title={title} subtitle={subtitle} onSeeAll={onSeeAll} />
    <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-thin">
      {artists.map((artist) => (
        <button
          key={`${sectionKey}_${artist.id}`}
          type="button"
          onClick={() => onSelectArtist(artist)}
          className="group flex-shrink-0 w-36 md:w-40 p-3 rounded-card bg-surface border border-hairline hover:bg-surface-elevated hover:border-accent/50 transition-all text-center flex flex-col items-center gap-2.5"
        >
          <div className="w-24 h-24 rounded-full overflow-hidden border border-hairline bg-surface-elevated group-hover:scale-[1.03] transition-transform">
            <ArtworkImage
              src={artist.imageUrl}
              alt={artist.name}
              fallbackLabel={artist.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="w-full min-w-0 space-y-0.5">
            <p className="text-xs md:text-sm font-medium text-text-primary truncate">{artist.name}</p>
            <p className="text-[11px] text-text-muted truncate">
              {artist.reason || artist.roleTitle || artist.role}
            </p>
            <p className="text-[10px] font-mono text-accent">
              {artist.tracks.length} songs
            </p>
          </div>
        </button>
      ))}
    </div>
  </section>
);
