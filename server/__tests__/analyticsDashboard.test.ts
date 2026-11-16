import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';

describe('Music Player Analytics Dashboard – All 10 Requirement Scenarios', () => {
  let user1Token = '';
  let user1Email = '';

  beforeAll(async () => {
    user1Email = `analytics_tester_${Date.now()}@syncwave.app`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: user1Email,
        password: 'password123',
        displayName: 'Analytics Listener'
      });

    expect(res.status).toBe(201);
    user1Token = res.body.token;
  });

  // Scenario 1: Single play session (5+ seconds)
  it('Scenario 1: Single play session records total plays, listening time, and history', async () => {
    const playRes = await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        songId: 's1_anirudh_hukum',
        songTitle: 'Hukum',
        artistName: 'Anirudh Ravichander',
        musicDirector: 'Anirudh Ravichander',
        language: 'Tamil',
        durationListenedMs: 65000,
        completed: false,
        clientPlatform: 'WEB'
      });
    expect(playRes.status).toBe(201);

    await request(app)
      .post('/api/recommendations/listening-stat')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        songId: 's1_anirudh_hukum',
        songName: 'Hukum',
        movieOrAlbum: 'Jailer',
        musicDirector: 'Anirudh Ravichander',
        singers: ['Anirudh Ravichander'],
        language: 'Tamil',
        playCount: 1,
        replayCount: 0,
        totalListeningDurationMs: 65000,
        lastPlayedAt: new Date().toISOString()
      });

    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(statsRes.status).toBe(200);
    const stats = statsRes.body.stats;
    expect(stats.summary.totalPlays).toBeGreaterThanOrEqual(1);
    expect(stats.summary.totalListeningMinutes).toBeGreaterThanOrEqual(1);
    expect(stats.summary.formattedListeningTime).toBeDefined();
    expect(stats.summary.uniqueArtistsListened).toBeGreaterThanOrEqual(1);
  });

  // Scenario 2: Play the same song 3 times
  it('Scenario 2: Playing the same song 3 times results in 3 total plays and 1 rewatched song', async () => {
    const user2Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `scenario2_${Date.now()}@syncwave.app`,
        password: 'password123',
        displayName: 'Scenario 2 User'
      });
    const token = user2Res.body.token;
    const songId = 's2_ar_rahman_urvashi';

    // Play 3 times
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          songId,
          songTitle: 'Urvashi Urvashi',
          artistName: 'A. R. Rahman',
          musicDirector: 'A. R. Rahman',
          language: 'Tamil',
          durationListenedMs: 120000,
          completed: true,
          playedAt: new Date(Date.now() - (3 - i) * 10000).toISOString(),
          clientPlatform: 'WEB'
        });
    }

    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    const stats = statsRes.body.stats;
    expect(stats.summary.totalPlays).toBe(3);
    expect(stats.summary.totalRewatches).toBe(1);

    const rewatchedSong = stats.mostRewatchedSongs.find((s: any) => s.songId === songId);
    expect(rewatchedSong).toBeDefined();
    expect(rewatchedSong.playCount).toBe(3);
    expect(rewatchedSong.rewatchCount).toBe(2);
  });

  // Scenario 3: Play 5 different songs across 3 artists
  it('Scenario 3: Playing 5 songs across 3 artists tracks unique artists and ranked leaderboard', async () => {
    const user3Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `scenario3_${Date.now()}@syncwave.app`,
        password: 'password123',
        displayName: 'Scenario 3 User'
      });
    const token = user3Res.body.token;

    // 5 different songs across 3 artists (Harris: 3 songs, Yuvan: 1 song, Raaja: 1 song)
    // Total plays = 5, Total unique artists = 3
    const tracks = [
      { id: 't_hj_1', title: 'Vaseegara', artist: 'Harris Jayaraj', dir: 'Harris Jayaraj', duration: 120000 },
      { id: 't_hj_2', title: 'Annul Maelae', artist: 'Harris Jayaraj', dir: 'Harris Jayaraj', duration: 120000 },
      { id: 't_hj_3', title: 'Uyirin Uyire', artist: 'Harris Jayaraj', dir: 'Harris Jayaraj', duration: 120000 },
      { id: 't_yuvan_1', title: 'Loosu Penne', artist: 'Yuvan Shankar Raja', dir: 'Yuvan Shankar Raja', duration: 180000 },
      { id: 't_raaja_1', title: 'Thendral Vanthu', artist: 'Ilaiyaraaja', dir: 'Ilaiyaraaja', duration: 60000 }
    ];

    for (let idx = 0; idx < tracks.length; idx++) {
      const t = tracks[idx];
      await request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          songId: t.id,
          songTitle: t.title,
          artistName: t.artist,
          musicDirector: t.dir,
          durationListenedMs: t.duration,
          completed: true,
          playedAt: new Date(Date.now() - (10 - idx) * 10000).toISOString(),
          clientPlatform: 'WEB'
        });
    }

    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    const stats = statsRes.body.stats;

    // Total plays: 5 different songs played = 5
    expect(stats.summary.totalPlays).toBe(5);
    // Unique artists: Harris Jayaraj, Yuvan Shankar Raja, Ilaiyaraaja = 3
    expect(stats.summary.uniqueArtistsListened).toBe(3);

    // Most listened artist should be Harris Jayaraj (3 plays, 60%)
    expect(stats.mostListenedArtist?.name).toBe('Harris Jayaraj');
    expect(stats.mostListenedArtist?.playCount).toBe(3);
    expect(stats.mostListenedArtist?.percentage).toBe(60);

    // Leaderboard order
    expect(stats.topListenedArtists[0].name).toBe('Harris Jayaraj');
    expect(stats.topListenedArtists[1].name).toBe('Yuvan Shankar Raja');
    expect(stats.topListenedArtists[2].name).toBe('Ilaiyaraaja');
  });

  // Scenario 4: Playing songs in multiple languages (Tamil, Telugu, Hindi)
  it('Scenario 4: Language breakdown correctly calculates count and percentage', async () => {
    const user4Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `scenario4_${Date.now()}@syncwave.app`,
        password: 'password123',
        displayName: 'Multilingual Listener'
      });
    const token = user4Res.body.token;

    // Tamil: 3 plays
    // Telugu: 2 plays
    // Hindi: 1 play
    const languageItems = [
      { id: 'lang_tam_1', title: 'Arabic Kuthu', artist: 'Anirudh', lang: 'Tamil', count: 3 },
      { id: 'lang_tel_1', title: 'Butta Bomma', artist: 'Thaman S', lang: 'Telugu', count: 2 },
      { id: 'lang_hin_1', title: 'Kesariya', artist: 'Pritam', lang: 'Hindi', count: 1 }
    ];

    for (const item of languageItems) {
      for (let i = 0; i < item.count; i++) {
        await request(app)
          .post('/api/history')
          .set('Authorization', `Bearer ${token}`)
          .send({
            songId: `${item.id}_${i}`,
            songTitle: item.title,
            artistName: item.artist,
            language: item.lang,
            durationListenedMs: 90000,
            completed: true,
            playedAt: new Date(Date.now() - (6 - i) * 60000).toISOString(),
            clientPlatform: 'WEB'
          });
      }
    }

    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    const stats = statsRes.body.stats;
    const breakdown = stats.languageBreakdown;

    expect(breakdown).toBeDefined();
    const tamil = breakdown.find((b: any) => b.language === 'Tamil');
    const telugu = breakdown.find((b: any) => b.language === 'Telugu');
    const hindi = breakdown.find((b: any) => b.language === 'Hindi');

    expect(tamil).toBeDefined();
    expect(tamil.count).toBe(3);
    expect(tamil.percentage).toBe(50); // 3 out of 6 = 50%

    expect(telugu).toBeDefined();
    expect(telugu.count).toBe(2);
    expect(telugu.percentage).toBe(33); // 2 out of 6 = 33%

    expect(hindi).toBeDefined();
    expect(hindi.count).toBe(1);
    expect(hindi.percentage).toBe(17); // 1 out of 6 = 17%
  });

  // Scenario 5: Multiple Music Directors
  it('Scenario 5: Top Music Directors section displays each director with correct play and track counts', async () => {
    const user5Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `scenario5_${Date.now()}@syncwave.app`,
        password: 'password123',
        displayName: 'Director Fan'
      });
    const token = user5Res.body.token;

    // Director 1 (A. R. Rahman): 2 unique tracks, 3 plays
    // Director 2 (Anirudh Ravichander): 1 track, 2 plays
    await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({
        songId: 'arr_song_1',
        songTitle: 'Roja',
        artistName: 'S. P. Balasubrahmanyam',
        musicDirector: 'A. R. Rahman',
        durationListenedMs: 120000,
        completed: true,
        playedAt: new Date(Date.now() - 30000).toISOString(),
        clientPlatform: 'WEB'
      });

    await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({
        songId: 'arr_song_2',
        songTitle: 'Pudhu Vellai Mazhai',
        artistName: 'Unni Menon',
        musicDirector: 'A. R. Rahman',
        durationListenedMs: 120000,
        completed: true,
        playedAt: new Date(Date.now() - 20000).toISOString(),
        clientPlatform: 'WEB'
      });

    await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({
        songId: 'arr_song_2',
        songTitle: 'Pudhu Vellai Mazhai',
        artistName: 'Unni Menon',
        musicDirector: 'A. R. Rahman',
        durationListenedMs: 120000,
        completed: true,
        playedAt: new Date(Date.now() - 10000).toISOString(),
        clientPlatform: 'WEB'
      });

    // Anirudh: 1 track, 2 plays
    await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({
        songId: 'ani_song_1',
        songTitle: 'Why This Kolaveri Di',
        artistName: 'Dhanush',
        musicDirector: 'Anirudh Ravichander',
        durationListenedMs: 100000,
        completed: true,
        playedAt: new Date().toISOString(),
        clientPlatform: 'WEB'
      });

    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    const directors = statsRes.body.stats.topListenedDirectors;
    expect(directors.length).toBeGreaterThanOrEqual(2);

    expect(directors[0].name).toBe('A. R. Rahman');
    expect(directors[0].playCount).toBe(3);
    expect(directors[0].uniqueSongsCount).toBe(2);
    expect(directors[0].imageUrl).toBeDefined();

    expect(directors[1].name).toBe('Anirudh Ravichander');
    expect(directors[1].playCount).toBe(1);
  });

  // Scenario 6: Daily Activity over 7 days
  it('Scenario 6: Daily activity timeline returns all 7 days with non-NaN bars and zero-play days', async () => {
    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(statsRes.status).toBe(200);
    const dailyActivity = statsRes.body.stats.dailyActivity;

    expect(dailyActivity).toBeDefined();
    expect(dailyActivity.length).toBe(7);

    for (const day of dailyActivity) {
      expect(day.date).toBeDefined();
      expect(day.day).toBeDefined();
      expect(typeof day.plays).toBe('number');
      expect(isNaN(day.plays)).toBe(false);
      expect(day.plays).toBeGreaterThanOrEqual(0);
    }
  });

  // Scenario 7: Missing metadata resilience
  it('Scenario 7: Gracefully handles missing artist, director, or language without crashes', async () => {
    const user7Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `scenario7_${Date.now()}@syncwave.app`,
        password: 'password123',
        displayName: 'Fallback Listener'
      });
    const token = user7Res.body.token;

    // Track with missing metadata
    const playRes = await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({
        songId: 'track_empty_meta_1',
        songTitle: 'Untitled Audio File',
        durationListenedMs: 30000,
        completed: false,
        clientPlatform: 'WEB'
      });
    expect(playRes.status).toBe(201);

    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);
    expect(statsRes.body.stats.summary.totalPlays).toBe(1);
  });

  // Scenario 8: Persistence across restarts and disk loading
  it('Scenario 8: SyncStore persistence to and from disk preserves analytics data', async () => {
    // 1. Verify syncStore loaded and has users
    const userCount = syncStore.getAllUsers().length;
    expect(userCount).toBeGreaterThan(0);

    // 2. Perform disk load check
    syncStore.loadFromDisk();
    const userAfterLoad = syncStore.findUserByEmail(user1Email);
    expect(userAfterLoad).toBeDefined();
    expect(userAfterLoad?.email).toBe(user1Email);
  });

  // Scenario 9: Offline playback synchronization
  it('Scenario 9: Queued offline events synchronize and update stats immediately', async () => {
    const user9Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `scenario9_${Date.now()}@syncwave.app`,
        password: 'password123',
        displayName: 'Offline Sync User'
      });
    const token = user9Res.body.token;

    // Simulate batch upload of 2 offline plays
    await Promise.all([
      request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          songId: 'offline_t1',
          songTitle: 'Offline Song 1',
          artistName: 'Offline Artist',
          durationListenedMs: 120000,
          completed: true,
          playedAt: new Date(Date.now() - 3600000).toISOString(),
          clientPlatform: 'WEB'
        }),
      request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          songId: 'offline_t2',
          songTitle: 'Offline Song 2',
          artistName: 'Offline Artist',
          durationListenedMs: 180000,
          completed: true,
          playedAt: new Date(Date.now() - 1800000).toISOString(),
          clientPlatform: 'WEB'
        })
    ]);

    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.stats.summary.totalPlays).toBe(2);
    expect(statsRes.body.stats.summary.totalListeningMinutes).toBe(5); // (120s + 180s) / 60 = 5m
    expect(statsRes.body.stats.summary.formattedListeningTime).toBe('5m');
  });

  // Scenario 10: Edit taste profile in settings
  it('Scenario 10: Changing taste preferences immediately updates favourite artist if no history', async () => {
    const user10Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `scenario10_${Date.now()}@syncwave.app`,
        password: 'password123',
        displayName: 'Taste Profile User'
      });
    const token = user10Res.body.token;

    // Set initial favourite artist
    await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        favouriteArtists: ['Harris Jayaraj'],
        favouriteComposers: ['Harris Jayaraj']
      });

    let statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.stats.favouriteArtist?.name).toBe('Harris Jayaraj');

    // Update to A. R. Rahman
    await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        favouriteArtists: ['A. R. Rahman'],
        favouriteComposers: ['A. R. Rahman']
      });

    statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.stats.favouriteArtist?.name).toBe('A. R. Rahman');
  });
});
