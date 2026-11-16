import { Song, Playlist, MusicFolderEntry, DownloadTask } from '../types';

const DB_NAME = 'SyncWaveWebDB';
const DB_VERSION = 3;

class IndexedDbService {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined') {
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Song metadata and audio blobs / file handles store
        if (!db.objectStoreNames.contains('songs')) {
          const songStore = db.createObjectStore('songs', { keyPath: 'id' });
          songStore.createIndex('title', 'title', { unique: false });
          songStore.createIndex('artist', 'artist', { unique: false });
        }

        // Local playlists store
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }

        // Local favorites store
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'id' });
        }

        // Persisted local music folders & FileSystemDirectoryHandles
        if (!db.objectStoreNames.contains('musicFolders')) {
          db.createObjectStore('musicFolders', { keyPath: 'id' });
        }

        // Lightweight app preferences / metadata store
        if (!db.objectStoreNames.contains('appMeta')) {
          db.createObjectStore('appMeta', { keyPath: 'key' });
        }

        // Resumable incomplete downloads (never shown as playable songs)
        if (!db.objectStoreNames.contains('downloadTasks')) {
          db.createObjectStore('downloadTasks', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject(request.error);
      };
    });
  }

  // --- SONGS ---
  async saveSong(song: Song): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const req = store.put(song);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllSongs(): Promise<Song[]> {
    const db = await this.init();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getSongById(id: string): Promise<Song | undefined> {
    const db = await this.init();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSong(id: string): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- PLAYLISTS ---
  async savePlaylist(playlist: Playlist): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const req = store.put(playlist);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.init();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- FAVORITES ---
  async getFavorites(): Promise<string[]> {
    const db = await this.init();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readonly');
      const store = tx.objectStore('favorites');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map((item) => item.id));
      req.onerror = () => reject(req.error);
    });
  }

  async toggleFavorite(id: string): Promise<boolean> {
    const db = await this.init();
    if (!db) return false;
    const favs = await this.getFavorites();
    const isFav = favs.includes(id);

    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      if (isFav) {
        const req = store.delete(id);
        req.onsuccess = () => resolve(false);
        req.onerror = () => reject(req.error);
      } else {
        const req = store.put({ id, addedAt: new Date().toISOString() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      }
    });
  }

  async removeFavorite(id: string): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- MUSIC FOLDERS ---
  async saveMusicFolder(folder: MusicFolderEntry): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('musicFolders', 'readwrite');
      const store = tx.objectStore('musicFolders');
      const req = store.put(folder);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllMusicFolders(): Promise<MusicFolderEntry[]> {
    const db = await this.init();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('musicFolders', 'readonly');
      const store = tx.objectStore('musicFolders');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteMusicFolder(id: string): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('musicFolders', 'readwrite');
      const store = tx.objectStore('musicFolders');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- APP META ---
  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appMeta', 'readwrite');
      const store = tx.objectStore('appMeta');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    const db = await this.init();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appMeta', 'readonly');
      const store = tx.objectStore('appMeta');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  // --- DOWNLOAD TASKS (INCOMPLETE / RESUMABLE) ---
  async saveDownloadTask(task: DownloadTask): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('downloadTasks', 'readwrite');
      const store = tx.objectStore('downloadTasks');
      const req = store.put(task);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllDownloadTasks(): Promise<DownloadTask[]> {
    const db = await this.init();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('downloadTasks', 'readonly');
      const store = tx.objectStore('downloadTasks');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getDownloadTaskById(id: string): Promise<DownloadTask | undefined> {
    const db = await this.init();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('downloadTasks', 'readonly');
      const store = tx.objectStore('downloadTasks');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteDownloadTask(id: string): Promise<void> {
    const db = await this.init();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('downloadTasks', 'readwrite');
      const store = tx.objectStore('downloadTasks');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const localDb = new IndexedDbService();
export const indexedDb = localDb;
