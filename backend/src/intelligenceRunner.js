import * as ai from "./openaiService.js";
import { PDF_INTELLIGENCE_KEYS } from "./pdfExport.js";

export { PDF_INTELLIGENCE_KEYS };

/**
 * Run one intelligence analysis (same logic as POST /api/analyze/:key).
 * @param {string} key
 * @param {{ combinedSummary: string, competitorSummaries: unknown[] }} bundle
 * @param {Record<string, unknown> | undefined} founderPreferences
 */
export async function computeIntelligenceResult(
  key,
  bundle,
  founderPreferences
) {
  const { combinedSummary, competitorSummaries } = bundle;
  if (!combinedSummary.trim()) {
    throw new Error("Profile has no combined summary.");
  }

  const competitorsOnlyForComparison =
    key === "comparison" ? competitorSummaries : [];

  switch (key) {
    case "comparison":
      return await ai.comparisonAndBrand({
        combinedSummary,
        competitorSummaries,
      });
    case "roast":
      return await ai.roastStartup({
        combinedSummary,
        competitorSummaries: competitorsOnlyForComparison,
      });
    case "jobs":
      return await ai.jobsFromCompetitors({
        combinedSummary,
        competitorSummaries: competitorsOnlyForComparison,
      });
    case "collaborations":
      return await ai.collaborationOpportunities({
        combinedSummary,
        competitorSummaries: competitorsOnlyForComparison,
      });
    case "extras":
      return await ai.uniqueExtras({
        combinedSummary,
        competitorSummaries: competitorsOnlyForComparison,
      });
    case "uniqueness":
      return await ai.uniqueEdgeBlueprint({
        combinedSummary,
        competitorSummaries: competitorsOnlyForComparison,
      });
    case "vcs":
      return await ai.potentialVCsWithMatch({
        combinedSummary,
        competitorSummaries: competitorsOnlyForComparison,
        founderPreferences: founderPreferences || undefined,
      });
    case "gaps":
      return await ai.strategicGapsAnalysis({
        combinedSummary,
        competitorSummaries: competitorsOnlyForComparison,
      });
    case "ideas":
      return await ai.startupIdeasTailored({
        combinedSummary,
        competitorSummaries: competitorsOnlyForComparison,
      });
    default:
      throw new Error(`Unknown analysis key: ${key}`);
  }
}

/**
 * Run every intelligence panel in PDF order and persist snapshots.
 * @returns {{ key: string, ok: boolean, error?: string }[]}
 */
export async function runAllIntelligenceAnalyses(
  profileId,
  bundle,
  founderPreferences,
  saveSnapshot
) {
  const results = [];
  for (const key of PDF_INTELLIGENCE_KEYS) {
    try {
      const result = await computeIntelligenceResult(
        key,
        bundle,
        founderPreferences
      );
      saveSnapshot(profileId, key, result);
      results.push({ key, ok: true });
    } catch (e) {
      const errPayload = {
        _analysis_error: true,
        analysis_key: key,
        message: e.message || String(e),
      };
      saveSnapshot(profileId, key, errPayload);
      results.push({ key, ok: false, error: errPayload.message });
    }
  }
  return results;
}
