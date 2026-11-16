import { DownloadAvailability, DownloadTask } from '../types';
import { extractFileFormat } from './localLibrarySync';

const PREVIEW_URL_PATTERNS = [
  /p\.scdn\.co\/mp3-preview\//i,
  /audio-ssl\.itunes\.apple\.com\//i,
  /itunes-assets/i,
  /[?&/](preview|sample|snippet)(?:=|\/|$)/i
];

export interface FullDownloadCheckResult {
  downloadable: boolean;
  status: DownloadAvailability;
  audioUrl?: string;
  mimeType?: string;
  fileFormat?: string;
  expectedDurationMs: number;
  contentLength?: number;
  supportsRange?: boolean;
  reason?: string;
}

export function isPreviewOrSampleUrl(url?: string | null): boolean {
  if (!url) return false;
  return PREVIEW_URL_PATTERNS.some((re) => re.test(url));
}

export function validateDownloadDuration(
  actualDurationMs: number,
  expectedDurationMs?: number
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(actualDurationMs) || actualDurationMs <= 0) {
    return {
      valid: false,
      reason: 'Could not read valid audio duration from the downloaded file.'
    };
  }

  if ((!expectedDurationMs || expectedDurationMs >= 60000) && actualDurationMs < 45000) {
    return {
      valid: false,
      reason: `Downloaded audio is only ${Math.round(actualDurationMs / 1000)}s and appears to be a preview/sample instead of the full song.`
    };
  }

  if (
    expectedDurationMs &&
    expectedDurationMs > 0 &&
    actualDurationMs < expectedDurationMs * 0.85 &&
    expectedDurationMs - actualDurationMs > 5000
  ) {
    return {
      valid: false,
      reason: `Downloaded duration (${Math.round(actualDurationMs / 1000)}s) does not match full song duration (${Math.round(expectedDurationMs / 1000)}s).`
    };
  }

  return { valid: true };
}

export async function validateAudioBlobIntegrity(
  blob: Blob
): Promise<{ valid: boolean; reason?: string }> {
  if (!blob || blob.size < 16384) {
    return {
      valid: false,
      reason: 'Downloaded file is too small or incomplete.'
    };
  }

  const typeLower = (blob.type || '').toLowerCase();
  if (typeLower.includes('text/html') || typeLower.includes('application/json')) {
    return {
      valid: false,
      reason: `Source returned non-audio response (${blob.type}).`
    };
  }

  const headBuffer = await blob.slice(0, 64).arrayBuffer();
  const headText = new TextDecoder('ascii', { fatal: false }).decode(headBuffer).trimStart();
  if (/^(<!doctype|<html|<xml|\{)/i.test(headText)) {
    return {
      valid: false,
      reason: 'Downloaded file is corrupted (contains HTML/JSON error text instead of audio).'
    };
  }

  return { valid: true };
}

export async function measureAudioBlobDurationMs(blob: Blob): Promise<number> {
  if (typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return 0;
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<number>((resolve) => {
      const audio = new Audio();
      const done = (ms: number) => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
        resolve(ms);
      };
      const timer = setTimeout(() => done(0), 6000);
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        done(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0);
      };
      audio.onerror = () => {
        clearTimeout(timer);
        done(0);
      };
      audio.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function checkTrackFullDownloadAvailability(track: any): Promise<FullDownloadCheckResult> {
  if (track.downloadAvailability === 'PREVIEW_ONLY' || isPreviewOrSampleUrl(track.previewUrl) && !track.fullAudioUrl) {
    return {
      downloadable: false,
      status: 'PREVIEW_ONLY',
      expectedDurationMs: track.durationMs || 0,
      reason:
        track.downloadReason ||
        'This catalog source only provides a 30-second preview clip. SyncWave never saves previews as full songs.'
    };
  }

  if (track.downloadAvailability === 'STREAM_ONLY' && !track.fullAudioUrl) {
    return {
      downloadable: false,
      status: 'STREAM_ONLY',
      expectedDurationMs: track.durationMs || 0,
      reason:
        track.downloadReason ||
        'This source supports streaming playback only; full-song downloading is not permitted.'
    };
  }

  const directCandidate = track.fullAudioUrl || (
    track.uri && !isPreviewOrSampleUrl(track.uri) ? track.uri : undefined
  );

  // If the track already carries a local/same-origin direct full URL, verify via check endpoint or allow directly
  if (directCandidate && directCandidate.startsWith('/api/')) {
    return {
      downloadable: true,
      status: 'FULL_SONG',
      audioUrl: directCandidate,
      fileFormat: track.fileFormat || extractFileFormat(directCandidate, ''),
      expectedDurationMs: track.durationMs || 0,
      supportsRange: true
    };
  }

  try {
    const params = new URLSearchParams({
      title: String(track.title || ''),
      artist: String(track.artist || ''),
      sourcePlatform: String(track.sourcePlatform || track.source || ''),
      expectedDurationMs: String(track.durationMs || 0)
    });
    if (track.sourceUrl || track.externalUrl) params.set('sourceUrl', track.sourceUrl || track.externalUrl);
    if (track.previewUrl) params.set('previewUrl', track.previewUrl);
    if (directCandidate) params.set('fullAudioUrl', directCandidate);

    const res = await fetch(`/api/search/download-check?${params.toString()}`);
    if (res.ok) {
      return (await res.json()) as FullDownloadCheckResult;
    }
  } catch {
    // Handle network fallback below
  }

  if (directCandidate && !isPreviewOrSampleUrl(directCandidate)) {
    return {
      downloadable: true,
      status: 'FULL_SONG',
      audioUrl: directCandidate,
      fileFormat: track.fileFormat || extractFileFormat(directCandidate, ''),
      expectedDurationMs: track.durationMs || 0,
      supportsRange: true
    };
  }

  return {
    downloadable: false,
    status: 'UNAVAILABLE',
    expectedDurationMs: track.durationMs || 0,
    reason: 'No verified full-length downloadable audio stream is available for this track.'
  };
}

export function buildDownloadStreamEndpoint(rawAudioUrl: string, expectedDurationMs: number): string {
  if (rawAudioUrl.startsWith('/') || rawAudioUrl.startsWith('blob:')) {
    return rawAudioUrl;
  }
  const params = new URLSearchParams({
    url: rawAudioUrl,
    expectedDurationMs: String(Math.round(expectedDurationMs || 0))
  });
  return `/api/search/download-stream?${params.toString()}`;
}

export function parseContentRangeTotalBytes(contentRangeHeader: string | null): number | undefined {
  if (!contentRangeHeader) return undefined;
  const match = contentRangeHeader.match(/bytes\s+\d+-\d+\/(\d+)/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function downloadWithResumeAndVerify(options: {
  task: DownloadTask;
  signal?: AbortSignal;
  onTaskUpdate: (updatedTask: DownloadTask) => Promise<void> | void;
}): Promise<{
  blob: Blob;
  actualDurationMs: number;
  fileFormat: string;
  mimeType: string;
}> {
  let current = { ...options.task, chunks: [...options.task.chunks] };
  const streamUrl = buildDownloadStreamEndpoint(current.downloadUrl, current.expectedDurationMs);

  const headers: Record<string, string> = {};
  if (current.bytesReceived > 0 && current.chunks.length > 0 && current.supportsRange) {
    headers['Range'] = `bytes=${current.bytesReceived}-`;
  }

  const response = await fetch(streamUrl, {
    headers,
    signal: options.signal
  });

  if (response.status === 422 || response.status === 400 || response.status === 404) {
    let reason = `Download rejected (HTTP ${response.status}).`;
    try {
      const errJson = await response.json();
      if (errJson?.message) reason = errJson.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(reason);
  }

  if (!response.ok && response.status !== 206) {
    throw new Error(`Download failed with HTTP ${response.status}. You can resume or retry.`);
  }

  const contentType = response.headers.get('content-type') || current.mimeType || 'audio/mpeg';
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new Error(`Invalid response content type (${contentType}). Full audio expected.`);
  }

  // If server did not return 206 Partial Content when Range was requested, reset cleanly to full stream
  if (response.status !== 206) {
    current.chunks = [];
    current.bytesReceived = 0;
  }

  const headerLength = response.headers.get('content-length');
  const rangeTotal = parseContentRangeTotalBytes(response.headers.get('content-range'));
  const expectedTotalBytes =
    rangeTotal ??
    (headerLength ? Number(headerLength) + (response.status === 206 ? current.bytesReceived : 0) : current.expectedBytes);

  current = {
    ...current,
    mimeType: contentType,
    expectedBytes: expectedTotalBytes && Number.isFinite(expectedTotalBytes) ? expectedTotalBytes : current.expectedBytes,
    supportsRange: (response.headers.get('accept-ranges') || '').toLowerCase() === 'bytes' || response.status === 206,
    status: 'downloading',
    error: undefined,
    updatedAt: new Date().toISOString()
  };
  await options.onTaskUpdate(current);

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    let chunksSinceCheckpoint = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        const bufferCopy = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
        current.chunks.push(bufferCopy);
        current.bytesReceived += value.byteLength;
        chunksSinceCheckpoint++;
        if (chunksSinceCheckpoint >= 8) {
          chunksSinceCheckpoint = 0;
          current.updatedAt = new Date().toISOString();
          await options.onTaskUpdate({ ...current });
        }
      }
    }
  } else {
    const buf = await response.arrayBuffer();
    current.chunks.push(buf);
    current.bytesReceived += buf.byteLength;
  }

  // Verify completeness if total length is known
  if (current.expectedBytes && current.expectedBytes > 0 && current.bytesReceived < current.expectedBytes) {
    current.status = 'failed';
    current.error = `Download interrupted (${current.bytesReceived}/${current.expectedBytes} bytes received). Resume to finish.`;
    current.updatedAt = new Date().toISOString();
    await options.onTaskUpdate(current);
    throw new Error(current.error);
  }

  current.status = 'verifying';
  current.updatedAt = new Date().toISOString();
  await options.onTaskUpdate(current);

  const assembledBlob = new Blob(current.chunks, { type: contentType });
  const integrity = await validateAudioBlobIntegrity(assembledBlob);
  if (!integrity.valid) {
    throw new Error(integrity.reason || 'Audio file integrity check failed.');
  }

  const actualDurationMs = await measureAudioBlobDurationMs(assembledBlob);
  const effectiveDuration = actualDurationMs > 0 ? actualDurationMs : current.expectedDurationMs;
  if (actualDurationMs > 0) {
    const durationCheck = validateDownloadDuration(actualDurationMs, current.expectedDurationMs);
    if (!durationCheck.valid) {
      throw new Error(durationCheck.reason || 'Downloaded audio duration verification failed.');
    }
  } else if (current.expectedDurationMs <= 0) {
    throw new Error('Could not verify full song duration from downloaded audio.');
  }

  const fileFormat = extractFileFormat(current.fileName, contentType);
  return {
    blob: assembledBlob,
    actualDurationMs: effectiveDuration,
    fileFormat,
    mimeType: contentType
  };
}
