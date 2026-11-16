import fs from 'fs';
import path from 'path';
import {
  syncStore,
  PlayHistoryRecord,
  ListeningEventRecord,
  ScheduleHistoryRecord
} from '../../db/store';

export interface SupabaseHistoryStatus {
  storagePolicy: 'HISTORY_SUPABASE_ONLY';
  downloadsStorage: 'LOCAL_DEVICE_ONLY';
  configured: boolean;
  projectHost: string | null;
  tables: ['play_history', 'listening_events', 'schedule_history'];
}

interface SupabaseRuntimeConfig {
  url: string;
  key: string;
}

const isTestEnv = () =>
  process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

export class SupabaseHistoryService {
  private static runtimeConfig: SupabaseRuntimeConfig | null = null;
  private static warnedMissingTables = new Set<string>();

  private static logSupabaseFallback(table: string, action: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('PGRST205')) {
      if (!this.warnedMissingTables.has(table)) {
        this.warnedMissingTables.add(table);
        console.warn(
          `[SupabaseHistoryService] Table 'public.${table}' not found in Supabase schema cache. Run server/src/db/supabase_history_only.sql in your Supabase SQL Editor.`
        );
      }
      return;
    }
    console.warn(`[SupabaseHistoryService] Failed to ${action} ${table}: ${message}`);
  }

  private static getCredentials(): SupabaseRuntimeConfig | null {
    const rawUrl =
      this.runtimeConfig?.url ||
      process.env.SUPABASE_URL ||
      '';
    const rawKey =
      this.runtimeConfig?.key ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    const url = rawUrl.trim().replace(/\/+$/, '');
    const key = rawKey.trim();

    if (!url || !key) return null;

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return null;
      return { url, key };
    } catch {
      return null;
    }
  }

  static isConfigured(): boolean {
    return this.getCredentials() !== null;
  }

  static getStatus(): SupabaseHistoryStatus {
    const creds = this.getCredentials();
    let projectHost: string | null = null;
    if (creds) {
      try {
        projectHost = new URL(creds.url).host;
      } catch {
        projectHost = null;
      }
    }

    return {
      storagePolicy: 'HISTORY_SUPABASE_ONLY',
      downloadsStorage: 'LOCAL_DEVICE_ONLY',
      configured: creds !== null,
      projectHost,
      tables: ['play_history', 'listening_events', 'schedule_history']
    };
  }

  static async configureAndVerify(
    supabaseUrl: string,
    supabaseKey: string
  ): Promise<{ ok: boolean; error?: string; status: SupabaseHistoryStatus }> {
    const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
    const cleanKey = supabaseKey.trim();

    if (!cleanUrl || !cleanKey) {
      return {
        ok: false,
        error: 'Both Supabase Project URL and API Key are required.',
        status: this.getStatus()
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'https:') {
        return {
          ok: false,
          error: 'Supabase URL must use HTTPS (e.g. https://xyz.supabase.co).',
          status: this.getStatus()
        };
      }
    } catch {
      return {
        ok: false,
        error: 'Invalid Supabase Project URL format.',
        status: this.getStatus()
      };
    }

    try {
      const probe = await fetch(
        `${cleanUrl}/rest/v1/play_history?select=id&limit=1`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(6000),
          headers: {
            apikey: cleanKey,
            Authorization: `Bearer ${cleanKey}`
          }
        }
      );

      if (!probe.ok) {
        const errBody = await probe.text().catch(() => '');
        return {
          ok: false,
          error: `Supabase returned HTTP ${probe.status}. Ensure play_history table exists (run supabase_history_only.sql). ${errBody.slice(0, 140)}`,
          status: this.getStatus()
        };
      }

      const safeUrl = cleanUrl.replace(/[\r\n]/g, '');
      const safeKey = cleanKey.replace(/[\r\n]/g, '');
      this.runtimeConfig = { url: safeUrl, key: safeKey };

      // Persist validated credentials into server/.env so history config survives restarts
      if (!isTestEnv()) {
        try {
          const envPath = path.resolve(process.cwd(), '.env');
          let lines: string[] = [];
          if (fs.existsSync(envPath)) {
            lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
          }
          const upsert = (k: string, v: string) => {
            const idx = lines.findIndex((l) => l.startsWith(`${k}=`));
            if (idx >= 0) lines[idx] = `${k}=${v}`;
            else lines.push(`${k}=${v}`);
          };
          upsert('SUPABASE_URL', safeUrl);
          upsert('SUPABASE_SERVICE_ROLE_KEY', safeKey);
          fs.writeFileSync(envPath, lines.filter(Boolean).join('\n') + '\n', 'utf8');
        } catch (fsErr) {
          console.warn('[SupabaseHistoryService] Could not persist .env file:', fsErr);
        }
      }

      return {
        ok: true,
        status: this.getStatus()
      };
    } catch (err: any) {
      return {
        ok: false,
        error: `Failed to reach Supabase: ${err?.message || 'Network error'}`,
        status: this.getStatus()
      };
    }
  }

  private static async supabaseRequest<T>(
    table: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE';
      query?: string;
      body?: unknown;
      prefer?: string;
    } = {}
  ): Promise<T | null> {
    const creds = this.getCredentials();
    if (!creds) return null;

    const querySuffix = options.query ? `?${options.query}` : '';
    const url = `${creds.url}/rest/v1/${table}${querySuffix}`;

    const headers: Record<string, string> = {
      apikey: creds.key,
      Authorization: `Bearer ${creds.key}`,
      'Content-Type': 'application/json'
    };

    if (options.prefer) {
      headers['Prefer'] = options.prefer;
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      signal: AbortSignal.timeout(6000),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Supabase ${table} error (${res.status}): ${txt}`);
    }

    this.warnedMissingTables.delete(table);

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  // --- PLAY HISTORY (Supabase with resilient Local Fallback) ---
  static async recordPlayHistory(
    record: Omit<PlayHistoryRecord, 'id' | 'playedAt'> & { playedAt?: string }
  ): Promise<{ record: PlayHistoryRecord; storedInSupabase: boolean }> {
    const now = record.playedAt || new Date().toISOString();
    let localRecord = syncStore.recordPlayHistory(record);

    if (this.isConfigured()) {
      try {
        const rows = await this.supabaseRequest<any[]>('play_history', {
          method: 'POST',
          prefer: 'return=representation',
          body: {
            user_id: record.userId,
            song_id: record.songId,
            song_title: record.songTitle,
            artist_name: record.artistName,
            duration_listened_ms: record.durationListenedMs,
            completed: record.completed,
            client_platform: record.clientPlatform,
            played_at: now
          }
        });

        const row = rows?.[0];
        return {
          storedInSupabase: true,
          record: {
            id: row?.id || localRecord.id,
            userId: row?.user_id || record.userId,
            songId: row?.song_id || record.songId,
            songTitle: row?.song_title || record.songTitle,
            artistName: row?.artist_name || record.artistName,
            playedAt: row?.played_at || now,
            durationListenedMs: Number(row?.duration_listened_ms ?? record.durationListenedMs),
            completed: Boolean(row?.completed ?? record.completed),
            clientPlatform: row?.client_platform || record.clientPlatform
          }
        };
      } catch (err) {
        this.logSupabaseFallback('play_history', 'insert into', err);
      }
    }

    return {
      storedInSupabase: false,
      record: localRecord
    };
  }

  static async getUserPlayHistory(
    userId: string,
    limit = 50
  ): Promise<{ history: PlayHistoryRecord[]; source: 'SUPABASE' | 'UNCONFIGURED' | 'TEST_MEMORY' | 'LOCAL_STORE' }> {
    if (this.isConfigured()) {
      try {
        const rows =
          (await this.supabaseRequest<any[]>('play_history', {
            method: 'GET',
            query: `user_id=eq.${encodeURIComponent(userId)}&order=played_at.desc&limit=${limit}`
          })) || [];

        if (rows.length > 0) {
          const history: PlayHistoryRecord[] = rows.map((row) => ({
            id: Number(row.id),
            userId: row.user_id,
            songId: row.song_id,
            songTitle: row.song_title,
            artistName: row.artist_name,
            playedAt: row.played_at,
            durationListenedMs: Number(row.duration_listened_ms || 0),
            completed: Boolean(row.completed),
            clientPlatform: row.client_platform === 'ANDROID' ? 'ANDROID' : 'WEB'
          }));

          return { history, source: 'SUPABASE' };
        }
      } catch (err) {
        this.logSupabaseFallback('play_history', 'query', err);
      }
    }

    const localHistory = syncStore.getUserPlayHistory(userId, limit);
    if (isTestEnv()) {
      return { history: localHistory, source: 'TEST_MEMORY' };
    }

    return {
      history: localHistory,
      source: localHistory.length > 0 ? 'LOCAL_STORE' : 'UNCONFIGURED'
    };
  }

  static async clearUserHistory(userId: string): Promise<void> {
    if (this.isConfigured()) {
      const encodedUser = encodeURIComponent(userId);
      await Promise.all([
        this.supabaseRequest('play_history', {
          method: 'DELETE',
          query: `user_id=eq.${encodedUser}`
        }).catch((err) => this.logSupabaseFallback('play_history', 'clear', err)),
        this.supabaseRequest('listening_events', {
          method: 'DELETE',
          query: `user_id=eq.${encodedUser}`
        }).catch((err) => this.logSupabaseFallback('listening_events', 'clear', err)),
        this.supabaseRequest('schedule_history', {
          method: 'DELETE',
          query: `user_id=eq.${encodedUser}`
        }).catch((err) => this.logSupabaseFallback('schedule_history', 'clear', err))
      ]);
      return;
    }

    if (isTestEnv()) {
      syncStore.clearUserPlayHistory(userId);
    }
  }

  // --- LISTENING EVENTS (Supabase with resilient Local Fallback) ---
  static async recordListeningEvent(
    event: Omit<ListeningEventRecord, 'id' | 'timestamp'>
  ): Promise<{ event: ListeningEventRecord; storedInSupabase: boolean }> {
    const now = new Date().toISOString();
    let localEvent = syncStore.recordListeningEvent(event);

    if (this.isConfigured()) {
      try {
        const rows = await this.supabaseRequest<any[]>('listening_events', {
          method: 'POST',
          prefer: 'return=representation',
          body: {
            user_id: event.userId,
            song_id: event.songId,
            song_title: event.songTitle,
            artist_name: event.artistName,
            language: event.language || null,
            genre: event.genre || null,
            event_type: event.eventType,
            duration_played_sec: event.durationPlayedSec,
            total_duration_sec: event.totalDurationSec,
            client_platform: event.clientPlatform,
            timestamp: now
          }
        });

        const row = rows?.[0];
        return {
          storedInSupabase: true,
          event: {
            id: Number(row?.id || localEvent.id),
            userId: row?.user_id || event.userId,
            songId: row?.song_id || event.songId,
            songTitle: row?.song_title || event.songTitle,
            artistName: row?.artist_name || event.artistName,
            language: row?.language ?? event.language,
            genre: row?.genre ?? event.genre,
            eventType: row?.event_type || event.eventType,
            durationPlayedSec: Number(row?.duration_played_sec ?? event.durationPlayedSec),
            totalDurationSec: Number(row?.total_duration_sec ?? event.totalDurationSec),
            clientPlatform: row?.client_platform || event.clientPlatform,
            timestamp: row?.timestamp || now
          }
        };
      } catch (err) {
        this.logSupabaseFallback('listening_events', 'insert into', err);
      }
    }

    return {
      storedInSupabase: false,
      event: localEvent
    };
  }

  static async getUserListeningEvents(
    userId: string,
    limit = 100
  ): Promise<ListeningEventRecord[]> {
    if (this.isConfigured()) {
      try {
        const rows =
          (await this.supabaseRequest<any[]>('listening_events', {
            method: 'GET',
            query: `user_id=eq.${encodeURIComponent(userId)}&order=timestamp.desc&limit=${limit}`
          })) || [];

        if (rows.length > 0) {
          return rows.map((row) => ({
            id: Number(row.id),
            userId: row.user_id,
            songId: row.song_id,
            songTitle: row.song_title,
            artistName: row.artist_name,
            language: row.language || undefined,
            genre: row.genre || undefined,
            eventType: row.event_type,
            durationPlayedSec: Number(row.duration_played_sec || 0),
            totalDurationSec: Number(row.total_duration_sec || 0),
            clientPlatform: row.client_platform === 'ANDROID' ? 'ANDROID' : 'WEB',
            timestamp: row.timestamp
          }));
        }
      } catch (err) {
        this.logSupabaseFallback('listening_events', 'query', err);
      }
    }

    return syncStore.getUserListeningEvents(userId, limit);
  }

  // --- SCHEDULE EXECUTION HISTORY (Supabase ONLY) ---
  static async recordScheduleHistory(
    record: Omit<ScheduleHistoryRecord, 'id' | 'executedAt'>
  ): Promise<{ record: ScheduleHistoryRecord; storedInSupabase: boolean }> {
    const now = new Date().toISOString();
    let localRecord = syncStore.recordScheduleHistory(record);

    if (this.isConfigured()) {
      try {
        const rows = await this.supabaseRequest<any[]>('schedule_history', {
          method: 'POST',
          prefer: 'return=representation',
          body: {
            user_id: record.userId,
            schedule_id: record.scheduleId || null,
            schedule_name: record.scheduleName,
            target_name: record.targetName,
            success: record.success,
            status_message: record.statusMessage,
            client_platform: record.clientPlatform,
            executed_at: now
          }
        });

        const row = rows?.[0];
        return {
          storedInSupabase: true,
          record: {
            id: Number(row?.id || localRecord.id),
            userId: row?.user_id || record.userId,
            scheduleId: row?.schedule_id ?? record.scheduleId,
            scheduleName: row?.schedule_name || record.scheduleName,
            targetName: row?.target_name || record.targetName,
            executedAt: row?.executed_at || now,
            success: Boolean(row?.success ?? record.success),
            statusMessage: row?.status_message || record.statusMessage,
            clientPlatform: row?.client_platform === 'ANDROID' ? 'ANDROID' : 'WEB'
          }
        };
      } catch (err) {
        this.logSupabaseFallback('schedule_history', 'insert into', err);
      }
    }

    return {
      storedInSupabase: false,
      record: localRecord
    };
  }

  static async getUserScheduleHistory(userId: string): Promise<ScheduleHistoryRecord[]> {
    if (this.isConfigured()) {
      try {
        const rows =
          (await this.supabaseRequest<any[]>('schedule_history', {
            method: 'GET',
            query: `user_id=eq.${encodeURIComponent(userId)}&order=executed_at.desc&limit=50`
          })) || [];

        if (rows.length > 0) {
          return rows.map((row) => ({
            id: Number(row.id),
            userId: row.user_id,
            scheduleId: row.schedule_id || undefined,
            scheduleName: row.schedule_name,
            targetName: row.target_name,
            executedAt: row.executed_at,
            success: Boolean(row.success),
            statusMessage: row.status_message || '',
            clientPlatform: row.client_platform === 'ANDROID' ? 'ANDROID' : 'WEB'
          }));
        }
      } catch (err) {
        this.logSupabaseFallback('schedule_history', 'query', err);
      }
    }

    return syncStore.getUserScheduleHistory(userId);
  }
}
