import { logger } from "../logger";
import {
  getCurrentPricesWithProvenance,
  getHistoricalPricesWithProvenance,
  getTvlForAssetWithProvenance,
  getGlobalDerivativeData,
  getMarketCapFromPrices,
  ASSET_MAP,
  MIN_HISTORY_BARS,
  PRICE_STALE_THRESHOLD_MS,
  type HistoricalPrice,
} from "./defillamaClient";
import { getHistorical15mWithProvenance, MIN_HISTORY_BARS_15M } from "../pyth/benchmarksClient";

function minHistoryBarsFor(timeframe: string): number {
  return timeframe === "15m" ? MIN_HISTORY_BARS_15M : MIN_HISTORY_BARS;
}

function lateEntryMultiplierFor(timeframe: string, base: number): number {
  // 15m bars move faster relative to ATR — tighten late-entry detection
  // so an entry already 1×ATR beyond ema9 trips ENTRY_TOO_LATE.
  return timeframe === "15m" ? Math.min(1.0, base) : base;
}
import { lastEma, rsi, macd, atr } from "./indicators";
import { normalizeInputs, hashPacket } from "./normalization";
import { runFastPathVerification, type VerificationReport } from "./verification";
import { getConstraints } from "../hermes/constraints";
import { fetchPythSnapshot, type PythSnapshot } from "../pyth/pythClient";
import { fetchPerpsSnapshot } from "./perpsClient";
import {
  type DataQualityReport,
  type QualityFlag,
  type PythVerifierResult,
  makeProvenance,
  computeDataQualityGrade,
  makePythVerifierUnavailable,
  makePythVerifierSkipped,
} from "../quality/types";

export type Direction = "LONG" | "SHORT" | "WAIT";
export type Verdict = "PASS" | "FAIL" | "WAIT";
export type Regime = "BULL" | "BEAR" | "RANGING" | "UNDEFINED";
export type DominantSide = "LONG" | "SHORT" | "NEUTRAL";
export type CheckResult = "PASS" | "FAIL" | "WARN" | "SKIP";

export type ProcessVerdict = "APPROVED" | "REJECTED" | "DEGRADED";
export type LogicAdmissibility = "ADMISSIBLE" | "INADMISSIBLE" | "CONDITIONAL";
export type SetupFamily = "TREND_CONTINUATION_LONG" | "TREND_CONTINUATION_SHORT" | "RANGE_LONG" | "RANGE_SHORT" | "COUNTER_TREND_SHORT_EXHAUSTION" | "NO_SETUP";
export type EntryQuality = "OPTIMAL" | "ACCEPTABLE" | "LATE" | "INVALID";
export type NarrativeRisk = "LOW" | "MEDIUM" | "HIGH";
export type ProcessQualityGrade = "A" | "B" | "C" | "D" | "F";

export type RejectionCode =
  | "NO_REGIME"
  | "ENTRY_TOO_LATE"
  | "STOP_INVALID"
  | "TARGET_UNREALISTIC"
  | "NARRATIVE_HEAVY"
  | "CONFLICTING_SIGNALS"
  | "CROWDING_TOO_HIGH"
  | "NO_INVALIDATION"
  | "RR_BELOW_THRESHOLD"
  | "CONFIDENCE_STRUCTURE_MISMATCH"
  | "UNDEFINED_REGIME"
  | "RANGE_SECONDARY"
  | "DATA_UNAVAILABLE"
  | "STALE_PRICE"
  | "INSUFFICIENT_HISTORY"
  | "FALLBACK_PRICE_USED"
  | "PART_WHOLE_ERROR"
  | "NO_DIRECTIONAL_TRIGGER"
  | "INDICATOR_DEGENERATE";

export interface PreTradeChecklist {
  thesis: string;
  regimeConfirmed: boolean;
  entryZoneDefined: boolean;
  invalidationDefined: boolean;
  targetDefined: boolean;
  reasonCodesPresent: boolean;
  rejectConditionsDefined: boolean;
  rrRatioAcceptable: boolean;
  checklistComplete: boolean;
  missingFields: string[];
}

export interface OutcomeTracking {
  scaffolded: true;
  entryFilled: null;
  exitPrice: null;
  pnlPct: null;
  outcome: null;
  processScore: null;
}

export interface MarketSnapshot {
  asset: string;
  price: number;
  priceChange24h: number;
  priceChangePct24h: number;
  volume24h: number;
  marketCap: number;
  totalValueLocked: number;
  defiLlamaSlug: string;
  updatedAt: string;
}

export interface TrendRegime {
  asset: string;
  regime: Regime;
  ema9: number;
  ema21: number;
  ema50: number;
  rsi: number;
  macdHistogram: number;
  atr: number;
  trendStrength: number;
}

export interface OIContext {
  asset: string;
  openInterest: number;
  oiChange24h: number;
  oiChangePct24h: number;
  fundingRate: number;
  longShortRatio: number;
  dominantSide: DominantSide;
  // Confidence label for the perp microstructure block. "ESTIMATED" means
  // every field above was synthesized from regime + price (not real exchange
  // data); audit checks that depend on these values must SKIP / abstain when
  // the confidence is ESTIMATED, otherwise synthetic correlated noise gets
  // treated as evidence and biases verdicts toward whatever the regime
  // already implied.
  dataConfidence: "REAL" | "ESTIMATED";
}

export interface AuditCheck {
  name: string;
  result: CheckResult;
  detail: string;
  weight: number;
}

export interface AuditReport {
  asset: string;
  verdict: Verdict;
  checks: AuditCheck[];
  summary: string;
  generatedAt: string;
}

export interface ComputedSignal {
  asset: string;
  timeframe: string;
  direction: Direction;
  confidence: number;
  verdictDjzs: Verdict;
  entryZoneLow: number;
  entryZoneHigh: number;
  targetZone: number;
  invalidationPrice: number;
  reasonCodes: string[];
  marketSnapshot: MarketSnapshot;
  trendRegime: TrendRegime;
  openInterestContext: OIContext;
  auditReport: AuditReport;
  computedAt: string;
  processVerdict: ProcessVerdict;
  logicAdmissibility: LogicAdmissibility;
  setupFamily: SetupFamily;
  entryQuality: EntryQuality;
  narrativeRisk: NarrativeRisk;
  rrRatio: number;
  thesis: string;
  whyTrade: string;
  rejectIf: string[];
  rejectionCodes: RejectionCode[];
  processQualityGrade: ProcessQualityGrade;
  preTradChecklist: PreTradeChecklist;
  outcomeTracking: OutcomeTracking;
  dataQuality: DataQualityReport;
  verificationReport: VerificationReport;
  packetHash: string;
  pythSnapshot: PythSnapshot | null;
}

// ── Pure helper functions (unchanged) ─────────────────────────────────────────

function deriveRegime(ema9: number, ema21: number, ema50: number, rsiVal: number): Regime {
  const bullish = ema9 > ema21 && ema21 > ema50 && rsiVal > 50;
  const bearish = ema9 < ema21 && ema21 < ema50 && rsiVal < 50;
  if (bullish) return "BULL";
  if (bearish) return "BEAR";
  return "RANGING";
}

function deriveSide(fundingRate: number, oiChangePct: number): DominantSide {
  if (fundingRate > 0.0002 && oiChangePct > 0) return "LONG";
  if (fundingRate < -0.0002 && oiChangePct < 0) return "SHORT";
  return "NEUTRAL";
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function buildAuditChecks(
  tr: TrendRegime,
  oi: OIContext,
  direction: Direction,
  prices: number[],
  pythSnapshot: PythSnapshot | null,
  defillamaPrice: number,
): AuditCheck[] {
  const checks: AuditCheck[] = [];

  const trendAligned = tr.regime === "BULL" && direction === "LONG" || tr.regime === "BEAR" && direction === "SHORT";
  checks.push({
    name: "TREND_ALIGNMENT",
    result: tr.regime === "RANGING" ? "WARN" : trendAligned ? "PASS" : "FAIL",
    detail: `Regime is ${tr.regime}; signal is ${direction}. ${trendAligned ? "Aligned." : "Misaligned."}`,
    weight: 0.25,
  });

  // Symmetric RSI acceptance windows (35-point bands mirrored across 50).
  // Prior asymmetry (LONG 40-75 vs SHORT 25-60) gave LONG a structurally
  // wider band so SHORT setups failed RSI_ZONE more often than LONG even at
  // identical extremity. SHORT now uses 25-60 mirrored to LONG's 40-75 by
  // width but anchored to the bear midpoint.
  const rsiOk = direction === "LONG"
    ? tr.rsi > 40 && tr.rsi < 75
    : direction === "SHORT"
    ? tr.rsi > 25 && tr.rsi < 60
    : true;
  checks.push({
    name: "RSI_ZONE",
    result: rsiOk ? "PASS" : "WARN",
    detail: `RSI ${tr.rsi.toFixed(1)} — ${rsiOk ? "acceptable range" : "extreme zone, caution"}`,
    weight: 0.15,
  });

  const macdAligned = direction === "LONG" ? tr.macdHistogram > 0 : direction === "SHORT" ? tr.macdHistogram < 0 : true;
  checks.push({
    name: "MACD_CONFIRM",
    result: macdAligned ? "PASS" : "FAIL",
    detail: `MACD histogram ${tr.macdHistogram.toFixed(4)} — ${macdAligned ? "confirms direction" : "diverges from signal"}`,
    weight: 0.2,
  });

  // OI_CONTEXT only contributes weight when the OI block is REAL data.
  // ESTIMATED OI is mathematically derived from regime + price, so letting
  // it grade the verdict creates a self-confirming loop where the audit
  // approves whatever the regime already implied. SKIP excludes this check
  // from the weighted score entirely.
  if (oi.dataConfidence === "ESTIMATED") {
    checks.push({
      name: "OI_CONTEXT",
      result: "SKIP",
      detail: `OI/funding are ESTIMATED (synthetic from regime+price). Skipping to avoid self-confirming evidence.`,
      weight: 0.2,
    });
  } else {
    const oiOk = direction === "LONG"
      ? oi.dominantSide !== "SHORT"
      : direction === "SHORT"
      ? oi.dominantSide !== "LONG"
      : true;
    checks.push({
      name: "OI_CONTEXT",
      result: oiOk ? "PASS" : "WARN",
      detail: `Dominant side: ${oi.dominantSide}. Funding rate: ${(oi.fundingRate * 100).toFixed(4)}%. Signal direction: ${direction}.`,
      weight: 0.2,
    });
  }

  const atrOk = tr.atr > 0;
  checks.push({
    name: "ATR_VALID",
    result: atrOk ? "PASS" : "SKIP",
    detail: atrOk ? `ATR ${tr.atr.toFixed(2)} — volatility regime active` : "Insufficient historical data for ATR",
    weight: 0.1,
  });

  const emaStack = tr.ema9 > 0 && tr.ema21 > 0 && tr.ema50 > 0;
  const emaOk = emaStack && (
    direction === "LONG"
      ? tr.ema9 > tr.ema21
      : direction === "SHORT"
      ? tr.ema9 < tr.ema21
      : true
  );
  checks.push({
    name: "EMA_STACK",
    result: !emaStack ? "SKIP" : emaOk ? "PASS" : "WARN",
    detail: emaStack
      ? `EMA9(${tr.ema9.toFixed(2)}) ${tr.ema9 > tr.ema21 ? ">" : "<"} EMA21(${tr.ema21.toFixed(2)})`
      : "Not enough data for EMA stack",
    weight: 0.1,
  });

  // ── PYTH_PRICE_CONTEXT — secondary market price verifier ──────────────────
  if (pythSnapshot === null) {
    checks.push({
      name: "PYTH_PRICE_CONTEXT",
      result: "SKIP",
      detail: "Pyth Hermes v2 price context unavailable. Secondary verification skipped.",
      weight: 0.1,
    });
  } else if (pythSnapshot.isStale) {
    checks.push({
      name: "PYTH_PRICE_CONTEXT",
      result: "WARN",
      detail: `Pyth price stale (${pythSnapshot.stalenessSec.toFixed(0)}s old). Last: $${pythSnapshot.price.toFixed(2)} [${pythSnapshot.symbol}].`,
      weight: 0.1,
    });
  } else if (pythSnapshot.isConfidenceWide) {
    const divergencePct = defillamaPrice > 0
      ? Math.abs(pythSnapshot.price - defillamaPrice) / defillamaPrice * 100
      : 0;
    checks.push({
      name: "PYTH_PRICE_CONTEXT",
      result: "WARN",
      detail: `Pyth confidence wide: ±${pythSnapshot.confidencePct.toFixed(3)}% of price. DefiLlama divergence: ${divergencePct.toFixed(3)}%.`,
      weight: 0.1,
    });
  } else {
    const divergencePct = defillamaPrice > 0
      ? Math.abs(pythSnapshot.price - defillamaPrice) / defillamaPrice * 100
      : 0;
    const diverges = divergencePct > 0.5;
    checks.push({
      name: "PYTH_PRICE_CONTEXT",
      result: diverges ? "FAIL" : "PASS",
      detail: diverges
        ? `Pyth $${pythSnapshot.price.toFixed(2)} diverges ${divergencePct.toFixed(3)}% from DefiLlama $${defillamaPrice.toFixed(2)} (>0.5% threshold).`
        : `Pyth $${pythSnapshot.price.toFixed(2)} confirms DefiLlama $${defillamaPrice.toFixed(2)} (divergence ${divergencePct.toFixed(3)}%). Confidence: ${pythSnapshot.confidenceStatus} (±${pythSnapshot.confidencePct.toFixed(3)}%).`,
      weight: 0.1,
    });
  }

  void prices;
  return checks;
}

function computeVerdict(checks: AuditCheck[]): { verdict: Verdict; summary: string } {
  let weightedScore = 0;
  let totalWeight = 0;
  let failCount = 0;

  for (const c of checks) {
    if (c.result === "SKIP") continue;
    totalWeight += c.weight;
    if (c.result === "PASS") weightedScore += c.weight;
    else if (c.result === "WARN") weightedScore += c.weight * 0.5;
    else if (c.result === "FAIL") failCount++;
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight : 0;

  if (failCount >= 2 || score < 0.4) {
    return {
      verdict: "FAIL",
      summary: `${failCount} critical check(s) failed. Score ${(score * 100).toFixed(0)}%. Signal does not meet DJZS threshold.`,
    };
  }
  if (failCount === 1 || score < 0.65) {
    return {
      verdict: "WAIT",
      summary: `Borderline score ${(score * 100).toFixed(0)}%. Some checks uncertain. Wait for confirmation.`,
    };
  }
  return {
    verdict: "PASS",
    summary: `Score ${(score * 100).toFixed(0)}%. All key checks passed. Signal approved by DJZS audit.`,
  };
}

function classifySetupFamily(regime: Regime, direction: Direction, counterTrend = false): SetupFamily {
  if (counterTrend && direction === "SHORT") return "COUNTER_TREND_SHORT_EXHAUSTION";
  if (regime === "BULL" && direction === "LONG") return "TREND_CONTINUATION_LONG";
  if (regime === "BEAR" && direction === "SHORT") return "TREND_CONTINUATION_SHORT";
  if (regime === "RANGING" && direction === "LONG") return "RANGE_LONG";
  if (regime === "RANGING" && direction === "SHORT") return "RANGE_SHORT";
  return "NO_SETUP";
}

function assessEntryQuality(currentPrice: number, ema9: number, atrVal: number, direction: Direction, lateEntryAtrMultiplier = 1.5): EntryQuality {
  if (ema9 === 0 || atrVal === 0) return "INVALID";
  if (direction === "LONG" && currentPrice > ema9 + lateEntryAtrMultiplier * atrVal) return "LATE";
  if (direction === "SHORT" && currentPrice < ema9 - lateEntryAtrMultiplier * atrVal) return "LATE";

  const entryZoneRange = 0.3 * atrVal;
  if (direction === "LONG") {
    if (Math.abs(currentPrice - ema9) <= entryZoneRange) return "OPTIMAL";
  } else if (direction === "SHORT") {
    if (Math.abs(currentPrice - ema9) <= entryZoneRange) return "OPTIMAL";
  }

  return "ACCEPTABLE";
}

function assessNarrativeRisk(regime: Regime, reasonCodes: string[], oi: OIContext, direction: Direction): NarrativeRisk {
  const momentumCodes = ["MOMENTUM_UP", "MOMENTUM_DOWN", "OI_CONFIRMS"];
  const momentumCount = reasonCodes.filter(c => momentumCodes.includes(c)).length;

  if (regime === "RANGING" && momentumCount >= 3) return "HIGH";
  // The OI-opposition branch only fires on REAL data. With ESTIMATED OI
  // (synthetic from regime+price) the dominantSide always agrees with the
  // regime by construction, so applying this branch to ESTIMATED data
  // mathematically guarantees counter-regime trades inherit HIGH narrative
  // risk and get penalized — exactly the bias we are removing.
  if (
    oi.dataConfidence === "REAL" &&
    oi.dominantSide !== "NEUTRAL" &&
    oi.dominantSide !== direction &&
    Math.abs(oi.fundingRate) > 0.001
  ) return "HIGH";
  if (regime === "RANGING" && momentumCount >= 1) return "MEDIUM";
  // Symmetric resolution: BULL+LONG and BEAR+SHORT both reduce to LOW. Old DB
  // rows showing HIGH for BEAR+SHORT pre-date this branch and will not be
  // backfilled — fresh signals resolve correctly.
  if (regime === "BULL" || regime === "BEAR") return "LOW";
  return "HIGH";
}

function computeRR(entryZoneHigh: number, entryZoneLow: number, targetZone: number, invalidationPrice: number, direction: Direction): number {
  if (invalidationPrice === entryZoneHigh || invalidationPrice === entryZoneLow) return 0;
  let rr = 0;
  if (direction === "LONG") {
    rr = (targetZone - entryZoneHigh) / (entryZoneHigh - invalidationPrice);
  } else if (direction === "SHORT") {
    rr = (entryZoneLow - targetZone) / (invalidationPrice - entryZoneLow);
  }
  return Math.max(0, rr);
}

function buildRejectConditions(asset: string, regime: Regime, ema50: number, atrVal: number, invalidationPrice: number): string[] {
  return [
    `Price closes below EMA50 ($${ema50.toFixed(2)})`,
    `ATR expands > 2x current ($${(atrVal * 2).toFixed(2)}) without breakout`,
    "OI drops > 15% in single 4H candle",
    "Regime shifts to RANGING or UNDEFINED",
    `Invalidation level ($${invalidationPrice.toFixed(2)}) is breached on close`,
  ];
}

function generateThesis(asset: string, direction: Direction, regime: Regime, setupFamily: SetupFamily, ema9: number, ema21: number, ema50: number, rsiVal: number, macdHist: number): string {
  if (direction === "WAIT") {
    return `WAIT on ${asset}: Regime ${regime.toLowerCase()}, insufficient structural alignment for any setup family.`;
  }
  return `${setupFamily} on ${asset}: ${regime} regime confirmed with EMA stack (${ema9.toFixed(1)}<${ema21.toFixed(1)}<${ema50.toFixed(1)}), RSI at ${rsiVal.toFixed(1)} with ${macdHist > 0 ? "positive" : "negative"} MACD histogram supporting ${direction.toLowerCase()} continuation.`;
}

function generateWhyTrade(direction: Direction, processVerdict: ProcessVerdict, rejectionCodes: RejectionCode[], setupFamily: SetupFamily, rrRatio: number, entryQuality: EntryQuality): string {
  if (rejectionCodes.includes("DATA_UNAVAILABLE") || rejectionCodes.includes("STALE_PRICE")) {
    return "Input data quality is insufficient for a reliable signal. Waiting for fresh, verified data before committing to any direction.";
  }
  if (rejectionCodes.includes("INSUFFICIENT_HISTORY")) {
    return "Insufficient historical bar count to compute reliable indicators. Signal deferred to WAIT until at least 50 bars of data are available.";
  }
  if (processVerdict === "REJECTED") {
    return `Trade rejected due to: ${rejectionCodes.join(", ")}. Does not meet strict pre-trade discipline requirements.`;
  }
  if (direction === "WAIT") {
    return "Insufficient market structure or conflicting signals. Awaiting clear setup alignment.";
  }
  return `${setupFamily} qualifies with ${entryQuality.toLowerCase()} entry and RR of ${rrRatio.toFixed(2)}. Process verdict is ${processVerdict}.`;
}

function computeProcessVerdict(rejectionCodes: RejectionCode[], entryQuality: EntryQuality, logicAdmissibility: LogicAdmissibility, narrativeRisk: NarrativeRisk, rrRatio: number): ProcessVerdict {
  const hardRejections: RejectionCode[] = ["NO_REGIME", "NO_INVALIDATION", "STOP_INVALID", "UNDEFINED_REGIME", "RR_BELOW_THRESHOLD", "DATA_UNAVAILABLE", "INDICATOR_DEGENERATE"];
  if (rejectionCodes.some(c => hardRejections.includes(c))) return "REJECTED";

  const degradedCodes: RejectionCode[] = ["ENTRY_TOO_LATE", "NARRATIVE_HEAVY", "CROWDING_TOO_HIGH", "RANGE_SECONDARY", "CONFIDENCE_STRUCTURE_MISMATCH", "STALE_PRICE", "INSUFFICIENT_HISTORY", "FALLBACK_PRICE_USED", "NO_DIRECTIONAL_TRIGGER"];
  if (rejectionCodes.some(c => degradedCodes.includes(c))) return "DEGRADED";

  if (rejectionCodes.length === 0 && (entryQuality === "OPTIMAL" || entryQuality === "ACCEPTABLE") && rrRatio >= 1.5) return "APPROVED";

  return "REJECTED";
}

function computeLogicAdmissibility(processVerdict: ProcessVerdict, auditVerdict: Verdict, rejectionCodes: RejectionCode[]): LogicAdmissibility {
  const hardRejections: RejectionCode[] = ["NO_REGIME", "NO_INVALIDATION", "STOP_INVALID", "UNDEFINED_REGIME", "RR_BELOW_THRESHOLD", "DATA_UNAVAILABLE", "INDICATOR_DEGENERATE"];
  if (processVerdict === "REJECTED" || rejectionCodes.some(c => hardRejections.includes(c))) return "INADMISSIBLE";
  if (processVerdict === "DEGRADED" || auditVerdict === "WAIT") return "CONDITIONAL";
  if (processVerdict === "APPROVED" && auditVerdict === "PASS") return "ADMISSIBLE";
  return "INADMISSIBLE";
}

function computeProcessGrade(processVerdict: ProcessVerdict, logicAdmissibility: LogicAdmissibility, entryQuality: EntryQuality, narrativeRisk: NarrativeRisk, rrRatio: number, rejectionCodes: RejectionCode[]): ProcessQualityGrade {
  if (processVerdict === "REJECTED") return "F";
  if (processVerdict === "DEGRADED") return "D";
  if (processVerdict === "APPROVED") {
    if (logicAdmissibility === "ADMISSIBLE" && entryQuality === "OPTIMAL" && narrativeRisk === "LOW" && rrRatio >= 2.5) return "A";
    if (logicAdmissibility === "ADMISSIBLE" && entryQuality === "ACCEPTABLE" && (narrativeRisk === "LOW" || narrativeRisk === "MEDIUM") && rrRatio >= 1.5) return "B";
    if (logicAdmissibility === "CONDITIONAL" && rrRatio >= 1.5) return "C";
  }
  return "F";
}

function buildPreTradeChecklist(thesis: string, regime: Regime, entryZoneLow: number, entryZoneHigh: number, invalidationPrice: number, targetZone: number, reasonCodes: string[], rejectIf: string[], rrRatio: number): PreTradeChecklist {
  const missingFields: string[] = [];
  if (!thesis) missingFields.push("thesis");
  if (regime === "UNDEFINED") missingFields.push("regime");
  if (entryZoneLow <= 0 || entryZoneHigh <= 0) missingFields.push("entryZone");
  if (invalidationPrice <= 0) missingFields.push("invalidationPrice");
  if (targetZone <= 0) missingFields.push("targetZone");
  if (reasonCodes.length === 0) missingFields.push("reasonCodes");
  if (rejectIf.length === 0) missingFields.push("rejectIf");

  return {
    thesis,
    regimeConfirmed: regime !== "UNDEFINED",
    entryZoneDefined: entryZoneLow > 0 && entryZoneHigh > 0,
    invalidationDefined: invalidationPrice > 0,
    targetDefined: targetZone > 0,
    reasonCodesPresent: reasonCodes.length > 0,
    rejectConditionsDefined: rejectIf.length > 0,
    rrRatioAcceptable: rrRatio >= 1.5,
    checklistComplete: missingFields.length === 0,
    missingFields,
  };
}

// ── Main signal computation ───────────────────────────────────────────────────

export async function computeSignal(asset: string, timeframe = "4H"): Promise<ComputedSignal> {
  const constraints = getConstraints();
  const startMs = Date.now();
  logger.info({ asset, timeframe }, "Computing signal");

  // Timeframe routing: "4H" → DefiLlama (legacy, byte-identical), "15m" → Pyth
  // Benchmarks TradingView shim. The result shape is identical so the rest of
  // the engine is timeframe-agnostic.
  const histPromise = timeframe === "15m"
    ? getHistorical15mWithProvenance(asset)
    : getHistoricalPricesWithProvenance(asset, 200);

  const [priceResult, histResult, tvlResult, globalResult, pythResult] = await Promise.allSettled([
    getCurrentPricesWithProvenance([asset]),
    histPromise,
    getTvlForAssetWithProvenance(asset),
    getGlobalDerivativeData(),
    fetchPythSnapshot(asset),
  ]);

  const priceData = priceResult.status === "fulfilled" ? priceResult.value[asset] : null;
  const histData = histResult.status === "fulfilled" ? histResult.value : null;
  const tvlData = tvlResult.status === "fulfilled" ? tvlResult.value : null;
  const globalData = globalResult.status === "fulfilled" ? globalResult.value : null;
  const pythSnapshotData: PythSnapshot | null = pythResult.status === "fulfilled" ? pythResult.value : null;

  const currentPrice = priceData?.price ?? 0;
  const hist: HistoricalPrice[] = histData?.prices ?? [];
  const tvlValue = tvlData?.tvl ?? 0;
  const globalInfo = globalData ?? { totalLiquidationsUsd: 0, totalOpenInterestUsd: 0, missing: true, provenance: makeProvenance("FALLBACK_ZERO", new Date(), null, PRICE_STALE_THRESHOLD_MS, true) };

  const priceSeries = hist.map((p) => p.price);
  const now = new Date().toISOString();

  // ── Data quality flags ──────────────────────────────────────────────────────
  const qualityFlags: QualityFlag[] = [];

  if (!priceData || priceData.missing || currentPrice <= 0) {
    qualityFlags.push("MISSING_PRICE");
    qualityFlags.push("DATA_UNAVAILABLE");
  } else if (priceData.provenance.isFallback) {
    qualityFlags.push("FALLBACK_PRICE_USED");
  } else if (priceData.provenance.isStale) {
    qualityFlags.push("STALE_PRICE");
  }

  if (!histData || histData.missing) {
    qualityFlags.push("MISSING_HISTORY");
    qualityFlags.push("INSUFFICIENT_HISTORY");
    if (timeframe === "15m") qualityFlags.push("PYTH_BENCHMARKS_UNAVAILABLE");
  } else if (histData.insufficient) {
    qualityFlags.push("INSUFFICIENT_HISTORY");
  } else if (histData.provenance.isStale) {
    qualityFlags.push("STALE_HISTORY");
  }

  if (!tvlData || tvlData.missing) {
    qualityFlags.push("TVL_MISSING");
  }

  // SYNTHETIC_OI / SYNTHETIC_FUNDING are pushed below only if the OKX
  // perps fetch fails — see the OI context block.
  qualityFlags.push("VOLUME_MISSING");

  // Pyth quality flags — derived from early-fetched snapshot
  if (pythSnapshotData !== null) {
    if (pythSnapshotData.isStale) qualityFlags.push("PYTH_STALE");
    if (pythSnapshotData.isConfidenceWide) qualityFlags.push("PYTH_CONFIDENCE_WIDE");
  }

  // ── Price change calculation ────────────────────────────────────────────────
  // 4H bars: 24h = 6 bars back. 15m bars: 24h = 96 bars back.
  const prev24LookbackBars = timeframe === "15m" ? 96 : 6;
  const prev24Price = priceSeries.length > prev24LookbackBars
    ? priceSeries[priceSeries.length - 1 - prev24LookbackBars]
    : currentPrice;
  const priceChange24h = currentPrice - prev24Price;
  const priceChangePct24h = prev24Price > 0 ? (priceChange24h / prev24Price) * 100 : 0;
  const marketCap = await getMarketCapFromPrices(asset, currentPrice);

  const marketSnapshot: MarketSnapshot = {
    asset,
    price: currentPrice,
    priceChange24h,
    priceChangePct24h,
    volume24h: 0,
    marketCap,
    totalValueLocked: tvlValue,
    defiLlamaSlug: ASSET_MAP[asset]?.llamaId ?? "",
    updatedAt: now,
  };

  // ── Indicators ──────────────────────────────────────────────────────────────
  const ema9Val = lastEma(priceSeries, 9);
  const ema21Val = lastEma(priceSeries, 21);
  const ema50Val = lastEma(priceSeries, 50);
  const rsiVal = rsi(priceSeries);
  const macdResult = macd(priceSeries);
  const atrVal = atr(priceSeries, priceSeries, priceSeries);
  const regime = priceSeries.length > 0 ? deriveRegime(ema9Val, ema21Val, ema50Val, rsiVal) : "UNDEFINED";
  const trendStrength = clamp(Math.abs(ema9Val - ema50Val) / (ema50Val || 1) * 100, 0, 100);

  const trendRegime: TrendRegime = {
    asset,
    regime,
    ema9: ema9Val,
    ema21: ema21Val,
    ema50: ema50Val,
    rsi: rsiVal,
    macdHistogram: macdResult.histogram,
    atr: atrVal,
    trendStrength,
  };

  // ── OI context (real OKX perps with synthetic fallback) ────────────────────
  // Try the OKX public perps endpoints first. On success, dataConfidence
  // flips to "REAL" and the audit gates (OI_CONTEXT, narrativeRisk OI
  // opposition, CROWDING_TOO_HIGH) begin contributing. On any failure
  // (network error, geo-block, malformed response, unsupported asset) we
  // fall back to the original synthetic block and tag the data quality
  // report with SYNTHETIC_OI + SYNTHETIC_FUNDING.
  const perpsSnap = await fetchPerpsSnapshot(asset);

  let estimatedOI: number;
  let fundingRate: number;
  let oiChangePct24h: number;
  let longShortRatio: number;
  let oiDataConfidence: "REAL" | "ESTIMATED";

  if (perpsSnap) {
    estimatedOI = perpsSnap.openInterestUsd;
    fundingRate = perpsSnap.fundingRate;
    oiChangePct24h = perpsSnap.oiChangePct24h;
    longShortRatio = perpsSnap.longShortRatio;
    oiDataConfidence = "REAL";
  } else {
    const oiBase = globalInfo.totalOpenInterestUsd;
    const oiShare: Record<string, number> = { ETH: 0.35, BTC: 0.45, SOL: 0.20 };
    estimatedOI = oiBase * (oiShare[asset] ?? 0.2);
    const fundingMultiplier = regime === "BULL" ? 1 : regime === "BEAR" ? -1 : 0;
    fundingRate = 0.0001 * fundingMultiplier + (Math.random() - 0.5) * 0.00005;
    oiChangePct24h = priceChangePct24h * 0.5;
    longShortRatio = regime === "BULL" ? 1.3 : regime === "BEAR" ? 0.75 : 1.0;
    oiDataConfidence = "ESTIMATED";
    qualityFlags.push("SYNTHETIC_OI");
    qualityFlags.push("SYNTHETIC_FUNDING");
  }

  const dominantSide = deriveSide(fundingRate, oiChangePct24h);

  const oiContext: OIContext = {
    asset,
    openInterest: estimatedOI,
    oiChange24h: estimatedOI * oiChangePct24h / 100,
    oiChangePct24h,
    fundingRate,
    longShortRatio,
    dominantSide,
    dataConfidence: oiDataConfidence,
  };

  // ── Direction + reason codes ────────────────────────────────────────────────
  let direction: Direction;
  const reasonCodes: string[] = [];
  const rejectionCodes: RejectionCode[] = [];

  // ── Directional trigger ────────────────────────────────────────────────────
  // MACD threshold is ATR-relative (±0.25·ATR) rather than strict zero crossing.
  // MACD lags the EMA stack; in a confirmed BEAR (or BULL) 3-EMA stack a mildly
  // positive (or negative) histogram is normal pullback noise, not invalidation.
  // The strict-MACD audit check (MACD_CONFIRM) stays at 0 — softly-admitted
  // signals fail that audit and land as DEGRADED, not APPROVED. Trigger admits
  // candidates; audit grades them.
  const macdLongOk = macdResult.histogram > -0.25 * atrVal;
  const macdShortOk = macdResult.histogram < 0.25 * atrVal;

  // Counter-trend SHORT exhaustion: in a confirmed BULL regime, when price
  // is overextended above EMA21 (>2·ATR), RSI is exhausted (>75), MACD
  // histogram is cooling (< 0.25·ATR), and 24h move is parabolic (>5%), admit
  // a SHORT against the trend. This is intentionally narrow — most BULL
  // regimes do NOT meet all four conditions — and downstream the R/R floor is
  // raised to 2.0 to keep audit discipline. Without this branch the engine
  // structurally cannot SHORT a BULL regime even at obvious top patterns.
  let counterTrendShort = false;
  const counterTrendShortOk =
    regime === "BULL" &&
    rsiVal > 75 &&
    ema21Val > 0 &&
    atrVal > 0 &&
    currentPrice > ema21Val + 2 * atrVal &&
    macdResult.histogram < 0.25 * atrVal &&
    priceChangePct24h > 5;

  if (regime === "BULL" && macdLongOk && rsiVal > 50 && rsiVal < 75) {
    direction = "LONG";
    reasonCodes.push("BULL_REGIME", "MACD_POSITIVE", "RSI_MIDZONE");
  } else if (regime === "BEAR" && macdShortOk && rsiVal >= 30 && rsiVal < 50) {
    direction = "SHORT";
    reasonCodes.push("BEAR_REGIME", "MACD_NEGATIVE", "RSI_MIDZONE");
  } else if (counterTrendShortOk) {
    direction = "SHORT";
    counterTrendShort = true;
    reasonCodes.push("COUNTER_TREND_SHORT_EXHAUSTION", "RSI_OVERBOUGHT", "PRICE_OVEREXTENDED");
  } else {
    direction = "WAIT";
    reasonCodes.push("REGIME_UNCLEAR");
    // Distinguish "trigger failed inside a directional regime" from "no
    // directional regime at all". RANGING gets the existing WAIT path with no
    // extra code; BULL/BEAR with a failed conjunction is observability-tagged
    // so the analytics breakdown shows the real cause instead of mis-attributing
    // it to NO_INVALIDATION downstream.
    if (regime === "BULL" || regime === "BEAR") {
      rejectionCodes.push("NO_DIRECTIONAL_TRIGGER");
    }
  }

  if (dominantSide === direction) reasonCodes.push("OI_CONFIRMS");
  if (priceChangePct24h > 2 && direction === "LONG") reasonCodes.push("MOMENTUM_UP");
  if (priceChangePct24h < -2 && direction === "SHORT") reasonCodes.push("MOMENTUM_DOWN");
  if (rsiVal > 70) reasonCodes.push("RSI_OVERBOUGHT");
  if (rsiVal < 30) reasonCodes.push("RSI_OVERSOLD");
  if (Math.abs(fundingRate) > 0.0005) reasonCodes.push("FUNDING_EXTREME");

  // ── Data-quality guards — push to WAIT before any other rule ───────────────
  if (qualityFlags.includes("MISSING_PRICE") || qualityFlags.includes("DATA_UNAVAILABLE")) {
    direction = "WAIT";
    if (!rejectionCodes.includes("DATA_UNAVAILABLE")) rejectionCodes.push("DATA_UNAVAILABLE");
  }
  if (qualityFlags.includes("FALLBACK_PRICE_USED")) {
    if (!rejectionCodes.includes("FALLBACK_PRICE_USED")) rejectionCodes.push("FALLBACK_PRICE_USED");
  }
  if (qualityFlags.includes("STALE_PRICE")) {
    if (!rejectionCodes.includes("STALE_PRICE")) rejectionCodes.push("STALE_PRICE");
  }
  if (qualityFlags.includes("INSUFFICIENT_HISTORY")) {
    if (!rejectionCodes.includes("INSUFFICIENT_HISTORY")) rejectionCodes.push("INSUFFICIENT_HISTORY");
  }

  // ── Indicator-degenerate guard ──────────────────────────────────────────────
  // Prevents SHORT/LONG packets from emitting when ATR, EMA9, or currentPrice
  // are zero / NaN / non-finite. Without this guard, assessEntryQuality returns
  // INVALID and computeRR returns 0, which then trips the silent fallthrough at
  // computeProcessVerdict's terminal `return "REJECTED"` with empty rejection
  // codes — the exact failure mode that produced 12/12 REJECTED SHORTs. Forcing
  // WAIT here surfaces an explicit code (INDICATOR_DEGENERATE) instead.
  if (
    direction !== "WAIT" &&
    (!Number.isFinite(atrVal) || atrVal === 0 ||
     !Number.isFinite(ema9Val) || ema9Val === 0 ||
     !Number.isFinite(currentPrice) || currentPrice === 0)
  ) {
    direction = "WAIT";
    if (!rejectionCodes.includes("INDICATOR_DEGENERATE")) rejectionCodes.push("INDICATOR_DEGENERATE");
  }

  // ── Price levels ────────────────────────────────────────────────────────────
  const atrFactor = atrVal > 0 ? atrVal : currentPrice * 0.005;
  const entryZoneLow = direction === "LONG" ? currentPrice - atrFactor * 0.3 : currentPrice;
  const entryZoneHigh = direction === "LONG" ? currentPrice + atrFactor * 0.1 : currentPrice + atrFactor * 0.3;
  const targetZone =
    direction === "LONG"
      ? currentPrice + atrFactor * 2.5
      : direction === "SHORT"
      ? currentPrice - atrFactor * 2.5
      : currentPrice;
  const invalidationPrice =
    direction === "LONG"
      ? currentPrice - atrFactor * 1.5
      : direction === "SHORT"
      ? currentPrice + atrFactor * 1.5
      : currentPrice;

  const setupFamily = classifySetupFamily(regime, direction, counterTrendShort);
  const entryQuality = assessEntryQuality(currentPrice, ema9Val, atrVal, direction, lateEntryMultiplierFor(timeframe, constraints.lateEntryAtrMultiplier));
  const narrativeRisk = assessNarrativeRisk(regime, reasonCodes, oiContext, direction);
  const rrRatio = computeRR(entryZoneHigh, entryZoneLow, targetZone, invalidationPrice, direction);

  // ── Canonical normalization — strict internal objects, not raw vendor payloads
  const normalizedPacket = normalizeInputs({
    asset,
    timeframe,
    priceProvenance: priceData?.provenance ?? makeProvenance("FALLBACK_ZERO", new Date(), null, PRICE_STALE_THRESHOLD_MS, true),
    historyProvenance: histData?.provenance ?? makeProvenance("FALLBACK_ZERO", new Date(), null, 3600000, true),
    price: currentPrice,
    historicalBarCount: hist.length,
    ema9: ema9Val,
    ema21: ema21Val,
    ema50: ema50Val,
    rsiValue: rsiVal,
    macdHistogram: macdResult.histogram,
    atr: atrVal,
    regime,
    trendStrength,
    openInterestEstimate: estimatedOI,
    oiChangePct24h,
    fundingRate,
    dominantSide,
    longShortRatio,
    tvlValue,
    globalOiUsd: globalInfo.totalOpenInterestUsd,
    entryZoneLow,
    entryZoneHigh,
    targetZone,
    invalidationPrice,
    rrRatio,
    pythPrice: pythSnapshotData?.price ?? null,
    pythConfidencePct: pythSnapshotData?.confidencePct ?? null,
    pythFeedId: pythSnapshotData?.feedId ?? null,
  });
  const packetHash = hashPacket(normalizedPacket);

  // ── Hard execution rules ────────────────────────────────────────────────────
  if (regime === "UNDEFINED") {
    direction = "WAIT";
    rejectionCodes.push("UNDEFINED_REGIME");
  }
  // NO_INVALIDATION applies to genuinely emitted directional setups that lack
  // a valid stop. For WAIT packets the entry/invalidation zones collapse onto
  // currentPrice by construction, which would mis-tag every WAIT as
  // NO_INVALIDATION and overshadow the real diagnostic (e.g.
  // NO_DIRECTIONAL_TRIGGER, INDICATOR_DEGENERATE, REGIME_UNCLEAR). Gate the
  // equality branch on a directional signal; the <= 0 branch is still a hard
  // data error and fires unconditionally.
  if (invalidationPrice <= 0) {
    direction = "WAIT";
    if (!rejectionCodes.includes("NO_INVALIDATION")) rejectionCodes.push("NO_INVALIDATION");
  } else if (invalidationPrice === currentPrice && direction !== "WAIT") {
    direction = "WAIT";
    if (!rejectionCodes.includes("NO_INVALIDATION")) rejectionCodes.push("NO_INVALIDATION");
  }
  // Counter-trend SHORTs use a stricter R/R floor (max(2.0, configured min))
  // because they trade against the prevailing regime — the higher reward
  // multiple compensates for the lower base rate. Trend-aligned setups keep
  // the configured floor.
  const effectiveRRFloor = counterTrendShort
    ? Math.max(2.0, constraints.minRRThreshold)
    : constraints.minRRThreshold;
  if (rrRatio < effectiveRRFloor && direction !== "WAIT") {
    direction = "WAIT";
    rejectionCodes.push("RR_BELOW_THRESHOLD");
  }

  let pVerdict: ProcessVerdict = "APPROVED";
  if (entryQuality === "LATE") {
    rejectionCodes.push("ENTRY_TOO_LATE");
    pVerdict = "DEGRADED";
  }
  if (narrativeRisk === "HIGH") {
    rejectionCodes.push("NARRATIVE_HEAVY");
    pVerdict = entryQuality === "LATE" ? "REJECTED" : "DEGRADED";
  }

  const baseConfidence = direction === "WAIT" ? 20 : 50;
  if (baseConfidence > 70 && regime === "RANGING") {
    rejectionCodes.push("CONFIDENCE_STRUCTURE_MISMATCH");
  }
  if (setupFamily === "RANGE_LONG" || setupFamily === "RANGE_SHORT") {
    rejectionCodes.push("RANGE_SECONDARY");
  }
  // CROWDING_TOO_HIGH is suppressed when funding is ESTIMATED. Synthetic
  // funding flips sign with regime, so on ESTIMATED data this check would
  // tag every BULL+LONG and BEAR+SHORT trade as crowded — a meaningless
  // signal. Re-enables automatically when dataConfidence flips to REAL.
  if (
    oiContext.dataConfidence === "REAL" &&
    ((oiContext.fundingRate > 0.001 && direction === "LONG") ||
     (oiContext.fundingRate < -0.001 && direction === "SHORT"))
  ) {
    rejectionCodes.push("CROWDING_TOO_HIGH");
  }

  let finalProcessVerdict = computeProcessVerdict(rejectionCodes, entryQuality, "ADMISSIBLE", narrativeRisk, rrRatio);
  let whyTrade = generateWhyTrade(direction, finalProcessVerdict, rejectionCodes, setupFamily, rrRatio, entryQuality);

  // ── Pyth secondary verifier ─────────────────────────────────────────────────
  // Uses the snapshot already fetched in the initial allSettled batch.
  // pythSnapshotData = null if Pyth was unreachable at compute time.
  let pythVerifier: PythVerifierResult;

  if (!constraints.pythConfidenceFilter) {
    pythVerifier = makePythVerifierSkipped();
  } else if (!pythSnapshotData) {
    pythVerifier = makePythVerifierUnavailable();
    qualityFlags.push("PYTH_UNAVAILABLE");
  } else {
    const snap = pythSnapshotData;
    const divergencePct = currentPrice > 0
      ? Math.abs(snap.price - currentPrice) / currentPrice * 100
      : null;
    const hasDivergence = divergencePct != null && divergencePct > 0.5;
    const confidenceRatio = snap.price > 0 ? snap.confidence / snap.price : 1;

    if (hasDivergence) qualityFlags.push("CONFLICTING_PRICES");

    let pythVerdict: PythVerifierResult["verdict"] = "CONFIRMS";
    let verdictDetail = `Pyth $${snap.price.toFixed(2)} vs DefiLlama $${currentPrice.toFixed(2)}.`;

    if (snap.isStale) {
      pythVerdict = "UNAVAILABLE";
      verdictDetail += ` Stale: ${snap.stalenessSec.toFixed(0)}s since publish.`;
      qualityFlags.push("PYTH_UNAVAILABLE");
    } else if (hasDivergence) {
      pythVerdict = "DIVERGES";
      verdictDetail += ` Divergence ${divergencePct!.toFixed(2)}% exceeds 0.5% threshold.`;
      qualityFlags.push("PYTH_DIVERGENCE");
    } else {
      verdictDetail += ` Divergence ${divergencePct != null ? divergencePct.toFixed(3) : "n/a"}% within threshold. Confidence: ${snap.confidenceStatus} (±${snap.confidencePct.toFixed(3)}%).`;
    }

    pythVerifier = {
      scaffolded: true,
      checked: true,
      pythPrice: snap.price,
      defillamaPrice: currentPrice,
      priceDivergencePct: divergencePct,
      confidenceRatio,
      confidenceStatus: snap.confidenceStatus,
      fresh: !snap.isStale,
      verdict: pythVerdict,
      verdictDetail,
      influencesProcessVerdict: constraints.pythConfidenceFilter,
      provenance: makeProvenance(
        "PYTH_HERMES",
        new Date(),
        new Date(snap.publishTime).getTime(),
        60000,
        false,
      ),
    };

    // Confidence filter — degrade verdict when confidence is below threshold
    if (confidenceRatio > (1 - constraints.pythConfidenceThreshold)) {
      if (!rejectionCodes.includes("CONFIDENCE_STRUCTURE_MISMATCH")) {
        rejectionCodes.push("CONFIDENCE_STRUCTURE_MISMATCH");
      }
      if (finalProcessVerdict === "APPROVED") {
        finalProcessVerdict = "DEGRADED";
      }
      qualityFlags.push("LOW_CONFIDENCE");
      whyTrade += ` Pyth confidence ${snap.confidenceStatus} (±${snap.confidencePct.toFixed(3)}%).`;
    }
  }

  // ── Fast-path verification — additive structured layer before DJZS audit ────
  // Runs 10 explicit hard/soft checks on the normalized packet.
  // Hermes findings are evidence only and are never read here.
  const verificationReport = runFastPathVerification({
    normalizedPacket,
    packetHash,
    direction,
    minRRThreshold: constraints.minRRThreshold,
    entryQuality,
    minHistoryBars: minHistoryBarsFor(timeframe),
    pythVerdict: pythVerifier.verdict as "CONFIRMS" | "DIVERGES" | "UNAVAILABLE" | "SKIPPED",
  });

  // ── DJZS audit ──────────────────────────────────────────────────────────────
  const checks = buildAuditChecks(trendRegime, oiContext, direction, priceSeries, pythSnapshotData, currentPrice);
  const { verdict: auditVerdict, summary: auditSummary } = computeVerdict(checks);

  // Soft-admit grading enforcement: the directional trigger (lines ~615-620)
  // admits BULL/BEAR signals on ATR-relative MACD; the audit layer
  // (MACD_CONFIRM and friends) keeps the strict zero-cross gate. If a
  // directional signal was admitted but the audit did not PASS, downgrade an
  // APPROVED process verdict to DEGRADED so soft admits never reach APPROVED.
  if (
    finalProcessVerdict === "APPROVED" &&
    direction !== "WAIT" &&
    auditVerdict !== "PASS"
  ) {
    finalProcessVerdict = "DEGRADED";
  }

  const logicAdmissibility = computeLogicAdmissibility(finalProcessVerdict, auditVerdict, rejectionCodes);
  const processQualityGrade = computeProcessGrade(finalProcessVerdict, logicAdmissibility, entryQuality, narrativeRisk, rrRatio, rejectionCodes);

  let confidence = baseConfidence;
  if (finalProcessVerdict === "APPROVED") confidence += 20;
  else if (finalProcessVerdict === "DEGRADED") confidence += 10;
  else if (finalProcessVerdict === "REJECTED") confidence -= 15;
  confidence += reasonCodes.length * 5;
  confidence -= rejectionCodes.length * 10;
  if (narrativeRisk === "HIGH") confidence -= 5;
  if (entryQuality === "LATE") confidence -= 10;
  // Reduce confidence when data quality is degraded
  if (qualityFlags.includes("STALE_PRICE")) confidence -= 10;
  if (qualityFlags.includes("INSUFFICIENT_HISTORY")) confidence -= 15;
  if (qualityFlags.includes("FALLBACK_PRICE_USED")) confidence -= 20;
  confidence = clamp(confidence, 5, 95);

  const rejectIf = buildRejectConditions(asset, regime, ema50Val, atrVal, invalidationPrice);
  const thesis = generateThesis(asset, direction, regime, setupFamily, ema9Val, ema21Val, ema50Val, rsiVal, macdResult.histogram);
  const preTradChecklist = buildPreTradeChecklist(thesis, regime, entryZoneLow, entryZoneHigh, invalidationPrice, targetZone, reasonCodes, rejectIf, rrRatio);
  whyTrade = generateWhyTrade(direction, finalProcessVerdict, rejectionCodes, setupFamily, rrRatio, entryQuality);

  const outcomeTracking: OutcomeTracking = {
    scaffolded: true,
    entryFilled: null,
    exitPrice: null,
    pnlPct: null,
    outcome: null,
    processScore: null,
  };

  const auditReport: AuditReport = {
    asset,
    verdict: auditVerdict,
    checks,
    summary: auditSummary,
    generatedAt: now,
  };

  // ── Build DataQualityReport ─────────────────────────────────────────────────
  const dedupedFlags: QualityFlag[] = [...new Set(qualityFlags)];
  const grade = computeDataQualityGrade(dedupedFlags);
  const isCritical = grade === "CRITICAL";
  const forcedWaitReason = isCritical
    ? `Data quality is CRITICAL: ${dedupedFlags.filter(f => ["MISSING_PRICE", "DATA_UNAVAILABLE"].includes(f)).join(", ")}.`
    : qualityFlags.includes("INSUFFICIENT_HISTORY")
    ? `Only ${hist.length} bars available — minimum is ${minHistoryBarsFor(timeframe)}.`
    : null;

  const dataQuality: DataQualityReport = {
    grade,
    flags: dedupedFlags,
    priceProvenance: priceData?.provenance ?? makeProvenance("FALLBACK_ZERO", new Date(), null, PRICE_STALE_THRESHOLD_MS, true),
    historyProvenance: histData?.provenance ?? makeProvenance("FALLBACK_ZERO", new Date(), null, 3600000, true),
    oiProvenance: makeProvenance(
      oiDataConfidence === "REAL" ? "OKX_PERPS" : "SYNTHETIC",
      new Date(perpsSnap?.fetchedAt ?? Date.now()),
      perpsSnap ? Date.now() - perpsSnap.fetchedAt : null,
      PRICE_STALE_THRESHOLD_MS,
      oiDataConfidence !== "REAL",
    ),
    tvlProvenance: tvlData?.provenance ?? null,
    pythVerifier,
    historicalBarCount: hist.length,
    minHistoricalBarsRequired: minHistoryBarsFor(timeframe),
    dataReadyForSignal: !isCritical && !qualityFlags.includes("INSUFFICIENT_HISTORY"),
    degradedConfidence: grade === "DEGRADED" || grade === "POOR",
    forcedWaitReason,
    computedAt: now,
  };

  const elapsed = Date.now() - startMs;
  logger.info({ asset, direction, verdict: auditVerdict, confidence, dataGrade: grade, elapsed }, "Signal computed");

  return {
    asset,
    timeframe,
    direction,
    confidence,
    verdictDjzs: auditVerdict,
    entryZoneLow,
    entryZoneHigh,
    targetZone,
    invalidationPrice,
    reasonCodes,
    marketSnapshot,
    trendRegime,
    openInterestContext: oiContext,
    auditReport,
    computedAt: now,
    processVerdict: finalProcessVerdict,
    logicAdmissibility,
    setupFamily,
    entryQuality,
    narrativeRisk,
    rrRatio,
    thesis,
    whyTrade,
    rejectIf,
    rejectionCodes,
    processQualityGrade,
    preTradChecklist,
    outcomeTracking,
    dataQuality,
    verificationReport,
    packetHash,
    pythSnapshot: pythSnapshotData,
  };
}

export async function computeAllSignals(): Promise<ComputedSignal[]> {
  const assets = Object.keys(ASSET_MAP);
  return Promise.all(assets.map((a) => computeSignal(a)));
}
