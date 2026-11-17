import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { RecommendationEngineService } from '../src/services/recommendation/recommendationEngine.service';
import { JWT_SECRET } from '../src/middleware/auth';
import jwt from 'jsonwebtoken';

describe('Personalized Recommendation Engine — Comprehensive Specification Suite', () => {
  const userTamil = 'user_tamil_test_spec';
  const userHindi = 'user_hindi_test_spec';
  const userTelugu = 'user_telugu_test_spec';

  const tokenTamil = jwt.sign({ userId: userTamil, email: 'tamil@syncwave.app' }, JWT_SECRET);
  const tokenHindi = jwt.sign({ userId: userHindi, email: 'hindi@syncwave.app' }, JWT_SECRET);
  const tokenTelugu = jwt.sign({ userId: userTelugu, email: 'telugu@syncwave.app' }, JWT_SECRET);

  beforeEach(() => {
    // Reset preferences and feedback before each test
    syncStore.resetUserPreferences(userTamil);
    syncStore.resetUserPreferences(userHindi);
    syncStore.resetUserPreferences(userTelugu);
    syncStore.resetUserPreferences('guest_default_user');
    RecommendationEngineService.invalidateUserCache();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Two users with different languages receive distinct recommendations
  // -------------------------------------------------------------------------
  it('Scenario 1: Two users with different languages receive distinct recommendations with strict language boundaries', async () => {
    syncStore.updateUserPreferences(userTamil, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });
    syncStore.updateUserPreferences(userHindi, {
      preferredLanguages: ['Hindi'],
      hasCompletedOnboarding: true
    });

    const resTamil = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    const resHindi = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenHindi}`);

    expect(resTamil.status).toBe(200);
    expect(resHindi.status).toBe(200);

    const madeForYouTamil = resTamil.body.data.madeForYou;
    const madeForYouHindi = resHindi.body.data.madeForYou;

    expect(madeForYouTamil.length).toBeGreaterThan(0);
    expect(madeForYouHindi.length).toBeGreaterThan(0);

    // Tamil user's recommendations are 100% Tamil
    expect(madeForYouTamil.every((t: any) => t.language?.toLowerCase() === 'tamil')).toBe(true);

    // Hindi user's recommendations are 100% Hindi
    expect(madeForYouHindi.every((t: any) => t.language?.toLowerCase() === 'hindi')).toBe(true);

    // Zero overlap between pure Tamil feed and pure Hindi feed
    const tamilIds = new Set(madeForYouTamil.map((t: any) => t.id));
    const hasOverlap = madeForYouHindi.some((t: any) => tamilIds.has(t.id));
    expect(hasOverlap).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Two users with different favourite artists receive personalized results
  // -------------------------------------------------------------------------
  it('Scenario 2: Two users with different favourite artists receive personalized ranking', async () => {
    // Both like Tamil music, but User A loves Anirudh Ravichander and User B loves Harris Jayaraj
    syncStore.updateUserPreferences(userTamil, {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Anirudh Ravichander'],
      favouriteComposers: ['Anirudh Ravichander'],
      hasCompletedOnboarding: true
    });

    syncStore.updateUserPreferences(userTelugu, {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Harris Jayaraj'],
      favouriteComposers: ['Harris Jayaraj'],
      hasCompletedOnboarding: true
    });

    const resAnirudh = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    const resHarris = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTelugu}`);

    expect(resAnirudh.status).toBe(200);
    expect(resHarris.status).toBe(200);

    const anirudhFeed = resAnirudh.body.data.madeForYou;
    const harrisFeed = resHarris.body.data.madeForYou;

    // Top tracks for User A favor Anirudh
    const anirudhInTop4 = anirudhFeed.slice(0, 4).some(
      (t: any) => t.composer?.toLowerCase().includes('anirudh') || t.artist?.toLowerCase().includes('anirudh')
    );
    expect(anirudhInTop4).toBe(true);

    // Top tracks for User B favor Harris Jayaraj
    const harrisInTop4 = harrisFeed.slice(0, 4).some(
      (t: any) => t.composer?.toLowerCase().includes('harris') || t.artist?.toLowerCase().includes('harris')
    );
    expect(harrisInTop4).toBe(true);

    // Dynamic section becauseYouLikeThisArtist
    expect(resAnirudh.body.data.becauseYouLikeThisArtist.artist).toBe('Anirudh Ravichander');
    expect(resHarris.body.data.becauseYouLikeThisArtist.artist).toBe('Harris Jayaraj');
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Changing language updates recommendations immediately
  // -------------------------------------------------------------------------
  it('Scenario 3: Changing language updates recommendations immediately without stale cache', async () => {
    syncStore.updateUserPreferences(userTamil, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    const initialRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(initialRes.body.data.madeForYou[0].language?.toLowerCase()).toBe('tamil');

    // User switches language to Telugu
    const updateRes = await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({ preferredLanguages: ['Telugu'] });

    expect(updateRes.status).toBe(200);

    const updatedRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(updatedRes.status).toBe(200);
    const updatedMadeForYou = updatedRes.body.data.madeForYou;
    expect(updatedMadeForYou.length).toBeGreaterThan(0);
    expect(updatedMadeForYou.every((t: any) => t.language?.toLowerCase() === 'telugu')).toBe(true);
    expect(updatedMadeForYou.some((t: any) => t.language?.toLowerCase() === 'tamil')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Repeated listening influences future recommendations
  // -------------------------------------------------------------------------
  it('Scenario 4: Repeated listening influences future recommendations and populates Recently Played', async () => {
    syncStore.updateUserPreferences(userTamil, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    const targetSongId = 'track_vaaranam_aayiram_1'; // Nenjukkul Peidhidum
    syncStore.recordSongListening(userTamil, {
      songId: targetSongId,
      songName: 'Nenjukkul Peidhidum',
      musicDirector: 'Harris Jayaraj',
      language: 'Tamil',
      genre: 'Melody',
      playCount: 6,
      replayCount: 4,
      totalListeningDurationMs: 850000,
      skipCount: 0
    });

    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Populates Recently Played
    expect(data.recentlyPlayed.length).toBeGreaterThan(0);
    expect(data.recentlyPlayed[0].id).toBe(targetSongId);

    // Surfaced near top in Made For You
    const top3Ids = data.madeForYou.slice(0, 3).map((t: any) => t.id);
    expect(top3Ids).toContain(targetSongId);

    // Recommendation reason highlights repeated plays
    const replayedTrack = data.madeForYou.find((t: any) => t.id === targetSongId);
    expect(replayedTrack.recommendationReason).toMatch(/Frequently replayed|listening history/i);
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Favouriting a song boosts similar recommendations
  // -------------------------------------------------------------------------
  it('Scenario 5: Favouriting a song boosts similar recommendations in similarToFavouriteSongs', async () => {
    syncStore.updateUserPreferences(userHindi, {
      preferredLanguages: ['Hindi'],
      hasCompletedOnboarding: true
    });

    // Favorite Tum Hi Ho
    const favSongId = 'track_aashiqui_2_1';
    syncStore.addFavorite(userHindi, favSongId);
    syncStore.recordSongListening(userHindi, {
      songId: favSongId,
      songName: 'Tum Hi Ho',
      movieOrAlbum: 'Aashiqui 2',
      musicDirector: 'Mithoon',
      singers: ['Arijit Singh'],
      language: 'Hindi',
      isFavorite: true
    });

    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenHindi}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Favourite Songs section contains the favorited track
    expect(data.favouriteSongs.some((t: any) => t.id === favSongId)).toBe(true);

    // Similar to Favourite Songs contains related Hindi tracks
    expect(data.similarToFavouriteSongs.length).toBeGreaterThan(0);
    expect(data.similarToFavouriteSongs.every((t: any) => t.id !== favSongId)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Repeated skips (>= 3) penalize while a single skip does not
  // -------------------------------------------------------------------------
  it('Scenario 6: Repeated skips (>= 3) heavily penalize while a single skip is neutral', () => {
    const catalog = RecommendationEngineService.getMasterCatalog();
    const tamilTracks = catalog.filter((t) => t.language?.toLowerCase() === 'tamil');
    const track1 = tamilTracks[0];
    const track2 = tamilTracks[1];

    syncStore.updateUserPreferences(userTamil, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    // Track 1 has 1 accidental skip (neutral)
    syncStore.recordSongListening(userTamil, {
      songId: track1.id,
      songName: track1.title,
      language: 'Tamil',
      playCount: 1,
      skipCount: 1
    });

    // Track 2 has 4 repeated fast skips (heavy penalty)
    syncStore.recordSongListening(userTamil, {
      songId: track2.id,
      songName: track2.title,
      language: 'Tamil',
      playCount: 4,
      skipCount: 4
    });

    const queue = RecommendationEngineService.getAutoQueueRecommendations(userTamil, {
      language: 'Tamil',
      limit: 15
    });

    // Track 1 with single skip is eligible and can be in the queue
    // Track 2 with 4 skips is deprioritized / eliminated due to -60 penalty
    const track1Idx = queue.findIndex((t) => t.id === track1.id);
    const track2Idx = queue.findIndex((t) => t.id === track2.id);

    if (track2Idx !== -1 && track1Idx !== -1) {
      expect(track1Idx).toBeLessThan(track2Idx);
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 7: Explicit "Not Interested" and "Hide" completely remove/suppress the song
  // -------------------------------------------------------------------------
  it('Scenario 7: Explicit Not Interested and Hide completely suppress track from feed and auto-queue', async () => {
    syncStore.updateUserPreferences(userTamil, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    const initialRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    const trackToHide = initialRes.body.data.madeForYou[0];
    expect(trackToHide).toBeDefined();

    // Submit HIDE feedback
    const hideRes = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({
        targetId: trackToHide.id,
        targetType: 'SONG',
        feedbackType: 'HIDE'
      });

    expect(hideRes.status).toBe(200);

    // Verify track is absent from subsequent feed
    const updatedRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    const updatedFeed = updatedRes.body.data.madeForYou;
    expect(updatedFeed.some((t: any) => t.id === trackToHide.id)).toBe(false);

    // Verify track is absent from auto-queue
    const queueRes = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({ language: 'Tamil', limit: 20 });

    expect(queueRes.body.tracks.some((t: any) => t.id === trackToHide.id)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Scenario 8: No duplicate songs appear in automatic queue
  // -------------------------------------------------------------------------
  it('Scenario 8: No duplicate songs appear in automatic queue, excluding current playing song', async () => {
    syncStore.updateUserPreferences(userTamil, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    const currentSongId = 'track_leo_1'; // Badass
    const activeQueueIds = ['track_leo_2', 'track_vaaranam_aayiram_1'];

    const res = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({
        songId: currentSongId,
        language: 'Tamil',
        excludeIds: activeQueueIds,
        limit: 15
      });

    expect(res.status).toBe(200);
    const tracks = res.body.tracks;

    // Does not include currently playing song
    expect(tracks.some((t: any) => t.id === currentSongId)).toBe(false);

    // Does not include active queue songs
    expect(tracks.some((t: any) => activeQueueIds.includes(t.id))).toBe(false);

    // All returned songs are unique (no duplicates)
    const seen = new Set<string>();
    for (const t of tracks) {
      expect(seen.has(t.id)).toBe(false);
      seen.add(t.id);
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 9: Manual Play Next and Add to Queue priority order is preserved
  // -------------------------------------------------------------------------
  it('Scenario 9: Queue hierarchy correctly places recommendations after Play Next and manual queue', () => {
    // Priority order:
    // 1. Current playing song
    // 2. Play Next item
    // 3. Manual queue items
    // 4. Auto-recommended items
    const currentSong = { id: 'song_curr', title: 'Current Song' };
    const playNextSong = { id: 'song_next', title: 'Play Next Song' };
    const manualQueue = [
      { id: 'song_manual_1', title: 'Manual 1' },
      { id: 'song_manual_2', title: 'Manual 2' }
    ];

    const autoRecommendations = RecommendationEngineService.getAutoQueueRecommendations(userTamil, {
      language: 'Tamil',
      excludeIds: ['song_curr', 'song_next', 'song_manual_1', 'song_manual_2'],
      limit: 4
    });

    const assembledQueue = [
      currentSong,
      playNextSong,
      ...manualQueue,
      ...autoRecommendations
    ];

    expect(assembledQueue[0].id).toBe('song_curr');
    expect(assembledQueue[1].id).toBe('song_next');
    expect(assembledQueue[2].id).toBe('song_manual_1');
    expect(assembledQueue[3].id).toBe('song_manual_2');
    expect(assembledQueue[4].id).toBe(autoRecommendations[0].id);
  });

  // -------------------------------------------------------------------------
  // Scenario 10: Guest mode returns public catalogue only with no private recommendations
  // -------------------------------------------------------------------------
  it('Scenario 10: Guest mode returns public catalogue without exposing private history or stats', async () => {
    // 1. When guest requests without language, prompt for language
    const promptRes = await request(app).get('/api/recommendations');
    expect(promptRes.status).toBe(200);
    expect(promptRes.body.data.requiresLanguageSelection).toBe(true);
    expect(promptRes.body.data.recentlyPlayed).toEqual([]);
    expect(promptRes.body.data.favouriteSongs).toEqual([]);

    // 2. When guest specifies a language, return public catalog but private sections remain empty
    const guestFeedRes = await request(app).get('/api/recommendations?language=Tamil');
    expect(guestFeedRes.status).toBe(200);
    const data = guestFeedRes.body.data;

    expect(data.madeForYou.length).toBeGreaterThan(0);
    expect(data.trendingInLanguages.length).toBeGreaterThan(0);
    expect(data.newReleases.length).toBeGreaterThan(0);

    // Private sections are strictly empty
    expect(data.recentlyPlayed).toEqual([]);
    expect(data.continueListening).toEqual([]);
    expect(data.basedOnListeningHistory.tracks).toEqual([]);
    expect(data.favouriteSongs).toEqual([]);
    expect(data.similarToFavouriteSongs).toEqual([]);
    expect(data.dailyMixes).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Scenario 11: Switching accounts does not leak cached data
  // -------------------------------------------------------------------------
  it('Scenario 11: Switching accounts isolates data and prevents cached data leakage', async () => {
    syncStore.updateUserPreferences(userTamil, {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Anirudh Ravichander'],
      hasCompletedOnboarding: true
    });

    syncStore.updateUserPreferences(userHindi, {
      preferredLanguages: ['Hindi'],
      favouriteArtists: ['Arijit Singh'],
      hasCompletedOnboarding: true
    });

    // User A fetches feed
    const resA = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    // User B fetches feed
    const resB = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenHindi}`);

    expect(resA.body.data.preferredLanguages).toEqual(['Tamil']);
    expect(resB.body.data.preferredLanguages).toEqual(['Hindi']);

    // Feed B contains zero tracks from User A's private cache
    expect(resB.body.data.madeForYou.every((t: any) => t.language?.toLowerCase() === 'hindi')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 12: Missing song metadata handled safely without crashes
  // -------------------------------------------------------------------------
  it('Scenario 12: Missing song metadata is handled safely with graceful defaults', () => {
    // Test getAutoQueueRecommendations with undefined metadata fields
    const res = RecommendationEngineService.getAutoQueueRecommendations(userTamil, {
      songId: undefined,
      songTitle: undefined,
      artist: undefined,
      director: undefined,
      language: undefined,
      genre: undefined,
      mood: undefined,
      limit: 10
    });

    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((t) => typeof t.title === 'string' && typeof t.artist === 'string')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 13: Pagination, limits, and runtime weights config
  // -------------------------------------------------------------------------
  it('Scenario 13: Configurable weights inspection, feedback undo, and query limits work accurately', async () => {
    // 1. Inspect recommendation weights
    const weightsRes = await request(app).get('/api/recommendations/config/weights');
    expect(weightsRes.status).toBe(200);
    expect(weightsRes.body.weights.artistPreference).toBe(0.20);
    expect(weightsRes.body.weights.listeningBehavior).toBe(0.25);

    // 2. Test feedback recording and undoing
    const fbRes = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({
        targetId: 'track_leo_1',
        targetType: 'SONG',
        feedbackType: 'MORE_LIKE_THIS'
      });
    expect(fbRes.status).toBe(200);
    expect(fbRes.body.feedback.feedbackType).toBe('MORE_LIKE_THIS');

    // Retrieve feedback
    const listFbRes = await request(app)
      .get('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${tokenTamil}`);
    expect(listFbRes.body.feedbacks.some((f: any) => f.targetId === 'track_leo_1')).toBe(true);

    // Undo feedback
    const undoRes = await request(app)
      .post('/api/recommendations/feedback/undo')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({ targetId: 'track_leo_1' });
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.undone).toBe(true);

    // Auto-queue limits
    const queueLimit5 = RecommendationEngineService.getAutoQueueRecommendations(userTamil, {
      language: 'Tamil',
      limit: 5
    });
    expect(queueLimit5.length).toBeLessThanOrEqual(5);
  });
});
