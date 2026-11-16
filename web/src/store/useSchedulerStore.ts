import { create } from 'zustand';
import { Schedule, ScheduleHistoryRecord } from '../types';
import { webScheduler } from '../scheduler/WebScheduler';

interface SchedulerState {
  schedules: Schedule[];
  history: ScheduleHistoryRecord[];
  activeRoutine: Schedule | null;
  activeBannerMessage: string | null;
  isLoading: boolean;

  // Actions
  initScheduler: () => Promise<void>;
  fetchScheduleHistory: () => Promise<void>;
  createSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt'>) => Promise<Schedule>;
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<Schedule>;
  toggleSchedule: (id: string) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  dismissBanner: () => void;
}

const STORAGE_KEY = 'syncwave_web_schedules';

export const useSchedulerStore = create<SchedulerState>((set, get) => {
  // Listen for real-time routine execution events from WebScheduler
  webScheduler.subscribe((event) => {
    set({
      activeRoutine: event.schedule,
      activeBannerMessage: `Scheduled Routine Active: ${event.schedule.name} (${event.schedule.targetName})`
    });
  });

  return {
    schedules: [],
    history: [],
    activeRoutine: null,
    activeBannerMessage: null,
    isLoading: false,

    initScheduler: async () => {
      set({ isLoading: true });
      let loadedSchedules: Schedule[] = [];

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          loadedSchedules = JSON.parse(raw);
        }
      } catch (e) {
        console.error('Error loading schedules from localStorage:', e);
      }

      // If empty, supply default smart routines
      if (loadedSchedules.length === 0) {
        loadedSchedules = [
          {
            id: 'sched_morning',
            name: 'Morning Wakeup Routine',
            startTime: '07:30',
            repeatType: 'WEEKDAYS',
            daysOfWeek: [1, 2, 3, 4, 5],
            targetType: 'PLAYLIST',
            targetId: 'pl_favorites',
            targetName: 'My Chill Mix',
            priority: 'NORMAL',
            isEnabled: true,
            transitionType: 'CROSSFADE',
            transitionSec: 3,
            volume: 0.8,
            createdAt: new Date().toISOString()
          },
          {
            id: 'sched_focus',
            name: 'Deep Focus Coding Flow',
            startTime: '10:00',
            repeatType: 'WEEKDAYS',
            daysOfWeek: [1, 2, 3, 4, 5],
            targetType: 'PLAYLIST',
            targetId: 'pl_favorites',
            targetName: 'Concentration Beats',
            priority: 'HIGH',
            isEnabled: true,
            transitionType: 'CROSSFADE',
            transitionSec: 4,
            volume: 0.75,
            createdAt: new Date().toISOString()
          },
          {
            id: 'sched_night',
            name: 'Night Sleep Routine',
            startTime: '23:00',
            repeatType: 'DAILY',
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            targetType: 'PLAYLIST',
            targetId: 'pl_favorites',
            targetName: 'Ambient Deep Focus',
            priority: 'LOW',
            isEnabled: false,
            transitionType: 'FADE_OUT_IN',
            transitionSec: 5,
            volume: 0.5,
            createdAt: new Date().toISOString()
          }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedSchedules));
      }

      set({ schedules: loadedSchedules, isLoading: false });
      webScheduler.setSchedules(loadedSchedules);
      webScheduler.start();
      get().fetchScheduleHistory();
    },

    fetchScheduleHistory: async () => {
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('syncwave_token') : null;
        const res = await fetch('/api/schedules/history/all', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            set({ history: json.data });
          }
        }
      } catch {
        // Ignore offline errors
      }
    },

    createSchedule: async (data) => {
      const newSchedule: Schedule = {
        ...data,
        id: `sched_${Date.now()}`,
        createdAt: new Date().toISOString()
      };

      const updated = [...get().schedules, newSchedule];
      set({ schedules: updated });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      webScheduler.setSchedules(updated);
      return newSchedule;
    },

    updateSchedule: async (id: string, updates: Partial<Schedule>) => {
      const current = get().schedules;
      const index = current.findIndex((s) => s.id === id);
      if (index === -1) {
        throw new Error('Schedule not found');
      }
      const updatedSchedule: Schedule = {
        ...current[index],
        ...updates
      };
      const updatedList = [...current];
      updatedList[index] = updatedSchedule;

      set({ schedules: updatedList });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      webScheduler.setSchedules(updatedList);
      return updatedSchedule;
    },

    toggleSchedule: async (id: string) => {
      const updated = get().schedules.map((s) => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s));
      set({ schedules: updated });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      webScheduler.setSchedules(updated);
    },

    deleteSchedule: async (id: string) => {
      const updated = get().schedules.filter((s) => s.id !== id);
      set({ schedules: updated });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      webScheduler.setSchedules(updated);
    },

    dismissBanner: () => set({ activeBannerMessage: null })
  };
});

