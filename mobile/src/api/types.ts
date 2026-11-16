import { z } from 'zod';

export const TrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  movieName: z.string().optional(),
  album: z.string().optional(),
  composer: z.string().optional(),
  singers: z.array(z.string()).optional(),
  durationMs: z.number(),
  artworkUrl: z.string().optional(),
  sourcePlatform: z.enum(['YOUTUBE', 'SPOTIFY', 'APPLE_MUSIC', 'LOCAL', 'DOWNLOADED']),
  sourceUrl: z.string(),
  previewUrl: z.string().optional(),
  versionType: z.string().optional(),
  isPlayableDirectly: z.boolean().default(false),
  releaseYear: z.number().optional(),
  language: z.string().optional(),
  storageLocation: z.enum(['LOCAL_DEVICE']).optional(),
  localFilePath: z.string().optional(),
  recommendationReason: z.string().optional()
});

export type Track = z.infer<typeof TrackSchema>;

export const MovieSoundtrackSchema = z.object({
  id: z.string(),
  movieName: z.string(),
  releaseYear: z.number().optional(),
  composer: z.string(),
  language: z.string(),
  artworkUrl: z.string().optional(),
  totalTracks: z.number(),
  tracks: z.array(TrackSchema)
});

export type MovieSoundtrack = z.infer<typeof MovieSoundtrackSchema>;

export const ArtistItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  role: z.enum(['DIRECTOR', 'SINGER']),
  roleTitle: z.string().optional(),
  languages: z.array(z.string()),
  imageUrl: z.string(),
  knownFor: z.array(z.string()),
  popularTracks: z.array(z.string())
});

export type ArtistItem = z.infer<typeof ArtistItemSchema>;

export const SongListeningStatSchema = z.object({
  songId: z.string(),
  songName: z.string(),
  movieOrAlbum: z.string().optional(),
  musicDirector: z.string().optional(),
  singers: z.array(z.string()).optional(),
  language: z.string().optional(),
  genre: z.string().optional(),
  playCount: z.number().default(0),
  replayCount: z.number().default(0),
  totalListeningDurationMs: z.number().default(0),
  skipCount: z.number().default(0),
  lastPlayedAt: z.string().optional(),
  isFavorite: z.boolean().default(false)
});

export type SongListeningStat = z.infer<typeof SongListeningStatSchema>;

export const UserPreferencesSchema = z.object({
  userId: z.string().optional(),
  preferredLanguages: z.array(z.string()).default([]),
  favouriteArtists: z.array(z.string()).default([]),
  favouriteGenres: z.array(z.string()).default([]),
  favouriteComposers: z.array(z.string()).default([]),
  favouriteSingers: z.array(z.string()).default([]),
  favouriteMovies: z.array(z.string()).default([]),
  preferredMoods: z.array(z.string()).default([]),
  hasCompletedOnboarding: z.boolean().default(false),
  personalizationEnabled: z.boolean().default(true),
  historyEnabled: z.boolean().default(true)
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export interface ArtistGroup {
  id?: string;
  name: string;
  category?: string;
  role?: 'DIRECTOR' | 'SINGER';
  roleTitle?: string;
  imageUrl?: string;
  tracks: Track[];
}

export interface DirectorGroup {
  director: string;
  tracks: Track[];
}

export interface SingerGroup {
  singer: string;
  tracks: Track[];
}

export interface PersonalizedFeed {
  greeting: string;
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  contextTitle: string;
  contextDescription: string;
  preferredLanguages: string[];
  requiresLanguageSelection?: boolean;

  // 10 Explicit Dashboard Sections
  recentlyPlayed: Track[];
  continueListening: Track[];
  recommendedForYou: Track[];
  basedOnListeningHistory: {
    basedOn: string;
    tracks: Track[];
  };
  moreFromFavouriteArtists?: Track[];
  sameMusicDirector?: {
    director: string;
    tracks: Track[];
  };
  similarSongs?: Track[];
  favouriteArtists?: ArtistGroup[];
  favouriteMusicDirectors: DirectorGroup[];
  favouriteSingers: SingerGroup[];
  trendingInLanguages: Track[];
  newReleases: Track[];
  discoverNewMusic: Track[];
  movieSoundtracks: MovieSoundtrack[];
}

export interface UniversalSearchResults {
  query: string;
  intent: string;
  language: string;
  theme?: {
    id: string;
    name: string;
    description: string;
    songCount: number;
  };
  movies: MovieSoundtrack[];
  songs: Track[];
  totalResults: number;
}

export interface ProfileArtistStat {
  name: string;
  roleTitle?: string;
  imageUrl?: string;
  playCount: number;
  replayCount: number;
  totalDurationMs: number;
  uniqueSongsCount: number;
}

export interface ProfileSongRewatchStat {
  songId: string;
  title: string;
  artist: string;
  artworkUrl: string;
  videoId?: string;
  playCount: number;
  rewatchCount: number;
  lastPlayedAt: string;
}

export interface ProfileStats {
  favouriteArtist: {
    name: string;
    roleTitle: string;
    imageUrl?: string;
  } | null;
  favouriteArtists: Array<{
    name: string;
    roleTitle: string;
    imageUrl?: string;
  }>;
  mostListenedArtist: ProfileArtistStat | null;
  topListenedArtists: ProfileArtistStat[];
  mostRewatchedSongs: ProfileSongRewatchStat[];
  totalListeningHours?: number;
  formattedListeningTime?: string;
  topListenedDirectors?: Array<{
    name: string;
    playCount: number;
    replayCount: number;
    totalDurationMs: number;
  }>;
  mostPlayedSongs?: Array<{
    songId: string;
    title: string;
    artist: string;
    artworkUrl: string;
    playCount: number;
    replayCount: number;
    totalDurationMs: number;
    lastPlayedAt: string;
  }>;
  languageBreakdown?: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
  dailyActivity?: Array<{
    date: string;
    day: string;
    plays: number;
    durationMinutes: number;
  }>;
  weeklyActivity?: Array<{
    week: string;
    plays: number;
    durationMinutes: number;
  }>;
  summary: {
    totalPlays: number;
    totalRewatches: number;
    totalListeningMinutes: number;
    totalListeningHours?: number;
    formattedListeningTime?: string;
    uniqueSongsPlayed: number;
    uniqueArtistsListened: number;
    preferredLanguages: string[];
    historySource: 'SUPABASE' | 'TEST_MEMORY' | 'UNCONFIGURED';
  };
}
