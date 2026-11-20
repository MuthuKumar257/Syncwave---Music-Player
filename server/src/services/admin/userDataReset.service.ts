import fs from 'fs';
import path from 'path';
import { syncStore } from '../../db/store';
import { SupabaseHistoryService } from '../history/supabaseHistory.service';

export interface DeletionCounts {
  users: number;
  playlists: number;
  favorites: number;
  schedules: number;
  scheduleHistory: number;
  playHistory: number;
  listeningEvents: number;
  userPreferences: number;
  userSettings: number;
  userSongStats: number;
  feedbacks: number;
  dailyMixes: number;
}

export interface UserDataResetReport {
  success: boolean;
  timestamp: string;
  backupFile: string | null;
  deletedCounts: DeletionCounts;
  totalRecordsDeleted: number;
  preserved: {
    sharedSongsCount: number;
    schemaPreserved: boolean;
  };
  supabaseCleared: boolean;
  message: string;
}

export class UserDataResetService {
  private static getStoreFilePath(): string {
    return path.resolve(__dirname, '../../../data/syncwave_store.json');
  }

  /**
   * Retrieves summary counts of all user data collections and preserved shared songs
   */
  static getDataSummary(): {
    userCounts: DeletionCounts;
    totalUserRecords: number;
    sharedSongsCount: number;
  } {
    const userCounts: DeletionCounts = {
      users: syncStore.users.size,
      playlists: syncStore.playlists.size,
      favorites: syncStore.favorites.size,
      schedules: syncStore.schedules.size,
      scheduleHistory: syncStore.scheduleHistory.length,
      playHistory: syncStore.playHistory.length,
      listeningEvents: syncStore.listeningEvents.length,
      userPreferences: syncStore.userPreferences.size,
      userSettings: syncStore.settings.size,
      userSongStats: syncStore.userSongStats.size,
      feedbacks: syncStore.feedbacks.length,
      dailyMixes: syncStore.dailyMixes.size
    };

    const totalUserRecords = Object.values(userCounts).reduce((a, b) => a + b, 0);

    return {
      userCounts,
      totalUserRecords,
      sharedSongsCount: syncStore.songs.size
    };
  }

  /**
   * Backs up current store data to a timestamped file before any deletion
   */
  static backupStore(): string | null {
    try {
      const diskFilePath = this.getStoreFilePath();
      const dir = path.dirname(diskFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.resolve(dir, `syncwave_store.backup-${timestamp}.json`);

      const currentData = {
        timestamp: new Date().toISOString(),
        users: Array.from(syncStore.users.entries()),
        songs: Array.from(syncStore.songs.entries()),
        playlists: Array.from(syncStore.playlists.entries()),
        schedules: Array.from(syncStore.schedules.entries()),
        scheduleHistory: syncStore.scheduleHistory,
        favorites: Array.from(syncStore.favorites.entries()).map(([k, v]) => [k, Array.from(v)]),
        playHistory: syncStore.playHistory,
        settings: Array.from(syncStore.settings.entries()),
        userPreferences: Array.from(syncStore.userPreferences.entries()),
        listeningEvents: syncStore.listeningEvents,
        feedbacks: syncStore.feedbacks,
        dailyMixes: Array.from(syncStore.dailyMixes.entries()),
        userSongStats: Array.from(syncStore.userSongStats.entries()).map(([k, v]) => [
          k,
          Array.from(v.entries())
        ])
      };

      fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2), 'utf-8');

      // Automatically prune older backups, retaining only the 2 most recent files
      try {
        const backups = fs.readdirSync(dir)
          .filter((f) => f.startsWith('syncwave_store.backup-') && f.endsWith('.json'))
          .sort();
        if (backups.length > 2) {
          const toDelete = backups.slice(0, backups.length - 2);
          for (const f of toDelete) {
            try { fs.unlinkSync(path.resolve(dir, f)); } catch {}
          }
        }
      } catch {}

      return backupPath;
    } catch (err) {
      console.warn('[UserDataResetService] Failed to create backup file:', err);
      return null;
    }
  }

  /**
   * Executes complete deletion of all user data while strictly preserving shared songs
   */
  static async resetAllUserData(): Promise<UserDataResetReport> {
    // 1. Create safety backup first
    const backupFile = this.backupStore();

    // 2. Measure counts prior to deletion
    const summary = this.getDataSummary();
    const deletedCounts = summary.userCounts;
    const totalRecordsDeleted = summary.totalUserRecords;

    // 3. Clear all user data from memory store
    syncStore.users.clear();
    syncStore.playlists.clear();
    syncStore.favorites.clear();
    syncStore.schedules.clear();
    syncStore.scheduleHistory = [];
    syncStore.playHistory = [];
    syncStore.settings.clear();
    syncStore.userPreferences.clear();
    syncStore.listeningEvents = [];
    syncStore.feedbacks = [];
    syncStore.dailyMixes.clear();
    syncStore.userSongStats.clear();

    // 4. Ensure shared catalogue songs are preserved (re-seed default library if missing)
    if (syncStore.songs.size === 0) {
      syncStore.seedInitialMusic();
    }
    const sharedSongsCount = syncStore.songs.size;

    // 5. Clear Supabase user records if configured
    let supabaseCleared = false;
    if (SupabaseHistoryService.isConfigured()) {
      try {
        const creds = (SupabaseHistoryService as any).getCredentials?.();
        if (creds) {
          const headers = {
            apikey: creds.key,
            Authorization: `Bearer ${creds.key}`,
            'Content-Type': 'application/json'
          };
          // Delete all records from history and favorites tables
          await Promise.allSettled([
            fetch(`${creds.url}/rest/v1/play_history?id=gt.0`, { method: 'DELETE', headers }),
            fetch(`${creds.url}/rest/v1/listening_events?id=gt.0`, { method: 'DELETE', headers }),
            fetch(`${creds.url}/rest/v1/schedule_history?id=gt.0`, { method: 'DELETE', headers }),
            fetch(`${creds.url}/rest/v1/favorites?id=gt.0`, { method: 'DELETE', headers })
          ]);
          supabaseCleared = true;
        }
      } catch (err) {
        console.warn('[UserDataResetService] Supabase cleanup notice:', err);
      }
    }

    // 6. Persist clean state to disk immediately
    try {
      const diskFilePath = this.getStoreFilePath();
      const cleanData = {
        users: [],
        songs: Array.from(syncStore.songs.entries()),
        playlists: [],
        schedules: [],
        scheduleHistory: [],
        favorites: [],
        playHistory: [],
        settings: [],
        userPreferences: [],
        listeningEvents: [],
        userSongStats: [],
        historyIdCounter: 1,
        eventIdCounter: 1
      };
      fs.writeFileSync(diskFilePath, JSON.stringify(cleanData, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[UserDataResetService] Failed to write clean state to syncwave_store.json:', err);
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      backupFile,
      deletedCounts,
      totalRecordsDeleted,
      preserved: {
        sharedSongsCount,
        schemaPreserved: true
      },
      supabaseCleared,
      message: 'All user data, accounts, library records, history, and preferences have been successfully deleted. Shared song catalogue and schemas were preserved.'
    };
  }
}
