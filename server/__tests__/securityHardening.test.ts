import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { JWT_SECRET } from '../src/middleware/auth';
import { TokenBlacklistService } from '../src/services/auth/tokenBlacklist.service';
import { isSafePublicHttpsUrl } from '../src/services/download/fullAudioResolver.service';

describe('Comprehensive Security Hardening & Vulnerability Audit Test Suite', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;

  beforeEach(async () => {
    TokenBlacklistService.resetForTesting();

    // Register User A
    const userAEmail = `user_a_${Date.now()}_${Math.random().toString(36).substring(7)}@syncwave.app`;
    const regResA = await request(app)
      .post('/api/auth/register')
      .send({
        email: userAEmail,
        password: 'StrongPassword#2026',
        displayName: 'User Alpha'
      });
    expect(regResA.status).toBe(201);
    userAToken = regResA.body.token;
    userAId = regResA.body.user.id;

    // Register User B
    const userBEmail = `user_b_${Date.now()}_${Math.random().toString(36).substring(7)}@syncwave.app`;
    const regResB = await request(app)
      .post('/api/auth/register')
      .send({
        email: userBEmail,
        password: 'StrongPassword#2026',
        displayName: 'User Beta'
      });
    expect(regResB.status).toBe(201);
    userBToken = regResB.body.token;
    userBId = regResB.body.user.id;
  });

  describe('1. Authentication & Token Revocation Security', () => {
    it('Scenario 1: Rejects unauthenticated requests with HTTP 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('Scenario 2: Rejects requests with malformed or tampered JWT', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.token');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid or expired token/i);
    });

    it('Scenario 3: Rejects expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: userAId, email: 'expired@syncwave.app', exp: Math.floor(Date.now() / 1000) - 3600 },
        JWT_SECRET
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('Scenario 4: Token Revocation on Logout - logged out tokens are blacklisted immediately', async () => {
      // Step A: Token works before logout
      const beforeRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(beforeRes.status).toBe(200);

      // Step B: Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Step C: Subsequent request with the same token is blocked
      const afterRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(afterRes.status).toBe(401);
      expect(afterRes.body.code).toBe('TOKEN_REVOKED');
    });

    it('Scenario 5: Token Rotation on Refresh - old token is revoked once refreshed', async () => {
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      const freshToken = refreshRes.body.token;
      expect(freshToken).toBeDefined();
      expect(freshToken).not.toBe(userAToken);

      // Verify the new token works
      const freshCheck = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken}`);
      expect(freshCheck.status).toBe(200);

      // Verify the previous token was revoked (preventing token reuse / replay)
      const oldCheck = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(oldCheck.status).toBe(401);
      expect(oldCheck.body.code).toBe('TOKEN_REVOKED');
    });

    it('Scenario 6: Enforces strong password policy (min 8 chars, letters and numbers/symbols)', async () => {
      // Short password (< 8 chars)
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({
          email: `weak1_${Date.now()}@syncwave.app`,
          password: 'abc12',
          displayName: 'Weak User'
        });
      expect(res1.status).toBe(400);

      // Password with only letters, no numbers
      const res2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: `weak2_${Date.now()}@syncwave.app`,
          password: 'onlyletterslong',
          displayName: 'Weak User'
        });
      expect(res2.status).toBe(400);

      // Password with only numbers, no letters
      const res3 = await request(app)
        .post('/api/auth/register')
        .send({
          email: `weak3_${Date.now()}@syncwave.app`,
          password: '1234567890',
          displayName: 'Weak User'
        });
      expect(res3.status).toBe(400);
    });
  });

  describe('2. Authorization & IDOR Access Control', () => {
    it('Scenario 7: IDOR Protection on Playlists - User B cannot view User A private playlist', async () => {
      // User A creates a playlist
      const createRes = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'User A Secret Playlist', songIds: ['sync_seed_1'] });
      expect(createRes.status).toBe(201);
      const playlistId = createRes.body.data.id;

      // User B attempts to access User A's playlist
      const accessRes = await request(app)
        .get(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(accessRes.status).toBe(404);
      expect(accessRes.body.success).toBe(false);

      // User B attempts to delete User A's playlist
      const deleteRes = await request(app)
        .delete(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(deleteRes.status).toBe(404);
    });

    it('Scenario 8: IDOR Protection on Schedules - User B cannot view or modify User A schedule', async () => {
      // User A creates a schedule
      const createRes = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'User A Morning Routine',
          startTime: '06:30',
          repeatType: 'DAILY',
          daysOfWeek: [1, 2, 3, 4, 5],
          targetType: 'PLAYLIST',
          targetId: 'pl_test',
          targetName: 'Focus',
          priority: 'NORMAL',
          isEnabled: true
        });
      expect(createRes.status).toBe(201);
      const scheduleId = createRes.body.data.id;

      // User B attempts to read User A's schedule
      const readRes = await request(app)
        .get(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(readRes.status).toBe(404);

      // User B attempts to modify User A's schedule
      const updateRes = await request(app)
        .put(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ name: 'Tampered Schedule Name' });
      expect(updateRes.status).toBe(404);

      // User B attempts to delete User A's schedule
      const deleteRes = await request(app)
        .delete(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(deleteRes.status).toBe(404);
    });

    it('Scenario 9: IDOR Protection on Favorites - User B cannot see User A favorites', async () => {
      // User A favorites a song
      await request(app)
        .post('/api/favorites/secret_fav_song_1')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ songTitle: 'Secret Song', artistName: 'Secret Artist' });

      // User B requests their own favorites - must NOT contain User A's favorite
      const bFavsRes = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(bFavsRes.status).toBe(200);
      const bSongIds = bFavsRes.body.data.map((f: any) => f.targetId);
      expect(bSongIds).not.toContain('secret_fav_song_1');
    });

    it('Scenario 10: Song Deletion requires authenticated session', async () => {
      const res = await request(app).delete('/api/songs/any_song_id');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. SSRF, Redirect & Download Security', () => {
    it('Scenario 11: Blocks SSRF targets (Loopback, Cloud Metadata, RFC 1918 Private Ranges)', () => {
      // Loopback
      expect(isSafePublicHttpsUrl('http://127.0.0.1:3000/')).toBe(false);
      expect(isSafePublicHttpsUrl('https://127.0.0.1:443/')).toBe(false);
      expect(isSafePublicHttpsUrl('https://localhost/')).toBe(false);

      // Cloud Metadata & Link-Local
      expect(isSafePublicHttpsUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
      expect(isSafePublicHttpsUrl('https://metadata.google.internal/')).toBe(false);

      // Private RFC 1918
      expect(isSafePublicHttpsUrl('https://10.0.0.1/audio.mp3')).toBe(false);
      expect(isSafePublicHttpsUrl('https://192.168.1.1/audio.mp3')).toBe(false);
      expect(isSafePublicHttpsUrl('https://172.16.0.1/audio.mp3')).toBe(false);

      // Non-HTTPS
      expect(isSafePublicHttpsUrl('http://example.com/audio.mp3')).toBe(false);

      // Non-standard port
      expect(isSafePublicHttpsUrl('https://example.com:8443/audio.mp3')).toBe(false);

      // Embedded credentials
      expect(isSafePublicHttpsUrl('https://user:pass@example.com/audio.mp3')).toBe(false);

      // Valid Public HTTPS CDN / Archive
      expect(isSafePublicHttpsUrl('https://ia800100.us.archive.org/audio.mp3')).toBe(true);
      expect(isSafePublicHttpsUrl('https://p.scdn.co/mp3/preview.mp3')).toBe(true);
    });

    it('Scenario 12: Blocks SSRF on POST /api/history/supabase-config', async () => {
      const ssrfRes = await request(app)
        .post('/api/history/supabase-config')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          supabaseUrl: 'https://169.254.169.254',
          supabaseKey: 'some-dummy-service-key'
        });
      expect(ssrfRes.status).toBe(400);
      expect(ssrfRes.body.success).toBe(false);
    });
  });

  describe('4. Security Headers, Error Sanitization & Defensive Boundaries', () => {
    it('Scenario 13: Emits comprehensive HTTP security headers and conceals server framework', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);

      // Server fingerprint must not be leaked
      expect(res.headers['x-powered-by']).toBeUndefined();

      // Modern security headers
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('Scenario 14: Centralized 404 handler returns structured JSON without stack traces', async () => {
      const res = await request(app).get('/api/non-existent-endpoint-vulnerability-check');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.stack).toBeUndefined();
    });

    it('Scenario 15: Rejects excessively oversized JSON payload to prevent memory exhaustion DoS', async () => {
      const oversizedPayload = {
        name: 'DoS'.repeat(500000) // ~1.5MB > 1MB limit
      };
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(oversizedPayload);
      // Express 1mb limit triggers 413 Payload Too Large
      expect([413, 500]).toContain(res.status);
    });
  });

  describe('5. Supabase Database Schema Row Level Security (RLS)', () => {
    it('Scenario 16: Verifies schema.sql contains comprehensive RLS policies for all 15 tables', () => {
      const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
      expect(fs.existsSync(schemaPath)).toBe(true);
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      const requiredRlsTables = [
        'users',
        'playlists',
        'playlist_songs',
        'favorites',
        'music_schedules',
        'schedule_history',
        'play_history',
        'user_settings',
        'user_music_preferences',
        'listening_events',
        'recommendation_feedback',
        'daily_mixes',
        'songs',
        'artists',
        'languages'
      ];

      for (const table of requiredRlsTables) {
        const hasRls = schemaSql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
        expect(hasRls, `Table ${table} must have ROW LEVEL SECURITY enabled in schema.sql`).toBe(true);
      }
    });

    it('Scenario 17: Validates that TokenBlacklistService automatically handles TTL expiration', () => {
      const testToken = 'test.jwt.token';
      // Token expired 1 second ago
      TokenBlacklistService.revokeToken(testToken, Math.floor(Date.now() / 1000) - 1);
      // isTokenRevoked will see it's past expiresAtMs and return false
      expect(TokenBlacklistService.isTokenRevoked(testToken)).toBe(false);

      // Token expiring in 100 seconds
      TokenBlacklistService.revokeToken(testToken, Math.floor(Date.now() / 1000) + 100);
      expect(TokenBlacklistService.isTokenRevoked(testToken)).toBe(true);
    });
  });
});
