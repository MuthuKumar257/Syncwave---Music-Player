import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import {
  isPreviewOrSampleUrl,
  validateDownloadedDuration,
  validateAudioBufferIntegrity,
  resolveFullDownloadSource
} from '../src/services/download/fullAudioResolver.service';

describe('Full-Length Song Download Validation & Endpoints', () => {
  it('detects 30s preview URLs and rejects preview durations', () => {
    expect(isPreviewOrSampleUrl('https://p.scdn.co/mp3-preview/abc123')).toBe(true);
    expect(isPreviewOrSampleUrl('https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/v4/sample.m4a')).toBe(true);
    expect(isPreviewOrSampleUrl('https://archive.org/download/cc_track/full_song.flac')).toBe(false);

    // 30s file when full song expected (210s) must fail
    const shortCheck = validateDownloadedDuration(30000, 210000);
    expect(shortCheck.valid).toBe(false);
    expect(shortCheck.reason).toContain('preview');

    // Truncated download (100s vs 240s) must fail
    const truncatedCheck = validateDownloadedDuration(100000, 240000);
    expect(truncatedCheck.valid).toBe(false);
    expect(truncatedCheck.reason).toContain('incomplete');

    // Genuine full download within tolerance must pass
    expect(validateDownloadedDuration(238000, 240000).valid).toBe(true);
    // Genuine short track matching expected 40s length passes
    expect(validateDownloadedDuration(40000, 40000).valid).toBe(true);
  });

  it('rejects HTML/JSON/undersized payloads during audio integrity check', () => {
    const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><html>Error</html>'.repeat(600));
    expect(validateAudioBufferIntegrity(htmlBytes, 'text/html').valid).toBe(false);

    const tinyBytes = new Uint8Array(100);
    expect(validateAudioBufferIntegrity(tinyBytes, 'audio/mpeg').valid).toBe(false);

    const validMp3Header = new Uint8Array(32768);
    validMp3Header[0] = 0x49; // I
    validMp3Header[1] = 0x44; // D
    validMp3Header[2] = 0x33; // 3
    expect(validateAudioBufferIntegrity(validMp3Header, 'audio/mpeg').valid).toBe(true);
  });

  it('rejects Apple Music / Spotify 30s preview tracks and YouTube stream-only tracks', async () => {
    const appleRes = await resolveFullDownloadSource({
      title: 'Munbe Vaa',
      artist: 'A.R. Rahman',
      sourcePlatform: 'APPLE_MUSIC',
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/sample.m4a',
      expectedDurationMs: 310000
    });
    expect(appleRes.downloadable).toBe(false);
    expect(appleRes.status).toBe('PREVIEW_ONLY');

    const ytRes = await resolveFullDownloadSource({
      title: 'Nenjukkul Peidhidum',
      artist: 'Harris Jayaraj',
      sourcePlatform: 'YOUTUBE',
      sourceUrl: 'https://www.youtube.com/watch?v=szvt1vD0Uug',
      expectedDurationMs: 260000
    });
    expect(ytRes.downloadable).toBe(false);
    expect(ytRes.status).toBe('STREAM_ONLY');
  });

  it('GET /api/search/download-stream rejects preview URLs and webpage URLs with HTTP 422', async () => {
    const previewRes = await request(app)
      .get('/api/search/download-stream')
      .query({ url: 'https://p.scdn.co/mp3-preview/sample123' });
    expect(previewRes.status).toBe(422);
    expect(previewRes.body.code).toBe('PREVIEW_ONLY');

    const ytRes = await request(app)
      .get('/api/search/download-stream')
      .query({ url: 'https://www.youtube.com/watch?v=szvt1vD0Uug' });
    expect(ytRes.status).toBe(422);
    expect(ytRes.body.code).toBe('STREAM_ONLY');
  });
});
