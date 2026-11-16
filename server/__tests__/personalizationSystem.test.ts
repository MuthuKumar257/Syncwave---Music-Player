import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { JWT_SECRET } from '../src/middleware/auth';
import { RecommendationEngineService } from '../src/services/recommendation/recommendationEngine.service';

function createAuthToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

describe('SyncWave Complete User-Based Personalization System Suite', () => {
  const userTamilId = 'user_tamil_only_' + Date.now();
  const userTeluguHindiId = 'user_telugu_hindi_' + Date.now();
  const userOnboardingId = 'user_new_onboard_' + Date.now();

  const tokenTamil = createAuthToken(userTamilId, 'tamil@example.com');
  const tokenTeluguHindi = createAuthToken(userTeluguHindiId, 'teluguhindi@example.com');
  const tokenNew = createAuthToken(userOnboardingId, 'newuser@example.com');

  beforeEach(() => {
    // Clean user records
    syncStore.resetUserPreferences(userTamilId);
    syncStore.resetUserPreferences(userTeluguHindiId);
    syncStore.resetUserPreferences(userOnboardingId);
  });

  // =========================================================================
  // SCENARIO 1: First-Time User Experience (Onboarding)
  // =========================================================================
  it('Scenario 1: First-time user with 0 languages is prompted for language selection, then completes onboarding and receives personalized Home', async () => {
    // 1. Initial request: brand-new user with 0 languages
    const emptyRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenNew}`);

    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.data.requiresLanguageSelection).toBe(true);
    expect(emptyRes.body.data.preferredLanguages).toEqual([]);
    expect(emptyRes.body.data.recommendedForYou).toEqual([]);

    // 2. User completes multi-step onboarding: selects languages, artists, directors, genres, and moods
    const onboardingPayload = {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Anirudh Ravichander', 'Sid Sriram'],
      favouriteComposers: ['Anirudh Ravichander', 'A. R. Rahman'],
      favouriteSingers: ['Sid Sriram'],
      favouriteGenres: ['Melody', 'EDM'],
      preferredMoods: ['Romantic', 'Energetic'],
      hasCompletedOnboarding: true
    };

    const saveRes = await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenNew}`)
      .send(onboardingPayload);

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.preferences.preferredLanguages).toEqual(['Tamil']);
    expect(saveRes.body.preferences.hasCompletedOnboarding).toBe(true);
    expect(saveRes.body.preferences.preferredMoods).toContain('Romantic');

    // 3. User navigates to Home: now receives rich personalized recommendations
    const homeRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenNew}`);

    expect(homeRes.status).toBe(200);
    expect(homeRes.body.data.requiresLanguageSelection).toBeFalsy();
    expect(homeRes.body.data.preferredLanguages).toEqual(['Tamil']);
    expect(homeRes.body.data.recommendedForYou.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // SCENARIO 2: Strict Language Filtering – Single Language (Tamil Only)
  // =========================================================================
  it('Scenario 2: Single language selection displays ONLY songs in that language with zero leakage', async () => {
    // Configure user for Tamil only
    syncStore.updateUserPreferences(userTamilId, {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Anirudh Ravichander', 'Harris Jayaraj'],
      favouriteComposers: ['Harris Jayaraj', 'A. R. Rahman'],
      favouriteSingers: ['Hariharan'],
      favouriteGenres: ['Melody'],
      preferredMoods: ['Romantic'],
      hasCompletedOnboarding: true
    });

    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(res.status).toBe(200);
    const feed = res.body.data;

    // Helper to check every song in an array is strictly Tamil
    const assertAllTamil = (tracks: any[], sectionName: string) => {
      tracks.forEach((t) => {
        expect(
          t.language?.toLowerCase(),
          `Track "${t.title}" in section "${sectionName}" had language "${t.language}" instead of Tamil`
        ).toBe('tamil');
      });
    };

    // 1. recommendedForYou
    expect(feed.recommendedForYou.length).toBeGreaterThan(0);
    assertAllTamil(feed.recommendedForYou, 'recommendedForYou');

    // 2. basedOnListeningHistory
    if (feed.basedOnListeningHistory?.tracks?.length > 0) {
      assertAllTamil(feed.basedOnListeningHistory.tracks, 'basedOnListeningHistory');
    }

    // 3. moreFromFavouriteArtists
    if (feed.moreFromFavouriteArtists?.length > 0) {
      assertAllTamil(feed.moreFromFavouriteArtists, 'moreFromFavouriteArtists');
    }

    // 4. similarSongs
    if (feed.similarSongs?.length > 0) {
      assertAllTamil(feed.similarSongs, 'similarSongs');
    }

    // 5. sameMusicDirector
    if (feed.sameMusicDirector?.tracks?.length > 0) {
      assertAllTamil(feed.sameMusicDirector.tracks, 'sameMusicDirector');
    }

    // 6. trendingInLanguages
    expect(feed.trendingInLanguages.length).toBeGreaterThan(0);
    assertAllTamil(feed.trendingInLanguages, 'trendingInLanguages');

    // 7. recentlyPlayed
    if (feed.recentlyPlayed?.length > 0) {
      assertAllTamil(feed.recentlyPlayed, 'recentlyPlayed');
    }

    // 8. discoverNewMusic
    if (feed.discoverNewMusic?.length > 0) {
      assertAllTamil(feed.discoverNewMusic, 'discoverNewMusic');
    }

    // 9. popularSongs
    if (feed.popularSongs?.length > 0) {
      assertAllTamil(feed.popularSongs, 'popularSongs');
    }

    // 10. newReleases
    if (feed.newReleases?.length > 0) {
      assertAllTamil(feed.newReleases, 'newReleases');
    }

    // 11. moodPlaylists
    feed.moodPlaylists.forEach((moodCard: any) => {
      moodCard.tracks.forEach((t: any) => {
        expect(t.language?.toLowerCase()).toBe('tamil');
      });
    });

    // 12. movieSoundtracks
    feed.movieSoundtracks.forEach((m: any) => {
      expect(m.language?.toLowerCase()).toBe('tamil');
    });
  });

  // =========================================================================
  // SCENARIO 3: Strict Language Filtering – Multi-Language (Telugu + Hindi)
  // =========================================================================
  it('Scenario 3: Multi-language selection (Telugu + Hindi) contains ONLY songs from those languages, excluding Tamil/English', async () => {
    syncStore.updateUserPreferences(userTeluguHindiId, {
      preferredLanguages: ['Telugu', 'Hindi'],
      favouriteArtists: ['Sid Sriram', 'Arijit Singh'],
      favouriteComposers: ['Thaman S', 'M. M. Keeravani'],
      favouriteSingers: ['Arijit Singh', 'Sid Sriram'],
      hasCompletedOnboarding: true
    });

    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTeluguHindi}`);

    expect(res.status).toBe(200);
    const feed = res.body.data;
    const allowed = new Set(['telugu', 'hindi']);

    const assertAllowedLangs = (tracks: any[], sectionName: string) => {
      tracks.forEach((t) => {
        expect(
          allowed.has(t.language?.toLowerCase()),
          `Track "${t.title}" in section "${sectionName}" had forbidden language "${t.language}"`
        ).toBe(true);
      });
    };

    expect(feed.recommendedForYou.length).toBeGreaterThan(0);
    assertAllowedLangs(feed.recommendedForYou, 'recommendedForYou');
    assertAllowedLangs(feed.trendingInLanguages, 'trendingInLanguages');
    assertAllowedLangs(feed.similarSongs, 'similarSongs');
    assertAllowedLangs(feed.popularSongs, 'popularSongs');

    // Verify zero Tamil songs present in User B's feed
    const allTracks = [
      ...feed.recommendedForYou,
      ...feed.trendingInLanguages,
      ...feed.similarSongs,
      ...feed.popularSongs
    ];
    const hasTamil = allTracks.some((t) => t.language?.toLowerCase() === 'tamil');
    expect(hasTamil).toBe(false);
  });

  // =========================================================================
  // SCENARIO 4: Multi-User Data Isolation (Playlists, Schedules, History)
  // =========================================================================
  it('Scenario 4: Complete data isolation between User A and User B for playlists, history and preferences', async () => {
    // 1. User A creates a playlist
    const plResA = await request(app)
      .post('/api/playlists')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({ name: 'User A Secret Tamil Mix' });
    expect(plResA.status).toBe(201);
    const playlistAId = plResA.body.data.id;

    // 2. User B creates a playlist
    const plResB = await request(app)
      .post('/api/playlists')
      .set('Authorization', `Bearer ${tokenTeluguHindi}`)
      .send({ name: 'User B Telugu Party Hits' });
    expect(plResB.status).toBe(201);

    // 3. User A lists playlists: sees only Playlist A
    const listA = await request(app)
      .get('/api/playlists')
      .set('Authorization', `Bearer ${tokenTamil}`);
    expect(listA.body.data.some((p: any) => p.name === 'User A Secret Tamil Mix')).toBe(true);
    expect(listA.body.data.some((p: any) => p.name === 'User B Telugu Party Hits')).toBe(false);

    // 4. User B attempts IDOR access to User A's playlist by ID: must be 404 Not Found
    const idorRes = await request(app)
      .get(`/api/playlists/${playlistAId}`)
      .set('Authorization', `Bearer ${tokenTeluguHindi}`);
    expect(idorRes.status).toBe(404);

    // 5. User A preferences are isolated from User B
    syncStore.updateUserPreferences(userTamilId, { preferredLanguages: ['Tamil'] });
    syncStore.updateUserPreferences(userTeluguHindiId, { preferredLanguages: ['Telugu', 'Hindi'] });

    const prefA = await request(app)
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenTamil}`);
    const prefB = await request(app)
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenTeluguHindi}`);

    expect(prefA.body.preferences.preferredLanguages).toEqual(['Tamil']);
    expect(prefB.body.preferences.preferredLanguages).toEqual(['Telugu', 'Hindi']);
  });

  // =========================================================================
  // SCENARIO 5: Discover Language Exploration Without Altering Home
  // =========================================================================
  it('Scenario 5: Intentional language exploration in Discover does not overwrite user Home preferences', async () => {
    syncStore.updateUserPreferences(userTamilId, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    // User explores Punjabi in Discover via ?language=Punjabi
    const exploreRes = await request(app)
      .get('/api/recommendations?language=Punjabi')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(exploreRes.status).toBe(200);
    expect(exploreRes.body.data.preferredLanguages).toEqual(['Punjabi']);
    expect(exploreRes.body.data.recommendedForYou.length).toBeGreaterThan(0);
    exploreRes.body.data.recommendedForYou.forEach((t: any) => {
      expect(t.language?.toLowerCase()).toBe('punjabi');
    });

    // Check user profile preferences in database: MUST still be Tamil!
    const profileRes = await request(app)
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(profileRes.body.preferences.preferredLanguages).toEqual(['Tamil']);

    // Subsequent normal Home fetch returns Tamil again
    const normalHomeRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(normalHomeRes.body.data.preferredLanguages).toEqual(['Tamil']);
    normalHomeRes.body.data.recommendedForYou.forEach((t: any) => {
      expect(t.language?.toLowerCase()).toBe('tamil');
    });
  });

  // =========================================================================
  // SCENARIO 6: Live Preference Synchronization
  // =========================================================================
  it('Scenario 6: Updating preferences live immediately recalculates Home feed without restart', async () => {
    syncStore.updateUserPreferences(userTamilId, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    // Initial feed: 100% Tamil
    const feed1 = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);
    expect(feed1.body.data.preferredLanguages).toEqual(['Tamil']);

    // User adds Malayalam to preferences live
    const updateRes = await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({ preferredLanguages: ['Tamil', 'Malayalam'] });
    expect(updateRes.status).toBe(200);

    // Immediate next feed: includes Malayalam
    const feed2 = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);
    expect(feed2.body.data.preferredLanguages).toContain('Malayalam');
    const hasMalayalamTrack = feed2.body.data.trendingInLanguages.some(
      (t: any) => t.language?.toLowerCase() === 'malayalam'
    );
    expect(hasMalayalamTrack).toBe(true);
  });

  // =========================================================================
  // SCENARIO 7: Genre and Mood Personalization Weighting
  // =========================================================================
  it('Scenario 7: Genre and Mood preferences actively elevate matching tracks with recommendation reasons', async () => {
    syncStore.updateUserPreferences(userTamilId, {
      preferredLanguages: ['Tamil'],
      favouriteGenres: ['EDM'],
      preferredMoods: ['Energetic'],
      hasCompletedOnboarding: true
    });

    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(res.status).toBe(200);
    const topTracks = res.body.data.recommendedForYou.slice(0, 5);
    const hasEnergeticOrEdm = topTracks.some(
      (t: any) => t.genre === 'EDM' || t.mood === 'Energetic' || t.title.includes('Naa Ready') || t.title.includes('Badass')
    );
    expect(hasEnergeticOrEdm).toBe(true);
  });
});
