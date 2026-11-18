import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  authProvider?: 'EMAIL' | 'GOOGLE';
  googleSub?: string;
  emailVerified?: boolean;
  welcomeEmailSent?: boolean;
  welcomeEmailSentAt?: string;
  welcomeEmailStatus?: 'PENDING' | 'IN_PROGRESS' | 'SENT' | 'FAILED' | 'SKIPPED';
  createdAt: string;
  updatedAt: string;
}

export interface SongMetadata {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl?: string;
  source: 'LOCAL' | 'DOWNLOADED' | 'SPOTIFY' | 'YOUTUBE';
  externalUrl?: string;
  language?: string;
  languages?: string[];
  composer?: string;
  movie?: string;
  movieName?: string;
  mood?: string;
  genre?: string;
  singers?: string[];
  videoId?: string;
  fullAudioUrl?: string;
  previewUrl?: string;
  isPlayableDirectly?: boolean;
  releaseYear?: number;
  createdAt: string;
}

export interface PlaylistData {
  id: string;
  userId: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  isFavorite: boolean;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MusicScheduleData {
  id: string;
  userId: string;
  name: string;
  startTime: string; // 'HH:mm'
  endTime?: string;
  startDate?: string;
  endDate?: string;
  repeatType: 'ONCE' | 'DAILY' | 'WEEKDAYS' | 'CUSTOM_DAYS';
  daysOfWeek: number[]; // 1-7
  targetType: 'PLAYLIST' | 'SONG';
  targetId: string;
  targetName: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isEnabled: boolean;
  transitionType: 'IMMEDIATE' | 'CROSSFADE' | 'FADE_OUT_IN';
  transitionSec: number;
  volume: number;
  missedPolicy: 'PLAY_IMMEDIATELY' | 'SKIP' | 'PLAY_IF_WITHIN_WINDOW';
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleHistoryRecord {
  id: number;
  userId: string;
  scheduleId?: string;
  scheduleName: string;
  targetName: string;
  executedAt: string;
  success: boolean;
  statusMessage: string;
  clientPlatform: 'ANDROID' | 'WEB';
}

export interface PlayHistoryRecord {
  id: number;
  userId: string;
  songId: string;
  songTitle: string;
  artistName: string;
  musicDirector?: string;
  language?: string;
  playedAt: string;
  durationListenedMs: number;
  completed: boolean;
  clientPlatform: 'ANDROID' | 'WEB';
}

export interface UserSettingsData {
  userId: string;
  isDarkMode: boolean;
  crossfadeEnabled: boolean;
  crossfadeDurationSec: number;
  playbackSpeed: number;
  updatedAt: string;
}

export interface UserMusicPreference {
  userId: string;
  preferredLanguages: string[];
  favouriteArtists: string[];
  favouriteComposers: string[]; // Music Directors
  favouriteSingers: string[];   // Singers
  favouriteGenres: string[];
  favouriteMovies: string[];
  preferredMoods?: string[];
  preferenceVersion?: number;
  hasCompletedOnboarding?: boolean;
  personalizationEnabled: boolean;
  historyEnabled: boolean;
  updatedAt: string;
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
  averageListeningDurationMs: number;
  completionPercentage: number;
  completedCount: number;
  skipCount: number;
  lastPlayedAt: string;
  isFavorite: boolean;
}

export type ListeningEventType =
  | 'PLAY'
  | 'COMPLETE'
  | 'SKIP'
  | 'REPLAY'
  | 'LIKE'
  | 'ADD_TO_PLAYLIST';

export interface ListeningEventRecord {
  id: number;
  userId: string;
  songId: string;
  songTitle: string;
  artistName: string;
  musicDirector?: string;
  language?: string;
  genre?: string;
  eventType: ListeningEventType;
  durationPlayedSec: number;
  totalDurationSec: number;
  clientPlatform: 'ANDROID' | 'WEB';
  timestamp: string;
}

export type RecommendationFeedbackType =
  | 'LIKE'
  | 'DISLIKE'
  | 'HIDE'
  | 'NOT_INTERESTED'
  | 'MORE_LIKE_THIS'
  | 'LESS_LIKE_THIS';

export interface RecommendationFeedbackRecord {
  id: number;
  userId: string;
  targetId: string;
  targetType: 'SONG' | 'SOUNDTRACK' | 'ARTIST' | 'COMPOSER';
  feedbackType: RecommendationFeedbackType;
  timestamp: string;
}

export interface RecommendationImpressionRecord {
  id: number;
  userId: string;
  songId: string;
  sectionName: string;
  timestamp: string;
}

export interface RecommendationWeightsConfig {
  artistPreference: number;        // 0.20 (20%)
  musicDirector: number;           // 0.15 (15%)
  genreAndMood: number;            // 0.15 (15%)
  listeningBehavior: number;       // 0.25 (25%)
  favoritesSimilarity: number;     // 0.15 (15%)
  discoveryFreshness: number;      // 0.10 (10%)
  // Optional backward compatibility aliases
  languageMatch?: number;
  listeningHistory?: number;
  songSimilarity?: number;
  discoveryPopularity?: number;
}

export interface DailyMixRecord {
  id: string;
  userId: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  language: string;
  trackIds: string[];
  createdAt: string;
}

class InMemorySyncStore {
  users: Map<string, User> = new Map();
  songs: Map<string, SongMetadata> = new Map();
  playlists: Map<string, PlaylistData> = new Map();
  schedules: Map<string, MusicScheduleData> = new Map();
  scheduleHistory: ScheduleHistoryRecord[] = [];
  favorites: Map<string, Set<string>> = new Map(); // userId -> Set of targetId
  playHistory: PlayHistoryRecord[] = [];
  settings: Map<string, UserSettingsData> = new Map();
  userPreferences: Map<string, UserMusicPreference> = new Map();
  listeningEvents: ListeningEventRecord[] = [];
  feedbacks: RecommendationFeedbackRecord[] = [];
  impressions: RecommendationImpressionRecord[] = [];
  dailyMixes: Map<string, DailyMixRecord[]> = new Map(); // userId -> DailyMixRecord[]
  userSongStats: Map<string, Map<string, SongListeningStat>> = new Map(); // userId -> (songId -> SongListeningStat)

  private historyIdCounter = 1;
  private eventIdCounter = 1;
  private feedbackIdCounter = 1;
  private impressionIdCounter = 1;
  private userStateVersions: Map<string, number> = new Map();
  private recommendationWeights: RecommendationWeightsConfig = {
    artistPreference: 0.20,
    musicDirector: 0.15,
    genreAndMood: 0.15,
    listeningBehavior: 0.25,
    favoritesSimilarity: 0.15,
    discoveryFreshness: 0.10,
    languageMatch: 0.0,
    listeningHistory: 0.25,
    songSimilarity: 0.15,
    discoveryPopularity: 0.10
  };
  private diskFilePath = path.resolve(__dirname, '../../data/syncwave_store.json');
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.seedInitialMusic();
    this.loadFromDisk();
  }

  private isTestMode(): boolean {
    return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  }

  private loadFromDisk(): void {
    if (this.isTestMode()) return;
    try {
      if (fs.existsSync(this.diskFilePath)) {
        const raw = fs.readFileSync(this.diskFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.users && Array.isArray(parsed.users)) {
          this.users = new Map(parsed.users);
        }
        if (parsed.songs && Array.isArray(parsed.songs)) {
          this.songs = new Map(parsed.songs);
        }
        if (parsed.playlists && Array.isArray(parsed.playlists)) {
          this.playlists = new Map(parsed.playlists);
        }
        if (parsed.schedules && Array.isArray(parsed.schedules)) {
          this.schedules = new Map(parsed.schedules);
        }
        if (parsed.scheduleHistory && Array.isArray(parsed.scheduleHistory)) {
          this.scheduleHistory = parsed.scheduleHistory;
        }
        if (parsed.favorites && Array.isArray(parsed.favorites)) {
          this.favorites = new Map(
            parsed.favorites.map(([k, v]: [string, string[]]) => [k, new Set(v)])
          );
        }
        if (parsed.playHistory && Array.isArray(parsed.playHistory)) {
          this.playHistory = parsed.playHistory;
        }
        if (parsed.settings && Array.isArray(parsed.settings)) {
          this.settings = new Map(parsed.settings);
        }
        if (parsed.userPreferences && Array.isArray(parsed.userPreferences)) {
          this.userPreferences = new Map(parsed.userPreferences);
        }
        if (parsed.listeningEvents && Array.isArray(parsed.listeningEvents)) {
          this.listeningEvents = parsed.listeningEvents;
        }
        if (parsed.userSongStats && Array.isArray(parsed.userSongStats)) {
          this.userSongStats = new Map(
            parsed.userSongStats.map(([userId, stats]: [string, [string, SongListeningStat][]]) => [
              userId,
              new Map(stats)
            ])
          );
        }
        if (typeof parsed.historyIdCounter === 'number') {
          this.historyIdCounter = parsed.historyIdCounter;
        }
        if (typeof parsed.eventIdCounter === 'number') {
          this.eventIdCounter = parsed.eventIdCounter;
        }
      }
    } catch (err) {
      console.warn('[SyncStore] Note: Could not load syncwave_store.json:', err);
    }
  }

  persistToDisk(): void {
    if (this.isTestMode()) return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        const dir = path.dirname(this.diskFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const data = {
          users: Array.from(this.users.entries()),
          songs: Array.from(this.songs.entries()),
          playlists: Array.from(this.playlists.entries()),
          schedules: Array.from(this.schedules.entries()),
          scheduleHistory: this.scheduleHistory.slice(0, 1000),
          favorites: Array.from(this.favorites.entries()).map(([k, v]) => [k, Array.from(v)]),
          playHistory: this.playHistory.slice(0, 2000),
          settings: Array.from(this.settings.entries()),
          userPreferences: Array.from(this.userPreferences.entries()),
          listeningEvents: this.listeningEvents.slice(0, 2000),
          userSongStats: Array.from(this.userSongStats.entries()).map(([k, v]) => [
            k,
            Array.from(v.entries())
          ]),
          historyIdCounter: this.historyIdCounter,
          eventIdCounter: this.eventIdCounter
        };
        fs.writeFileSync(this.diskFilePath, JSON.stringify(data), 'utf-8');
      } catch (err) {
        console.warn('[SyncStore] Warning: Failed to persist syncwave_store.json:', err);
      }
    }, 400);
  }

  seedInitialMusic(): void {
    const sampleSongs: SongMetadata[] = [
      {
        id: 'sync_seed_1',
        title: 'Morning Focus & Clarity',
        artist: 'SyncWave Ambience',
        album: 'Daily Routines Vol. 1',
        durationMs: 240000,
        artworkUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=60',
        source: 'LOCAL',
        externalUrl: 'https://syncwave.app',
        language: 'English',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sync_seed_2',
        title: 'High Tempo Workout Beat',
        artist: 'Cardio Flow',
        album: 'Power Routines',
        durationMs: 215000,
        artworkUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=60',
        source: 'LOCAL',
        externalUrl: 'https://syncwave.app',
        language: 'English',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sync_seed_3',
        title: 'Midnight Deep Sleep Waves',
        artist: 'Nocturne Acoustics',
        album: 'Dreamstate',
        durationMs: 360000,
        artworkUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=60',
        source: 'LOCAL',
        language: 'English',
        createdAt: new Date().toISOString()
      }
    ];

    for (const song of sampleSongs) {
      this.songs.set(song.id, song);
    }
  }

  seedCatalogTracks(tracks: SongMetadata[]): void {
    if (!Array.isArray(tracks)) return;
    for (const track of tracks) {
      if (track && track.id) {
        this.songs.set(track.id, track);
      }
    }
  }

  // Users
  createUser(
    email: string,
    passwordHash: string,
    displayName: string,
    options?: {
      authProvider?: 'EMAIL' | 'GOOGLE';
      googleSub?: string;
      avatarUrl?: string;
      emailVerified?: boolean;
      welcomeEmailSent?: boolean;
      welcomeEmailSentAt?: string;
      welcomeEmailStatus?: 'PENDING' | 'IN_PROGRESS' | 'SENT' | 'FAILED' | 'SKIPPED';
    }
  ): User {
    const user: User = {
      id: crypto.randomUUID(),
      email: email.toLowerCase().trim(),
      passwordHash,
      displayName,
      avatarUrl: options?.avatarUrl,
      authProvider: options?.authProvider || 'EMAIL',
      googleSub: options?.googleSub,
      emailVerified: options?.emailVerified ?? false,
      welcomeEmailSent: options?.welcomeEmailSent ?? false,
      welcomeEmailSentAt: options?.welcomeEmailSentAt,
      welcomeEmailStatus: options?.welcomeEmailStatus || 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.users.set(user.id, user);

    // Initial default settings
    this.settings.set(user.id, {
      userId: user.id,
      isDarkMode: true,
      crossfadeEnabled: true,
      crossfadeDurationSec: 3,
      playbackSpeed: 1.0,
      updatedAt: new Date().toISOString()
    });

    // Default favorites set
    this.favorites.set(user.id, new Set());

    return user;
  }

  findOrCreateGoogleUser(profile: {
    sub: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  }): { user: User; isNewUser: boolean } {
    const normalizedEmail = profile.email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.googleSub === profile.sub || user.email === normalizedEmail) {
        user.googleSub = profile.sub;
        user.avatarUrl = profile.avatarUrl || user.avatarUrl;
        user.emailVerified = true;
        user.updatedAt = new Date().toISOString();
        this.users.set(user.id, user);
        return { user, isNewUser: false };
      }
    }

    const newUser = this.createUser(normalizedEmail, '', profile.displayName, {
      authProvider: 'GOOGLE',
      googleSub: profile.sub,
      avatarUrl: profile.avatarUrl,
      emailVerified: true,
      welcomeEmailSent: false,
      welcomeEmailStatus: 'PENDING'
    });
    return { user: newUser, isNewUser: true };
  }

  claimWelcomeEmailSend(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    if (
      user.welcomeEmailSent ||
      user.welcomeEmailStatus === 'SENT' ||
      user.welcomeEmailStatus === 'IN_PROGRESS'
    ) {
      return false;
    }
    user.welcomeEmailStatus = 'IN_PROGRESS';
    user.updatedAt = new Date().toISOString();
    this.users.set(user.id, user);
    return true;
  }

  markWelcomeEmailResult(
    userId: string,
    success: boolean,
    options?: { error?: string }
  ): void {
    const user = this.users.get(userId);
    if (!user) return;
    if (success) {
      user.welcomeEmailSent = true;
      user.welcomeEmailSentAt = new Date().toISOString();
      user.welcomeEmailStatus = 'SENT';
    } else {
      user.welcomeEmailStatus = 'FAILED';
    }
    user.updatedAt = new Date().toISOString();
    this.users.set(user.id, user);
  }

  getWelcomeEmailStatus(userId: string): {
    sent: boolean;
    sentAt?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'SENT' | 'FAILED' | 'SKIPPED';
  } | null {
    const user = this.users.get(userId);
    if (!user) return null;
    return {
      sent: Boolean(user.welcomeEmailSent),
      sentAt: user.welcomeEmailSentAt,
      status: user.welcomeEmailStatus || 'PENDING'
    };
  }

  markEmailVerified(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.emailVerified = true;
      user.updatedAt = new Date().toISOString();
      this.users.set(user.id, user);
    }
  }

  deleteUser(id: string): boolean {
    const deleted = this.users.delete(id);
    this.settings.delete(id);
    this.favorites.delete(id);
    this.userPreferences.delete(id);
    this.persistToDisk();
    return deleted;
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  findUserByEmail(email: string): User | undefined {
    const target = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email === target) return user;
    }
    return undefined;
  }

  findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  updateUserProfile(userId: string, data: { displayName?: string; avatarUrl?: string }): User | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;
    if (typeof data.displayName === 'string' && data.displayName.trim()) {
      user.displayName = data.displayName.trim();
    }
    if (typeof data.avatarUrl === 'string') {
      user.avatarUrl = data.avatarUrl.trim();
    }
    user.updatedAt = new Date().toISOString();
    this.users.set(user.id, user);
    return user;
  }

  updateUserPassword(userId: string, newPasswordHash: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date().toISOString();
    this.users.set(user.id, user);
    return true;
  }

  // Songs
  getSongs(): SongMetadata[] {
    return Array.from(this.songs.values());
  }

  getSongById(id: string): SongMetadata | undefined {
    return this.songs.get(id);
  }

  saveSong(song: SongMetadata): SongMetadata {
    this.songs.set(song.id, song);
    return song;
  }

  deleteSong(id: string): boolean {
    const existed = this.songs.delete(id);
    // Remove from all playlists
    for (const [plId, pl] of this.playlists.entries()) {
      if (pl.songIds.includes(id)) {
        this.playlists.set(plId, {
          ...pl,
          songIds: pl.songIds.filter((sId) => sId !== id),
          updatedAt: new Date().toISOString()
        });
      }
    }
    // Remove from all user favorites
    for (const favSet of this.favorites.values()) {
      favSet.delete(id);
    }
    // Remove from all user song stats
    for (const userStats of this.userSongStats.values()) {
      userStats.delete(id);
    }
    return existed;
  }

  searchSongs(query: string): SongMetadata[] {
    const q = query.toLowerCase();
    return this.getSongs().filter(
      s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album.toLowerCase().includes(q)
    );
  }

  // Playlists
  getUserPlaylists(userId: string): PlaylistData[] {
    return Array.from(this.playlists.values()).filter(p => p.userId === userId);
  }

  getPlaylistById(id: string): PlaylistData | undefined {
    return this.playlists.get(id);
  }

  createPlaylist(
    userId: string,
    name: string,
    artworkUrl?: string,
    description?: string,
    initialSongIds?: string[]
  ): PlaylistData {
    const playlist: PlaylistData = {
      id: crypto.randomUUID(),
      userId,
      name,
      description: description || '',
      artworkUrl,
      isFavorite: false,
      songIds: initialSongIds ? [...initialSongIds] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.playlists.set(playlist.id, playlist);
    return playlist;
  }

  reorderPlaylistSongs(playlistId: string, songIds: string[]): PlaylistData | undefined {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return undefined;
    playlist.songIds = [...songIds];
    playlist.updatedAt = new Date().toISOString();
    return playlist;
  }

  updatePlaylist(id: string, updates: Partial<PlaylistData>): PlaylistData | undefined {
    const playlist = this.playlists.get(id);
    if (!playlist) return undefined;
    const updated = {
      ...playlist,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.playlists.set(id, updated);
    return updated;
  }

  deletePlaylist(id: string): boolean {
    return this.playlists.delete(id);
  }

  addSongToPlaylist(playlistId: string, songId: string): PlaylistData | undefined {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return undefined;
    if (!playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId);
      playlist.updatedAt = new Date().toISOString();
    }
    return playlist;
  }

  removeSongFromPlaylist(playlistId: string, songId: string): PlaylistData | undefined {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return undefined;
    playlist.songIds = playlist.songIds.filter(id => id !== songId);
    playlist.updatedAt = new Date().toISOString();
    return playlist;
  }

  // Schedules
  getUserSchedules(userId: string): MusicScheduleData[] {
    return Array.from(this.schedules.values()).filter(s => s.userId === userId);
  }

  getScheduleById(id: string): MusicScheduleData | undefined {
    return this.schedules.get(id);
  }

  saveSchedule(schedule: MusicScheduleData): MusicScheduleData {
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  deleteSchedule(id: string): boolean {
    return this.schedules.delete(id);
  }

  recordScheduleHistory(record: Omit<ScheduleHistoryRecord, 'id' | 'executedAt'>): ScheduleHistoryRecord {
    const fullRecord: ScheduleHistoryRecord = {
      ...record,
      id: this.historyIdCounter++,
      executedAt: new Date().toISOString()
    };
    this.scheduleHistory.unshift(fullRecord);
    // Bounded in-memory cap to prevent unbounded growth / memory leaks
    if (this.scheduleHistory.length > 500) {
      this.scheduleHistory.length = 500;
    }
    return fullRecord;
  }

  getUserScheduleHistory(userId: string): ScheduleHistoryRecord[] {
    return this.scheduleHistory.filter(h => h.userId === userId);
  }

  // Favorites
  toggleFavorite(userId: string, targetId: string): boolean {
    let set = this.favorites.get(userId);
    if (!set) {
      set = new Set();
      this.favorites.set(userId, set);
    }
    this.bumpUserStateVersion(userId);
    if (set.has(targetId)) {
      set.delete(targetId);
      this.persistToDisk();
      return false;
    } else {
      set.delete(targetId);
      set.add(targetId);
      this.persistToDisk();
      return true;
    }
  }

  addFavorite(userId: string, targetId: string): void {
    let set = this.favorites.get(userId);
    if (!set) {
      set = new Set();
      this.favorites.set(userId, set);
    }
    set.delete(targetId);
    set.add(targetId);
    this.bumpUserStateVersion(userId);
    this.persistToDisk();
  }

  removeFavorite(userId: string, targetId: string): void {
    const set = this.favorites.get(userId);
    if (set && set.has(targetId)) {
      set.delete(targetId);
      this.bumpUserStateVersion(userId);
      this.persistToDisk();
    }
  }

  getUserFavorites(userId: string): string[] {
    const set = this.favorites.get(userId);
    return set ? Array.from(set).reverse() : [];
  }

  isFavorite(userId: string, targetId: string): boolean {
    const set = this.favorites.get(userId);
    return Boolean(set?.has(targetId));
  }

  // Play History
  recordPlayHistory(
    record: Omit<PlayHistoryRecord, 'id' | 'playedAt'> & { playedAt?: string }
  ): PlayHistoryRecord {
    const now = record.playedAt || new Date().toISOString();
    const nowMs = new Date(now).getTime();

    // Deduplication (Requirement 1): If an in-progress play record for the same user and song was logged within 3 seconds,
    // update the duration and completion status instead of creating duplicate records from re-renders or duplicate event listeners
    const recentDuplicate = this.playHistory.find(
      (h) =>
        h.userId === record.userId &&
        h.songId === record.songId &&
        !h.completed &&
        !record.completed &&
        Math.abs(new Date(h.playedAt).getTime() - nowMs) < 3000
    );

    if (recentDuplicate) {
      recentDuplicate.durationListenedMs = Math.max(
        recentDuplicate.durationListenedMs,
        record.durationListenedMs
      );
      if (record.completed) recentDuplicate.completed = true;
      if (record.musicDirector && !recentDuplicate.musicDirector) {
        recentDuplicate.musicDirector = record.musicDirector;
      }
      if (record.language && !recentDuplicate.language) {
        recentDuplicate.language = record.language;
      }
      this.persistToDisk();
      return recentDuplicate;
    }

    const fullRecord: PlayHistoryRecord = {
      ...record,
      id: this.historyIdCounter++,
      playedAt: now
    };
    this.playHistory.unshift(fullRecord);
    // Bounded in-memory cap to prevent unbounded growth / memory leaks
    if (this.playHistory.length > 1000) {
      this.playHistory.length = 1000;
    }
    this.persistToDisk();
    return fullRecord;
  }

  getUserPlayHistory(userId: string, limit = 50): PlayHistoryRecord[] {
    return this.playHistory.filter(h => h.userId === userId).slice(0, limit);
  }

  clearUserPlayHistory(userId: string): void {
    this.playHistory = this.playHistory.filter(h => h.userId !== userId);
  }

  // Settings
  getUserSettings(userId: string): UserSettingsData {
    let s = this.settings.get(userId);
    if (!s) {
      s = {
        userId,
        isDarkMode: true,
        crossfadeEnabled: true,
        crossfadeDurationSec: 3,
        playbackSpeed: 1.0,
        updatedAt: new Date().toISOString()
      };
      this.settings.set(userId, s);
    }
    return s;
  }

  updateUserSettings(userId: string, updates: Partial<UserSettingsData>): UserSettingsData {
    const current = this.getUserSettings(userId);
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.settings.set(userId, updated);
    return updated;
  }

  // User Music Preferences & Recommendations
  getUserPreferences(userId: string): UserMusicPreference {
    let pref = this.userPreferences.get(userId);
    if (!pref) {
      pref = {
        userId,
        preferredLanguages: [],
        favouriteArtists: [],
        favouriteGenres: [],
        favouriteComposers: [],
        favouriteSingers: [],
        favouriteMovies: [],
        preferredMoods: [],
        hasCompletedOnboarding: false,
        personalizationEnabled: true,
        historyEnabled: true,
        updatedAt: new Date().toISOString()
      };
      this.userPreferences.set(userId, pref);
    }
    return pref;
  }

  getUserStateVersion(userId: string): number {
    return this.userStateVersions.get(userId) || 1;
  }

  bumpUserStateVersion(userId: string): number {
    const next = (this.userStateVersions.get(userId) || 1) + 1;
    this.userStateVersions.set(userId, next);
    return next;
  }

  updateUserPreferences(userId: string, updates: Partial<UserMusicPreference>): UserMusicPreference {
    const current = this.getUserPreferences(userId);
    const nextVersion = (current.preferenceVersion || 1) + 1;
    const hasLangs = updates.preferredLanguages !== undefined
      ? updates.preferredLanguages.length > 0
      : current.preferredLanguages.length > 0;
    const updated: UserMusicPreference = {
      ...current,
      ...updates,
      preferredLanguages: updates.preferredLanguages ?? current.preferredLanguages,
      favouriteArtists: updates.favouriteArtists ?? current.favouriteArtists,
      favouriteGenres: updates.favouriteGenres ?? current.favouriteGenres,
      favouriteComposers: updates.favouriteComposers ?? current.favouriteComposers,
      favouriteSingers: updates.favouriteSingers ?? current.favouriteSingers,
      favouriteMovies: updates.favouriteMovies ?? current.favouriteMovies,
      preferredMoods: updates.preferredMoods ?? current.preferredMoods ?? [],
      hasCompletedOnboarding: updates.hasCompletedOnboarding ?? (hasLangs || current.hasCompletedOnboarding || false),
      preferenceVersion: nextVersion,
      updatedAt: new Date().toISOString()
    };
    this.userPreferences.set(userId, updated);
    this.bumpUserStateVersion(userId);
    this.persistToDisk();
    return updated;
  }

  resetUserPreferences(userId: string): UserMusicPreference {
    const resetPref: UserMusicPreference = {
      userId,
      preferredLanguages: [],
      favouriteArtists: [],
      favouriteGenres: [],
      favouriteComposers: [],
      favouriteSingers: [],
      favouriteMovies: [],
      preferredMoods: [],
      preferenceVersion: 1,
      hasCompletedOnboarding: false,
      personalizationEnabled: true,
      historyEnabled: true,
      updatedAt: new Date().toISOString()
    };
    this.userPreferences.set(userId, resetPref);
    // Also clear feedbacks, impressions, listening events, and song stats for this user
    this.feedbacks = this.feedbacks.filter((f) => f.userId !== userId);
    this.impressions = this.impressions.filter((i) => i.userId !== userId);
    this.listeningEvents = this.listeningEvents.filter((e) => e.userId !== userId);
    this.dailyMixes.delete(userId);
    this.userSongStats.delete(userId);
    this.bumpUserStateVersion(userId);
    this.persistToDisk();
    return resetPref;
  }

  // Song Listening Stats (Detailed Behavioral Model)
  recordSongListening(
    userId: string,
    statUpdate: Partial<SongListeningStat> & { songId: string; songName: string }
  ): SongListeningStat {
    let userStats = this.userSongStats.get(userId);
    if (!userStats) {
      userStats = new Map();
      this.userSongStats.set(userId, userStats);
    }

    let existing = userStats.get(statUpdate.songId);
    if (!existing) {
      existing = {
        songId: statUpdate.songId,
        songName: statUpdate.songName,
        movieOrAlbum: statUpdate.movieOrAlbum || '',
        musicDirector: statUpdate.musicDirector || '',
        singers: statUpdate.singers || [],
        language: statUpdate.language || '',
        genre: statUpdate.genre || '',
        playCount: 0,
        replayCount: 0,
        totalListeningDurationMs: 0,
        averageListeningDurationMs: 0,
        completionPercentage: 0,
        completedCount: 0,
        skipCount: 0,
        lastPlayedAt: new Date().toISOString(),
        isFavorite: false
      };
    }

    const totalDuration = existing.totalListeningDurationMs + (statUpdate.totalListeningDurationMs ?? 0);
    const totalPlays = existing.playCount + (statUpdate.playCount ?? 0);
    const completedCount = existing.completedCount + (statUpdate.completedCount ?? 0);
    const avgDuration = totalPlays > 0 ? Math.round(totalDuration / totalPlays) : totalDuration;
    const completionPct = statUpdate.completionPercentage !== undefined
      ? statUpdate.completionPercentage
      : (statUpdate.completedCount ? 100 : (existing.completionPercentage || 0));

    const merged: SongListeningStat = {
      songId: statUpdate.songId,
      songName: statUpdate.songName || existing.songName,
      movieOrAlbum: statUpdate.movieOrAlbum ?? existing.movieOrAlbum,
      musicDirector: statUpdate.musicDirector ?? existing.musicDirector,
      singers: statUpdate.singers && statUpdate.singers.length > 0
        ? Array.from(new Set([...existing.singers, ...statUpdate.singers]))
        : existing.singers,
      language: statUpdate.language ?? existing.language,
      genre: statUpdate.genre ?? existing.genre,
      playCount: totalPlays,
      replayCount: existing.replayCount + (statUpdate.replayCount ?? 0),
      totalListeningDurationMs: totalDuration,
      averageListeningDurationMs: avgDuration,
      completionPercentage: completionPct,
      completedCount,
      skipCount: existing.skipCount + (statUpdate.skipCount ?? 0),
      lastPlayedAt: statUpdate.lastPlayedAt || new Date().toISOString(),
      isFavorite: statUpdate.isFavorite !== undefined ? statUpdate.isFavorite : existing.isFavorite
    };

    userStats.set(statUpdate.songId, merged);
    this.bumpUserStateVersion(userId);
    this.persistToDisk();
    return merged;
  }

  getUserSongStats(userId: string): SongListeningStat[] {
    const userStats = this.userSongStats.get(userId);
    if (!userStats) return [];
    return Array.from(userStats.values()).sort(
      (a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime()
    );
  }

  // Listening Events
  recordListeningEvent(event: Omit<ListeningEventRecord, 'id' | 'timestamp'>): ListeningEventRecord {
    const fullEvent: ListeningEventRecord = {
      ...event,
      id: this.eventIdCounter++,
      timestamp: new Date().toISOString()
    };
    this.listeningEvents.unshift(fullEvent);
    // Bounded in-memory cap to prevent memory leaks
    if (this.listeningEvents.length > 2000) {
      this.listeningEvents.length = 2000;
    }
    this.bumpUserStateVersion(event.userId);
    this.persistToDisk();
    return fullEvent;
  }

  getUserListeningEvents(userId: string, limit = 100): ListeningEventRecord[] {
    return this.listeningEvents.filter((e) => e.userId === userId).slice(0, limit);
  }

  // Recommendation Feedback
  recordFeedback(feedback: Omit<RecommendationFeedbackRecord, 'id' | 'timestamp'>): RecommendationFeedbackRecord {
    // If hiding, remove any previous feedback for targetId and store new
    this.feedbacks = this.feedbacks.filter(
      (f) => !(f.userId === feedback.userId && f.targetId === feedback.targetId)
    );

    const fullRecord: RecommendationFeedbackRecord = {
      ...feedback,
      id: this.feedbackIdCounter++,
      timestamp: new Date().toISOString()
    };
    this.feedbacks.push(fullRecord);
    // Bounded in-memory cap to prevent memory leaks
    if (this.feedbacks.length > 500) {
      this.feedbacks = this.feedbacks.slice(-500);
    }
    this.bumpUserStateVersion(feedback.userId);
    return fullRecord;
  }

  getUserFeedback(userId: string): RecommendationFeedbackRecord[] {
    return this.feedbacks.filter((f) => f.userId === userId);
  }

  removeFeedback(userId: string, targetId: string): boolean {
    const beforeCount = this.feedbacks.length;
    this.feedbacks = this.feedbacks.filter(
      (f) => !(f.userId === userId && f.targetId === targetId)
    );
    const removed = this.feedbacks.length < beforeCount;
    if (removed) {
      this.bumpUserStateVersion(userId);
      this.persistToDisk();
    }
    return removed;
  }

  // Recommendation Impressions (Freshness & Diversity Tracking)
  recordImpression(userId: string, songId: string, sectionName: string): RecommendationImpressionRecord {
    const record: RecommendationImpressionRecord = {
      id: this.impressionIdCounter++,
      userId,
      songId,
      sectionName,
      timestamp: new Date().toISOString()
    };
    this.impressions.push(record);
    if (this.impressions.length > 2000) {
      this.impressions = this.impressions.slice(-2000);
    }
    return record;
  }

  getUserImpressions(userId: string, limit = 200): RecommendationImpressionRecord[] {
    return this.impressions.filter((i) => i.userId === userId).slice(-limit);
  }

  // Configurable Recommendation Engine Weights
  getRecommendationWeights(): RecommendationWeightsConfig {
    return { ...this.recommendationWeights };
  }

  setRecommendationWeights(weights: Partial<RecommendationWeightsConfig>): RecommendationWeightsConfig {
    this.recommendationWeights = {
      ...this.recommendationWeights,
      ...weights
    };
    return { ...this.recommendationWeights };
  }

  // Daily Mixes
  getDailyMixes(userId: string): DailyMixRecord[] {
    return this.dailyMixes.get(userId) || [];
  }

  saveDailyMixes(userId: string, mixes: DailyMixRecord[]): void {
    this.dailyMixes.set(userId, mixes);
  }
}

export const syncStore = new InMemorySyncStore();

