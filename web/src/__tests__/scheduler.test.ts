import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webScheduler } from '../scheduler/WebScheduler';
import { Schedule } from '../types';
import {
  ALL_MINUTES,
  ALL_SLEEP_MINUTES,
  formatTo12Hour,
  from24Hour,
  to24Hour,
  formatCountdown
} from '../utils/timeSelection';
import { usePlayerStore } from '../store/usePlayerStore';

describe('WebScheduler Engine Unit Tests', () => {
  beforeEach(() => {
    webScheduler.stop();
  });

  it('correctly filters and manages schedules', () => {
    const testSchedules: Schedule[] = [
      {
        id: 'test_1',
        name: 'Morning Jam',
        startTime: '08:00',
        repeatType: 'DAILY',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        targetType: 'PLAYLIST',
        targetId: 'pl_1',
        targetName: 'Focus Mix',
        priority: 'NORMAL',
        isEnabled: true,
        transitionType: 'CROSSFADE',
        transitionSec: 3,
        volume: 0.8,
        createdAt: new Date().toISOString()
      },
      {
        id: 'test_2',
        name: 'Disabled Routine',
        startTime: '08:00',
        repeatType: 'DAILY',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        targetType: 'PLAYLIST',
        targetId: 'pl_2',
        targetName: 'Party Mix',
        priority: 'LOW',
        isEnabled: false,
        transitionType: 'CROSSFADE',
        transitionSec: 3,
        volume: 0.8,
        createdAt: new Date().toISOString()
      }
    ];

    webScheduler.setSchedules(testSchedules);
    expect(webScheduler.getCurrentActiveRoutine()).toBeNull();
  });

  it('subscribes to routine execution events', async () => {
    const listener = vi.fn();
    const unsubscribe = webScheduler.subscribe(listener);

    const schedule: Schedule = {
      id: 'test_urgent',
      name: 'Urgent Wakeup',
      startTime: '07:00',
      repeatType: 'DAILY',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      targetType: 'SONG',
      targetId: 'song_1',
      targetName: 'Alarm Tone',
      priority: 'URGENT',
      isEnabled: true,
      transitionType: 'IMMEDIATE',
      transitionSec: 0,
      volume: 1.0,
      createdAt: new Date().toISOString()
    };

    await webScheduler.executeSchedule(schedule);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule,
        status: 'ACTIVE'
      })
    );

    expect(webScheduler.getCurrentActiveRoutine()?.id).toBe('test_urgent');
    unsubscribe();
  });

  it('supports every single minute (00-59) at 1-minute intervals with zero rounding or snapping', () => {
    expect(ALL_MINUTES).toHaveLength(60);
    expect(ALL_MINUTES[0]).toBe('00');
    expect(ALL_MINUTES[1]).toBe('01');
    expect(ALL_MINUTES[2]).toBe('02');
    expect(ALL_MINUTES[3]).toBe('03');
    expect(ALL_MINUTES[4]).toBe('04');
    expect(ALL_MINUTES[59]).toBe('59');

    for (let m = 0; m < 60; m++) {
      const mStr = m.toString().padStart(2, '0');
      const time24 = to24Hour(10, mStr, 'AM');
      expect(time24).toBe(`10:${mStr}`);

      const parsed = from24Hour(time24);
      expect(parsed.hour12).toBe(10);
      expect(parsed.minute).toBe(mStr);
      expect(parsed.period).toBe('AM');
      expect(formatTo12Hour(time24)).toBe(`10:${mStr} AM`);
    }

    expect(to24Hour(12, '03', 'AM')).toBe('00:03');
    expect(to24Hour(11, '59', 'PM')).toBe('23:59');
    expect(formatTo12Hour('00:01')).toBe('12:01 AM');
    expect(formatTo12Hour('22:17')).toBe('10:17 PM');
  });

  it('supports 1-minute sleep timer increments without snapping to 5-minute steps', () => {
    expect(ALL_SLEEP_MINUTES[0]).toBe(1);
    expect(ALL_SLEEP_MINUTES[6]).toBe(7);
    expect(ALL_SLEEP_MINUTES).toHaveLength(180);

    usePlayerStore.getState().setSleepTimer(7);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBe(7);
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBe(420);
    expect(formatCountdown(420)).toBe('7:00');

    usePlayerStore.getState().setSleepTimer(1);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBe(1);
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBe(60);

    usePlayerStore.getState().clearSleepTimer();
    expect(usePlayerStore.getState().sleepTimerMinutes).toBeNull();
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBe(0);
  });
});

