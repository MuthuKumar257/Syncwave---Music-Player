import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe2,
  Music2,
  Mic2,
  Sparkles,
  Check,
  Search,
  ArrowRight,
  X,
  Users,
  CheckCheck,
  RotateCcw
} from 'lucide-react';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { ArtistItem } from '../../types';
import { ArtworkImage } from '../common/ArtworkImage';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  subtitle: string;
}

const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'Tamil', name: 'Tamil', nativeName: 'தமிழ்', subtitle: 'Kollywood & Folk Melodies' },
  { code: 'Telugu', name: 'Telugu', nativeName: 'తెలుగు', subtitle: 'Tollywood Hits & Beats' },
  { code: 'Malayalam', name: 'Malayalam', nativeName: 'മലയാളം', subtitle: 'Mollywood Acoustic & Indie' },
  { code: 'Kannada', name: 'Kannada', nativeName: 'ಕನ್ನಡ', subtitle: 'Sandalwood & Heavy Anthems' },
  { code: 'Hindi', name: 'Hindi', nativeName: 'हिन्दी', subtitle: 'Bollywood & Sufi Ballads' },
  { code: 'English', name: 'English', nativeName: 'English', subtitle: 'Pop, R&B & Global Soundtracks' },
  { code: 'Punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', subtitle: 'Bhangra, Desi Hip-hop' },
  { code: 'Bengali', name: 'Bengali', nativeName: 'বাংলা', subtitle: 'Rabindra Sangeet & Folk' },
  { code: 'Marathi', name: 'Marathi', nativeName: 'मराठी', subtitle: 'Natya Sangeet & Modern Hits' }
];

interface OnboardingModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialStep?: 1 | 2 | 3;
}

const AVAILABLE_GENRES = [
  { id: 'Melody', name: 'Melody', desc: 'Evergreen Cinema Melodies' },
  { id: 'Soundtrack', name: 'Soundtrack', desc: 'Original Motion Picture Scores' },
  { id: 'Pop', name: 'Pop', desc: 'Upbeat Anthems & Modern Rhythms' },
  { id: 'Classical', name: 'Classical', desc: 'Ragas, Carnatic & Hindustani' },
  { id: 'Folk', name: 'Folk', desc: 'Traditional & Cultural Roots' },
  { id: 'EDM', name: 'EDM / Dance', desc: 'High Voltage Dance Beats' },
  { id: 'Devotional', name: 'Devotional', desc: 'Spiritual Peace & Sacred Chants' },
  { id: 'Acoustic', name: 'Acoustic', desc: 'Gentle Guitars & Unplugged' }
];

const AVAILABLE_MOODS = [
  { id: 'Happy', name: 'Happy', desc: 'Bright, feel-good melodies' },
  { id: 'Romantic', name: 'Romantic', desc: 'Timeless love duets' },
  { id: 'Energetic', name: 'Energetic', desc: 'Power beats & adrenaline' },
  { id: 'Relaxing', name: 'Relaxing', desc: 'Calm acoustics & unwind' },
  { id: 'Sad', name: 'Sad', desc: 'Emotional soulful ballads' },
  { id: 'Party', name: 'Party', desc: 'Weekend dancefloor hits' },
  { id: 'Devotional', name: 'Devotional', desc: 'Reverent spiritual calm' },
  { id: 'Focus', name: 'Focus', desc: 'Deep concentration & flow' }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen: propIsOpen, onClose: propOnClose, initialStep = 1 }) => {
  const {
    isOnboardingOpen: storeIsOpen,
    closeOnboarding,
    setOnboardingCompleted,
    preferences,
    updatePreferences,
    fetchArtistsCatalog
  } = useRecommendationStore();

  const isVisible = propIsOpen !== undefined ? propIsOpen : storeIsOpen;

  const handleClose = () => {
    if (propOnClose) propOnClose();
    closeOnboarding();
  };

  const [step, setStep] = useState<1 | 2 | 3>(initialStep);

  // Step 1: Selected languages
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['Tamil', 'Telugu', 'Hindi']);

  // Step 2: Filter inside unified Artists category ('ALL' | 'DIRECTORS' | 'SINGERS')
  const [activeTab, setActiveTab] = useState<'ALL' | 'DIRECTORS' | 'SINGERS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewAll, setViewAll] = useState(false);

  // Unified Artist selections
  const [selectedArtists, setSelectedArtists] = useState<string[]>([
    'A. R. Rahman',
    'Anirudh Ravichander',
    'Harris Jayaraj',
    'Sid Sriram',
    'S. P. Balasubrahmanyam',
    'Shreya Ghoshal'
  ]);

  // Step 3: Preferred Genres & Moods
  const [selectedGenres, setSelectedGenres] = useState<string[]>([
    'Melody',
    'Soundtrack',
    'Pop'
  ]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([
    'Happy',
    'Romantic',
    'Relaxing'
  ]);

  // Loaded artists catalog
  const [allArtists, setAllArtists] = useState<ArtistItem[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isVisible) {
      setStep(initialStep);
      if (preferences) {
        if (preferences.preferredLanguages?.length > 0) {
          setSelectedLanguages(preferences.preferredLanguages);
        }
        const existingArtists = [
          ...(preferences.favouriteArtists || []),
          ...(preferences.favouriteComposers || []),
          ...(preferences.favouriteSingers || [])
        ];
        if (existingArtists.length > 0) {
          setSelectedArtists(Array.from(new Set(existingArtists)));
        }
        if (preferences.favouriteGenres && preferences.favouriteGenres.length > 0) {
          setSelectedGenres(preferences.favouriteGenres);
        }
        if (preferences.preferredMoods && preferences.preferredMoods.length > 0) {
          setSelectedMoods(preferences.preferredMoods);
        }
      }
      loadCatalog();
    }
  }, [isVisible, preferences, initialStep]);

  const loadCatalog = async () => {
    setIsLoadingArtists(true);
    const catalog = await fetchArtistsCatalog({ languages: selectedLanguages });
    setAllArtists(catalog);
    setIsLoadingArtists(false);
  };

  // Re-fetch catalog when selected languages change for step 2
  useEffect(() => {
    if (step === 2) {
      loadCatalog();
    }
  }, [step, selectedLanguages]);

  // Search and Tab Filtered Artists
  const filteredArtists = useMemo(() => {
    let list = allArtists;

    if (activeTab === 'DIRECTORS') {
      list = list.filter((a) => a.role === 'DIRECTOR');
    } else if (activeTab === 'SINGERS') {
      list = list.filter((a) => a.role === 'SINGER');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.roleTitle && a.roleTitle.toLowerCase().includes(q)) ||
          a.knownFor.some((k) => k.toLowerCase().includes(q)) ||
          a.popularTracks.some((t) => t.toLowerCase().includes(q)) ||
          a.languages.some((l) => l.toLowerCase().includes(q))
      );
    }

    return viewAll || searchQuery ? list : list.slice(0, 16);
  }, [allArtists, activeTab, searchQuery, viewAll]);

  if (!isVisible) return null;

  // Language toggle
  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code)
        ? prev.length > 1
          ? prev.filter((c) => c !== code)
          : prev
        : [...prev, code]
    );
  };

  // Artist toggle
  const toggleArtist = (name: string) => {
    setSelectedArtists((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  // Select/Clear All handlers
  const handleSelectAllCurrentView = () => {
    const names = filteredArtists.map((a) => a.name);
    setSelectedArtists((prev) => Array.from(new Set([...prev, ...names])));
  };

  const handleClearAllCurrentView = () => {
    const names = new Set(filteredArtists.map((a) => a.name));
    setSelectedArtists((prev) => prev.filter((name) => !names.has(name)));
  };

  // Finish Onboarding
  const handleFinish = async () => {
    // Separate into directors and singers for backward compatibility
    const directors = selectedArtists.filter((name) => {
      const match = allArtists.find((a) => a.name.toLowerCase() === name.toLowerCase());
      return match ? match.role === 'DIRECTOR' : true;
    });
    const singers = selectedArtists.filter((name) => {
      const match = allArtists.find((a) => a.name.toLowerCase() === name.toLowerCase());
      return match ? match.role === 'SINGER' : false;
    });

    await updatePreferences({
      preferredLanguages: selectedLanguages,
      favouriteArtists: selectedArtists,
      favouriteComposers: directors,
      favouriteSingers: singers,
      favouriteGenres: selectedGenres,
      preferredMoods: selectedMoods,
      hasCompletedOnboarding: true
    });
    setOnboardingCompleted(true);
    handleClose();
  };

  // Genre toggle
  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((g) => g !== id)
          : prev
        : [...prev, id]
    );
  };

  // Mood toggle
  const toggleMood = (id: string) => {
    setSelectedMoods((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((m) => m !== id)
          : prev
        : [...prev, id]
    );
  };

  // Skip
  const handleSkip = () => {
    setOnboardingCompleted(true);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#141415] border border-[rgba(237,237,237,0.08)] rounded-[14px] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[rgba(237,237,237,0.08)] bg-[#141415]/90 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-[8px] bg-[#19191B] border border-[rgba(237,237,237,0.08)] flex items-center justify-center text-[#F59E0B] shrink-0">
              {step === 1 ? <Globe2 className="w-4 h-4 sm:w-5 sm:h-5" /> : step === 2 ? <Users className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-[#EDEDED] truncate">
                  {step === 1 ? 'Music Languages' : step === 2 ? 'Artists & Directors' : 'Genres & Moods'}
                </h2>
                <span className="text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-[4px] bg-[#19191B] text-[#A1A1A6] border border-[rgba(237,237,237,0.08)] shrink-0">
                  Step {step}/3
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#A1A1A6] truncate">
                {step === 1
                  ? 'Choose your primary music languages to tailor your discovery feed'
                  : step === 2
                  ? 'Select your favourite Artists (Music Directors & Singers) to personalize your experience'
                  : 'Select your preferred music genres and daily listening moods to refine your sound'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-1.5 rounded-[8px] text-[#85858B] hover:text-[#EDEDED] hover:bg-[#19191B] transition-colors shrink-0"
            title="Skip onboarding"
            aria-label="Skip onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {step === 1 ? (
            /* ========================================================= */
            /* STEP 1: LANGUAGE SELECTION                                */
            /* ========================================================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#A1A1A6]">
                  Select one or more languages ({selectedLanguages.length} selected)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {AVAILABLE_LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguages.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`relative flex flex-col items-start p-4 rounded-[12px] text-left transition-all border ${
                        isSelected
                          ? 'bg-[#19191B] border-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          : 'bg-[#141415] border-[rgba(237,237,237,0.08)] hover:bg-[#19191B] hover:border-[rgba(237,237,237,0.15)]'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between mb-1">
                        <span className="text-base font-semibold text-[#EDEDED]">{lang.name}</span>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-[#F59E0B] text-black flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-[rgba(237,237,237,0.2)]" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-[#F59E0B]/90 mb-1">{lang.nativeName}</span>
                      <span className="text-[11px] text-[#85858B] line-clamp-1">{lang.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : step === 2 ? (
            /* ========================================================= */
            /* STEP 2: ARTISTS PREFERENCES (UNIFIED CATEGORY)            */
            /* ========================================================= */
            <div className="space-y-5">
              {/* Top Controls: Filter Pills and Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-[10px] bg-[#19191B] border border-[rgba(237,237,237,0.08)]">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-[#141415] rounded-[8px] border border-[rgba(237,237,237,0.08)] overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => setActiveTab('ALL')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all shrink-0 ${
                      activeTab === 'ALL'
                        ? 'bg-[#232325] text-[#EDEDED] shadow-sm'
                        : 'text-[#85858B] hover:text-[#EDEDED]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>All Artists</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('DIRECTORS')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all shrink-0 ${
                      activeTab === 'DIRECTORS'
                        ? 'bg-[#232325] text-[#EDEDED] shadow-sm'
                        : 'text-[#85858B] hover:text-[#EDEDED]'
                    }`}
                  >
                    <Music2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Music Directors</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('SINGERS')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all shrink-0 ${
                      activeTab === 'SINGERS'
                        ? 'bg-[#232325] text-[#EDEDED] shadow-sm'
                        : 'text-[#85858B] hover:text-[#EDEDED]'
                    }`}
                  >
                    <Mic2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Singers</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#85858B]" />
                  <input
                    type="text"
                    placeholder="Search artists, composers, movies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-[8px] bg-[#141415] border border-[rgba(237,237,237,0.08)] text-xs text-[#EDEDED] placeholder-[#85858B] focus:outline-none focus:border-[#F59E0B]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#85858B] hover:text-[#EDEDED]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllCurrentView}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium text-[#A1A1A6] hover:text-[#EDEDED] hover:bg-[#141415] transition-colors"
                  >
                    <CheckCheck className="w-3 h-3 text-[#F59E0B]" />
                    <span>Select All</span>
                  </button>
                  <button
                    onClick={handleClearAllCurrentView}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium text-[#85858B] hover:text-red-400 hover:bg-[#141415] transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between text-xs text-[#85858B] px-1">
                <span>
                  Showing {filteredArtists.length} artists in {selectedLanguages.join(', ')}
                </span>
                <span className="text-[#F59E0B] font-medium tabular-nums">
                  {selectedArtists.length} Artists Selected
                </span>
              </div>

              {/* Artist Card Grid with Real Online Artist Photos */}
              {isLoadingArtists ? (
                <div className="py-12 flex flex-col items-center justify-center text-[#85858B] space-y-2">
                  <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Loading artists catalog...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredArtists.map((artist) => {
                      const isSelected = selectedArtists.includes(artist.name);
                      return (
                        <button
                          key={artist.id}
                          onClick={() => toggleArtist(artist.name)}
                          className={`group relative flex flex-col items-center p-3 rounded-[12px] border text-center transition-all ${
                            isSelected
                              ? 'bg-[#19191B] border-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                              : 'bg-[#141415] border-[rgba(237,237,237,0.08)] hover:bg-[#19191B] hover:border-[rgba(237,237,237,0.15)]'
                          }`}
                        >
                          <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2.5 bg-[#232325] border border-[rgba(237,237,237,0.1)] shadow-inner">
                            <ArtworkImage
                              src={artist.imageUrl}
                              alt={artist.name}
                              fallbackLabel={artist.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#F59E0B] text-black flex items-center justify-center shadow-md">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-[#EDEDED] line-clamp-1 mb-0.5">
                            {artist.name}
                          </span>
                          <span className="text-[10px] text-[#F59E0B]/80 font-medium line-clamp-1 mb-0.5">
                            {artist.roleTitle || (artist.role === 'DIRECTOR' ? 'Music Director' : 'Playback Singer')}
                          </span>
                          {artist.languages && artist.languages.length > 0 && (
                            <span className="text-[9px] text-[#A1A1A6] line-clamp-1 mb-0.5">
                              {artist.languages.slice(0, 3).join(' • ')}
                            </span>
                          )}
                          <span className="text-[10px] text-[#85858B] line-clamp-1">
                            {artist.knownFor?.slice(0, 2).join(', ') || ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {allArtists.length > 16 && !searchQuery && (
                    <div className="pt-2 text-center">
                      <button
                        onClick={() => setViewAll(!viewAll)}
                        className="text-xs text-[#F59E0B] hover:underline font-medium"
                      >
                        {viewAll ? 'Show Less' : `View All (${allArtists.length}) Artists`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================= */
            /* STEP 3: PREFERRED GENRES & MOODS                         */
            /* ========================================================= */
            <div className="space-y-6">
              {/* Genres Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="text-sm font-semibold text-[#EDEDED]">Preferred Genres</h3>
                  </div>
                  <span className="text-xs text-[#85858B] tabular-nums font-mono">
                    {selectedGenres.length} Selected
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {AVAILABLE_GENRES.map((g) => {
                    const isSelected = selectedGenres.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGenre(g.id)}
                        className={`flex flex-col items-start p-3.5 rounded-[12px] text-left transition-all border ${
                          isSelected
                            ? 'bg-[#19191B] border-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                            : 'bg-[#141415] border-[rgba(237,237,237,0.08)] hover:bg-[#19191B] hover:border-[rgba(237,237,237,0.15)]'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[#EDEDED]">{g.name}</span>
                          {isSelected ? (
                            <div className="w-4 h-4 rounded-full bg-[#F59E0B] text-black flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-[rgba(237,237,237,0.2)]" />
                          )}
                        </div>
                        <span className="text-[10px] text-[#85858B] line-clamp-1">{g.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Moods Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="text-sm font-semibold text-[#EDEDED]">Listening Moods</h3>
                  </div>
                  <span className="text-xs text-[#85858B] tabular-nums font-mono">
                    {selectedMoods.length} Selected
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {AVAILABLE_MOODS.map((m) => {
                    const isSelected = selectedMoods.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMood(m.id)}
                        className={`flex flex-col items-start p-3.5 rounded-[12px] text-left transition-all border ${
                          isSelected
                            ? 'bg-[#19191B] border-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                            : 'bg-[#141415] border-[rgba(237,237,237,0.08)] hover:bg-[#19191B] hover:border-[rgba(237,237,237,0.15)]'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[#EDEDED]">{m.name}</span>
                          {isSelected ? (
                            <div className="w-4 h-4 rounded-full bg-[#F59E0B] text-black flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-[rgba(237,237,237,0.2)]" />
                          )}
                        </div>
                        <span className="text-[10px] text-[#85858B] line-clamp-1">{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-[rgba(237,237,237,0.08)] bg-[#141415]">
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-[#85858B] hover:text-[#EDEDED] transition-colors order-2 sm:order-1 text-center sm:text-left py-1"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-2 sm:gap-3 order-1 sm:order-2 justify-end flex-wrap sm:flex-nowrap w-full sm:w-auto">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-[8px] text-xs font-medium text-[#A1A1A6] hover:text-[#EDEDED] hover:bg-[#19191B] border border-[rgba(237,237,237,0.08)] transition-colors text-center"
              >
                Back to Languages
              </button>
            )}

            {step === 3 && (
              <button
                onClick={() => setStep(2)}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-[8px] text-xs font-medium text-[#A1A1A6] hover:text-[#EDEDED] hover:bg-[#19191B] border border-[rgba(237,237,237,0.08)] transition-colors text-center"
              >
                Back to Artists
              </button>
            )}

            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={selectedLanguages.length === 0}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-[8px] text-xs font-semibold bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90 disabled:opacity-50 transition-all shadow-sm"
              >
                <span>Continue to Artists</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : step === 2 ? (
              <button
                onClick={() => setStep(3)}
                disabled={selectedArtists.length === 0}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-[8px] text-xs font-semibold bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90 disabled:opacity-50 transition-all shadow-sm"
              >
                <span>Continue to Genres</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-[8px] text-xs font-semibold bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90 transition-all shadow-sm"
              >
                <span>Save Preferences</span>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
