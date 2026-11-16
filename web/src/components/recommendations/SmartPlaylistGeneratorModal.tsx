import React, { useState } from 'react';
import { Play, Plus, RefreshCw, X, Clock, Music, Check, Sliders } from 'lucide-react';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SmartPlaylistResponse, UnifiedTrack } from '../../types';

interface SmartPlaylistGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOODS = [
  'Evergreen Melody',
  'Workout & High Energy',
  'Calm & Relaxing',
  'Late Night Ambient',
  'Morning Devotional',
  'Cinema Blockbuster Hits'
];

const LANGUAGES = [
  'Tamil',
  'Telugu',
  'Hindi',
  'Malayalam',
  'Kannada',
  'Punjabi',
  'English'
];

const DURATIONS = [
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '60m', value: 60 },
  { label: '90m', value: 90 }
];

export const SmartPlaylistGeneratorModal: React.FC<SmartPlaylistGeneratorModalProps> = ({
  isOpen,
  onClose
}) => {
  const { generateSmartPlaylist } = useRecommendationStore();
  const { createPlaylist, addSongToPlaylist } = useLibraryStore();
  const { playSong } = usePlayerStore();

  const [selectedLanguage, setSelectedLanguage] = useState('Tamil');
  const [selectedMood, setSelectedMood] = useState('Evergreen Melody');
  const [selectedDuration, setSelectedDuration] = useState(45);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlaylist, setGeneratedPlaylist] = useState<SmartPlaylistResponse | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIsSaved(false);
    try {
      const res = await generateSmartPlaylist({
        language: selectedLanguage,
        genreOrMood: selectedMood,
        targetDurationMinutes: selectedDuration
      });
      setGeneratedPlaylist(res);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayAll = () => {
    if (!generatedPlaylist || generatedPlaylist.tracks.length === 0) return;
    const first = generatedPlaylist.tracks[0];
    playSong({
      id: first.id,
      title: first.title,
      artist: first.artist,
      album: generatedPlaylist.name,
      durationMs: first.durationMs,
      artworkUrl: first.artworkUrl,
      source: first.sourcePlatform,
      externalUrl: first.sourceUrl,
      createdAt: new Date().toISOString()
    });
    onClose();
  };

  const handleSaveToLibrary = async () => {
    if (!generatedPlaylist) return;
    const pl = await createPlaylist(generatedPlaylist.name);
    generatedPlaylist.tracks.forEach((t) => {
      addSongToPlaylist(pl.id, t.id);
    });
    setIsSaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-xl bg-surface border border-hairline rounded-panel shadow-subtle overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-hairline flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-text-primary">
              Generate mix
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Synthesize a targeted playlist by language, style, and duration
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-control text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Controls */}
          <div className="space-y-3.5 bg-surface-elevated/40 border border-hairline rounded-card p-3.5">
            {/* Language */}
            <div className="space-y-1.5">
              <label className="text-text-secondary font-medium">Language</label>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-3 py-1 rounded-[6px] text-xs font-medium border transition-colors ${
                      selectedLanguage === lang
                        ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                        : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="space-y-1.5">
              <label className="text-text-secondary font-medium">Style</label>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => setSelectedMood(mood)}
                    className={`px-3 py-1 rounded-[6px] text-xs font-medium border transition-colors ${
                      selectedMood === mood
                        ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                        : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration (1-minute precision) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-text-secondary font-medium">Target duration (every 1 minute)</label>
                <span className="font-mono text-accent tabular-nums">{selectedDuration} min</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DURATIONS.map((dur) => (
                  <button
                    key={dur.value}
                    type="button"
                    onClick={() => setSelectedDuration(dur.value)}
                    className={`px-3 py-1 rounded-[6px] text-xs font-mono tabular-nums border transition-colors ${
                      selectedDuration === dur.value
                        ? 'bg-surface-elevated border-hairlineLight text-text-primary'
                        : 'bg-surface border-hairline text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {dur.label}
                  </button>
                ))}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    aria-label="Decrease target duration by 1 minute"
                    onClick={() => setSelectedDuration((d) => Math.max(1, d - 1))}
                    className="px-2 py-1 rounded-[6px] bg-surface border border-hairline text-xs font-mono text-text-secondary hover:text-text-primary"
                  >
                    -1m
                  </button>
                  <select
                    aria-label="Target duration minutes"
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1)))}
                    className="bg-surface border border-hairline rounded-[6px] px-2 py-1 text-xs font-mono text-text-primary focus:outline-none"
                  >
                    {Array.from({ length: 180 }, (_, idx) => idx + 1).map((min) => (
                      <option key={min} value={min}>
                        {min} min
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="Increase target duration by 1 minute"
                    onClick={() => setSelectedDuration((d) => Math.min(180, d + 1))}
                    className="px-2 py-1 rounded-[6px] bg-surface border border-hairline text-xs font-mono text-text-secondary hover:text-text-primary"
                  >
                    +1m
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-2 rounded-control bg-primary text-primary-dark hover:bg-white text-xs font-medium shadow-subtle transition-colors flex items-center justify-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <span>Synthesize playlist</span>
              )}
            </button>
          </div>

          {/* Generated Result Preview */}
          {generatedPlaylist && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-text-primary">{generatedPlaylist.name}</h4>
                  <p className="text-[11px] font-mono text-text-muted tabular-nums">
                    {generatedPlaylist.totalTracks} tracks &bull; ~{Math.round(generatedPlaylist.totalDurationMs / 60000)} mins
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayAll}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-control bg-primary text-primary-dark hover:bg-white text-xs font-medium"
                  >
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                    <span>Play</span>
                  </button>
                  <button
                    onClick={handleSaveToLibrary}
                    disabled={isSaved}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-control bg-surface-elevated hover:bg-surface-hover text-text-primary border border-hairline text-xs font-medium"
                  >
                    {isSaved ? <Check className="w-3 h-3 text-accent" /> : <Plus className="w-3 h-3" />}
                    <span>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-surface-elevated/40 border border-hairline rounded-card divide-y divide-hairline max-h-56 overflow-y-auto">
                {generatedPlaylist.tracks.map((t, idx) => (
                  <div key={t.id} className="p-2 px-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-4 text-right font-mono text-[10px] text-text-muted tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">{t.title}</p>
                        <p className="text-[11px] text-text-muted truncate">{t.artist}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-text-muted shrink-0 tabular-nums">
                      {Math.floor(t.durationMs / 60000)}:{Math.floor((t.durationMs % 60000) / 1000).toString().padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
