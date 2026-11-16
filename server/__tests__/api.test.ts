import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('SyncWave Backend API Test Suite', () => {
  let authToken: string;
  let userId: string;
  let testPlaylistId: string;
  let testScheduleId: string;

  it('GET /api/health returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('SyncWave Backend');
  });

  describe('Authentication Flow', () => {
    const testEmail = `user_${Date.now()}@syncwave.io`;
    const testPassword = 'securePassword123';

    it('POST /api/auth/register creates a new user and returns JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          displayName: 'Test Wave Rider'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.displayName).toBe('Test Wave Rider');

      authToken = res.body.token;
      userId = res.body.user.id;
    });

    it('POST /api/auth/login authenticates registered user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it('GET /api/auth/me returns authenticated user details', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe(userId);
      expect(res.body.settings).toBeDefined();
    });

    it('GET /api/auth/me rejects unauthorized request', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Playlists Management', () => {
    it('POST /api/playlists creates a new custom playlist', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Morning Productivity Beats',
          artworkUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Morning Productivity Beats');

      testPlaylistId = res.body.data.id;
    });

    it('GET /api/playlists lists user playlists including the new one', async () => {
      const res = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((p: any) => p.id === testPlaylistId);
      expect(found).toBeDefined();
    });

    it('GET /api/playlists/:id returns playlist details with songs', async () => {
      const res = await request(app)
        .get(`/api/playlists/${testPlaylistId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testPlaylistId);
      expect(Array.isArray(res.body.data.songs)).toBe(true);
    });
  });

  describe('Smart Music Scheduler API', () => {
    it('POST /api/schedules creates an automated time-based schedule', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Focus Work Routine',
          startTime: '09:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          targetType: 'PLAYLIST',
          targetId: testPlaylistId,
          targetName: 'Morning Productivity Beats',
          priority: 'NORMAL',
          transitionType: 'CROSSFADE',
          transitionSec: 4,
          volume: 0.85
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Focus Work Routine');
      expect(res.body.data.priority).toBe('NORMAL');
      expect(res.body.data.transitionSec).toBe(4);

      testScheduleId = res.body.data.id;
    });

    it('GET /api/schedules retrieves user schedules', async () => {
      const res = await request(app)
        .get('/api/schedules')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.find((s: any) => s.id === testScheduleId);
      expect(found).toBeDefined();
      expect(found.isEnabled).toBe(true);
    });

    it('PUT /api/schedules/:id toggles schedule status', async () => {
      const res = await request(app)
        .put(`/api/schedules/${testScheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isEnabled: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isEnabled).toBe(false);
    });

    it('POST /api/schedules/:id/execution records execution in schedule history', async () => {
      const res = await request(app)
        .post(`/api/schedules/${testScheduleId}/execution`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          success: true,
          statusMessage: 'Routine initiated successfully',
          clientPlatform: 'WEB'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scheduleId).toBe(testScheduleId);
    });

    it('GET /api/schedules/history/all returns execution logs', async () => {
      const res = await request(app)
        .get('/api/schedules/history/all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Favorites & History API', () => {
    it('POST /api/favorites/:targetId adds an item to favorites', async () => {
      const res = await request(app)
        .post('/api/favorites/song_sample_1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isFavorite).toBe(true);
    });

    it('GET /api/favorites returns favorite items', async () => {
      const res = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/history logs playback history', async () => {
      const res = await request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          songId: 'song_sample_1',
          songTitle: 'Echoes of Tomorrow',
          artistName: 'Solaris Wave',
          durationListenedMs: 120000,
          completed: true,
          clientPlatform: 'WEB'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.songTitle).toBe('Echoes of Tomorrow');
    });
  });

  describe('Music Discovery API', () => {
    it('GET /api/music/search returns search results', async () => {
      const res = await request(app).get('/api/music/search?q=synth');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.onlineMatches)).toBe(true);
    }, 15000);

    it('GET /api/music/discover returns curated platforms and playlists', async () => {
      const res = await request(app).get('/api/music/discover');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.platforms).toBeDefined();
      expect(res.body.featured).toBeDefined();
    });
  });
});
