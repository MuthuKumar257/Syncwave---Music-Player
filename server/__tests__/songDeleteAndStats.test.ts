import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';

describe('Song Deletion, Detailed Statistics & 8-Section Recommendations', () => {
  const testUserId = 'test_user_delete_stats_1';

  it('DELETE /api/songs/:id removes song from library, favorites, and playlists', async () => {
    // 1. Seed a song
    const song = syncStore.saveSong({
      id: 'test_del_song_1',
      title: 'Delete Test Song',
      artist: 'Harris Jayaraj',
      album: 'Vaaranam Aayiram',
      durationMs: 240000,
      source: 'LOCAL',
      createdAt: new Date().toISOString()
    });

    // 2. Add to user favorites and playlist
    syncStore.toggleFavorite(testUserId, song.id);
    expect(syncStore.isFavorite(testUserId, song.id)).toBe(true);

    const playlist = syncStore.createPlaylist(testUserId, 'Delete Playlist');
    syncStore.addSongToPlaylist(playlist.id, song.id);
    expect(syncStore.getPlaylistById(playlist.id)?.songIds).toContain(song.id);

    // 3. Delete song via API
    const res = await request(app)
      .delete(`/api/songs/${song.id}`)
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 4. Verify removal
    expect(syncStore.getSongById(song.id)).toBeUndefined();
    expect(syncStore.isFavorite(testUserId, song.id)).toBe(false);
    expect(syncStore.getPlaylistById(playlist.id)?.songIds).not.toContain(song.id);
  });

  it('GET /api/songs/:id/stats returns individual song listening statistics', async () => {
    // Record a meaningful listening stat
    syncStore.recordSongListening(testUserId, {
      songId: 'stat_song_1',
      songName: 'Nenjukkul Peidhidum',
      movieOrAlbum: 'Vaaranam Aayiram',
      musicDirector: 'Harris Jayaraj',
      singers: ['Hariharan'],
      language: 'Tamil',
      genre: 'Soundtrack',
      playCount: 5,
      replayCount: 2,
      totalListeningDurationMs: 900000,
      completedCount: 3,
      skipCount: 0,
      isFavorite: true
    });

    const res = await request(app)
      .get('/api/songs/stat_song_1/stats')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.playCount).toBe(5);
    expect(res.body.stats.replayCount).toBe(2);
    expect(res.body.stats.totalListeningDurationMs).toBe(900000);
    expect(res.body.stats.averageListeningDurationMs).toBe(180000);
    expect(res.body.stats.isFavorite).toBe(true);
  });

  it('GET /api/recommendations returns all 8 required sections and human-friendly reasons', async () => {
    const res = await request(app)
      .get('/api/recommendations?language=Tamil')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const feed = res.body.data;

    // Verify 8 core recommendation sections
    expect(Array.isArray(feed.recommendedForYou)).toBe(true);
    expect(feed.recommendedForYou.length).toBeGreaterThan(0);

    expect(feed.basedOnListeningHistory).toBeDefined();
    expect(Array.isArray(feed.basedOnListeningHistory.tracks)).toBe(true);

    expect(Array.isArray(feed.moreFromFavouriteArtists)).toBe(true);
    expect(feed.moreFromFavouriteArtists.length).toBeGreaterThan(0);

    expect(Array.isArray(feed.similarSongs)).toBe(true);
    expect(feed.similarSongs.length).toBeGreaterThan(0);

    expect(feed.sameMusicDirector).toBeDefined();
    expect(Array.isArray(feed.sameMusicDirector.tracks)).toBe(true);

    expect(Array.isArray(feed.trendingInLanguages)).toBe(true);
    expect(feed.trendingInLanguages.length).toBeGreaterThan(0);

    expect(Array.isArray(feed.recentlyPlayed)).toBe(true);
    expect(Array.isArray(feed.discoverNewMusic)).toBe(true);

    // Verify recommendation reason on recommended tracks
    expect(feed.recommendedForYou[0].recommendationReason).toBeDefined();
  });

  it('GET /api/recommendations/profile-stats computes full listening analytics', async () => {
    const res = await request(app)
      .get('/api/recommendations/profile-stats')
      .set('X-User-Id', testUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const stats = res.body.stats;

    expect(Array.isArray(stats.topListenedArtists)).toBe(true);
    expect(Array.isArray(stats.topListenedDirectors)).toBe(true);
    expect(Array.isArray(stats.mostPlayedSongs)).toBe(true);
    expect(Array.isArray(stats.languageBreakdown)).toBe(true);
    expect(Array.isArray(stats.dailyActivity)).toBe(true);
    expect(stats.dailyActivity.length).toBe(7);
    expect(Array.isArray(stats.weeklyActivity)).toBe(true);
    expect(stats.weeklyActivity.length).toBe(4);
    expect(stats.summary.totalPlays).toBeGreaterThan(0);
    expect(stats.summary.totalListeningHours).toBeDefined();
  });
});
