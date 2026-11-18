import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Play,
  Trash2,
  Sliders,
  Zap,
  Radio,
  Pencil,
  PlusCircle,
  Check,
  Music2,
  X
} from 'lucide-react';
import { useSchedulerStore } from '../store/useSchedulerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { webScheduler } from '../scheduler/WebScheduler';
import { Schedule, SchedulePriority, TransitionType, RepeatType, TargetType } from '../types';
import {
  ALL_HOURS_12,
  ALL_MINUTES,
  formatTo12Hour,
  to24Hour,
  from24Hour
} from '../utils/timeSelection';

export { ALL_HOURS_12, ALL_MINUTES, formatTo12Hour, to24Hour, from24Hour };

export const SchedulerView: React.FC = () => {
  const { schedules, createSchedule, updateSchedule, toggleSchedule, deleteSchedule, activeRoutine } =
    useSchedulerStore();
  const { playlists, songs, createPlaylist } = useLibraryStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [hour12, setHour12] = useState<number>(8);
  const [minute, setMinute] = useState<string>('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [targetType, setTargetType] = useState<TargetType>('PLAYLIST');
  const [targetId, setTargetId] = useState(playlists[0]?.id || '');
  const [priority, setPriority] = useState<SchedulePriority>('NORMAL');
  const [transitionSec, setTransitionSec] = useState(3);
  const [volume, setVolume] = useState(0.85);

  // Inline "Add Playlist" state inside modal
  const [isAddingPlaylist, setIsAddingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistCreatedSuccess, setPlaylistCreatedSuccess] = useState(false);

  const dayNames = [
    { num: 1, label: 'M' },
    { num: 2, label: 'T' },
    { num: 3, label: 'W' },
    { num: 4, label: 'T' },
    { num: 5, label: 'F' },
    { num: 6, label: 'S' },
    { num: 7, label: 'S' }
  ];

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const handleOpenCreate = () => {
    setEditingScheduleId(null);
    setName('');
    const parsed = from24Hour('08:00');
    setHour12(parsed.hour12);
    setMinute(parsed.minute);
    setPeriod(parsed.period);
    setSelectedDays([1, 2, 3, 4, 5]);
    setTargetType('PLAYLIST');
    setTargetId(playlists[0]?.id || '');
    setPriority('NORMAL');
    setTransitionSec(3);
    setVolume(0.85);
    setIsAddingPlaylist(false);
    setNewPlaylistName('');
    setPlaylistCreatedSuccess(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (schedule: Schedule) => {
    setEditingScheduleId(schedule.id);
    setName(schedule.name);
    const parsed = from24Hour(schedule.startTime);
    setHour12(parsed.hour12);
    setMinute(parsed.minute);
    setPeriod(parsed.period);
    setSelectedDays(schedule.daysOfWeek);
    setTargetType(schedule.targetType);
    setTargetId(schedule.targetId);
    setPriority(schedule.priority);
    setTransitionSec(schedule.transitionSec);
    setVolume(schedule.volume);
    setIsAddingPlaylist(false);
    setNewPlaylistName('');
    setPlaylistCreatedSuccess(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let targetName = 'Music';
    if (targetType === 'PLAYLIST') {
      const pl = playlists.find((p) => p.id === targetId);
      targetName = pl?.name || 'Playlist';
    } else {
      const s = songs.find((song) => song.id === targetId);
      targetName = s?.title || 'Song';
    }

    const calculatedStartTime = to24Hour(hour12, minute, period);

    if (editingScheduleId) {
      await updateSchedule(editingScheduleId, {
        name: name.trim(),
        startTime: calculatedStartTime,
        repeatType: selectedDays.length === 7 ? 'DAILY' : 'CUSTOM_DAYS',
        daysOfWeek: selectedDays,
        targetType,
        targetId: targetId || (playlists[0]?.id ?? 'default'),
        targetName,
        priority,
        transitionType: 'CROSSFADE',
        transitionSec,
        volume
      });
    } else {
      await createSchedule({
        name: name.trim(),
        startTime: calculatedStartTime,
        repeatType: selectedDays.length === 7 ? 'DAILY' : 'CUSTOM_DAYS',
        daysOfWeek: selectedDays,
        targetType,
        targetId: targetId || (playlists[0]?.id ?? 'default'),
        targetName,
        priority,
        isEnabled: true,
        transitionType: 'CROSSFADE',
        transitionSec,
        volume
      });
    }

    setName('');
    setEditingScheduleId(null);
    setIsModalOpen(false);
  };

  // Inline playlist creation handler
  const handleCreateNewPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const pl = await createPlaylist(newPlaylistName.trim(), 'Created from Scheduler');
      setTargetType('PLAYLIST');
      setTargetId(pl.id);
      setIsAddingPlaylist(false);
      setNewPlaylistName('');
      setPlaylistCreatedSuccess(true);
      setTimeout(() => setPlaylistCreatedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to create playlist from scheduler:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-8 space-y-5 md:space-y-6 select-none pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium text-text-primary tracking-tight">
            Scheduler
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Automated routines, 12-hour time transitions and playlist targets
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-3.5 py-2 rounded-control bg-primary hover:bg-white text-primary-dark text-xs font-semibold shadow-subtle transition-colors duration-150 self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New routine</span>
        </button>
      </div>

      {/* Routine Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedules.map((schedule) => {
          const isActive = activeRoutine?.id === schedule.id;

          return (
            <div
              key={schedule.id}
              className={`p-4 rounded-card bg-surface border transition-colors relative overflow-hidden flex flex-col justify-between gap-3 shadow-subtle ${
                isActive
                  ? 'border-hairlineLight bg-surface-elevated'
                  : 'border-hairline hover:bg-surface-elevated'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {/* 12-Hour Formatted Time Display */}
                    <span className="text-xl font-mono font-medium text-text-primary tracking-tight tabular-nums">
                      {formatTo12Hour(schedule.startTime)}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-surface-elevated text-text-muted border border-hairline">
                      {schedule.priority.toLowerCase()}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-accent bg-accent-muted border border-accent/20 px-1.5 py-0.5 rounded-[4px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                        <span>active</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-text-primary truncate">{schedule.name}</h3>
                  <p className="text-xs text-text-muted flex items-center gap-1.5 truncate">
                    <span>Target: {schedule.targetName}</span>
                    <span>&bull;</span>
                    <span className="font-mono tabular-nums">{schedule.transitionSec}s crossfade</span>
                  </p>
                </div>

                {/* Enable Toggle Switch */}
                <button
                  onClick={() => toggleSchedule(schedule.id)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                    schedule.isEnabled ? 'bg-accent' : 'bg-surface-elevated border border-hairline'
                  }`}
                  title={schedule.isEnabled ? 'Disable routine' : 'Enable routine'}
                  aria-label={schedule.isEnabled ? 'Disable routine' : 'Enable routine'}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform ${
                      schedule.isEnabled
                        ? 'translate-x-4 bg-black shadow-subtle'
                        : 'translate-x-0 bg-text-muted'
                    }`}
                  />
                </button>
              </div>

              {/* Day Pills & Bottom Controls */}
              <div className="flex items-center justify-between pt-2.5 border-t border-hairline">
                {/* Days of Week */}
                <div className="flex items-center gap-1">
                  {dayNames.map((d) => {
                    const isSelected = schedule.daysOfWeek.includes(d.num);
                    return (
                      <span
                        key={d.num}
                        className={`w-5 h-5 rounded-[4px] flex items-center justify-center text-[10px] font-mono tabular-nums ${
                          isSelected
                            ? 'bg-surface-elevated text-text-primary border border-hairlineLight'
                            : 'text-text-muted/50'
                        }`}
                      >
                        {d.label}
                      </span>
                    );
                  })}
                </div>

                {/* Actions: Edit, Test Run, Delete */}
                <div className="flex items-center gap-1">
                  {/* EDIT OPTION */}
                  <button
                    onClick={() => handleOpenEdit(schedule)}
                    className="p-1.5 rounded-control hover:bg-surface-elevated text-text-muted hover:text-accent transition-colors"
                    title="Edit routine"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  {/* TEST RUN */}
                  <button
                    onClick={() => webScheduler.executeSchedule(schedule)}
                    className="p-1.5 rounded-control hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
                    title="Test run routine"
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>

                  {/* DELETE */}
                  <button
                    onClick={() => deleteSchedule(schedule.id)}
                    className="p-1.5 rounded-control hover:bg-surface-elevated text-text-muted hover:text-semantic-error transition-colors"
                    title="Delete routine"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {schedules.length === 0 && (
        <div className="p-12 text-center text-text-muted bg-surface rounded-card border border-hairline">
          <Clock className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <h3 className="text-sm font-medium text-text-primary">No routines configured</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Create an automated routine to switch music at specific times
          </p>
        </div>
      )}

      {/* Create / Edit Routine Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-hairline rounded-panel p-5 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                <h3 className="text-base font-medium text-text-primary">
                  {editingScheduleId ? 'Edit routine' : 'New routine'}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded-[4px] bg-surface-elevated border border-hairline">
                12-hour format
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Routine Name */}
              <div className="space-y-1">
                <label className="text-text-secondary font-normal">Routine name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Focus Flow, Morning Wakeup"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surface-elevated border border-hairline rounded-control px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-hairlineLight"
                />
              </div>

              {/* 12-Hour Start Time Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-text-secondary font-normal">Trigger time (12-hour format)</label>
                  <span className="text-xs font-mono font-medium text-accent">
                    {`${hour12.toString().padStart(2, '0')}:${minute} ${period}`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-surface-elevated p-2 rounded-control border border-hairline">
                  {/* Hours 1-12 */}
                  <select
                    aria-label="Hour"
                    value={hour12}
                    onChange={(e) => setHour12(parseInt(e.target.value, 10))}
                    className="flex-1 bg-surface border border-hairline rounded-[6px] px-2 py-1.5 text-xs text-text-primary font-mono focus:outline-none"
                  >
                    {ALL_HOURS_12.map((h) => (
                      <option key={h} value={h}>
                        {h < 10 ? `0${h}` : `${h}`}
                      </option>
                    ))}
                  </select>

                  <span className="font-mono text-text-muted font-bold">:</span>

                  {/* Minutes 00-59 (every 1 minute, no snapping) */}
                  <div className="flex flex-1 items-center gap-1">
                    <button
                      type="button"
                      aria-label="Decrease minute by 1"
                      onClick={() => {
                        const prev = (parseInt(minute, 10) + 59) % 60;
                        setMinute(prev.toString().padStart(2, '0'));
                      }}
                      className="px-1.5 py-1 bg-surface border border-hairline rounded-[6px] text-xs font-mono text-text-secondary hover:text-text-primary hover:border-hairlineLight transition-colors"
                    >
                      -
                    </button>
                    <select
                      aria-label="Minute"
                      value={minute}
                      onChange={(e) => setMinute(e.target.value)}
                      className="flex-1 bg-surface border border-hairline rounded-[6px] px-2 py-1.5 text-xs text-text-primary font-mono focus:outline-none"
                    >
                      {ALL_MINUTES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Increase minute by 1"
                      onClick={() => {
                        const next = (parseInt(minute, 10) + 1) % 60;
                        setMinute(next.toString().padStart(2, '0'));
                      }}
                      className="px-1.5 py-1 bg-surface border border-hairline rounded-[6px] text-xs font-mono text-text-secondary hover:text-text-primary hover:border-hairlineLight transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {/* AM / PM Toggle */}
                  <div className="flex items-center bg-surface border border-hairline rounded-[6px] p-0.5">
                    <button
                      type="button"
                      onClick={() => setPeriod('AM')}
                      className={`px-2.5 py-1 rounded-[4px] text-xs font-medium font-mono transition-all ${
                        period === 'AM'
                          ? 'bg-primary text-primary-dark shadow-subtle'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriod('PM')}
                      className={`px-2.5 py-1 rounded-[4px] text-xs font-medium font-mono transition-all ${
                        period === 'PM'
                          ? 'bg-primary text-primary-dark shadow-subtle'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Days */}
              <div className="space-y-1">
                <label className="text-text-secondary font-normal">Repeat days</label>
                <div className="flex items-center justify-between gap-1">
                  {dayNames.map((d) => {
                    const isSelected = selectedDays.includes(d.num);
                    return (
                      <button
                        type="button"
                        key={d.num}
                        onClick={() => toggleDay(d.num)}
                        className={`w-8 h-8 rounded-control font-mono text-xs transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-dark font-medium shadow-subtle'
                            : 'bg-surface-elevated text-text-muted hover:text-text-primary border border-hairline'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Type & Selection + ADD PLAYLIST OPTION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-text-secondary font-normal">Target audio</label>
                  {/* ADD PLAYLIST BUTTON */}
                  {targetType === 'PLAYLIST' && (
                    <button
                      type="button"
                      onClick={() => setIsAddingPlaylist(!isAddingPlaylist)}
                      className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>{isAddingPlaylist ? 'Cancel' : '+ Add Playlist'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('PLAYLIST');
                      if (playlists.length > 0) setTargetId(playlists[0].id);
                    }}
                    className={`py-1.5 rounded-control text-xs font-normal border transition-colors ${
                      targetType === 'PLAYLIST'
                        ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                        : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    Playlist
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('SONG');
                      setIsAddingPlaylist(false);
                      if (songs.length > 0) setTargetId(songs[0].id);
                    }}
                    className={`py-1.5 rounded-control text-xs font-normal border transition-colors ${
                      targetType === 'SONG'
                        ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                        : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    Track
                  </button>
                </div>

                {/* Inline "Add New Playlist" Form */}
                {isAddingPlaylist && targetType === 'PLAYLIST' && (
                  <div className="p-3 bg-surface-elevated rounded-control border border-accent/30 space-y-2">
                    <p className="text-[11px] font-medium text-text-primary">Create and target a new playlist</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="New playlist name..."
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        className="flex-1 bg-surface border border-hairline rounded-[6px] px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={handleCreateNewPlaylist}
                        disabled={!newPlaylistName.trim()}
                        className="px-3 py-1.5 bg-accent text-black font-semibold rounded-[6px] text-xs hover:bg-accent/90 disabled:opacity-50 transition-colors"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                )}

                {playlistCreatedSuccess && (
                  <div className="flex items-center gap-1.5 text-[11px] text-accent px-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>New playlist created and selected!</span>
                  </div>
                )}

                {/* Target Dropdown */}
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-surface-elevated border border-hairline rounded-control px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-hairlineLight"
                >
                  {targetType === 'PLAYLIST'
                    ? playlists.map((p) => (
                        <option key={p.id} value={p.id}>
                          Playlist: {p.name} ({p.songCount} tracks)
                        </option>
                      ))
                    : songs.map((s) => (
                        <option key={s.id} value={s.id}>
                          Track: {s.title} - {s.artist}
                        </option>
                      ))}
                </select>
              </div>

              {/* Priority Selection */}
              <div className="space-y-1">
                <label className="text-text-secondary font-normal">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SchedulePriority)}
                  className="w-full bg-surface-elevated border border-hairline rounded-control px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-hairlineLight"
                >
                  <option value="LOW">Low (casual background)</option>
                  <option value="NORMAL">Normal (daily routine)</option>
                  <option value="HIGH">High (workout / study)</option>
                  <option value="URGENT">Urgent (alarm / critical)</option>
                </select>
              </div>

              {/* Crossfade Duration */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label className="text-text-secondary font-normal">Crossfade duration</label>
                  <span className="font-mono text-text-muted tabular-nums">{transitionSec}s</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={transitionSec}
                  onChange={(e) => setTransitionSec(parseInt(e.target.value))}
                  className="w-full h-1 bg-surface-elevated appearance-none cursor-pointer rounded"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-control text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-control bg-primary text-primary-dark hover:bg-white text-xs font-semibold shadow-subtle transition-colors"
                >
                  {editingScheduleId ? 'Save changes' : 'Create routine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
