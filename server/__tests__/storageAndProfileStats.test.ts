import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Local-Device Downloads, Supabase History Policy & Profile Stats API', () => {
  let token = '';

  beforeAll(async () => {
    const email = `stats_tester_${Date.now()}@syncwave.app`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'password123',
        displayName: 'Stats Listener'
      });

    expect(res.status).toBe(201);
    token = res.body.token;
  });

  it('GET /api/history/status reports Supabase-only history & local-device downloads policy', async () => {
    const res = await request(app).get('/api/history/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.storagePolicy).toBe('HISTORY_SUPABASE_ONLY');
    expect(res.body.downloadsStorage).toBe('LOCAL_DEVICE_ONLY');
    expect(res.body.tables).toEqual(['play_history', 'listening_events', 'schedule_history']);
  });

  it('POST /api/songs blocks uploading DOWNLOADED tracks to server/Supabase', async () => {
    const res = await request(app)
      .post('/api/songs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: 'local_dl_track_1',
        title: 'En Kannu Kulla',
        artist: 'Vishal Chandrasekhar',
        source: 'DOWNLOADED'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('local device');
  });

  it('GET /api/recommendations/profile-stats computes favouriteArtist, mostListenedArtist & mostRewatchedSongs', async () => {
    // 1. Set favourite artist preference
    await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        favouriteComposers: ['A. R. Rahman'],
        favouriteSingers: ['Sid Sriram'],
        favouriteArtists: ['A. R. Rahman']
      });

    // 2. Log playback history (En Kannu Kulla played 3 times -> most listened & most rewatched)
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          songId: 'track_appuchi_1',
          songTitle: 'En Kannu Kulla',
          artistName: 'Vishal Chandrasekhar',
          durationListenedMs: 210000,
          completed: true,
          clientPlatform: 'WEB'
        });
    }

    for (let i = 0; i < 2; i++) {
      await request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          songId: 'track_vaaranam_1',
          songTitle: 'Nenjukkul Peidhidum',
          artistName: 'Harris Jayaraj',
          durationListenedMs: 240000,
          completed: true,
          clientPlatform: 'WEB'
        });
    }

    // 3. Query computed Profile Stats
    const statsRes = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);

    const stats = statsRes.body.stats;
    expect(stats.favouriteArtist?.name).toBe('A. R. Rahman');
    expect(stats.mostListenedArtist?.name).toBe('Vishal Chandrasekhar');
    expect(stats.mostListenedArtist?.playCount).toBe(3);

    expect(stats.mostRewatchedSongs.length).toBeGreaterThanOrEqual(2);
    expect(stats.mostRewatchedSongs[0].title).toBe('En Kannu Kulla');
    expect(stats.mostRewatchedSongs[0].playCount).toBe(3);
    expect(stats.mostRewatchedSongs[0].rewatchCount).toBe(2);
    expect(stats.summary.totalPlays).toBe(5);
    expect(stats.summary.totalRewatches).toBe(2);
  });
});
