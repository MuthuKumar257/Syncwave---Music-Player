/**
 * Language Normalization & Strict Eligibility Checking for Mobile
 *
 * Guarantees zero cross-language leakage across Home, Discover, Recommendations,
 * Queues, and Player components.
 */

const LANGUAGE_CANONICAL_MAP: Record<string, string> = {
  // Tamil
  tamil: 'Tamil',
  ta: 'Tamil',
  tam: 'Tamil',
  'தமிழ்': 'Tamil',

  // Telugu
  telugu: 'Telugu',
  te: 'Telugu',
  tel: 'Telugu',
  'తెలుగు': 'Telugu',

  // Hindi
  hindi: 'Hindi',
  hi: 'Hindi',
  hin: 'Hindi',
  'हिन्दी': 'Hindi',
  'हिंदी': 'Hindi',

  // Malayalam
  malayalam: 'Malayalam',
  ml: 'Malayalam',
  mal: 'Malayalam',
  'മലയാളം': 'Malayalam',

  // Kannada
  kannada: 'Kannada',
  kn: 'Kannada',
  kan: 'Kannada',
  'ಕನ್ನಡ': 'Kannada',

  // Punjabi
  punjabi: 'Punjabi',
  pa: 'Punjabi',
  pan: 'Punjabi',
  'ਪੰਜਾਬੀ': 'Punjabi',

  // Marathi
  marathi: 'Marathi',
  mr: 'Marathi',
  mar: 'Marathi',
  'मराठी': 'Marathi',

  // Bengali
  bengali: 'Bengali',
  bn: 'Bengali',
  ben: 'Bengali',
  'বাংলা': 'Bengali',

  // English
  english: 'English',
  en: 'English',
  eng: 'English'
};

/**
 * Normalizes any language string into its canonical title-case representation (e.g. 'ta' -> 'Tamil').
 */
export function normalizeMobileLanguage(lang?: string | null): string {
  if (!lang || typeof lang !== 'string') return '';
  const cleaned = lang.trim().toLowerCase();
  if (!cleaned) return '';

  if (LANGUAGE_CANONICAL_MAP[cleaned]) {
    return LANGUAGE_CANONICAL_MAP[cleaned];
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Normalizes an array of language strings into a deduplicated list of canonical names.
 */
export function normalizeMobileLanguageList(langs?: (string | null | undefined)[]): string[] {
  if (!Array.isArray(langs) || langs.length === 0) return [];
  const set = new Set<string>();
  for (const item of langs) {
    const norm = normalizeMobileLanguage(item);
    if (norm) set.add(norm);
  }
  return Array.from(set);
}

/**
 * Extracts all canonical languages from a track object.
 */
export function extractTrackLanguages(track?: { language?: string | null; languages?: string[] | null } | null): string[] {
  if (!track) return [];
  const set = new Set<string>();

  if (track.language) {
    const norm = normalizeMobileLanguage(track.language);
    if (norm) set.add(norm);
  }

  if (Array.isArray(track.languages)) {
    for (const l of track.languages) {
      const norm = normalizeMobileLanguage(l);
      if (norm) set.add(norm);
    }
  }

  return Array.from(set);
}

/**
 * Strict language eligibility check:
 * 1. If userLanguages is empty, returns FALSE (no cross-language leakage allowed).
 * 2. If track has no valid language, returns FALSE.
 * 3. Returns TRUE only if at least one track language matches user languages.
 */
export function isTrackLanguageEligible(
  track: { language?: string | null; languages?: string[] | null } | null | undefined,
  userLanguages: (string | null | undefined)[]
): boolean {
  if (!track) return false;

  const normUserLangs = normalizeMobileLanguageList(userLanguages);
  if (normUserLangs.length === 0) return false;

  const trackLangs = extractTrackLanguages(track);
  if (trackLangs.length === 0) return false;

  const userLangSet = new Set(normUserLangs);
  return trackLangs.some((lang) => userLangSet.has(lang));
}

/**
 * Filter tracks by user's active language preferences or a specific language chip.
 * If specificFilter is provided and !== 'ALL', only tracks matching that language are kept.
 * If specificFilter is 'ALL' or omitted, tracks must match at least one of the userLanguages.
 */
export function filterTracksByLanguage<T extends { language?: string | null; languages?: string[] | null }>(
  tracks: T[],
  userLanguages: (string | null | undefined)[],
  specificFilter?: string
): T[] {
  if (!Array.isArray(tracks) || tracks.length === 0) return [];

  const normUserLangs = normalizeMobileLanguageList(userLanguages);

  // If specific filter selected (e.g. 'Tamil' or 'Hindi')
  if (specificFilter && specificFilter !== 'ALL') {
    const normFilter = normalizeMobileLanguage(specificFilter);
    return tracks.filter((t) => {
      const langs = extractTrackLanguages(t);
      return langs.includes(normFilter);
    });
  }

  // If filter is 'ALL', filter strictly by user's selected languages
  if (normUserLangs.length > 0) {
    const userLangSet = new Set(normUserLangs);
    return tracks.filter((t) => {
      const langs = extractTrackLanguages(t);
      return langs.some((l) => userLangSet.has(l));
    });
  }

  // If no languages chosen at all, return all tracks
  return tracks;
}
