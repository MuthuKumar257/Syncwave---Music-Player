import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MobileSchedule {
  id: string;
  name: string;
  startTime: string; // e.g. "07:00"
  repeatType: 'DAILY' | 'WEEKDAYS' | 'WEEKENDS' | 'CUSTOM';
  daysOfWeek: number[]; // e.g. [1, 2, 3, 4, 5]
  targetType: 'PLAYLIST' | 'SONG';
  targetId: string;
  targetName: string;
  priority: 'NORMAL' | 'HIGH' | 'LOW';
  isEnabled: boolean;
  transitionType?: 'CROSSFADE' | 'FADE_OUT_IN' | 'INSTANT';
  transitionSec?: number;
  volume?: number;
  createdAt: string;
}

interface SchedulerState {
  schedules: MobileSchedule[];
  currentUserId: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: (userId?: string | null) => Promise<void>;
  switchUser: (userId: string | null) => Promise<void>;
  resetForGuest: () => void;
  clearAllSchedules: (userId?: string | null) => Promise<void>;
  toggleSchedule: (id: string) => Promise<void>;
  saveSchedule: (schedule: MobileSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
}

const getStorageKey = (userId?: string | null) =>
  `@syncwave_mobile_schedules_${userId && userId.trim() ? userId.trim() : 'guest'}_v2`;

const DEFAULT_SCHEDULES: MobileSchedule[] = [
  {
    id: 'default_morning_energizer',
    name: 'Morning Energizer',
    startTime: '07:00',
    repeatType: 'WEEKDAYS',
    daysOfWeek: [1, 2, 3, 4, 5],
    targetType: 'PLAYLIST',
    targetId: 'default_driving_mix',
    targetName: 'Daily Upbeat Mix',
    priority: 'HIGH',
    isEnabled: true,
    transitionType: 'CROSSFADE',
    transitionSec: 3,
    volume: 0.8,
    createdAt: new Date().toISOString()
  },
  {
    id: 'default_sleep_relaxation',
    name: 'Sleep Relaxation Mix',
    startTime: '22:30',
    repeatType: 'DAILY',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    targetType: 'PLAYLIST',
    targetId: 'default_chill_vibes',
    targetName: 'Soothing Sleep Melodies',
    priority: 'NORMAL',
    isEnabled: true,
    transitionType: 'FADE_OUT_IN',
    transitionSec: 5,
    volume: 0.6,
    createdAt: new Date().toISOString()
  }
];

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  schedules: [],
  currentUserId: null,
  isLoading: false,
  isInitialized: false,

  initialize: async (userId?: string | null) => {
    const targetUserId = userId !== undefined ? userId : get().currentUserId;
    if (!targetUserId) {
      // Guest mode: completely empty in-memory schedules
      set({
        schedules: [],
        currentUserId: null,
        isInitialized: true
      });
      return;
    }

    const storageKey = getStorageKey(targetUserId);
    set({ isLoading: true });

    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          schedules: Array.isArray(parsed) ? parsed : [],
          currentUserId: targetUserId,
          isInitialized: true,
          isLoading: false
        });
      } else {
        // Fresh start: no schedules by default
        set({
          schedules: [],
          currentUserId: targetUserId,
          isInitialized: true,
          isLoading: false
        });
      }
    } catch {
      set({
        schedules: [],
        currentUserId: targetUserId,
        isInitialized: true,
        isLoading: false
      });
    }
  },

  switchUser: async (userId: string | null) => {
    set({ isInitialized: false, currentUserId: userId });
    await get().initialize(userId);
  },

  resetForGuest: () => {
    set({
      schedules: [],
      currentUserId: null,
      isInitialized: true,
      isLoading: false
    });
  },

  clearAllSchedules: async (userId?: string | null) => {
    const targetUserId = userId !== undefined ? userId : get().currentUserId;
    if (targetUserId) {
      try {
        await AsyncStorage.removeItem(getStorageKey(targetUserId));
      } catch {}
    }
    try {
      await AsyncStorage.removeItem(getStorageKey('guest'));
      await AsyncStorage.removeItem(getStorageKey(null));
    } catch {}

    set({
      schedules: [],
      currentUserId: null,
      isInitialized: true,
      isLoading: false
    });
  },

  toggleSchedule: async (id: string) => {
    const { schedules, currentUserId } = get();
    if (!currentUserId) return;

    const updated = schedules.map((item) =>
      item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
    );
    set({ schedules: updated });
    await AsyncStorage.setItem(getStorageKey(currentUserId), JSON.stringify(updated));
  },

  saveSchedule: async (schedule: MobileSchedule) => {
    const { schedules, currentUserId } = get();
    if (!currentUserId) return;

    const exists = schedules.some((s) => s.id === schedule.id);
    const updated = exists
      ? schedules.map((s) => (s.id === schedule.id ? schedule : s))
      : [schedule, ...schedules];

    set({ schedules: updated });
    await AsyncStorage.setItem(getStorageKey(currentUserId), JSON.stringify(updated));
  },

  deleteSchedule: async (id: string) => {
    const { schedules, currentUserId } = get();
    if (!currentUserId) return;

    const updated = schedules.filter((s) => s.id !== id);
    set({ schedules: updated });
    await AsyncStorage.setItem(getStorageKey(currentUserId), JSON.stringify(updated));
  }
}));
