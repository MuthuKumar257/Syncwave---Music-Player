export type TargetType = 'PLAYLIST' | 'SONG';
export type SchedulePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TransitionType = 'IMMEDIATE' | 'CROSSFADE' | 'FADE_OUT_IN';
export type RepeatType = 'ONCE' | 'DAILY' | 'WEEKDAYS' | 'CUSTOM_DAYS';

export type SongVersionType =
  | 'ORIGINAL'
  | 'OFFICIAL_VIDEO'
  | 'REMIX'
  | 'COVER'
  | 'LIVE'
  | 'INSTRUMENTAL'
  | 'ACOUSTIC'
  | 'KARAOKE'
  | 'BGM';

export type MusicLanguage =
  | 'Tamil'
  | 'Telugu'
  | 'Hindi'
  | 'Malayalam'
  | 'Kannada'
  | 'Bengali'
  | 'Marathi'
  | 'Punjabi'
  | 'English'
  | 'Instrumental'
  | 'Other';

export type SongOriginType = 'DOWNLOADED' | 'FOLDER' | 'DEVICE';
export type DownloadAvailability = 'FULL_SONG' | 'PREVIEW_ONLY' | 'STREAM_ONLY' | 'UNAVAILABLE';
export type DownloadTaskStatus = 'queued' | 'downloading' | 'paused' | 'verifying' | 'failed';

export interface DownloadTask {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  sourcePlatform: string;
  externalUrl?: string;
  downloadUrl: string;
  mimeType: string;
  fileFormat: string;
  fileName: string;
  expectedDurationMs: number;
  expectedBytes?: number;
  bytesReceived: number;
  supportsRange: boolean;
  chunks: ArrayBuffer[];
  status: DownloadTaskStatus;
  error?: string;
  updatedAt: string;
}

export interface MusicFolderEntry {
  id: string;
  name: string;
  isDefault: boolean;
  handle?: any; // FileSystemDirectoryHandle (Chromium)
  permissionState: 'granted' | 'prompt' | 'denied' | 'fallback';
  addedAt: string;
  lastScannedAt?: string;
  trackCount?: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  uri?: string;
  blob?: Blob;
  fileHandle?: any; // FileSystemFileHandle (lazy local offline playback)
  artworkUrl?: string;
  source: 'LOCAL' | 'SPOTIFY' | 'YOUTUBE' | 'APPLE_MUSIC' | 'OPEN_AUDIO' | 'CLOUD' | 'DOWNLOADED';
  originType?: SongOriginType;
  fileFormat?: string;
  folderId?: string;
  folderName?: string;
  relativePath?: string;
  lastModified?: number;
  externalUrl?: string;
  genre?: string;
  language?: string;
  composer?: string;
  mood?: string;
  fileSize?: number;
  versionType?: SongVersionType;
  videoId?: string;
  isLocal?: boolean;
  storageLocation?: 'LOCAL_DEVICE';
  localFileName?: string;
  verifiedFullLength?: boolean;
  createdAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  songIds: string[];
  songCount: number;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime?: string;
  repeatType: RepeatType;
  daysOfWeek: number[]; // 1=Mon .. 7=Sun
  targetType: TargetType;
  targetId: string;
  targetName: string;
  priority: SchedulePriority;
  isEnabled: boolean;
  transitionType: TransitionType;
  transitionSec: number;
  volume: number;
  lastExecutedAt?: string;
  createdAt: string;
}

export interface ScheduleHistoryRecord {
  id: string;
  scheduleId: string;
  scheduleName: string;
  targetName: string;
  executedAt: string;
  success: boolean;
  statusMessage: string;
  clientPlatform: 'ANDROID' | 'WEB';
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  authProvider?: 'EMAIL' | 'GOOGLE';
  emailVerified?: boolean;
  createdAt: string;
}

export interface UserSettings {
  crossfadeDurationSeconds: number;
  themeMode: 'DARK' | 'LIGHT' | 'SYSTEM';
  streamingQuality: 'LOW' | 'MEDIUM' | 'HIGH';
  offlineCacheLimitMb: number;
  autoScheduleEnabled: boolean;
}

// --- Universal Search Models ---
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
  downloadAvailability?: DownloadAvailability;
  downloadReason?: string;
  fileFormat?: string;
  versionType: SongVersionType;
  isPlayableDirectly: boolean;
  releaseYear?: number;
  language?: MusicLanguage;
  genre?: string;
  mood?: string;
  isrc?: string;
  recommendationReason?: string;
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
  intent: 'MOVIE' | 'SONG' | 'ARTIST' | 'ALBUM' | 'GENERAL' | 'THEME';
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

export interface SearchSuggestion {
  text: string;
  type: 'MOVIE' | 'SONG' | 'ARTIST';
  subtitle: string;
}

// --- AI Recommendation & Personalization Models ---
export interface ArtistItem {
  id: string;
  name: string;
  canonicalName?: string;
  category?: 'ARTIST';
  role: 'DIRECTOR' | 'SINGER' | 'ALL';
  roleTitle?: string;
  languages: string[];
  imageUrl: string;
  knownFor: string[];
  popularTracks: string[];
  aliases?: string[];
  description?: string;
}

export interface SongListeningStat {
  songId: string;
  songName: string;
  movieOrAlbum?: string;
  musicDirector?: string;
  singers: string[];
  language?: string;
  genre?: string;
  playCount: number;
  replayCount: number;
  totalListeningDurationMs: number;
  skipCount: number;
  lastPlayedAt: string;
  isFavorite: boolean;
}

export interface UserMusicPreference {
  userId: string;
  preferredLanguages: string[];
  favouriteArtists: string[];
  favouriteGenres: string[];
  favouriteComposers: string[];
  favouriteSingers?: string[];
  favouriteMovies: string[];
  preferredMoods?: string[];
  hasCompletedOnboarding?: boolean;
  personalizationEnabled: boolean;
  historyEnabled: boolean;
  updatedAt: string;
}

export interface DailyMixItem {
  id: string;
  title: string;
  subtitle: string;
  language: string;
  coverUrl: string;
  trackCount: number;
  tracks: UnifiedTrack[];
}

export interface ArtistAlbumGroup {
  id: string;
  name: string;
  releaseYear?: number;
  language?: string;
  artworkUrl: string;
  tracks: UnifiedTrack[];
}

export interface ArtistRecommendationCard {
  id: string;
  name: string;
  category?: 'ARTIST';
  role: 'DIRECTOR' | 'SINGER';
  roleTitle?: string;
  languages?: string[];
  imageUrl?: string;
  isFavourite?: boolean;
  isDiscovery?: boolean;
  reason?: string;
  knownFor?: string[];
  tracks: UnifiedTrack[];
  albums?: ArtistAlbumGroup[];
}

export interface MoodPlaylistCard {
  id: string;
  mood: string;
  title: string;
  description: string;
  artworkUrl: string;
  accentColor: string;
  trackCount: number;
  tracks: UnifiedTrack[];
}

export interface PersonalizedFeed {
  greeting: string;
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  contextTitle: string;
  contextDescription: string;
  preferredLanguages: string[];
  requiresLanguageSelection?: boolean;
  generatedAt?: string;

  // 15 Explicit Dynamic Home Sections:
  madeForYou: UnifiedTrack[];
  dailyMixes: DailyMixItem[];
  becauseYouListenedTo: {
    basedOn: string;
    tracks: UnifiedTrack[];
  };
  basedOnFavouriteArtists?: UnifiedTrack[];
  basedOnFavouriteDirectors?: UnifiedTrack[];
  recentlyPlayed: UnifiedTrack[];
  favouriteSongs?: UnifiedTrack[];
  similarToFavouriteSongs?: UnifiedTrack[];
  trendingInLanguages: UnifiedTrack[];
  newReleases: UnifiedTrack[];
  discoverSomethingNew?: UnifiedTrack[];
  yourMoodMix?: MoodPlaylistCard[];
  continueListening: UnifiedTrack[];
  mostPlayedArtists?: ArtistRecommendationCard[];
  songsYouMayLike?: UnifiedTrack[];

  // Compatibility fields & aliases:
  recommendedForYou: UnifiedTrack[];
  basedOnListeningHistory: {
    basedOn: string;
    tracks: UnifiedTrack[];
  };
  moreFromFavouriteArtists?: UnifiedTrack[];
  sameMusicDirector?: {
    director: string;
    tracks: UnifiedTrack[];
  };
  favouriteArtists?: ArtistRecommendationCard[];
  recommendedSingers?: ArtistRecommendationCard[];
  recommendedMusicDirectors?: ArtistRecommendationCard[];
  moodPlaylists?: MoodPlaylistCard[];
  similarSongs?: UnifiedTrack[];
  popularSongs?: UnifiedTrack[];
  favouriteMusicDirectors: Array<{
    director: string;
    tracks: UnifiedTrack[];
  }>;
  favouriteSingers: Array<{
    singer: string;
    tracks: UnifiedTrack[];
  }>;
  discoverNewMusic: UnifiedTrack[];
  movieSoundtracks: MovieSoundtrack[];

  languageSections: Array<{
    language: string;
    recommended: UnifiedTrack[];
    trending: UnifiedTrack[];
    soundtracks: MovieSoundtrack[];
  }>;
  favouriteArtistPicks: Array<{
    artist: string;
    tracks: UnifiedTrack[];
  }>;
  timeBasedPicks: {
    contextName: string;
    description: string;
    tracks: UnifiedTrack[];
  };
  discoverNew: UnifiedTrack[];
}

export interface SmartPlaylistRequest {
  language?: string;
  genreOrMood?: string;
  artist?: string;
  composer?: string;
  movie?: string;
  targetDurationMinutes?: number;
}

export interface SmartPlaylistResponse {
  id: string;
  name: string;
  description: string;
  artworkUrl: string;
  language?: string;
  genreOrMood?: string;
  totalTracks: number;
  totalDurationMs: number;
  tracks: UnifiedTrack[];
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
  topListenedDirectors?: Array<{
    name: string;
    playCount: number;
    replayCount?: number;
    totalDurationMs?: number;
    uniqueSongsCount?: number;
    imageUrl?: string;
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
    songsCount?: number;
    percentage: number;
  }>;
  dailyActivity?: Array<{
    date: string;
    day: string;
    dayName?: string;
    plays: number;
    durationMinutes: number;
  }>;
  weeklyActivity?: Array<{
    week: string;
    plays: number;
    durationMinutes: number;
  }>;
  totalListeningHours?: number;
  formattedListeningTime?: string;
  summary: {
    totalPlays: number;
    totalRewatches: number;
    totalListeningMinutes: number;
    totalListeningHours?: number;
    formattedListeningTime?: string;
    uniqueSongsPlayed: number;
    uniqueArtistsListened: number;
    preferredLanguages: string[];
    historySource: 'SUPABASE' | 'TEST_MEMORY' | 'UNCONFIGURED' | 'LOCAL_STORE';
  };
}

export interface SongDetailedStats {
  songId: string;
  songName: string;
  movieOrAlbum?: string;
  musicDirector?: string;
  singers: string[];
  language?: string;
  genre?: string;
  playCount: number;
  replayCount: number;
  totalListeningDurationMs: number;
  averageListeningDurationMs: number;
  completionPercentage: number;
  skipCount: number;
  lastPlayedAt: string;
  isFavorite: boolean;
}
