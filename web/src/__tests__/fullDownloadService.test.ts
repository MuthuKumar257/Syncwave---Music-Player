import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isPreviewOrSampleUrl,
  validateDownloadDuration,
  validateAudioBlobIntegrity,
  parseContentRangeTotalBytes,
  downloadWithResumeAndVerify
} from '../services/fullDownloadService';
import { DownloadTask } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Full-Length Song Download Service', () => {
  it('blocks known preview URLs and rejects preview or truncated durations', () => {
    expect(isPreviewOrSampleUrl('https://p.scdn.co/mp3-preview/999')).toBe(true);
    expect(isPreviewOrSampleUrl('https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/v4/demo.m4a')).toBe(true);
    expect(isPreviewOrSampleUrl('https://archive.org/download/open_track/song.flac')).toBe(false);

    // 30-second snippet vs 3m30s source
    expect(validateDownloadDuration(30000, 210000).valid).toBe(false);
    // 15-second sample with no expected duration
    expect(validateDownloadDuration(15000, 0).valid).toBe(false);
    // Incomplete truncation (120s vs 240s)
    expect(validateDownloadDuration(120000, 240000).valid).toBe(false);
    // Full song preserved (238s vs 240s)
    expect(validateDownloadDuration(238000, 240000).valid).toBe(true);
  });

  it('rejects undersized and HTML/JSON error blobs during integrity validation', async () => {
    const htmlBlob = new Blob(['<!DOCTYPE html><html>Not Found</html>'.repeat(600)], { type: 'text/html' });
    const htmlCheck = await validateAudioBlobIntegrity(htmlBlob);
    expect(htmlCheck.valid).toBe(false);

    const tinyBlob = new Blob([new Uint8Array(1024)], { type: 'audio/mpeg' });
    const tinyCheck = await validateAudioBlobIntegrity(tinyBlob);
    expect(tinyCheck.valid).toBe(false);

    const validData = new Uint8Array(20000);
    validData[0] = 0x49;
    validData[1] = 0x44;
    validData[2] = 0x33;
    const okBlob = new Blob([validData], { type: 'audio/mpeg' });
    const okCheck = await validateAudioBlobIntegrity(okBlob);
    expect(okCheck.valid).toBe(true);
  });

  it('parses Content-Range total bytes and resumes partial download via HTTP 206 Range', async () => {
    expect(parseContentRangeTotalBytes('bytes 10000-24575/24576')).toBe(24576);
    expect(parseContentRangeTotalBytes(null)).toBeUndefined();

    const firstHalf = new Uint8Array(10000);
    firstHalf[0] = 0x49;
    firstHalf[1] = 0x44;
    firstHalf[2] = 0x33;

    const secondHalf = new Uint8Array(10000);

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const range = (init?.headers as Record<string, string> | undefined)?.['Range'];
      expect(range).toBe('bytes=10000-');
      return new Response(secondHalf, {
        status: 206,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': '10000',
          'Content-Range': 'bytes 10000-19999/20000',
          'Accept-Ranges': 'bytes'
        }
      });
    });

    const partialTask: DownloadTask = {
      id: 'local_dl_test1',
      trackId: 'test1',
      title: 'Full Open Track',
      artist: 'Open Artist',
      album: 'Open Album',
      sourcePlatform: 'OPEN_AUDIO',
      downloadUrl: 'https://archive.org/download/open/track.mp3',
      mimeType: 'audio/mpeg',
      fileFormat: 'MP3',
      fileName: 'Full Open Track - Open Artist.mp3',
      expectedDurationMs: 185000,
      expectedBytes: 20000,
      bytesReceived: 10000,
      supportsRange: true,
      chunks: [firstHalf.buffer],
      status: 'failed',
      updatedAt: new Date().toISOString()
    };

    const result = await downloadWithResumeAndVerify({
      task: partialTask,
      onTaskUpdate: () => {}
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.blob.size).toBe(20000);
    expect(result.fileFormat).toBe('MP3');
    expect(result.actualDurationMs).toBe(185000);
  });
});
