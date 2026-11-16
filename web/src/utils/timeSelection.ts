export const ALL_HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const ALL_MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
export const ALL_SLEEP_MINUTES = Array.from({ length: 180 }, (_, i) => i + 1);

/**
 * Converts 24-hour time string ("HH:mm") to 12-hour format ("hh:mm A") preserving every minute (00-59).
 */
export function formatTo12Hour(time24: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hour = parseInt(parts[0], 10);
  const parsedMin = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(parsedMin)) return time24;
  const minute = Math.min(59, Math.max(0, parsedMin)).toString().padStart(2, '0');
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
  return `${hourStr}:${minute} ${period}`;
}

/**
 * Converts 12-hour components to canonical 24-hour time string ("HH:mm") at 1-minute precision.
 */
export function to24Hour(hour12: number, minute: string, period: 'AM' | 'PM'): string {
  const clampedHour12 = Math.min(12, Math.max(1, Math.trunc(hour12 || 12)));
  let h = clampedHour12 % 12;
  if (period === 'PM') h += 12;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  const parsedMin = parseInt(minute || '0', 10);
  const clampedMin = isNaN(parsedMin) ? 0 : Math.min(59, Math.max(0, parsedMin));
  const mStr = clampedMin.toString().padStart(2, '0');
  return `${hStr}:${mStr}`;
}

/**
 * Parses canonical 24-hour time ("HH:mm") into 12-hour components at 1-minute precision.
 */
export function from24Hour(time24: string): { hour12: number; minute: string; period: 'AM' | 'PM' } {
  const parts = (time24 || '08:00').split(':');
  let h = parseInt(parts[0] || '8', 10);
  const parsedMin = parseInt(parts[1] || '0', 10);
  if (isNaN(h)) h = 8;
  h = Math.min(23, Math.max(0, h));
  const clampedMin = isNaN(parsedMin) ? 0 : Math.min(59, Math.max(0, parsedMin));
  const minute = clampedMin.toString().padStart(2, '0');
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, period };
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
