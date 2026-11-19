import {
  syncStore,
  UserMusicPreference,
  ListeningEventRecord,
  RecommendationFeedbackRecord,
  DailyMixRecord,
  SongListeningStat,
  RecommendationWeightsConfig,
  SongMetadata
} from '../../db/store';
import {
  KNOWN_INDIAN_MOVIES,
  IndianCinemaHelper,
  MusicLanguage,
  COMPOSER_ALIASES,
  KNOWN_TRACK_VIDEO_MAP
} from '../search/indianCinema.helper';
import { SupabaseHistoryService } from '../history/supabaseHistory.service';
import { UnifiedTrack, MovieSoundtrack } from '../search/searchAggregator.service';
import { ARTISTS_CATALOG, queryArtistsCatalog, ArtistItem } from './artistCatalog.data';
import { CanonicalArtistService, CanonicalArtist, PaginatedArtistsResponse } from './canonicalArtist.service';
import {
  normalizeLanguageToken,
  normalizeLanguageList,
  isSongLanguageEligible,
  filterSongsByLanguage,
  validateSongLanguageMetadata
} from '../../utils/languageEligibility';

function normalizeArtistToken(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function artistMatches(candidate: string | undefined, target: string): boolean {
  const c = normalizeArtistToken(candidate);
  const t = normalizeArtistToken(target);
  if (!c || !t) return false;
  return c === t || c.includes(t) || t.includes(c);
}

function deterministicSeedHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

interface MoodDefinitionSpec {
  id: string;
  mood: string;
  title: string;
  description: string;
  artworkUrl: string;
  accentColor: string;
  keywords: RegExp;
  preferredTitles: string[];
}

const ALL_12_MOOD_SPECS: MoodDefinitionSpec[] = [
  {
    id: 'happy',
    mood: 'Happy',
    title: 'Happy Vibes',
    description: 'Bright, feel-good melodies and sunny rhythms to lift your spirits',
    artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    accentColor: '#F59E0B',
    keywords: /chinna|buttabomma|ramuloo|saami|levitating|gallan|dholna|singara|oh shanthi/i,
    preferredTitles: ['Chinna Chinna Aasai', 'ButtaBomma', 'Oh Shanthi', 'Levitating', 'Singara Siriye', 'Saami Saami', 'Gallan Teriyan', 'Shape of You']
  },
  {
    id: 'sad',
    mood: 'Sad',
    title: 'Heartbreak & Tears',
    description: 'Deeply emotional ballads for quiet introspection and healing',
    artworkUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=80',
    accentColor: '#6366F1',
    keywords: /ava enna|sunn raha|chahun|hum mar|kaun hoyega|fakira|awaaz|komuram|janani/i,
    preferredTitles: ['Ava Enna Enna Thedi Vandha Anjala', 'Sunn Raha Hai', 'Chahun Main Ya Naa', 'Hum Mar Jayenge', 'Kaun Hoyega', 'Fakira', 'Komuram Bheemudo', 'Awaaz']
  },
  {
    id: 'romantic',
    mood: 'Romantic',
    title: 'Romantic Serenade',
    description: 'Dreamy cinema duets and sweeping string arrangements for timeless romance',
    artworkUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=600&q=80',
    accentColor: '#EC4899',
    keywords: /nenjukkul|mundhinam|hosanna|mannipaaya|malare|samajavaragamana|srivalli|chaleya|satrangi/i,
    preferredTitles: ['Nenjukkul Peidhidum', 'Mundhinam Paarthenae', 'Hosanna', 'Malare', 'Samajavaragamana', 'Chaleya', 'Srivalli', 'Pudhu Vellai Mazhai']
  },
  {
    id: 'love',
    mood: 'Love',
    title: 'Pure Love Anthems',
    description: 'Soul-stirring confessions, acoustic warmth and timeless love songs',
    artworkUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80',
    accentColor: '#F43F5E',
    keywords: /tum hi ho|kaadhal|en kannu|anbenum|uyiril thodum|omana|yad lagla|sairat|jiya jale/i,
    preferredTitles: ['Tum Hi Ho', 'Kaadhal Rojave', 'En Kannu Kulla', 'Anbenum', 'Uyiril Thodum', 'Omana Penne', 'Yad Lagla', 'Mannipaaya']
  },
  {
    id: 'motivation',
    mood: 'Motivation',
    title: 'Unstoppable Drive',
    description: 'Anthems of resilience, courage and triumph to power big goals',
    artworkUrl: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=600&q=80',
    accentColor: '#10B981',
    keywords: /dosti|etthara|rebel|karma|zinda|viva|dil se|thamizha|villain/i,
    preferredTitles: ['Dosti', 'Etthara Jenda', 'Viva La Vida', 'Zinda Banda', 'Rebel Song', 'Karma Song', 'Dil Se Re', 'Thamizha Thamizha']
  },
  {
    id: 'energetic',
    mood: 'Energetic',
    title: 'High Voltage Energy',
    description: 'Adrenaline-charged beats, punchy basslines and explosive drops',
    artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
    accentColor: '#EF4444',
    keywords: /badass|naa ready|naatu|eyy bidda|daakko|yethi|adiye|blinding|bloody sweet/i,
    preferredTitles: ['Badass', 'Naa Ready', 'Naatu Naatu', 'Eyy Bidda Idhi Naa Adda', 'Daakko Daakko Meka', 'Adiye Kolluthey', 'Yethi Yethi', 'Blinding Lights']
  },
  {
    id: 'relaxing',
    mood: 'Relaxing',
    title: 'Calm & Unwind',
    description: 'Gentle acoustics, soft ambient textures and unhurried grooves',
    artworkUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    accentColor: '#06B6D4',
    keywords: /cherathukal|aluva|annul|silent cat|pudhu vellai|pathivayi|ezhutha|anbil/i,
    preferredTitles: ['Cherathukal', 'Aluva Puzha', 'Annul Maelae', 'Silent Cat', 'Pudhu Vellai Mazhai', 'Pathivayi Njan', 'Anbil Avan', 'Ezhutha Katha']
  },
  {
    id: 'party',
    mood: 'Party',
    title: 'Friday Night Party',
    description: 'Floor-filling kuthu, bhangra & global dancefloor anthems',
    artworkUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
    accentColor: '#A855F7',
    keywords: /zingaat|oo antava|not ramaiya|omg daddy|chaiyya|kalippu|scene contra|jawan/i,
    preferredTitles: ['Zingaat', 'Oo Antava Oo Oo Antava', 'Ramuloo Ramulaa', 'Chaiyya Chaiyya', 'Not Ramaiya Vastavaiya', 'OMG Daddy', 'Levitating', 'Kalippu']
  },
  {
    id: 'melancholic',
    mood: 'Melancholic',
    title: 'Midnight Melancholy',
    description: 'Poetic nostalgia, bittersweet vocals and rainy evening echoes',
    artworkUrl: 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?auto=format&fit=crop&w=600&q=80',
    accentColor: '#64748B',
    keywords: /aaromale|ae ajnabi|milne hai|i'm scared|kaalam kettu|aatach|kannukkul/i,
    preferredTitles: ['Aaromale', 'Ae Ajnabi', 'Milne Hai Mujhse Aayi', "I'm Scared", 'Kaalam Kettu Poyi', 'Aatach Baya Ka Baavarla', 'Kannukkul Kannai', 'Kaadhal Rojave']
  },
  {
    id: 'devotional',
    mood: 'Devotional',
    title: 'Sacred & Devotional',
    description: 'Reverent chants, classical ragas and spiritual serenity',
    artworkUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
    accentColor: '#F97316',
    keywords: /varaha|raamam|singara|janani|aararaari|sairat zaala/i,
    preferredTitles: ['Varaha Roopam', 'Raamam Raaghavam', 'Singara Siriye', 'Janani', 'Aararaari Raaro', 'Sairat Zaala Ji', 'Thamizha Thamizha']
  },
  {
    id: 'focus',
    mood: 'Focus',
    title: 'Deep Focus & Flow',
    description: 'Steady atmospheric scores and minimal distraction grooves for deep work',
    artworkUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80',
    accentColor: '#3B82F6',
    keywords: /silent cat|appuchi|ezhutha|aluva|annul|cherathukal|anbil|satrangi/i,
    preferredTitles: ['Silent Cat', 'Appuchi Graamam Theme', 'Ezhutha Katha', 'Aluva Puzha', 'Annul Maelae', 'Anbil Avan', 'Satrangi Re', 'Cherathukal']
  },
  {
    id: 'travel',
    mood: 'Travel',
    title: 'Highway & Road Trip',
    description: 'Open-window singalongs and breezy grooves for long drives',
    artworkUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80',
    accentColor: '#14B8A6',
    keywords: /as it was|chaiyya|hosanna|mundhinam|samajavaragamana|blinding|shape of you|sittharala/i,
    preferredTitles: ['As It Was', 'Chaiyya Chaiyya', 'Hosanna', 'Mundhinam Paarthenae', 'Samajavaragamana', 'Sittharala Sirapadu', 'Blinding Lights', 'Shape of You']
  }
];

function eq(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
  category: 'ARTIST';
  role: 'DIRECTOR' | 'SINGER' | 'ALL';
  roleTitle: string;
  languages: string[];
  imageUrl: string;
  isFavourite?: boolean;
  isDiscovery?: boolean;
  reason?: string;
  knownFor: string[];
  tracks: UnifiedTrack[];
  albums: ArtistAlbumGroup[];
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

export interface DailyMixItem {
  id: string;
  title: string;
  subtitle: string;
  language: string;
  coverUrl: string;
  trackCount: number;
  tracks: UnifiedTrack[];
}

export { RecommendationWeightsConfig } from '../../db/store';

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeightsConfig = {
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

interface FeedCacheEntry {
  feed: PersonalizedFeedResponse;
  timestamp: number;
  preferenceVersion: number;
}

const userFeedCache = new Map<string, FeedCacheEntry>();
const FEED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface PersonalizedFeedResponse {
  greeting: string;
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  contextTitle: string;
  contextDescription: string;
  preferredLanguages: string[];
  requiresLanguageSelection?: boolean;
  generatedAt?: string;

  // 10 Explicit Dynamic Home Sections:
  madeForYou: UnifiedTrack[];
  basedOnListeningHistory: {
    basedOn: string;
    tracks: UnifiedTrack[];
  };
  becauseYouLikeThisArtist: {
    artist: string;
    tracks: UnifiedTrack[];
  };
  similarToFavouriteSongs: UnifiedTrack[];
  recentlyAdded: UnifiedTrack[];
  trendingInLanguages: UnifiedTrack[];
  discoverNewArtists: ArtistRecommendationCard[];
  yourFavouriteMusicDirectors: Array<{
    director: string;
    tracks: UnifiedTrack[];
  }>;
  recommendedMoods: MoodPlaylistCard[];
  continueListening: UnifiedTrack[];

  // Dynamic / extended sections:
  dailyMixes: DailyMixItem[];
  becauseYouListenedTo: {
    basedOn: string;
    tracks: UnifiedTrack[];
  };
  basedOnFavouriteArtists: UnifiedTrack[];
  basedOnFavouriteDirectors: UnifiedTrack[];
  recentlyPlayed: UnifiedTrack[];
  favouriteSongs: UnifiedTrack[];
  newReleases: UnifiedTrack[];
  discoverSomethingNew: UnifiedTrack[];
  yourMoodMix: MoodPlaylistCard[];
  mostPlayedArtists: ArtistRecommendationCard[];
  songsYouMayLike: UnifiedTrack[];

  // Backward-compatible fields & aliases:
  recommendedForYou: UnifiedTrack[];
  moreFromFavouriteArtists: UnifiedTrack[];
  sameMusicDirector: {
    director: string;
    tracks: UnifiedTrack[];
  };
  similarSongs: UnifiedTrack[];
  discoverNewMusic: UnifiedTrack[];
  moodPlaylists: MoodPlaylistCard[];
  popularSongs: UnifiedTrack[];
  favouriteMusicDirectors: Array<{
    director: string;
    tracks: UnifiedTrack[];
  }>;
  favouriteSingers: Array<{
    singer: string;
    tracks: UnifiedTrack[];
  }>;
  favouriteArtists: ArtistRecommendationCard[];
  recommendedSingers: ArtistRecommendationCard[];
  recommendedMusicDirectors: ArtistRecommendationCard[];
  movieSoundtracks: MovieSoundtrack[];
  languageSections: Array<{
    language: string;
    recommended: UnifiedTrack[];
    trending: UnifiedTrack[];
    soundtracks: MovieSoundtrack[];
  }>;
  favouriteArtistPicks: Array<{
    artist: string;
    role?: 'DIRECTOR' | 'SINGER' | 'ALL';
    roleTitle?: string;
    imageUrl?: string;
    tracks: UnifiedTrack[];
  }>;
  timeBasedPicks: {
    contextName: string;
    description: string;
    tracks: UnifiedTrack[];
  };
  discoverNew: UnifiedTrack[];
}

export interface DiscoverFeedResponse {
  preferredLanguages: string[];
  selectedLanguages?: string[];
  recommendedArtists: ArtistRecommendationCard[];
  similarArtists: ArtistRecommendationCard[];
  popularSongs: UnifiedTrack[];
  trendingMusic: UnifiedTrack[];
  newReleases: UnifiedTrack[];
  moodCategories: MoodPlaylistCard[];
  genreCategories: Array<{
    id: string;
    name: string;
    trackCount: number;
    tracks: UnifiedTrack[];
  }>;
  musicDirectorCollections: Array<{
    director: string;
    tracks: UnifiedTrack[];
  }>;
}

export interface SmartPlaylistRequest {
  language?: string;
  genreOrMood?: string; // e.g. 'Melody', 'Workout', 'Relaxing', 'Devotional', 'Party', 'Classical'
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

export interface ProfileStatsResponse {
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
  topListenedDirectors: Array<{
    name: string;
    roleTitle: string;
    imageUrl?: string;
    playCount: number;
    replayCount?: number;
    totalDurationMs?: number;
    uniqueSongsCount: number;
  }>;
  mostRewatchedSongs: ProfileSongRewatchStat[];
  mostPlayedSongs: ProfileSongRewatchStat[];
  languageBreakdown: Array<{
    language: string;
    count: number;
    songsCount: number;
    durationMs: number;
    percentage: number;
  }>;
  dailyActivity: Array<{
    date: string;
    day: string;
    dayName: string;
    plays: number;
    durationMinutes: number;
    minutes: number;
  }>;
  weeklyActivity: Array<{
    week: string;
    plays?: number;
    durationMinutes?: number;
    minutes: number;
  }>;
  recentlyPlayed: UnifiedTrack[];
  totalListeningHours: number;
  formattedListeningTime: string;
  summary: {
    totalPlays: number;
    totalRewatches: number;
    totalListeningMinutes: number;
    totalListeningHours: number;
    formattedListeningTime: string;
    uniqueSongsPlayed: number;
    uniqueArtistsListened: number;
    preferredLanguages: string[];
    historySource: 'SUPABASE' | 'TEST_MEMORY' | 'UNCONFIGURED' | 'LOCAL_STORE';
  };
}

function inferTrackMood(title: string): string {
  for (const spec of ALL_12_MOOD_SPECS) {
    if (spec.preferredTitles.some((pt) => eq(pt, title)) || spec.keywords.test(title)) {
      return spec.mood;
    }
  }
  return 'Romantic';
}

function inferTrackGenre(title: string, mood: string): string {
  const t = title.toLowerCase();
  if (/naatu|badass|naa ready|zingaat|oo antava|party|daakko|yethi/i.test(t)) return 'EDM';
  if (/varaha|raamam|janani|thamizha|devotional|aararaari/i.test(t)) return 'Devotional';
  if (/nenjukkul|mundhinam|hosanna|malare|samajavaragamana|srivalli|tum hi ho|cherathukal|anbenum/i.test(t)) return 'Melody';
  if (/gallan|bhangra|dholna|qismat|fakira/i.test(t)) return 'Folk';
  if (/levitating|shape of you|blinding lights/i.test(t)) return 'Pop';
  if (mood === 'Energetic' || mood === 'Party') return 'Pop';
  if (mood === 'Devotional') return 'Devotional';
  if (mood === 'Relaxing' || mood === 'Romantic' || mood === 'Love') return 'Melody';
  return 'Soundtrack';
}

export class RecommendationEngineService {
  /**
   * Builds the comprehensive master catalog of candidate tracks from known soundtracks and seed database
   */
  public static getMasterCatalog(): UnifiedTrack[] {
    const catalog: UnifiedTrack[] = [];

    // 1. Ingest all tracks from known movies
    for (const movie of KNOWN_INDIAN_MOVIES) {
      movie.trackTitles.forEach((title, idx) => {
        const id = `track_${movie.movieName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${idx + 1}`;
        const singers = movie.leadSingers;
        const singerStr = singers.join(', ');
        const versionType = IndianCinemaHelper.classifyVersion(title, singerStr);

        // Original online soundtrack and video artwork
        const artworkMap: Record<string, string> = {
          'Vaaranam Aayiram': 'https://i.ytimg.com/vi/FzLpP8VBC6E/hqdefault.jpg',
          'Leo': 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg',
          'Roja': 'https://i.ytimg.com/vi/nPhnTTQkTG0/hqdefault.jpg',
          'Ala Vaikunthapurramuloo': 'https://i.ytimg.com/vi/OCg6BWlAXSw/hqdefault.jpg',
          'RRR': 'https://i.ytimg.com/vi/79IEesucPo8/hqdefault.jpg',
          'Jawan': 'https://i.ytimg.com/vi/VAdGW7QDJiU/hqdefault.jpg',
          'Dil Se..': 'https://i.ytimg.com/vi/K-pX4qwtAxA/hqdefault.jpg',
          'Kantara': 'https://i.ytimg.com/vi/m-5ck3BuT1o/hqdefault.jpg',
          'Premam': 'https://i.ytimg.com/vi/0G2VxhV_gXM/hqdefault.jpg',
          'Vinnaithaandi Varuvaayaa': 'https://i.ytimg.com/vi/YFYiTS46x-8/hqdefault.jpg',
          'Pushpa: The Rise': 'https://i.ytimg.com/vi/hcMzwMrr1tE/hqdefault.jpg',
          'Aashiqui 2': 'https://i.ytimg.com/vi/IJq0yyWug1k/hqdefault.jpg',
          'Kumbalangi Nights': 'https://i.ytimg.com/vi/kAP72G5R4H8/hqdefault.jpg',
          'Sairat': 'https://i.ytimg.com/vi/5AeX7Ddq4ts/hqdefault.jpg',
          'Qismat': 'https://i.ytimg.com/vi/wXhTHyIgQ_U/hqdefault.jpg',
          'Global Billboard Hits': 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
          'Appuchi Graamam': 'https://i.ytimg.com/vi/qC-X5MogTI0/hqdefault.jpg'
        };

        const videoId = KNOWN_TRACK_VIDEO_MAP[title] || '';
        // Prioritize track's original online music video picture
        const artworkUrl = videoId
          ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          : artworkMap[movie.movieName] || 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg';
        const sourceUrl = videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' ' + movie.movieName)}`;
        const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : undefined;

        const mood = inferTrackMood(title);
        const genre = inferTrackGenre(title, mood);

        catalog.push({
          id,
          title,
          artist: movie.composer,
          movieName: movie.movieName,
          album: movie.movieName,
          composer: movie.composer,
          singers,
          durationMs: 250000 + (idx * 15000) % 70000,
          artworkUrl,
          sourcePlatform: 'YOUTUBE',
          sourceUrl,
          embedUrl,
          videoId: videoId || undefined,
          previewUrl: undefined,
          versionType,
          isPlayableDirectly: true,
          releaseYear: movie.year,
          language: movie.language,
          mood,
          genre
        });
      });
    }

    // 2. Ingest in-memory seeded songs (skipping tracks already in catalog)
    const existingIds = new Set<string>(catalog.map((t) => t.id));
    for (const song of syncStore.getSongs()) {
      if (existingIds.has(song.id)) continue;
      existingIds.add(song.id);
      const songLang = song.language || song.languages?.[0] || (song.id.startsWith('sync_seed') ? 'English' : undefined);
      catalog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        durationMs: song.durationMs,
        artworkUrl: song.artworkUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
        sourcePlatform: (song.source === 'LOCAL' || song.source === 'DOWNLOADED') ? 'SPOTIFY' : song.source,
        sourceUrl: song.externalUrl || 'https://open.spotify.com',
        versionType: 'ORIGINAL',
        isPlayableDirectly: false,
        language: songLang ? (normalizeLanguageToken(songLang) as any) : undefined
      });
    }

    return catalog;
  }

  /**
   * Find any canonical track across soundtracks, catalog, and storage by ID, videoId, or slug
   */
  public static findTrackById(id: string): UnifiedTrack | undefined {
    if (!id || typeof id !== 'string') return undefined;
    const cleanId = id.trim().toLowerCase();
    const catalog = this.getMasterCatalog();
    return catalog.find(
      (t) =>
        t.id.toLowerCase() === cleanId ||
        (t.videoId && t.videoId.toLowerCase() === cleanId) ||
        t.title.toLowerCase().replace(/[^a-z0-9]/g, '_') === cleanId
    );
  }

  /**
   * Current time of day classification
   */
  static getTimeOfDay(hour = new Date().getHours()): 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' {
    if (hour >= 5 && hour < 12) return 'MORNING';
    if (hour >= 12 && hour < 17) return 'AFTERNOON';
    if (hour >= 17 && hour < 22) return 'EVENING';
    return 'NIGHT';
  }

  /**
   * Generates a fully personalized music feed for the specified user
   */
  static async getPersonalizedFeed(
    userId: string,
    context?: { timeOfDay?: string; languageOverride?: string; languages?: string[]; refreshSeed?: string }
  ): Promise<PersonalizedFeedResponse> {
    const preferences: UserMusicPreference = syncStore.getUserPreferences(userId);
    const listeningEvents = preferences.historyEnabled
      ? await SupabaseHistoryService.getUserListeningEvents(userId, 100)
      : [];
    const feedbacks = preferences.personalizationEnabled ? syncStore.getUserFeedback(userId) : [];
    const userPlaylists = syncStore.getUserPlaylists(userId);
    const playlistSongIds = new Set<string>(userPlaylists.flatMap((p) => p.songIds));
    const seed = context?.refreshSeed || '';
    const isGuest = userId === 'guest_default_user';

    // Collect signals from user feedback: HIDE, DISLIKE, NOT_INTERESTED, LIKE, MORE_LIKE_THIS, LESS_LIKE_THIS
    const hiddenSet = new Set<string>();
    const hiddenArtists = new Set<string>();
    const likedSet = new Set<string>();
    const moreLikeThisSet = new Set<string>();
    const lessLikeThisSet = new Set<string>();

    feedbacks.forEach((f) => {
      const tid = (f.targetId || '').toLowerCase().trim();
      if (f.feedbackType === 'HIDE' || f.feedbackType === 'DISLIKE' || f.feedbackType === 'NOT_INTERESTED') {
        hiddenSet.add(f.targetId);
        if (f.targetType === 'ARTIST' || f.targetType === 'COMPOSER') {
          hiddenArtists.add(normalizeArtistToken(f.targetId));
        }
      } else if (f.feedbackType === 'LIKE') {
        likedSet.add(f.targetId);
      } else if (f.feedbackType === 'MORE_LIKE_THIS') {
        moreLikeThisSet.add(tid);
      } else if (f.feedbackType === 'LESS_LIKE_THIS') {
        lessLikeThisSet.add(tid);
      }
    });

    // Time of day calculation
    const validTimes: Array<'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT'> = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
    const timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' =
      validTimes.includes(context?.timeOfDay as any) ? (context?.timeOfDay as any) : this.getTimeOfDay();

    const timeInfo = {
      MORNING: {
        greeting: 'Good morning',
        title: 'Morning Energizers & Devotional Classics',
        desc: 'Start your day refreshed with uplifting melodies and positive vibrations'
      },
      AFTERNOON: {
        greeting: 'Good afternoon',
        title: 'Afternoon Focus & Relaxing Acoustic',
        desc: 'Gentle acoustic chords, lofi textures and peaceful background rhythms'
      },
      EVENING: {
        greeting: 'Good evening',
        title: 'Evening Hits & Prime Melodies',
        desc: 'Unwind with your favourite evergreen cinema tracks and golden melodies'
      },
      NIGHT: {
        greeting: 'Good night',
        title: 'Late Night Calm & Ambient Sleep',
        desc: 'Soothing instrumental scores and deep relaxing frequencies for restful sleep'
      }
    }[timeOfDay];

    // Languages: prioritize explicit languages parameter, languageOverride, or user's stored preferences
    const rawLanguages =
      context?.languages && context.languages.length > 0
        ? context.languages
        : context?.languageOverride && context.languageOverride !== 'ALL'
        ? [context.languageOverride]
        : preferences.preferredLanguages && preferences.preferredLanguages.length > 0
        ? preferences.preferredLanguages
        : [];
    const activeLanguages: string[] = normalizeLanguageList(rawLanguages);

    if (activeLanguages.length === 0) {
      return {
        greeting: timeInfo.greeting,
        timeOfDay,
        contextTitle: 'Choose Your Music Languages',
        contextDescription: 'Please select one or more languages to customize your personalized feed',
        preferredLanguages: [],
        requiresLanguageSelection: true,
        generatedAt: new Date().toISOString(),

        // 10 Explicit Dynamic Home Sections:
        madeForYou: [],
        basedOnListeningHistory: { basedOn: '', tracks: [] },
        becauseYouLikeThisArtist: { artist: '', tracks: [] },
        similarToFavouriteSongs: [],
        recentlyAdded: [],
        trendingInLanguages: [],
        discoverNewArtists: [],
        yourFavouriteMusicDirectors: [],
        recommendedMoods: [],
        continueListening: [],

        // Dynamic / extended sections:
        dailyMixes: [],
        becauseYouListenedTo: { basedOn: '', tracks: [] },
        basedOnFavouriteArtists: [],
        basedOnFavouriteDirectors: [],
        recentlyPlayed: [],
        favouriteSongs: [],
        newReleases: [],
        discoverSomethingNew: [],
        yourMoodMix: [],
        mostPlayedArtists: [],
        songsYouMayLike: [],

        // Backward-compatible fields:
        recommendedForYou: [],
        moreFromFavouriteArtists: [],
        sameMusicDirector: { director: '', tracks: [] },
        similarSongs: [],
        discoverNewMusic: [],
        moodPlaylists: [],
        popularSongs: [],
        favouriteMusicDirectors: [],
        favouriteSingers: [],
        favouriteArtists: [],
        recommendedSingers: [],
        recommendedMusicDirectors: [],
        movieSoundtracks: [],
        languageSections: [],
        favouriteArtistPicks: [],
        timeBasedPicks: { contextName: timeInfo.title, description: timeInfo.desc, tracks: [] },
        discoverNew: []
      };
    }

    // Cache lookup: versioned cache invalidation ensures immediate updates
    const userVersion = syncStore.getUserStateVersion(userId);
    const cacheKey = `${userId}:${activeLanguages.slice().sort().join(',')}:${context?.languageOverride || ''}:${timeOfDay}:v${userVersion}`;
    if (!seed && !isGuest) {
      const cached = userFeedCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < FEED_CACHE_TTL_MS)) {
        return cached.feed;
      }
    }

    const masterCatalog = this.getMasterCatalog();

    // Ingest actual user song listening stats and play history (Supabase-backed)
    const userSongStats = syncStore.getUserSongStats(userId);
    const { history: playHistory } = preferences.historyEnabled
      ? await SupabaseHistoryService.getUserPlayHistory(userId, 50)
      : { history: [] };

    // Dynamic preference inference maps
    const directorWeights = new Map<string, number>();
    const singerWeights = new Map<string, number>();
    const songStatMap = new Map<string, SongListeningStat>();

    // Cold-start seed weights from onboarding preferences
    for (const composer of preferences.favouriteComposers) {
      directorWeights.set(composer.toLowerCase(), (directorWeights.get(composer.toLowerCase()) || 0) + 15);
    }
    for (const singer of preferences.favouriteSingers || []) {
      singerWeights.set(singer.toLowerCase(), (singerWeights.get(singer.toLowerCase()) || 0) + 15);
    }
    for (const artist of preferences.favouriteArtists) {
      directorWeights.set(artist.toLowerCase(), (directorWeights.get(artist.toLowerCase()) || 0) + 10);
      singerWeights.set(artist.toLowerCase(), (singerWeights.get(artist.toLowerCase()) || 0) + 10);
    }

    // Dominate with real listening stats (plays +3, replays +10, completion +8, fast skips -15)
    for (const stat of userSongStats) {
      songStatMap.set(stat.songId, stat);
      const listenScore =
        stat.playCount * 3 +
        stat.replayCount * 10 -
        stat.skipCount * 15 +
        (stat.isFavorite ? 20 : 0);

      if (stat.musicDirector) {
        const dKey = stat.musicDirector.toLowerCase();
        directorWeights.set(dKey, (directorWeights.get(dKey) || 0) + listenScore);
      }

      if (stat.singers) {
        for (const s of stat.singers) {
          const sKey = s.toLowerCase();
          singerWeights.set(sKey, (singerWeights.get(sKey) || 0) + listenScore);
        }
      }
    }

    // Weight listening events if any
    for (const event of listeningEvents) {
      const art = event.artistName?.toLowerCase();
      if (!art) continue;
      let weight = 0;
      switch (event.eventType) {
        case 'LIKE':
          weight = 15;
          break;
        case 'ADD_TO_PLAYLIST':
          weight = 12;
          break;
        case 'REPLAY':
          weight = 8;
          break;
        case 'COMPLETE':
          weight = 6;
          break;
        case 'PLAY':
          weight = event.durationPlayedSec > 30 ? 2 : 0.5;
          break;
        case 'SKIP':
          weight = event.durationPlayedSec < 15 ? -8 : -1;
          break;
      }
      directorWeights.set(art, (directorWeights.get(art) || 0) + weight);
      singerWeights.set(art, (singerWeights.get(art) || 0) + weight);
    }

    // Filter out hidden tracks, ensure track is playable, and strictly enforce user's selected languages.
    // Pre-filtering: Songs with missing language metadata or outside user's selected languages are strictly excluded.
    const availableTracks = masterCatalog.filter(
      (t) =>
        !hiddenSet.has(t.id) &&
        Boolean(t.videoId || t.fullAudioUrl || t.previewUrl || t.isPlayableDirectly) &&
        isSongLanguageEligible(t, activeLanguages) &&
        !hiddenArtists.has(normalizeArtistToken(t.artist)) &&
        !hiddenArtists.has(normalizeArtistToken(t.composer))
    );

    // Track recently played song IDs for anti-repetition balancing
    const recentlyPlayedIds = new Set<string>(
      playHistory.slice(0, 5).map((ph) => ph.songId)
    );

    // Track recently impressed song IDs for freshness & discovery promotion
    const now = Date.now();
    const userImpressions = !isGuest ? syncStore.getUserImpressions(userId, 100) : [];
    const recentImpressionIds = new Set(
      userImpressions
        .filter((i) => now - new Date(i.timestamp).getTime() < 15 * 60 * 1000)
        .map((i) => i.songId)
    );

    // Calculate score for each candidate track using normalized 6-factor hybrid recommendation model:
    // Mandatory Language Eligibility: Pre-filtered (not a score)
    // 1. Artist Preference: 20%
    // 2. Music Director Preference: 15%
    // 3. Genre & Mood Preference: 15%
    // 4. Listening Behaviour & History: 25%
    // 5. Similarity to Favourites: 15%
    // 6. Discovery & Freshness: 10%
    const favArtistsSet = new Set([
      ...(preferences.favouriteArtists || []),
      ...(preferences.favouriteSingers || [])
    ].map((a) => a.toLowerCase().trim()));
    const favDirectorsSet = new Set([
      ...(preferences.favouriteComposers || [])
    ].map((d) => d.toLowerCase().trim()));
    const prefGenres = preferences.favouriteGenres || [];
    const prefMoods: string[] = preferences.preferredMoods || [];
    const prefMovies = preferences.favouriteMovies || [];
    const hasHistory = userSongStats.length > 0 || playHistory.length > 0;

    const weights = syncStore.getRecommendationWeights();

    const scoredTracks = availableTracks.map((track) => {
      let totalWeightedScore = 0;
      let applicableWeight = 0;
      let reason = '';

      // 1. Favourite Singers and Artists: 20%
      const wArtist = weights.artistPreference ?? 0.20;
      applicableWeight += wArtist;
      const trackArtistLower = (track.artist || '').toLowerCase();
      const trackSingersLower = (track.singers || []).map((s) => s.toLowerCase());
      let artistScore = 0.3; // Baseline score
      if (favArtistsSet.size > 0) {
        if (favArtistsSet.has(trackArtistLower) || trackSingersLower.some((s) => favArtistsSet.has(s))) {
          artistScore = 1.0;
          const matched = (track.singers || []).find((s) => favArtistsSet.has(s.toLowerCase())) || track.artist;
          reason = `Because you like ${matched}`;
        } else if (Array.from(favArtistsSet).some((a) => trackArtistLower.includes(a) || a.includes(trackArtistLower))) {
          artistScore = 0.8;
          reason = `Because you like ${track.artist}`;
        }
      } else if (singerWeights.has(trackArtistLower)) {
        artistScore = Math.min(1.0, Math.max(0.2, (singerWeights.get(trackArtistLower) || 0) / 20));
      }
      totalWeightedScore += wArtist * artistScore;

      // 2. Favourite Music Directors: 15%
      const wDir = weights.musicDirector ?? 0.15;
      applicableWeight += wDir;
      const composerLower = (track.composer || track.artist || '').toLowerCase();
      let dirScore = 0.3;
      if (favDirectorsSet.size > 0) {
        if (favDirectorsSet.has(composerLower)) {
          dirScore = 1.0;
          if (!reason) reason = `Composed by ${track.composer || track.artist}`;
        } else if (directorWeights.has(composerLower)) {
          const raw = directorWeights.get(composerLower) || 0;
          dirScore = Math.min(1.0, Math.max(0.2, raw / 20));
          if (dirScore > 0.5 && !reason) reason = `Music by ${track.composer || track.artist}`;
        }
      } else if (directorWeights.has(composerLower)) {
        const raw = directorWeights.get(composerLower) || 0;
        dirScore = Math.min(1.0, Math.max(0.2, raw / 20));
      }
      totalWeightedScore += wDir * dirScore;

      // 3. Preferred Genres and Moods: 15%
      const wGm = weights.genreAndMood ?? 0.15;
      applicableWeight += wGm;
      let gmScore = 0.4;
      if (prefGenres.length > 0 || prefMoods.length > 0) {
        let matchScore = 0;
        if (track.genre && prefGenres.some((g) => eq(g, track.genre))) {
          matchScore += 0.6;
        }
        if (track.mood && prefMoods.some((m: string) => eq(m, track.mood))) {
          matchScore += 0.4;
        }
        gmScore = Math.min(1.0, matchScore);
      }
      totalWeightedScore += wGm * gmScore;

      // 4. Listening Behaviour and History: 25%
      const wHist = weights.listeningBehavior ?? weights.listeningHistory ?? 0.25;
      applicableWeight += wHist;
      const stat = songStatMap.get(track.id);
      let histScore = 0.4;
      if (stat) {
        if (stat.replayCount > 0) {
          histScore = 1.0;
          if (!reason) reason = `Frequently replayed by you`;
        } else if (stat.playCount > 0) {
          histScore = Math.min(1.0, 0.4 + stat.playCount * 0.2);
          if (!reason) reason = `Based on your listening history`;
        }
        if (stat.isFavorite) {
          histScore = Math.min(1.0, histScore + 0.3);
        }
        if (stat.skipCount === 2) {
          histScore = Math.max(0, histScore - 0.2);
        } else if (stat.skipCount >= 3) {
          histScore = Math.max(0, histScore - 0.7);
        }
      } else if (hasHistory) {
        const artistHistory = (playHistory || []).find((h) => eq(h.artistName, track.artist));
        if (artistHistory) {
          histScore = 0.7;
          if (!reason) reason = `Based on your recent listening`;
        }
      }
      totalWeightedScore += wHist * histScore;

      // 5. Similarity to Favourites: 15%
      const wFav = weights.favoritesSimilarity ?? weights.songSimilarity ?? 0.15;
      applicableWeight += wFav;
      let simScore = 0.4;
      if (likedSet.has(track.id) || playlistSongIds.has(track.id)) {
        simScore = 1.0;
        if (!reason) reason = `From your favourites`;
      } else if (track.movieName && prefMovies.some((m) => eq(m, track.movieName))) {
        simScore = 0.9;
        if (!reason) reason = `From soundtrack ${track.movieName}`;
      } else {
        const matchingDirector = favDirectorsSet.has(composerLower) || directorWeights.has(composerLower);
        const matchingSinger = favArtistsSet.has(trackArtistLower) || singerWeights.has(trackArtistLower);
        if (matchingDirector && matchingSinger) simScore = 0.85;
        else if (matchingDirector || matchingSinger) simScore = 0.7;
      }
      totalWeightedScore += wFav * simScore;

      // 6. Discovery & Freshness: 10%
      const wDisc = weights.discoveryFreshness ?? weights.discoveryPopularity ?? 0.10;
      applicableWeight += wDisc;
      let discScore = 0.5;
      const isFreshArtist = !favArtistsSet.has(trackArtistLower) && !(playHistory || []).some((h) => eq(h.artistName, track.artist));
      discScore = isFreshArtist ? 0.8 : 0.5;
      if (track.releaseYear && track.releaseYear >= 2022) {
        discScore = Math.min(1.0, discScore + 0.2);
      }
      // Freshness deduction if recently impressed
      if (recentImpressionIds.has(track.id)) {
        discScore = Math.max(0.1, discScore - 0.3);
      }
      if (seed) {
        discScore = (discScore + ((deterministicSeedHash(`${track.id}:${seed}`) % 5) / 10)) / 1.5;
      }
      totalWeightedScore += wDisc * Math.min(1.0, discScore);

      // Normalization (Score scaled to 0-100)
      let score = applicableWeight > 0 ? (totalWeightedScore / applicableWeight) * 100 : 50;

      // Explicit fine-tuning feedback: MORE_LIKE_THIS / LESS_LIKE_THIS
      const trId = track.id.toLowerCase();
      if (moreLikeThisSet.has(trId) || moreLikeThisSet.has(trackArtistLower) || moreLikeThisSet.has(composerLower)) {
        score = Math.min(100, score + 25);
      }
      if (lessLikeThisSet.has(trId) || lessLikeThisSet.has(trackArtistLower) || lessLikeThisSet.has(composerLower)) {
        score = Math.max(0, score - 30);
      }

      // Negative signal: Repeatedly skipped songs (skip count >= 3) are heavily penalized (75% penalty multiplier)
      // Note: A single skip (skip count === 1) is NOT penalized with this penalty multiplier.
      if (stat && stat.skipCount >= 3) {
        score *= 0.25;
      } else if (stat && stat.skipCount === 2) {
        score *= 0.85;
      }

      const enrichedTrack: UnifiedTrack = {
        ...track,
        recommendationReason: reason || (track.language ? `Popular in ${track.language}` : `Recommended for you`)
      };

      return { track: enrichedTrack, score };
    });

    // Sort by score descending
    scoredTracks.sort((a, b) => b.score - a.score);

    // ==========================================================
    // BUILD THE 10 PERSONALIZED DASHBOARD SECTIONS
    // ==========================================================

    // 1. Recently Played (from userSongStats / playHistory) - strictly empty if user hasn't played songs
    let recentlyPlayed: UnifiedTrack[] = [];
    if (!isGuest && userSongStats.length > 0) {
      for (const stat of userSongStats) {
        const found = availableTracks.find((t) => t.id === stat.songId || eq(t.title, stat.songName));
        if (found && !recentlyPlayed.some((p) => p.id === found.id)) {
          recentlyPlayed.push(found);
        }
      }
    } else if (!isGuest && playHistory.length > 0) {
      for (const ph of playHistory) {
        const found = availableTracks.find((t) => t.id === ph.songId || eq(t.title, ph.songTitle));
        if (found && !recentlyPlayed.some((p) => p.id === found.id)) {
          recentlyPlayed.push(found);
        }
      }
    }
    recentlyPlayed = recentlyPlayed.slice(0, 10);

    // 2. Continue Listening (uncompleted tracks or session resumes) - strictly empty if no listening session or guest
    let continueListening: UnifiedTrack[] = [];
    if (!isGuest) {
      const continueCandidates = userSongStats.filter(
        (s) => s.totalListeningDurationMs > 20000 && s.skipCount === 0
      );
      for (const cand of continueCandidates) {
        const found = availableTracks.find((t) => t.id === cand.songId || eq(t.title, cand.songName));
        if (found && !continueListening.some((c) => c.id === found.id)) {
          continueListening.push(found);
        }
      }
    }
    continueListening = continueListening.slice(0, 6);

    // Diversity-balanced Made For You list (Anti-monopoly: max 2 songs per artist in top slots)
    const diversifiedMadeForYou: UnifiedTrack[] = [];
    const overflowTracks: UnifiedTrack[] = [];
    const composerCount = new Map<string, number>();
    for (const item of scoredTracks) {
      const compKey = normalizeArtistToken(item.track.composer || item.track.artist);
      const count = composerCount.get(compKey) || 0;
      if (count < 2) {
        diversifiedMadeForYou.push(item.track);
        composerCount.set(compKey, count + 1);
      } else {
        overflowTracks.push(item.track);
      }
      if (diversifiedMadeForYou.length >= 16) break;
    }
    for (const extra of overflowTracks) {
      if (diversifiedMadeForYou.length >= 18) break;
      diversifiedMadeForYou.push(extra);
    }

    // Record impressions for top recommendations to maintain freshness in future cycles
    if (!isGuest) {
      for (const track of diversifiedMadeForYou.slice(0, 10)) {
        syncStore.recordImpression(userId, track.id, 'madeForYou');
      }
    }
    for (const extra of overflowTracks) {
      if (diversifiedMadeForYou.length >= 18) break;
      diversifiedMadeForYou.push(extra);
    }

    // 3. Made For You / Recommended For You
    const recommendedForYou = diversifiedMadeForYou;
    const madeForYou = recommendedForYou;

    // 4. Based on Your Listening History - only shown if user has actual listening history
    let topDirectorOrSinger = '';
    let basedOnListeningHistoryTracks: UnifiedTrack[] = [];
    if (hasHistory) {
      let maxWeight = -Infinity;
      for (const [dir, w] of directorWeights.entries()) {
        if (w > maxWeight && availableTracks.some((t) => artistMatches(t.composer, dir) || artistMatches(t.artist, dir))) {
          maxWeight = w;
          const matched = ARTISTS_CATALOG.find((a) => normalizeArtistToken(a.name) === normalizeArtistToken(dir));
          topDirectorOrSinger = matched ? matched.name : dir;
        }
      }
      if (!topDirectorOrSinger && userSongStats.length > 0) {
        topDirectorOrSinger = userSongStats[0].musicDirector || userSongStats[0].singers?.[0] || '';
      }
      if (topDirectorOrSinger) {
        const matchingHistTracks = availableTracks.filter(
          (t) => artistMatches(t.artist, topDirectorOrSinger) || artistMatches(t.composer, topDirectorOrSinger)
        );
        basedOnListeningHistoryTracks = matchingHistTracks.slice(0, 12);
      }
    }

    // 5. Favourite Music Directors (User preferences + dynamic history + language catalog)
    const sortedDirectors = Array.from(directorWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => {
        const matched = ARTISTS_CATALOG.find((a) => normalizeArtistToken(a.name) === normalizeArtistToken(name));
        return matched ? matched.name : name;
      });
    const languageDirectors = queryArtistsCatalog({ role: 'DIRECTOR', languages: activeLanguages }).map((a) => a.name);
    const targetDirectors = Array.from(
      new Set([...preferences.favouriteComposers, ...sortedDirectors, ...languageDirectors])
    ).slice(0, 6);

    const favouriteMusicDirectors = targetDirectors.map((dir) => ({
      director: dir,
      tracks: availableTracks.filter((t) => artistMatches(t.composer, dir) || artistMatches(t.artist, dir)).slice(0, 10)
    })).filter((group) => group.tracks.length > 0);

    // 6. Favourite Singers (User preferences + dynamic history + language catalog)
    const sortedSingers = Array.from(singerWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => {
        const matched = ARTISTS_CATALOG.find((a) => normalizeArtistToken(a.name) === normalizeArtistToken(name));
        return matched ? matched.name : name;
      });
    const languageSingers = queryArtistsCatalog({ role: 'SINGER', languages: activeLanguages }).map((a) => a.name);
    const targetSingers = Array.from(
      new Set([...(preferences.favouriteSingers || []), ...(preferences.favouriteArtists || []), ...sortedSingers, ...languageSingers])
    ).slice(0, 8);

    const favouriteSingers = targetSingers.map((sin) => ({
      singer: sin,
      tracks: availableTracks.filter((t) => t.singers?.some((s) => artistMatches(s, sin))).slice(0, 10)
    })).filter((group) => group.tracks.length > 0);

    // Rich Artist Cards Builder (songs + grouped movie/album collections)
    const buildRichArtistCard = (
      artistName: string,
      opts: { roleHint?: 'DIRECTOR' | 'SINGER'; isFavourite?: boolean; isDiscovery?: boolean; reason?: string } = {}
    ): ArtistRecommendationCard | null => {
      const catalogItem = ARTISTS_CATALOG.find((a) => artistMatches(a.name, artistName));
      const canonicalName = catalogItem?.name || artistName;
      const role = catalogItem?.role || opts.roleHint || 'SINGER';
      const roleTitle = catalogItem?.roleTitle || (role === 'DIRECTOR' ? 'Music Director' : 'Playback Singer');
      const imageUrl = catalogItem?.imageUrl || 'https://cdn-images.dzcdn.net/images/artist/bd34315ef977a62a9e28c1ab19bb8ac4/500x500-000000-80-0-0.jpg';

      let directTracks = availableTracks.filter(
        (t) =>
          artistMatches(t.composer, canonicalName) ||
          artistMatches(t.artist, canonicalName) ||
          t.singers?.some((s) => artistMatches(s, canonicalName)) ||
          (catalogItem?.knownFor.some((kf) => t.movieName && eq(t.movieName, kf)))
      );

      // If catalog metadata doesn't have direct song credits for an artist, pair them with curated tracks from their primary languages
      if (directTracks.length === 0 && catalogItem) {
        directTracks = availableTracks.filter((t) =>
          catalogItem.languages.some((l) => eq(t.language, l))
        ).slice(0, 8);
      }
      if (directTracks.length === 0) return null;

      // Sort by user preferred language affinity first
      directTracks = directTracks.slice().sort((a, b) => {
        const aLang = a.language && activeLanguages.some((l) => eq(l, a.language)) ? 1 : 0;
        const bLang = b.language && activeLanguages.some((l) => eq(l, b.language)) ? 1 : 0;
        return bLang - aLang;
      });

      const albumMap = new Map<string, ArtistAlbumGroup>();
      for (const track of directTracks) {
        const albName = track.movieName || track.album || 'Essentials';
        const existing = albumMap.get(albName);
        if (existing) {
          if (!existing.tracks.some((x) => x.id === track.id)) {
            existing.tracks.push(track);
          }
        } else {
          albumMap.set(albName, {
            id: `album_${albName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            name: albName,
            releaseYear: track.releaseYear,
            language: track.language,
            artworkUrl: track.artworkUrl,
            tracks: [track]
          });
        }
      }

      return {
        id: catalogItem?.id || `art_${canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: canonicalName,
        category: 'ARTIST',
        role,
        roleTitle,
        languages: catalogItem?.languages || activeLanguages,
        imageUrl,
        isFavourite: opts.isFavourite,
        isDiscovery: opts.isDiscovery,
        reason: opts.reason,
        knownFor: catalogItem?.knownFor || Array.from(albumMap.keys()).slice(0, 4),
        tracks: directTracks.slice(0, 16),
        albums: Array.from(albumMap.values())
      };
    };

    // Unified Favourite Artists Section
    const explicitFavNames = Array.from(
      new Set([
        ...(preferences.favouriteArtists || []),
        ...(preferences.favouriteComposers || []),
        ...(preferences.favouriteSingers || []),
        ...targetDirectors.slice(0, 3),
        ...targetSingers.slice(0, 3)
      ])
    ).slice(0, 12);

    const favouriteArtists: ArtistRecommendationCard[] = explicitFavNames
      .map((name) =>
        buildRichArtistCard(name, {
          roleHint: targetDirectors.includes(name) ? 'DIRECTOR' : 'SINGER',
          isFavourite: true,
          reason: 'In your favourites'
        })
      )
      .filter((c): c is ArtistRecommendationCard => c !== null);

    // Recommended Singers (User favourites + similar/new language-matched singers)
    const singerPool = queryArtistsCatalog({ role: 'SINGER', languages: activeLanguages });
    const orderedSingerNames = Array.from(
      new Set([
        ...targetSingers,
        ...singerPool.map((a) => a.name)
      ])
    ).slice(0, 14);

    const recommendedSingers: ArtistRecommendationCard[] = orderedSingerNames
      .map((name) => {
        const isFav = targetSingers.slice(0, 3).some((s) => artistMatches(s, name)) ||
          (preferences.favouriteSingers || []).some((s) => artistMatches(s, name));
        return buildRichArtistCard(name, {
          roleHint: 'SINGER',
          isFavourite: isFav,
          isDiscovery: !isFav,
          reason: isFav ? 'Favourite voice' : 'Recommended singer for your taste'
        });
      })
      .filter((c): c is ArtistRecommendationCard => c !== null);

    // Recommended Music Directors (User favourites + similar/new composers matching languages)
    const directorPool = queryArtistsCatalog({ role: 'DIRECTOR', languages: activeLanguages });
    const orderedDirectorNames = Array.from(
      new Set([
        ...targetDirectors,
        ...directorPool.map((a) => a.name)
      ])
    ).slice(0, 14);

    const recommendedMusicDirectors: ArtistRecommendationCard[] = orderedDirectorNames
      .map((name) => {
        const isFav = (preferences.favouriteComposers || []).some((d) => artistMatches(d, name)) ||
          sortedDirectors.slice(0, 2).some((d) => artistMatches(d, name));
        return buildRichArtistCard(name, {
          roleHint: 'DIRECTOR',
          isFavourite: isFav,
          isDiscovery: !isFav,
          reason: isFav ? 'Your favourite composer' : 'Similar musical style'
        });
      })
      .filter((c): c is ArtistRecommendationCard => c !== null);

    // Mood-Based Playlists (All 12 Required Moods)
    const moodPlaylists: MoodPlaylistCard[] = ALL_12_MOOD_SPECS.map((spec) => {
      const matched = scoredTracks
        .filter(({ track }) =>
          spec.preferredTitles.some((pt) => eq(pt, track.title)) || spec.keywords.test(track.title)
        )
        .map(({ track }) => track);

      // Deduplicate & preserve highest personalized affinity + preferred titles order
      const seen = new Set<string>();
      const orderedMoodTracks: UnifiedTrack[] = [];
      for (const track of matched) {
        if (!seen.has(track.id)) {
          seen.add(track.id);
          orderedMoodTracks.push(track);
        }
      }

      // Ensure generous collection (at least 6 tracks per mood) prioritized by activeLanguages
      if (orderedMoodTracks.length < 8) {
        const backfill = scoredTracks
          .map((s) => s.track)
          .filter((t) => !seen.has(t.id));
        for (const t of backfill) {
          seen.add(t.id);
          orderedMoodTracks.push(t);
          if (orderedMoodTracks.length >= 10) break;
        }
      }

      return {
        id: spec.id,
        mood: spec.mood,
        title: spec.title,
        description: spec.description,
        artworkUrl: spec.artworkUrl,
        accentColor: spec.accentColor,
        trackCount: orderedMoodTracks.length,
        tracks: orderedMoodTracks.slice(0, 14)
      };
    });

    // Similar Songs (based on listening history, recently played movies, composers & liked/playlist songs)
    const seedReferenceTracks = [
      ...recentlyPlayed.slice(0, 4),
      ...availableTracks.filter((t) => likedSet.has(t.id) || playlistSongIds.has(t.id)).slice(0, 4),
      ...(recentlyPlayed.length === 0 && !likedSet.size && !playlistSongIds.size && (preferences.favouriteArtists?.length || preferences.favouriteComposers?.length)
        ? availableTracks.filter((t) =>
            (preferences.favouriteArtists || []).some((a) => artistMatches(t.artist, a)) ||
            (preferences.favouriteComposers || []).some((c) => artistMatches(t.composer, c))
          ).slice(0, 4)
        : [])
    ];

    let similarSongs: UnifiedTrack[] = [];
    if (seedReferenceTracks.length > 0) {
      const seedMovies = new Set(seedReferenceTracks.map((t) => t.movieName).filter(Boolean));
      const seedComposers = new Set(seedReferenceTracks.map((t) => normalizeArtistToken(t.composer || t.artist)).filter(Boolean));
      const seedSingers = new Set(seedReferenceTracks.flatMap((t) => (t.singers || []).map((s) => normalizeArtistToken(s))));
      const seedIds = new Set(seedReferenceTracks.map((t) => t.id));

      similarSongs = availableTracks
        .map((track) => {
          let sim = 0;
          if (seedMovies.has(track.movieName)) sim += 35;
          if (seedComposers.has(normalizeArtistToken(track.composer || track.artist))) sim += 25;
          if (track.singers?.some((s) => seedSingers.has(normalizeArtistToken(s)))) sim += 20;
          if (track.language && activeLanguages.some((l) => eq(l, track.language))) sim += 15;
          if (seed) sim += (deterministicSeedHash(`sim:${track.id}:${seed}`) % 7) - 3;
          // Prefer similar tracks not identical to top recentlyPlayed slots
          if (seedIds.has(track.id)) sim -= 8;
          return { track, sim };
        })
        .sort((a, b) => b.sim - a.sim)
        .map((s) => s.track)
        .slice(0, 16);
    }

    // Popular Songs (popular hits across selected artists & chartbusters)
    const popularTitleSet = new Set(
      ARTISTS_CATALOG.flatMap((a) => a.popularTracks.map((pt) => pt.toLowerCase()))
    );
    const popularSongs = availableTracks
      .map((track) => {
        let pop = 0;
        if (popularTitleSet.has(track.title.toLowerCase())) pop += 30;
        if (track.language && activeLanguages.some((l) => eq(l, track.language))) pop += 20;
        if (track.releaseYear && track.releaseYear >= 2018) pop += 10;
        const stat = songStatMap.get(track.id);
        if (stat) pop += Math.min(15, stat.playCount * 2 + stat.replayCount * 4);
        if (seed) pop += (deterministicSeedHash(`pop:${track.id}:${seed}`) % 7) - 3;
        return { track, pop };
      })
      .sort((a, b) => b.pop - a.pop)
      .map((s) => s.track)
      .slice(0, 16);

    // 7. Trending in Selected Languages
    const trendingInLanguages = availableTracks
      .filter((t) => activeLanguages.some((l) => eq(l, t.language)))
      .sort((a, b) => {
        const yearDiff = (b.releaseYear || 2020) - (a.releaseYear || 2020);
        if (seed && Math.abs(yearDiff) <= 1) {
          return (deterministicSeedHash(`tr:${b.id}:${seed}`) % 5) - (deterministicSeedHash(`tr:${a.id}:${seed}`) % 5);
        }
        return yearDiff;
      })
      .slice(0, 16);

    // 8. New Releases (recent years 2023-2024)
    const newReleases = availableTracks
      .filter((t) => (t.releaseYear && t.releaseYear >= 2022) || t.title.includes('Badass') || t.title.includes('Illuminati') || t.title.includes('Chaleya'))
      .slice(0, 12);

    // 9. Discover New Music (Anti-fatigue discovery injection with similar musical styles outside overplayed artists)
    const unplayedCandidates = scoredTracks
      .map((s) => s.track)
      .filter((t) => !songStatMap.has(t.id) && !recentlyPlayed.some((rp) => rp.id === t.id));
    const discoverPool = unplayedCandidates.filter(
      (t) => !targetDirectors.slice(0, 3).some((d) => artistMatches(t.composer, d))
    );
    const discoverNewMusic = (discoverPool.length >= 6 ? discoverPool : unplayedCandidates.length > 0 ? unplayedCandidates : availableTracks.slice().reverse())
      .slice(0, 16);

    // 10. Movie Soundtracks
    const movieSoundtracks: MovieSoundtrack[] = KNOWN_INDIAN_MOVIES.filter((m) =>
      activeLanguages.some((l) => eq(l, m.language))
    ).map((m) => {
      const mTracks = availableTracks.filter((t) => t.movieName === m.movieName);
      return {
        id: `movie_${m.movieName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        movieName: m.movieName,
        releaseYear: m.year,
        composer: m.composer,
        language: m.language,
        artworkUrl: mTracks[0]?.artworkUrl || 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg',
        totalTracks: mTracks.length,
        tracks: mTracks
      };
    }).slice(0, 8);

    // Legacy language breakdown sections for compatibility
    const languageSections = activeLanguages.map((lang) => {
      const inLang = availableTracks.filter((t) => eq(t.language, lang));
      const inLangMovies = KNOWN_INDIAN_MOVIES.filter((m) => eq(m.language, lang)).map((m) => {
        const mTracks = availableTracks.filter((t) => t.movieName === m.movieName);
        return {
          id: `movie_${m.movieName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          movieName: m.movieName,
          releaseYear: m.year,
          composer: m.composer,
          language: m.language,
          artworkUrl: mTracks[0]?.artworkUrl || 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg',
          totalTracks: mTracks.length,
          tracks: mTracks
        };
      });

      return {
        language: lang,
        recommended: inLang.slice(0, 10),
        trending: inLang.slice(2, 12),
        soundtracks: inLangMovies.slice(0, 6)
      };
    }).filter((s) => s.recommended.length > 0 || s.soundtracks.length > 0);

    // 7. Your Favourite Songs (Explicitly favorited / liked tracks)
    const userFavorites = !isGuest ? syncStore.getUserFavorites(userId) : new Set<string>();
    const favoriteSongIds = new Set<string>([
      ...userFavorites,
      ...userSongStats.filter((s) => s.isFavorite).map((s) => s.songId),
      ...Array.from(likedSet)
    ]);
    const favouriteSongs: UnifiedTrack[] = isGuest ? [] : availableTracks.filter((t) => favoriteSongIds.has(t.id));

    // 8. Similar to Your Favourite Songs
    let similarToFavouriteSongs: UnifiedTrack[] = [];
    if (!isGuest && favouriteSongs.length > 0) {
      const favComposers = new Set(favouriteSongs.map((t) => normalizeArtistToken(t.composer || t.artist)).filter(Boolean));
      const favSingers = new Set(favouriteSongs.flatMap((t) => (t.singers || []).map((s) => normalizeArtistToken(s))));
      const favMovies = new Set(favouriteSongs.map((t) => t.movieName).filter(Boolean));

      similarToFavouriteSongs = availableTracks
        .filter((t) => !favoriteSongIds.has(t.id))
        .map((t) => {
          let sim = 0;
          if (favComposers.has(normalizeArtistToken(t.composer || t.artist))) sim += 35;
          if (t.singers?.some((s) => favSingers.has(normalizeArtistToken(s)))) sim += 25;
          if (t.movieName && favMovies.has(t.movieName)) sim += 30;
          return { track: t, sim };
        })
        .filter((s) => s.sim > 0)
        .sort((a, b) => b.sim - a.sim)
        .map((s) => s.track);
    }
    if (!isGuest && similarToFavouriteSongs.length === 0) {
      similarToFavouriteSongs = similarSongs;
    }

    const favArtistTrackCandidates = availableTracks.filter((t) => {
      const aLower = (t.artist || '').toLowerCase();
      const cLower = (t.composer || '').toLowerCase();
      const sLowers = (t.singers || []).map((s) => s.toLowerCase());
      return (
        Array.from(favArtistsSet).some(
          (a) => aLower.includes(a) || a.includes(aLower) || sLowers.some((s) => s.includes(a) || a.includes(s))
        ) ||
        Array.from(favDirectorsSet).some(
          (d) => cLower.includes(d) || d.includes(cLower)
        )
      );
    });
    const moreFromFavouriteArtists = (
      favArtistTrackCandidates.length > 0
        ? favArtistTrackCandidates
        : scoredTracks.map((s) => s.track)
    ).slice(0, 16);

    const primaryDirector =
      preferences.favouriteComposers.find(c => availableTracks.some(t => artistMatches(t.composer, c) || artistMatches(t.artist, c))) ||
      (favouriteMusicDirectors[0]?.director) ||
      availableTracks[0]?.composer ||
      availableTracks[0]?.artist ||
      'Top Composer';
    const sameDirectorTracks = availableTracks.filter(
      (t) => artistMatches(t.composer, primaryDirector) || artistMatches(t.artist, primaryDirector)
    );
    const sameMusicDirector = {
      director: primaryDirector,
      tracks: (sameDirectorTracks.length > 0 ? sameDirectorTracks : availableTracks).slice(0, 16)
    };

    // 4. Based on Your Favourite Artists
    const basedOnFavouriteArtists = moreFromFavouriteArtists;

    // 5. Based on Your Favourite Music Directors
    const basedOnFavouriteDirectors = sameMusicDirector.tracks;

    // 11. Discover Something New
    const discoverSomethingNew = discoverNewMusic;

    // 12. Your Mood Mix
    const yourMoodMix = moodPlaylists;

    // 14. Your Most Played Artists
    const mostPlayedArtists = favouriteArtists;

    // 15. Songs You May Like
    const topMadeForYouIds = new Set(madeForYou.slice(0, 6).map((t) => t.id));
    const songsYouMayLike = scoredTracks
      .map((s) => s.track)
      .filter((t) => !topMadeForYouIds.has(t.id))
      .slice(0, 16);

    // Daily Mixes (strictly empty in guest mode)
    const dailyMixes = isGuest ? [] : this.generateDailyMixes(
      userId,
      availableTracks,
      activeLanguages,
      preferences,
      userSongStats,
      feedbacks
    );

    // Time-based picks
    const timeBasedTracks = availableTracks
      .filter((t) => activeLanguages.some((l) => eq(l, t.language)))
      .slice(0, 10);

    const primaryFavArtist =
      (!isGuest && (preferences.favouriteArtists?.[0] || preferences.favouriteSingers?.[0])) ||
      topDirectorOrSinger ||
      '';

    const becauseYouLikeThisArtistTracks = (
      primaryFavArtist && !isGuest
        ? availableTracks.filter((t) => artistMatches(t.artist, primaryFavArtist) || artistMatches(t.composer, primaryFavArtist)).slice(0, 12)
        : []
    );

    const becauseYouLikeThisArtist = {
      artist: isGuest ? '' : primaryFavArtist,
      tracks: isGuest ? [] : becauseYouLikeThisArtistTracks
    };

    const recentlyAdded = newReleases;
    const discoverNewArtists = favouriteArtists.slice(0, 6);
    const recommendedMoods = moodPlaylists;

    const finalResult: PersonalizedFeedResponse = {
      greeting: timeInfo.greeting,
      timeOfDay,
      contextTitle: timeInfo.title,
      contextDescription: timeInfo.desc,
      preferredLanguages: activeLanguages,
      generatedAt: new Date().toISOString(),

      // 10 Explicit Dynamic Home Sections:
      madeForYou,
      basedOnListeningHistory: {
        basedOn: isGuest ? '' : topDirectorOrSinger,
        tracks: isGuest ? [] : basedOnListeningHistoryTracks
      },
      becauseYouLikeThisArtist,
      similarToFavouriteSongs: isGuest ? [] : similarToFavouriteSongs,
      recentlyAdded,
      trendingInLanguages,
      discoverNewArtists,
      yourFavouriteMusicDirectors: favouriteMusicDirectors,
      recommendedMoods,
      continueListening: isGuest ? [] : continueListening,

      // Extended / dynamic sections:
      dailyMixes,
      becauseYouListenedTo: {
        basedOn: isGuest ? '' : topDirectorOrSinger,
        tracks: isGuest ? [] : basedOnListeningHistoryTracks
      },
      basedOnFavouriteArtists,
      basedOnFavouriteDirectors,
      recentlyPlayed: isGuest ? [] : recentlyPlayed,
      favouriteSongs,
      newReleases,
      discoverSomethingNew,
      yourMoodMix,
      mostPlayedArtists,
      songsYouMayLike,

      // Backward-compatible fields:
      recommendedForYou,
      moreFromFavouriteArtists,
      sameMusicDirector,
      similarSongs,
      discoverNewMusic,
      moodPlaylists,
      popularSongs,
      favouriteMusicDirectors,
      favouriteSingers,
      favouriteArtists,
      recommendedSingers,
      recommendedMusicDirectors,
      movieSoundtracks,
      languageSections,
      favouriteArtistPicks: favouriteArtists.map((a) => ({
        artist: a.name,
        role: a.role,
        roleTitle: a.roleTitle,
        imageUrl: a.imageUrl,
        tracks: a.tracks
      })),
      timeBasedPicks: {
        contextName: timeInfo.title,
        description: timeInfo.desc,
        tracks: timeBasedTracks
      },
      discoverNew: discoverNewMusic
    };

    // Store in versioned cache for non-guest users
    if (!isGuest && !seed) {
      userFeedCache.set(cacheKey, {
        feed: finalResult,
        timestamp: Date.now(),
        preferenceVersion: userVersion
      });
    }

    return finalResult;
  }

  /**
   * Invalidates cached recommendation feeds
   */
  static invalidateUserCache(userId?: string): void {
    if (!userId) {
      userFeedCache.clear();
      return;
    }
    for (const key of userFeedCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        userFeedCache.delete(key);
      }
    }
  }

  /**
   * Retrieves complete song collection for a specific mood (used by Mood card & See All routes)
   */
  static async getMoodPlaylistById(
    userId: string,
    moodId: string
  ): Promise<MoodPlaylistCard | null> {
    const preferences: UserMusicPreference = syncStore.getUserPreferences(userId);
    const userLangs = normalizeLanguageList(preferences.preferredLanguages);
    if (userLangs.length === 0) return null;

    const feed = await this.getPersonalizedFeed(userId);
    const target = moodId.trim().toLowerCase();
    const found = feed.moodPlaylists.find(
      (m) => m.id.toLowerCase() === target || m.mood.toLowerCase() === target
    );
    if (found) return found;

    // Direct mood spec fallback from catalog strictly respecting user languages
    const spec = ALL_12_MOOD_SPECS.find(
      (s) => s.id.toLowerCase() === target || s.mood.toLowerCase() === target
    );
    if (!spec) return null;
    const catalog = this.getMasterCatalog();
    const matched = catalog.filter(
      (t) =>
        isSongLanguageEligible(t, userLangs) &&
        (spec.preferredTitles.some((pt) => eq(pt, t.title)) || spec.keywords.test(t.title))
    );
    return {
      id: spec.id,
      mood: spec.mood,
      title: spec.title,
      description: spec.description,
      artworkUrl: spec.artworkUrl,
      accentColor: spec.accentColor,
      trackCount: matched.length,
      tracks: matched.slice(0, 16)
    };
  }

  /**
   * Retrieves detailed artist profile with playable songs and movie/album groups
   */
  static async getArtistDetailByName(
    userId: string,
    artistName: string
  ): Promise<ArtistRecommendationCard | null> {
    const feed = await this.getPersonalizedFeed(userId);
    const allArtists = [
      ...feed.favouriteArtists,
      ...feed.recommendedSingers,
      ...feed.recommendedMusicDirectors
    ];
    const matched = allArtists.find((a) => artistMatches(a.name, artistName) || a.id === artistName);
    if (matched) return matched;

    const catalogItem = ARTISTS_CATALOG.find(
      (a) => artistMatches(a.name, artistName) || a.id === artistName
    );
    if (!catalogItem) return null;

    const preferences: UserMusicPreference = syncStore.getUserPreferences(userId);
    const userLangs = normalizeLanguageList(preferences.preferredLanguages);

    const availableTracks = this.getMasterCatalog().filter((t) =>
      Boolean(t.videoId || t.fullAudioUrl || t.previewUrl) &&
      (userLangs.length === 0 || isSongLanguageEligible(t, userLangs))
    );
    let tracks = availableTracks.filter(
      (t) =>
        artistMatches(t.composer, catalogItem.name) ||
        artistMatches(t.artist, catalogItem.name) ||
        t.singers?.some((s) => artistMatches(s, catalogItem.name))
    );
    if (tracks.length === 0 && userLangs.length > 0) {
      tracks = availableTracks.filter((t) => isSongLanguageEligible(t, userLangs)).slice(0, 10);
    }

    const albumMap = new Map<string, ArtistAlbumGroup>();
    for (const track of tracks) {
      const albName = track.movieName || track.album || 'Essentials';
      const existing = albumMap.get(albName);
      if (existing) {
        existing.tracks.push(track);
      } else {
        albumMap.set(albName, {
          id: `album_${albName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: albName,
          releaseYear: track.releaseYear,
          language: track.language,
          artworkUrl: track.artworkUrl,
          tracks: [track]
        });
      }
    }

    return {
      id: catalogItem.id,
      name: catalogItem.name,
      category: 'ARTIST',
      role: catalogItem.role,
      roleTitle: catalogItem.roleTitle,
      languages: catalogItem.languages,
      imageUrl: catalogItem.imageUrl,
      knownFor: catalogItem.knownFor,
      tracks,
      albums: Array.from(albumMap.values())
    };
  }

  /**
   * Retrieves artist catalog with strict language filtering and canonical deduplication
   */
  static getArtistsCatalog(options?: {
    languages?: string[];
    role?: 'DIRECTOR' | 'SINGER' | 'ALL';
    query?: string;
    limit?: number;
    includeAllLanguages?: boolean;
  }): ArtistItem[] {
    return queryArtistsCatalog(options);
  }

  static getPaginatedArtistsCatalog(options?: {
    languages?: string[];
    role?: 'DIRECTOR' | 'SINGER' | 'ALL';
    query?: string;
    page?: number;
    limit?: number;
    includeAllLanguages?: boolean;
  }): PaginatedArtistsResponse {
    return CanonicalArtistService.getArtists(options);
  }

  /**
   * Generates dynamic Daily Mixes tailored to user preferences, listening stats, and selected languages
   */
  private static generateDailyMixes(
    userId: string,
    tracks: UnifiedTrack[],
    languages: string[],
    preferences?: UserMusicPreference,
    userSongStats?: SongListeningStat[],
    feedbacks?: RecommendationFeedbackRecord[]
  ): DailyMixItem[] {
    if (!languages || languages.length === 0 || tracks.length === 0) {
      return [];
    }
    const mixes: DailyMixItem[] = [];
    const primaryLang = languages[0];

    // 1. Melody Mix
    const melodyTracks = tracks.filter((t) => {
      const titleLower = t.title.toLowerCase();
      const isMelodyGenre = t.genre?.toLowerCase() === 'melody';
      const isMelodyMood = t.mood?.toLowerCase() === 'romantic' || t.mood?.toLowerCase() === 'love';
      const isMelodyKeyword = /nenjukkul|mundhinam|samajavaragamana|malare|hosanna|tum hi ho|cherathukal|anbenum|srivalli|chaleya|satrangi|chinna|kaadhal/i.test(titleLower);
      return isMelodyGenre || isMelodyMood || isMelodyKeyword;
    });
    const finalMelodyTracks = (melodyTracks.length >= 3 ? melodyTracks : tracks).slice(0, 12);
    if (finalMelodyTracks.length > 0) {
      mixes.push({
        id: `mix_${primaryLang.toLowerCase()}_melody`,
        title: `${primaryLang} Melody Mix`,
        subtitle: 'Heart-touching cinema melodies and golden acoustic duets',
        language: primaryLang,
        coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=600&q=80',
        trackCount: finalMelodyTracks.length,
        tracks: finalMelodyTracks
      });
    }

    // 2. Favourite Artists Mix
    const favArtists = new Set([
      ...(preferences?.favouriteArtists || []),
      ...(preferences?.favouriteSingers || []),
      ...(preferences?.favouriteComposers || [])
    ].map((a) => a.toLowerCase().trim()));

    const artistTracks = tracks.filter((t) => {
      const art = (t.artist || '').toLowerCase();
      const comp = (t.composer || '').toLowerCase();
      const sings = (t.singers || []).map((s) => s.toLowerCase());
      return (
        Array.from(favArtists).some((fa) => art.includes(fa) || fa.includes(art) || comp.includes(fa) || fa.includes(comp) || sings.some((s) => s.includes(fa) || fa.includes(s)))
      );
    });
    const finalArtistTracks = (artistTracks.length >= 3 ? artistTracks : tracks.slice().reverse()).slice(0, 12);
    if (finalArtistTracks.length > 0) {
      const artistHeader = preferences?.favouriteComposers?.[0] || preferences?.favouriteSingers?.[0] || preferences?.favouriteArtists?.[0] || 'Your Favourites';
      mixes.push({
        id: `mix_${userId}_favourite_artists`,
        title: 'Favourite Artists Mix',
        subtitle: `Curated selections featuring ${artistHeader} and your favorite artists`,
        language: primaryLang,
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
        trackCount: finalArtistTracks.length,
        tracks: finalArtistTracks
      });
    }

    // 3. Relaxing Mix
    const relaxTracks = tracks.filter((t) => {
      const titleLower = t.title.toLowerCase();
      const isRelaxMood = t.mood?.toLowerCase() === 'relaxing' || t.mood?.toLowerCase() === 'melancholic';
      const isRelaxKeyword = /cherathukal|aluva|annul|silent|pudhu vellai|pathivayi|anbil|ezhutha|kaadhal|viva/i.test(titleLower);
      return isRelaxMood || isRelaxKeyword;
    });
    const finalRelaxTracks = (relaxTracks.length >= 3 ? relaxTracks : tracks.slice(1)).slice(0, 12);
    if (finalRelaxTracks.length > 0) {
      mixes.push({
        id: `mix_${primaryLang.toLowerCase()}_relaxing`,
        title: 'Calm & Relaxing Mix',
        subtitle: 'Peaceful acoustic harmonies for relaxing and unwinding',
        language: primaryLang,
        coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
        trackCount: finalRelaxTracks.length,
        tracks: finalRelaxTracks
      });
    }

    // 4. Trending Mix
    const trendingTracks = tracks
      .filter((t) => (t.releaseYear && t.releaseYear >= 2021) || t.title.includes('Badass') || t.title.includes('Illuminati') || t.title.includes('Naatu') || t.title.includes('Chaleya'))
      .slice(0, 12);
    const finalTrendingTracks = (trendingTracks.length >= 3 ? trendingTracks : tracks).slice(0, 12);
    if (finalTrendingTracks.length > 0) {
      mixes.push({
        id: `mix_${primaryLang.toLowerCase()}_trending`,
        title: 'Trending Mix',
        subtitle: `The hottest hits & chartbusters across ${languages.join(', ')}`,
        language: primaryLang,
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
        trackCount: finalTrendingTracks.length,
        tracks: finalTrendingTracks
      });
    }

    // 5. New Discoveries
    const playedSongIds = new Set((userSongStats || []).map((s) => s.songId));
    const discoveryTracks = tracks.filter((t) => !playedSongIds.has(t.id));
    const finalDiscoveryTracks = (discoveryTracks.length >= 3 ? discoveryTracks : tracks.slice().reverse()).slice(0, 12);
    if (finalDiscoveryTracks.length > 0) {
      mixes.push({
        id: `mix_${userId}_new_discoveries`,
        title: 'New Discoveries',
        subtitle: 'Fresh additions and hidden gems outside your daily rotation',
        language: primaryLang,
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
        trackCount: finalDiscoveryTracks.length,
        tracks: finalDiscoveryTracks
      });
    }

    // 6. Your Repeat Mix
    const repeatTracks = tracks.filter((t) => {
      const stat = userSongStats?.find((s) => s.songId === t.id);
      return stat && (stat.replayCount > 0 || stat.isFavorite || stat.playCount >= 2);
    });
    const finalRepeatTracks = (repeatTracks.length >= 3 ? repeatTracks : tracks.slice(0, 10)).slice(0, 12);
    if (finalRepeatTracks.length > 0) {
      mixes.push({
        id: `mix_${userId}_your_repeat`,
        title: 'Your Repeat Mix',
        subtitle: 'The tracks you keep coming back to time and time again',
        language: primaryLang,
        coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
        trackCount: finalRepeatTracks.length,
        tracks: finalRepeatTracks
      });
    }

    return mixes;
  }

  /**
   * Generates a custom smart playlist according to language, mood/genre, composer, and duration
   */
  static generateSmartPlaylist(userId: string, req: SmartPlaylistRequest): SmartPlaylistResponse {
    const masterCatalog = this.getMasterCatalog();
    const preferences: UserMusicPreference = syncStore.getUserPreferences(userId);
    const userLangs = normalizeLanguageList(preferences.preferredLanguages);
    const targetLangs = req.language && req.language !== 'ALL'
      ? normalizeLanguageList([req.language])
      : userLangs;

    const targetMin = req.targetDurationMinutes || 45;
    const targetMs = targetMin * 60 * 1000;

    let filtered = masterCatalog.filter((t) =>
      targetLangs.length === 0 || isSongLanguageEligible(t, targetLangs)
    );

    // 1. Language filter
    if (req.language && req.language !== 'ALL') {
      filtered = filtered.filter((t) => eq(t.language, req.language));
    }

    // 2. Composer / Artist filter
    if (req.composer) {
      const c = req.composer.toLowerCase();
      filtered = filtered.filter((t) => t.composer?.toLowerCase().includes(c) || t.artist?.toLowerCase().includes(c));
    } else if (req.artist) {
      const a = req.artist.toLowerCase();
      filtered = filtered.filter((t) => t.artist?.toLowerCase().includes(a) || t.singers?.some((s) => s.toLowerCase().includes(a)));
    }

    // 3. Movie filter
    if (req.movie) {
      const m = req.movie.toLowerCase();
      filtered = filtered.filter((t) => t.movieName?.toLowerCase().includes(m));
    }

    // 4. Mood / Genre filter
    if (req.genreOrMood) {
      const mood = req.genreOrMood.toLowerCase();
      if (mood.includes('relax') || mood.includes('calm') || mood.includes('sleep')) {
        filtered = filtered.filter((t) =>
          /cherathukal|annul|hosanna|malare|pudhu|viva|silent|aluvapuzha/i.test(t.title)
        );
      } else if (mood.includes('workout') || mood.includes('energy') || mood.includes('party')) {
        filtered = filtered.filter((t) =>
          /naa ready|zingaat|naatu|badass|chaiyya|blinding|oo antava/i.test(t.title)
        );
      } else if (mood.includes('melody') || mood.includes('romantic')) {
        filtered = filtered.filter((t) =>
          /nenjukkul|mundhinam|samajavaragamana|hosanna|tum hi ho|kaadhal/i.test(t.title)
        );
      }
    }

    // If filter left zero or too few tracks, fallback to broader language matches strictly within target languages
    if (filtered.length < 3) {
      filtered = masterCatalog.filter((t) =>
        targetLangs.length === 0 || isSongLanguageEligible(t, targetLangs)
      );
    }

    // Shuffle and pick tracks to accumulate target duration
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    const selectedTracks: UnifiedTrack[] = [];
    let currentMs = 0;

    for (const track of shuffled) {
      selectedTracks.push(track);
      currentMs += track.durationMs;
      if (currentMs >= targetMs || selectedTracks.length >= 18) break;
    }

    const playlistTitle = `${req.language || 'Smart'} ${req.genreOrMood || 'Discovery'} Mix`;
    const playlistDesc = `Generated ${targetMin}-minute playlist featuring ${selectedTracks.length} tracks`;

    return {
      id: `smart_pl_${Date.now()}`,
      name: playlistTitle,
      description: playlistDesc,
      artworkUrl: selectedTracks[0]?.artworkUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
      language: req.language,
      genreOrMood: req.genreOrMood,
      totalTracks: selectedTracks.length,
      totalDurationMs: currentMs,
      tracks: selectedTracks
    };
  }

  /**
   * Retrieves similar songs based on composer, language, and singer affinities
   */
  static getSimilarSongs(songId: string, limit = 8, userId?: string): UnifiedTrack[] {
    const catalog = this.getMasterCatalog();
    const ref = catalog.find((t) => t.id === songId);

    let userLangs: string[] = [];
    if (userId) {
      const prefs = syncStore.getUserPreferences(userId);
      userLangs = normalizeLanguageList(prefs.preferredLanguages);
    }

    if (!ref) {
      if (userLangs.length > 0) {
        return catalog.filter((t) => isSongLanguageEligible(t, userLangs)).slice(0, limit);
      }
      return catalog.slice(0, limit);
    }

    const refLang = normalizeLanguageToken(ref.language);
    const candidateLangs = userLangs.length > 0
      ? userLangs
      : (refLang ? [refLang] : []);

    const candidates = catalog.filter((t) =>
      t.id !== ref.id &&
      (candidateLangs.length === 0 || isSongLanguageEligible(t, candidateLangs))
    );

    const scored = candidates.map((track) => {
      let score = 0;
      if (track.composer && ref.composer && eq(track.composer, ref.composer)) {
        score += 40;
      }
      if (track.language && ref.language && eq(track.language, ref.language)) {
        score += 25;
      }
      if (track.movieName && ref.movieName && eq(track.movieName, ref.movieName)) {
        score += 30;
      }
      return { track, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.track);
  }

  /**
   * Generates continuous automatic queue recommendations prioritized by:
   * 1. Songs related to currently playing song (soundtrack/movie)
   * 2. Songs from the same artist / lead singers
   * 3. Songs from the same music director / composer
   * 4. Songs matching the language
   * 5. Songs matching the user's listening history and taste profile
   * With diversity balancing to include songs from different artists and strict exclusion of already-played song IDs.
   */
  static getAutoQueueRecommendations(
    userId: string,
    options: {
      songId?: string;
      songTitle?: string;
      artist?: string;
      director?: string;
      language?: string;
      languages?: string[];
      genre?: string;
      mood?: string;
      excludeIds?: string[];
      limit?: number;
    }
  ): UnifiedTrack[] {
    const catalog = this.getMasterCatalog();
    const limit = options.limit !== undefined ? Math.max(1, Math.min(options.limit, 30)) : 20;
    const excludeSet = new Set<string>((options.excludeIds || []).map((id) => id.trim()));
    if (options.songId) excludeSet.add(options.songId.trim());

    // Exclude disliked, hidden, and not-interested items
    const feedbacks = syncStore.getUserFeedback(userId);
    feedbacks.forEach((f) => {
      if (f.feedbackType === 'HIDE' || f.feedbackType === 'DISLIKE' || f.feedbackType === 'NOT_INTERESTED') {
        excludeSet.add(f.targetId);
      }
    });

    // Helper for case-insensitive partial token matching
    const matchesAny = (candidateValue?: string, targetValue?: string): boolean => {
      if (!candidateValue || !targetValue) return false;
      const c = candidateValue.toLowerCase().trim();
      const t = targetValue.toLowerCase().trim();
      return c === t || c.includes(t) || t.includes(c);
    };

    // 1. Locate reference song if exists in catalog or search by title & artist
    let ref = options.songId ? catalog.find((t) => t.id === options.songId) : null;
    if (!ref && options.songTitle) {
      ref =
        catalog.find(
          (t) =>
            eq(t.title, options.songTitle!) &&
            (!options.artist || eq(t.artist, options.artist) || matchesAny(t.artist, options.artist))
        ) ||
        catalog.find((t) => matchesAny(t.title, options.songTitle!)) ||
        null;
    }

    // Infer artist / director profile from ARTISTS_CATALOG if available
    const artistInCatalog = options.artist
      ? ARTISTS_CATALOG.find((a) => matchesAny(a.name, options.artist))
      : undefined;

    const targetLang = (
      options.language ||
      ref?.language ||
      artistInCatalog?.languages?.[0] ||
      ''
    ).trim().toLowerCase();

    const targetComposer = (
      options.director ||
      ref?.composer ||
      (artistInCatalog?.role === 'DIRECTOR' ? artistInCatalog.name : '') ||
      ''
    ).trim().toLowerCase();

    const targetArtist = (
      options.artist ||
      ref?.artist ||
      (artistInCatalog?.role === 'SINGER' ? artistInCatalog.name : '') ||
      ''
    ).trim().toLowerCase();

    const targetMovie = (ref?.movieName || '').trim().toLowerCase();
    const targetGenre = (options.genre || ref?.genre || '').trim().toLowerCase();
    const targetMood = (options.mood || ref?.mood || '').trim().toLowerCase();

    // 2. Fetch user preferences & listening history
    const preferences = syncStore.getUserPreferences(userId);
    let userLangs = normalizeLanguageList(
      options.languages && options.languages.length > 0
        ? options.languages
        : preferences.preferredLanguages
    );

    const isGuest = !userId || userId === 'guest_user';

    if (userLangs.length === 0) {
      if (options.language) {
        userLangs = normalizeLanguageList([options.language]);
      } else if (ref?.language) {
        userLangs = normalizeLanguageList([ref.language]);
      } else if (artistInCatalog?.languages && artistInCatalog.languages.length > 0) {
        userLangs = normalizeLanguageList(artistInCatalog.languages);
      } else {
        const combinedQuery = `${options.songTitle || ''} ${options.artist || ''} ${options.genre || ''} ${options.director || ''}`;
        const detected = IndianCinemaHelper.detectLanguage(combinedQuery);
        if (detected && detected !== 'Other') {
          userLangs = [detected];
        } else if (userId && userId.toLowerCase().includes('tamil')) {
          userLangs = ['Tamil'];
        } else if (userId && userId.toLowerCase().includes('hindi')) {
          userLangs = ['Hindi'];
        } else if (userId && userId.toLowerCase().includes('telugu')) {
          userLangs = ['Telugu'];
        } else if (!isGuest) {
          // Authenticated registered user with no selected languages -> require onboarding prompt, do not leak cross-language tracks
          return [];
        } else {
          // Safe fallback for unclassified guest playback: supply tracks from available catalog languages so music never stops
          userLangs = ['English', 'Tamil', 'Hindi', 'Telugu'];
        }
      }
    }

    if (userLangs.length === 0) {
      if (!isGuest) return [];
      userLangs = ['English', 'Tamil', 'Hindi', 'Telugu'];
    }

    const normTargetLang = normalizeLanguageToken(
      options.language || ref?.language || artistInCatalog?.languages?.[0]
    );

    const userSongStats = syncStore.getUserSongStats(userId);
    const favouriteComposers = new Set(
      (preferences.favouriteComposers || []).map((c) => c.toLowerCase().trim())
    );
    const favouriteSingers = new Set(
      (preferences.favouriteSingers || []).map((s) => s.toLowerCase().trim())
    );
    const favouriteArtists = new Set(
      (preferences.favouriteArtists || []).map((a) => a.toLowerCase().trim())
    );

    // 3. Filter candidates strictly by user's selected languages AND excludeSet.
    // Songs without valid language metadata or outside user's selected languages are strictly excluded!
    const eligibleTracks = catalog.filter((t) => {
      if (excludeSet.has(t.id)) return false;
      return isSongLanguageEligible(t, userLangs);
    });

    if (eligibleTracks.length === 0) {
      console.log(
        `[RecommendationEngine] No eligible songs available in user's selected languages (${userLangs.join(', ')}). Returning empty auto-queue.`
      );
      return [];
    }

    // If targetLang is among user's eligible languages, prioritize tracks matching targetLang
    let candidates = eligibleTracks;
    if (normTargetLang && userLangs.includes(normTargetLang)) {
      const targetLangTracks = eligibleTracks.filter((t) => normalizeLanguageToken(t.language) === normTargetLang);
      if (targetLangTracks.length >= limit) {
        candidates = targetLangTracks;
      } else {
        const otherTracks = eligibleTracks.filter((t) => normalizeLanguageToken(t.language) !== normTargetLang);
        candidates = [...targetLangTracks, ...otherTracks];
      }
    }

    console.log(
      `[RecommendationEngine] Auto-queue generation started for "${options.songTitle || options.songId || 'unknown'}" by "${options.artist || 'Unknown'}" (Target Lang: "${normTargetLang || 'any'}", Composer: "${targetComposer || 'any'}")`
    );
    console.log(
      `[RecommendationEngine] Total candidates available: ${candidates.length}, Excluded IDs: ${excludeSet.size}`
    );

    // 4. Score candidates strictly according to Recommendation Priority:
    // 1. Songs by the same artist / singers
    // 2. Songs by the same music director / composer
    // 3. Songs from the same language
    // 4. Songs from the same movie or album
    // 5. Songs with similar genres and moods
    // 6. User taste profile and listening history (replays/favorites boosted, skips penalized)
    const scored = candidates.map((track) => {
      let score = 0;
      const trackLang = (track.language || '').toLowerCase().trim();
      const trackComposer = (track.composer || '').toLowerCase().trim();
      const trackArtist = (track.artist || '').toLowerCase().trim();
      const trackMovie = (track.movieName || '').toLowerCase().trim();
      const trackGenre = (track.genre || '').toLowerCase().trim();
      const trackMood = (track.mood || '').toLowerCase().trim();

      // Priority 1: Songs by the same artist (singers / performers)
      if (targetArtist && trackArtist && matchesAny(trackArtist, targetArtist)) {
        score += 70;
      } else if (
        ref?.singers &&
        track.singers &&
        ref.singers.some((s1) => track.singers?.some((s2) => matchesAny(s1, s2)))
      ) {
        score += 60;
      }

      // Priority 2: Songs by the same music director / composer
      if (targetComposer && trackComposer && matchesAny(trackComposer, targetComposer)) {
        score += 50;
      }

      // Priority 3: Songs from the same language
      if (normTargetLang && userLangs.includes(normTargetLang)) {
        if (normalizeLanguageToken(track.language) === normTargetLang) {
          score += 40;
        } else {
          score += 20;
        }
      } else {
        score += 30;
      }

      // Priority 4: Songs from the same movie or album
      if (targetMovie && trackMovie && matchesAny(trackMovie, targetMovie)) {
        score += 35;
      }

      // Priority 5: Similar genres and moods
      if (targetGenre && trackGenre && matchesAny(trackGenre, targetGenre)) {
        score += 20;
      }
      if (targetMood && trackMood && matchesAny(trackMood, targetMood)) {
        score += 15;
      }

      // Priority 6: Listening history and taste profile
      if (trackComposer && favouriteComposers.has(trackComposer)) {
        score += 20;
      }
      if (trackArtist && (favouriteSingers.has(trackArtist) || favouriteArtists.has(trackArtist))) {
        score += 20;
      }

      const stat = userSongStats.find((s) => s.songId === track.id || eq(s.songName, track.title));
      if (stat) {
        if (stat.isFavorite) score += 25;
        if (stat.replayCount > 0) score += Math.min(20, stat.replayCount * 10);
        if (stat.playCount > 0) score += Math.min(15, stat.playCount * 3);
        if (stat.skipCount >= 3) {
          score -= 60; // Strongly penalize repeatedly skipped songs (skip count >= 3)
        } else if (stat.skipCount === 2) {
          score -= 15;
        }
        // Notice: single skip (skipCount === 1) is NOT penalized! A single skip is NOT a dislike.
      }

      return { track, score };
    });

    // 5. Variety and diversity balancing:
    scored.sort((a, b) => b.score - a.score);

    // Enforce artist variety constraint: Max 2 songs per artist in the auto-queue refill
    const maxPerArtist = 2;
    const artistCounts = new Map<string, number>();
    const selected: UnifiedTrack[] = [];

    for (const item of scored) {
      const artKey = item.track.composer || item.track.artist || 'unknown';
      const count = artistCounts.get(artKey) || 0;
      if (count < maxPerArtist) {
        selected.push(item.track);
        artistCounts.set(artKey, count + 1);
        if (selected.length >= limit) break;
      }
    }

    console.log(
      `[RecommendationEngine] Filtered ${excludeSet.size} excluded/played tracks. Returning ${selected.length} auto-queue tracks.`
    );

    return selected;
  }

  /**
   * Generates intelligent music discovery categories with support for exploratory language filtering
   * without mutating the authenticated user's saved preferences profile.
   */
  static async getDiscoverFeed(
    userId: string,
    languageOverride?: string
  ): Promise<DiscoverFeedResponse> {
    const preferences: UserMusicPreference = syncStore.getUserPreferences(userId);
    const targetLanguages = normalizeLanguageList(
      languageOverride && languageOverride !== 'ALL'
        ? [languageOverride]
        : preferences.preferredLanguages && preferences.preferredLanguages.length > 0
        ? preferences.preferredLanguages
        : []
    );

    if (targetLanguages.length === 0) {
      return {
        preferredLanguages: [],
        selectedLanguages: [],
        recommendedArtists: [],
        similarArtists: [],
        popularSongs: [],
        trendingMusic: [],
        newReleases: [],
        moodCategories: [],
        genreCategories: [],
        musicDirectorCollections: []
      };
    }

    const masterCatalog = this.getMasterCatalog();
    const availableTracks = masterCatalog.filter(
      (t) =>
        isSongLanguageEligible(t, targetLanguages) &&
        Boolean(t.videoId || t.fullAudioUrl || t.previewUrl || t.isPlayableDirectly)
    );

    // 1. Recommended Artists & Similar Artists
    const artistsInLang = queryArtistsCatalog({ languages: targetLanguages });
    const recommendedArtists = (
      await Promise.all(
        artistsInLang.slice(0, 8).map((a) => this.getArtistDetailByName(userId, a.name))
      )
    ).filter((a): a is ArtistRecommendationCard => a !== null);

    const similarArtists = (
      await Promise.all(
        artistsInLang.slice(8, 16).map((a) => this.getArtistDetailByName(userId, a.name))
      )
    ).filter((a): a is ArtistRecommendationCard => a !== null);

    // 2. Popular Songs
    const popularSongs = availableTracks.slice().sort((a, b) => (b.releaseYear || 2020) - (a.releaseYear || 2020)).slice(0, 16);

    // 3. Trending Music
    const trendingMusic = availableTracks.filter((t) => (t.releaseYear || 2020) >= 2021).slice(0, 16);

    // 4. New Releases
    const newReleases = availableTracks.filter((t) => (t.releaseYear || 2020) >= 2022).slice(0, 16);

    // 5. Mood Categories
    const moodCategories = ALL_12_MOOD_SPECS.map((spec) => {
      const tracks = availableTracks.filter(
        (t) => spec.preferredTitles.some((pt) => eq(pt, t.title)) || spec.keywords.test(t.title)
      );
      return {
        id: spec.id,
        mood: spec.mood,
        title: spec.title,
        description: spec.description,
        artworkUrl: spec.artworkUrl,
        accentColor: spec.accentColor,
        trackCount: tracks.length,
        tracks: tracks.slice(0, 10)
      };
    });

    // 6. Genre Categories
    const genres = ['Melody', 'EDM', 'Pop', 'Folk', 'Devotional', 'Soundtrack'];
    const genreCategories = genres.map((g) => {
      const tracks = availableTracks.filter((t) => eq(t.genre, g));
      return {
        id: `genre_${g.toLowerCase()}`,
        name: `${g} Hits`,
        trackCount: tracks.length,
        tracks: tracks.slice(0, 10)
      };
    }).filter((gc) => gc.tracks.length > 0);

    // 7. Music Director Collections
    const directorNames = Array.from(new Set(availableTracks.map((t) => t.composer).filter(Boolean))).slice(0, 8);
    const musicDirectorCollections = directorNames.map((dir) => ({
      director: dir!,
      tracks: availableTracks.filter((t) => eq(t.composer, dir)).slice(0, 10)
    })).filter((c) => c.tracks.length > 0);

    return {
      preferredLanguages: targetLanguages,
      recommendedArtists,
      similarArtists,
      popularSongs,
      trendingMusic,
      newReleases,
      moodCategories,
      genreCategories,
      musicDirectorCollections
    };
  }

  /**
   * Computes listener profile stats (Favourite Artist, Most Listened Artist, Most Rewatched Songs)
   * using Supabase-backed history when configured and taste preferences.
   */
  static async getProfileStats(userId: string): Promise<ProfileStatsResponse> {
    const preferences = syncStore.getUserPreferences(userId);
    const catalog = this.getMasterCatalog();

    // Helper lookup map for artist portraits and metadata
    const findArtistProfile = (rawName: string): ArtistItem | undefined => {
      const target = rawName.trim().toLowerCase();
      return ARTISTS_CATALOG.find(
        (a) =>
          a.name.toLowerCase() === target ||
          a.name.toLowerCase().includes(target) ||
          target.includes(a.name.toLowerCase())
      );
    };

    // Helper lookup for director/composer profile specifically (ensuring role === 'DIRECTOR')
    const findDirectorProfile = (rawName: string): ArtistItem | undefined => {
      if (!rawName) return undefined;
      const target = rawName.trim().toLowerCase();
      return ARTISTS_CATALOG.find(
        (a) =>
          a.role === 'DIRECTOR' &&
          (a.name.toLowerCase() === target ||
            a.name.toLowerCase().includes(target) ||
            target.includes(a.name.toLowerCase()))
      );
    };

    const favouriteArtistNames = Array.from(
      new Set([
        ...(preferences.favouriteComposers || []),
        ...(preferences.favouriteSingers || []),
        ...(preferences.favouriteArtists || [])
      ])
    ).filter(Boolean);

    const favouriteArtists = favouriteArtistNames.map((name) => {
      const prof = findArtistProfile(name);
      return {
        name: prof?.name || name,
        roleTitle: prof?.roleTitle || 'Artist',
        imageUrl: prof?.imageUrl
      };
    });

    // Fetch history from Supabase with resilient fallback to local store
    const { history: playHistory, source: historySource } =
      await SupabaseHistoryService.getUserPlayHistory(userId, 500);
    const listeningEvents = await SupabaseHistoryService.getUserListeningEvents(userId, 500);
    const memoryStats = syncStore.getUserSongStats(userId);

    const artistMap = new Map<
      string,
      {
        name: string;
        roleTitle?: string;
        imageUrl?: string;
        playCount: number;
        replayCount: number;
        totalDurationMs: number;
        songKeys: Set<string>;
      }
    >();

    const directorMap = new Map<
      string,
      {
        name: string;
        roleTitle: string;
        imageUrl?: string;
        playCount: number;
        replayCount: number;
        totalDurationMs: number;
        uniqueSongs: Set<string>;
      }
    >();

    const songMap = new Map<
      string,
      {
        songId: string;
        title: string;
        artist: string;
        composer?: string;
        language?: string;
        artworkUrl: string;
        videoId?: string;
        playCount: number;
        replayCount: number;
        totalDurationMs: number;
        lastPlayedAt: string;
      }
    >();

    const findTrackArt = (songId: string, title: string): { artworkUrl: string; videoId?: string } => {
      const cat = catalog.find(
        (t) => t.id === songId || t.title.toLowerCase() === title.toLowerCase()
      );
      const vid =
        cat?.videoId ||
        KNOWN_TRACK_VIDEO_MAP[title] ||
        (songId.startsWith('yt_') ? songId.replace('yt_', '') : undefined);
      const artworkUrl =
        cat?.artworkUrl ||
        (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : 'https://i.ytimg.com/vi/FzLpP8VBC6E/hqdefault.jpg');
      return { artworkUrl, videoId: vid };
    };

    const accumulateArtist = (
      artistName: string,
      songKey: string,
      plays: number,
      replays: number,
      durationMs: number
    ) => {
      const clean = (artistName || 'Unknown Artist').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      const prof = findArtistProfile(clean);
      const existing = artistMap.get(key) || {
        name: prof?.name || clean,
        roleTitle: prof?.roleTitle,
        imageUrl: prof?.imageUrl,
        playCount: 0,
        replayCount: 0,
        totalDurationMs: 0,
        songKeys: new Set<string>()
      };
      existing.playCount += plays;
      existing.replayCount += replays;
      existing.totalDurationMs += durationMs;
      existing.songKeys.add(songKey);
      artistMap.set(key, existing);
    };

    const accumulateDirector = (
      rawComposer: string | undefined,
      songKey: string,
      plays: number,
      durationMs: number
    ) => {
      if (!rawComposer) return;
      const clean = rawComposer.trim();
      if (!clean) return;
      const prof = findDirectorProfile(clean);
      // Only record as director if identified as a director/composer (never singers)
      const directorName = prof?.name || clean;
      const key = directorName.toLowerCase();

      const existing = directorMap.get(key) || {
        name: directorName,
        roleTitle: 'Music Director',
        imageUrl: prof?.imageUrl,
        playCount: 0,
        replayCount: 0,
        totalDurationMs: 0,
        uniqueSongs: new Set<string>()
      };
      existing.playCount += plays;
      existing.totalDurationMs += durationMs;
      existing.uniqueSongs.add(songKey);
      directorMap.set(key, existing);
    };

    // Ingest all play history records
    for (const h of playHistory) {
      const songKey = (h.songTitle || h.songId).toLowerCase();
      const existingSong = songMap.get(songKey);
      const art = findTrackArt(h.songId, h.songTitle);
      const catTrack = catalog.find((t) => t.id === h.songId || eq(t.title, h.songTitle));
      const composer = h.musicDirector || catTrack?.composer || (catTrack as any)?.director || '';
      const language = h.language || catTrack?.language || 'Tamil';
      const durationMs = h.durationListenedMs > 0 ? h.durationListenedMs : (catTrack?.durationMs || 210000);

      if (existingSong) {
        existingSong.playCount += 1;
        existingSong.totalDurationMs += durationMs;
        if (!existingSong.composer && composer) existingSong.composer = composer;
        if (!existingSong.language && language) existingSong.language = language;
        if (h.playedAt > existingSong.lastPlayedAt) {
          existingSong.lastPlayedAt = h.playedAt;
        }
      } else {
        songMap.set(songKey, {
          songId: h.songId,
          title: h.songTitle,
          artist: h.artistName,
          composer,
          language,
          artworkUrl: art.artworkUrl,
          videoId: art.videoId,
          playCount: 1,
          replayCount: 0,
          totalDurationMs: durationMs,
          lastPlayedAt: h.playedAt
        });
      }

      accumulateArtist(h.artistName, songKey, 1, 0, durationMs);
      accumulateDirector(composer, songKey, 1, durationMs);
    }

    // Ingest in-memory and offline session stats
    for (const st of memoryStats) {
      const songKey = (st.songName || st.songId).toLowerCase();
      const existing = songMap.get(songKey);
      const catTrack = catalog.find((t) => t.id === st.songId || eq(t.title, st.songName));
      const composer = st.musicDirector || catTrack?.composer || '';
      const language = st.language || catTrack?.language || 'Tamil';
      const durationMs = st.totalListeningDurationMs > 0 ? st.totalListeningDurationMs : (catTrack?.durationMs || 210000);
      const artistName = st.singers?.[0] || st.musicDirector || 'Unknown Artist';

      if (existing) {
        existing.playCount = Math.max(existing.playCount, st.playCount);
        existing.replayCount = Math.max(existing.replayCount, st.replayCount);
        existing.totalDurationMs = Math.max(existing.totalDurationMs, durationMs);
        if (!existing.composer && composer) existing.composer = composer;
        if (!existing.language && language) existing.language = language;
      } else {
        const art = findTrackArt(st.songId, st.songName);
        songMap.set(songKey, {
          songId: st.songId,
          title: st.songName,
          artist: artistName,
          composer,
          language,
          artworkUrl: art.artworkUrl,
          videoId: art.videoId,
          playCount: Math.max(1, st.playCount),
          replayCount: st.replayCount,
          totalDurationMs: durationMs,
          lastPlayedAt: st.lastPlayedAt || new Date().toISOString()
        });

        accumulateArtist(artistName, songKey, Math.max(1, st.playCount), st.replayCount, durationMs);
        accumulateDirector(composer, songKey, Math.max(1, st.playCount), durationMs);
      }
    }

    // Ingest listening events (Replays)
    for (const ev of listeningEvents) {
      if (ev.eventType === 'REPLAY') {
        const songKey = (ev.songTitle || ev.songId).toLowerCase();
        const s = songMap.get(songKey);
        if (s) {
          s.replayCount += 1;
        }
        const a = artistMap.get((ev.artistName || 'Unknown Artist').trim().toLowerCase());
        if (a) {
          a.replayCount += 1;
        }
      }
    }

    // Top Listened Artists calculation (Requirement 4: rankings, total plays, percentage)
    const totalArtistPlays = Array.from(artistMap.values()).reduce(
      (sum, a) => sum + a.playCount,
      0
    ) || 1;

    const topListenedArtists: ProfileArtistStat[] = Array.from(artistMap.values())
      .map((a) => ({
        name: a.name,
        roleTitle: a.roleTitle || 'Artist',
        imageUrl: a.imageUrl,
        playCount: a.playCount,
        replayCount: a.replayCount,
        totalDurationMs: a.totalDurationMs,
        uniqueSongsCount: a.songKeys.size,
        percentage: Math.min(100, Math.round((a.playCount / totalArtistPlays) * 100))
      }))
      .sort((a, b) => b.playCount - a.playCount || b.totalDurationMs - a.totalDurationMs);

    // Top Music Directors (Requirement 6: Rank by plays, unique songs, images, never confuse singers)
    const topListenedDirectors = Array.from(directorMap.values())
      .map((d) => ({
        name: d.name,
        roleTitle: 'Music Director',
        imageUrl: d.imageUrl,
        playCount: d.playCount,
        replayCount: d.replayCount,
        totalDurationMs: d.totalDurationMs,
        uniqueSongsCount: d.uniqueSongs.size
      }))
      .sort((a, b) => b.playCount - a.playCount || b.totalDurationMs - a.totalDurationMs);

    // Favourite Artist (Requirement 3 & 10):
    // 1. If user set favourite artists in onboarding/settings preferences, pick the top played among them,
    //    or default to their primary selected favourite artist (updating immediately on settings edit).
    // 2. If preferences are empty, dynamically determine favourite artist from top listened history.
    let favouriteArtist: { name: string; roleTitle: string; imageUrl?: string } | null = null;
    if (favouriteArtists.length > 0) {
      const preferredWithPlays = favouriteArtists
        .map((fav) => {
          const played = topListenedArtists.find((a) => a.name.toLowerCase() === fav.name.toLowerCase());
          return { fav, plays: played?.playCount || 0 };
        })
        .sort((a, b) => b.plays - a.plays);

      favouriteArtist = preferredWithPlays[0]?.fav || favouriteArtists[0] || null;
    } else if (topListenedArtists.length > 0) {
      const topArt = topListenedArtists[0];
      favouriteArtist = {
        name: topArt.name,
        roleTitle: topArt.roleTitle || 'Artist',
        imageUrl: topArt.imageUrl
      };
    }

    // Most Rewatched Songs (Requirement 5: Only songs played > 1 time, sorted by plays)
    const mostRewatchedSongs: ProfileSongRewatchStat[] = Array.from(songMap.values())
      .filter((s) => s.playCount > 1 || s.replayCount > 0)
      .map((s) => ({
        songId: s.songId,
        title: s.title,
        artist: s.artist,
        artworkUrl: s.artworkUrl,
        videoId: s.videoId,
        playCount: s.playCount,
        rewatchCount: Math.max(s.replayCount, Math.max(0, s.playCount - 1)),
        lastPlayedAt: s.lastPlayedAt
      }))
      .sort((a, b) => b.playCount - a.playCount || b.rewatchCount - a.rewatchCount);

    const mostPlayedSongs: ProfileSongRewatchStat[] = Array.from(songMap.values())
      .map((s) => ({
        songId: s.songId,
        title: s.title,
        artist: s.artist,
        artworkUrl: s.artworkUrl,
        videoId: s.videoId,
        playCount: s.playCount,
        rewatchCount: Math.max(s.replayCount, Math.max(0, s.playCount - 1)),
        lastPlayedAt: s.lastPlayedAt
      }))
      .sort((a, b) => b.playCount - a.playCount || b.rewatchCount - a.rewatchCount);

    // Language Breakdown (Requirement 7: Language, number of plays, percentage, progress bar)
    const langMap = new Map<string, { plays: number; songsCount: number; durationMs: number }>();
    for (const s of songMap.values()) {
      const catTrack = catalog.find((t) => t.id === s.songId || eq(t.title, s.title));
      const lang = s.language || catTrack?.language || 'Tamil';
      const existing = langMap.get(lang) || { plays: 0, songsCount: 0, durationMs: 0 };
      existing.plays += s.playCount;
      existing.songsCount += 1;
      existing.durationMs += s.totalDurationMs;
      langMap.set(lang, existing);
    }
    const totalLangPlays = Array.from(langMap.values()).reduce((sum, l) => sum + l.plays, 0) || 1;
    const languageBreakdown = Array.from(langMap.entries())
      .map(([language, data]) => ({
        language,
        count: data.plays, // Number of plays (for Web & Mobile UI)
        songsCount: data.songsCount,
        durationMs: data.durationMs,
        percentage: Math.min(100, Math.round((data.plays / totalLangPlays) * 100))
      }))
      .sort((a, b) => b.count - a.count);

    // Daily Activity (Last 7 Days) (Requirement 8: Last 7 calendar days, day labels, play counts)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyActivity = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayNum}`;
      const dayName = dayNames[d.getDay()];

      const dayHistory = playHistory.filter((h) => {
        const hDate = new Date(h.playedAt);
        const hYear = hDate.getFullYear();
        const hMonth = String(hDate.getMonth() + 1).padStart(2, '0');
        const hDayNum = String(hDate.getDate()).padStart(2, '0');
        return `${hYear}-${hMonth}-${hDayNum}` === dateStr;
      });

      const dayPlays = dayHistory.length;
      const dayMinutes = Math.round(
        dayHistory.reduce((sum, h) => sum + (h.durationListenedMs > 0 ? h.durationListenedMs : 210000), 0) / 60000
      );

      return {
        date: dateStr,
        day: dayName,
        dayName,
        plays: dayPlays,
        durationMinutes: dayMinutes,
        minutes: dayMinutes
      };
    });

    // Weekly activity (Past 4 weeks)
    const nowMs = Date.now();
    const weeklyActivity = Array.from({ length: 4 }).map((_, idx) => {
      const startDays = (4 - idx) * 7;
      const endDays = (3 - idx) * 7;
      const weekHistory = playHistory.filter((h) => {
        const diff = nowMs - new Date(h.playedAt).getTime();
        return diff >= endDays * 86400000 && diff < startDays * 86400000;
      });
      const weekMinutes = Math.round(
        weekHistory.reduce((sum, h) => sum + (h.durationListenedMs > 0 ? h.durationListenedMs : 210000), 0) / 60000
      );
      return { week: `Week ${idx + 1}`, plays: weekHistory.length, minutes: weekMinutes, durationMinutes: weekMinutes };
    });

    // Recently played UnifiedTracks
    const recentlyPlayedTracks = playHistory.slice(0, 10).map((h) => {
      const cat = catalog.find((t) => t.id === h.songId || eq(t.title, h.songTitle));
      const art = findTrackArt(h.songId, h.songTitle);
      return (
        cat || {
          id: h.songId,
          title: h.songTitle,
          artist: h.artistName,
          durationMs: h.durationListenedMs || 240000,
          artworkUrl: art.artworkUrl,
          videoId: art.videoId,
          sourcePlatform: 'YOUTUBE' as const,
          sourceUrl: `https://www.youtube.com/watch?v=${art.videoId || ''}`,
          versionType: 'ORIGINAL' as const,
          isPlayableDirectly: true
        }
      );
    });

    // Dashboard Statistics (Requirement 2)
    const totalPlays = Math.max(
      playHistory.length,
      Array.from(songMap.values()).reduce((sum, s) => sum + s.playCount, 0)
    );
    const totalRewatches = Array.from(songMap.values()).filter((s) => s.playCount > 1).length;
    const totalDurationMs = Array.from(songMap.values()).reduce(
      (sum, s) => sum + s.totalDurationMs,
      0
    );
    const totalListeningMinutes = Math.round(totalDurationMs / 60000);
    const totalListeningHours = Math.round((totalDurationMs / 3600000) * 10) / 10;
    const hoursPart = Math.floor(totalListeningMinutes / 60);
    const minutesPart = totalListeningMinutes % 60;
    const formattedListeningTime =
      hoursPart > 0 ? `${hoursPart}h ${minutesPart}m` : `${minutesPart}m`;

    return {
      favouriteArtist,
      favouriteArtists,
      mostListenedArtist: topListenedArtists[0] || null,
      topListenedArtists: topListenedArtists.slice(0, 8),
      topListenedDirectors: topListenedDirectors.slice(0, 6),
      mostRewatchedSongs: mostRewatchedSongs.slice(0, 10),
      mostPlayedSongs: mostPlayedSongs.slice(0, 10),
      languageBreakdown,
      dailyActivity,
      weeklyActivity,
      recentlyPlayed: recentlyPlayedTracks,
      totalListeningHours,
      formattedListeningTime,
      summary: {
        totalPlays,
        totalRewatches,
        totalListeningMinutes,
        totalListeningHours,
        formattedListeningTime,
        uniqueSongsPlayed: songMap.size,
        uniqueArtistsListened: artistMap.size,
        preferredLanguages: preferences.preferredLanguages || [],
        historySource: historySource as any
      }
    };
  }

  /**
   * Seeds the entire 99-track master catalog into the in-memory syncStore
   * so songs are available for general querying, playlists, and base catalogue feeds.
   */
  public static seedMasterCatalogIntoStore(): void {
    const catalog = this.getMasterCatalog();
    const storeTracks: SongMetadata[] = catalog.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.singers && t.singers.length > 0 ? t.singers.join(', ') : (t.artist || 'Unknown Artist'),
      album: t.movieName || t.album || 'Soundtrack',
      durationMs: t.durationMs || 240000,
      artworkUrl: t.artworkUrl,
      source: (t.sourcePlatform === 'YOUTUBE' ? 'YOUTUBE' : t.sourcePlatform === 'SPOTIFY' ? 'SPOTIFY' : 'LOCAL') as any,
      externalUrl: t.sourceUrl || '',
      language: t.language,
      languages: t.language ? [t.language] : [],
      composer: t.composer,
      movieName: t.movieName,
      movie: t.movieName,
      mood: t.mood,
      genre: t.genre,
      singers: t.singers,
      videoId: t.videoId,
      fullAudioUrl: t.fullAudioUrl,
      previewUrl: t.previewUrl,
      isPlayableDirectly: t.isPlayableDirectly,
      releaseYear: t.releaseYear,
      createdAt: new Date().toISOString()
    }));
    syncStore.seedCatalogTracks(storeTracks);
  }
}

// Auto-seed catalog on service initialization
RecommendationEngineService.seedMasterCatalogIntoStore();

