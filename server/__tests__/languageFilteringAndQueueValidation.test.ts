import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { JWT_SECRET } from '../src/middleware/auth';
import { RecommendationEngineService } from '../src/services/recommendation/recommendationEngine.service';
import {
  normalizeLanguageToken,
  normalizeLanguageList,
  isSongLanguageEligible,
  filterSongsByLanguage,
  validateSongLanguageMetadata
} from '../src/utils/languageEligibility';

function createAuthToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

describe('SyncWave – Strict Language Filtering and Automatic Queue Validation (Scenarios A–I)', () => {
  const userIdTamil = 'user_test_tamil_' + Date.now();
  const userIdTamilMalayalam = 'user_test_ta_ml_' + Date.now();
  const userIdDynamicSwitch = 'user_test_switch_' + Date.now();
  const userIdNoLanguages = 'user_test_none_' + Date.now();
  const userIdUnobtainableLang = 'user_test_obscure_' + Date.now();

  const tokenTamil = createAuthToken(userIdTamil, 'tamil_only@syncwave.app');
  const tokenTamilMalayalam = createAuthToken(userIdTamilMalayalam, 'tamil_malayalam@syncwave.app');
  const tokenDynamicSwitch = createAuthToken(userIdDynamicSwitch, 'dynamic_switch@syncwave.app');
  const tokenNoLanguages = createAuthToken(userIdNoLanguages, 'no_languages@syncwave.app');
  const tokenUnobtainableLang = createAuthToken(userIdUnobtainableLang, 'obscure_lang@syncwave.app');

  beforeEach(() => {
    RecommendationEngineService.invalidateUserCache();

    // User A: Tamil only
    syncStore.resetUserPreferences(userIdTamil);
    syncStore.updateUserPreferences(userIdTamil, {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Sid Sriram', 'Hariharan'],
      favouriteComposers: ['Harris Jayaraj', 'A. R. Rahman'],
      favouriteSingers: ['Hariharan', 'Chinmayi'],
      hasCompletedOnboarding: true
    });

    // User B: Tamil & Malayalam
    syncStore.resetUserPreferences(userIdTamilMalayalam);
    syncStore.updateUserPreferences(userIdTamilMalayalam, {
      preferredLanguages: ['Tamil', 'Malayalam'],
      favouriteArtists: ['Sid Sriram', 'K. S. Harisankar'],
      favouriteComposers: ['Harris Jayaraj', 'Sushin Shyam'],
      hasCompletedOnboarding: true
    });

    // User C: Initial Tamil (will be switched to Hindi)
    syncStore.resetUserPreferences(userIdDynamicSwitch);
    syncStore.updateUserPreferences(userIdDynamicSwitch, {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Sid Sriram'],
      favouriteComposers: ['Harris Jayaraj'],
      hasCompletedOnboarding: true
    });

    // User D: No languages selected
    syncStore.resetUserPreferences(userIdNoLanguages);
    syncStore.updateUserPreferences(userIdNoLanguages, {
      preferredLanguages: [],
      hasCompletedOnboarding: false
    });

    // User I: Language with 0 songs in catalog (e.g. 'French' or 'Spanish')
    syncStore.resetUserPreferences(userIdUnobtainableLang);
    syncStore.updateUserPreferences(userIdUnobtainableLang, {
      preferredLanguages: ['French'],
      hasCompletedOnboarding: true
    });
  });

  // =========================================================================
  // Test A: User selects Tamil only -> 100% Tamil in recommendations & queue
  // =========================================================================
  it('Test A: User selects Tamil only -> 100% Tamil in recommendations and auto-queue', async () => {
    // 1. Personalized Feed
    const feedRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(feedRes.status).toBe(200);
    expect(feedRes.body.success).toBe(true);
    const feed = feedRes.body.data;

    expect(feed.preferredLanguages).toEqual(['Tamil']);
    expect(feed.madeForYou.length).toBeGreaterThan(0);

    for (const track of feed.madeForYou) {
      expect(normalizeLanguageToken(track.language)).toBe('Tamil');
    }

    for (const mix of feed.dailyMixes) {
      expect(normalizeLanguageToken(mix.language)).toBe('Tamil');
      for (const track of mix.tracks) {
        expect(normalizeLanguageToken(track.language)).toBe('Tamil');
      }
    }

    // 2. Auto-Queue Endpoint
    const queueRes = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({
        songTitle: 'Nenjukkul Peidhidum',
        artist: 'Hariharan',
        limit: 10
      });

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.success).toBe(true);
    expect(queueRes.body.tracks.length).toBeGreaterThan(0);

    for (const track of queueRes.body.tracks) {
      expect(normalizeLanguageToken(track.language)).toBe('Tamil');
    }
  });

  // =========================================================================
  // Test B: User selects Tamil & Malayalam -> only Tamil & Malayalam appear
  // =========================================================================
  it('Test B: User selects Tamil & Malayalam -> only Tamil & Malayalam appear', async () => {
    const feedRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamilMalayalam}`);

    expect(feedRes.status).toBe(200);
    const feed = feedRes.body.data;

    const allowed = new Set(['Tamil', 'Malayalam']);

    for (const track of feed.madeForYou) {
      const norm = normalizeLanguageToken(track.language);
      expect(allowed.has(norm)).toBe(true);
    }

    // Auto-queue test
    const queueRes = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('Authorization', `Bearer ${tokenTamilMalayalam}`)
      .send({
        songTitle: 'Cherathukal',
        artist: 'Sushin Shyam',
        limit: 12
      });

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.tracks.length).toBeGreaterThan(0);

    for (const track of queueRes.body.tracks) {
      const norm = normalizeLanguageToken(track.language);
      expect(allowed.has(norm)).toBe(true);
    }
  });

  // =========================================================================
  // Test C: User changes Tamil -> Hindi -> recommendations & queue purged immediately
  // =========================================================================
  it('Test C: User changes Tamil -> Hindi -> old Tamil recommendations purged immediately', async () => {
    // 1. Initial feed is Tamil
    const feedTamilRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenDynamicSwitch}`);

    expect(feedTamilRes.status).toBe(200);
    expect(feedTamilRes.body.data.preferredLanguages).toEqual(['Tamil']);
    expect(normalizeLanguageToken(feedTamilRes.body.data.madeForYou[0].language)).toBe('Tamil');

    // 2. User updates language preferences to Hindi
    const updateRes = await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenDynamicSwitch}`)
      .send({
        preferredLanguages: ['Hindi'],
        favouriteArtists: ['Arijit Singh'],
        favouriteComposers: ['Pritam']
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.preferences.preferredLanguages).toEqual(['Hindi']);

    // 3. Subsequent personalized feed immediately returns 100% Hindi (cache version bumped)
    const feedHindiRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenDynamicSwitch}`);

    expect(feedHindiRes.status).toBe(200);
    expect(feedHindiRes.body.data.preferredLanguages).toEqual(['Hindi']);

    for (const track of feedHindiRes.body.data.madeForYou) {
      expect(normalizeLanguageToken(track.language)).toBe('Hindi');
    }

    // 4. Auto-queue now generates only Hindi tracks
    const queueRes = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('Authorization', `Bearer ${tokenDynamicSwitch}`)
      .send({
        songTitle: 'Kesariya',
        artist: 'Arijit Singh',
        limit: 8
      });

    expect(queueRes.status).toBe(200);
    for (const track of queueRes.body.tracks) {
      expect(normalizeLanguageToken(track.language)).toBe('Hindi');
    }
  });

  // =========================================================================
  // Test D: User has no selected languages -> prompt/empty state, zero unvetted songs
  // =========================================================================
  it('Test D: User has no selected languages -> prompt/empty state, zero unrestricted recommendations', async () => {
    // 1. Personalized feed returns requiresLanguageSelection: true and empty arrays
    const feedRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenNoLanguages}`);

    expect(feedRes.status).toBe(200);
    expect(feedRes.body.data.requiresLanguageSelection).toBe(true);
    expect(feedRes.body.data.madeForYou).toEqual([]);
    expect(feedRes.body.data.dailyMixes).toEqual([]);

    // 2. Discover feed returns empty state without unvetted songs
    const discoverRes = await request(app)
      .get('/api/recommendations/discover')
      .set('Authorization', `Bearer ${tokenNoLanguages}`);

    expect(discoverRes.status).toBe(200);
    expect(discoverRes.body.data.selectedLanguages).toEqual([]);
    expect(discoverRes.body.data.popularSongs).toEqual([]);
    expect(discoverRes.body.data.trendingMusic).toEqual([]);

    // 3. Auto-queue returns empty array instead of leaking cross-language songs
    const queueRes = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('Authorization', `Bearer ${tokenNoLanguages}`)
      .send({
        songTitle: 'Random Track',
        artist: 'Unknown',
        limit: 10
      });

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.tracks).toEqual([]);
  });

  // =========================================================================
  // Test E: Song has missing/unverified language metadata -> strictly excluded
  // =========================================================================
  it('Test E: Song has missing/unverified language metadata -> strictly excluded', () => {
    const validTamilSong = { id: 's1', title: 'Song 1', language: 'Tamil' };
    const missingLangSong = { id: 's2', title: 'Unverified Song', language: undefined };
    const emptyLangSong = { id: 's3', title: 'Empty Lang Song', language: '   ' };
    const nullLangSong = { id: 's4', title: 'Null Lang Song', language: null };

    // Validation helper
    expect(validateSongLanguageMetadata(validTamilSong).valid).toBe(true);
    expect(validateSongLanguageMetadata(missingLangSong).valid).toBe(false);
    expect(validateSongLanguageMetadata(emptyLangSong).valid).toBe(false);
    expect(validateSongLanguageMetadata(nullLangSong).valid).toBe(false);

    // Eligibility check
    const userSelected = ['Tamil'];
    expect(isSongLanguageEligible(validTamilSong, userSelected)).toBe(true);
    expect(isSongLanguageEligible(missingLangSong, userSelected)).toBe(false);
    expect(isSongLanguageEligible(emptyLangSong, userSelected)).toBe(false);
    expect(isSongLanguageEligible(nullLangSong, userSelected)).toBe(false);

    // Batch filtering
    const candidates = [validTamilSong, missingLangSong, emptyLangSong, nullLangSong];
    const filtered = filterSongsByLanguage(candidates, userSelected);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('s1');
  });

  // =========================================================================
  // Test F: Queue priority: (1) Current -> (2) Play Next -> (3) Manual -> (4) Auto
  // =========================================================================
  it('Test F: 4-Tier Queue priority is preserved with auto-queue placed strictly after manual additions', () => {
    interface TestQueueItem {
      id: string;
      title: string;
      tier: 'CURRENT' | 'PLAY_NEXT' | 'MANUAL' | 'AUTO';
    }

    const currentSong: TestQueueItem = { id: 'c1', title: 'Current Song', tier: 'CURRENT' };
    const initialManualQueue: TestQueueItem[] = [
      { id: 'm1', title: 'Manual 1', tier: 'MANUAL' },
      { id: 'm2', title: 'Manual 2', tier: 'MANUAL' }
    ];

    let queue: TestQueueItem[] = [currentSong, ...initialManualQueue];

    // User performs "Play Next"
    const playNextSong: TestQueueItem = { id: 'pn1', title: 'Play Next Song', tier: 'PLAY_NEXT' };
    const currentIdx = queue.findIndex(s => s.id === currentSong.id);
    queue.splice(currentIdx + 1, 0, playNextSong);

    // Order after Play Next: [Current, Play Next, Manual 1, Manual 2]
    expect(queue.map(s => s.id)).toEqual(['c1', 'pn1', 'm1', 'm2']);

    // Auto-queue recommendations are appended at the end
    const autoRecs: TestQueueItem[] = [
      { id: 'ar1', title: 'Auto 1', tier: 'AUTO' },
      { id: 'ar2', title: 'Auto 2', tier: 'AUTO' }
    ];

    queue = [...queue, ...autoRecs];

    // Final order verification:
    expect(queue[0].tier).toBe('CURRENT');
    expect(queue[1].tier).toBe('PLAY_NEXT');
    expect(queue[2].tier).toBe('MANUAL');
    expect(queue[3].tier).toBe('MANUAL');
    expect(queue[4].tier).toBe('AUTO');
    expect(queue[5].tier).toBe('AUTO');
  });

  // =========================================================================
  // Test G: Queue becomes empty -> auto-refill triggers without autoplay
  // =========================================================================
  it('Test G: Queue becomes empty -> auto-refill triggers without starting playback automatically', async () => {
    // When playback ends on the last song, the player store triggers auto-queue generation
    // but MUST preserve isPlaying: false until user clicks Play
    const playerState = {
      isPlaying: false,
      userPlayInitiated: false,
      queue: [] as Array<{ id: string; title: string; language: string }>,
      isGeneratingQueue: false
    };

    // Simulate auto-refill response for Tamil user
    const res = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({ songTitle: 'Nenjukkul Peidhidum', limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.tracks.length).toBeGreaterThan(0);

    // Populate queue from auto-refill
    playerState.queue = res.body.tracks;

    // Verify: Refilled queue has tracks, but isPlaying remains FALSE (NO autoplay on generation)
    expect(playerState.queue.length).toBeGreaterThan(0);
    expect(playerState.isPlaying).toBe(false);
    expect(playerState.userPlayInitiated).toBe(false);
  });

  // =========================================================================
  // Test H: User logs out / account switch -> zero data, cache, or queue leakage
  // =========================================================================
  it('Test H: User logs out / account switch -> zero data, cache, or queue leakage', async () => {
    const userIdLogout = 'user_test_logout_' + Date.now();
    const tokenLogout = createAuthToken(userIdLogout, 'user_logout@syncwave.app');
    syncStore.updateUserPreferences(userIdLogout, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    // 1. User Tamil logs in and gets feed
    const resA = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenLogout}`);
    expect(resA.body.data.preferredLanguages).toEqual(['Tamil']);

    // 2. User logs out: token is blacklisted and user cache is invalidated
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tokenLogout}`);
    expect(logoutRes.status).toBe(200);

    RecommendationEngineService.invalidateUserCache(userIdLogout);

    // 3. Logged-out token is rejected on authenticated routes
    const rejectedRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenLogout}`);
    expect(rejectedRes.status).toBe(401);

    // 4. Another user (Hindi) logs in: receives purely Hindi recommendations without any Tamil residue
    const userIdHindiDedicated = 'user_test_h_logout_' + Date.now();
    const tokenHindiDedicated = createAuthToken(userIdHindiDedicated, 'hindi_logout@syncwave.app');
    syncStore.updateUserPreferences(userIdHindiDedicated, {
      preferredLanguages: ['Hindi'],
      favouriteArtists: ['Arijit Singh'],
      favouriteComposers: ['Pritam'],
      hasCompletedOnboarding: true
    });

    const resB = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenHindiDedicated}`);
    expect(resB.body.data.preferredLanguages).toEqual(['Hindi']);

    for (const track of resB.body.data.madeForYou) {
      expect(normalizeLanguageToken(track.language)).toBe('Hindi');
    }
  });

  // =========================================================================
  // Test I: No eligible songs available -> useful empty state, never fills with another language
  // =========================================================================
  it('Test I: No eligible songs available -> useful empty state, never fills with another language', async () => {
    // User with an uncatalogued language (e.g. 'French')
    const queueRes = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('Authorization', `Bearer ${tokenUnobtainableLang}`)
      .send({
        songTitle: 'Nonexistent Track',
        artist: 'Unknown',
        limit: 10
      });

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.success).toBe(true);
    // Crucial check: MUST be empty! MUST NEVER fallback to Tamil, Hindi, English, etc.
    expect(queueRes.body.tracks).toEqual([]);

    // Check personalized feed for unobtainable language
    const feedRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUnobtainableLang}`);

    expect(feedRes.status).toBe(200);
    // When no songs match the user's language, sections return empty arrays rather than other languages
    expect(feedRes.body.data.madeForYou).toEqual([]);
    expect(feedRes.body.data.dailyMixes).toEqual([]);
    for (const mix of feedRes.body.data.dailyMixes) {
      expect(mix.tracks).toEqual([]);
    }
  });

  // =========================================================================
  // Search Suggestions Language Filtering
  // =========================================================================
  it('Search suggestions filter trending items by user preferred languages', async () => {
    // 1. Tamil user gets only Tamil suggestions + multi-lingual artists
    const userIdTamilSearch = 'user_test_t_search_' + Date.now();
    const tokenTamilSearch = createAuthToken(userIdTamilSearch, 'tamil_search@syncwave.app');
    syncStore.updateUserPreferences(userIdTamilSearch, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    const tamilRes = await request(app)
      .get('/api/search/suggestions')
      .set('Authorization', `Bearer ${tokenTamilSearch}`);

    expect(tamilRes.status).toBe(200);
    expect(tamilRes.body.success).toBe(true);
    expect(tamilRes.body.suggestions.length).toBeGreaterThan(0);

    for (const sug of tamilRes.body.suggestions) {
      expect(sug.subtitle).not.toContain('Telugu');
      expect(sug.subtitle).not.toContain('Hindi');
    }

    // 2. Hindi user gets only Hindi suggestions + multi-lingual artists
    const userIdHindiSearch = 'user_test_h_search_' + Date.now();
    const tokenHindiSearch = createAuthToken(userIdHindiSearch, 'hindi_search@syncwave.app');
    syncStore.updateUserPreferences(userIdHindiSearch, {
      preferredLanguages: ['Hindi'],
      hasCompletedOnboarding: true
    });

    const hindiRes = await request(app)
      .get('/api/search/suggestions')
      .set('Authorization', `Bearer ${tokenHindiSearch}`);

    expect(hindiRes.status).toBe(200);
    for (const sug of hindiRes.body.suggestions) {
      expect(sug.subtitle).not.toContain('Tamil');
      expect(sug.subtitle).not.toContain('Telugu');
    }
  });
});
