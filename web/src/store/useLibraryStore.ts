import { create } from 'zustand';
import { Song, Playlist, MusicFolderEntry, SongOriginType, DownloadTask } from '../types';
import { localDb } from '../db/indexedDb';
import {
  isSupportedAudioFile,
  extractFileFormat,
  extractAudioMetadata,
  isDirectoryPickerSupported,
  pickMusicDirectoryHandle,
  queryDirectoryPermission,
  requestDirectoryPermission,
  scanDirectoryHandleRecursive,
  saveAudioToOpfsSongsFolder,
  deleteOpfsSongFile,
  scanOpfsSongsFolder,
  buildSongDedupeKey,
  deduplicateLibrarySongs,
  ScannedHandleEntry
} from '../services/localLibrarySync';
import {
  checkTrackFullDownloadAvailability,
  downloadWithResumeAndVerify,
  measureAudioBlobDurationMs,
  validateAudioBlobIntegrity,
  validateDownloadDuration
} from '../services/fullDownloadService';
import { usePlayerStore } from './usePlayerStore';

const downloadControllers = new Map<string, AbortController>();

function buildSafeAudioFilename(title: string, artist: string, mimeTypeOrFormat: string): string {
  const cleanTitle = (title || 'SyncWave_Track').replace(/[<>:"/\\|?*]+/g, '').trim();
  const cleanArtist = (artist || 'Artist').replace(/[<>:"/\\|?*]+/g, '').trim();
  const lower = mimeTypeOrFormat.toLowerCase();
  const ext =
    lower.includes('flac')
      ? 'flac'
      : lower.includes('alac')
        ? 'alac'
        : lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')
          ? 'm4a'
          : lower.includes('mpeg') || lower.includes('mp3')
            ? 'mp3'
            : lower.includes('ogg')
              ? 'ogg'
              : lower.includes('opus')
                ? 'opus'
                : lower.includes('wav')
                  ? 'wav'
                  : 'mp3';
  return `${cleanTitle} - ${cleanArtist}.${ext}`;
}

async function persistBlobToSongsFolderAndDevice(
  blob: Blob,
  filename: string,
  triggerDiskDownload: boolean
): Promise<void> {
  // 1. Always persist into the app-designated offline OPFS `Songs` directory
  await saveAudioToOpfsSongsFolder(blob, filename);

  // 2. Also trigger save into device Downloads folder when requested
  if (triggerDiskDownload && typeof document !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      // Safe fallback in headless environments
    }
  }
}

async function buildSongFromScannedFile(
  entry: ScannedHandleEntry,
  folderId: string,
  folderName: string,
  originType: SongOriginType,
  existingId?: string,
  storeBlob = false
): Promise<Song> {
  const meta = await extractAudioMetadata(entry.file);
  const stableSlug = `${folderId}_${entry.relativePath}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    id: existingId || `folder_${stableSlug}`,
    title: meta.title,
    artist: meta.artist,
    album: meta.album || folderName || 'Local Music Folder',
    durationMs: meta.durationMs || 180000,
    blob: storeBlob ? entry.file : undefined,
    fileHandle: entry.fileHandle,
    artworkUrl: meta.artworkUrl,
    source: originType === 'DOWNLOADED' ? 'DOWNLOADED' : 'LOCAL',
    originType,
    fileFormat: meta.fileFormat,
    folderId,
    folderName,
    relativePath: entry.relativePath,
    lastModified: entry.file.lastModified,
    fileSize: entry.file.size,
    isLocal: true,
    storageLocation: 'LOCAL_DEVICE',
    localFileName: entry.file.name,
    createdAt: new Date().toISOString()
  };
}

let isSyncInFlight = false;
let lastSyncTimestamp = 0;

interface LibraryState {
  songs: Song[];
  rawSongCount: number;
  playlists: Playlist[];
  favorites: string[];
  musicFolders: MusicFolderEntry[];
  downloadTasks: DownloadTask[];
  downloadError: string | null;
  defaultFolderPromptDismissed: boolean;
  sourceFilter: 'ALL' | SongOriginType;
  searchQuery: string;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncSummary: string | null;

  // Actions
  loadLibrary: () => Promise<void>;
  syncLibrary: (options?: { force?: boolean; quiet?: boolean }) => Promise<void>;
  addLocalFiles: (files: FileList | File[]) => Promise<void>;
  selectMusicFolder: (options?: { makeDefault?: boolean }) => Promise<'ADDED' | 'CANCELLED' | 'FALLBACK_REQUIRED'>;
  importFallbackFolderFiles: (files: FileList | File[], makeDefault?: boolean) => Promise<void>;
  setDefaultMusicFolder: (folderId: string) => Promise<void>;
  removeMusicFolder: (folderId: string) => Promise<void>;
  reauthorizeMusicFolder: (folderId: string) => Promise<void>;
  dismissDefaultFolderPrompt: () => Promise<void>;
  setSourceFilter: (filter: 'ALL' | SongOriginType) => void;
  deleteSong: (id: string) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  renamePlaylist: (playlistId: string, newName: string) => Promise<void>;
  reorderPlaylistSongs: (playlistId: string, fromIndex: number, toIndex: number) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  downloadOnlineTrackToLocal: (track: any) => Promise<Song>;
  pauseDownload: (taskId: string) => Promise<void>;
  resumeDownload: (taskId: string) => Promise<Song | null>;
  cancelDownload: (taskId: string) => Promise<void>;
  clearDownloadError: () => void;
  saveSongFileToDevice: (song: Song) => Promise<void>;
  isDownloaded: (trackId: string, title?: string) => boolean;
  toggleFavorite: (songId: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  songs: [],
  rawSongCount: 0,
  playlists: [],
  favorites: [],
  musicFolders: [],
  downloadTasks: [],
  downloadError: null,
  defaultFolderPromptDismissed: true,
  sourceFilter: 'ALL',
  searchQuery: '',
  isLoading: false,
  isSyncing: false,
  lastSyncSummary: null,

  loadLibrary: async () => {
    set({ isLoading: true });
    try {
      const [rawSongs, playlists, favorites, storedFolders, promptDismissed, storedTasks] = await Promise.all([
        localDb.getAllSongs(),
        localDb.getAllPlaylists(),
        localDb.getFavorites(),
        localDb.getAllMusicFolders(),
        localDb.getMeta<boolean>('defaultFolderPromptDismissed'),
        localDb.getAllDownloadTasks()
      ]);

      // Normalize any interrupted in-flight downloads from a previous reload so user can resume cleanly
      const normalizedTasks = storedTasks.map((t) =>
        t.status === 'downloading' || t.status === 'verifying'
          ? { ...t, status: 'failed' as const, error: t.error || 'Download interrupted. Tap Resume to continue.' }
          : t
      );

      // Normalize legacy local songs with originType & fileFormat
      const normalizedSongs = rawSongs.map((s) => ({
        ...s,
        originType:
          s.originType ||
          (s.source === 'DOWNLOADED' ? 'DOWNLOADED' : s.folderId ? 'FOLDER' : 'DEVICE'),
        fileFormat:
          s.fileFormat ||
          extractFileFormat(s.localFileName || s.uri || s.title, s.blob?.type || '')
      }));

      // Refresh permission statuses of saved handles without throwing
      const refreshedFolders: MusicFolderEntry[] = await Promise.all(
        storedFolders.map(async (f) => ({
          ...f,
          permissionState: f.handle ? await queryDirectoryPermission(f.handle) : f.permissionState
        }))
      );

      // Seed initial offline playlists & sample library if completely fresh
      if (normalizedSongs.length === 0 && playlists.length === 0) {
        const demoSongs: Song[] = [
          {
            id: 'demo_1',
            title: 'Electric Horizon',
            artist: 'SyncWave Original',
            album: 'Neon Synthetics',
            durationMs: 195000,
            uri: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
            artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
            source: 'LOCAL',
            originType: 'DEVICE',
            fileFormat: 'MP3',
            isLocal: true,
            storageLocation: 'LOCAL_DEVICE',
            createdAt: new Date().toISOString()
          },
          {
            id: 'demo_2',
            title: 'Ambient Deep Focus',
            artist: 'Mind Wave Collective',
            album: 'Zenith Space',
            durationMs: 240000,
            uri: 'https://cdn.freesound.org/previews/587/587985_12897464-lq.mp3',
            artworkUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=60',
            source: 'LOCAL',
            originType: 'DEVICE',
            fileFormat: 'MP3',
            isLocal: true,
            storageLocation: 'LOCAL_DEVICE',
            createdAt: new Date().toISOString()
          }
        ];
        for (const s of demoSongs) await localDb.saveSong(s);

        const defaultPlaylist: Playlist = {
          id: 'pl_favorites',
          name: 'My Chill Mix',
          description: 'Curated relaxing electronic tracks',
          songIds: ['demo_1', 'demo_2'],
          songCount: 2,
          isFavorite: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await localDb.savePlaylist(defaultPlaylist);

        set({
          songs: demoSongs,
          rawSongCount: demoSongs.length,
          playlists: [defaultPlaylist],
          favorites: ['demo_1'],
          musicFolders: refreshedFolders,
          downloadTasks: normalizedTasks,
          defaultFolderPromptDismissed: Boolean(promptDismissed) || refreshedFolders.length > 0,
          isLoading: false
        });
      } else {
        const deduped = deduplicateLibrarySongs(normalizedSongs);
        set({
          songs: deduped,
          rawSongCount: normalizedSongs.length,
          playlists,
          favorites,
          musicFolders: refreshedFolders,
          downloadTasks: normalizedTasks,
          defaultFolderPromptDismissed: Boolean(promptDismissed) || refreshedFolders.length > 0,
          isLoading: false
        });
      }

      // Automatically sync granted folders & OPFS Songs directory in background
      void get().syncLibrary({ quiet: true });
    } catch (e) {
      console.error('Failed to load library:', e);
      set({ isLoading: false });
    }
  },

  syncLibrary: async (options = {}) => {
    const now = Date.now();
    if (isSyncInFlight) return;
    if (!options.force && now - lastSyncTimestamp < 8000) return;

    isSyncInFlight = true;
    lastSyncTimestamp = now;
    if (!options.quiet) set({ isSyncing: true });

    try {
      const [dbSongs, storedFolders] = await Promise.all([
        localDb.getAllSongs(),
        localDb.getAllMusicFolders()
      ]);

      let added = 0;
      let removed = 0;
      const updatedFolders: MusicFolderEntry[] = [];

      // 1. Sync user-selected FileSystemDirectoryHandle folders
      for (const folder of storedFolders) {
        if (!folder.handle) {
          updatedFolders.push(folder);
          continue;
        }

        const perm = await queryDirectoryPermission(folder.handle);
        if (perm !== 'granted') {
          updatedFolders.push({ ...folder, permissionState: perm });
          continue;
        }

        const scanned = await scanDirectoryHandleRecursive(folder.handle);
        const existingInFolder = dbSongs.filter((s) => s.folderId === folder.id);
        const matchedExistingIds = new Set<string>();

        for (const entry of scanned) {
          const samePath = existingInFolder.find(
            (s) =>
              s.relativePath === entry.relativePath &&
              s.fileSize === entry.file.size &&
              s.lastModified === entry.file.lastModified
          );
          if (samePath) {
            matchedExistingIds.add(samePath.id);
            continue;
          }

          // Detect moved/renamed file within the folder
          const movedFile = existingInFolder.find(
            (s) =>
              !matchedExistingIds.has(s.id) &&
              s.localFileName === entry.file.name &&
              s.fileSize === entry.file.size &&
              s.lastModified === entry.file.lastModified
          );

          const built = await buildSongFromScannedFile(
            entry,
            folder.id,
            folder.name,
            'FOLDER',
            movedFile?.id
          );
          await localDb.saveSong(built);
          matchedExistingIds.add(built.id);
          if (!movedFile) added += 1;
        }

        // Remove songs deleted from the folder
        for (const oldSong of existingInFolder) {
          if (!matchedExistingIds.has(oldSong.id)) {
            await localDb.deleteSong(oldSong.id);
            removed += 1;
          }
        }

        updatedFolders.push({
          ...folder,
          permissionState: 'granted',
          lastScannedAt: new Date().toISOString(),
          trackCount: scanned.length
        });
      }

      for (const f of updatedFolders) {
        await localDb.saveMusicFolder(f);
      }

      // 2. Sync app-designated OPFS `Songs` folder (offline downloads)
      const opfsEntries = await scanOpfsSongsFolder();
      const refreshedAfterFolders = await localDb.getAllSongs();
      const opfsSongsInDb = refreshedAfterFolders.filter(
        (s) => s.folderId === 'opfs_songs_dir'
      );
      const matchedOpfsIds = new Set<string>();

      for (const entry of opfsEntries) {
        const existingMatch = refreshedAfterFolders.find(
          (s) =>
            (s.folderId === 'opfs_songs_dir' && s.localFileName === entry.file.name) ||
            (s.source === 'DOWNLOADED' && s.localFileName === entry.file.name)
        );
        if (existingMatch) {
          matchedOpfsIds.add(existingMatch.id);
          continue;
        }
        const opfsSong = await buildSongFromScannedFile(
          entry,
          'opfs_songs_dir',
          'Songs',
          'DOWNLOADED',
          undefined,
          true
        );
        await localDb.saveSong(opfsSong);
        matchedOpfsIds.add(opfsSong.id);
        added += 1;
      }

      for (const staleOpfs of opfsSongsInDb) {
        if (!matchedOpfsIds.has(staleOpfs.id)) {
          await localDb.deleteSong(staleOpfs.id);
          removed += 1;
        }
      }

      // Reload & deduplicate
      const finalDbSongs = await localDb.getAllSongs();
      const normalized = finalDbSongs.map((s) => ({
        ...s,
        originType:
          s.originType ||
          (s.source === 'DOWNLOADED' ? 'DOWNLOADED' : s.folderId ? 'FOLDER' : 'DEVICE'),
        fileFormat:
          s.fileFormat ||
          extractFileFormat(s.localFileName || s.uri || s.title, s.blob?.type || '')
      }));
      const deduped = deduplicateLibrarySongs(normalized);

      const summaryParts: string[] = [];
      if (added > 0) summaryParts.push(`+${added} added`);
      if (removed > 0) summaryParts.push(`-${removed} removed`);

      set({
        songs: deduped,
        rawSongCount: normalized.length,
        musicFolders: updatedFolders,
        isSyncing: false,
        lastSyncSummary:
          summaryParts.length > 0
            ? `Synced (${summaryParts.join(', ')})`
            : options.quiet
              ? get().lastSyncSummary
              : 'Library up to date'
      });
    } catch (err) {
      console.error('Library sync failed:', err);
      set({ isSyncing: false });
    } finally {
      isSyncInFlight = false;
    }
  },

  addLocalFiles: async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => isSupportedAudioFile(f.name, f.type));
    if (fileArray.length === 0) return;

    const existingSongs = await localDb.getAllSongs();
    const existingKeys = new Set(existingSongs.map((s) => buildSongDedupeKey(s)));

    for (const file of fileArray) {
      const meta = await extractAudioMetadata(file);
      const candidate: Song = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: meta.title,
        artist: meta.artist,
        album: meta.album || 'Device Library',
        durationMs: meta.durationMs || 180000,
        blob: file,
        artworkUrl: meta.artworkUrl,
        source: 'LOCAL',
        originType: 'DEVICE',
        fileFormat: meta.fileFormat,
        folderName: 'Device Library',
        fileSize: file.size,
        lastModified: file.lastModified,
        isLocal: true,
        storageLocation: 'LOCAL_DEVICE',
        localFileName: file.name,
        createdAt: new Date().toISOString()
      };

      const key = buildSongDedupeKey(candidate);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      await localDb.saveSong(candidate);
    }

    await get().loadLibrary();
  },

  selectMusicFolder: async (options = {}) => {
    if (!isDirectoryPickerSupported()) {
      return 'FALLBACK_REQUIRED';
    }
    try {
      const dirHandle = await pickMusicDirectoryHandle();
      if (!dirHandle) return 'CANCELLED';

      const existing = await localDb.getAllMusicFolders();
      // Reuse existing entry if user picked the same handle
      let targetFolder: MusicFolderEntry | undefined;
      for (const f of existing) {
        if (f.handle && typeof f.handle.isSameEntry === 'function') {
          try {
            if (await f.handle.isSameEntry(dirHandle)) {
              targetFolder = f;
              break;
            }
          } catch {
            // Ignore comparison failure
          }
        }
      }

      const makeDefault = options.makeDefault ?? existing.length === 0;
      const folderId = targetFolder?.id || `dir_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      if (makeDefault) {
        for (const f of existing) {
          if (f.id !== folderId && f.isDefault) {
            await localDb.saveMusicFolder({ ...f, isDefault: false });
          }
        }
      }

      const folderEntry: MusicFolderEntry = {
        id: folderId,
        name: dirHandle.name || 'Music Folder',
        isDefault: makeDefault || Boolean(targetFolder?.isDefault),
        handle: dirHandle,
        permissionState: 'granted',
        addedAt: targetFolder?.addedAt || new Date().toISOString(),
        lastScannedAt: new Date().toISOString(),
        trackCount: targetFolder?.trackCount || 0
      };

      await localDb.saveMusicFolder(folderEntry);
      await localDb.setMeta('defaultFolderPromptDismissed', true);
      set({ defaultFolderPromptDismissed: true });

      await get().syncLibrary({ force: true });
      return 'ADDED';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'CANCELLED';
      console.error('Failed selecting folder:', err);
      return 'CANCELLED';
    }
  },

  importFallbackFolderFiles: async (files: FileList | File[], makeDefault?: boolean) => {
    const fileArray = Array.from(files).filter((f) => isSupportedAudioFile(f.name, f.type));
    if (fileArray.length === 0) return;

    const firstRel = (fileArray[0] as any).webkitRelativePath || '';
    const folderName = firstRel.includes('/') ? firstRel.split('/')[0] : 'Selected Music Folder';
    const folderId = `fallback_${folderName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

    const existing = await localDb.getAllMusicFolders();
    const shouldBeDefault = makeDefault ?? existing.length === 0;
    if (shouldBeDefault) {
      for (const f of existing) {
        if (f.id !== folderId && f.isDefault) {
          await localDb.saveMusicFolder({ ...f, isDefault: false });
        }
      }
    }

    const existingSongs = await localDb.getAllSongs();
    const existingKeys = new Set(existingSongs.map((s) => buildSongDedupeKey(s)));
    let importedCount = 0;

    for (const file of fileArray) {
      const relPath = (file as any).webkitRelativePath || file.name;
      const meta = await extractAudioMetadata(file);
      const song: Song = {
        id: `folder_${folderId}_${relPath.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        title: meta.title,
        artist: meta.artist,
        album: meta.album || folderName,
        durationMs: meta.durationMs || 180000,
        blob: file,
        artworkUrl: meta.artworkUrl,
        source: 'LOCAL',
        originType: 'FOLDER',
        fileFormat: meta.fileFormat,
        folderId,
        folderName,
        relativePath: relPath,
        lastModified: file.lastModified,
        fileSize: file.size,
        isLocal: true,
        storageLocation: 'LOCAL_DEVICE',
        localFileName: file.name,
        createdAt: new Date().toISOString()
      };
      const key = buildSongDedupeKey(song);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      await localDb.saveSong(song);
      importedCount += 1;
    }

    await localDb.saveMusicFolder({
      id: folderId,
      name: folderName,
      isDefault: shouldBeDefault,
      permissionState: 'fallback',
      addedAt: new Date().toISOString(),
      lastScannedAt: new Date().toISOString(),
      trackCount: importedCount
    });
    await localDb.setMeta('defaultFolderPromptDismissed', true);
    set({ defaultFolderPromptDismissed: true, lastSyncSummary: `Imported ${importedCount} tracks from ${folderName}` });
    await get().loadLibrary();
  },

  setDefaultMusicFolder: async (folderId: string) => {
    const folders = await localDb.getAllMusicFolders();
    for (const f of folders) {
      await localDb.saveMusicFolder({ ...f, isDefault: f.id === folderId });
    }
    const updated = folders.map((f) => ({ ...f, isDefault: f.id === folderId }));
    set({ musicFolders: updated });
  },

  removeMusicFolder: async (folderId: string) => {
    const songs = await localDb.getAllSongs();
    for (const s of songs) {
      if (s.folderId === folderId) {
        await localDb.deleteSong(s.id);
      }
    }
    await localDb.deleteMusicFolder(folderId);
    await get().loadLibrary();
  },

  reauthorizeMusicFolder: async (folderId: string) => {
    const folders = await localDb.getAllMusicFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder?.handle) return;
    const perm = await requestDirectoryPermission(folder.handle);
    await localDb.saveMusicFolder({ ...folder, permissionState: perm });
    if (perm === 'granted') {
      await get().syncLibrary({ force: true });
    } else {
      set({
        musicFolders: folders.map((f) => (f.id === folderId ? { ...f, permissionState: perm } : f))
      });
    }
  },

  dismissDefaultFolderPrompt: async () => {
    await localDb.setMeta('defaultFolderPromptDismissed', true);
    set({ defaultFolderPromptDismissed: true });
  },

  setSourceFilter: (sourceFilter) => set({ sourceFilter }),

  deleteSong: async (id: string) => {
    const existing = get().songs.find((s) => s.id === id);
    if (existing) {
      // 1. If OPFS or downloaded audio file, delete from OPFS storage
      if (existing.localFileName || existing.folderId === 'opfs_songs_dir' || existing.source === 'DOWNLOADED') {
        const fname = existing.localFileName || `${existing.id}.m4a`;
        await deleteOpfsSongFile(fname);
      }
      // 2. Notify backend if synchronized
      try {
        await fetch(`/api/songs/${id}`, { method: 'DELETE' });
      } catch {}
    }

    // 3. Delete from IndexedDB
    await localDb.deleteSong(id);

    // 4. Remove from all playlists where present
    const { playlists } = get();
    for (const pl of playlists) {
      if (pl.songIds.includes(id)) {
        const updated = {
          ...pl,
          songIds: pl.songIds.filter((sId) => sId !== id),
          songCount: Math.max(0, pl.songCount - 1),
          updatedAt: new Date().toISOString()
        };
        await localDb.savePlaylist(updated);
      }
    }

    // 5. Remove from favorites if favorited
    if (get().favorites.includes(id)) {
      await localDb.removeFavorite(id);
    }

    // 6. Remove from current queue if queued
    try {
      const playerStore = usePlayerStore.getState();
      const currentQueue = playerStore.queue;
      const queuedIdx = currentQueue.findIndex((s) => s.id === id);
      if (queuedIdx >= 0) {
        playerStore.removeFromQueue(queuedIdx);
      }
    } catch {}

    // 7. Refresh library state immediately
    await get().loadLibrary();
  },

  createPlaylist: async (name: string, description?: string) => {
    const playlist: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      description,
      songIds: [],
      songCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await localDb.savePlaylist(playlist);
    await get().loadLibrary();
    return playlist;
  },

  renamePlaylist: async (playlistId: string, newName: string) => {
    const { playlists } = get();
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    playlist.name = trimmed;
    playlist.updatedAt = new Date().toISOString();
    await localDb.savePlaylist(playlist);
    await get().loadLibrary();
  },

  reorderPlaylistSongs: async (playlistId: string, fromIndex: number, toIndex: number) => {
    const { playlists } = get();
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return;
    if (fromIndex < 0 || fromIndex >= playlist.songIds.length || toIndex < 0 || toIndex >= playlist.songIds.length) return;

    const nextSongIds = [...playlist.songIds];
    const [movedId] = nextSongIds.splice(fromIndex, 1);
    nextSongIds.splice(toIndex, 0, movedId);

    playlist.songIds = nextSongIds;
    playlist.updatedAt = new Date().toISOString();
    await localDb.savePlaylist(playlist);
    await get().loadLibrary();
  },

  addSongToPlaylist: async (playlistId: string, songId: string) => {
    const { playlists } = get();
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    if (!playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId);
      playlist.songCount = playlist.songIds.length;
      playlist.updatedAt = new Date().toISOString();
      await localDb.savePlaylist(playlist);
      await get().loadLibrary();
    }
  },

  removeSongFromPlaylist: async (playlistId: string, songId: string) => {
    const { playlists } = get();
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    playlist.songIds = playlist.songIds.filter((id) => id !== songId);
    playlist.songCount = playlist.songIds.length;
    playlist.updatedAt = new Date().toISOString();
    await localDb.savePlaylist(playlist);
    await get().loadLibrary();
  },

  deletePlaylist: async (playlistId: string) => {
    await localDb.deletePlaylist(playlistId);
    await get().loadLibrary();
  },

  isDownloaded: (trackId: string, title?: string) => {
    const { songs } = get();
    const normTitle = title?.toLowerCase().trim();
    return songs.some(
      (s) =>
        (s.originType === 'DOWNLOADED' || s.source === 'DOWNLOADED') &&
        (s.id === trackId ||
          s.id === `local_dl_${trackId}` ||
          (normTitle ? s.title.toLowerCase().trim() === normTitle : s.title.toLowerCase() === trackId.toLowerCase()))
    );
  },

  clearDownloadError: () => set({ downloadError: null }),

  pauseDownload: async (taskId: string) => {
    const controller = downloadControllers.get(taskId);
    if (controller) {
      controller.abort('PAUSED_BY_USER');
      downloadControllers.delete(taskId);
    }
    const existing = await localDb.getDownloadTaskById(taskId);
    if (existing) {
      const updated: DownloadTask = {
        ...existing,
        status: 'paused',
        error: undefined,
        updatedAt: new Date().toISOString()
      };
      await localDb.saveDownloadTask(updated);
      set((s) => ({
        downloadTasks: s.downloadTasks.map((t) => (t.id === taskId ? updated : t))
      }));
    }
  },

  cancelDownload: async (taskId: string) => {
    const controller = downloadControllers.get(taskId);
    if (controller) {
      controller.abort('CANCELLED_BY_USER');
      downloadControllers.delete(taskId);
    }
    await localDb.deleteDownloadTask(taskId);
    set((s) => ({
      downloadTasks: s.downloadTasks.filter((t) => t.id !== taskId)
    }));
  },

  resumeDownload: async (taskId: string) => {
    const existing = await localDb.getDownloadTaskById(taskId);
    if (!existing) return null;

    set({ downloadError: null });
    const controller = new AbortController();
    downloadControllers.set(taskId, controller);

    const upsertTask = async (t: DownloadTask) => {
      await localDb.saveDownloadTask(t);
      set((s) => ({
        downloadTasks: s.downloadTasks.some((x) => x.id === t.id)
          ? s.downloadTasks.map((x) => (x.id === t.id ? t : x))
          : [...s.downloadTasks, t]
      }));
    };

    try {
      const verified = await downloadWithResumeAndVerify({
        task: existing,
        signal: controller.signal,
        onTaskUpdate: upsertTask
      });
      downloadControllers.delete(taskId);

      await persistBlobToSongsFolderAndDevice(verified.blob, existing.fileName, true);
      const localSong: Song = {
        id: existing.id,
        title: existing.title,
        artist: existing.artist,
        album: existing.album,
        durationMs: verified.actualDurationMs,
        artworkUrl: existing.artworkUrl,
        blob: verified.blob,
        source: 'DOWNLOADED',
        originType: 'DOWNLOADED',
        fileFormat: verified.fileFormat,
        folderName: 'Songs',
        externalUrl: existing.externalUrl,
        fileSize: verified.blob.size,
        isLocal: true,
        storageLocation: 'LOCAL_DEVICE',
        localFileName: existing.fileName,
        verifiedFullLength: true,
        createdAt: new Date().toISOString()
      };

      await localDb.saveSong(localSong);
      await localDb.deleteDownloadTask(taskId);
      set((s) => ({
        downloadTasks: s.downloadTasks.filter((t) => t.id !== taskId)
      }));
      await get().loadLibrary();
      return localSong;
    } catch (err: any) {
      downloadControllers.delete(taskId);
      const latest = await localDb.getDownloadTaskById(taskId);
      const wasPaused = controller.signal.aborted && controller.signal.reason === 'PAUSED_BY_USER';
      const wasCancelled = controller.signal.aborted && controller.signal.reason === 'CANCELLED_BY_USER';
      if (wasCancelled) return null;

      if (latest) {
        const failedTask: DownloadTask = {
          ...latest,
          status: wasPaused ? 'paused' : 'failed',
          error: wasPaused ? undefined : (err?.message || 'Download interrupted. Tap Resume to continue.'),
          updatedAt: new Date().toISOString()
        };
        await upsertTask(failedTask);
      }
      if (!wasPaused) {
        set({ downloadError: err?.message || 'Download interrupted or failed verification.' });
      }
      throw err;
    }
  },

  downloadOnlineTrackToLocal: async (track: any) => {
    set({ downloadError: null });

    // Prevent duplicate downloaded entry
    const existingList = await localDb.getAllSongs();
    const downloadId = track.id.startsWith('local_') ? track.id : `local_dl_${track.id}`;
    const alreadySaved = existingList.find(
      (s) =>
        s.id === downloadId ||
        ((s.source === 'DOWNLOADED' || s.originType === 'DOWNLOADED') &&
          s.title.toLowerCase() === String(track.title || '').toLowerCase() &&
          s.artist.toLowerCase() === String(track.artist || '').toLowerCase())
    );
    if (alreadySaved) {
      return alreadySaved;
    }

    // Case 1: Caller already provided a complete local Blob (never generate synthetic WAV placeholders)
    if (track.blob instanceof Blob) {
      const integrity = await validateAudioBlobIntegrity(track.blob);
      if (!integrity.valid) {
        const msg = integrity.reason || 'Audio file failed integrity check.';
        set({ downloadError: msg });
        throw new Error(msg);
      }
      const actualDurationMs = await measureAudioBlobDurationMs(track.blob);
      if (actualDurationMs > 0) {
        const durCheck = validateDownloadDuration(actualDurationMs, track.durationMs);
        if (!durCheck.valid) {
          const msg = durCheck.reason || 'Downloaded audio duration check failed.';
          set({ downloadError: msg });
          throw new Error(msg);
        }
      }
      const fileName = buildSafeAudioFilename(track.title, track.artist, track.blob.type || 'audio/mpeg');
      const fileFormat = extractFileFormat(fileName, track.blob.type || '');
      await persistBlobToSongsFolderAndDevice(track.blob, fileName, true);
      const localSong: Song = {
        id: downloadId,
        title: track.title,
        artist: track.artist,
        album: track.album || track.movieName || 'Downloaded Songs',
        durationMs: actualDurationMs > 0 ? actualDurationMs : track.durationMs,
        artworkUrl: track.artworkUrl,
        blob: track.blob,
        source: 'DOWNLOADED',
        originType: 'DOWNLOADED',
        fileFormat,
        folderName: 'Songs',
        externalUrl: track.sourceUrl || track.externalUrl,
        videoId: track.videoId,
        fileSize: track.blob.size,
        isLocal: true,
        storageLocation: 'LOCAL_DEVICE',
        localFileName: fileName,
        verifiedFullLength: true,
        createdAt: new Date().toISOString()
      };
      await localDb.saveSong(localSong);
      await get().loadLibrary();
      return localSong;
    }

    // Case 2: Verify full-song download availability (reject previews / stream-only sources)
    const availability = await checkTrackFullDownloadAvailability(track);
    if (!availability.downloadable || !availability.audioUrl) {
      const reason =
        availability.reason ||
        'This source only provides a preview or streaming playback; full-song download is not available.';
      set({ downloadError: reason });
      throw new Error(reason);
    }

    const mimeType = availability.mimeType || 'audio/mpeg';
    const fileFormat = availability.fileFormat || extractFileFormat(availability.audioUrl, mimeType);
    const fileName = buildSafeAudioFilename(track.title, track.artist, `${mimeType} ${fileFormat}`);

    // Reuse any existing partial task if one was interrupted earlier for this song
    const priorTask = await localDb.getDownloadTaskById(downloadId);
    const task: DownloadTask = priorTask && priorTask.downloadUrl === availability.audioUrl
      ? { ...priorTask, status: 'queued', error: undefined, updatedAt: new Date().toISOString() }
      : {
          id: downloadId,
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album || track.movieName || 'Downloaded Songs',
          artworkUrl: track.artworkUrl,
          sourcePlatform: track.sourcePlatform || track.source || 'OPEN_AUDIO',
          externalUrl: track.sourceUrl || track.externalUrl,
          downloadUrl: availability.audioUrl,
          mimeType,
          fileFormat,
          fileName,
          expectedDurationMs: availability.expectedDurationMs || track.durationMs || 0,
          expectedBytes: availability.contentLength,
          bytesReceived: 0,
          supportsRange: Boolean(availability.supportsRange),
          chunks: [],
          status: 'queued',
          updatedAt: new Date().toISOString()
        };

    await localDb.saveDownloadTask(task);
    set((s) => ({
      downloadTasks: s.downloadTasks.some((t) => t.id === task.id)
        ? s.downloadTasks.map((t) => (t.id === task.id ? task : t))
        : [...s.downloadTasks, task]
    }));

    const completedSong = await get().resumeDownload(task.id);
    if (!completedSong) {
      throw new Error('Download was cancelled before completion.');
    }
    return completedSong;
  },

  saveSongFileToDevice: async (song: Song) => {
    let blob = song.blob;
    if (!blob && song.fileHandle && typeof song.fileHandle.getFile === 'function') {
      try {
        blob = await song.fileHandle.getFile();
      } catch {
        // Ignore
      }
    }
    if (!blob) {
      // Attempt verified full-song download rather than generating a fake WAV placeholder
      await get().downloadOnlineTrackToLocal(song);
      return;
    }
    const fileName =
      song.localFileName || buildSafeAudioFilename(song.title, song.artist, blob.type || song.fileFormat || 'audio/mpeg');
    await persistBlobToSongsFolderAndDevice(blob, fileName, true);
  },

  toggleFavorite: async (songId: string) => {
    const isFav = await localDb.toggleFavorite(songId);
    const { favorites } = get();
    if (isFav) {
      set({ favorites: [...favorites, songId] });
    } else {
      set({ favorites: favorites.filter((id) => id !== songId) });
    }
    return isFav;
  },

  setSearchQuery: (query: string) => set({ searchQuery: query })
}));
