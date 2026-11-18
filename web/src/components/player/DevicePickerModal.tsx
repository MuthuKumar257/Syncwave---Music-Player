import React from 'react';
import { X, Monitor, Smartphone, Radio, CheckCircle2, Volume2 } from 'lucide-react';
import { DevicePlatform, usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Link } from 'react-router-dom';

const PlatformIcon: React.FC<{ platform: DevicePlatform; isActive: boolean }> = ({
  platform,
  isActive,
}) => {
  const cls = `w-5 h-5 ${isActive ? 'text-accent' : 'text-text-secondary'}`;
  if (platform === 'WEB') return <Monitor className={cls} />;
  return <Smartphone className={cls} />;
};

export const DevicePickerModal: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const {
    myDeviceId,
    devices,
    activeDeviceId,
    isRemoteMode,
    isDevicePickerOpen,
    transferError,
    setDevicePickerOpen,
    transferPlayback,
  } = usePlaybackSessionStore();

  if (!isDevicePickerOpen) return null;

  const activeDevice = devices.find((d) => d.deviceId === activeDeviceId) || null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
      onClick={() => setDevicePickerOpen(false)}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-card bg-surface border border-hairline shadow-subtle overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Connect to a device</h2>
              <p className="text-[11px] text-text-muted">
                Audio plays on one selected device while others act as remotes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDevicePickerOpen(false)}
            className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            aria-label="Close device picker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto pb-[max(env(safe-area-inset-bottom,0px),20px)]">
          {!isAuthenticated ? (
            <div className="rounded-control bg-surface-elevated border border-hairline p-4 space-y-3 text-center">
              <p className="text-xs text-text-secondary">
                Sign in with the same SyncWave account on multiple devices to select which device
                plays audio and control it remotely.
              </p>
              <Link
                to="/login"
                onClick={() => setDevicePickerOpen(false)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-control bg-accent text-black text-xs font-semibold hover:brightness-110 transition"
              >
                Sign in to link devices
              </Link>
            </div>
          ) : (
            <>
              <div className="rounded-control bg-surface-elevated/80 border border-hairline px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Volume2 className="w-4 h-4 text-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-text-muted uppercase tracking-wider">
                      {isRemoteMode ? 'Acting as Remote' : 'Current Output Device'}
                    </p>
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {activeDevice?.deviceName || 'This Web Browser'}
                    </p>
                  </div>
                </div>
                {isRemoteMode && (
                  <button
                    type="button"
                    onClick={() => void transferPlayback(myDeviceId)}
                    className="shrink-0 px-2.5 py-1.5 rounded-control bg-accent text-black text-[11px] font-semibold hover:brightness-110 transition"
                  >
                    Play here
                  </button>
                )}
              </div>

              {transferError && (
                <div className="rounded-control border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {transferError}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Online devices ({devices.length})
                </p>

                {devices.length === 0 ? (
                  <p className="text-xs text-text-muted py-3">
                    Registering this browser session...
                  </p>
                ) : (
                  devices.map((device) => {
                    const isSelf = device.deviceId === myDeviceId;
                    const isActive = device.deviceId === activeDeviceId;
                    return (
                      <button
                        key={device.deviceId}
                        type="button"
                        onClick={() => {
                          if (!isActive) {
                            void transferPlayback(device.deviceId);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-control border text-left transition-colors ${
                          isActive
                            ? 'border-accent/50 bg-accent/10'
                            : 'border-hairline bg-surface-elevated/60 hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <PlatformIcon platform={device.platform} isActive={isActive} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary truncate">
                                {device.deviceName}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded bg-surface border border-hairline text-[10px] text-text-secondary shrink-0">
                                  This device
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {isActive
                                ? 'Playing audio • Selected output'
                                : 'Remote controller • Muted locally'}
                            </p>
                          </div>
                        </div>

                        {isActive ? (
                          <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                        ) : (
                          <span className="text-[11px] font-medium text-accent shrink-0">
                            Switch here
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
