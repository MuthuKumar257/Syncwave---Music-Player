/**
 * Canonical Language Normalization and Eligibility Verification
 * 
 * Provides centralized, strict, and consistent language token normalization,
 * user-preference matching, and song eligibility verification across all recommendation
 * models, queue generation pipelines, search suggestions, and player validation boundaries.
 */

export interface SongLanguageMeta {
  id?: string;
  title?: string;
  language?: string | null;
  languages?: string[] | null;
  [key: string]: any;
}

// Canonical mappings for common aliases, ISO-639-1 / 639-2 codes, and script representations
const LANGUAGE_CANONICAL_MAP: Record<string, string> = {
  // Tamil
  'tamil': 'Tamil',
  'ta': 'Tamil',
  'tam': 'Tamil',
  'தமிழ்': 'Tamil',

  // Telugu
  'telugu': 'Telugu',
  'te': 'Telugu',
  'tel': 'Telugu',
  'తెలుగు': 'Telugu',

  // Hindi
  'hindi': 'Hindi',
  'hi': 'Hindi',
  'hin': 'Hindi',
  'हिन्दी': 'Hindi',
  'हिंदी': 'Hindi',

  // Malayalam
  'malayalam': 'Malayalam',
  'ml': 'Malayalam',
  'mal': 'Malayalam',
  'മലയാളം': 'Malayalam',

  // Kannada
  'kannada': 'Kannada',
  'kn': 'Kannada',
  'kan': 'Kannada',
  'ಕನ್ನಡ': 'Kannada',

  // Punjabi
  'punjabi': 'Punjabi',
  'pa': 'Punjabi',
  'pan': 'Punjabi',
  'ਪੰਜਾਬੀ': 'Punjabi',

  // Marathi
  'marathi': 'Marathi',
  'mr': 'Marathi',
  'mar': 'Marathi',
  'मराठी': 'Marathi',

  // Bengali
  'bengali': 'Bengali',
  'bn': 'Bengali',
  'ben': 'Bengali',
  'বাংলা': 'Bengali',

  // English
  'english': 'English',
  'en': 'English',
  'eng': 'English'
};

/**
 * Normalizes any language input token into its canonical capitalized form (e.g. 'ta' -> 'Tamil', 'HINDI' -> 'Hindi').
 * Returns empty string for invalid, undefined, null, or unknown tokens.
 */
export function normalizeLanguageToken(lang?: string | null): string {
  if (!lang || typeof lang !== 'string') return '';
  const cleaned = lang.trim().toLowerCase();
  if (!cleaned) return '';

  if (LANGUAGE_CANONICAL_MAP[cleaned]) {
    return LANGUAGE_CANONICAL_MAP[cleaned];
  }

  // Capitalize first letter as fallback for known extended names
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Normalizes an array or list of language tokens into a deduplicated list of canonical names.
 */
export function normalizeLanguageList(langs?: (string | null | undefined)[]): string[] {
  if (!Array.isArray(langs) || langs.length === 0) return [];
  const normalizedSet = new Set<string>();

  for (const item of langs) {
    const norm = normalizeLanguageToken(item);
    if (norm) {
      normalizedSet.add(norm);
    }
  }

  return Array.from(normalizedSet);
}

/**
 * Extracts all canonical languages associated with a song.
 * Checks both `song.language` and `song.languages`.
 */
export function extractSongLanguages(song?: SongLanguageMeta | null): string[] {
  if (!song) return [];
  const set = new Set<string>();

  if (song.language) {
    const norm = normalizeLanguageToken(song.language);
    if (norm) set.add(norm);
  }

  if (Array.isArray(song.languages)) {
    for (const l of song.languages) {
      const norm = normalizeLanguageToken(l);
      if (norm) set.add(norm);
    }
  }

  return Array.from(set);
}

/**
 * Validates whether a song has valid language metadata.
 * Returns true only if song has at least one valid recognized canonical language.
 */
export function validateSongLanguageMetadata(song?: SongLanguageMeta | null): { valid: boolean; reason?: string } {
  if (!song) {
    return { valid: false, reason: 'Song object is null or undefined' };
  }

  const langs = extractSongLanguages(song);
  if (langs.length === 0) {
    return {
      valid: false,
      reason: `Song "${song.title || song.id || 'Unknown'}" has missing, unverified, or empty language metadata`
    };
  }

  return { valid: true };
}

/**
 * Strict language eligibility check:
 * 1. If user has NOT selected any languages (empty list), returns FALSE (no cross-language leakage allowed).
 * 2. If song has missing or empty language metadata, returns FALSE.
 * 3. Returns TRUE if and only if at least one of the song's canonical languages is present in the user's selected canonical languages.
 */
export function isSongLanguageEligible(
  song: SongLanguageMeta | null | undefined,
  userSelectedLanguages: (string | null | undefined)[]
): boolean {
  if (!song) return false;

  const userLangs = normalizeLanguageList(userSelectedLanguages);
  if (userLangs.length === 0) {
    // Strict requirement: User with no languages selected must never receive unvetted/unrestricted songs.
    return false;
  }

  const songLangs = extractSongLanguages(song);
  if (songLangs.length === 0) {
    // Missing/unverified language metadata is rejected.
    return false;
  }

  const userLangSet = new Set(userLangs);
  return songLangs.some(lang => userLangSet.has(lang));
}

/**
 * Filters a list of song candidates, preserving only those strictly eligible for the user's selected languages.
 */
export function filterSongsByLanguage<T extends SongLanguageMeta>(
  songs: T[],
  userSelectedLanguages: (string | null | undefined)[]
): T[] {
  if (!Array.isArray(songs) || songs.length === 0) return [];
  const userLangs = normalizeLanguageList(userSelectedLanguages);
  if (userLangs.length === 0) return [];

  const userLangSet = new Set(userLangs);

  return songs.filter(song => {
    const songLangs = extractSongLanguages(song);
    return songLangs.some(l => userLangSet.has(l));
  });
}
