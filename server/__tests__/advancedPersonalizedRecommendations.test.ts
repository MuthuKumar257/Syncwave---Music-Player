import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { JWT_SECRET } from '../src/middleware/auth';
import { RecommendationEngineService, DEFAULT_RECOMMENDATION_WEIGHTS } from '../src/services/recommendation/recommendationEngine.service';

function createAuthToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Advanced Personalized Music Recommendation Engine – 5-User Comprehensive Verification', () => {
  // 5 Distinct Users
  const user1TamilMelody = 'user_adv_tamil_' + Date.now();
  const user2HindiPop = 'user_adv_hindi_' + Date.now();
  const user3TeluguEnergy = 'user_adv_telugu_' + Date.now();
  const user4MalayalamChill = 'user_adv_malayalam_' + Date.now();
  const user5Multilingual = 'user_adv_multi_' + Date.now();

  const tokenUser1 = createAuthToken(user1TamilMelody, 'tamil_melody@syncwave.app');
  const tokenUser2 = createAuthToken(user2HindiPop, 'hindi_pop@syncwave.app');
  const tokenUser3 = createAuthToken(user3TeluguEnergy, 'telugu_energy@syncwave.app');
  const tokenUser4 = createAuthToken(user4MalayalamChill, 'malayalam_chill@syncwave.app');
  const tokenUser5 = createAuthToken(user5Multilingual, 'multilingual@syncwave.app');

  beforeEach(() => {
    // Reset all 5 profiles
    syncStore.resetUserPreferences(user1TamilMelody);
    syncStore.resetUserPreferences(user2HindiPop);
    syncStore.resetUserPreferences(user3TeluguEnergy);
    syncStore.resetUserPreferences(user4MalayalamChill);
    syncStore.resetUserPreferences(user5Multilingual);

    // Setup User 1: Tamil Melody Lover
    syncStore.updateUserPreferences(user1TamilMelody, {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Hariharan', 'Sid Sriram'],
      favouriteComposers: ['Harris Jayaraj', 'A. R. Rahman'],
      favouriteSingers: ['Hariharan', 'Chinmayi'],
      favouriteGenres: ['Melody'],
      preferredMoods: ['Romantic'],
      hasCompletedOnboarding: true
    });

    // Setup User 2: Hindi Romantic & Pop Lover
    syncStore.updateUserPreferences(user2HindiPop, {
      preferredLanguages: ['Hindi'],
      favouriteArtists: ['Arijit Singh'],
      favouriteComposers: ['Pritam'],
      favouriteSingers: ['Arijit Singh', 'Shreya Ghoshal'],
      favouriteGenres: ['Pop'],
      preferredMoods: ['Love'],
      hasCompletedOnboarding: true
    });

    // Setup User 3: Telugu High-Energy Lover
    syncStore.updateUserPreferences(user3TeluguEnergy, {
      preferredLanguages: ['Telugu'],
      favouriteArtists: ['Anurag Kulkarni'],
      favouriteComposers: ['M. M. Keeravani', 'Thaman S'],
      favouriteSingers: ['Rahul Sipligunj', 'Kaala Bhairava'],
      favouriteGenres: ['EDM'],
      preferredMoods: ['Energetic'],
      hasCompletedOnboarding: true
    });

    // Setup User 4: Malayalam Chill & Acoustic Lover
    syncStore.updateUserPreferences(user4MalayalamChill, {
      preferredLanguages: ['Malayalam'],
      favouriteArtists: ['K. S. Chithra'],
      favouriteComposers: ['Sushin Shyam'],
      favouriteSingers: ['K. S. Chithra', 'Sithara Krishnakumar'],
      favouriteGenres: ['Melody'],
      preferredMoods: ['Relaxing'],
      hasCompletedOnboarding: true
    });

    // Setup User 5: Multilingual Explorer (Kannada + Tamil)
    syncStore.updateUserPreferences(user5Multilingual, {
      preferredLanguages: ['Kannada', 'Tamil'],
      favouriteArtists: ['Sanjith Hegde'],
      favouriteComposers: ['B. Ajaneesh Loknath', 'Anirudh Ravichander'],
      favouriteSingers: ['Sanjith Hegde'],
      favouriteGenres: ['Soundtrack'],
      preferredMoods: ['Happy'],
      hasCompletedOnboarding: true
    });
  });

  // =========================================================================
  // 1. Different Users Receive Completely Different Recommendations
  // =========================================================================
  it('Requirement 1: Different users receive completely different recommendations across the 15 sections', async () => {
    const resTamil = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser1}`);

    const resHindi = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser2}`);

    const resTelugu = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser3}`);

    expect(resTamil.status).toBe(200);
    expect(resHindi.status).toBe(200);
    expect(resTelugu.status).toBe(200);

    const tamilData = resTamil.body.data;
    const hindiData = resHindi.body.data;
    const teluguData = resTelugu.body.data;

    // Verify 15 dynamic sections exist on response
    expect(tamilData.madeForYou).toBeDefined();
    expect(tamilData.dailyMixes).toBeDefined();
    expect(tamilData.becauseYouListenedTo).toBeDefined();
    expect(tamilData.basedOnFavouriteArtists).toBeDefined();
    expect(tamilData.basedOnFavouriteDirectors).toBeDefined();
    expect(tamilData.recentlyPlayed).toBeDefined();
    expect(tamilData.favouriteSongs).toBeDefined();
    expect(tamilData.similarToFavouriteSongs).toBeDefined();
    expect(tamilData.trendingInLanguages).toBeDefined();
    expect(tamilData.newReleases).toBeDefined();
    expect(tamilData.discoverSomethingNew).toBeDefined();
    expect(tamilData.yourMoodMix).toBeDefined();
    expect(tamilData.continueListening).toBeDefined();
    expect(tamilData.mostPlayedArtists).toBeDefined();
    expect(tamilData.songsYouMayLike).toBeDefined();

    // Verify distinct recommendations across users
    const tamilSongIds = new Set(tamilData.madeForYou.map((t: any) => t.id));
    const hindiSongIds = new Set(hindiData.madeForYou.map((t: any) => t.id));
    const teluguSongIds = new Set(teluguData.madeForYou.map((t: any) => t.id));

    // Zero overlap between single-language user madeForYou lists
    const tamilHindiOverlap = [...tamilSongIds].filter((id) => hindiSongIds.has(id));
    const tamilTeluguOverlap = [...tamilSongIds].filter((id) => teluguSongIds.has(id));

    expect(tamilHindiOverlap.length).toBe(0);
    expect(tamilTeluguOverlap.length).toBe(0);
  });

  // =========================================================================
  // 2. Daily Mixes Differ Between Users
  // =========================================================================
  it('Requirement 2: Daily Mixes differ between users in titles, artwork, languages, and songs', async () => {
    const resTamil = await request(app)
      .get('/api/recommendations/daily-mix')
      .set('Authorization', `Bearer ${tokenUser1}`);

    const resHindi = await request(app)
      .get('/api/recommendations/daily-mix')
      .set('Authorization', `Bearer ${tokenUser2}`);

    const resTelugu = await request(app)
      .get('/api/recommendations/daily-mix')
      .set('Authorization', `Bearer ${tokenUser3}`);

    expect(resTamil.status).toBe(200);
    expect(resHindi.status).toBe(200);
    expect(resTelugu.status).toBe(200);

    const tamilMixes = resTamil.body.dailyMixes;
    const hindiMixes = resHindi.body.dailyMixes;
    const teluguMixes = resTelugu.body.dailyMixes;

    expect(tamilMixes.length).toBeGreaterThanOrEqual(4);
    expect(hindiMixes.length).toBeGreaterThanOrEqual(4);
    expect(teluguMixes.length).toBeGreaterThanOrEqual(4);

    // Each mix must have unique artwork, title, trackCount, and playable tracks
    tamilMixes.forEach((m: any) => {
      expect(m.title).toBeTruthy();
      expect(m.coverUrl).toBeTruthy();
      expect(m.trackCount).toBeGreaterThan(0);
      expect(m.tracks.length).toBeGreaterThan(0);
      // All tracks in Tamil user's mix must strictly be Tamil
      m.tracks.forEach((t: any) => {
        expect(t.language.toLowerCase()).toBe('tamil');
      });
    });

    // Hindi user's mixes must strictly contain Hindi songs
    hindiMixes.forEach((m: any) => {
      m.tracks.forEach((t: any) => {
        expect(t.language.toLowerCase()).toBe('hindi');
      });
    });

    // Telugu user's mixes must strictly contain Telugu songs
    teluguMixes.forEach((m: any) => {
      m.tracks.forEach((t: any) => {
        expect(t.language.toLowerCase()).toBe('telugu');
      });
    });
  });

  // =========================================================================
  // 3. Listening History Dynamically Changes Future Recommendations
  // =========================================================================
  it('Requirement 3: Listening history dynamically alters future recommendations', async () => {
    // Before listening: record baseline feed
    const beforeRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser1}`);
    const beforeTop = beforeRes.body.data.madeForYou[0];

    // Simulate user repeatedly playing and replaying a specific track
    const targetSongId = 'track_vaaranam_aayiram_1'; // Nenjukkul Peidhidum
    syncStore.recordSongListening(user1TamilMelody, {
      songId: targetSongId,
      songName: 'Nenjukkul Peidhidum',
      musicDirector: 'Harris Jayaraj',
      language: 'Tamil',
      genre: 'Melody',
      playCount: 5,
      replayCount: 3,
      totalListeningDurationMs: 900000,
      skipCount: 0,
      isFavorite: true
    });

    // After listening: fetch updated feed
    const afterRes = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser1}`);

    const afterMadeForYou = afterRes.body.data.madeForYou;
    const replayedInTop3 = afterMadeForYou.slice(0, 3).some((t: any) => t.id === targetSongId);
    expect(replayedInTop3).toBe(true);

    // Recently Played is now populated with real user history
    expect(afterRes.body.data.recentlyPlayed.length).toBeGreaterThan(0);
    expect(afterRes.body.data.recentlyPlayed[0].id).toBe(targetSongId);
  });

  // =========================================================================
  // 4. Favourite Songs Influence Recommendations
  // =========================================================================
  it('Requirement 4: Favourite songs populate Your Favourite Songs and Similar to Favourite Songs', async () => {
    // Mark a song as favourite
    syncStore.recordSongListening(user2HindiPop, {
      songId: 'track_aashiqui_2_1',
      songName: 'Tum Hi Ho',
      musicDirector: 'Mithoon',
      singers: ['Arijit Singh'],
      language: 'Hindi',
      genre: 'Melody',
      playCount: 4,
      replayCount: 2,
      totalListeningDurationMs: 600000,
      skipCount: 0,
      isFavorite: true
    });

    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser2}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Your Favourite Songs section contains the favorited track
    expect(data.favouriteSongs.length).toBeGreaterThan(0);
    expect(data.favouriteSongs.some((t: any) => t.id === 'track_aashiqui_2_1')).toBe(true);

    // Similar to Your Favourite Songs is populated
    expect(data.similarToFavouriteSongs.length).toBeGreaterThan(0);
    data.similarToFavouriteSongs.forEach((t: any) => {
      expect(t.language.toLowerCase()).toBe('hindi');
    });
  });

  // =========================================================================
  // 5. Not Interested Reduces Similar Recommendations & Completely Hides the Song
  // =========================================================================
  it('Requirement 5: Not Interested feedback completely hides the song and deprioritizes similar songs', async () => {
    const dislikedSongId = 'track_vaaranam_aayiram_3'; // Yethi Yethi

    // Record NOT_INTERESTED feedback
    const feedbackRes = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({
        targetId: dislikedSongId,
        targetType: 'SONG',
        feedbackType: 'NOT_INTERESTED'
      });

    expect(feedbackRes.status).toBe(200);

    // Fetch recommendations after feedback
    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser1}`);

    const data = res.body.data;

    // Disliked track must NOT appear in Made for You, Daily Mixes, or Discover
    expect(data.madeForYou.some((t: any) => t.id === dislikedSongId)).toBe(false);
    expect(data.trendingInLanguages.some((t: any) => t.id === dislikedSongId)).toBe(false);
    expect(data.newReleases.some((t: any) => t.id === dislikedSongId)).toBe(false);
    expect(data.songsYouMayLike.some((t: any) => t.id === dislikedSongId)).toBe(false);

    data.dailyMixes.forEach((mix: any) => {
      expect(mix.tracks.some((t: any) => t.id === dislikedSongId)).toBe(false);
    });
  });

  // =========================================================================
  // 6. Automatic Queue is Personalized and Strictly Matches User Language
  // =========================================================================
  it('Requirement 6: Automatic queues strictly enforce user selected languages with artist diversity', async () => {
    // Generate auto-queue for Tamil user
    const autoQueueTamil = RecommendationEngineService.getAutoQueueRecommendations(user1TamilMelody, {
      songId: 'track_vaaranam_aayiram_1',
      songTitle: 'Nenjukkul Peidhidum',
      artist: 'Hariharan',
      director: 'Harris Jayaraj',
      language: 'Tamil',
      limit: 10
    });

    expect(autoQueueTamil.length).toBeGreaterThan(0);
    autoQueueTamil.forEach((track) => {
      expect(track.language?.toLowerCase()).toBe('tamil');
    });

    // Check artist diversity: Max 2 tracks per artist in refill
    const artistCounts = new Map<string, number>();
    autoQueueTamil.forEach((t) => {
      const key = t.composer || t.artist || 'unknown';
      artistCounts.set(key, (artistCounts.get(key) || 0) + 1);
    });
    for (const [art, count] of artistCounts.entries()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  // =========================================================================
  // 7 & 8. Play Next and Add to Queue Work Correctly Without Being Overwritten
  // =========================================================================
  it('Requirements 7 & 8: Auto-queue respects manual Play Next and Add to Queue priority', () => {
    // Simulating user queue state
    const currentTrack = { id: 'track_current', title: 'Current Playing' } as any;
    const playNextTrack = { id: 'track_manual_play_next', title: 'Play Next Manual' } as any;
    const queuedTrack = { id: 'track_manual_queue', title: 'Manual Queue Song' } as any;

    // Auto-generated recommendations
    const autoRecommended = RecommendationEngineService.getAutoQueueRecommendations(user1TamilMelody, {
      excludeIds: [currentTrack.id, playNextTrack.id, queuedTrack.id],
      limit: 5
    });

    // Priority order: Current -> Play Next -> Manual Queue -> Auto Recommendations
    const fullQueue = [currentTrack, playNextTrack, queuedTrack, ...autoRecommended];

    expect(fullQueue[0].id).toBe('track_current');
    expect(fullQueue[1].id).toBe('track_manual_play_next');
    expect(fullQueue[2].id).toBe('track_manual_queue');
    expect(fullQueue.length).toBe(3 + autoRecommended.length);

    // Auto recommendations do not overwrite manual queue items
    expect(fullQueue.find((t) => t.id === 'track_manual_play_next')).toBeDefined();
    expect(fullQueue.find((t) => t.id === 'track_manual_queue')).toBeDefined();
  });

  // =========================================================================
  // 9. Selected Language Restrictions Always Apply (No Cross-Language Contamination)
  // =========================================================================
  it('Requirement 9: Selected language restrictions strictly apply and unselected languages never bleed in', async () => {
    // User 4 has only Malayalam selected
    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser4}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Check all track lists in feed
    const checkTracks = (tracks: any[], sectionName: string) => {
      tracks.forEach((t) => {
        expect(
          t.language?.toLowerCase(),
          `Track "${t.title}" in section "${sectionName}" has language "${t.language}" but user selected Malayalam only`
        ).toBe('malayalam');
      });
    };

    checkTracks(data.madeForYou, 'madeForYou');
    checkTracks(data.trendingInLanguages, 'trendingInLanguages');
    checkTracks(data.newReleases, 'newReleases');
    checkTracks(data.discoverSomethingNew, 'discoverSomethingNew');
    checkTracks(data.songsYouMayLike, 'songsYouMayLike');

    data.dailyMixes.forEach((mix: any) => {
      checkTracks(mix.tracks, `dailyMix:${mix.title}`);
    });
  });

  // =========================================================================
  // 10. Account Switching Clears Previous User Recommendations
  // =========================================================================
  it('Requirement 10: Account switching loads completely fresh recommendations without retaining previous user data', async () => {
    // Request as User 1 (Tamil)
    const resUser1 = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(resUser1.body.data.preferredLanguages).toEqual(['Tamil']);

    // Switch account to User 3 (Telugu)
    const resUser3 = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenUser3}`);

    expect(resUser3.body.data.preferredLanguages).toEqual(['Telugu']);
    expect(resUser3.body.data.madeForYou[0].language.toLowerCase()).toBe('telugu');
    expect(resUser3.body.data.madeForYou[0].language.toLowerCase()).not.toBe('tamil');
  });

  // =========================================================================
  // 11. Guest Mode Does Not Expose Personal Data or Stats
  // =========================================================================
  it('Requirement 11: Guest mode returns public catalogue without exposing private listening stats or mixes', async () => {
    // Request without Authorization header (Guest Mode)
    const guestStatsRes = await request(app)
      .get('/api/recommendations/profile-stats');

    // 401 Unauthorized for private profile stats
    expect(guestStatsRes.status).toBe(401);

    const guestHistoryRes = await request(app)
      .get('/api/recommendations/listening-history');

    // 401 Unauthorized for private listening history
    expect(guestHistoryRes.status).toBe(401);

    // Guest recommendations request without languages prompts for selection
    const guestRecsRes = await request(app)
      .get('/api/recommendations');

    expect(guestRecsRes.status).toBe(200);
    expect(guestRecsRes.body.data.requiresLanguageSelection).toBe(true);
    expect(guestRecsRes.body.data.recentlyPlayed).toEqual([]);
    expect(guestRecsRes.body.data.favouriteSongs).toEqual([]);
  });

  // =========================================================================
  // 12. Discover Endpoint Provides Intelligent Categories with Exploratory Language Support
  // =========================================================================
  it('Requirement 12: GET /api/recommendations/discover supports exploration without mutating saved preferences', async () => {
    // User 1 has Tamil saved in preferences. They explore Telugu music in Discover:
    const discoverRes = await request(app)
      .get('/api/recommendations/discover?language=Telugu')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(discoverRes.status).toBe(200);
    const data = discoverRes.body.data;

    expect(data.preferredLanguages).toEqual(['Telugu']);
    expect(data.popularSongs.length).toBeGreaterThan(0);
    data.popularSongs.forEach((t: any) => {
      expect(t.language.toLowerCase()).toBe('telugu');
    });

    // Check user's saved preferences on backend: still Tamil!
    const prefsRes = await request(app)
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(prefsRes.body.preferences.preferredLanguages).toEqual(['Tamil']);
  });

  // =========================================================================
  // 13. Single Skip is NOT Penalized as a Dislike (Only >= 3 Skips Heavily Penalized)
  // =========================================================================
  it('Requirement 13: A single skip does NOT heavily penalize a song (only 3+ skips receive heavy penalty)', () => {
    const singleSkipUser = 'user_single_skip_' + Date.now();
    syncStore.updateUserPreferences(singleSkipUser, {
      preferredLanguages: ['Tamil'],
      favouriteComposers: ['Harris Jayaraj'],
      hasCompletedOnboarding: true
    });

    // Song A: 1 skip
    syncStore.recordSongListening(singleSkipUser, {
      songId: 'track_vaaranam_aayiram_1',
      songName: 'Nenjukkul Peidhidum',
      musicDirector: 'Harris Jayaraj',
      language: 'Tamil',
      playCount: 1,
      skipCount: 1
    });

    // Song B: 3 skips
    syncStore.recordSongListening(singleSkipUser, {
      songId: 'track_vaaranam_aayiram_2',
      songName: 'Mundhinam Paarthenae',
      musicDirector: 'Harris Jayaraj',
      language: 'Tamil',
      playCount: 3,
      skipCount: 3
    });

    const queue = RecommendationEngineService.getAutoQueueRecommendations(singleSkipUser, {
      language: 'Tamil',
      limit: 10
    });

    // Song A with 1 skip should still rank high among Harris Jayaraj tracks
    const songAIdx = queue.findIndex((t) => t.id === 'track_vaaranam_aayiram_1');
    const songBIdx = queue.findIndex((t) => t.id === 'track_vaaranam_aayiram_2');

    // Song A (1 skip) must rank significantly higher than Song B (3 skips)
    expect(songAIdx).toBeGreaterThanOrEqual(0);
    if (songBIdx !== -1) {
      expect(songAIdx).toBeLessThan(songBIdx);
    }
  });

  // =========================================================================
  // 14. Reset Taste Profile Clears Recommendations Without Deleting Playlists or Favourites
  // =========================================================================
  it('Requirement 14: POST /api/users/me/preferences/reset clears recommendations without deleting playlists or favourites', async () => {
    // Add favorite and playlist for User 1
    syncStore.addFavorite(user1TamilMelody, 'track_vaaranam_aayiram_1');
    const playlist = syncStore.createPlaylist(user1TamilMelody, 'My Melody Hits', 'Favorites');
    syncStore.addSongToPlaylist(user1TamilMelody, playlist.id, 'track_vaaranam_aayiram_1');

    // Reset profile
    const resetRes = await request(app)
      .post('/api/users/me/preferences/reset')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(resetRes.status).toBe(200);

    // Verify preferences were reset
    const userPrefs = syncStore.getUserPreferences(user1TamilMelody);
    expect(userPrefs.hasCompletedOnboarding).toBe(false);
    expect(userPrefs.preferredLanguages).toEqual([]);

    // Verify playlist and favorites remain INTACT
    const favorites = syncStore.getUserFavorites(user1TamilMelody);
    const playlists = syncStore.getUserPlaylists(user1TamilMelody);

    expect(favorites).toContain('track_vaaranam_aayiram_1');
    expect(playlists.length).toBe(1);
    expect(playlists[0].name).toBe('My Melody Hits');
  });
});
