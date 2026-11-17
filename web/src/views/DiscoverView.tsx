import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Film,
  Music,
  User,
  Video,
  Disc,
  Loader2,
  History,
  X,
  Layers,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { MovieSoundtrackCard } from '../components/search/MovieSoundtrackCard';
import { SongVersionCard } from '../components/search/SongVersionCard';
import { useRecommendationStore } from '../store/useRecommendationStore';
import {
  UniversalSearchResults,
  UnifiedTrack,
  SearchSuggestion,
  Song
} from '../types';

export const DiscoverView: React.FC = () => {
  const navigate = useNavigate();
  const { preferences } = useRecommendationStore();

  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedVersionFilter, setSelectedVersionFilter] = useState<string>('ALL');

  const [searchResults, setSearchResults] = useState<UniversalSearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [visibleSongLimit, setVisibleSongLimit] = useState<number>(20);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      // Clear any legacy local search history so history is not retained on local device
      localStorage.removeItem('syncwave_recent_searches');
    } catch {
      // Ignore
    }
    return [];
  });

  const { playSong } = usePlayerStore();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  const trendingTags = [
    'Love Songs',
    'Melody Songs',
    'Party Songs',
    'Workout Songs',
    'Sad Songs',
    'Rain Songs',
    'Vaaranam Aayiram',
    'Leo',
    'A. R. Rahman',
    'Anirudh'
  ];

  const performSearch = useCallback(
    async (searchQuery: string, type: string, lang: string, plat: string) => {
      if (!searchQuery.trim()) {
        setSearchResults(null);
        setSearchError(null);
        return;
      }

      setIsLoading(true);
      setSearchError(null);
      setVisibleSongLimit(20);
      setShowSuggestions(false);

      setRecentSearches((prev) =>
        [searchQuery, ...prev.filter((item) => item.toLowerCase() !== searchQuery.toLowerCase())].slice(0, 8)
      );

      try {
        const params = new URLSearchParams({
          q: searchQuery.trim(),
          limit: '30',
          ...(type !== 'ALL' && { type: type.toLowerCase() }),
          ...(lang !== 'ALL' && { language: lang }),
          ...(plat !== 'ALL' && { platform: plat })
        });

        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Search failed (${res.status})`);
        }
        const data: UniversalSearchResults = await res.json();

        // Search local and downloaded library files to present unified local + online results
        const localSongs = useLibraryStore.getState().songs || [];
        const qLower = searchQuery.toLowerCase().trim();
        const matchingLocalTracks: UnifiedTrack[] = localSongs
          .filter(
            (s) =>
              s.title.toLowerCase().includes(qLower) ||
              s.artist.toLowerCase().includes(qLower) ||
              (s.album && s.album.toLowerCase().includes(qLower))
          )
          .map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            movieName: s.album,
            durationMs: s.durationMs || 0,
            artworkUrl: s.artworkUrl || '',
            previewUrl: s.uri,
            fullAudioUrl: s.uri,
            sourcePlatform: (s.originType === 'DOWNLOADED' || s.source === 'DOWNLOADED' ? 'DOWNLOADED' : 'LOCAL') as any,
            sourceUrl: s.uri || '',
            isPlayableDirectly: true,
            versionType: 'ORIGINAL',
            language: (s.language as any) || undefined,
            singers: [s.artist]
          }));

        const existingIds = new Set(data.songs.map((s) => s.id));
        const deduplicatedLocal = matchingLocalTracks.filter((t) => !existingIds.has(t.id));
        const mergedSongs = [...deduplicatedLocal, ...data.songs];

        setSearchResults({
          ...data,
          songs: mergedSongs,
          totalResults: (data.totalResults || 0) + deduplicatedLocal.length
        });
      } catch (err: any) {
        console.error('Universal search error:', err);
        setSearchError(
          err?.message || 'Unable to search right now. Check your connection and try again.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        try {
          const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query.trim())}`);
          if (res.ok) {
            const data = await res.json();
            setSuggestions(data.suggestions || []);
          }
        } catch {
          // Ignore
        }
      } else {
        setSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const primaryLang = preferences?.preferredLanguages?.[0];
    const initialQuery =
      primaryLang === 'Hindi'
        ? 'Jawan'
        : primaryLang === 'Telugu'
        ? 'Ala Vaikunthapurramuloo'
        : primaryLang === 'Malayalam'
        ? 'Premam'
        : primaryLang === 'Kannada'
        ? 'Kantara'
        : primaryLang === 'Marathi'
        ? 'Sairat'
        : primaryLang === 'Punjabi'
        ? 'Qismat'
        : primaryLang === 'English'
        ? 'Levitating'
        : 'Vaaranam Aayiram';
    performSearch(initialQuery, selectedType, selectedLanguage, selectedPlatform);
  }, [performSearch, preferences?.preferredLanguages]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, selectedType, selectedLanguage, selectedPlatform);
  };

  const handleSelectSuggestion = (suggestionText: string) => {
    setQuery(suggestionText);
    performSearch(suggestionText, selectedType, selectedLanguage, selectedPlatform);
  };

  const handlePlayUnifiedTrack = (track: UnifiedTrack) => {
    const songToPlay: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || track.movieName || 'Single',
      durationMs: track.durationMs,
      artworkUrl: track.artworkUrl,
      uri: track.previewUrl,
      externalUrl: track.sourceUrl,
      videoId: track.videoId || (track.id.startsWith('yt_') ? track.id.replace('yt_', '') : undefined),
      source: track.sourcePlatform === 'YOUTUBE' ? 'YOUTUBE' : 'SPOTIFY',
      composer: track.composer,
      language: track.language,
      genre: track.genre,
      mood: track.mood,
      versionType: track.versionType,
      createdAt: new Date().toISOString()
    };
    playSong(songToPlay);
  };

  const handleAddToSchedule = (track: UnifiedTrack) => {
    navigate(
      `/scheduler?targetType=SONG&targetId=${encodeURIComponent(track.id)}&targetName=${encodeURIComponent(
        track.title
      )}`
    );
  };

  const clearRecentSearches = () => {
    localStorage.removeItem('syncwave_recent_searches');
    setRecentSearches([]);
  };

  const displayedSongs = (searchResults?.songs || []).filter((song) => {
    if (selectedVersionFilter === 'ALL') return true;
    return song.versionType === selectedVersionFilter;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 select-none relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-medium text-text-primary tracking-tight">
          Search
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Search soundtracks, albums, and recordings across languages and artists
        </p>
      </div>

      {/* Search Input & Suggestions */}
      <div className="relative">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by theme (e.g. love songs, melody), movie, artist or track..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="w-full bg-surface border border-hairline rounded-control pl-10 pr-24 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-hairlineLight transition-colors"
          />

          <div className="absolute right-1.5 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                className="p-1 rounded-control text-text-muted hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-1.5 rounded-control bg-accent hover:brightness-110 text-black text-xs font-semibold shadow-subtle transition flex items-center gap-1.5 tap-press"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Search</span>}
            </button>
          </div>
        </form>

        {/* Suggestions Dropdown */}
        {showSuggestions && (query.trim() || recentSearches.length > 0) && (
          <div
            ref={suggestionsBoxRef}
            className="absolute top-full left-0 right-0 mt-1 bg-surface-elevated border border-hairline rounded-card shadow-subtle p-2 z-40 max-h-80 overflow-y-auto space-y-1"
          >
            {suggestions.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-mono text-text-muted px-2 py-1">
                  Suggestions
                </p>
                {suggestions.map((s, idx) => (
                  <div
                    key={`${s.text}_${idx}`}
                    onClick={() => handleSelectSuggestion(s.text)}
                    className="flex items-center justify-between p-2 rounded-control hover:bg-surface cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {s.type === 'MOVIE' ? (
                        <Film className="w-3.5 h-3.5 text-text-muted" />
                      ) : s.type === 'ARTIST' ? (
                        <User className="w-3.5 h-3.5 text-text-muted" />
                      ) : (
                        <Music className="w-3.5 h-3.5 text-text-muted" />
                      )}
                      <div>
                        <p className="text-xs font-medium text-text-primary">{s.text}</p>
                        <p className="text-[11px] text-text-muted">{s.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-text-muted px-1.5 py-0.5 rounded-[4px] bg-surface border border-hairline">
                      {s.type.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {recentSearches.length > 0 && (
              <div className="pt-1.5 border-t border-hairline">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-mono text-text-muted">
                    Recent searches
                  </span>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[10px] text-text-muted hover:text-text-primary"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleSelectSuggestion(term)}
                      className="px-2.5 py-1 rounded-[6px] bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs border border-hairline transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Theme & Vibe Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] text-text-muted shrink-0 font-medium mr-1 flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-accent" />
          <span>Themes:</span>
        </span>
        {trendingTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => {
              setQuery(tag);
              performSearch(tag, selectedType, selectedLanguage, selectedPlatform);
            }}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface border border-hairline hover:border-hairlineLight hover:bg-surface-elevated text-text-secondary hover:text-text-primary whitespace-nowrap transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Filter Row: Type Tabs & Selects */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {[
            { id: 'ALL', label: 'All', icon: Layers },
            { id: 'MOVIE', label: 'Movies', icon: Film },
            { id: 'SONG', label: 'Songs', icon: Music },
            { id: 'ARTIST', label: 'Artists', icon: User },
            { id: 'VIDEO', label: 'Videos', icon: Video }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedType(tab.id);
                  performSearch(query, tab.id, selectedLanguage, selectedPlatform);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors ${
                  isSelected
                    ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                    : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => {
              setSelectedLanguage(e.target.value);
              performSearch(query, selectedType, e.target.value, selectedPlatform);
            }}
            className="bg-surface border border-hairline rounded-control px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-hairlineLight cursor-pointer"
          >
            <option value="ALL">All languages</option>
            <option value="Tamil">Tamil</option>
            <option value="Telugu">Telugu</option>
            <option value="Hindi">Hindi</option>
            <option value="Malayalam">Malayalam</option>
            <option value="Kannada">Kannada</option>
            <option value="Punjabi">Punjabi</option>
            <option value="Bengali">Bengali</option>
            <option value="English">English</option>
          </select>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="p-12 flex flex-col items-center justify-center gap-2 text-text-muted">
          <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          <p className="text-xs">Searching soundtracks and recordings...</p>
        </div>
      )}

      {/* Error State with Retry */}
      {!isLoading && searchError && (
        <div className="p-5 rounded-card bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-text-primary">Search unavailable</p>
              <p className="text-[11px] text-text-muted mt-0.5">{searchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              performSearch(
                query.trim() || 'Vaaranam Aayiram',
                selectedType,
                selectedLanguage,
                selectedPlatform
              )
            }
            className="px-3 py-1.5 rounded-control bg-surface border border-hairline hover:border-hairlineLight text-xs font-medium text-text-primary flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* RESULTS DISPLAY */}
      {!isLoading && !searchError && searchResults && (
        <div className="space-y-6">
          {/* Matched Theme Banner */}
          {searchResults.theme && (
            <div className="p-4 rounded-card bg-surface border border-hairline flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 border border-accent/20 text-accent">
                    Theme
                  </span>
                  <h3 className="text-base font-medium text-text-primary">
                    {searchResults.theme.name}
                  </h3>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {searchResults.theme.description} &bull; {searchResults.theme.songCount} songs matching this theme
                </p>
              </div>
            </div>
          )}
          {/* Soundtracks */}
          {searchResults.movies.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-medium text-text-primary">
                Movie soundtracks ({searchResults.movies.length})
              </h3>

              <div className="space-y-4">
                {searchResults.movies.map((soundtrack) => (
                  <MovieSoundtrackCard
                    key={soundtrack.id}
                    soundtrack={soundtrack}
                    onPlayTrack={handlePlayUnifiedTrack}
                    onAddToSchedule={handleAddToSchedule}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Songs */}
          {searchResults.songs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-text-primary">
                  Identified tracks ({searchResults.songs.length})
                </h3>

                <div className="flex items-center gap-1 text-xs">
                  {['ALL', 'ORIGINAL', 'COVER', 'REMIX'].map((ver) => (
                    <button
                      key={ver}
                      onClick={() => setSelectedVersionFilter(ver)}
                      className={`px-2.5 py-1 rounded-[6px] text-xs font-mono border transition-colors ${
                        selectedVersionFilter === ver
                          ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                          : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {ver.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayedSongs.slice(0, visibleSongLimit).map((track, idx) => (
                  <SongVersionCard
                    key={`${track.id}_${idx}`}
                    track={track}
                    onPlay={handlePlayUnifiedTrack}
                    onAddToSchedule={handleAddToSchedule}
                  />
                ))}
              </div>

              {displayedSongs.length > visibleSongLimit && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleSongLimit((prev) => prev + 20)}
                    className="px-4 py-1.5 rounded-control bg-surface border border-hairline hover:border-hairlineLight text-xs font-medium text-text-primary transition-colors"
                  >
                    Show more ({displayedSongs.length - visibleSongLimit} remaining)
                  </button>
                </div>
              )}
            </div>
          )}

          {searchResults.movies.length === 0 && displayedSongs.length === 0 && (
            <div className="p-8 rounded-card bg-surface border border-hairline text-center space-y-2">
              <p className="text-sm font-medium text-text-primary">
                No matching tracks for &ldquo;{searchResults.query}&rdquo;
              </p>
              <p className="text-xs text-text-muted">
                Try searching a song name, movie soundtrack, singer (e.g. Sid Sriram, Shreya Ghoshal), or music director (e.g. A. R. Rahman).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
