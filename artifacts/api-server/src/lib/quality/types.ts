/**
 * DST Canonical Data-Quality Model
 *
 * Every computed signal carries a DataQualityReport. Individual fetched values
 * carry a DataProvenance describing where they came from, when, and how fresh
 * they are. Quality flags surface specific problems. The system defaults to WAIT
 * whenever data quality falls below the minimum acceptable threshold.
 */

// ── Sources ──────────────────────────────────────────────────────────────────

export type DataSource =
  | "DEFILLAMA_COINS"
  | "DEFILLAMA_DERIVATIVES"
  | "DEFILLAMA_TVL"
  | "PYTH_HERMES"
  | "PYTH_BENCHMARKS"
  | "OKX_PERPS"
  | "SYNTHETIC"
  | "DERIVED"
  | "FALLBACK_ZERO"
  | "FALLBACK_ESTIMATED";

// ── Quality flags ─────────────────────────────────────────────────────────────

export type QualityFlag =
  | "STALE_PRICE"
  | "STALE_HISTORY"
  | "MISSING_PRICE"
  | "MISSING_HISTORY"
  | "INSUFFICIENT_HISTORY"
  | "FALLBACK_PRICE_USED"
  | "SYNTHETIC_OI"
  | "SYNTHETIC_FUNDING"
  | "LOW_CONFIDENCE"
  | "CONFLICTING_PRICES"
  | "PYTH_DIVERGENCE"
  | "PYTH_UNAVAILABLE"
  | "PYTH_STALE"
  | "PYTH_CONFIDENCE_WIDE"
  | "PYTH_BENCHMARKS_UNAVAILABLE"
  | "TVL_MISSING"
  | "VOLUME_MISSING"
  | "DATA_UNAVAILABLE";

// ── Provenance ────────────────────────────────────────────────────────────────

export interface DataProvenance {
  source: DataSource;
  fetchedAt: string;
  dataTimestamp?: string | null;
  ageMs: number;
  isStale: boolean;
  isFallback: boolean;
  stallThresholdMs: number;
}

export function makeProvenance(
  source: DataSource,
  fetchedAt: Date,
  dataTimestampMs: number | null,
  stallThresholdMs: number,
  isFallback = false,
): DataProvenance {
  const ageMs = dataTimestampMs != null ? Date.now() - dataTimestampMs : Date.now() - fetchedAt.getTime();
  return {
    source,
    fetchedAt: fetchedAt.toISOString(),
    dataTimestamp: dataTimestampMs != null ? new Date(dataTimestampMs).toISOString() : null,
    ageMs,
    isStale: ageMs > stallThresholdMs,
    isFallback,
    stallThresholdMs,
  };
}

// ── Pyth verifier (upgraded) ──────────────────────────────────────────────────

export type PythVerifierVerdict = "CONFIRMS" | "DIVERGES" | "UNAVAILABLE" | "SKIPPED";

export interface PythVerifierResult {
  scaffolded: true;
  checked: boolean;
  pythPrice: number | null;
  defillamaPrice: number | null;
  priceDivergencePct: number | null;
  confidenceRatio: number | null;
  confidenceStatus: "HIGH" | "MEDIUM" | "LOW" | null;
  fresh: boolean | null;
  verdict: PythVerifierVerdict;
  verdictDetail: string;
  influencesProcessVerdict: boolean;
  provenance: DataProvenance | null;
}

export function makePythVerifierUnavailable(): PythVerifierResult {
  return {
    scaffolded: true,
    checked: false,
    pythPrice: null,
    defillamaPrice: null,
    priceDivergencePct: null,
    confidenceRatio: null,
    confidenceStatus: null,
    fresh: null,
    verdict: "UNAVAILABLE",
    verdictDetail: "Pyth fetch failed or returned no data.",
    influencesProcessVerdict: false,
    provenance: null,
  };
}

export function makePythVerifierSkipped(): PythVerifierResult {
  return {
    scaffolded: true,
    checked: false,
    pythPrice: null,
    defillamaPrice: null,
    priceDivergencePct: null,
    confidenceRatio: null,
    confidenceStatus: null,
    fresh: null,
    verdict: "SKIPPED",
    verdictDetail: "Pyth confidence filter is disabled in Hermes constraints.",
    influencesProcessVerdict: false,
    provenance: null,
  };
}

// ── Data Quality Report ───────────────────────────────────────────────────────

export type DataQualityGrade = "GOOD" | "DEGRADED" | "POOR" | "CRITICAL";

export interface DataQualityReport {
  grade: DataQualityGrade;
  flags: QualityFlag[];
  priceProvenance: DataProvenance;
  historyProvenance: DataProvenance;
  oiProvenance: DataProvenance;
  tvlProvenance: DataProvenance | null;
  pythVerifier: PythVerifierResult;
  historicalBarCount: number;
  minHistoricalBarsRequired: number;
  dataReadyForSignal: boolean;
  degradedConfidence: boolean;
  forcedWaitReason: string | null;
  computedAt: string;
}

export function computeDataQualityGrade(flags: QualityFlag[]): DataQualityGrade {
  if (flags.includes("MISSING_PRICE") || flags.includes("DATA_UNAVAILABLE")) return "CRITICAL";
  if (
    flags.includes("STALE_PRICE") ||
    flags.includes("FALLBACK_PRICE_USED") ||
    flags.includes("INSUFFICIENT_HISTORY") ||
    flags.includes("PYTH_STALE")
  ) return "POOR";
  if (
    flags.includes("CONFLICTING_PRICES") ||
    flags.includes("PYTH_DIVERGENCE") ||
    flags.includes("PYTH_CONFIDENCE_WIDE") ||
    flags.includes("STALE_HISTORY") ||
    flags.includes("LOW_CONFIDENCE")
  ) return "DEGRADED";
  return "GOOD";
}
