import { Schedule, Song } from '../types';
import { webAudioPlayer } from '../audio/WebAudioPlayer';
import { localDb } from '../db/indexedDb';

export interface ActiveRoutineEvent {
  schedule: Schedule;
  timestamp: string;
  status: 'ACTIVE' | 'COMPLETED';
}

type RoutineListener = (event: ActiveRoutineEvent) => void;

class WebSchedulerEngine {
  private timerId: number | null = null;
  private schedules: Schedule[] = [];
  private triggeredOccurrences: Set<string> = new Set();
  private listeners: Set<RoutineListener> = new Set();
  private currentActiveRoutine: Schedule | null = null;

  start() {
    if (this.timerId !== null) return;
    this.timerId = window.setInterval(() => this.checkSchedules(), 10000); // Check every 10 seconds
    setTimeout(() => this.checkSchedules(), 1500);
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  setSchedules(schedules: Schedule[]) {
    this.schedules = schedules;
  }

  subscribe(listener: RoutineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getCurrentActiveRoutine(): Schedule | null {
    return this.currentActiveRoutine;
  }

  private checkSchedules() {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    
    // JS: 0=Sun, 1=Mon, ..., 6=Sat
    // SyncWave: 1=Mon .. 7=Sun
    const currentDay = now.getDay() === 0 ? 7 : now.getDay();
    const dateKey = `${now.toISOString().split('T')[0]}_${currentTimeStr}`;

    const candidateSchedules = this.schedules.filter((sched) => {
      if (!sched.isEnabled) return false;
      if (sched.startTime !== currentTimeStr) return false;

      // Check days of week
      if (sched.daysOfWeek && sched.daysOfWeek.length > 0) {
        if (!sched.daysOfWeek.includes(currentDay)) return false;
      }

      // Check if already executed in this exact minute
      const triggerKey = `${sched.id}_${dateKey}`;
      if (this.triggeredOccurrences.has(triggerKey)) return false;

      return true;
    });

    if (candidateSchedules.length === 0) return;

    // Priority resolution: URGENT (4) > HIGH (3) > NORMAL (2) > LOW (1)
    const priorityWeights: Record<string, number> = {
      URGENT: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1
    };

    candidateSchedules.sort((a, b) => {
      const weightA = priorityWeights[a.priority] || 2;
      const weightB = priorityWeights[b.priority] || 2;
      return weightB - weightA;
    });

    const winningSchedule = candidateSchedules[0];
    const triggerKey = `${winningSchedule.id}_${dateKey}`;
    this.triggeredOccurrences.add(triggerKey);

    this.executeSchedule(winningSchedule);
  }

  async executeSchedule(schedule: Schedule) {
    this.currentActiveRoutine = schedule;

    // Notify UI listeners
    const event: ActiveRoutineEvent = {
      schedule,
      timestamp: new Date().toISOString(),
      status: 'ACTIVE'
    };
    this.listeners.forEach((l) => l(event));

    try {
      if (schedule.targetType === 'SONG') {
        const song = await localDb.getSongById(schedule.targetId);
        if (song) {
          await webAudioPlayer.play(song, schedule.transitionType === 'CROSSFADE');
        }
      } else if (schedule.targetType === 'PLAYLIST') {
        const playlists = await localDb.getAllPlaylists();
        const playlist = playlists.find((p) => p.id === schedule.targetId);
        if (playlist && playlist.songIds.length > 0) {
          const firstSongId = playlist.songIds[0];
          const firstSong = await localDb.getSongById(firstSongId);
          if (firstSong) {
            await webAudioPlayer.play(firstSong, schedule.transitionType === 'CROSSFADE');
          }
        }
      }

      // Record schedule execution history strictly to Supabase (no local history)
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
        await fetch(`/api/schedules/${schedule.id}/execution`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            scheduleName: schedule.name,
            targetName: schedule.targetName,
            success: true,
            statusMessage: 'Scheduled routine triggered smoothly in Web Player',
            clientPlatform: 'WEB'
          })
        });
      } catch (err) {
        // Backend optional when offline
      }
    } catch (e) {
      console.error('Failed to execute routine:', schedule.name, e);
    }
  }
}

export const webScheduler = new WebSchedulerEngine();

