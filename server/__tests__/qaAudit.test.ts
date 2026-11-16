import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { JWT_SECRET } from '../src/middleware/auth';
import { validateDownloadedDuration } from '../src/services/download/fullAudioResolver.service';

describe('QA Audit — Security, Auth Refresh, Preferences Parity & Search Coverage', () => {
  it('blocks unauthenticated POST /api/history/supabase-config with 401', async () => {
    const res = await request(app)
      .post('/api/history/supabase-config')
      .send({
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'public-anon-key-placeholder-123456'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('refreshes valid & recently-expired JWT tokens and rejects stale tokens past grace window', async () => {
    const email = `qa_refresh_${Date.now()}@syncwave.app`;
    const reg = await request(app).post('/api/auth/register').send({
      email,
      password: 'StrongPassword#2026',
      displayName: 'QA Refresh User'
    });

    expect(reg.status).toBe(201);
    const { token, user } = reg.body;

    // 1. Active token refreshes cleanly
    const activeRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(activeRefresh.status).toBe(200);
    expect(activeRefresh.body.success).toBe(true);
    expect(activeRefresh.body.token).toBeTruthy();
    expect(activeRefresh.body.user.email).toBe(email);

    // 2. Recently expired (2 days ago) token refreshes within 7-day grace window
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
    const recentlyExpired = jwt.sign(
      { userId: user.id, email: user.email, iat: twoDaysAgo - 3600, exp: twoDaysAgo },
      JWT_SECRET
    );
    const graceRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${recentlyExpired}`)
      .send({});
    expect(graceRefresh.status).toBe(200);
    expect(graceRefresh.body.success).toBe(true);
    expect(graceRefresh.body.token).toBeTruthy();

    // 3. Very old expired token (> 7 days ago) is rejected with 401
    const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60;
    const staleToken = jwt.sign(
      { userId: user.id, email: user.email, iat: tenDaysAgo - 3600, exp: tenDaysAgo },
      JWT_SECRET
    );
    const staleRes = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${staleToken}`)
      .send({});
    expect(staleRes.status).toBe(401);
    expect(staleRes.body.code).toBe('SESSION_EXPIRED');
  });

  it('validates PUT /api/users/me/preferences and returns both preferences and data keys', async () => {
    const invalidRes = await request(app)
      .put('/api/users/me/preferences')
      .send({ preferredLanguages: 'Tamil' });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.success).toBe(false);

    const validRes = await request(app)
      .put('/api/users/me/preferences')
      .send({
        preferredLanguages: ['Tamil', 'Hindi'],
        favouriteComposers: ['Harris Jayaraj'],
        favouriteSingers: ['Sid Sriram']
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.success).toBe(true);
    expect(validRes.body.preferences.preferredLanguages).toEqual(['Tamil', 'Hindi']);
    expect(validRes.body.data.preferredLanguages).toEqual(['Tamil', 'Hindi']);
    expect(validRes.body.data.favouriteSingers).toEqual(['Sid Sriram']);
  });

  it('returns curated suggestions & results for singers, music directors, songs, and movies', async () => {
    const singerSug = await request(app).get('/api/search/suggestions?q=Sid');
    expect(singerSug.status).toBe(200);
    expect(singerSug.body.suggestions.some((s: any) => s.text.includes('Sid Sriram') && s.type === 'ARTIST')).toBe(
      true
    );

    const songSearch = await request(app).get('/api/search?q=Nenjukkul+Peidhidum');
    expect(songSearch.status).toBe(200);
    expect(songSearch.body.songs.some((s: any) => s.title.toLowerCase().includes('nenjukkul'))).toBe(true);

    const directorSearch = await request(app).get('/api/search?q=Harris+Jayaraj');
    expect(directorSearch.status).toBe(200);
    expect(directorSearch.body.songs.length).toBeGreaterThan(0);
    expect(directorSearch.body.movies.length).toBeGreaterThan(0);
  }, 15000);

  it('rejects 30s preview clips vs full-length durations during download verification', () => {
    expect(validateDownloadedDuration(30000, 240000).valid).toBe(false);
    expect(validateDownloadedDuration(238000, 240000).valid).toBe(true);
  });

  describe('Security Hardening Verification (SSRF, Headers, IDOR, Auth, 404)', () => {
    it('isSafePublicHttpsUrl blocks loopback, private IPs, userinfo, non-standard ports, and cloud metadata', async () => {
      const { isSafePublicHttpsUrl } = await import('../src/services/download/fullAudioResolver.service');
      // Blocked SSRF targets
      expect(isSafePublicHttpsUrl('http://public.com/audio.mp3')).toBe(false); // Non-HTTPS
      expect(isSafePublicHttpsUrl('https://127.0.0.1:3001/secret')).toBe(false); // Loopback
      expect(isSafePublicHttpsUrl('https://localhost:443/secret')).toBe(false); // Localhost
      expect(isSafePublicHttpsUrl('https://169.254.169.254/latest/meta-data')).toBe(false); // Cloud metadata
      expect(isSafePublicHttpsUrl('https://metadata.google.internal/computeMetadata/v1/')).toBe(false); // GCP metadata
      expect(isSafePublicHttpsUrl('https://10.1.2.3/internal.mp3')).toBe(false); // RFC 1918 10.0.0.0/8
      expect(isSafePublicHttpsUrl('https://192.168.1.100/song.mp3')).toBe(false); // RFC 1918 192.168.0.0/16
      expect(isSafePublicHttpsUrl('https://172.20.0.5/song.mp3')).toBe(false); // RFC 1918 172.16.0.0/12
      expect(isSafePublicHttpsUrl('https://user:pass@trusted.cdn.com/song.mp3')).toBe(false); // Userinfo
      expect(isSafePublicHttpsUrl('https://trusted.cdn.com:8443/song.mp3')).toBe(false); // Non-standard port
      expect(isSafePublicHttpsUrl('https://server.internal/track.mp3')).toBe(false); // Internal TLD
      expect(isSafePublicHttpsUrl('https://0x7f.0.0.1/track.mp3')).toBe(false); // Hex IP

      // Allowed safe public HTTPS targets
      expect(isSafePublicHttpsUrl('https://archive.org/download/track.mp3')).toBe(true);
      expect(isSafePublicHttpsUrl('https://audio-cdn.spotify.com/sample.mp3')).toBe(true);
    });

    it('emits standard security headers and hides Express fingerprint', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('returns structured JSON 404 for unknown API endpoints', async () => {
      const res = await request(app).get('/api/unknown-non-existent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('requires authentication for POST /api/songs', async () => {
      const res = await request(app).post('/api/songs').send({
        id: 'new_song_1',
        title: 'New Song'
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('prevents IDOR tampering on POST /api/schedules/:id/execution', async () => {
      const { syncStore } = await import('../src/db/store');
      const victimSchedule = syncStore.saveSchedule({
        id: 'victim-sched-123',
        userId: 'victim-owner-id',
        name: 'Victim Morning Alarm',
        startTime: '07:00',
        repeatType: 'DAILY',
        daysOfWeek: [1, 2, 3, 4, 5],
        targetType: 'PLAYLIST',
        targetId: 'pl-1',
        targetName: 'Wake Up',
        priority: 'NORMAL',
        isEnabled: true,
        transitionType: 'CROSSFADE',
        transitionSec: 3,
        volume: 0.8,
        missedPolicy: 'SKIP',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastExecutedAt: '2026-01-01T07:00:00.000Z'
      });

      // An unauthenticated attacker or different user calls execution for victim-sched-123
      const res = await request(app)
        .post('/api/schedules/victim-sched-123/execution')
        .send({ success: true, statusMessage: 'Spoofed Execution' });

      expect(res.status).toBe(201);
      // Verify victim's schedule lastExecutedAt was NOT mutated
      const reloaded = syncStore.getScheduleById('victim-sched-123');
      expect(reloaded?.lastExecutedAt).toBe('2026-01-01T07:00:00.000Z');
    });

    it('enforces in-memory capacity caps to prevent memory leaks', async () => {
      const { syncStore } = await import('../src/db/store');
      // Test playHistory bound
      for (let i = 0; i < 1050; i++) {
        syncStore.recordPlayHistory({
          userId: 'cap-test-user',
          songId: `s_${i}`,
          songTitle: `Song ${i}`,
          artistName: 'Artist',
          durationListenedMs: 5000,
          completed: false,
          clientPlatform: 'WEB'
        });
      }
      expect((syncStore as any).playHistory.length).toBeLessThanOrEqual(1000);
    });
  });
});
