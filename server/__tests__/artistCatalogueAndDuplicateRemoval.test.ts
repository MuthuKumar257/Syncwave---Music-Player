import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { JWT_SECRET } from '../src/middleware/auth';
import {
  CanonicalArtistService,
  normalizeArtistName,
  SUPPORTED_MUSIC_LANGUAGES
} from '../src/services/recommendation/canonicalArtist.service';

function createAuthToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Artist Catalogue Across Languages with Filtering and Duplicate Removal Suite', () => {
  const userTamilId = 'user_artist_tamil_' + Date.now();
  const userHindiTeluguId = 'user_artist_ht_' + Date.now();
  const tokenTamil = createAuthToken(userTamilId, 'tamil_artists@example.com');
  const tokenHindiTelugu = createAuthToken(userHindiTeluguId, 'ht_artists@example.com');

  beforeEach(() => {
    CanonicalArtistService.initializeMasterCatalogue();
    syncStore.resetUserPreferences(userTamilId);
    syncStore.resetUserPreferences(userHindiTeluguId);

    // Seed User A with Tamil
    syncStore.updateUserPreferences(userTamilId, {
      preferredLanguages: ['Tamil'],
      hasCompletedOnboarding: true
    });

    // Seed User B with Hindi & Telugu
    syncStore.updateUserPreferences(userHindiTeluguId, {
      preferredLanguages: ['Hindi', 'Telugu'],
      hasCompletedOnboarding: true
    });
  });

  // =========================================================================
  // SCENARIO 1: Fetch Artists Across All Supported Languages
  // =========================================================================
  it('Scenario 1: Fetches all available artists across all supported languages without restriction', async () => {
    const res = await request(app).get('/api/recommendations/artists?includeAll=true');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.artists.length).toBeGreaterThan(25);
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.artists.length);

    // Verify all supported languages are represented across the master catalogue
    const allLanguages = new Set<string>();
    for (const artist of res.body.artists) {
      for (const lang of artist.languages) {
        allLanguages.add(lang);
      }
    }

    for (const lang of SUPPORTED_MUSIC_LANGUAGES) {
      expect(allLanguages.has(lang)).toBe(true);
    }
  });

  // =========================================================================
  // SCENARIO 2: Select Tamil Only
  // =========================================================================
  it('Scenario 2: Selecting Tamil only returns exclusively Tamil-associated artists', async () => {
    const res = await request(app).get('/api/recommendations/artists?languages=Tamil');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.artists.length).toBeGreaterThan(0);

    for (const artist of res.body.artists) {
      const hasTamil = artist.languages.some((l: string) => l.toLowerCase() === 'tamil');
      expect(hasTamil).toBe(true);
    }

    // Verify unrelated artists (e.g. pure Punjabi or pure English) are excluded
    const artistNames = res.body.artists.map((a: any) => a.name);
    expect(artistNames).not.toContain('Diljit Dosanjh');
    expect(artistNames).not.toContain('The Weeknd');
    expect(artistNames).not.toContain('AP Dhillon');

    // Verify canonical Tamil artists are included
    expect(artistNames).toContain('A. R. Rahman');
    expect(artistNames).toContain('Anirudh Ravichander');
    expect(artistNames).toContain('Harris Jayaraj');
  });

  // =========================================================================
  // SCENARIO 3: Select Tamil and Malayalam (Duplicate Removal & Multi-Language)
  // =========================================================================
  it('Scenario 3: Selecting Tamil and Malayalam displays cross-lingual artists exactly once', async () => {
    const res = await request(app).get('/api/recommendations/artists?languages=Tamil,Malayalam');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const artists = res.body.artists;
    expect(artists.length).toBeGreaterThan(0);

    // Check that every artist is associated with either Tamil or Malayalam
    for (const artist of artists) {
      const matches = artist.languages.some(
        (l: string) => l.toLowerCase() === 'tamil' || l.toLowerCase() === 'malayalam'
      );
      expect(matches).toBe(true);
    }

    // CRITICAL: Verify cross-lingual artists (e.g. K. J. Yesudas, K. S. Chithra, A. R. Rahman, Vidyasagar)
    // appear ONLY ONCE with no duplicates
    const idCounts = new Map<string, number>();
    const nameCounts = new Map<string, number>();

    for (const artist of artists) {
      idCounts.set(artist.id, (idCounts.get(artist.id) || 0) + 1);
      const norm = normalizeArtistName(artist.name);
      nameCounts.set(norm, (nameCounts.get(norm) || 0) + 1);
    }

    for (const [id, count] of idCounts.entries()) {
      expect(count, `Artist ID ${id} appeared more than once!`).toBe(1);
    }
    for (const [name, count] of nameCounts.entries()) {
      expect(count, `Artist Name ${name} appeared more than once!`).toBe(1);
    }

    // Cross-lingual artists have both languages associated in their record
    const arRahman = artists.find((a: any) => a.name === 'A. R. Rahman');
    expect(arRahman).toBeDefined();
    expect(arRahman.languages).toContain('Tamil');
    expect(arRahman.languages).toContain('Malayalam');

    const chithra = artists.find((a: any) => a.name === 'K. S. Chithra');
    expect(chithra).toBeDefined();
    expect(chithra.languages).toContain('Tamil');
    expect(chithra.languages).toContain('Malayalam');
  });

  // =========================================================================
  // SCENARIO 4: Select Hindi and Telugu
  // =========================================================================
  it('Scenario 4: Selecting Hindi and Telugu excludes unrelated languages and prevents duplicate records', async () => {
    const res = await request(app).get('/api/recommendations/artists?languages=Hindi,Telugu');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const artists = res.body.artists;

    for (const artist of artists) {
      const matches = artist.languages.some(
        (l: string) => l.toLowerCase() === 'hindi' || l.toLowerCase() === 'telugu'
      );
      expect(matches).toBe(true);
    }

    const artistNames = artists.map((a: any) => a.name);
    // Unrelated artists excluded
    expect(artistNames).not.toContain('Sushin Shyam'); // pure Malayalam
    expect(artistNames).not.toContain('AP Dhillon'); // pure Punjabi
    expect(artistNames).not.toContain('The Weeknd'); // pure English

    // Eligible artists included
    expect(artistNames).toContain('Arijit Singh');
    expect(artistNames).toContain('Pritam');
    expect(artistNames).toContain('Devi Sri Prasad');
    expect(artistNames).toContain('Thaman S');

    // Shared cross-lingual artists (e.g. Sid Sriram, AR Rahman, SPB) appear ONLY once
    const sidMatches = artists.filter((a: any) => a.name.includes('Sid Sriram'));
    expect(sidMatches.length).toBe(1);
  });

  // =========================================================================
  // SCENARIO 5: Search for Artist Across Regional Scripts and Alternate Names
  // =========================================================================
  it('Scenario 5: Search resolves alternate spellings and regional scripts to the canonical artist without duplicates', async () => {
    // 1. Search by Tamil script: "ஏ. ஆர். ரகுமான்"
    const tamilScriptRes = await request(app).get(
      `/api/recommendations/artists?q=${encodeURIComponent('ஏ. ஆர். ரகுமான்')}`
    );
    expect(tamilScriptRes.status).toBe(200);
    expect(tamilScriptRes.body.artists.length).toBe(1);
    expect(tamilScriptRes.body.artists[0].name).toBe('A. R. Rahman');

    // 2. Search by abbreviation: "DSP"
    const dspRes = await request(app).get('/api/recommendations/artists?q=DSP');
    expect(dspRes.status).toBe(200);
    expect(dspRes.body.artists.length).toBe(1);
    expect(dspRes.body.artists[0].name).toBe('Devi Sri Prasad');

    // 3. Search by alternate abbreviation: "SPB"
    const spbRes = await request(app).get('/api/recommendations/artists?q=SPB');
    expect(spbRes.status).toBe(200);
    expect(spbRes.body.artists.length).toBe(1);
    expect(spbRes.body.artists[0].name).toBe('S. P. Balasubrahmanyam');

    // 4. Search by alternate spelling without spaces/dots: "KS Chithra"
    const chithraRes = await request(app).get(
      `/api/recommendations/artists?q=${encodeURIComponent('KS Chithra')}`
    );
    expect(chithraRes.status).toBe(200);
    expect(chithraRes.body.artists.length).toBe(1);
    expect(chithraRes.body.artists[0].name).toBe('K. S. Chithra');
  });

  // =========================================================================
  // SCENARIO 6: Server-Side Pagination
  // =========================================================================
  it('Scenario 6: Server-side pagination splits large artist catalogues correctly without overlap', async () => {
    // Page 1 with limit 5
    const page1Res = await request(app).get('/api/recommendations/artists?includeAll=true&page=1&limit=5');
    expect(page1Res.status).toBe(200);
    expect(page1Res.body.artists.length).toBe(5);
    expect(page1Res.body.page).toBe(1);
    expect(page1Res.body.limit).toBe(5);
    expect(page1Res.body.hasMore).toBe(true);

    // Page 2 with limit 5
    const page2Res = await request(app).get('/api/recommendations/artists?includeAll=true&page=2&limit=5');
    expect(page2Res.status).toBe(200);
    expect(page2Res.body.artists.length).toBe(5);
    expect(page2Res.body.page).toBe(2);

    // Verify 0 overlap between page 1 and page 2
    const page1Ids = new Set(page1Res.body.artists.map((a: any) => a.id));
    const page2Overlap = page2Res.body.artists.filter((a: any) => page1Ids.has(a.id));
    expect(page2Overlap.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO 7: Role Filtering (DIRECTOR vs SINGER)
  // =========================================================================
  it('Scenario 7: Role filtering strictly partitions music directors and playback singers', async () => {
    // 1. Directors in Tamil
    const dirRes = await request(app).get('/api/recommendations/artists?role=DIRECTOR&languages=Tamil');
    expect(dirRes.status).toBe(200);
    expect(dirRes.body.artists.length).toBeGreaterThan(0);
    for (const a of dirRes.body.artists) {
      expect(a.role).toBe('DIRECTOR');
    }

    // 2. Singers in Tamil
    const singerRes = await request(app).get('/api/recommendations/artists?role=SINGER&languages=Tamil');
    expect(singerRes.status).toBe(200);
    expect(singerRes.body.artists.length).toBeGreaterThan(0);
    for (const a of singerRes.body.artists) {
      expect(a.role === 'SINGER' || a.role === 'ALL').toBe(true);
    }
  });

  // =========================================================================
  // SCENARIO 8: Authenticated User Profile Automatic Filtering
  // =========================================================================
  it('Scenario 8: Authenticated user automatically receives artists for their profile languages when omitted', async () => {
    // User A has preferredLanguages: ['Tamil']
    const resA = await request(app)
      .get('/api/recommendations/artists')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(resA.status).toBe(200);
    expect(resA.body.artists.length).toBeGreaterThan(0);
    for (const artist of resA.body.artists) {
      expect(artist.languages.some((l: string) => l.toLowerCase() === 'tamil')).toBe(true);
    }

    // User B has preferredLanguages: ['Hindi', 'Telugu']
    const resB = await request(app)
      .get('/api/recommendations/artists')
      .set('Authorization', `Bearer ${tokenHindiTelugu}`);

    expect(resB.status).toBe(200);
    expect(resB.body.artists.length).toBeGreaterThan(0);
    for (const artist of resB.body.artists) {
      const match = artist.languages.some(
        (l: string) => l.toLowerCase() === 'hindi' || l.toLowerCase() === 'telugu'
      );
      expect(match).toBe(true);
    }
  });

  // =========================================================================
  // SCENARIO 9: Dynamic Language Changes in Preferences
  // =========================================================================
  it('Scenario 9: Updating language preferences immediately reflects in newly eligible artists', async () => {
    // Update User A from Tamil to Malayalam
    const updateRes = await request(app)
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenTamil}`)
      .send({ preferredLanguages: ['Malayalam'] });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.preferences.preferredLanguages).toEqual(['Malayalam']);

    // Fetch artists without query param; should now filter by Malayalam
    const artistRes = await request(app)
      .get('/api/recommendations/artists')
      .set('Authorization', `Bearer ${tokenTamil}`);

    expect(artistRes.status).toBe(200);
    for (const artist of artistRes.body.artists) {
      expect(artist.languages.some((l: string) => l.toLowerCase() === 'malayalam')).toBe(true);
    }

    const names = artistRes.body.artists.map((a: any) => a.name);
    expect(names).toContain('Sushin Shyam');
  });

  // =========================================================================
  // SCENARIO 10: Duplicate Registration Does Not Create Duplicate Records
  // =========================================================================
  it('Scenario 10: Registering an artist with existing alias or name merges languages and prevents duplicates', () => {
    const beforeCount = CanonicalArtistService.getArtists({ includeAllLanguages: true }).total;

    // Attempt to register a duplicate of AR Rahman under alternate spelling and with an additional language
    const merged = CanonicalArtistService.registerOrMergeArtist({
      canonicalName: 'A.R. Rahman',
      languages: ['French', 'Tamil'],
      aliases: ['Isai Puyal Rahman']
    });

    const afterCount = CanonicalArtistService.getArtists({ includeAllLanguages: true }).total;

    // Total artist count must NOT increase
    expect(afterCount).toBe(beforeCount);
    // Merged record has the new language and alias
    expect(merged.id).toBe('art_ar_rahman');
    expect(merged.languages).toContain('French');
    expect(merged.aliases).toContain('Isai Puyal Rahman');
  });

  // =========================================================================
  // SCENARIO 11: App Restart Preserves User Artist Selections
  // =========================================================================
  it('Scenario 11: User artist selections persist in store across restarts and reads', () => {
    syncStore.updateUserPreferences(userTamilId, {
      favouriteArtists: ['Anirudh Ravichander', 'Sid Sriram'],
      favouriteComposers: ['Harris Jayaraj'],
      hasCompletedOnboarding: true
    });

    // Simulate subsequent read (as on restart)
    const prefs = syncStore.getUserPreferences(userTamilId);
    expect(prefs.favouriteArtists).toContain('Anirudh Ravichander');
    expect(prefs.favouriteArtists).toContain('Sid Sriram');
    expect(prefs.favouriteComposers).toContain('Harris Jayaraj');
  });

  // =========================================================================
  // SCENARIO 12: Account Switching Isolates Artist Selections
  // =========================================================================
  it('Scenario 12: Account switching isolates artist preferences without leaking data', async () => {
    syncStore.updateUserPreferences(userTamilId, {
      favouriteArtists: ['Sid Sriram'],
      preferredLanguages: ['Tamil']
    });

    syncStore.updateUserPreferences(userHindiTeluguId, {
      favouriteArtists: ['Arijit Singh'],
      preferredLanguages: ['Hindi']
    });

    const resTamil = await request(app)
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenTamil}`);

    const resHindi = await request(app)
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${tokenHindiTelugu}`);

    expect(resTamil.body.preferences.favouriteArtists).toEqual(['Sid Sriram']);
    expect(resHindi.body.preferences.favouriteArtists).toEqual(['Arijit Singh']);

    // No cross-account leakage
    expect(resTamil.body.preferences.favouriteArtists).not.toContain('Arijit Singh');
    expect(resHindi.body.preferences.favouriteArtists).not.toContain('Sid Sriram');
  });
});
