import { logger } from "../logger";
import {
  getCurrentPrices,
  getHistoricalPrices,
  getTvlForAsset,
  getMarketCapFromPrices,
  getGlobalDerivativeData,
  ASSET_MAP,
  type HistoricalPrice,
} from "./defillamaClient";
import { lastEma, rsi, macd, atr } from "./indicators";
import { getConstraints } from "../hermes/constraints";
import { fetchPythPrice } from "../pyth/pythClient";

export type Direction = "LONG" | "SHORT" | "WAIT";
export type Verdict = "PASS" | "FAIL" | "WAIT";
export type Regime = "BULL" | "BEAR" | "RANGING" | "UNDEFINED";
export type DominantSide = "LONG" | "SHORT" | "NEUTRAL";
export type CheckResult = "PASS" | "FAIL" | "WARN" | "SKIP";

export type ProcessVerdict = "APPROVED" | "REJECTED" | "DEGRADED";
export type LogicAdmissibility = "ADMISSIBLE" | "INADMISSIBLE" | "CONDITIONAL";
export type SetupFamily = "TREND_CONTINUATION_LONG" | "TREND_CONTINUATION_SHORT" | "RANGE_LONG" | "RANGE_SHORT" | "NO_SETUP";
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
  | "RANGE_SECONDARY";

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
}

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
  prices: number[]
): AuditCheck[] {
  const checks: AuditCheck[] = [];

  const trendAligned = tr.regime === "BULL" && direction === "LONG" || tr.regime === "BEAR" && direction === "SHORT";
  checks.push({
    name: "TREND_ALIGNMENT",
    result: tr.regime === "RANGING" ? "WARN" : trendAligned ? "PASS" : "FAIL",
    detail: `Regime is ${tr.regime}; signal is ${direction}. ${trendAligned ? "Aligned." : "Misaligned."}`,
    weight: 0.25,
  });

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

function classifySetupFamily(regime: Regime, direction: Direction): SetupFamily {
  if (regime === "BULL" && direction === "LONG") return "TREND_CONTINUATION_LONG";
  if (regime === "BEAR" && direction === "SHORT") return "TREND_CONTINUATION_SHORT";
  if (regime === "RANGING" && direction === "LONG") return "RANGE_LONG";
  if (regime === "RANGING" && direction === "SHORT") return "RANGE_SHORT";
  return "NO_SETUP";
}

function assessEntryQuality(currentPrice: number, ema9: number, atr: number, direction: Direction, lateEntryAtrMultiplier = 1.5): EntryQuality {
  if (ema9 === 0 || atr === 0) return "INVALID";
  if (direction === "LONG" && currentPrice > ema9 + lateEntryAtrMultiplier * atr) return "LATE";
  if (direction === "SHORT" && currentPrice < ema9 - lateEntryAtrMultiplier * atr) return "LATE";
  
  const entryZoneRange = 0.3 * atr;
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
  if (oi.dominantSide !== "NEUTRAL" && oi.dominantSide !== direction && Math.abs(oi.fundingRate) > 0.001) return "HIGH";
  if (regime === "RANGING" && momentumCount >= 1) return "MEDIUM";
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

function buildRejectConditions(asset: string, regime: Regime, ema50: number, atr: number, invalidationPrice: number): string[] {
  return [
    `Price closes below EMA50 ($${ema50.toFixed(2)})`,
    `ATR expands > 2x current ($${(atr * 2).toFixed(2)}) without breakout`,
    "OI drops > 15% in single 4H candle",
    "Regime shifts to RANGING or UNDEFINED",
    `Invalidation level ($${invalidationPrice.toFixed(2)}) is breached on close`
  ];
}

function generateThesis(asset: string, direction: Direction, regime: Regime, setupFamily: SetupFamily, ema9: number, ema21: number, ema50: number, rsiVal: number, macdHist: number): string {
  if (direction === "WAIT") {
    return `WAIT on ${asset}: Regime ${regime.toLowerCase()}, insufficient structural alignment for any setup family.`;
  }
  return `${setupFamily} on ${asset}: ${regime} regime confirmed with EMA stack (${ema9.toFixed(1)}<${ema21.toFixed(1)}<${ema50.toFixed(1)}), RSI at ${rsiVal.toFixed(1)} with ${macdHist > 0 ? 'positive' : 'negative'} MACD histogram supporting ${direction.toLowerCase()} continuation.`;
}

function generateWhyTrade(direction: Direction, processVerdict: ProcessVerdict, rejectionCodes: RejectionCode[], setupFamily: SetupFamily, rrRatio: number, entryQuality: EntryQuality): string {
  if (processVerdict === "REJECTED") {
    return `Trade rejected due to: ${rejectionCodes.join(", ")}. Does not meet strict pre-trade discipline requirements.`;
  }
  if (direction === "WAIT") {
    return "Insufficient market structure or conflicting signals. Awaiting clear setup alignment.";
  }
  return `${setupFamily} qualifies with ${entryQuality.toLowerCase()} entry and RR of ${rrRatio.toFixed(2)}. Process verdict is ${processVerdict}.`;
}

function computeProcessVerdict(rejectionCodes: RejectionCode[], entryQuality: EntryQuality, logicAdmissibility: LogicAdmissibility, narrativeRisk: NarrativeRisk, rrRatio: number): ProcessVerdict {
  const hardRejections: RejectionCode[] = ["NO_REGIME", "NO_INVALIDATION", "STOP_INVALID", "UNDEFINED_REGIME", "RR_BELOW_THRESHOLD"];
  if (rejectionCodes.some(c => hardRejections.includes(c))) return "REJECTED";
  
  const degradedCodes: RejectionCode[] = ["ENTRY_TOO_LATE", "NARRATIVE_HEAVY", "CROWDING_TOO_HIGH", "RANGE_SECONDARY", "CONFIDENCE_STRUCTURE_MISMATCH"];
  if (rejectionCodes.some(c => degradedCodes.includes(c))) return "DEGRADED";

  if (rejectionCodes.length === 0 && (entryQuality === "OPTIMAL" || entryQuality === "ACCEPTABLE") && rrRatio >= 1.5) return "APPROVED";
  
  return "REJECTED";
}

function computeLogicAdmissibility(processVerdict: ProcessVerdict, auditVerdict: Verdict, rejectionCodes: RejectionCode[]): LogicAdmissibility {
  const hardRejections: RejectionCode[] = ["NO_REGIME", "NO_INVALIDATION", "STOP_INVALID", "UNDEFINED_REGIME", "RR_BELOW_THRESHOLD"];
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

export async function computeSignal(asset: string, timeframe = "4H"): Promise<ComputedSignal> {
  const constraints = getConstraints();
  const startMs = Date.now();
  logger.info({ asset, timeframe }, "Computing signal");

  const [prices, historical, tvl, globalData] = await Promise.allSettled([
    getCurrentPrices([asset]),
    getHistoricalPrices(asset, 200),
    getTvlForAsset(asset),
    getGlobalDerivativeData(),
  ]);

  const currentPrice = prices.status === "fulfilled" ? (prices.value[asset]?.price ?? 0) : 0;
  const hist: HistoricalPrice[] = historical.status === "fulfilled" ? historical.value : [];
  const tvlValue = tvl.status === "fulfilled" ? tvl.value : 0;
  const globalInfo = globalData.status === "fulfilled" ? globalData.value : { totalLiquidationsUsd: 0, totalOpenInterestUsd: 0 };

  const priceSeries = hist.map((p) => p.price);
  const now = new Date().toISOString();

  const prev24Price = priceSeries.length > 6 ? priceSeries[priceSeries.length - 7] : currentPrice;
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

  const oiBase = globalInfo.totalOpenInterestUsd;
  const oiShare: Record<string, number> = { ETH: 0.35, BTC: 0.45, SOL: 0.20 };
  const estimatedOI = oiBase * (oiShare[asset] ?? 0.2);

  const fundingMultiplier = regime === "BULL" ? 1 : regime === "BEAR" ? -1 : 0;
  const fundingRate = 0.0001 * fundingMultiplier + (Math.random() - 0.5) * 0.00005;
  const oiChangePct24h = priceChangePct24h * 0.5;
  const longShortRatio = regime === "BULL" ? 1.3 : regime === "BEAR" ? 0.75 : 1.0;
  const dominantSide = deriveSide(fundingRate, oiChangePct24h);

  const oiContext: OIContext = {
    asset,
    openInterest: estimatedOI,
    oiChange24h: estimatedOI * oiChangePct24h / 100,
    oiChangePct24h,
    fundingRate,
    longShortRatio,
    dominantSide,
  };

  let direction: Direction;
  const reasonCodes: string[] = [];
  const rejectionCodes: RejectionCode[] = [];

  if (regime === "BULL" && macdResult.histogram > 0 && rsiVal > 50 && rsiVal < 75) {
    direction = "LONG";
    reasonCodes.push("BULL_REGIME", "MACD_POSITIVE", "RSI_MIDZONE");
  } else if (regime === "BEAR" && macdResult.histogram < 0 && rsiVal < 50 && rsiVal > 25) {
    direction = "SHORT";
    reasonCodes.push("BEAR_REGIME", "MACD_NEGATIVE", "RSI_MIDZONE");
  } else {
    direction = "WAIT";
    reasonCodes.push("REGIME_UNCLEAR");
  }

  if (dominantSide === direction) reasonCodes.push("OI_CONFIRMS");
  if (priceChangePct24h > 2 && direction === "LONG") reasonCodes.push("MOMENTUM_UP");
  if (priceChangePct24h < -2 && direction === "SHORT") reasonCodes.push("MOMENTUM_DOWN");
  if (rsiVal > 70) reasonCodes.push("RSI_OVERBOUGHT");
  if (rsiVal < 30) reasonCodes.push("RSI_OVERSOLD");
  if (Math.abs(fundingRate) > 0.0005) reasonCodes.push("FUNDING_EXTREME");

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

  const setupFamily = classifySetupFamily(regime, direction);
  const entryQuality = assessEntryQuality(currentPrice, ema9Val, atrVal, direction, constraints.lateEntryAtrMultiplier);
  const narrativeRisk = assessNarrativeRisk(regime, reasonCodes, oiContext, direction);
  const rrRatio = computeRR(entryZoneHigh, entryZoneLow, targetZone, invalidationPrice, direction);

  // Hard Execution Rules
  if (regime === "UNDEFINED") {
    direction = "WAIT";
    rejectionCodes.push("UNDEFINED_REGIME");
  }
  if (invalidationPrice <= 0 || invalidationPrice === currentPrice) {
    direction = "WAIT";
    rejectionCodes.push("NO_INVALIDATION");
  }
  if (rrRatio < constraints.minRRThreshold && direction !== "WAIT") {
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
  if ((oiContext.fundingRate > 0.001 && direction === "LONG") || (oiContext.fundingRate < -0.001 && direction === "SHORT")) {
    rejectionCodes.push("CROWDING_TOO_HIGH");
  }

  let finalProcessVerdict = computeProcessVerdict(rejectionCodes, entryQuality, "ADMISSIBLE", narrativeRisk, rrRatio);
  
  let whyTrade = generateWhyTrade(direction, finalProcessVerdict, rejectionCodes, setupFamily, rrRatio, entryQuality);

  if (constraints.pythConfidenceFilter) {
    const pythData = await fetchPythPrice(asset).catch(() => null);
    if (pythData && pythData.confidenceRatio > (1 - constraints.pythConfidenceThreshold)) {
      if (!rejectionCodes.includes("CONFIDENCE_STRUCTURE_MISMATCH")) {
        rejectionCodes.push("CONFIDENCE_STRUCTURE_MISMATCH");
      }
      if (finalProcessVerdict === "APPROVED") {
        finalProcessVerdict = "DEGRADED";
      }
      whyTrade += ` Pyth confidence LOW (ratio: ${pythData.confidenceRatio.toFixed(4)}).`;
    }
  }

  const checks = buildAuditChecks(trendRegime, oiContext, direction, priceSeries);
  const { verdict: auditVerdict, summary: auditSummary } = computeVerdict(checks);
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
  confidence = clamp(confidence, 5, 95);

  const rejectIf = buildRejectConditions(asset, regime, ema50Val, atrVal, invalidationPrice);
  const thesis = generateThesis(asset, direction, regime, setupFamily, ema9Val, ema21Val, ema50Val, rsiVal, macdResult.histogram);
  const preTradChecklist = buildPreTradeChecklist(thesis, regime, entryZoneLow, entryZoneHigh, invalidationPrice, targetZone, reasonCodes, rejectIf, rrRatio);

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

  const elapsed = Date.now() - startMs;
  logger.info({ asset, direction, verdict: auditVerdict, confidence, elapsed }, "Signal computed");

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
  };
}

export async function computeAllSignals(): Promise<ComputedSignal[]> {
  const assets = Object.keys(ASSET_MAP);
  return Promise.all(assets.map((a) => computeSignal(a)));
}
