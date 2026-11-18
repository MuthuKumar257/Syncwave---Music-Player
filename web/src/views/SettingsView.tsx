import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Sliders,
  Cloud,
  RotateCcw,
  Sparkles,
  HardDrive,
  Trash2,
  LogIn,
  UserPlus,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Star
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { webAudioPlayer } from '../audio/WebAudioPlayer';
import { OnboardingModal } from '../components/onboarding/OnboardingModal';

const ALL_LANGUAGES = [
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Hindi',
  'English',
  'Punjabi',
  'Bengali',
  'Marathi'
];

interface SettingsViewProps {
  embedded?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ embedded = false }) => {
  const { user, isAuthenticated, logout, syncWithCloud, isSyncing } =
    useAuthStore();
  const {
    preferences,
    updatePreferences,
    resetPreferences,
    isOnboardingOpen,
    openOnboarding,
    closeOnboarding
  } = useRecommendationStore();

  const {
    musicFolders,
    isSyncing: isSyncingLibrary,
    lastSyncSummary,
    selectMusicFolder,
    importFallbackFolderFiles,
    setDefaultMusicFolder,
    removeMusicFolder,
    reauthorizeMusicFolder,
    syncLibrary
  } = useLibraryStore();

  const [crossfadeSec, setCrossfadeSec] = useState(3);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [historyClearedMsg, setHistoryClearedMsg] = useState('');
  const [fallbackMakeDefault, setFallbackMakeDefault] = useState(true);
  const folderFallbackRef = useRef<HTMLInputElement>(null);

  const handleSelectFolderClick = async (makeDefault: boolean) => {
    const res = await selectMusicFolder({ makeDefault });
    if (res === 'FALLBACK_REQUIRED') {
      setFallbackMakeDefault(makeDefault);
      folderFallbackRef.current?.click();
    }
  };

  const handleFallbackFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await importFallbackFolderFiles(e.target.files, fallbackMakeDefault);
      e.target.value = '';
    }
  };

  const selectedLanguages = preferences?.preferredLanguages || ['Tamil', 'Telugu', 'Hindi'];
  const personalizationEnabled = preferences?.personalizationEnabled ?? true;
  const historyEnabled = preferences?.historyEnabled ?? true;

  const [isArtistPreferencesOpen, setIsArtistPreferencesOpen] = useState(false);

  const allSelectedArtists = useMemo(() => {
    return Array.from(
      new Set([
        ...(preferences?.favouriteArtists || []),
        ...(preferences?.favouriteComposers || []),
        ...(preferences?.favouriteSingers || [])
      ])
    ).filter(Boolean);
  }, [preferences]);

  const removeArtist = async (artistName: string) => {
    const updatedArtists = (preferences?.favouriteArtists || []).filter(
      (a) => a.toLowerCase() !== artistName.toLowerCase()
    );
    const updatedComposers = (preferences?.favouriteComposers || []).filter(
      (c) => c.toLowerCase() !== artistName.toLowerCase()
    );
    const updatedSingers = (preferences?.favouriteSingers || []).filter(
      (s) => s.toLowerCase() !== artistName.toLowerCase()
    );
    await updatePreferences({
      favouriteArtists: updatedArtists,
      favouriteComposers: updatedComposers,
      favouriteSingers: updatedSingers
    });
  };

  const handleToggleLanguage = (lang: string) => {
    let newLangs: string[];
    if (selectedLanguages.includes(lang)) {
      if (selectedLanguages.length <= 1) return;
      newLangs = selectedLanguages.filter((l) => l !== lang);
    } else {
      newLangs = [...selectedLanguages, lang];
    }
    updatePreferences({ preferredLanguages: newLangs });
  };

  const handleResetPersonalization = async () => {
    await resetPreferences();
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  const handleClearPlaybackHistory = async () => {
    try {
      const token = localStorage.getItem('syncwave_token');
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setHistoryClearedMsg('Playback history cleared.');
        setTimeout(() => setHistoryClearedMsg(''), 3000);
      }
    } catch {
      // Ignore offline errors
    }
  };

  const handleCrossfadeChange = (val: number) => {
    setCrossfadeSec(val);
    webAudioPlayer.setCrossfadeDuration(val);
  };

  return (
    <div className={embedded ? 'space-y-5 md:space-y-6 max-w-3xl select-none' : 'flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-8 space-y-5 md:space-y-6 max-w-3xl select-none pb-20 md:pb-8'}>
      {/* Onboarding Dialog */}
      {!embedded && <OnboardingModal isOpen={isOnboardingOpen} onClose={closeOnboarding} />}

      {/* Header (shown only when rendered standalone) */}
      {!embedded && (
        <div>
          <h1 className="text-2xl md:text-3xl font-medium text-text-primary tracking-tight">
            Settings
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Account synchronization, audio engine, and preferences
          </p>
        </div>
      )}

      {/* Account / Cloud Sync Card */}
      <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-control bg-surface-elevated border border-hairline text-text-muted flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">
                {isAuthenticated ? user?.displayName : 'Account & sync'}
              </h3>
              <p className="text-xs text-text-muted">
                {isAuthenticated ? user?.email : 'Sign in to synchronize schedules and playlists'}
              </p>
            </div>
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => syncWithCloud()}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover text-text-primary border border-hairline text-xs font-medium transition-colors"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSyncing ? 'Syncing' : 'Sync'}</span>
              </button>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-control text-xs text-text-muted hover:text-semantic-error transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {!isAuthenticated && (
          <div className="pt-3 border-t border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              Authenticate with Google or verify with email, password &amp; 6-digit OTP to sync your
              account across web and mobile.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent text-black hover:brightness-110 text-xs font-semibold transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-surface-elevated hover:bg-surface-hover text-text-primary border border-hairline text-xs font-medium transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign up</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Personalization & Taste Profile Section */}
      <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-control bg-surface-elevated border border-hairline text-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-text-primary">Personalization & Taste Profile</h3>
            <p className="text-xs text-text-muted">
              Configure preferred languages, music directors, singers, and recommendation scoring
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary block mb-2">Music Languages</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_LANGUAGES.map((lang) => {
              const isSelected = selectedLanguages.includes(lang);
              return (
                <button
                  key={lang}
                  onClick={() => handleToggleLanguage(lang)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                      : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </div>

        {/* Artists Preferences Configuration */}
        <div className="p-3.5 rounded-[10px] bg-surface-elevated border border-hairline space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <p className="text-xs font-medium text-text-primary">Artists Preferences</p>
              </div>
              <p className="text-[11px] text-text-muted">
                {allSelectedArtists.length} Artists configured (Music Directors & Singers). These heavily influence your recommendations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsArtistPreferencesOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-primary text-primary-dark hover:bg-white text-xs font-semibold shadow-subtle transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Select / Edit Artists</span>
            </button>
          </div>

          {/* Selected Artist Chips with Quick Deselect */}
          {allSelectedArtists.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-hairline/60">
              {allSelectedArtists.map((artistName: string) => (
                <span
                  key={artistName}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-hairline text-[11px] font-medium text-text-primary"
                >
                  <span>{artistName}</span>
                  <button
                    type="button"
                    onClick={() => removeArtist(artistName)}
                    className="w-3.5 h-3.5 rounded-full hover:bg-surface-elevated flex items-center justify-center text-text-muted hover:text-semantic-error transition-colors"
                    title={`Deselect ${artistName}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted italic pt-1">
              No artists selected yet. Tap &ldquo;Select / Edit Artists&rdquo; to choose your favourite music directors and singers.
            </p>
          )}
        </div>

        <OnboardingModal
          isOpen={isArtistPreferencesOpen}
          onClose={() => setIsArtistPreferencesOpen(false)}
          initialStep={2}
        />

        {/* Learning Toggles */}
        <div className="space-y-3 pt-3 border-t border-hairline text-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">Personalized recommendations</p>
              <p className="text-text-muted text-[11px]">Score tracks using your taste profile</p>
            </div>
            <button
              onClick={() => updatePreferences({ personalizationEnabled: !personalizationEnabled })}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                personalizationEnabled ? 'bg-primary' : 'bg-surface-elevated border border-hairline'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform ${
                  personalizationEnabled ? 'translate-x-4 bg-primary-dark shadow-subtle' : 'translate-x-0 bg-text-muted'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">Listening history learning</p>
              <p className="text-text-muted text-[11px]">Adapt recommendations based on plays and skips</p>
            </div>
            <button
              onClick={() => updatePreferences({ historyEnabled: !historyEnabled })}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                historyEnabled ? 'bg-primary' : 'bg-surface-elevated border border-hairline'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform ${
                  historyEnabled ? 'translate-x-4 bg-primary-dark shadow-subtle' : 'translate-x-0 bg-text-muted'
                }`}
              />
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={handleResetPersonalization}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-semantic-error transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset preferences &amp; history</span>
            </button>
            {resetSuccess && (
              <span className="text-[11px] font-mono text-accent">Preferences reset</span>
            )}
          </div>
        </div>
      </div>

      {/* Local Music Folders & Default Directory */}
      <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
        <input
          ref={folderFallbackRef}
          type="file"
          multiple
          {...({ webkitdirectory: '' } as any)}
          accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a,.opus,.wma,.alac"
          className="hidden"
          onChange={handleFallbackFolderChange}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-control bg-surface-elevated border border-hairline text-accent flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Local Music Folders</h3>
              <p className="text-xs text-text-muted">
                Default folder auto-scans on launch; downloaded songs save to your Songs folder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => syncLibrary({ force: true })}
              disabled={isSyncingLibrary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover border border-hairline text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLibrary ? 'animate-spin text-accent' : ''}`} />
              <span>Sync</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectFolderClick(musicFolders.length === 0)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent text-black hover:brightness-110 text-xs font-semibold transition"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{musicFolders.length === 0 ? 'Select Default Folder' : 'Add Folder'}</span>
            </button>
          </div>
        </div>

        {lastSyncSummary && (
          <p className="text-[11px] font-mono text-emerald-400">{lastSyncSummary}</p>
        )}

        {musicFolders.length > 0 ? (
          <div className="divide-y divide-hairline bg-surface-elevated rounded-control border border-hairline">
            {musicFolders.map((folder) => (
              <div key={folder.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-primary truncate">{folder.name}</span>
                    {folder.isDefault && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-accent/15 border border-accent/30 text-accent inline-flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        Default
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-text-muted">
                      {folder.trackCount ?? 0} tracks &bull; {folder.permissionState}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {folder.permissionState === 'prompt' && (
                    <button
                      type="button"
                      onClick={() => reauthorizeMusicFolder(folder.id)}
                      className="px-2 py-1 rounded bg-accent/15 text-accent text-[11px] font-medium hover:bg-accent/25"
                    >
                      Grant access
                    </button>
                  )}
                  {!folder.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultMusicFolder(folder.id)}
                      className="px-2 py-1 rounded bg-surface border border-hairline text-text-secondary hover:text-text-primary text-[11px]"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelectFolderClick(true)}
                    className="px-2 py-1 rounded bg-surface border border-hairline text-text-secondary hover:text-text-primary text-[11px]"
                    title="Change default folder"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMusicFolder(folder.id)}
                    className="p-1 text-text-muted hover:text-semantic-error transition-colors"
                    title="Remove folder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3.5 rounded-control bg-surface-elevated border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-text-muted">No default music folder selected yet.</span>
            <button
              type="button"
              onClick={() => handleSelectFolderClick(true)}
              className="text-accent font-medium hover:underline self-start sm:self-auto"
            >
              Choose Default Music Folder
            </button>
          </div>
        )}
      </div>

      {/* Local Storage & Privacy */}
      <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-control bg-surface-elevated border border-hairline text-accent flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Storage &amp; Privacy</h3>
              <p className="text-xs text-text-muted">
                Downloads stay on your local device
              </p>
            </div>
          </div>

          <button
            onClick={handleClearPlaybackHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover border border-hairline text-xs text-text-secondary hover:text-semantic-error transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear history</span>
          </button>
        </div>
        {historyClearedMsg && (
          <p className="text-xs text-emerald-400">{historyClearedMsg}</p>
        )}
      </div>

      {/* Audio Engine Hardware Deck */}
      <div className="p-5 rounded-card bg-surface border border-hairline space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-control bg-surface-elevated border border-hairline text-text-muted flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-text-primary">Audio engine</h3>
            <p className="text-xs text-text-muted">
              Web Audio API playback deck configuration
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1 text-xs">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-text-secondary">Crossfade duration</span>
              <span className="font-mono text-text-muted tabular-nums">{crossfadeSec}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={crossfadeSec}
              onChange={(e) => handleCrossfadeChange(parseInt(e.target.value))}
              className="w-full h-1 bg-surface-elevated appearance-none cursor-pointer rounded"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-hairline font-mono">
            <span>Sample rate</span>
            <span>44.1 kHz • 24-bit PCM</span>
          </div>
        </div>
      </div>
    </div>
  );
};
