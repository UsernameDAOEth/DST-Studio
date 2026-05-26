import type { DSTMediaCandidate, DSTMediaFailureCode, DSTMediaScore } from "./types";

type Bucket =
  | "deterministicPhysics"
  | "simulationTheory"
  | "informationTheory"
  | "consciousnessObserver"
  | "marketOrPredictionUtility"
  | "sourceCredibility"
  | "thumbnailSignal"
  | "novelty";

type WeightedTerm = {
  term: string;
  weight: number;
};

const BUCKET_CAPS: Record<Bucket, number> = {
  deterministicPhysics: 20,
  simulationTheory: 20,
  informationTheory: 15,
  consciousnessObserver: 15,
  marketOrPredictionUtility: 10,
  sourceCredibility: 10,
  thumbnailSignal: 5,
  novelty: 5,
};

const TERM_BUCKETS: Record<Exclude<Bucket, "sourceCredibility" | "thumbnailSignal" | "novelty">, WeightedTerm[]> = {
  deterministicPhysics: [
    { term: "deterministic", weight: 6 },
    { term: "determinism", weight: 6 },
    { term: "causal", weight: 4 },
    { term: "causality", weight: 4 },
    { term: "block universe", weight: 7 },
    { term: "physical law", weight: 5 },
    { term: "physics", weight: 3 },
    { term: "constraint", weight: 5 },
    { term: "invariant", weight: 5 },
    { term: "emergence", weight: 4 },
    { term: "quantum foundations", weight: 5 },
    { term: "uncertainty is frame local", weight: 8 },
  ],
  simulationTheory: [
    { term: "simulation theory", weight: 8 },
    { term: "simulation hypothesis", weight: 8 },
    { term: "simulated reality", weight: 6 },
    { term: "digital physics", weight: 7 },
    { term: "computational universe", weight: 7 },
    { term: "cellular automata", weight: 6 },
    { term: "reality is code", weight: 5 },
    { term: "the matrix", weight: 2 },
    { term: "matrix", weight: 1 },
  ],
  informationTheory: [
    { term: "information theory", weight: 7 },
    { term: "shannon", weight: 4 },
    { term: "entropy", weight: 4 },
    { term: "bits", weight: 3 },
    { term: "computation", weight: 4 },
    { term: "algorithmic", weight: 4 },
    { term: "encoding", weight: 3 },
    { term: "compression", weight: 3 },
    { term: "transformation", weight: 3 },
    { term: "information persists", weight: 6 },
  ],
  consciousnessObserver: [
    { term: "observer", weight: 5 },
    { term: "observer problem", weight: 6 },
    { term: "measurement problem", weight: 6 },
    { term: "consciousness", weight: 5 },
    { term: "awareness", weight: 3 },
    { term: "perception", weight: 3 },
    { term: "frame of reference", weight: 4 },
    { term: "frame local", weight: 4 },
    { term: "interpretation", weight: 3 },
    { term: "uncertainty", weight: 3 },
  ],
  marketOrPredictionUtility: [
    { term: "prediction market", weight: 5 },
    { term: "prediction", weight: 3 },
    { term: "probability", weight: 4 },
    { term: "forecast", weight: 3 },
    { term: "bayesian", weight: 4 },
    { term: "expected value", weight: 3 },
    { term: "markets", weight: 2 },
    { term: "risk", weight: 2 },
    { term: "uncertainty pricing", weight: 4 },
  ],
};

const LONG_FORM_TERMS = ["long-form", "podcast", "interview", "lecture", "seminar", "conversation", "episode", "debate", "keynote"];
const CREDIBILITY_TERMS = [
  "university",
  "institute",
  "academy",
  "professor",
  "physicist",
  "researcher",
  "scientist",
  "phd",
  "dr ",
  "lecture",
  "seminar",
  "podcast",
  "interview",
];
const CLICKBAIT_TERMS = ["shocking", "will blow your mind", "you won't believe", "insane", "secret proof", "they lied", "exposed"];
const ENTERTAINMENT_TERMS = [
  "music video",
  "trailer",
  "gameplay",
  "prank",
  "reaction",
  "funny",
  "meme",
  "movie scene",
  "comedy",
  "highlights",
];
const PSEUDOSCIENCE_TERMS = ["flat earth", "alien disclosure", "ancient aliens", "chakra", "numerology", "manifestation frequency"];
const TESTABLE_TERMS = ["experiment", "evidence", "model", "testable", "prediction", "measurement", "data"];
const RECYCLED_TERMS = ["compilation", "reupload", "re-upload", "clips", "shorts", "tiktok", "best moments"];
const RIGHTS_RISK_TERMS = ["full movie", "leaked", "copyright", "pirated", "cam rip", "unauthorized upload"];
const DST_LAW_TERMS = [
  "constraint",
  "appearance",
  "information persists",
  "transformation",
  "layered description",
  "frame-local",
  "frame local",
  "cross-framework",
  "invariant",
  "theory",
  "uncertainty",
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseIsoDurationSeconds(duration: string): number {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return 0;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function scoreTerms(text: string, terms: WeightedTerm[], cap: number): { score: number; matches: string[] } {
  const matches: string[] = [];
  let total = 0;
  for (const { term, weight } of terms) {
    if (text.includes(term)) {
      matches.push(term);
      total += weight;
    }
  }
  return { score: Math.min(total, cap), matches };
}

function scoreCredibility(candidate: DSTMediaCandidate, text: string): number {
  let score = 0;
  const durationSeconds = parseIsoDurationSeconds(candidate.duration);
  if (durationSeconds >= 20 * 60) score += 3;
  if (durationSeconds >= 45 * 60) score += 2;
  if (hasAny(text, CREDIBILITY_TERMS)) score += 3;
  if ((candidate.viewCount ?? 0) >= 25_000) score += 1;
  if ((candidate.likeCount ?? 0) >= 500) score += 1;
  return Math.min(score, BUCKET_CAPS.sourceCredibility);
}

function scoreThumbnailSignal(candidate: DSTMediaCandidate, titleText: string): number {
  let score = candidate.thumbnailUrl ? 1 : 0;
  if (hasAny(titleText, LONG_FORM_TERMS)) score += 2;
  if (titleText.length >= 35 && titleText.length <= 120) score += 1;
  if (!hasAny(titleText, CLICKBAIT_TERMS)) score += 1;
  return Math.min(score, BUCKET_CAPS.thumbnailSignal);
}

function scoreNovelty(text: string): number {
  let score = 3;
  if (hasAny(text, ["new research", "original", "deep dive", "framework", "model"])) score += 2;
  if (hasAny(text, RECYCLED_TERMS)) score -= 3;
  return Math.max(0, Math.min(score, BUCKET_CAPS.novelty));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function buildReason(score: DSTMediaScore): string {
  const strongBuckets = Object.entries(score.scores)
    .filter(([key, value]) => value >= 0.65 * BUCKET_CAPS[key as Bucket])
    .map(([key]) => key);
  const bridge = score.matchedTerms.slice(0, 5).join(", ");
  const failure = score.failureCodes.length ? ` Hard failures: ${score.failureCodes.join(", ")}.` : "";
  const bucketText = strongBuckets.length ? `Strongest buckets: ${strongBuckets.join(", ")}.` : "No dominant DST bucket.";
  return `${score.verdict} at ${score.total}/100. ${bucketText} Matched terms: ${bridge || "none"}.${failure}`;
}

function collectFailureCodes(text: string, bucketScores: DSTMediaScore["scores"]): DSTMediaFailureCode[] {
  const codes: DSTMediaFailureCode[] = [];
  const dstBridge =
    bucketScores.deterministicPhysics +
    bucketScores.simulationTheory +
    bucketScores.informationTheory +
    bucketScores.consciousnessObserver;
  const marketOnly = bucketScores.marketOrPredictionUtility > 0 && dstBridge < 12;
  const technicalSignal = dstBridge + bucketScores.marketOrPredictionUtility;

  if (hasAny(text, RIGHTS_RISK_TERMS)) codes.push("COPYRIGHT_OR_RIGHTS_RISK");
  if (hasAny(text, ENTERTAINMENT_TERMS) && technicalSignal < 18) codes.push("PURE_ENTERTAINMENT");
  if (hasAny(text, CLICKBAIT_TERMS) && technicalSignal < 18) codes.push("CLICKBAIT_ONLY");
  if (hasAny(text, PSEUDOSCIENCE_TERMS) && !hasAny(text, TESTABLE_TERMS)) codes.push("PSEUDOSCIENCE_WITHOUT_TESTABLE_CLAIMS");
  if (marketOnly) codes.push("MARKET_IRRELEVANT");
  if (technicalSignal < 10 && !marketOnly) codes.push("NO_DST_BRIDGE");
  if (hasAny(text, RECYCLED_TERMS) && technicalSignal < 30) codes.push("LOW_SIGNAL_RECYCLED_CONTENT");

  return uniqueSorted(codes) as DSTMediaFailureCode[];
}

function verdictFor(total: number, failureCodes: DSTMediaFailureCode[]): DSTMediaScore["verdict"] {
  if (failureCodes.length > 0) return "REJECT";
  if (total >= 75) return "PASS";
  if (total >= 55) return "WATCH";
  return "REJECT";
}

export function scoreDSTMediaCandidate(candidate: DSTMediaCandidate): DSTMediaScore {
  const titleText = normalizeText(candidate.title);
  const text = normalizeText(
    [
      candidate.title,
      candidate.description,
      candidate.channelTitle,
      candidate.tags?.join(" ") ?? "",
      DST_LAW_TERMS.filter((term) => normalizeText(candidate.description).includes(term)).join(" "),
    ].join(" "),
  );

  const matchedTerms: string[] = [];
  const deterministicPhysics = scoreTerms(text, TERM_BUCKETS.deterministicPhysics, BUCKET_CAPS.deterministicPhysics);
  const simulationTheory = scoreTerms(text, TERM_BUCKETS.simulationTheory, BUCKET_CAPS.simulationTheory);
  const informationTheory = scoreTerms(text, TERM_BUCKETS.informationTheory, BUCKET_CAPS.informationTheory);
  const consciousnessObserver = scoreTerms(text, TERM_BUCKETS.consciousnessObserver, BUCKET_CAPS.consciousnessObserver);
  const marketOrPredictionUtility = scoreTerms(text, TERM_BUCKETS.marketOrPredictionUtility, BUCKET_CAPS.marketOrPredictionUtility);

  matchedTerms.push(
    ...deterministicPhysics.matches,
    ...simulationTheory.matches,
    ...informationTheory.matches,
    ...consciousnessObserver.matches,
    ...marketOrPredictionUtility.matches,
  );

  const scores = {
    deterministicPhysics: deterministicPhysics.score,
    simulationTheory: simulationTheory.score,
    informationTheory: informationTheory.score,
    consciousnessObserver: consciousnessObserver.score,
    marketOrPredictionUtility: marketOrPredictionUtility.score,
    sourceCredibility: scoreCredibility(candidate, text),
    thumbnailSignal: scoreThumbnailSignal(candidate, titleText),
    novelty: scoreNovelty(text),
  };

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const failureCodes = collectFailureCodes(text, scores);
  const score: DSTMediaScore = {
    videoId: candidate.videoId,
    total,
    verdict: verdictFor(total, failureCodes),
    scores,
    matchedTerms: uniqueSorted(matchedTerms),
    failureCodes,
    reason: "",
  };
  return { ...score, reason: buildReason(score) };
}
