import { scoreDSTMediaCandidate } from "./dstRelevanceGate";
import { discoverYouTubeCandidates } from "./youtubeDiscovery";
import type { ScoredDSTMediaCandidate } from "./types";

const DEFAULT_QUERY = "simulation theory determinism information physics";

export type MediaScoutDryRunResult = {
  mode: "dry_run";
  query: string;
  count: number;
  candidates: ScoredDSTMediaCandidate[];
};

export async function runMediaScoutDryRun(query = DEFAULT_QUERY, limit = 10): Promise<MediaScoutDryRunResult> {
  const normalizedQuery = query.trim() || DEFAULT_QUERY;
  const maxResults = Math.max(1, Math.min(limit, 25));
  const candidates = await discoverYouTubeCandidates({ query: normalizedQuery, maxResults });
  const scored = candidates
    .map((candidate) => ({ ...candidate, score: scoreDSTMediaCandidate(candidate) }))
    .sort((a, b) => {
      const scoreDiff = b.score.total - a.score.total;
      return scoreDiff !== 0 ? scoreDiff : a.videoId.localeCompare(b.videoId);
    });
  return {
    mode: "dry_run",
    query: normalizedQuery,
    count: scored.length,
    candidates: scored,
  };
}
