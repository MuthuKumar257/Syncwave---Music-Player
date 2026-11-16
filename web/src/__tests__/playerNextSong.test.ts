import { describe, it, expect } from 'vitest';
import { computeNextSong } from '../store/usePlayerStore';
import { Song } from '../types';

describe('Player Next Song Preview Engine', () => {
  const mockSong1: Song = {
    id: 'song-1',
    title: 'Nenjukkul Peidhidum',
    artist: 'Hariharan, Harris Jayaraj',
    album: 'Vaaranam Aayiram',
    durationMs: 310000,
    source: 'SPOTIFY',
    artworkUrl: 'https://images.unsplash.com/photo-1',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  const mockSong2: Song = {
    id: 'song-2',
    title: 'Adiye',
    artist: 'Sid Sriram, A. R. Rahman',
    album: 'Kadal',
    durationMs: 290000,
    source: 'YOUTUBE',
    artworkUrl: 'https://images.unsplash.com/photo-2',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  const mockSong3: Song = {
    id: 'local-dl-3',
    title: 'Marakkuma Nenjam',
    artist: 'A. R. Rahman',
    album: 'VTK',
    durationMs: 260000,
    source: 'DOWNLOADED',
    isLocal: true,
    artworkUrl: 'https://images.unsplash.com/photo-3',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  const testQueue = [mockSong1, mockSong2, mockSong3];

  it('computes the direct next song in a sequential queue', () => {
    const next = computeNextSong(testQueue, 0, mockSong1, false, 'OFF');
    expect(next?.id).toBe('song-2');
    expect(next?.title).toBe('Adiye');
    expect(next?.artist).toBe('Sid Sriram, A. R. Rahman');
  });

  it('returns null at the end of queue when repeat is OFF', () => {
    const next = computeNextSong(testQueue, 2, mockSong3, false, 'OFF');
    expect(next).toBeNull();
  });

  it('loops back to the first song when repeat is ALL and at end of queue', () => {
    const next = computeNextSong(testQueue, 2, mockSong3, false, 'ALL');
    expect(next?.id).toBe('song-1');
  });

  it('returns the current song when repeat is ONE', () => {
    const next = computeNextSong(testQueue, 1, mockSong2, false, 'ONE');
    expect(next?.id).toBe('song-2');
  });

  it('returns null when the queue is completely empty', () => {
    const next = computeNextSong([], -1, null, false, 'OFF');
    expect(next).toBeNull();
  });

  it('correctly handles next track preview for local downloaded tracks', () => {
    const next = computeNextSong(testQueue, 1, mockSong2, false, 'OFF');
    expect(next?.id).toBe('local-dl-3');
    expect(next?.source).toBe('DOWNLOADED');
  });

  it('determines the next song when queue is shuffled', () => {
    const next = computeNextSong(testQueue, 0, mockSong1, true, 'OFF');
    expect(next).toBeDefined();
    expect(next?.id).toBe('song-2');
  });
});
