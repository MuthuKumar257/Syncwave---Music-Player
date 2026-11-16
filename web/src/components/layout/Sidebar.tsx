import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Library, Calendar, Music, Disc3, User, LogIn, MonitorSpeaker } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';

const SidebarAccountCard: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { isRemoteMode, devices, activeDeviceId, setDevicePickerOpen } = usePlaybackSessionStore();
  const activeDevice = devices.find((d) => d.deviceId === activeDeviceId);

  if (isAuthenticated && user) {
    return (
      <div className="mb-3 space-y-1.5">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
              isActive
                ? 'border-accent/40 bg-accent/10 text-text-primary'
                : 'border-hairline bg-surface-elevated/60 hover:bg-surface-hover text-text-secondary hover:text-text-primary'
            }`
          }
        >
          <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shrink-0 text-xs font-semibold">
            {(user.displayName || user.email || 'S').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-text-primary truncate">{user.displayName}</p>
            <p className="text-[10px] text-text-muted truncate">{user.email}</p>
          </div>
        </NavLink>

        <button
          type="button"
          onClick={() => setDevicePickerOpen(true)}
          className={`w-full flex items-center justify-between gap-2 rounded-control border px-2.5 py-1.5 text-[11px] transition-colors ${
            isRemoteMode
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-hairline bg-surface-elevated/40 text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <MonitorSpeaker className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {isRemoteMode ? `Remote: ${activeDevice?.deviceName || 'Device'}` : 'Playing on this browser'}
            </span>
          </span>
          <span className="font-mono text-[10px] opacity-80 shrink-0">{devices.length || 1}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-hairline bg-surface-elevated/50 p-2.5 space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        <LogIn className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="truncate">Sync schedules &amp; stats</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <NavLink
          to="/login"
          className="h-7 rounded-control bg-accent text-black text-[11px] font-semibold flex items-center justify-center hover:brightness-110 transition"
        >
          Sign in
        </NavLink>
        <NavLink
          to="/signup"
          className="h-7 rounded-control bg-surface-hover border border-hairline text-[11px] font-medium text-text-primary flex items-center justify-center hover:bg-surface transition"
        >
          Sign up
        </NavLink>
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { playlists } = useLibraryStore();

  const navItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Discover', icon: Compass, path: '/discover' },
    { label: 'Library', icon: Library, path: '/library' },
    { label: 'Scheduler', icon: Calendar, path: '/scheduler' },
    { label: 'Profile', icon: User, path: '/profile' }
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 h-full bg-surface-deepest border-r border-hairline p-4 select-none shrink-0">
      {/* Brand: Flat Wordmark with Tactile Sound Wave Mark */}
      <div className="flex items-center gap-2.5 px-2 py-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-hairline flex items-center justify-center">
          <Disc3 className="w-4 h-4 text-accent" />
        </div>
        <div>
          <span className="text-base font-semibold tracking-tight text-text-primary block">
            SyncWave
          </span>
          <span className="text-xs text-text-muted font-normal block">
            Music & routines
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-control text-sm transition-colors duration-150 ${
                  isActive
                    ? 'bg-surface-elevated text-text-primary font-medium border border-hairline shadow-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0 text-text-muted" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Playlists Section */}
      <div className="mt-6 mb-2 px-3 flex items-center justify-between text-xs font-normal text-text-muted">
        <span>Playlists</span>
        <span className="tabular-nums text-text-muted">{playlists.length}</span>
      </div>

      {/* Playlists Quick List */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        {playlists.map((pl) => (
          <NavLink
            key={pl.id}
            to={`/library?tab=playlists&id=${pl.id}`}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-control text-sm text-text-secondary hover:text-text-primary hover:bg-surface truncate transition-colors"
          >
            <Music className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="truncate">{pl.name}</span>
          </NavLink>
        ))}
        {playlists.length === 0 && (
          <p className="px-3 py-2 text-xs text-text-muted">No playlists yet</p>
        )}
      </div>

      {/* Account status & navigation */}
      <SidebarAccountCard />

      {/* Hardware Studio Signature Badge */}
      <div className="pt-3 border-t border-hairline px-3 flex items-center justify-between text-[11px] text-text-muted tabular-nums">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
          <span>Local engine</span>
        </span>
        <span className="font-mono text-[10px]">44.1 kHz</span>
      </div>
    </aside>
  );
};
