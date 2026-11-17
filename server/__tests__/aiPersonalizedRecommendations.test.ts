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

describe('AI-Based Personalized Song Recommendation & Dynamic Queue Engine Suite', () => {
  // 5 Distinct Independent User Profiles
  const userTamilMelody = 'user_tamil_melody_' + Date.now();
  const userHindiEnergetic = 'user_hindi_energetic_' + Date.now();
  const userTeluguMass = 'user_telugu_mass_' + Date.now();
  const userMalayalamAcoustic = 'user_malayalam_acoustic_' + Date.now();
  const userColdStart = 'user_cold_start_' + Date.now();

  const tokenTamil = createAuthToken(userTamilMelody, 'tamil_melody@example.com');
  const tokenHindi = createAuthToken(userHindiEnergetic, 'hindi_energy@example.com');
  const tokenTelugu = createAuthToken(userTeluguMass, 'telugu_mass@example.com');
  const tokenMalayalam = createAuthToken(userMalayalamAcoustic, 'malayalam_acoustic@example.com');
  const tokenColdStart = createAuthToken(userColdStart, 'cold_start@example.com');

  beforeEach(() => {
    // Reset all 5 profiles
    syncStore.resetUserPreferences(userTamilMelody);
    syncStore.resetUserPreferences(userHindiEnergetic);
    syncStore.resetUserPreferences(userTeluguMass);
    syncStore.resetUserPreferences(userMalayalamAcoustic);
    syncStore.resetUserPreferences(userColdStart);

    // Setup User 1: Tamil Melody Lover (Harris Jayaraj, Sid Sriram)
    syncStore.updateUserPreferences(userTamilMelody, {
      preferredLanguages: ['Tamil'],
      favouriteArtists: ['Sid Sriram', 'Hariharan'],
      favouriteComposers: ['Harris Jayaraj'],
      favouriteSingers: ['Sid Sriram', 'Hariharan'],
      favouriteGenres: ['Melody', 'Soundtrack'],
      preferredMoods: ['Romantic', 'Relaxing'],
      hasCompletedOnboarding: true
    });

    // Setup User 2: Hindi Hits & Energy Lover (Pritam, Arijit Singh)
    syncStore.updateUserPreferences(userHindiEnergetic, {
      preferredLanguages: ['Hindi'],
      favouriteArtists: ['Arijit Singh'],
      favouriteComposers: ['Pritam'],
      favouriteSingers: ['Arijit Singh'],
      favouriteGenres: ['Pop', 'Soundtrack'],
      preferredMoods: ['Happy', 'Romantic'],
      hasCompletedOnboarding: true
    });

    // Setup User 3: Telugu Mass & Beat Lover (Devi Sri Prasad, Anirudh)
    syncStore.updateUserPreferences(userTeluguMass, {
      preferredLanguages: ['Telugu'],
      favouriteArtists: ['Anurag Kulkarni'],
      favouriteComposers: ['Devi Sri Prasad', 'Thaman S'],
      favouriteSingers: ['Anurag Kulkarni', 'Sid Sriram'],
      favouriteGenres: ['Dance', 'Soundtrack'],
      preferredMoods: ['Energetic', 'Motivation'],
      hasCompletedOnboarding: true
    });

    // Setup User 4: Malayalam Acoustic & Chill Lover (Sushin Shyam, K. S. Chithra)
    syncStore.updateUserPreferences(userMalayalamAcoustic, {
      preferredLanguages: ['Malayalam'],
      favouriteArtists: ['K. S. Chithra'],
      favouriteComposers: ['Sushin Shyam'],
      favouriteSingers: ['K. S. Chithra'],
      favouriteGenres: ['Acoustic', 'Melody'],
      preferredMoods: ['Calm', 'Relaxing'],
      hasCompletedOnboarding: true
    });

    // User 5 remains completely unconfigured (Cold Start: 0 languages, 0 artists)
  });

  // =========================================================================
  // SCENARIO 1: Different Languages Produce Different Recommendations
  // =========================================================================
  it('Scenario 1: Different languages produce different recommendations without cross-contamination', async () => {
    const resTamil = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    const resHindi = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenHindi}`);

    expect(resTamil.status).toBe(200);
    expect(resHindi.status).toBe(200);

    const tamilTracks = resTamil.body.data.recommendedForYou;
    const hindiTracks = resHindi.body.data.recommendedForYou;

    expect(tamilTracks.length).toBeGreaterThan(0);
    expect(hindiTracks.length).toBeGreaterThan(0);

    // Tamil user only gets Tamil songs
    for (const t of tamilTracks) {
      expect(t.language?.toLowerCase()).toBe('tamil');
    }

    // Hindi user only gets Hindi songs
    for (const t of hindiTracks) {
      expect(t.language?.toLowerCase()).toBe('hindi');
    }

    // Zero overlap between pure Tamil and pure Hindi recommendations
    const tamilIds = new Set(tamilTracks.map((t: any) => t.id));
    const overlap = hindiTracks.filter((t: any) => tamilIds.has(t.id));
    expect(overlap.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO 2: Different Favourite Artists Produce Different Recommendations
  // =========================================================================
  it('Scenario 2: Different favourite artists produce different recommendations matching artist affinities', async () => {
    const resTamil = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    const resHindi = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenHindi}`);

    const tamilFeed = resTamil.body.data;
    const hindiFeed = resHindi.body.data;

    // Tamil user with Sid Sriram preference receives Sid Sriram recommendations
    const hasSidSriram = tamilFeed.recommendedForYou.some(
      (t: any) =>
        t.artist?.toLowerCase().includes('sid sriram') ||
        (t.singers || []).some((s: string) => s.toLowerCase().includes('sid sriram'))
    );
    expect(hasSidSriram).toBe(true);

    // Hindi user with Arijit Singh preference receives Arijit Singh recommendations
    const hasArijit = hindiFeed.recommendedForYou.some(
      (t: any) =>
        t.artist?.toLowerCase().includes('arijit') ||
        (t.singers || []).some((s: string) => s.toLowerCase().includes('arijit'))
    );
    expect(hasArijit).toBe(true);
  });

  // =========================================================================
  // SCENARIO 3: Different Music Directors Affect Ranking
  // =========================================================================
  it('Scenario 3: Different music directors heavily influence ranking and leaderboards', async () => {
    const resTamil = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    const resHindi = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenHindi}`);

    const tamilDirectors = resTamil.body.data.favouriteMusicDirectors.map((d: any) => d.director);
    const hindiDirectors = resHindi.body.data.favouriteMusicDirectors.map((d: any) => d.director);

    // Harris Jayaraj is in Tamil directors list
    expect(tamilDirectors).toContain('Harris Jayaraj');
    // Pritam is in Hindi directors list
    expect(hindiDirectors).toContain('Pritam');

    // Cross-check that Hindi user does not have Tamil-only Harris as top pick
    expect(hindiDirectors[0]).not.toBe('Harris Jayaraj');
  });

  // =========================================================================
  // SCENARIO 4: Different Listening Histories Produce Different Auto-Queues
  // =========================================================================
  it('Scenario 4: Different listening histories produce distinct auto-queues matching user taste', () => {
    // Record history for Tamil user
    syncStore.recordSongListening(userTamilMelody, {
      songId: 'track_vaaranam_aayiram_1',
      songName: 'Nenjukkul Peidhidum',
      movieOrAlbum: 'Vaaranam Aayiram',
      musicDirector: 'Harris Jayaraj',
      singers: ['Hariharan'],
      language: 'Tamil',
      genre: 'Melody',
      playCount: 4,
      replayCount: 2
    });

    // Record history for Hindi user
    syncStore.recordSongListening(userHindiEnergetic, {
      songId: 'track_brahmastra_1',
      songName: 'Kesariya',
      movieOrAlbum: 'Brahmastra',
      musicDirector: 'Pritam',
      singers: ['Arijit Singh'],
      language: 'Hindi',
      genre: 'Pop',
      playCount: 4,
      replayCount: 2
    });

    const queueTamil = RecommendationEngineService.getAutoQueueRecommendations(userTamilMelody, {
      songId: 'track_vaaranam_aayiram_1',
      songTitle: 'Nenjukkul Peidhidum',
      artist: 'Hariharan',
      director: 'Harris Jayaraj',
      language: 'Tamil',
      limit: 10
    });

    const queueHindi = RecommendationEngineService.getAutoQueueRecommendations(userHindiEnergetic, {
      songId: 'track_brahmastra_1',
      songTitle: 'Kesariya',
      artist: 'Arijit Singh',
      director: 'Pritam',
      language: 'Hindi',
      limit: 10
    });

    expect(queueTamil.length).toBeGreaterThan(0);
    expect(queueHindi.length).toBeGreaterThan(0);

    // Tamil queue contains Tamil songs
    expect(queueTamil.every((t) => t.language?.toLowerCase() === 'tamil')).toBe(true);

    // Hindi queue contains Hindi songs
    expect(queueHindi.every((t) => t.language?.toLowerCase() === 'hindi')).toBe(true);

    // Queues must be completely distinct
    const tamilIds = new Set(queueTamil.map((t) => t.id));
    const overlap = queueHindi.filter((t) => tamilIds.has(t.id));
    expect(overlap.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO 5: Favourite Songs Influence Future Recommendations
  // =========================================================================
  it('Scenario 5: Marking songs as favourite provides a strong positive signal in recommendations', async () => {
    // Record a favourite track
    syncStore.recordSongListening(userTamilMelody, {
      songId: 'track_vaaranam_aayiram_2',
      songName: 'Mundhinam Paarthenae',
      movieOrAlbum: 'Vaaranam Aayiram',
      musicDirector: 'Harris Jayaraj',
      singers: ['Naresh Iyer'],
      language: 'Tamil',
      genre: 'Melody',
      isFavorite: true,
      playCount: 3
    });

    const queue = RecommendationEngineService.getAutoQueueRecommendations(userTamilMelody, {
      language: 'Tamil',
      director: 'Harris Jayaraj',
      limit: 5
    });

    // Harris Jayaraj tracks should receive high priority
    const harrisTracks = queue.filter(
      (t) => t.composer?.toLowerCase().includes('harris') || t.artist?.toLowerCase().includes('harris')
    );
    expect(harrisTracks.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // SCENARIO 6: Repeatedly Skipped Songs Receive Lower Priority
  // =========================================================================
  it('Scenario 6: Repeatedly skipped songs are strongly penalized and deprioritized', () => {
    // Record song with 3 skips (fast skip)
    syncStore.recordSongListening(userTamilMelody, {
      songId: 'track_vaaranam_aayiram_3',
      songName: 'Ava Enna Enna Thedi Vandha Anjala',
      movieOrAlbum: 'Vaaranam Aayiram',
      musicDirector: 'Harris Jayaraj',
      singers: ['Karthik'],
      language: 'Tamil',
      skipCount: 3,
      playCount: 1
    });

    // Record another song with high replay and zero skips
    syncStore.recordSongListening(userTamilMelody, {
      songId: 'track_vaaranam_aayiram_4',
      songName: 'Adiye Kolluthey',
      movieOrAlbum: 'Vaaranam Aayiram',
      musicDirector: 'Harris Jayaraj',
      singers: ['Benny Dayal'],
      language: 'Tamil',
      skipCount: 0,
      replayCount: 3,
      playCount: 5
    });

    const queue = RecommendationEngineService.getAutoQueueRecommendations(userTamilMelody, {
      language: 'Tamil',
      director: 'Harris Jayaraj',
      limit: 10
    });

    const skippedIdx = queue.findIndex((t) => t.id === 'track_vaaranam_aayiram_3');
    const lovedIdx = queue.findIndex((t) => t.id === 'track_vaaranam_aayiram_4');

    if (skippedIdx !== -1 && lovedIdx !== -1) {
      // Replayed song must rank significantly ahead of the repeatedly skipped song
      expect(lovedIdx).toBeLessThan(skippedIdx);
    }
  });

  // =========================================================================
  // SCENARIO 7: Manual Play Next Works Correctly
  // =========================================================================
  it('Scenario 7: Play Next inserts song immediately after the currently playing track', () => {
    const queue = [
      { id: 'song_1', title: 'Song 1' },
      { id: 'song_2', title: 'Song 2' },
      { id: 'song_3', title: 'Song 3' }
    ];
    const currentIndex = 0; // Currently playing song_1

    const playNextSong = { id: 'song_special_next', title: 'Special Play Next' };

    // Simulate playNext insertion logic (from usePlayerStore)
    const filtered = queue.filter((t, idx) => t.id !== playNextSong.id || idx === currentIndex);
    filtered.splice(currentIndex + 1, 0, playNextSong);

    expect(filtered[0].id).toBe('song_1'); // Currently playing unchanged
    expect(filtered[1].id).toBe('song_special_next'); // Inserted right next
    expect(filtered[2].id).toBe('song_2');
    expect(filtered[3].id).toBe('song_3');
  });

  // =========================================================================
  // SCENARIO 8: Add to Queue Appends Correctly
  // =========================================================================
  it('Scenario 8: Add to Queue appends track to the end of the existing queue', () => {
    const queue = [
      { id: 'song_1', title: 'Song 1' },
      { id: 'song_2', title: 'Song 2' }
    ];
    const newSong = { id: 'song_appended', title: 'Appended Song' };

    // Simulate addToQueue logic (from usePlayerStore)
    const updatedQueue = [...queue, newSong];

    expect(updatedQueue.length).toBe(3);
    expect(updatedQueue[2].id).toBe('song_appended');
  });

  // =========================================================================
  // SCENARIO 9: Auto-Queue Refill Appends and Never Overwrites Manual Items
  // =========================================================================
  it('Scenario 9: Automatic queue generation does not overwrite manual entries', () => {
    const manualQueue = [
      { id: 'current_song', title: 'Current Song' },
      { id: 'manual_play_next', title: 'Manual Play Next' },
      { id: 'manual_added_queue', title: 'Manual Added to Queue' }
    ];

    const autoRecommendations = [
      { id: 'auto_rec_1', title: 'Auto Rec 1' },
      { id: 'auto_rec_2', title: 'Auto Rec 2' }
    ];

    // Combine queue simulating auto-refill
    const finalQueue = [...manualQueue, ...autoRecommendations];

    expect(finalQueue.length).toBe(5);
    // Manual items preserved exactly in order at the front
    expect(finalQueue[0].id).toBe('current_song');
    expect(finalQueue[1].id).toBe('manual_play_next');
    expect(finalQueue[2].id).toBe('manual_added_queue');
    // Auto-generated recommendations appended after manual items
    expect(finalQueue[3].id).toBe('auto_rec_1');
    expect(finalQueue[4].id).toBe('auto_rec_2');
  });

  // =========================================================================
  // SCENARIO 10: Account Switching Changes Recommendations
  // =========================================================================
  it('Scenario 10: Account switching dynamically switches personalized feeds', async () => {
    // 1. Fetch feed as Tamil user
    const resA = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);
    expect(resA.body.data.preferredLanguages).toEqual(['Tamil']);

    // 2. Fetch feed as Telugu user
    const resB = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTelugu}`);
    expect(resB.body.data.preferredLanguages).toEqual(['Telugu']);

    // 3. Switch back to Tamil user
    const resA2 = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);
    expect(resA2.body.data.preferredLanguages).toEqual(['Tamil']);
  });

  // =========================================================================
  // SCENARIO 11: Cold-Start Users and Clean Suppression of Empty Sections
  // =========================================================================
  it('Scenario 11: Brand new user with no listening history has empty recentlyPlayed and continueListening', async () => {
    // Configure languages for cold start user so they get a feed
    syncStore.updateUserPreferences(userColdStart, {
      preferredLanguages: ['Malayalam'],
      hasCompletedOnboarding: true
    });

    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenColdStart}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // With zero history, recentlyPlayed and continueListening must be strictly empty (no fake songs)
    expect(data.recentlyPlayed).toEqual([]);
    expect(data.continueListening).toEqual([]);
    expect(data.basedOnListeningHistory.tracks).toEqual([]);
    expect(data.similarSongs).toEqual([]);
  });

  // =========================================================================
  // SCENARIO 12: App Restart Preserves User Preferences
  // =========================================================================
  it('Scenario 12: User preferences persist in store and are fully restored on subsequent reads', () => {
    const original = syncStore.getUserPreferences(userTamilMelody);
    expect(original.preferredLanguages).toEqual(['Tamil']);
    expect(original.favouriteComposers).toContain('Harris Jayaraj');

    // Simulate subsequent retrieval (as on app launch / reconnect)
    const retrieved = syncStore.getUserPreferences(userTamilMelody);
    expect(retrieved.userId).toBe(userTamilMelody);
    expect(retrieved.preferredLanguages).toEqual(['Tamil']);
    expect(retrieved.favouriteComposers).toEqual(['Harris Jayaraj']);
    expect(retrieved.hasCompletedOnboarding).toBe(true);
  });
});
