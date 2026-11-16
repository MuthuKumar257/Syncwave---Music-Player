import React, { useState } from 'react';
import { Moon, Clock, X } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  ALL_HOURS_12,
  ALL_MINUTES,
  ALL_SLEEP_MINUTES,
  to24Hour,
  formatCountdown
} from '../../utils/timeSelection';

export { formatCountdown };

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const {
    sleepTimerMinutes,
    sleepTimerRemainingSec,
    setSleepTimer,
    setSleepTimerUntilTime,
    clearSleepTimer
  } = usePlayerStore();

  const [mode, setMode] = useState<'duration' | 'clock'>('duration');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(sleepTimerMinutes || 15);

  const now = new Date();
  const initial24Hour = now.getHours();
  const initialPeriod: 'AM' | 'PM' = initial24Hour >= 12 ? 'PM' : 'AM';
  const initialHour12 = initial24Hour % 12 === 0 ? 12 : initial24Hour % 12;
  const initialMinuteStr = ((now.getMinutes() + 1) % 60).toString().padStart(2, '0');

  const [clockHour12, setClockHour12] = useState<number>(initialHour12);
  const [clockMinute, setClockMinute] = useState<string>(initialMinuteStr);
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>(initialPeriod);

  if (!isOpen) return null;

  const isTimerActive = sleepTimerRemainingSec > 0;

  const handleApplyDuration = () => {
    setSleepTimer(selectedMinutes);
    onClose();
  };

  const handleApplyClockTime = () => {
    setSleepTimerUntilTime(to24Hour(clockHour12, clockMinute, clockPeriod));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface border border-hairline rounded-panel p-5 space-y-4 shadow-subtle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-text-primary">Sleep timer (1-minute precision)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-control text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isTimerActive && (
          <div className="flex items-center justify-between bg-surface-elevated border border-accent/30 rounded-control px-3 py-2 text-xs">
            <span className="text-text-secondary">
              Pauses in <span className="font-mono text-accent font-semibold">{formatCountdown(sleepTimerRemainingSec)}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearSleepTimer();
                onClose();
              }}
              className="px-2 py-1 rounded bg-surface border border-hairline text-red-400 hover:border-red-400/50 transition-colors"
            >
              Turn Off
            </button>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-surface-elevated p-1 rounded-control border border-hairline text-xs">
          <button
            type="button"
            onClick={() => setMode('duration')}
            className={`py-1.5 rounded-[6px] font-medium transition-colors ${
              mode === 'duration'
                ? 'bg-primary text-primary-dark'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Countdown (min)
          </button>
          <button
            type="button"
            onClick={() => setMode('clock')}
            className={`py-1.5 rounded-[6px] font-medium transition-colors ${
              mode === 'clock'
                ? 'bg-primary text-primary-dark'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Stop at Time
          </button>
        </div>

        {mode === 'duration' ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-text-secondary">
              <span>Select any duration (1–180 min)</span>
              <span className="font-mono text-accent font-medium">{selectedMinutes} min</span>
            </div>

            <div className="flex items-center gap-2 bg-surface-elevated p-2 rounded-control border border-hairline">
              <button
                type="button"
                aria-label="Decrease sleep timer by 1 minute"
                onClick={() => setSelectedMinutes((m) => Math.max(1, m - 1))}
                className="px-2.5 py-1.5 bg-surface border border-hairline rounded-[6px] font-mono text-text-secondary hover:text-text-primary"
              >
                -1m
              </button>
              <select
                aria-label="Sleep timer minutes"
                value={selectedMinutes}
                onChange={(e) => setSelectedMinutes(Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1)))}
                className="flex-1 bg-surface border border-hairline rounded-[6px] px-2 py-1.5 font-mono text-text-primary focus:outline-none"
              >
                {ALL_SLEEP_MINUTES.map((min) => (
                  <option key={min} value={min}>
                    {min} {min === 1 ? 'minute' : 'minutes'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Increase sleep timer by 1 minute"
                onClick={() => setSelectedMinutes((m) => Math.min(180, m + 1))}
                className="px-2.5 py-1.5 bg-surface border border-hairline rounded-[6px] font-mono text-text-secondary hover:text-text-primary"
              >
                +1m
              </button>
            </div>

            <button
              type="button"
              onClick={handleApplyDuration}
              className="w-full py-2 rounded-control bg-primary text-primary-dark hover:bg-white font-semibold transition-colors"
            >
              Start {selectedMinutes}-minute sleep timer
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-text-secondary">
              <span>Exact stop time (1-minute steps)</span>
              <span className="font-mono text-accent font-medium">
                {clockHour12.toString().padStart(2, '0')}:{clockMinute} {clockPeriod}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-surface-elevated p-2 rounded-control border border-hairline">
              <select
                aria-label="Stop hour"
                value={clockHour12}
                onChange={(e) => setClockHour12(parseInt(e.target.value, 10))}
                className="flex-1 bg-surface border border-hairline rounded-[6px] px-2 py-1.5 font-mono text-text-primary focus:outline-none"
              >
                {ALL_HOURS_12.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="font-mono font-bold text-text-muted">:</span>
              <select
                aria-label="Stop minute"
                value={clockMinute}
                onChange={(e) => setClockMinute(e.target.value)}
                className="flex-1 bg-surface border border-hairline rounded-[6px] px-2 py-1.5 font-mono text-text-primary focus:outline-none"
              >
                {ALL_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="flex items-center bg-surface border border-hairline rounded-[6px] p-0.5">
                <button
                  type="button"
                  onClick={() => setClockPeriod('AM')}
                  className={`px-2 py-1 rounded-[4px] font-mono ${
                    clockPeriod === 'AM' ? 'bg-primary text-primary-dark font-semibold' : 'text-text-muted'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setClockPeriod('PM')}
                  className={`px-2 py-1 rounded-[4px] font-mono ${
                    clockPeriod === 'PM' ? 'bg-primary text-primary-dark font-semibold' : 'text-text-muted'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyClockTime}
              className="w-full py-2 rounded-control bg-primary text-primary-dark hover:bg-white font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pause at {clockHour12.toString().padStart(2, '0')}:{clockMinute} {clockPeriod}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
