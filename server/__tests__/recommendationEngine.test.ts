import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';

describe('AI-Powered Recommendation & Language Discovery API Suite', () => {
  const testUserId = 'test_rec_user_1';

  beforeEach(() => {
    syncStore.resetUserPreferences(testUserId);
  });

  it('GET /api/users/me/preferences returns initial user music preferences', async () => {
    const res = await request(app)
      .get('/api/users/me/preferences')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preferences).toBeDefined();
    expect(Array.isArray(res.body.preferences.preferredLanguages)).toBe(true);
    expect(res.body.preferences.personalizationEnabled).toBe(true);
  });

  it('PUT /api/users/me/preferences updates preferred languages and favorite artists', async () => {
    const updates = {
      preferredLanguages: ['Tamil', 'Malayalam'],
      favouriteArtists: ['Anirudh Ravichander', 'Sushin Shyam'],
      favouriteGenres: ['Melody', 'Film Score']
    };

    const res = await request(app)
      .put('/api/users/me/preferences')
      .set('X-User-Id', testUserId)
      .send(updates);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preferences.preferredLanguages).toEqual(['Tamil', 'Malayalam']);
    expect(res.body.preferences.favouriteArtists).toContain('Anirudh Ravichander');
  });

  it('GET /api/recommendations returns multi-category personalized feed', async () => {
    const res = await request(app)
      .get('/api/recommendations')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    expect(data.greeting).toBeDefined();
    expect(data.timeOfDay).toBeDefined();
    expect(Array.isArray(data.madeForYou)).toBe(true);
    expect(data.madeForYou.length).toBeGreaterThanOrEqual(1);

    // Language Sections
    expect(Array.isArray(data.languageSections)).toBe(true);
    expect(data.languageSections.length).toBeGreaterThanOrEqual(1);

    // Daily Mixes
    expect(Array.isArray(data.dailyMixes)).toBe(true);
    expect(data.dailyMixes.length).toBeGreaterThanOrEqual(1);

    // Time-based picks
    expect(data.timeBasedPicks).toBeDefined();
    expect(Array.isArray(data.timeBasedPicks.tracks)).toBe(true);

    // Movie soundtracks
    expect(Array.isArray(data.movieSoundtracks)).toBe(true);
  });

  it('POST /api/recommendations/feedback with HIDE removes track from recommendations', async () => {
    // 1. Get initial feed to select a track
    const initialRes = await request(app)
      .get('/api/recommendations')
      .set('X-User-Id', testUserId);
    const trackToHide = initialRes.body.data.madeForYou[0];
    expect(trackToHide).toBeDefined();

    // 2. Submit HIDE feedback
    const feedbackRes = await request(app)
      .post('/api/recommendations/feedback')
      .set('X-User-Id', testUserId)
      .send({
        targetId: trackToHide.id,
        targetType: 'SONG',
        feedbackType: 'HIDE'
      });
    expect(feedbackRes.status).toBe(200);
    expect(feedbackRes.body.success).toBe(true);

    // 3. Get updated feed; hidden track should no longer be in madeForYou
    const updatedRes = await request(app)
      .get('/api/recommendations')
      .set('X-User-Id', testUserId);
    const found = updatedRes.body.data.madeForYou.find((t: any) => t.id === trackToHide.id);
    expect(found).toBeUndefined();
  });

  it('POST /api/listening-events logs interaction and influences learning scores', async () => {
    const eventRes = await request(app)
      .post('/api/listening-events')
      .set('X-User-Id', testUserId)
      .send({
        songId: 'track_test_1',
        songTitle: 'Naa Ready',
        artistName: 'Anirudh Ravichander',
        language: 'Tamil',
        eventType: 'LIKE',
        durationPlayedSec: 240,
        totalDurationSec: 240,
        clientPlatform: 'WEB'
      });

    expect(eventRes.status).toBe(200);
    expect(eventRes.body.success).toBe(true);
    expect(eventRes.body.event.id).toBeDefined();
  });

  it('POST /api/recommendations/generate-smart-playlist generates structured playlist', async () => {
    const res = await request(app)
      .post('/api/recommendations/generate-smart-playlist')
      .set('X-User-Id', testUserId)
      .send({
        language: 'Tamil',
        genreOrMood: 'Melody',
        targetDurationMinutes: 45
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const playlist = res.body.playlist;

    expect(playlist.name).toContain('Tamil');
    expect(Array.isArray(playlist.tracks)).toBe(true);
    expect(playlist.tracks.length).toBeGreaterThanOrEqual(1);
    expect(playlist.totalDurationMs).toBeGreaterThan(0);
  });

  it('GET /api/recommendations/similar/:songId returns related songs by composer and language', async () => {
    const res = await request(app).get('/api/recommendations/similar/track_vaaranam_aayiram_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.similarTracks)).toBe(true);
  });

  it('GET /api/recommendations returns 10 explicit dashboard sections', async () => {
    const res = await request(app)
      .get('/api/recommendations')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // 10 Dashboard sections verification:
    expect(Array.isArray(data.recentlyPlayed)).toBe(true);
    expect(Array.isArray(data.continueListening)).toBe(true);
    expect(Array.isArray(data.recommendedForYou)).toBe(true);
    expect(data.basedOnListeningHistory).toBeDefined();
    expect(Array.isArray(data.basedOnListeningHistory.tracks)).toBe(true);
    expect(Array.isArray(data.favouriteMusicDirectors)).toBe(true);
    expect(Array.isArray(data.favouriteSingers)).toBe(true);
    expect(Array.isArray(data.trendingInLanguages)).toBe(true);
    expect(Array.isArray(data.newReleases)).toBe(true);
    expect(Array.isArray(data.discoverNewMusic)).toBe(true);
    expect(Array.isArray(data.movieSoundtracks)).toBe(true);
  });

  it('GET /api/recommendations/artists retrieves filtered and searched artists', async () => {
    // 1. All directors
    const dirRes = await request(app).get('/api/recommendations/artists?role=DIRECTOR&languages=Tamil,Telugu');
    expect(dirRes.status).toBe(200);
    expect(dirRes.body.success).toBe(true);
    expect(dirRes.body.artists.length).toBeGreaterThan(0);
    expect(dirRes.body.artists.every((a: any) => a.role === 'DIRECTOR')).toBe(true);

    // 2. Singers with search query
    const searchRes = await request(app).get('/api/recommendations/artists?role=SINGER&q=Sid');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.success).toBe(true);
    expect(searchRes.body.artists.some((a: any) => a.name.includes('Sid Sriram'))).toBe(true);
  });

  it('POST /api/recommendations/listening-stat trains behavioral model and influences rankings', async () => {
    // Record high replay on Harris Jayaraj song
    const statRes = await request(app)
      .post('/api/recommendations/listening-stat')
      .set('X-User-Id', testUserId)
      .send({
        songId: 'track_vaaranam_aayiram_1',
        songName: 'Nenjukkul Peidhidum',
        movieOrAlbum: 'Vaaranam Aayiram',
        musicDirector: 'Harris Jayaraj',
        singers: ['Hariharan'],
        language: 'Tamil',
        genre: 'Melody',
        playCount: 5,
        replayCount: 3,
        totalListeningDurationMs: 650000,
        skipCount: 0,
        isFavorite: true
      });

    expect(statRes.status).toBe(200);
    expect(statRes.body.success).toBe(true);
    expect(statRes.body.stat.replayCount).toBe(3);

    // Verify history retrieval
    const historyRes = await request(app)
      .get('/api/recommendations/listening-history')
      .set('X-User-Id', testUserId);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.stats.length).toBeGreaterThanOrEqual(1);

    // Verify recommendation ranking incorporates the learned Harris Jayaraj preference
    const recRes = await request(app)
      .get('/api/recommendations')
      .set('X-User-Id', testUserId);
    expect(recRes.status).toBe(200);
    const topTracks = recRes.body.data.recommendedForYou;
    const harrisTrack = topTracks.find((t: any) => t.composer === 'Harris Jayaraj' || t.artist === 'Harris Jayaraj');
    expect(harrisTrack).toBeDefined();
  });

  it('POST /api/users/me/preferences/reset clears personalization history and feedback', async () => {
    const res = await request(app)
      .post('/api/users/me/preferences/reset')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preferences.favouriteArtists).toEqual([]);
  });

  it('GET /api/recommendations includes all 12 mood playlists, singers, directors, similar, popular & playable tracks', async () => {
    await request(app)
      .put('/api/users/me/preferences')
      .set('X-User-Id', testUserId)
      .send({
        preferredLanguages: ['Tamil', 'Hindi'],
        favouriteComposers: ['Harris Jayaraj'],
        favouriteSingers: ['Hariharan', 'Shreya Ghoshal'],
        favouriteArtists: ['Harris Jayaraj', 'Hariharan']
      });

    const res = await request(app)
      .get('/api/recommendations?seed=refresh_1')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // 1. Verify all 12 required moods in exact categories
    const expectedMoods = [
      'Happy', 'Sad', 'Romantic', 'Love', 'Motivation', 'Energetic',
      'Relaxing', 'Party', 'Melancholic', 'Devotional', 'Focus', 'Travel'
    ];
    expect(Array.isArray(data.moodPlaylists)).toBe(true);
    expect(data.moodPlaylists.length).toBe(12);
    expect(data.moodPlaylists.map((m: any) => m.mood)).toEqual(expectedMoods);
    for (const mood of data.moodPlaylists) {
      expect(mood.artworkUrl).toBeTruthy();
      expect(mood.description).toBeTruthy();
      expect(mood.tracks.length).toBeGreaterThanOrEqual(4);
      expect(mood.tracks.every((t: any) => Boolean(t.videoId || t.fullAudioUrl || t.previewUrl))).toBe(true);
    }

    // 2. Verify artist sections include images, songs & albums
    expect(Array.isArray(data.favouriteArtists)).toBe(true);
    expect(data.favouriteArtists.length).toBeGreaterThan(0);
    expect(Array.isArray(data.recommendedSingers)).toBe(true);
    expect(data.recommendedSingers.length).toBeGreaterThan(0);
    expect(Array.isArray(data.recommendedMusicDirectors)).toBe(true);
    expect(data.recommendedMusicDirectors.length).toBeGreaterThan(0);
    expect(data.recommendedMusicDirectors[0].imageUrl).toBeTruthy();
    expect(data.recommendedMusicDirectors[0].tracks.length).toBeGreaterThan(0);
    expect(data.recommendedMusicDirectors[0].albums.length).toBeGreaterThan(0);

    // 3. Verify similarSongs, popularSongs, trendingInLanguages, discoverNewMusic
    expect(data.similarSongs.length).toBeGreaterThan(0);
    expect(data.popularSongs.length).toBeGreaterThan(0);
    expect(data.trendingInLanguages.length).toBeGreaterThan(0);
    expect(data.discoverNewMusic.length).toBeGreaterThan(0);
    expect(data.madeForYou.every((t: any) => Boolean(t.videoId || t.fullAudioUrl || t.previewUrl))).toBe(true);
  });

  it('GET /api/recommendations/mood/:moodId and /artist/:artistName return detail collections', async () => {
    const moodRes = await request(app).get('/api/recommendations/mood/energetic').set('X-User-Id', testUserId);
    expect(moodRes.status).toBe(200);
    expect(moodRes.body.moodPlaylist.mood).toBe('Energetic');
    expect(moodRes.body.moodPlaylist.tracks.length).toBeGreaterThan(0);

    const artistRes = await request(app)
      .get(`/api/recommendations/artist/${encodeURIComponent('Harris Jayaraj')}`)
      .set('X-User-Id', testUserId);
    expect(artistRes.status).toBe(200);
    expect(artistRes.body.artist.name).toBe('Harris Jayaraj');
    expect(artistRes.body.artist.tracks.length).toBeGreaterThan(0);
    expect(artistRes.body.artist.albums.length).toBeGreaterThan(0);
  });

  it('POST /api/recommendations/auto-queue generates continuous queue with correct priority, diversity, and exclusions', async () => {
    const res = await request(app)
      .post('/api/recommendations/auto-queue')
      .set('X-User-Id', testUserId)
      .send({
        songTitle: 'Nenjukkul Peidhidum',
        artist: 'Hariharan, Harris Jayaraj',
        director: 'Harris Jayaraj',
        language: 'Tamil',
        excludeIds: ['track_excluded_1', 'track_excluded_2'],
        limit: 10
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.tracks)).toBe(true);
    expect(res.body.tracks.length).toBeGreaterThan(0);

    // Verify excluded IDs never appear
    const trackIds = res.body.tracks.map((t: any) => t.id);
    expect(trackIds).not.toContain('track_excluded_1');
    expect(trackIds).not.toContain('track_excluded_2');

    // Verify prioritized language is respected
    const tamilTracks = res.body.tracks.filter((t: any) => t.language?.toLowerCase() === 'tamil');
    expect(tamilTracks.length).toBeGreaterThan(0);

    // Verify variety: not all tracks are from a single composer
    const composers = new Set(res.body.tracks.map((t: any) => t.composer || t.artist));
    expect(composers.size).toBeGreaterThan(1);
  });

  it('GET /api/recommendations/auto-queue query endpoint works smoothly', async () => {
    const res = await request(app)
      .get('/api/recommendations/auto-queue?language=Tamil&director=Harris%20Jayaraj&limit=5')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tracks.length).toBeGreaterThan(0);
    expect(res.body.tracks.length).toBeLessThanOrEqual(5);
  });
});
