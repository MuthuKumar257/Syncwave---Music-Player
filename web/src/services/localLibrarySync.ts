import { Song } from '../types';

const AUDIO_EXT_REGEX = /\.(mp3|wav|flac|aac|m4a|ogg|opus|webm|wma|alac)$/i;

export function isSupportedAudioFile(fileName: string, mimeType = ''): boolean {
  if (/\.(part|tmp|crdownload)$/i.test(fileName)) return false;
  return mimeType.startsWith('audio/') || AUDIO_EXT_REGEX.test(fileName);
}

export function extractFileFormat(fileName: string, mimeType = ''): string {
  const extMatch = fileName.match(/\.([a-z0-9]+)$/i);
  if (extMatch) {
    return extMatch[1].toUpperCase();
  }
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'MP3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'M4A';
  if (mimeType.includes('flac')) return 'FLAC';
  if (mimeType.includes('aac')) return 'AAC';
  if (mimeType.includes('wav')) return 'WAV';
  if (mimeType.includes('ogg')) return 'OGG';
  return 'AUDIO';
}

export function parseTitleArtistFromFilename(fileName: string): { title: string; artist: string } {
  const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
  if (cleanName.includes(' - ')) {
    const parts = cleanName.split(' - ');
    return {
      artist: parts[0].trim() || 'Unknown Artist',
      title: parts.slice(1).join(' - ').trim() || cleanName,
    };
  }
  return {
    title: cleanName || 'Unknown Track',
    artist: 'Unknown Artist',
  };
}

function decodeTextFrame(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const encoding = bytes[0];
  const payload = bytes.slice(1);
  try {
    if (encoding === 1 || encoding === 2) {
      const text = new TextDecoder(encoding === 1 ? 'utf-16' : 'utf-16be').decode(payload);
      return text.replace(/\0/g, '').trim();
    }
    const text = new TextDecoder(encoding === 3 ? 'utf-8' : 'iso-8859-1').decode(payload);
    return text.replace(/\0/g, '').trim();
  } catch {
    return '';
  }
}

function parseApicArtwork(bytes: Uint8Array): string | undefined {
  if (bytes.length < 16) return undefined;
  const encoding = bytes[0];
  let idx = 1;
  let mime = 'image/jpeg';
  const mimeStart = idx;
  while (idx < bytes.length && bytes[idx] !== 0) idx++;
  if (idx > mimeStart) {
    mime = new TextDecoder('ascii').decode(bytes.slice(mimeStart, idx)) || 'image/jpeg';
  }
  idx += 2; // Skip null terminator + picture type byte

  // Skip description string
  if (encoding === 1 || encoding === 2) {
    while (idx + 1 < bytes.length && (bytes[idx] !== 0 || bytes[idx + 1] !== 0)) idx += 2;
    idx += 2;
  } else {
    while (idx < bytes.length && bytes[idx] !== 0) idx++;
    idx += 1;
  }

  if (idx >= bytes.length || bytes.length - idx > 2 * 1024 * 1024) return undefined;
  const imgBytes = bytes.slice(idx);
  if (imgBytes.length < 32) return undefined;

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < imgBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...imgBytes.subarray(i, i + chunkSize));
  }
  return `data:${mime.startsWith('image/') ? mime : 'image/jpeg'};base64,${btoa(binary)}`;
}

/**
 * Reads lightweight ID3v2 metadata (title, artist, album, embedded cover art) from the
 * head of an MP3/audio file offline without third-party dependencies.
 */
export async function extractAudioMetadata(file: File): Promise<{
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  durationMs: number;
  fileFormat: string;
}> {
  const fallback = parseTitleArtistFromFilename(file.name);
  let title = fallback.title;
  let artist = fallback.artist;
  let album: string | undefined;
  let artworkUrl: string | undefined;
  const fileFormat = extractFileFormat(file.name, file.type);

  try {
    const headerBuf = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(headerBuf);
    if (headerBuf.byteLength > 10 && view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
      const version = view.getUint8(3);
      const tagSize =
        ((view.getUint8(6) & 0x7f) << 21) |
        ((view.getUint8(7) & 0x7f) << 14) |
        ((view.getUint8(8) & 0x7f) << 7) |
        (view.getUint8(9) & 0x7f);

      let offset = 10;
      const limit = Math.min(headerBuf.byteLength, 10 + tagSize);
      while (offset + 10 < limit) {
        const frameId = String.fromCharCode(
          view.getUint8(offset),
          view.getUint8(offset + 1),
          view.getUint8(offset + 2),
          view.getUint8(offset + 3)
        );
        if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

        const frameSize =
          version === 4
            ? ((view.getUint8(offset + 4) & 0x7f) << 21) |
              ((view.getUint8(offset + 5) & 0x7f) << 14) |
              ((view.getUint8(offset + 6) & 0x7f) << 7) |
              (view.getUint8(offset + 7) & 0x7f)
            : view.getUint32(offset + 4, false);

        offset += 10;
        if (frameSize <= 0 || offset + frameSize > limit) break;

        const payload = new Uint8Array(headerBuf, offset, frameSize);
        if (frameId === 'TIT2') title = decodeTextFrame(payload) || title;
        else if (frameId === 'TPE1') artist = decodeTextFrame(payload) || artist;
        else if (frameId === 'TALB') album = decodeTextFrame(payload) || album;
        else if (frameId === 'APIC' && !artworkUrl) artworkUrl = parseApicArtwork(payload);

        offset += frameSize;
      }
    }
  } catch {
    // Ignore malformed tags and fall back to filename
  }

  let durationMs = 0;
  if (typeof Audio !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(file);
    try {
      durationMs = await new Promise<number>((resolve) => {
        const audio = new Audio();
        const done = (ms: number) => {
          audio.onloadedmetadata = null;
          audio.onerror = null;
          resolve(ms);
        };
        const timer = setTimeout(() => done(0), 2500);
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

  return { title, artist, album, artworkUrl, durationMs, fileFormat };
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

export async function pickMusicDirectoryHandle(): Promise<any | null> {
  if (!isDirectoryPickerSupported()) return null;
  return (window as any).showDirectoryPicker({ mode: 'read' });
}

export async function queryDirectoryPermission(
  handle: any
): Promise<'granted' | 'prompt' | 'denied'> {
  if (!handle || typeof handle.queryPermission !== 'function') return 'denied';
  try {
    return await handle.queryPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
}

export async function requestDirectoryPermission(
  handle: any
): Promise<'granted' | 'prompt' | 'denied'> {
  if (!handle || typeof handle.requestPermission !== 'function') return 'denied';
  try {
    return await handle.requestPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
}

export interface ScannedHandleEntry {
  fileHandle: any;
  file: File;
  relativePath: string;
}

export async function scanDirectoryHandleRecursive(
  dirHandle: any,
  prefix = ''
): Promise<ScannedHandleEntry[]> {
  const results: ScannedHandleEntry[] = [];
  if (!dirHandle || typeof dirHandle.values !== 'function') return results;

  for await (const entry of dirHandle.values()) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      const nested = await scanDirectoryHandleRecursive(entry, relPath);
      results.push(...nested);
    } else if (entry.kind === 'file' && isSupportedAudioFile(entry.name)) {
      try {
        const file: File = await entry.getFile();
        if (file.size > 0) {
          results.push({ fileHandle: entry, file, relativePath: relPath });
        }
      } catch {
        // Skip unreadable entries
      }
    }
  }
  return results;
}

export async function saveAudioToOpfsSongsFolder(blob: Blob, filename: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return;
  try {
    const root = await navigator.storage.getDirectory();
    const songsDir = await root.getDirectoryHandle('Songs', { create: true });
    const fileHandle = await songsDir.getFileHandle(filename, { create: true });
    if (typeof (fileHandle as any).createWritable === 'function') {
      const writable = await (fileHandle as any).createWritable();
      await writable.write(blob);
      await writable.close();
    }
  } catch {
    // Fallback handled by IndexedDB blob storage
  }
}

export async function deleteOpfsSongFile(filename: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return false;
  try {
    const root = await navigator.storage.getDirectory();
    const songsDir = await root.getDirectoryHandle('Songs', { create: false });
    await (songsDir as any).removeEntry(filename);
    return true;
  } catch {
    return false;
  }
}

export async function scanOpfsSongsFolder(): Promise<ScannedHandleEntry[]> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return [];
  try {
    const root = await navigator.storage.getDirectory();
    const songsDir = await root.getDirectoryHandle('Songs', { create: true });
    return await scanDirectoryHandleRecursive(songsDir);
  } catch {
    return [];
  }
}

export function buildSongDedupeKey(song: Pick<Song, 'title' | 'artist' | 'durationMs' | 'localFileName' | 'fileSize'>): string {
  const normTitle = (song.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normArtist = (song.artist || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const bucketDur = Math.round((song.durationMs || 0) / 3000);
  if (normTitle && normArtist && normArtist !== 'unknown artist' && normArtist !== 'local artist') {
    return `meta:${normTitle}|${normArtist}|${bucketDur}`;
  }
  if (song.localFileName && song.fileSize) {
    return `file:${song.localFileName.toLowerCase()}|${song.fileSize}`;
  }
  return `meta:${normTitle}|${bucketDur}`;
}

const ORIGIN_PRIORITY: Record<string, number> = {
  DOWNLOADED: 3,
  FOLDER: 2,
  DEVICE: 1,
};

export function deduplicateLibrarySongs(songs: Song[]): Song[] {
  const byKey = new Map<string, Song>();

  for (const song of songs) {
    const origin =
      song.originType ||
      (song.source === 'DOWNLOADED' ? 'DOWNLOADED' : song.folderId ? 'FOLDER' : 'DEVICE');
    const key = buildSongDedupeKey(song);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, { ...song, originType: origin });
      continue;
    }

    const existingOrigin =
      existing.originType ||
      (existing.source === 'DOWNLOADED' ? 'DOWNLOADED' : existing.folderId ? 'FOLDER' : 'DEVICE');
    const newWins = (ORIGIN_PRIORITY[origin] || 0) > (ORIGIN_PRIORITY[existingOrigin] || 0);
    const primary = newWins ? song : existing;
    const secondary = newWins ? existing : song;

    byKey.set(key, {
      ...primary,
      originType: newWins ? origin : existingOrigin,
      artworkUrl: primary.artworkUrl || secondary.artworkUrl,
      durationMs: primary.durationMs > 0 ? primary.durationMs : secondary.durationMs,
      fileFormat: primary.fileFormat || secondary.fileFormat,
      blob: primary.blob || secondary.blob,
      fileHandle: primary.fileHandle || secondary.fileHandle,
    });
  }

  return Array.from(byKey.values());
}
