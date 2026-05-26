export type DSTMediaVerdict = "PASS" | "WATCH" | "REJECT";

export type DSTMediaFailureCode =
  | "CLICKBAIT_ONLY"
  | "PURE_ENTERTAINMENT"
  | "NO_DST_BRIDGE"
  | "PSEUDOSCIENCE_WITHOUT_TESTABLE_CLAIMS"
  | "MARKET_IRRELEVANT"
  | "LOW_SIGNAL_RECYCLED_CONTENT"
  | "COPYRIGHT_OR_RIGHTS_RISK";

export type DSTMediaCandidate = {
  videoId: string;
  url: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  thumbnailUrl?: string;
  tags?: string[];
  viewCount?: number;
  likeCount?: number;
};

export type DSTMediaScore = {
  videoId: string;
  total: number;
  verdict: DSTMediaVerdict;
  scores: {
    deterministicPhysics: number;
    simulationTheory: number;
    informationTheory: number;
    consciousnessObserver: number;
    marketOrPredictionUtility: number;
    sourceCredibility: number;
    thumbnailSignal: number;
    novelty: number;
  };
  matchedTerms: string[];
  failureCodes: DSTMediaFailureCode[];
  reason: string;
};

export type ScoredDSTMediaCandidate = DSTMediaCandidate & {
  score: DSTMediaScore;
};
