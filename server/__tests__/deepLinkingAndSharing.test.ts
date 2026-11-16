import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('SyncWave Deep Linking and Song Sharing Backend Suite', () => {
  // 1. Android App Links verification file
  it('GET /.well-known/assetlinks.json returns valid Android App Links specification', async () => {
    const res = await request(app).get('/.well-known/assetlinks.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(Array.isArray(res.body)).toBe(true);

    const assetLink = res.body[0];
    expect(assetLink.relation).toContain('delegate_permission/common.handle_all_urls');
    expect(assetLink.target.namespace).toBe('android_app');
    expect(assetLink.target.package_name).toBe('com.syncwave.music');
    expect(assetLink.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
    expect(assetLink.target.sha256_cert_fingerprints).toContain(
      '12:82:0B:67:4E:6C:1B:D4:8B:C4:ED:0D:37:C3:61:1C:91:A6:94:14:D8:86:78:F8:CB:3E:0B:8E:AB:4B:81:38'
    );
  });

  // 2. iOS Universal Links verification files
  it('GET /.well-known/apple-app-site-association returns valid iOS Universal Links specification', async () => {
    const res = await request(app).get('/.well-known/apple-app-site-association');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.applinks).toBeDefined();
    expect(res.body.applinks.details[0].appID).toContain('com.syncwave.music');
    expect(res.body.applinks.details[0].paths).toContain('/song/*');
  });

  it('GET /apple-app-site-association serves same specification at root path', async () => {
    const res = await request(app).get('/apple-app-site-association');
    expect(res.status).toBe(200);
    expect(res.body.applinks.details[0].paths).toContain('/song/*');
  });

  // 3. Public Song Retrieval by ID
  it('GET /api/songs/:id resolves catalog tracks with canonical share URL and formatted message', async () => {
    // track_vaaranam_aayiram_1 corresponds to Nenjukkul Peidhidum in master catalog
    const res = await request(app).get('/api/songs/track_vaaranam_aayiram_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Nenjukkul Peidhidum');
    expect(res.body.data.shareUrl).toBe('https://syncwave.app/song/track_vaaranam_aayiram_1');
    expect(res.body.data.shareMessage).toContain('Listen to Nenjukkul Peidhidum');
    expect(res.body.data.shareMessage).toContain('https://syncwave.app/song/track_vaaranam_aayiram_1');

    // Security & Data Hygiene: No local file paths or sensitive tokens
    expect(res.body.data.localFilePath).toBeUndefined();
    expect(res.body.data.storageLocation).not.toBe('LOCAL_DEVICE');
  });

  // 4. Public Share Endpoint
  it('GET /api/share/song/:id returns rich metadata with deep linking URIs and store fallbacks', async () => {
    const res = await request(app).get('/api/share/song/track_vaaranam_aayiram_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Nenjukkul Peidhidum');
    expect(res.body.data.appLinks.android).toBe('syncwave://song/track_vaaranam_aayiram_1');
    expect(res.body.data.appLinks.ios).toBe('syncwave://song/track_vaaranam_aayiram_1');
    expect(res.body.data.appLinks.universal).toBe('https://syncwave.app/song/track_vaaranam_aayiram_1');
    expect(res.body.data.appLinks.playStoreUrl).toContain('com.syncwave.music');
  });

  // 5. Invalid / Non-existent Song Handling
  it('GET /api/songs/:id returns 404 for invalid or non-existent song ID', async () => {
    const res = await request(app).get('/api/songs/non_existent_ghost_song_99999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.message).toMatch(/Song not found or unavailable/i);
  });

  it('GET /api/share/song/:id returns 404 for invalid or non-existent song ID', async () => {
    const res = await request(app).get('/api/share/song/non_existent_ghost_song_99999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  // 6. Public Access for Unauthenticated Users
  it('Deep link song retrieval succeeds without Authorization header (guest friendly)', async () => {
    const res = await request(app)
      .get('/api/songs/track_vaaranam_aayiram_1')
      .set('Authorization', ''); // Explicitly unauthenticated
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('track_vaaranam_aayiram_1');
  });
});
