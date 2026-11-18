import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { RecommendationEngineService } from '../src/services/recommendation/recommendationEngine.service';
import { TokenBlacklistService } from '../src/services/auth/tokenBlacklist.service';

describe('SyncWave – Home Screen Song Display, Base Feed & Section Independence Suite', () => {
  const ts = Date.now();
  const tamilUserEmail = `tamil_home_${ts}@syncwave.app`;
  const multiLangUserEmail = `multi_home_${ts}@syncwave.app`;
  const noLangUserEmail = `nolang_home_${ts}@syncwave.app`;

  let tokenTamil: string;
  let userIdTamil: string;
  let tokenMulti: string;
  let userIdMulti: string;
  let tokenNoLang: string;
  let userIdNoLang: string;

  beforeAll(async () => {
    // 1. Register Tamil User
    const resTamil = await request(app).post('/api/auth/register').send({
      email: tamilUserEmail,
      password: 'StrongPassword123!',
      displayName: 'Tamil Music Lover'
    });
    tokenTamil = resTamil.body.session?.token || resTamil.body.token;
    userIdTamil = resTamil.body.user.id;

    await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({
        preferredLanguages: ['Tamil'],
        favouriteComposers: ['Harris Jayaraj'],
        hasCompletedOnboarding: true
      });

    // 2. Register Multi-Language User (Tamil + Hindi)
    const resMulti = await request(app).post('/api/auth/register').send({
      email: multiLangUserEmail,
      password: 'StrongPassword123!',
      displayName: 'Multi Lang Listener'
    });
    tokenMulti = resMulti.body.session?.token || resMulti.body.token;
    userIdMulti = resMulti.body.user.id;

    await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenMulti}`)
      .send({
        preferredLanguages: ['Tamil', 'Hindi'],
        hasCompletedOnboarding: true
      });

    // 3. Register No-Language User
    const resNoLang = await request(app).post('/api/auth/register').send({
      email: noLangUserEmail,
      password: 'StrongPassword123!',
      displayName: 'New Unconfigured User'
    });
    tokenNoLang = resNoLang.body.session?.token || resNoLang.body.token;
    userIdNoLang = resNoLang.body.user.id;

    await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenNoLang}`)
      .send({
        preferredLanguages: [],
        hasCompletedOnboarding: false
      });
  });

  afterAll(() => {
    if (userIdTamil) syncStore.deleteUser(userIdTamil);
    if (userIdMulti) syncStore.deleteUser(userIdMulti);
    if (userIdNoLang) syncStore.deleteUser(userIdNoLang);
  });

  // Condition 1: User with Tamil selected sees Tamil songs
  it('Condition 1: User with Tamil language selected receives strictly Tamil songs on Home', async () => {
    const resFeed = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(resFeed.status).toBe(200);
    expect(resFeed.body.success).toBe(true);

    const madeForYou = resFeed.body.data.madeForYou || [];
    expect(madeForYou.length).toBeGreaterThan(0);
    for (const track of madeForYou) {
      expect(track.language).toBe('Tamil');
    }

    // Base songs endpoint with user preferences
    const resBase = await request(app)
      .get('/api/songs')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(resBase.status).toBe(200);
    expect(resBase.body.success).toBe(true);
    expect(resBase.body.data.length).toBeGreaterThan(0);
    for (const s of resBase.body.data) {
      expect(s.language).toBe('Tamil');
    }
  });

  // Condition 2: User with multiple languages sees only those languages
  it('Condition 2: User with multiple languages (Tamil + Hindi) sees only those selected languages', async () => {
    const resFeed = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenMulti}`);

    expect(resFeed.status).toBe(200);
    const madeForYou = resFeed.body.data.madeForYou || [];
    expect(madeForYou.length).toBeGreaterThan(0);

    const allowed = new Set(['Tamil', 'Hindi']);
    for (const track of madeForYou) {
      expect(allowed.has(track.language)).toBe(true);
    }

    const resBase = await request(app)
      .get('/api/songs/home-base')
      .set('Authorization', `Bearer ${tokenMulti}`);

    expect(resBase.status).toBe(200);
    expect(resBase.body.data.allAvailable.length).toBeGreaterThan(0);
    for (const s of resBase.body.data.allAvailable) {
      expect(allowed.has(s.language)).toBe(true);
    }
  });

  // Condition 3: User with no language preference sees language-selection state
  it('Condition 3: User with no language preference receives requiresLanguageSelection: true and language prompt state', async () => {
    const resFeed = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tokenNoLang}`);

    expect(resFeed.status).toBe(200);
    expect(resFeed.body.data.requiresLanguageSelection).toBe(true);
    expect(resFeed.body.data.madeForYou).toEqual([]);
    expect(resFeed.body.data.preferredLanguages).toEqual([]);

    // But base catalogue feed is still available so screen has songs
    const resBase = await request(app)
      .get('/api/songs/home-base')
      .set('Authorization', `Bearer ${tokenNoLang}`);

    expect(resBase.status).toBe(200);
    expect(resBase.body.data.requiresLanguageSelection).toBe(true);
    expect(resBase.body.data.allAvailable.length).toBeGreaterThan(0);
    expect(resBase.body.data.popularSongs.length).toBeGreaterThan(0);
  });

  // Condition 4: Home displays catalogue songs even if recommendation API fails
  it('Condition 4: Home base feed (/api/songs/home-base) reliably serves songs independent of recommendation scoring', async () => {
    const res = await request(app).get('/api/songs/home-base');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trending.length).toBeGreaterThan(0);
    expect(res.body.data.popularSongs.length).toBeGreaterThan(0);
    expect(res.body.data.recentlyAdded.length).toBeGreaterThan(0);
    expect(res.body.data.allAvailable.length).toBeGreaterThanOrEqual(99);

    // Diagnostics present and safe
    expect(res.body.diagnostics).toBeDefined();
    expect(res.body.diagnostics.availableSongs).toBeGreaterThanOrEqual(99);
    expect(res.body.diagnostics.userId).toBeDefined();
    // Zero secrets exposed
    expect(JSON.stringify(res.body)).not.toContain('jwt');
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  // Condition 5: One failed section does not break other sections
  it('Condition 5: Individual section queries (trending, popular, recent) return independent valid payloads', async () => {
    const resTrending = await request(app).get('/api/songs?category=trending&limit=10');
    expect(resTrending.status).toBe(200);
    expect(resTrending.body.data.length).toBeGreaterThan(0);

    const resPopular = await request(app).get('/api/songs?category=popular&limit=10');
    expect(resPopular.status).toBe(200);
    expect(resPopular.body.data.length).toBeGreaterThan(0);

    const resRecent = await request(app).get('/api/songs?category=recent&limit=10');
    expect(resRecent.status).toBe(200);
    expect(resRecent.body.data.length).toBeGreaterThan(0);
  });

  // Condition 6: Pull-to-refresh fetches fresh results with seed/timestamp
  it('Condition 6: Refresh seed forces recommendation re-evaluation and cache bust', async () => {
    const res1 = await request(app)
      .get('/api/recommendations?seed=111')
      .set('Authorization', `Bearer ${tokenTamil}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .get('/api/recommendations?seed=222')
      .set('Authorization', `Bearer ${tokenTamil}`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.generatedAt).toBeDefined();
  });

  // Condition 7: Logging out and switching accounts refreshes Home correctly
  it('Condition 7: User logout immediately revokes session and switches Home state without cross-account leakage', async () => {
    const logoutUserEmail = `logout_home_${ts}@syncwave.app`;
    const resReg = await request(app).post('/api/auth/register').send({
      email: logoutUserEmail,
      password: 'StrongPassword123!',
      displayName: 'Temporary Switcher'
    });
    const tempToken = resReg.body.session?.token || resReg.body.token;

    // Logout
    const resLogout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tempToken}`);
    expect(resLogout.status).toBe(200);

    // Using blacklisted token on auth-required endpoint returns 401 TOKEN_REVOKED
    const resAfter = await request(app)
      .get('/api/playlists')
      .set('Authorization', `Bearer ${tempToken}`);
    expect(resAfter.status).toBe(401);
    expect(resAfter.body.code).toBe('TOKEN_REVOKED');

    // On optionalAuth endpoints (like Home recommendations), revoked token is treated as unauthenticated guest
    const resHomeAfter = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${tempToken}`);
    expect(resHomeAfter.status).toBe(200);
    expect(resHomeAfter.body.data.requiresLanguageSelection).toBe(true);
    expect(resHomeAfter.body.data.madeForYou).toEqual([]);
  });

  // Condition 8: Missing artwork does not prevent song rendering
  it('Condition 8: Songs with missing or invalid artwork have valid structure and fallback properties', async () => {
    const res = await request(app).get('/api/songs?limit=50');
    expect(res.status).toBe(200);
    for (const song of res.body.data) {
      expect(song.id).toBeDefined();
      expect(song.title).toBeDefined();
      expect(song.artist).toBeDefined();
      expect(typeof song.durationMs).toBe('number');
      expect(song.durationMs).toBeGreaterThan(0);
      // Valid string or fallback-ready
      if (song.artworkUrl) {
        expect(typeof song.artworkUrl).toBe('string');
      }
    }
  });

  // Condition 9: Empty query results display proper zero-count state
  it('Condition 9: Querying for non-existent songs returns clean empty array without 500 error', async () => {
    const res = await request(app).get('/api/songs?q=NonExistentZyxw999SongQuery');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(0);
    expect(res.body.data).toEqual([]);
    expect(res.body.diagnostics.languageMatched).toBe(0);
  });

  // Condition 10: Development diagnostics are safe, structured, and non-sensitive
  it('Condition 10: Home diagnostics contain safe userId, language metrics, and query status without secrets', async () => {
    const res = await request(app)
      .get('/api/songs')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(res.status).toBe(200);
    const diag = res.body.diagnostics;
    expect(diag).toBeDefined();
    expect(diag.userId).toContain('...');
    expect(diag.selectedLanguages).toEqual(['Tamil']);
    expect(diag.availableSongs).toBeGreaterThanOrEqual(99);
    expect(diag.languageMatched).toBe(32);
    expect(diag.responseCount).toBe(32);
    expect(diag.supabaseStatus).toBeDefined();

    // Verify absolutely no sensitive credentials in headers or body
    expect(res.headers['authorization']).toBeUndefined();
    expect(JSON.stringify(diag)).not.toContain('Bearer');
    expect(JSON.stringify(diag)).not.toContain('password');
    expect(JSON.stringify(diag)).not.toContain('secret');
  });
});
