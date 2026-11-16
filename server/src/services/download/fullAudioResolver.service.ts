import { OpenAudioProvider } from '../search/openAudio.provider';

export type DownloadAvailability = 'FULL_SONG' | 'PREVIEW_ONLY' | 'STREAM_ONLY' | 'UNAVAILABLE';

export interface FullDownloadResolution {
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

const KNOWN_PREVIEW_URL_PATTERNS = [
  /p\.scdn\.co\/mp3-preview\//i,
  /audio-ssl\.itunes\.apple\.com\//i,
  /itunes-assets/i,
  /[?&/](preview|sample|snippet)(?:=|\/|$)/i
];

const WEBPAGE_ONLY_URL_PATTERNS = [
  /^(https?:\/\/)?(www\.|music\.)?(youtube\.com|youtu\.be)\//i,
  /^(https?:\/\/)?open\.spotify\.com\//i,
  /^(https?:\/\/)?music\.apple\.com\//i
];

export function isPreviewOrSampleUrl(url?: string | null): boolean {
  if (!url) return false;
  return KNOWN_PREVIEW_URL_PATTERNS.some((re) => re.test(url));
}

export function isWebpageOnlyUrl(url?: string | null): boolean {
  if (!url) return false;
  return WEBPAGE_ONLY_URL_PATTERNS.some((re) => re.test(url));
}

export function isSafePublicHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    // Protocol must strictly be https:
    if (parsed.protocol !== 'https:') return false;

    // Disallow userinfo (username / password embedded in URL)
    if (parsed.username || parsed.password) return false;

    // Disallow non-standard ports (allow only default HTTPS 443 or omitted)
    if (parsed.port && parsed.port !== '443') return false;

    const host = parsed.hostname.toLowerCase();

    // Reject loopback, broadcast, wildcard and all-zero addresses
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '0' ||
      host === '::' ||
      host === '::1'
    ) {
      return false;
    }

    // Reject loopback 127.0.0.0/8 subnet and all private IPv4 ranges
    if (
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') || // Link-local / Cloud metadata
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || // RFC 1918 172.16.0.0/12
      /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(host) // RFC 6598 Carrier Grade NAT
    ) {
      return false;
    }

    // Reject IPv6 private, link-local, unique local (fc00::/7), and IPv4-mapped loopback/private
    if (
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.includes('::ffff:127.') ||
      host.includes('::ffff:10.') ||
      host.includes('::ffff:192.168.') ||
      host.includes('::ffff:169.254.')
    ) {
      return false;
    }

    // Reject internal, local, or cloud metadata hostnames
    if (
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.lan') ||
      host.endsWith('.home') ||
      host.endsWith('.corp') ||
      host === 'metadata.google.internal' ||
      host === 'instance-data'
    ) {
      return false;
    }

    // Reject hex or octal encoded IP hostnames (e.g. 0x7f000001 or 0177.0.0.1)
    if (/0x[0-9a-f]/i.test(host) || /^0[0-7]+\./.test(host)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function inferAudioFormatFromUrlOrMime(url: string, mimeType = ''): string {
  const mime = mimeType.toLowerCase();
  if (mime.includes('flac')) return 'FLAC';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'M4A';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'MP3';
  if (mime.includes('aac')) return 'AAC';
  if (mime.includes('wav') || mime.includes('wave')) return 'WAV';
  if (mime.includes('ogg')) return 'OGG';
  if (mime.includes('opus')) return 'OPUS';
  if (mime.includes('webm')) return 'WEBM';

  const cleanUrl = url.split('?')[0].split('#')[0];
  const ext = cleanUrl.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toUpperCase();
  if (ext && ['MP3', 'FLAC', 'M4A', 'AAC', 'WAV', 'OGG', 'OPUS', 'WEBM', 'ALAC'].includes(ext)) {
    return ext;
  }
  return 'MP3';
}

export function validateDownloadedDuration(
  actualDurationMs: number,
  expectedDurationMs?: number
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(actualDurationMs) || actualDurationMs <= 0) {
    return {
      valid: false,
      reason: 'Could not verify audio duration from downloaded file.'
    };
  }

  // Reject 15s / 30s / <45s previews when source metadata expects a full track or has no expected length
  if ((!expectedDurationMs || expectedDurationMs >= 60000) && actualDurationMs < 45000) {
    return {
      valid: false,
      reason: `Downloaded audio is only ${Math.round(actualDurationMs / 1000)}s (preview/snippet rejected).`
    };
  }

  // Reject truncated files that fall >15% (>5s) below source duration metadata
  if (
    expectedDurationMs &&
    expectedDurationMs > 0 &&
    actualDurationMs < expectedDurationMs * 0.85 &&
    expectedDurationMs - actualDurationMs > 5000
  ) {
    return {
      valid: false,
      reason: `Downloaded duration (${Math.round(actualDurationMs / 1000)}s) is incomplete compared to source duration (${Math.round(expectedDurationMs / 1000)}s).`
    };
  }

  return { valid: true };
}

export function validateAudioBufferIntegrity(
  bytes: Uint8Array,
  contentType = ''
): { valid: boolean; reason?: string } {
  if (bytes.length < 16384) {
    return {
      valid: false,
      reason: 'Audio file is too small or incomplete.'
    };
  }

  const mime = contentType.toLowerCase();
  if (mime.includes('text/html') || mime.includes('application/json') || mime.includes('application/xml')) {
    return {
      valid: false,
      reason: `Upstream returned non-audio response (${contentType}).`
    };
  }

  const head = new TextDecoder('ascii', { fatal: false }).decode(bytes.slice(0, 64)).trimStart();
  if (/^(<!doctype|<html|<xml|\{)/i.test(head)) {
    return {
      valid: false,
      reason: 'Response body contains markup/JSON instead of binary audio data.'
    };
  }

  return { valid: true };
}

async function probeRemoteAudioUrl(url: string): Promise<{
  ok: boolean;
  contentType?: string;
  contentLength?: number;
  supportsRange: boolean;
}> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) {
      return { ok: false, supportsRange: false };
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType && !contentType.includes('audio/') && !contentType.includes('application/octet-stream')) {
      return { ok: false, contentType, supportsRange: false };
    }
    const lenStr = res.headers.get('content-length');
    const contentLength = lenStr ? parseInt(lenStr, 10) : undefined;
    const supportsRange = (res.headers.get('accept-ranges') || '').toLowerCase() === 'bytes';
    return {
      ok: true,
      contentType: contentType || 'audio/mpeg',
      contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
      supportsRange
    };
  } catch {
    return { ok: false, supportsRange: false };
  }
}

export async function resolveFullDownloadSource(params: {
  title: string;
  artist?: string;
  sourceUrl?: string;
  previewUrl?: string;
  fullAudioUrl?: string;
  sourcePlatform?: string;
  expectedDurationMs?: number;
}): Promise<FullDownloadResolution> {
  const expectedDurationMs = params.expectedDurationMs || 0;
  const candidateDirectUrl = params.fullAudioUrl || (
    params.sourceUrl && !isWebpageOnlyUrl(params.sourceUrl) && !isPreviewOrSampleUrl(params.sourceUrl)
      ? params.sourceUrl
      : undefined
  );

  if (candidateDirectUrl && isSafePublicHttpsUrl(candidateDirectUrl) && !isPreviewOrSampleUrl(candidateDirectUrl)) {
    const probe = await probeRemoteAudioUrl(candidateDirectUrl);
    if (probe.ok) {
      return {
        downloadable: true,
        status: 'FULL_SONG',
        audioUrl: candidateDirectUrl,
        mimeType: probe.contentType || 'audio/mpeg',
        fileFormat: inferAudioFormatFromUrlOrMime(candidateDirectUrl, probe.contentType || ''),
        expectedDurationMs,
        contentLength: probe.contentLength,
        supportsRange: probe.supportsRange
      };
    }
  }

  // Exact match attempt against OpenAudio (Jamendo CC / Internet Archive) only when explicit open match exists
  if (params.sourcePlatform === 'OPEN_AUDIO') {
    const openMatches = await OpenAudioProvider.searchTracks(
      `${params.title} ${params.artist || ''}`.trim(),
      4
    );
    const exactMatch = openMatches.find(
      (t) => t.title.toLowerCase() === params.title.toLowerCase() && t.durationMs >= 45000
    ) || openMatches[0];
    if (exactMatch) {
      return {
        downloadable: true,
        status: 'FULL_SONG',
        audioUrl: exactMatch.fullAudioUrl,
        mimeType: exactMatch.fileFormat === 'FLAC' ? 'audio/flac' : 'audio/mpeg',
        fileFormat: exactMatch.fileFormat,
        expectedDurationMs: exactMatch.durationMs,
        contentLength: exactMatch.fileSizeBytes,
        supportsRange: true
      };
    }
  }

  // Commercial platforms: never fall back to 30s previews or unofficial stream ripping
  if (params.sourcePlatform === 'YOUTUBE' || isWebpageOnlyUrl(params.sourceUrl)) {
    if (params.sourcePlatform !== 'SPOTIFY' && params.sourcePlatform !== 'APPLE_MUSIC') {
      return {
        downloadable: false,
        status: 'STREAM_ONLY',
        expectedDurationMs,
        reason: 'This source supports official streaming playback only; full-song downloading is not permitted.'
      };
    }
  }

  if (
    params.sourcePlatform === 'APPLE_MUSIC' ||
    params.sourcePlatform === 'SPOTIFY' ||
    isPreviewOrSampleUrl(params.previewUrl)
  ) {
    return {
      downloadable: false,
      status: 'PREVIEW_ONLY',
      expectedDurationMs,
      reason: 'This catalog source only provides a 30-second preview clip. SyncWave blocks saving previews as full songs.'
    };
  }

  return {
    downloadable: false,
    status: 'UNAVAILABLE',
    expectedDurationMs,
    reason: 'No complete full-length downloadable audio file is available from this source.'
  };
}
