import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { usePlayerStore } from '../store/usePlayerStore';
import {
  normalizeMobileLanguage,
  isTrackLanguageEligible,
  filterTracksByLanguage
} from '../utils/languageEligibility';
import {
  getArtistInitials,
  getArtistAvatarColor
} from '../components/common/ArtistAvatar';
import { recommendationApi } from '../api/recommendationApi';

// Mock dependencies
let mockStorage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockStorage[key] || null),
    setItem: vi.fn(async (key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete mockStorage[key];
    }),
    clear: vi.fn(async () => {
      mockStorage = {};
    })
  }
}));

vi.mock('../api/recommendationApi', () => ({
  recommendationApi: {
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn().mockResolvedValue({ success: true }),
    getPersonalizedFeed: vi.fn(),
    getBaseFeed: vi.fn(),
    getArtistsCatalog: vi.fn().mockResolvedValue([]),
    getAutoQueueRecommendations: vi.fn().mockResolvedValue([]),
    sendFeedback: vi.fn().mockResolvedValue({ success: true })
  }
}));

describe('Recommendation Language Filtering & Artist Avatars', () => {
  const sampleTracks = [
    { id: 'track_tamil_1', title: 'Nenjukkul Peidhidum', language: 'Tamil', artist: 'Harris Jayaraj' },
    { id: 'track_tamil_2', title: 'Chinna Chinna Aasai', language: 'Tamil', artist: 'A. R. Rahman' },
    { id: 'track_telugu_1', title: 'ButtaBomma', language: 'Telugu', artist: 'Thaman S' },
    { id: 'track_hindi_1', title: 'Tum Hi Ho', language: 'Hindi', artist: 'Arijit Singh' },
    { id: 'track_malayalam_1', title: 'Malare', language: 'Malayalam', artist: 'Vijay Yesudas' },
    { id: 'track_english_1', title: 'Blinding Lights', language: 'English', artist: 'The Weeknd' }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorage = {};
    useRecommendationStore.setState({
      selectedLanguages: [],
      selectedDirectors: [],
      selectedSingers: [],
      feed: null,
      baseSections: null,
      hasCompletedOnboarding: false
    });
  });

  describe('1. Strict Language Eligibility and Filtering', () => {
    it('normalizes languages into canonical casing', () => {
      expect(normalizeMobileLanguage('tamil')).toBe('Tamil');
      expect(normalizeMobileLanguage('TAMIL')).toBe('Tamil');
      expect(normalizeMobileLanguage('ta')).toBe('Tamil');
      expect(normalizeMobileLanguage('telugu')).toBe('Telugu');
      expect(normalizeMobileLanguage('hi')).toBe('Hindi');
      expect(normalizeMobileLanguage('')).toBe('');
      expect(normalizeMobileLanguage(null as any)).toBe('');
    });

    it('isTrackLanguageEligible strictly enforces user languages', () => {
      const tamilTrack = { id: 't1', language: 'Tamil' };
      const hindiTrack = { id: 't2', language: 'Hindi' };

      // User with Tamil only
      expect(isTrackLanguageEligible(tamilTrack, ['Tamil'])).toBe(true);
      expect(isTrackLanguageEligible(hindiTrack, ['Tamil'])).toBe(false);

      // User with Tamil and Hindi
      expect(isTrackLanguageEligible(tamilTrack, ['Tamil', 'Hindi'])).toBe(true);
      expect(isTrackLanguageEligible(hindiTrack, ['Tamil', 'Hindi'])).toBe(true);

      // Empty user languages -> zero cross-language leakage
      expect(isTrackLanguageEligible(tamilTrack, [])).toBe(false);
      expect(isTrackLanguageEligible(null, ['Tamil'])).toBe(false);
    });

    it('filterTracksByLanguage filters to user selected languages when filter is ALL', () => {
      // User with only Tamil selected
      const userLangs = ['Tamil'];
      const filtered = filterTracksByLanguage(sampleTracks, userLangs, 'ALL');

      expect(filtered.length).toBe(2);
      expect(filtered.every((t) => t.language === 'Tamil')).toBe(true);
      expect(filtered.some((t) => t.language === 'Hindi')).toBe(false);
      expect(filtered.some((t) => t.language === 'Telugu')).toBe(false);
      expect(filtered.some((t) => t.language === 'English')).toBe(false);
    });

    it('filterTracksByLanguage filters to multiple selected languages (e.g. Tamil + Telugu)', () => {
      const userLangs = ['Tamil', 'Telugu'];
      const filtered = filterTracksByLanguage(sampleTracks, userLangs, 'ALL');

      expect(filtered.length).toBe(3);
      expect(filtered.some((t) => t.language === 'Tamil')).toBe(true);
      expect(filtered.some((t) => t.language === 'Telugu')).toBe(true);
      expect(filtered.some((t) => t.language === 'Hindi')).toBe(false);
      expect(filtered.some((t) => t.language === 'Malayalam')).toBe(false);
    });

    it('filterTracksByLanguage respects specific language chip filter', () => {
      const userLangs = ['Tamil', 'Telugu'];
      const filteredTelugu = filterTracksByLanguage(sampleTracks, userLangs, 'Telugu');

      expect(filteredTelugu.length).toBe(1);
      expect(filteredTelugu[0].title).toBe('ButtaBomma');
    });
  });

  describe('2. Preference Persistence & Guest Mode Support', () => {
    it('persists selected languages into AsyncStorage and reloads them on cold start', async () => {
      (recommendationApi.getPersonalizedFeed as any).mockResolvedValue({
        madeForYou: [],
        trendingInLanguages: []
      });
      (recommendationApi.getBaseFeed as any).mockResolvedValue({
        recommended: [],
        allAvailable: []
      });

      // User sets languages (even as guest without auth token)
      useRecommendationStore.getState().setSelectedLanguages(['Tamil', 'Malayalam']);

      expect(useRecommendationStore.getState().selectedLanguages).toEqual(['Tamil', 'Malayalam']);
      expect(mockStorage['@syncwave_user_preferences_v1']).toContain('Tamil');

      // Simulate app restart / re-initialization
      await useRecommendationStore.getState().initialize();

      // Preferences MUST persist, NOT get reset to empty!
      expect(useRecommendationStore.getState().selectedLanguages).toEqual(['Tamil', 'Malayalam']);
    });

    it('toggleLanguage immediately persists and triggers recommendation refresh', async () => {
      (recommendationApi.getPersonalizedFeed as any).mockResolvedValue({ madeForYou: [] });
      (recommendationApi.getBaseFeed as any).mockResolvedValue({ recommended: [] });

      useRecommendationStore.getState().setSelectedLanguages(['Tamil']);
      useRecommendationStore.getState().toggleLanguage('Telugu');

      expect(useRecommendationStore.getState().selectedLanguages).toEqual(['Tamil', 'Telugu']);
      expect(recommendationApi.getPersonalizedFeed).toHaveBeenCalled();
      expect(recommendationApi.getBaseFeed).toHaveBeenCalled();
    });

    it('pruneQueueByLanguage removes tracks from unselected languages from the queue', () => {
      useRecommendationStore.setState({ selectedLanguages: ['Tamil'] });

      usePlayerStore.setState({
        queue: [
          { id: '1', title: 'Tamil Track 1', language: 'Tamil' } as any,
          { id: '2', title: 'Hindi Track 1', language: 'Hindi' } as any,
          { id: '3', title: 'Tamil Track 2', language: 'Tamil' } as any,
          { id: '4', title: 'English Track 1', language: 'English' } as any
        ],
        queueIndex: 0
      });

      usePlayerStore.getState().pruneQueueByLanguage();

      const newQueue = usePlayerStore.getState().queue;
      expect(newQueue.length).toBe(2);
      expect(newQueue.every((t) => t.language === 'Tamil')).toBe(true);
      expect(newQueue.some((t) => t.language === 'Hindi')).toBe(false);
    });
  });

  describe('3. Artist Image Fallback and Initials Generation', () => {
    it('getArtistInitials accurately generates initials from various artist name formats', () => {
      expect(getArtistInitials('A. R. Rahman')).toBe('ARR');
      expect(getArtistInitials('Anirudh Ravichander')).toBe('AR');
      expect(getArtistInitials('Ilaiyaraaja')).toBe('IL');
      expect(getArtistInitials('S. P. Balasubrahmanyam')).toBe('SPB');
      expect(getArtistInitials('Sid Sriram')).toBe('SS');
      expect(getArtistInitials('Shreya Ghoshal')).toBe('SG');
      expect(getArtistInitials('dir_harris_jayaraj')).toBe('HJ');
      expect(getArtistInitials('')).toBe('?');
    });

    it('getArtistAvatarColor generates consistent deterministic colors for the same artist', () => {
      const color1 = getArtistAvatarColor('A. R. Rahman');
      const color2 = getArtistAvatarColor('A. R. Rahman');
      expect(color1).toBe(color2);

      const color3 = getArtistAvatarColor('Anirudh Ravichander');
      expect(typeof color3).toBe('string');
      expect(color3.startsWith('#')).toBe(true);
    });
  });
});
