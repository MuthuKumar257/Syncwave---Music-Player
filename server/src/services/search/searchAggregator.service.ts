import {
  IndianCinemaHelper,
  MusicLanguage,
  SongVersionType,
  KNOWN_INDIAN_MOVIES,
  KNOWN_TRACK_VIDEO_MAP,
  COMPOSER_ALIASES
} from './indianCinema.helper';
import { ARTISTS_CATALOG } from '../recommendation/artistCatalog.data';
import { YouTubeProvider, YouTubeTrackResult } from './youtube.provider';
import { AppleMusicProvider, AppleMusicTrack, AppleMusicSoundtrack } from './appleMusic.provider';
import { SpotifyProvider, SpotifyTrackResult } from './spotify.provider';
import { MusicBrainzProvider } from './musicBrainz.provider';
import { OpenAudioProvider, OpenAudioTrack } from './openAudio.provider';

export type SearchIntent = 'MOVIE' | 'SONG' | 'ARTIST' | 'ALBUM' | 'GENERAL' | 'THEME';

export interface UnifiedTrack {
  id: string;
  title: string;
  artist: string;
  movieName?: string;
  album?: string;
  composer?: string;
  singers?: string[];
  durationMs: number;
  artworkUrl: string;
  sourcePlatform: 'YOUTUBE' | 'SPOTIFY' | 'APPLE_MUSIC' | 'OPEN_AUDIO';
  sourceUrl: string;
  embedUrl?: string;
  videoId?: string;
  previewUrl?: string;
  fullAudioUrl?: string;
  downloadAvailability?: 'FULL_SONG' | 'PREVIEW_ONLY' | 'STREAM_ONLY';
  downloadReason?: string;
  fileFormat?: string;
  versionType: SongVersionType;
  isPlayableDirectly: boolean;
  releaseYear?: number;
  language?: MusicLanguage;
  genre?: string;
  mood?: string;
  recommendationReason?: string;
  isrc?: string;
}

export interface MovieSoundtrack {
  id: string;
  movieName: string;
  releaseYear?: number;
  composer: string;
  language: MusicLanguage;
  artworkUrl: string;
  totalTracks: number;
  externalUrl?: string;
  tracks: UnifiedTrack[];
}

export interface UniversalSearchResults {
  query: string;
  intent: SearchIntent;
  language: MusicLanguage;
  theme?: {
    id: string;
    name: string;
    description: string;
    songCount: number;
  };
  movies: MovieSoundtrack[];
  songs: UnifiedTrack[];
  versions?: {
    original: UnifiedTrack[];
    videos: UnifiedTrack[];
    live: UnifiedTrack[];
    covers: UnifiedTrack[];
    remixes: UnifiedTrack[];
    instrumental: UnifiedTrack[];
  };
  totalResults: number;
}

export class SearchAggregatorService {
  private static buildCuratedTrack(params: {
    trackTitle: string;
    idPrefix: string;
    movie?: (typeof KNOWN_INDIAN_MOVIES)[number] | null;
    artistFallback?: string;
    albumFallback?: string;
    composer?: string;
    singers?: string[];
    language?: MusicLanguage;
    releaseYear?: number;
  }): UnifiedTrack {
    const videoId = KNOWN_TRACK_VIDEO_MAP[params.trackTitle] || '';
    const versionType = IndianCinemaHelper.classifyVersion(params.trackTitle);
    const movie = params.movie;
    const composer = params.composer || movie?.composer;
    const singers = params.singers || movie?.leadSingers;
    const artistLabel = movie
      ? `${movie.composer} & ${movie.leadSingers[0] || 'Singers'}`
      : params.artistFallback || composer || 'SyncWave Catalog';
    const albumLabel = movie
      ? `${movie.movieName} (Original Motion Picture Soundtrack)`
      : params.albumFallback || 'Popular Hits';

    return {
      id: `${params.idPrefix}_${params.trackTitle.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()}`,
      title: params.trackTitle,
      artist: artistLabel,
      movieName: movie?.movieName,
      album: albumLabel,
      composer,
      singers,
      durationMs: movie ? 250000 : 230000,
      artworkUrl: videoId
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg',
      sourcePlatform: 'YOUTUBE',
      sourceUrl: videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(
            `${params.trackTitle} ${movie?.movieName || artistLabel}`.trim()
          )}`,
      embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : undefined,
      videoId: videoId || undefined,
      downloadAvailability: 'STREAM_ONLY',
      downloadReason:
        'YouTube tracks play via official audio-stream mode only; full-song downloading is not permitted.',
      versionType,
      isPlayableDirectly: true,
      releaseYear: params.releaseYear || movie?.year || 2023,
      language: params.language || movie?.language || 'Tamil'
    };
  }

  /**
   * Determine query intent: MOVIE, SONG, ARTIST, ALBUM, THEME, or GENERAL
   */
  static detectIntent(query: string): SearchIntent {
    const q = query.toLowerCase().trim();

    if (IndianCinemaHelper.findTheme(query)) {
      return 'THEME';
    }

    if (/\b(movie|film|soundtrack|ost|bgm|score)\b/i.test(q)) {
      return 'MOVIE';
    }

    if (IndianCinemaHelper.findKnownMovie(query)) {
      return 'MOVIE';
    }

    if (/\b(singer|composer|music director|songs by)\b/i.test(q)) {
      return 'ARTIST';
    }

    if (/\b(song|video song|track|lyrics)\b/i.test(q)) {
      return 'SONG';
    }

    return 'GENERAL';
  }

  /**
   * Universal Search Orchestrator across YouTube, Apple Music, Spotify, and MusicBrainz
   */
  static async search(
    query: string,
    options: {
      type?: string;
      language?: string;
      platform?: string;
      limit?: number;
    } = {}
  ): Promise<UniversalSearchResults> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return {
        query: '',
        intent: 'GENERAL',
        language: 'Other',
        movies: [],
        songs: [],
        totalResults: 0
      };
    }

    const matchedTheme = IndianCinemaHelper.findTheme(cleanQuery);
    const intent = (options.type?.toUpperCase() as SearchIntent) || (matchedTheme ? 'THEME' : this.detectIntent(cleanQuery));
    const language = (options.language as MusicLanguage) || IndianCinemaHelper.detectLanguage(cleanQuery);
    const limit = options.limit || 15;

    // Check if query directly matches a known movie
    const knownMovie = IndianCinemaHelper.findKnownMovie(cleanQuery);

    // Run parallel provider queries with fault tolerance
    const searchQuery = matchedTheme ? `${cleanQuery} songs` : cleanQuery;
    const [ytSettled, appleTracksSettled, appleSoundtracksSettled, spotifyTracksSettled, mbRecordingsSettled, openAudioSettled] =
      await Promise.allSettled([
        YouTubeProvider.searchTracks(searchQuery, limit),
        AppleMusicProvider.searchTracks(searchQuery, limit),
        AppleMusicProvider.searchSoundtracks(cleanQuery, 4),
        SpotifyProvider.searchTracks(searchQuery, limit),
        MusicBrainzProvider.searchRecordings(cleanQuery, 6),
        OpenAudioProvider.searchTracks(searchQuery, 4)
      ]);

    const ytResults: YouTubeTrackResult[] = ytSettled.status === 'fulfilled' ? ytSettled.value : [];
    const appleTracks: AppleMusicTrack[] = appleTracksSettled.status === 'fulfilled' ? appleTracksSettled.value : [];
    const appleSoundtracks: AppleMusicSoundtrack[] =
      appleSoundtracksSettled.status === 'fulfilled' ? appleSoundtracksSettled.value : [];
    const spotifyTracks: SpotifyTrackResult[] =
      spotifyTracksSettled.status === 'fulfilled' ? spotifyTracksSettled.value : [];
    const mbRecordings = mbRecordingsSettled.status === 'fulfilled' ? mbRecordingsSettled.value : [];
    const openAudioTracks: OpenAudioTrack[] =
      openAudioSettled.status === 'fulfilled' ? openAudioSettled.value : [];

    // Map provider results into UnifiedTrack models
    const unifiedTracks: UnifiedTrack[] = [];

    // 0. Open-License Full-Length Audio Tracks (CC / Archive.org / Jamendo)
    for (const oa of openAudioTracks) {
      unifiedTracks.push({
        id: oa.id,
        title: oa.title,
        artist: oa.artist,
        album: oa.album,
        durationMs: oa.durationMs,
        artworkUrl: oa.artworkUrl,
        sourcePlatform: 'OPEN_AUDIO',
        sourceUrl: oa.externalUrl,
        fullAudioUrl: oa.fullAudioUrl,
        downloadAvailability: 'FULL_SONG',
        downloadReason: `Complete ${oa.fileFormat} audio (${Math.round(oa.durationMs / 1000)}s) available for full offline download.`,
        fileFormat: oa.fileFormat,
        versionType: 'ORIGINAL',
        isPlayableDirectly: true,
        language
      });
    }

    // 1. Apple Music Tracks (High fidelity previews & artwork)
    for (const at of appleTracks) {
      const versionType = IndianCinemaHelper.classifyVersion(at.title, at.artist);
      const composer = IndianCinemaHelper.normalizeComposer(at.artist);

      unifiedTracks.push({
        id: at.id,
        title: at.title,
        artist: at.artist,
        movieName: at.album?.includes('Soundtrack') || at.album?.includes('Original') ? at.album : undefined,
        album: at.album,
        composer,
        singers: [at.artist],
        durationMs: at.durationMs,
        artworkUrl: at.artworkUrl,
        sourcePlatform: 'APPLE_MUSIC',
        sourceUrl: at.externalUrl,
        previewUrl: at.previewUrl,
        downloadAvailability: 'PREVIEW_ONLY',
        downloadReason: 'Apple Music / iTunes only supplies a 30-second preview clip; full-song download is not available.',
        versionType,
        isPlayableDirectly: !!at.previewUrl,
        releaseYear: at.releaseYear,
        language
      });
    }

    // 2. Spotify Tracks
    for (const sp of spotifyTracks) {
      const versionType = IndianCinemaHelper.classifyVersion(sp.title, sp.artist);
      const composer = IndianCinemaHelper.normalizeComposer(sp.artist);

      unifiedTracks.push({
        id: sp.id,
        title: sp.title,
        artist: sp.artist,
        album: sp.album,
        composer,
        singers: [sp.artist],
        durationMs: sp.durationMs,
        artworkUrl: sp.artworkUrl,
        sourcePlatform: 'SPOTIFY',
        sourceUrl: sp.externalUrl,
        previewUrl: sp.previewUrl,
        downloadAvailability: 'PREVIEW_ONLY',
        downloadReason: 'Spotify web catalog only provides a 30-second preview; full-song download is not permitted.',
        versionType,
        isPlayableDirectly: !!sp.previewUrl,
        releaseYear: sp.releaseYear,
        language
      });
    }

    // 3. YouTube Tracks (Official Videos, Covers, Live, Instrumental)
    for (const yt of ytResults) {
      unifiedTracks.push({
        id: yt.id,
        title: yt.title,
        artist: yt.channelTitle,
        durationMs: yt.durationMs,
        artworkUrl: yt.artworkUrl,
        sourcePlatform: 'YOUTUBE',
        sourceUrl: yt.externalUrl,
        embedUrl: yt.embedUrl,
        downloadAvailability: 'STREAM_ONLY',
        downloadReason: 'YouTube tracks play via official audio-stream mode only; full-song downloading is not permitted.',
        versionType: yt.versionType,
        isPlayableDirectly: true, // Playable via official iframe embed modal
        language
      });
    }

    // If matched theme, inject curated collection of theme tracks (e.g. "love songs" -> "En Kannu Kulla")
    const curatedPriorityTracks: UnifiedTrack[] = [];
    if (matchedTheme) {
      for (const trackTitle of matchedTheme.trackTitles) {
        const movie = KNOWN_INDIAN_MOVIES.find((m) =>
          m.trackTitles.some((t) => t.toLowerCase() === trackTitle.toLowerCase())
        );
        curatedPriorityTracks.push(
          this.buildCuratedTrack({
            trackTitle,
            idPrefix: 'theme',
            movie,
            artistFallback: 'Global Artists',
            albumFallback: 'Theme Hits',
            language: movie ? movie.language : 'English'
          })
        );
      }
    }

    // Match songs, singers, composers & movies directly from curated catalogs so searches succeed even offline
    const cleanLower = cleanQuery.toLowerCase();
    const requestedLang =
      options.language && options.language.toUpperCase() !== 'ALL' ? options.language.toLowerCase() : null;
    const matchedMoviesForArtist: typeof KNOWN_INDIAN_MOVIES = [];

    for (const movie of KNOWN_INDIAN_MOVIES) {
      if (requestedLang && movie.language.toLowerCase() !== requestedLang) continue;

      const composerNormalized = movie.composer.toLowerCase();
      const composerAliases = Object.entries(COMPOSER_ALIASES).find(
        ([canonical]) => canonical.toLowerCase() === composerNormalized
      )?.[1] || [];
      const composerMatches =
        composerNormalized.includes(cleanLower) ||
        cleanLower.includes(composerNormalized) ||
        composerAliases.some((a) => cleanLower.includes(a) || a.includes(cleanLower));
      const singerMatches = movie.leadSingers.some(
        (s) => s.toLowerCase().includes(cleanLower) || cleanLower.includes(s.toLowerCase())
      );

      if (composerMatches || singerMatches) {
        matchedMoviesForArtist.push(movie);
        for (const trackTitle of movie.trackTitles.slice(0, 3)) {
          curatedPriorityTracks.push(
            this.buildCuratedTrack({
              trackTitle,
              idPrefix: 'curated',
              movie
            })
          );
        }
      } else {
        for (const trackTitle of movie.trackTitles) {
          if (trackTitle.toLowerCase().includes(cleanLower)) {
            curatedPriorityTracks.push(
              this.buildCuratedTrack({
                trackTitle,
                idPrefix: 'curated',
                movie
              })
            );
          }
        }
      }
    }

    for (const artist of ARTISTS_CATALOG) {
      if (requestedLang && !artist.languages.some((l) => l.toLowerCase() === requestedLang)) {
        continue;
      }
      const artistMatches =
        artist.name.toLowerCase().includes(cleanLower) || cleanLower.includes(artist.name.toLowerCase());
      for (const trackTitle of artist.popularTracks) {
        if (artistMatches || trackTitle.toLowerCase().includes(cleanLower)) {
          const movie = KNOWN_INDIAN_MOVIES.find((m) =>
            m.trackTitles.some((t) => t.toLowerCase() === trackTitle.toLowerCase())
          );
          curatedPriorityTracks.push(
            this.buildCuratedTrack({
              trackTitle,
              idPrefix: 'artist',
              movie,
              artistFallback: artist.name,
              albumFallback: artist.knownFor[0] || `${artist.name} Essentials`,
              composer: artist.role === 'DIRECTOR' ? artist.name : movie?.composer,
              singers: artist.role === 'SINGER' ? [artist.name] : movie?.leadSingers,
              language: (artist.languages[0] as MusicLanguage) || 'Tamil'
            })
          );
        }
      }
    }

    // Combine curated priority tracks + live provider tracks with strict id & title+artist deduplication
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const combinedOrdered = [...curatedPriorityTracks, ...unifiedTracks];
    unifiedTracks.length = 0;
    for (const track of combinedOrdered) {
      const dedupeKey = `${track.title.trim().toLowerCase()}::${track.artist.split('&')[0].trim().toLowerCase()}`;
      if (seenIds.has(track.id) || seenKeys.has(dedupeKey)) continue;
      seenIds.add(track.id);
      seenKeys.add(dedupeKey);
      unifiedTracks.push(track);
    }

    // --- Build Movie Soundtracks grouping ---
    const movieSoundtracks: MovieSoundtrack[] = [];
    const moviesToBuild = knownMovie
      ? [knownMovie]
      : options.type?.toUpperCase() !== 'SONG'
        ? matchedMoviesForArtist.slice(0, 3)
        : [];

    for (const targetMovie of moviesToBuild) {
      const soundtrackTracks: UnifiedTrack[] = targetMovie.trackTitles.map((trackTitle) => {
        const match = unifiedTracks.find(
          (t) =>
            t.title.toLowerCase().includes(trackTitle.toLowerCase()) ||
            trackTitle.toLowerCase().includes(t.title.toLowerCase())
        );

        if (match) {
          return {
            ...match,
            movieName: targetMovie.movieName,
            composer: targetMovie.composer,
            releaseYear: targetMovie.year,
            language: targetMovie.language
          };
        }

        return this.buildCuratedTrack({
          trackTitle,
          idPrefix: 'known',
          movie: targetMovie
        });
      });

      movieSoundtracks.push({
        id: `movie_${targetMovie.movieName.replace(/\s+/g, '_').toLowerCase()}`,
        movieName: targetMovie.movieName,
        releaseYear: targetMovie.year,
        composer: targetMovie.composer,
        language: targetMovie.language,
        artworkUrl:
          soundtrackTracks[0]?.artworkUrl ||
          appleTracks[0]?.artworkUrl ||
          ytResults[0]?.artworkUrl ||
          'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg',
        totalTracks: soundtrackTracks.length,
        externalUrl: `https://music.apple.com/search?term=${encodeURIComponent(targetMovie.movieName)}`,
        tracks: soundtrackTracks
      });
    }

    // Add discovered soundtrack albums from Apple Music
    for (const col of appleSoundtracks) {
      if (movieSoundtracks.some((m) => m.movieName.toLowerCase() === col.name.toLowerCase())) {
        continue;
      }

      const colTracks = unifiedTracks.filter(
        (t) => t.album && t.album.toLowerCase().includes(col.name.toLowerCase())
      );

      movieSoundtracks.push({
        id: col.id,
        movieName: col.name.replace(/\(Original Motion Picture Soundtrack\)/i, '').trim(),
        releaseYear: col.releaseYear,
        composer: IndianCinemaHelper.normalizeComposer(col.artist),
        language,
        artworkUrl: col.artworkUrl,
        totalTracks: Math.max(col.trackCount, colTracks.length),
        externalUrl: col.externalUrl,
        tracks: colTracks
      });
    }

    // --- Version Categorization ---
    const versions = {
      original: unifiedTracks.filter((t) => t.versionType === 'ORIGINAL'),
      videos: unifiedTracks.filter((t) => t.versionType === 'OFFICIAL_VIDEO'),
      live: unifiedTracks.filter((t) => t.versionType === 'LIVE'),
      covers: unifiedTracks.filter((t) => t.versionType === 'COVER'),
      remixes: unifiedTracks.filter((t) => t.versionType === 'REMIX'),
      instrumental: unifiedTracks.filter((t) => t.versionType === 'INSTRUMENTAL' || t.versionType === 'BGM')
    };

    // Apply platform filters if specified
    let filteredSongs = unifiedTracks;
    if (options.platform && options.platform !== 'ALL') {
      const plat = options.platform.toUpperCase();
      filteredSongs = unifiedTracks.filter((t) => t.sourcePlatform === plat);
    }

    return {
      query: cleanQuery,
      intent,
      language,
      theme: matchedTheme
        ? {
            id: matchedTheme.id,
            name: matchedTheme.name,
            description: matchedTheme.description,
            songCount: matchedTheme.trackTitles.length
          }
        : undefined,
      movies: movieSoundtracks,
      songs: filteredSongs,
      versions,
      totalResults: filteredSongs.length + movieSoundtracks.reduce((sum, m) => sum + m.tracks.length, 0)
    };
  }

  /**
   * Search specifically for versions of a single song
   */
  static async getSongVersions(songTitle: string, artist: string = ''): Promise<{
    original: UnifiedTrack[];
    videos: UnifiedTrack[];
    live: UnifiedTrack[];
    covers: UnifiedTrack[];
    remixes: UnifiedTrack[];
    instrumental: UnifiedTrack[];
  }> {
    const ytVersions = await YouTubeProvider.searchSongVersions(songTitle, artist);
    const appleTracks = await AppleMusicProvider.searchTracks(`${songTitle} ${artist}`, 8);

    const mapYt = (list: YouTubeTrackResult[], type: SongVersionType): UnifiedTrack[] =>
      list.map((yt) => ({
        id: yt.id,
        title: yt.title,
        artist: yt.channelTitle,
        durationMs: yt.durationMs,
        artworkUrl: yt.artworkUrl,
        sourcePlatform: 'YOUTUBE',
        sourceUrl: yt.externalUrl,
        embedUrl: yt.embedUrl,
        versionType: type,
        isPlayableDirectly: true
      }));

    const appleOriginals: UnifiedTrack[] = appleTracks.map((at) => ({
      id: at.id,
      title: at.title,
      artist: at.artist,
      album: at.album,
      durationMs: at.durationMs,
      artworkUrl: at.artworkUrl,
      sourcePlatform: 'APPLE_MUSIC',
      sourceUrl: at.externalUrl,
      previewUrl: at.previewUrl,
      versionType: IndianCinemaHelper.classifyVersion(at.title, at.artist),
      isPlayableDirectly: !!at.previewUrl,
      releaseYear: at.releaseYear
    }));

    return {
      original: [...appleOriginals.filter((t) => t.versionType === 'ORIGINAL'), ...mapYt(ytVersions.original, 'ORIGINAL')],
      videos: mapYt(ytVersions.videos, 'OFFICIAL_VIDEO'),
      live: mapYt(ytVersions.live, 'LIVE'),
      covers: mapYt(ytVersions.covers, 'COVER'),
      remixes: mapYt(ytVersions.remixes, 'REMIX'),
      instrumental: mapYt(ytVersions.instrumental, 'INSTRUMENTAL')
    };
  }

  /**
   * Lookup complete soundtrack tracks by movie / album identifier
   */
  static async getMovieSoundtrackById(id: string): Promise<MovieSoundtrack | null> {
    // If it's a known movie format: e.g. movie_vaaranam_aayiram
    if (id.startsWith('movie_')) {
      const name = id.replace('movie_', '').replace(/_/g, ' ');
      const known = IndianCinemaHelper.findKnownMovie(name);
      if (known) {
        const tracks: UnifiedTrack[] = known.trackTitles.map((title, idx) => ({
          id: `track_${known.movieName.toLowerCase().replace(/\s+/g, '_')}_${idx + 1}`,
          title,
          artist: known.composer,
          movieName: known.movieName,
          album: known.movieName,
          composer: known.composer,
          singers: known.leadSingers,
          durationMs: 270000,
          artworkUrl: (KNOWN_TRACK_VIDEO_MAP[title]
            ? `https://i.ytimg.com/vi/${KNOWN_TRACK_VIDEO_MAP[title]}/hqdefault.jpg`
            : undefined) || 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg',
          sourcePlatform: 'YOUTUBE',
          sourceUrl: KNOWN_TRACK_VIDEO_MAP[title]
            ? `https://www.youtube.com/watch?v=${KNOWN_TRACK_VIDEO_MAP[title]}`
            : `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' ' + known.movieName)}`,
          versionType: 'ORIGINAL',
          isPlayableDirectly: true,
          releaseYear: known.year,
          language: known.language
        }));

        return {
          id,
          movieName: known.movieName,
          releaseYear: known.year,
          composer: known.composer,
          language: known.language,
          artworkUrl: tracks[0]?.artworkUrl || 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg',
          totalTracks: tracks.length,
          tracks
        };
      }
    }

    // If it's an Apple Music collection ID
    if (id.startsWith('apple_col_')) {
      const tracks = await AppleMusicProvider.lookupSoundtrackTracks(id);
      if (tracks.length > 0) {
        const first = tracks[0];
        return {
          id,
          movieName: first.album || 'Soundtrack',
          releaseYear: first.releaseYear,
          composer: IndianCinemaHelper.normalizeComposer(first.artist),
          language: IndianCinemaHelper.detectLanguage(first.title + ' ' + first.album),
          artworkUrl: first.artworkUrl,
          totalTracks: tracks.length,
          tracks: tracks.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            composer: IndianCinemaHelper.normalizeComposer(t.artist),
            durationMs: t.durationMs,
            artworkUrl: t.artworkUrl,
            sourcePlatform: 'APPLE_MUSIC',
            sourceUrl: t.externalUrl,
            previewUrl: t.previewUrl,
            versionType: IndianCinemaHelper.classifyVersion(t.title, t.artist),
            isPlayableDirectly: !!t.previewUrl,
            releaseYear: t.releaseYear
          }))
        };
      }
    }

    return null;
  }
}
