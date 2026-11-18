import { RecommendationEngineService } from '../services/recommendation/recommendationEngine.service';
import { validateSongLanguageMetadata, normalizeLanguageToken } from '../utils/languageEligibility';

function runAudit() {
  const catalog = RecommendationEngineService.getMasterCatalog();
  console.log(`[Language Audit] Total catalog tracks: ${catalog.length}`);

  const languageBreakdown: Record<string, number> = {};
  const invalidTracks: Array<{ id: string; title: string; language: any; reason?: string }> = [];

  for (const track of catalog) {
    const val = validateSongLanguageMetadata(track);
    if (!val.valid) {
      invalidTracks.push({
        id: track.id,
        title: track.title,
        language: track.language,
        reason: val.reason
      });
    } else {
      const canonical = normalizeLanguageToken(track.language);
      languageBreakdown[canonical] = (languageBreakdown[canonical] || 0) + 1;
    }
  }

  console.log('[Language Audit] Canonical Language Distribution:');
  console.table(languageBreakdown);

  console.log(`[Language Audit] Invalid or Missing Language Tracks: ${invalidTracks.length}`);
  if (invalidTracks.length > 0) {
    console.table(invalidTracks);
  } else {
    console.log('[Language Audit] 100% of master catalog tracks have verified canonical language metadata!');
  }
}

runAudit();
