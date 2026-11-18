import { apiClient } from './client';
import {
  Track,
  PersonalizedFeed,
  UserPreferences,
  ArtistItem,
  SongListeningStat,
  ProfileStats
} from './types';

export interface AutoQueueParams {
  songId: string;
  songTitle?: string;
  artist?: string;
  director?: string;
  language?: string;
  genre?: string;
  mood?: string;
  excludeIds?: string[];
  limit?: number;
}

export const recommendationApi = {
  getAutoQueueRecommendations: async (params: AutoQueueParams): Promise<Track[]> => {
    try {
      const res = await apiClient.post<{ success: boolean; tracks: any[] }>('/api/recommendations/auto-queue', params);
      const rawTracks = res?.data?.tracks || [];
      return rawTracks.map((t: any) => ({
        id: t.id,
        title: t.title,
        artist: t.artist || t.composer || 'Unknown Artist',
        movieName: t.movieName || t.album,
        album: t.album || t.movieName,
        composer: t.composer,
        durationMs: t.durationMs || 240000,
        artworkUrl: t.artworkUrl,
        sourcePlatform: (t.sourcePlatform || (t.videoId ? 'YOUTUBE' : 'DOWNLOADED')) as any,
        sourceUrl: t.fullAudioUrl || t.sourceUrl || '',
        fullAudioUrl: t.fullAudioUrl,
        previewUrl: t.previewUrl,
        isFullSong: t.isFullSong ?? Boolean(t.fullAudioUrl),
        language: t.language,
        isPlayableDirectly: true,
      }));
    } catch {
      return [];
    }
  },

  getPersonalizedFeed: async (languageOverride?: string): Promise<PersonalizedFeed> => {
    const params = languageOverride && languageOverride !== 'ALL' ? { language: languageOverride } : {};
    const res = await apiClient.get<{ success: boolean; data: PersonalizedFeed }>('/api/recommendations', { params });
    return res.data.data;
  },

  getBaseFeed: async (languageOverride?: string): Promise<{
    recommended: Track[];
    trending: Track[];
    recentlyAdded: Track[];
    popularSongs: Track[];
    allAvailable: Track[];
    languages?: string[];
    requiresLanguageSelection?: boolean;
  }> => {
    const params = languageOverride && languageOverride !== 'ALL' ? { language: languageOverride } : {};
    const res = await apiClient.get<{ success: boolean; data: any }>('/api/songs/home-base', { params });
    const data = res?.data?.data || {};
    const mapTrack = (t: any): Track => ({
      id: t.id,
      title: t.title,
      artist: t.artist || t.composer || 'Unknown Artist',
      movieName: t.movieName || t.album,
      album: t.album || t.movieName,
      composer: t.composer,
      durationMs: Number(t.durationMs) || 240000,
      artworkUrl: t.artworkUrl,
      sourcePlatform: (t.sourcePlatform || (t.videoId ? 'YOUTUBE' : 'LOCAL')) as any,
      sourceUrl: t.fullAudioUrl || t.sourceUrl || '',
      fullAudioUrl: t.fullAudioUrl,
      previewUrl: t.previewUrl,
      isFullSong: t.isFullSong ?? Boolean(t.fullAudioUrl),
      language: t.language,
      isPlayableDirectly: true
    });

    return {
      recommended: (data.recommended || []).map(mapTrack),
      trending: (data.trending || []).map(mapTrack),
      recentlyAdded: (data.recentlyAdded || []).map(mapTrack),
      popularSongs: (data.popularSongs || []).map(mapTrack),
      allAvailable: (data.allAvailable || []).map(mapTrack),
      languages: data.languages,
      requiresLanguageSelection: data.requiresLanguageSelection
    };
  },

  getSongs: async (options?: { language?: string; limit?: number; offset?: number }): Promise<Track[]> => {
    const params: Record<string, string> = {};
    if (options?.language && options.language !== 'ALL') params.language = options.language;
    if (options?.limit) params.limit = String(options.limit);
    if (options?.offset) params.offset = String(options.offset);

    const res = await apiClient.get<{ success: boolean; data: any[] }>('/api/songs', { params });
    const raw = res?.data?.data || [];
    return raw.map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artist || t.composer || 'Unknown Artist',
      movieName: t.movieName || t.album,
      album: t.album || t.movieName,
      composer: t.composer,
      durationMs: Number(t.durationMs) || 240000,
      artworkUrl: t.artworkUrl,
      sourcePlatform: (t.sourcePlatform || (t.videoId ? 'YOUTUBE' : 'LOCAL')) as any,
      sourceUrl: t.fullAudioUrl || t.sourceUrl || '',
      fullAudioUrl: t.fullAudioUrl,
      previewUrl: t.previewUrl,
      isFullSong: t.isFullSong ?? Boolean(t.fullAudioUrl),
      language: t.language,
      isPlayableDirectly: true
    }));
  },

  getUserPreferences: async (): Promise<UserPreferences> => {
    const res = await apiClient.get<{ success: boolean; preferences: UserPreferences }>('/api/users/me/preferences');
    return res.data.preferences;
  },

  updateUserPreferences: async (updates: Partial<UserPreferences>): Promise<UserPreferences> => {
    const res = await apiClient.put<{ success: boolean; preferences: UserPreferences }>('/api/users/me/preferences', updates);
    return res.data.preferences;
  },

  getArtistsCatalog: async (options?: {
    role?: 'DIRECTOR' | 'SINGER' | 'ALL';
    languages?: string[];
    query?: string;
    page?: number;
    limit?: number;
    includeAll?: boolean;
  }): Promise<ArtistItem[]> => {
    const params: Record<string, string> = {};
    if (options?.role) params.role = options.role;
    if (options?.languages && options.languages.length > 0) params.languages = options.languages.join(',');
    if (options?.query) params.q = options.query;
    if (options?.page) params.page = String(options.page);
    if (options?.limit) params.limit = String(options.limit);
    if (options?.includeAll) params.includeAll = 'true';

    const res = await apiClient.get<{ success: boolean; artists: ArtistItem[] }>('/api/recommendations/artists', { params });
    return res.data.artists;
  },

  recordListeningStat: async (
    stat: Partial<SongListeningStat> & { songId: string; songName: string }
  ): Promise<SongListeningStat> => {
    const res = await apiClient.post<{ success: boolean; stat: SongListeningStat }>('/api/recommendations/listening-stat', stat);
    return res.data.stat;
  },

  sendFeedback: async (
    targetId: string,
    feedbackType: 'LIKE' | 'DISLIKE' | 'HIDE' | 'NOT_INTERESTED',
    targetType: 'SONG' | 'SOUNDTRACK' | 'ARTIST' | 'COMPOSER' = 'SONG'
  ): Promise<void> => {
    await apiClient.post('/api/recommendations/feedback', {
      targetId,
      targetType,
      feedbackType
    });
  },

  getDiscoverFeed: async (languageOverride?: string): Promise<any> => {
    const params = languageOverride && languageOverride !== 'ALL' ? { language: languageOverride } : {};
    const res = await apiClient.get<{ success: boolean; data: any }>('/api/recommendations/discover', { params });
    return res.data.data;
  },

  getProfileStats: async (): Promise<ProfileStats> => {
    const res = await apiClient.get<{ success: boolean; stats: ProfileStats }>('/api/recommendations/profile-stats');
    return res.data.stats;
  },

  getSongById: async (songId: string): Promise<Track | null> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Track }>(
        `/api/songs/${encodeURIComponent(songId)}`
      );
      return res.data.data;
    } catch (err) {
      console.warn(`[recommendationApi] getSongById failed for ${songId}:`, err);
      return null;
    }
  },

  recordSupabaseHistory: async (payload: {
    songId: string;
    songTitle: string;
    artistName: string;
    musicDirector?: string;
    language?: string;
    durationListenedMs?: number;
    completed?: boolean;
    isReplay?: boolean;
  }): Promise<void> => {
    await Promise.allSettled([
      apiClient.post('/api/history', {
        songId: payload.songId,
        songTitle: payload.songTitle,
        artistName: payload.artistName,
        musicDirector: payload.musicDirector,
        language: payload.language,
        durationListenedMs: payload.durationListenedMs ?? 0,
        completed: payload.completed ?? false,
        clientPlatform: 'MOBILE'
      }),
      apiClient.post('/api/listening-events', {
        songId: payload.songId,
        songTitle: payload.songTitle,
        artistName: payload.artistName,
        musicDirector: payload.musicDirector,
        language: payload.language,
        eventType: payload.isReplay ? 'REPLAY' : 'PLAY',
        clientPlatform: 'MOBILE'
      })
    ]);
  }
};
