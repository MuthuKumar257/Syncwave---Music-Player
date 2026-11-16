import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Universal Movie & Song Search Engine API Suite', () => {
  it('GET /api/search/platforms returns supported providers and languages', async () => {
    const res = await request(app).get('/api/search/platforms');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.platforms)).toBe(true);
    expect(res.body.platforms.length).toBeGreaterThanOrEqual(4);
    expect(res.body.supportedLanguages).toContain('Tamil');
    expect(res.body.supportedLanguages).toContain('Hindi');
    expect(res.body.supportedLanguages).toContain('Telugu');
  });

  it('GET /api/search/suggestions returns autocomplete suggestions', async () => {
    const res = await request(app).get('/api/search/suggestions?q=nenj');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    const found = res.body.suggestions.find((s: any) =>
      s.text.toLowerCase().includes('nenjukkul peidhidum')
    );
    expect(found).toBeDefined();
    expect(found.type).toBe('SONG');
  });

  it('GET /api/search?q=Vaaranam Aayiram&type=movie identifies movie soundtrack and tracks', async () => {
    const res = await request(app).get('/api/search?q=Vaaranam%20Aayiram&type=movie');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('MOVIE');
    expect(res.body.language).toBe('Tamil');
    expect(Array.isArray(res.body.movies)).toBe(true);
    expect(res.body.movies.length).toBeGreaterThanOrEqual(1);

    const movie = res.body.movies[0];
    expect(movie.movieName).toBe('Vaaranam Aayiram');
    expect(movie.composer).toBe('Harris Jayaraj');
    expect(movie.language).toBe('Tamil');
    expect(movie.tracks.length).toBeGreaterThanOrEqual(5);

    const nenjukkul = movie.tracks.find((t: any) =>
      t.title.toLowerCase().includes('nenjukkul peidhidum')
    );
    expect(nenjukkul).toBeDefined();
  }, 15000);

  it('GET /api/search?q=Nenjukkul Peidhidum&type=song returns categorized versions', async () => {
    const res = await request(app).get('/api/search?q=Nenjukkul%20Peidhidum&type=song');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.songs)).toBe(true);
    expect(res.body.versions).toBeDefined();
    expect(Array.isArray(res.body.versions.original)).toBe(true);
  }, 15000);

  it('GET /api/movies/:id/soundtracks retrieves full tracklist for known movie ID', async () => {
    const res = await request(app).get('/api/movies/movie_vaaranam_aayiram/soundtracks');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.soundtrack).toBeDefined();
    expect(res.body.soundtrack.movieName).toBe('Vaaranam Aayiram');
    expect(res.body.soundtrack.tracks.length).toBeGreaterThanOrEqual(5);
  }, 15000);

  it('GET /api/songs/:id/versions returns version breakdown', async () => {
    const res = await request(app).get('/api/songs/nenjukkul_peidhidum/versions?title=Nenjukkul%20Peidhidum');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.versions).toBeDefined();
    expect(Array.isArray(res.body.versions.original)).toBe(true);
  }, 15000);
});
