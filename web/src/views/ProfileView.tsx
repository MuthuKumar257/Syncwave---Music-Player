import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Heart,
  TrendingUp,
  Repeat,
  Play,
  Music,
  Clock,
  Users,
  RefreshCw,
  Sliders,
  Sparkles,
  Award,
  LogIn,
  UserPlus,
  Disc3,
  Info,
  Globe,
  Calendar,
  X,
  Edit2
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { useAnalyticsStore } from '../store/useAnalyticsStore';
import { ProfileStats, ProfileSongRewatchStat, SongDetailedStats } from '../types';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { OnboardingModal } from '../components/onboarding/OnboardingModal';
import { SettingsView } from './SettingsView';

export const ProfileView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: 'overview' | 'settings' =
    searchParams.get('tab') === 'settings' ? 'settings' : 'overview';

  const setActiveTab = (tab: 'overview' | 'settings') => {
    if (tab === 'settings') {
      setSearchParams({ tab: 'settings' });
    } else {
      setSearchParams({});
    }
  };

  const { user, isAuthenticated, updateProfile } = useAuthStore();
  const { playSong } = usePlayerStore();
  const { preferences, fetchPreferences, isOnboardingOpen, openOnboarding, closeOnboarding } = useRecommendationStore();
  const { stats, isLoading, fetchStats } = useAnalyticsStore();

  const [selectedSongStat, setSelectedSongStat] = useState<SongDetailedStats | null>(null);
  const [isStatModalLoading, setIsStatModalLoading] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchProfileStats = useCallback((force = false) => {
    return fetchStats(force);
  }, [fetchStats]);

  const inspectSongStats = async (songId: string) => {
    setIsStatModalLoading(true);
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
      const res = await fetch(`/api/songs/${encodeURIComponent(songId)}/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.stats) {
          setSelectedSongStat(json.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load song stats:', err);
    } finally {
      setIsStatModalLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfileStats(false);
      fetchPreferences();
    }
  }, [fetchProfileStats, fetchPreferences, isAuthenticated]);

  const handlePlayRewatchedSong = (item: ProfileSongRewatchStat) => {
    playSong({
      id: item.songId,
      title: item.title,
      artist: item.artist,
      album: 'Profile Rewatched Hit',
      durationMs: 240000,
      artworkUrl: item.artworkUrl,
      videoId: item.videoId,
      source: 'YOUTUBE',
      createdAt: new Date().toISOString()
    });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName.trim()) return;
    setIsSavingProfile(true);
    setProfileError(null);
    const res = await updateProfile({ displayName: newDisplayName.trim() });
    setIsSavingProfile(false);
    if (res.ok) {
      setIsEditProfileOpen(false);
    } else {
      setProfileError(res.error || 'Failed to update profile');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex items-center justify-center select-none min-h-[70vh]">
        <div className="max-w-md w-full p-8 rounded-card bg-surface border border-hairline text-center space-y-6">
          {/* 1. App Logo */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-accent/40 flex items-center justify-center shadow-lg">
              <Disc3 className="w-8 h-8 text-accent animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">SyncWave</h1>
          </div>

          {/* 2. Welcome Message */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-text-primary">Welcome to SyncWave</h2>
            {/* 3. Short Description */}
            <p className="text-sm text-text-muted leading-relaxed">
              Your intelligent, cross-platform music streaming companion. Discover trending tracks, organize custom playlists, schedule daily routines, and enjoy high-fidelity audio playback.
            </p>
          </div>

          {/* 4. Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-control bg-accent text-black font-semibold hover:brightness-110 transition text-sm shadow-sm"
              data-testid="guest-sign-in-button"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-control bg-surface-elevated hover:bg-surface-hover border border-hairline text-text-primary font-semibold transition text-sm"
              data-testid="guest-sign-up-button"
            >
              <UserPlus className="w-4 h-4" />
              <span>Sign Up</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const maxArtistPlays = stats?.topListenedArtists[0]
    ? Math.max(1, stats.topListenedArtists[0].playCount + stats.topListenedArtists[0].replayCount)
    : 1;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 select-none">
      <OnboardingModal isOpen={isOnboardingOpen} onClose={() => { closeOnboarding(); fetchProfileStats(true); }} />

      {/* Header & Identity Banner */}
      <div className="p-5 rounded-card bg-surface border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-elevated border-2 border-accent flex items-center justify-center text-accent text-xl font-bold shrink-0">
            {(user?.displayName || 'S')[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-semibold text-text-primary tracking-tight">
                {user?.displayName || 'SyncWave Listener'}
              </h1>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    setNewDisplayName(user?.displayName || '');
                    setProfileError(null);
                    setIsEditProfileOpen(true);
                  }}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition"
                  title="Edit profile name"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {user?.email || 'Listening analytics, favourite artists, top listened artists & most rewatched tracks'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!isAuthenticated && (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent text-black hover:brightness-110 text-xs font-semibold transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in</span>
            </button>
          )}
          <button
            onClick={() => fetchProfileStats(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover border border-hairline text-xs text-text-secondary hover:text-text-primary transition-colors"
            title="Refresh listening stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-accent' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'settings' ? 'overview' : 'settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control border text-xs transition-colors ${
              activeTab === 'settings'
                ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                : 'bg-surface-elevated hover:bg-surface-hover border-hairline text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation under Profile: Overview & Settings */}
      <div className="inline-flex items-center gap-1 p-1 rounded-control bg-surface border border-hairline">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-surface-elevated text-text-primary border border-hairline'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-surface-elevated text-text-primary border border-hairline'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Settings
        </button>
      </div>

      {activeTab === 'settings' ? (
        <SettingsView embedded />
      ) : (
        <>
          {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-card bg-surface border border-hairline space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <Play className="w-3.5 h-3.5 text-accent" />
            <span>Total Plays</span>
          </div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums font-mono">
            {stats?.summary.totalPlays ?? 0}
          </p>
        </div>

        <div className="p-4 rounded-card bg-surface border border-hairline space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <Repeat className="w-3.5 h-3.5 text-emerald-400" />
            <span>Songs Rewatched</span>
          </div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums font-mono">
            {stats?.summary.totalRewatches ?? 0}
          </p>
        </div>

        <div className="p-4 rounded-card bg-surface border border-hairline space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <Users className="w-3.5 h-3.5 text-accent" />
            <span>Artists Listened</span>
          </div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums font-mono">
            {stats?.summary.uniqueArtistsListened ?? 0}
          </p>
        </div>

        <div className="p-4 rounded-card bg-surface border border-hairline space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <Clock className="w-3.5 h-3.5 text-text-secondary" />
            <span>Listening Time</span>
          </div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums font-mono">
            {stats?.summary?.formattedListeningTime ||
              stats?.formattedListeningTime ||
              (typeof stats?.totalListeningHours === 'number' && stats.totalListeningHours > 0
                ? `${stats.totalListeningHours}h ${stats.summary.totalListeningMinutes % 60}m`
                : stats?.summary?.totalListeningMinutes
                  ? `${stats.summary.totalListeningMinutes}m`
                  : '0m')}
          </p>
        </div>
      </div>

      {/* 2. Personalized Music Taste Profile Card */}
      <div data-testid="profile-taste-card" className="p-5 rounded-card bg-surface border border-hairline space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Music Taste &amp; Personalization</h2>
              <p className="text-[11px] text-text-muted">
                Your preferred languages, directors, singers, genres, and moods that shape your feed
              </p>
            </div>
          </div>
          <button
            onClick={openOnboarding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent/15 border border-accent/40 text-accent text-xs font-semibold hover:bg-accent hover:text-black transition self-start sm:self-auto"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Customize Taste Profile</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Preferred Languages */}
          <div className="p-3.5 rounded-control bg-surface-elevated border border-hairline space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Globe className="w-3.5 h-3.5 text-accent" />
              <span className="font-medium text-text-secondary">Preferred Languages</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preferences?.preferredLanguages && preferences.preferredLanguages.length > 0 ? (
                preferences.preferredLanguages.map((lang) => (
                  <span key={lang} className="px-2 py-0.5 rounded-full text-[11px] bg-surface border border-hairline text-text-primary font-medium">
                    {lang}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-text-muted italic">None selected</span>
              )}
            </div>
          </div>

          {/* Music Directors */}
          <div className="p-3.5 rounded-control bg-surface-elevated border border-hairline space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Music className="w-3.5 h-3.5 text-accent" />
              <span className="font-medium text-text-secondary">Music Directors</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preferences?.favouriteComposers && preferences.favouriteComposers.length > 0 ? (
                preferences.favouriteComposers.slice(0, 4).map((dir) => (
                  <span key={dir} className="px-2 py-0.5 rounded-full text-[11px] bg-surface border border-hairline text-text-primary font-medium">
                    {dir}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-text-muted italic">None selected</span>
              )}
            </div>
          </div>

          {/* Favourite Artists & Singers */}
          <div className="p-3.5 rounded-control bg-surface-elevated border border-hairline space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Users className="w-3.5 h-3.5 text-accent" />
              <span className="font-medium text-text-secondary">Singers &amp; Artists</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preferences?.favouriteSingers && preferences.favouriteSingers.length > 0 ? (
                preferences.favouriteSingers.slice(0, 4).map((sin) => (
                  <span key={sin} className="px-2 py-0.5 rounded-full text-[11px] bg-surface border border-hairline text-text-primary font-medium">
                    {sin}
                  </span>
                ))
              ) : preferences?.favouriteArtists && preferences.favouriteArtists.length > 0 ? (
                preferences.favouriteArtists.slice(0, 4).map((art) => (
                  <span key={art} className="px-2 py-0.5 rounded-full text-[11px] bg-surface border border-hairline text-text-primary font-medium">
                    {art}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-text-muted italic">None selected</span>
              )}
            </div>
          </div>

          {/* Genres & Moods */}
          <div className="p-3.5 rounded-control bg-surface-elevated border border-hairline space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="font-medium text-text-secondary">Genres &amp; Moods</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...(preferences?.favouriteGenres || []), ...(preferences?.preferredMoods || [])].length > 0 ? (
                [...(preferences?.favouriteGenres || []), ...(preferences?.preferredMoods || [])].slice(0, 4).map((gm) => (
                  <span key={gm} className="px-2 py-0.5 rounded-full text-[11px] bg-surface border border-hairline text-accent font-medium">
                    {gm}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-text-muted italic">None selected</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Favourite Artist & Most Listened Artist Hero Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Favourite Artist Card */}
        <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-accent fill-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Favourite Artist</h2>
            </div>
            <button
              onClick={openOnboarding}
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Edit Taste Profile</span>
            </button>
          </div>

          {stats?.favouriteArtist ? (
            <div className="space-y-4">
              {/* Top Favourite Highlight */}
              <div className="p-3.5 rounded-control bg-surface-elevated border border-hairline flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-accent shrink-0 bg-surface">
                  <ArtworkImage
                    src={stats.favouriteArtist.imageUrl}
                    alt={stats.favouriteArtist.name}
                    fallbackLabel={stats.favouriteArtist.name}
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-accent">
                    #1 Favourite Artist
                  </span>
                  <h3 className="text-lg font-semibold text-text-primary truncate">
                    {stats.favouriteArtist.name}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {stats.favouriteArtist.roleTitle}
                  </p>
                </div>
              </div>

              {/* All Favourite Artists Chips */}
              {stats.favouriteArtists.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-mono text-text-muted">
                    Your Selected Artists ({stats.favouriteArtists.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stats.favouriteArtists.slice(0, 10).map((artist) => (
                      <div
                        key={artist.name}
                        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-surface-elevated border border-hairline text-xs text-text-primary"
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                          <ArtworkImage
                            src={artist.imageUrl}
                            alt={artist.name}
                            fallbackLabel={artist.name}
                          />
                        </div>
                        <span className="truncate max-w-[120px]">{artist.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center bg-surface-elevated rounded-control border border-hairline">
              <p className="text-xs text-text-muted">No favourite artists chosen yet.</p>
              <button
                onClick={openOnboarding}
                className="mt-2.5 px-3 py-1.5 rounded-control bg-primary text-primary-dark text-xs font-medium"
              >
                Choose Favourite Artists
              </button>
            </div>
          )}
        </div>

        {/* 2. Most Listened Artist Card */}
        <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Most Listened Artist</h2>
            </div>
            <span className="text-[11px] font-mono text-text-muted">Ranked by plays</span>
          </div>

          {stats?.mostListenedArtist ? (
            <div className="space-y-4">
              {/* #1 Most Listened Highlight */}
              <div className="p-3.5 rounded-control bg-surface-elevated border border-hairline flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-400 shrink-0 bg-surface">
                    <ArtworkImage
                      src={stats.mostListenedArtist.imageUrl}
                      alt={stats.mostListenedArtist.name}
                      fallbackLabel={stats.mostListenedArtist.name}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                      Top Played Artist
                    </span>
                    <h3 className="text-lg font-semibold text-text-primary truncate">
                      {stats.mostListenedArtist.name}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {stats.mostListenedArtist.uniqueSongsCount} unique tracks played
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold font-mono text-accent tabular-nums">
                    {stats.mostListenedArtist.playCount}&times;
                  </p>
                  <p className="text-[10px] text-text-muted">plays</p>
                </div>
              </div>

              {/* Ranked Leaderboard */}
              <div className="space-y-2">
                {stats.topListenedArtists.slice(0, 5).map((art, idx) => {
                  const totalScore = art.playCount + art.replayCount;
                  const pct = Math.min(100, Math.round((totalScore / maxArtistPlays) * 100));
                  return (
                    <div key={art.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] text-text-muted w-4">#{idx + 1}</span>
                          <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                            <ArtworkImage
                              src={art.imageUrl}
                              alt={art.name}
                              fallbackLabel={art.name}
                            />
                          </div>
                          <span className="text-text-primary truncate font-medium">{art.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-text-muted tabular-nums shrink-0">
                          {art.playCount} plays
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center bg-surface-elevated rounded-control border border-hairline space-y-2">
              <TrendingUp className="w-6 h-6 text-text-muted mx-auto opacity-50" />
              <p className="text-xs text-text-muted">
                Play songs in Home or Discover to see your most listened artist rankings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Most Number of Times Songs Rewatched (Replayed) */}
      <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Most Rewatched Songs
              </h2>
              <p className="text-[11px] text-text-muted">
                Tracks ranked by the highest number of plays &amp; rewatches
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-text-muted">
            {stats?.mostRewatchedSongs.length ?? 0} tracked
          </span>
        </div>

        {stats?.mostRewatchedSongs && stats.mostRewatchedSongs.length > 0 ? (
          <div className="divide-y divide-hairline bg-surface-elevated rounded-control border border-hairline overflow-hidden">
            {stats.mostRewatchedSongs.map((song, idx) => (
              <div
                key={song.songId + idx}
                onClick={() => handlePlayRewatchedSong(song)}
                className="flex items-center justify-between p-3 hover:bg-surface-hover cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <span
                    className={`w-6 text-center font-mono text-xs font-semibold tabular-nums ${
                      idx === 0 ? 'text-accent' : 'text-text-muted'
                    }`}
                  >
                    #{idx + 1}
                  </span>

                  <div className="w-10 h-10 rounded-control overflow-hidden border border-hairline shrink-0 bg-surface">
                    <ArtworkImage src={song.artworkUrl} alt={song.title} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                      {song.title}
                    </p>
                    <p className="text-[11px] text-text-muted truncate">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-accent/10 border border-accent/25 text-accent font-semibold tabular-nums">
                        {song.playCount} {song.playCount === 1 ? 'play' : 'plays'}
                      </span>
                      {song.rewatchCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 tabular-nums">
                          {song.rewatchCount} {song.rewatchCount === 1 ? 'rewatch' : 'rewatches'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        inspectSongStats(song.songId);
                      }}
                      className="p-1.5 rounded-control hover:bg-surface-elevated text-text-muted hover:text-accent transition-colors"
                      title="View track statistics"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayRewatchedSong(song);
                      }}
                      className="w-8 h-8 rounded-control bg-primary text-primary-dark flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity"
                      title="Play again"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-surface-elevated rounded-control border border-hairline space-y-2">
            <Music className="w-6 h-6 text-text-muted mx-auto opacity-50" />
            <p className="text-xs text-text-muted">
              No rewatched songs recorded yet. Play any song multiple times to track its rewatch count!
            </p>
          </div>
        )}
      </div>

      {/* 4. Top Music Directors & Language Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Music Directors */}
        <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Top Music Directors</h2>
            </div>
            <span className="text-[11px] font-mono text-text-muted">Ranked by plays</span>
          </div>

          {stats?.topListenedDirectors && stats.topListenedDirectors.length > 0 ? (
            <div className="space-y-2.5">
              {stats.topListenedDirectors.slice(0, 5).map((dir, idx) => {
                const maxDirPlays = Math.max(1, stats.topListenedDirectors![0].playCount);
                const pct = Math.min(100, Math.round((dir.playCount / maxDirPlays) * 100));
                return (
                  <div key={dir.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-[11px] text-text-muted w-4">#{idx + 1}</span>
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-hairline bg-surface">
                          <ArtworkImage
                            src={dir.imageUrl}
                            alt={dir.name}
                            fallbackLabel={dir.name}
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-text-primary truncate font-medium block">{dir.name}</span>
                          {typeof dir.uniqueSongsCount === 'number' && dir.uniqueSongsCount > 0 && (
                            <span className="text-[10px] text-text-muted block">
                              {dir.uniqueSongsCount} {dir.uniqueSongsCount === 1 ? 'track' : 'tracks'}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-text-muted tabular-nums shrink-0">
                        {dir.playCount} {dir.playCount === 1 ? 'play' : 'plays'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center bg-surface-elevated rounded-control border border-hairline">
              <p className="text-xs text-text-muted">No music directors tracked yet. Listen to songs to populate composer insights.</p>
            </div>
          )}
        </div>

        {/* Language-Wise Breakdown */}
        <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Language Breakdown</h2>
            </div>
            <span className="text-[11px] font-mono text-text-muted">Distribution</span>
          </div>

          {stats?.languageBreakdown && stats.languageBreakdown.length > 0 ? (
            <div className="space-y-2.5">
              {stats.languageBreakdown.map((lang) => {
                const playCount = lang.count ?? (lang as any).songsCount ?? 0;
                return (
                  <div key={lang.language} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-primary font-medium">{lang.language}</span>
                      <span className="font-mono text-[11px] text-text-muted tabular-nums">
                        {playCount} {playCount === 1 ? 'play' : 'plays'} ({lang.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${lang.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center bg-surface-elevated rounded-control border border-hairline">
              <p className="text-xs text-text-muted">No language data recorded yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Daily (7 Days) Activity Timeline */}
      {stats?.dailyActivity && stats.dailyActivity.length > 0 && (
        <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Daily Activity (Last 7 Days)</h2>
            </div>
            <span className="text-[11px] font-mono text-text-muted">Plays per day</span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-2">
            {stats.dailyActivity.map((day) => {
              const playCount = day.plays || 0;
              const maxPlays = Math.max(1, ...stats.dailyActivity!.map((d) => d.plays || 0));
              const heightPct = playCount > 0 ? Math.max(16, Math.round((playCount / maxPlays) * 100)) : 8;
              const dayLabel = day.day || (day as any).dayName || '';
              return (
                <div key={day.date} className="flex flex-col items-center gap-1.5 text-center">
                  <div className="h-24 w-full flex items-end justify-center bg-surface-elevated rounded-control p-1">
                    <div
                      className={`w-full rounded-sm transition-all flex items-center justify-center text-[10px] font-mono font-semibold ${
                        playCount > 0 ? 'bg-accent text-black' : 'bg-surface border border-hairline/40 text-text-muted'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${playCount} plays on ${day.date}`}
                    >
                      {playCount > 0 ? playCount : '0'}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-text-secondary">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}

      {/* Individual Song Detailed Stats Modal */}
      {selectedSongStat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-hairline rounded-card p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-text-primary">Song Statistics</h3>
              </div>
              <button
                onClick={() => setSelectedSongStat(null)}
                className="p-1 rounded-control hover:bg-surface-elevated text-text-muted hover:text-text-primary transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-base font-semibold text-text-primary">{selectedSongStat.songName}</h4>
                <p className="text-xs text-text-muted">
                  {selectedSongStat.musicDirector ? `Director: ${selectedSongStat.musicDirector} • ` : ''}
                  {selectedSongStat.language || ''}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-control bg-surface-elevated border border-hairline">
                  <p className="text-[10px] font-mono uppercase text-text-muted">Play Count</p>
                  <p className="text-lg font-bold font-mono text-accent">{selectedSongStat.playCount}</p>
                </div>
                <div className="p-3 rounded-control bg-surface-elevated border border-hairline">
                  <p className="text-[10px] font-mono uppercase text-text-muted">Replay Count</p>
                  <p className="text-lg font-bold font-mono text-emerald-400">{selectedSongStat.replayCount}</p>
                </div>
                <div className="p-3 rounded-control bg-surface-elevated border border-hairline">
                  <p className="text-[10px] font-mono uppercase text-text-muted">Total Listened</p>
                  <p className="text-lg font-bold font-mono text-text-primary">
                    {Math.round(selectedSongStat.totalListeningDurationMs / 1000)}s
                  </p>
                </div>
                <div className="p-3 rounded-control bg-surface-elevated border border-hairline">
                  <p className="text-[10px] font-mono uppercase text-text-muted">Completion Rate</p>
                  <p className="text-lg font-bold font-mono text-text-primary">
                    {selectedSongStat.completionPercentage}%
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-control bg-surface-elevated border border-hairline space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Skip Count:</span>
                  <span className="font-mono text-text-primary">{selectedSongStat.skipCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Favorite:</span>
                  <span className="font-mono text-text-primary">{selectedSongStat.isFavorite ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Last Played:</span>
                  <span className="font-mono text-text-primary">
                    {selectedSongStat.lastPlayedAt ? new Date(selectedSongStat.lastPlayedAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedSongStat(null)}
              className="w-full py-2 rounded-control bg-surface-elevated hover:bg-surface-hover border border-hairline text-xs font-semibold text-text-primary transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-card bg-surface border border-hairline p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">Edit Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {profileError && (
              <div className="p-2.5 rounded-control bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {profileError}
              </div>
            )}
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full h-9 px-3 rounded-control bg-surface-elevated border border-hairline text-sm text-text-primary focus:outline-none focus:border-accent"
                  placeholder="Your display name"
                  maxLength={50}
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-3 py-1.5 rounded-control text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile || !newDisplayName.trim()}
                  className="px-4 py-1.5 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110 disabled:opacity-50 transition"
                >
                  {isSavingProfile ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
