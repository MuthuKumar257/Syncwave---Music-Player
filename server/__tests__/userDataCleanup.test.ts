import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { EXPECTED_RESET_CONFIRMATION } from '../src/routes/admin.routes';

describe('Complete User Data Deletion and Fresh Start Suite (Backend)', () => {
  let userToken = '';
  let userId = '';

  beforeEach(async () => {
    // Register a test user
    const email = `cleanup_test_${Date.now()}@syncwave.app`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'password123',
        displayName: 'Cleanup Target User'
      });
    expect(regRes.status).toBe(201);
    userToken = regRes.body.token;
    userId = regRes.body.user.id;

    // Create a playlist
    await request(app)
      .post('/api/playlists')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'User Private Playlist',
        songIds: ['sync_seed_1']
      });

    // Add a favorite
    await request(app)
      .post('/api/favorites/sync_seed_1')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        songTitle: 'Morning Focus & Clarity',
        artistName: 'SyncWave Ambience'
      });

    // Create a schedule
    await request(app)
      .post('/api/schedules')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Morning Wakeup Routine',
        startTime: '07:30',
        repeatType: 'DAILY',
        daysOfWeek: [1, 2, 3, 4, 5],
        targetType: 'PLAYLIST',
        targetId: 'pl_test',
        targetName: 'User Private Playlist',
        priority: 'HIGH',
        isEnabled: true
      });

    // Record listening event & history
    await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        songId: 'sync_seed_1',
        songTitle: 'Morning Focus & Clarity',
        artistName: 'SyncWave Ambience',
        durationListenedMs: 60000,
        completed: true,
        clientPlatform: 'WEB'
      });

    // Update preferences
    await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        preferredLanguages: ['Tamil', 'Hindi'],
        favouriteArtists: ['A. R. Rahman']
      });
  });

  it('GET /api/admin/data-summary returns accurate counts before reset', async () => {
    const res = await request(app).get('/api/admin/data-summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.userCounts.users).toBeGreaterThan(0);
    expect(data.userCounts.playlists).toBeGreaterThan(0);
    expect(data.userCounts.favorites).toBeGreaterThan(0);
    expect(data.userCounts.schedules).toBeGreaterThan(0);
    expect(data.userCounts.playHistory).toBeGreaterThan(0);
    expect(data.sharedSongsCount).toBeGreaterThan(0);
  });

  it('POST /api/admin/reset-user-data rejects requests without exact confirmation token', async () => {
    // Missing body
    const res1 = await request(app).post('/api/admin/reset-user-data').send({});
    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // Incorrect string
    const res2 = await request(app)
      .post('/api/admin/reset-user-data')
      .send({ confirmation: 'wrong_confirmation' });
    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
  });

  it('POST /api/admin/reset-user-data deletes all user data, creates backup, and strictly preserves shared catalogue songs', async () => {
    const songsBefore = syncStore.songs.size;
    expect(songsBefore).toBeGreaterThan(0);

    const res = await request(app)
      .post('/api/admin/reset-user-data')
      .send({ confirmation: EXPECTED_RESET_CONFIRMATION });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report).toBeDefined();

    const report = res.body.report;
    expect(report.totalRecordsDeleted).toBeGreaterThan(0);
    expect(report.deletedCounts.users).toBeGreaterThanOrEqual(1);
    expect(report.deletedCounts.playlists).toBeGreaterThanOrEqual(1);
    expect(report.deletedCounts.favorites).toBeGreaterThanOrEqual(1);
    expect(report.deletedCounts.schedules).toBeGreaterThanOrEqual(1);
    expect(report.deletedCounts.playHistory).toBeGreaterThanOrEqual(1);

    // Verify backup file exists
    if (report.backupFile) {
      expect(fs.existsSync(report.backupFile)).toBe(true);
      // Clean up the created test backup
      try {
        fs.unlinkSync(report.backupFile);
      } catch {}
    }

    // Verify in-memory store state is completely reset for users
    expect(syncStore.users.size).toBe(0);
    expect(syncStore.playlists.size).toBe(0);
    expect(syncStore.favorites.size).toBe(0);
    expect(syncStore.schedules.size).toBe(0);
    expect(syncStore.scheduleHistory.length).toBe(0);
    expect(syncStore.playHistory.length).toBe(0);
    expect(syncStore.listeningEvents.length).toBe(0);
    expect(syncStore.userPreferences.size).toBe(0);
    expect(syncStore.userSongStats.size).toBe(0);

    // CRITICAL: Shared songs MUST be preserved!
    expect(syncStore.songs.size).toBe(songsBefore);
    expect(report.preserved.sharedSongsCount).toBe(songsBefore);
    expect(report.preserved.schemaPreserved).toBe(true);
  });

  it('allows new users to register and start fresh with empty state after reset', async () => {
    // Ensure clean state
    await request(app)
      .post('/api/admin/reset-user-data')
      .send({ confirmation: EXPECTED_RESET_CONFIRMATION });

    // Register a brand new user
    const newEmail = `fresh_user_${Date.now()}@syncwave.app`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: newEmail,
        password: 'freshPassword123',
        displayName: 'Brand New Listener'
      });
    expect(regRes.status).toBe(201);
    const newToken = regRes.body.token;

    // Verify fresh user has 0 playlists
    const plRes = await request(app)
      .get('/api/playlists')
      .set('Authorization', `Bearer ${newToken}`);
    expect(plRes.status).toBe(200);
    expect(plRes.body.data || plRes.body.playlists).toEqual([]);

    // Verify fresh user has 0 favorites
    const favRes = await request(app)
      .get('/api/favorites')
      .set('Authorization', `Bearer ${newToken}`);
    expect(favRes.status).toBe(200);
    expect(favRes.body.data).toEqual([]);

    // Verify fresh user has 0 schedules
    const schedRes = await request(app)
      .get('/api/schedules')
      .set('Authorization', `Bearer ${newToken}`);
    expect(schedRes.status).toBe(200);
    expect(schedRes.body.data || schedRes.body.schedules).toEqual([]);

    // Verify shared songs are immediately playable for new user
    const songsRes = await request(app)
      .get('/api/songs')
      .set('Authorization', `Bearer ${newToken}`);
    expect(songsRes.status).toBe(200);
    expect((songsRes.body.data || songsRes.body.songs).length).toBeGreaterThan(0);
  });
});
