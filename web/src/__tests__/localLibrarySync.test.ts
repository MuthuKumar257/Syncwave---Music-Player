import { describe, it, expect } from 'vitest';
import {
  isSupportedAudioFile,
  extractFileFormat,
  parseTitleArtistFromFilename,
  deduplicateLibrarySongs,
} from '../services/localLibrarySync';
import { Song } from '../types';

describe('localLibrarySync helpers', () => {
  it('detects supported audio extensions and formats cleanly', () => {
    expect(isSupportedAudioFile('track.mp3')).toBe(true);
    expect(isSupportedAudioFile('track.FLAC')).toBe(true);
    expect(isSupportedAudioFile('track.m4a')).toBe(true);
    expect(isSupportedAudioFile('track.wav')).toBe(true);
    expect(isSupportedAudioFile('track.aac')).toBe(true);
    expect(isSupportedAudioFile('cover.jpg')).toBe(false);

    expect(extractFileFormat('Roja - Chinna Chinna Aasai.flac')).toBe('FLAC');
    expect(extractFileFormat('demo.m4a')).toBe('M4A');
  });

  it('parses Artist - Title filenames', () => {
    expect(parseTitleArtistFromFilename('A. R. Rahman - Kaadhal Rojave.mp3')).toEqual({
      artist: 'A. R. Rahman',
      title: 'Kaadhal Rojave',
    });
    expect(parseTitleArtistFromFilename('Unplugged_Track.wav')).toEqual({
      title: 'Unplugged Track',
      artist: 'Unknown Artist',
    });
  });

  it('deduplicates identical songs across Downloaded, Folder, and Device sources preferring Downloaded > Folder > Device', () => {
    const base = {
      title: 'Kaadhal Rojave',
      artist: 'A. R. Rahman',
      album: 'Roja',
      durationMs: 300000,
      createdAt: '2026-01-01T00:00:00Z',
    };
    const deviceSong: Song = {
      ...base,
      id: 'dev_1',
      source: 'LOCAL',
      originType: 'DEVICE',
      fileFormat: 'MP3',
    };
    const folderSong: Song = {
      ...base,
      id: 'fold_1',
      source: 'LOCAL',
      originType: 'FOLDER',
      folderName: 'MyMusic',
      artworkUrl: 'data:image/jpeg;base64,abc',
      fileFormat: 'FLAC',
    };
    const downloadedSong: Song = {
      ...base,
      id: 'dl_1',
      source: 'DOWNLOADED',
      originType: 'DOWNLOADED',
      folderName: 'Songs',
      fileFormat: 'M4A',
    };

    const unified = deduplicateLibrarySongs([deviceSong, folderSong, downloadedSong]);
    expect(unified).toHaveLength(1);
    expect(unified[0].id).toBe('dl_1');
    expect(unified[0].originType).toBe('DOWNLOADED');
    expect(unified[0].artworkUrl).toBe('data:image/jpeg;base64,abc');
  });
});
