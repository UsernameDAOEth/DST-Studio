import { createHash } from "crypto";
import type { DataProvenance, DataSource } from "../quality/types";

function roundTo(v: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

function safeNum(
  v: number,
  field: string,
  errors: string[],
  allowNegative = false,
): number {
  if (!isFinite(v) || isNaN(v)) {
    errors.push(`${field}: non-finite value (${v})`);
    return 0;
  }
  if (!allowNegative && v < 0) {
    errors.push(`${field}: unexpected negative value (${v})`);
    return 0;
  }
  return v;
}

// ── Canonical normalized packet ───────────────────────────────────────────────
// All verification logic runs on this type — not on raw vendor payloads.

export interface NormalizedInputPacket {
  asset: string;
  timeframe: string;

  // Price layer — sourced from defillamaClient with provenance
  price: number;
  priceSource: DataSource;
  priceFetchedAt: string;
  priceAgeMs: number;
  priceIsStale: boolean;
  priceIsFallback: boolean;

  // History layer
  historicalBarCount: number;
  historyIsStale: boolean;
  historyIsFallback: boolean;
  historySource: DataSource;

  // Indicators — deterministic from the normalized price series
  ema9: number;
  ema21: number;
  ema50: number;
  rsiValue: number;
  macdHistogram: number;
  atr: number;
  regime: string;
  trendStrength: number;

  // OI / funding — always synthetic; all checks must account for this
  openInterestEstimate: number;
  oiChangePct24h: number;
  fundingRate: number;
  dominantSide: string;
  longShortRatio: number;

  // Auxiliary
  tvlValue: number;
  globalOiUsd: number;

  // Derived price levels
  entryZoneLow: number;
  entryZoneHigh: number;
  targetZone: number;
  invalidationPrice: number;
  rrRatio: number;

  // Normalization diagnostics
  normalizationErrors: string[];
  hasCriticalNormalizationError: boolean;
  normalizedAt: string;
}

export interface NormalizeInputsParams {
  asset: string;
  timeframe: string;
  priceProvenance: DataProvenance;
  historyProvenance: DataProvenance;
  price: number;
  historicalBarCount: number;
  ema9: number;
  ema21: number;
  ema50: number;
  rsiValue: number;
  macdHistogram: number;
  atr: number;
  regime: string;
  trendStrength: number;
  openInterestEstimate: number;
  oiChangePct24h: number;
  fundingRate: number;
  dominantSide: string;
  longShortRatio: number;
  tvlValue: number;
  globalOiUsd: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  targetZone: number;
  invalidationPrice: number;
  rrRatio: number;
}

export function normalizeInputs(params: NormalizeInputsParams): NormalizedInputPacket {
  const errors: string[] = [];

  const price = safeNum(params.price, "price", errors);
  if (price <= 0 && !params.priceProvenance.isFallback) {
    errors.push(`price: must be positive for a live source, got ${params.price}`);
  }

  const ema9 = safeNum(params.ema9, "ema9", errors);
  const ema21 = safeNum(params.ema21, "ema21", errors);
  const ema50 = safeNum(params.ema50, "ema50", errors);
  const rsiValue = safeNum(params.rsiValue, "rsiValue", errors);
  const macdHistogram = safeNum(params.macdHistogram, "macdHistogram", errors, true);
  const atr = safeNum(params.atr, "atr", errors);
  const trendStrength = safeNum(params.trendStrength, "trendStrength", errors);
  const openInterestEstimate = safeNum(params.openInterestEstimate, "openInterestEstimate", errors);
  const oiChangePct24h = safeNum(params.oiChangePct24h, "oiChangePct24h", errors, true);
  const fundingRate = safeNum(params.fundingRate, "fundingRate", errors, true);
  const longShortRatio = safeNum(params.longShortRatio, "longShortRatio", errors);
  const tvlValue = safeNum(params.tvlValue, "tvlValue", errors);
  const globalOiUsd = safeNum(params.globalOiUsd, "globalOiUsd", errors);
  const entryZoneLow = safeNum(params.entryZoneLow, "entryZoneLow", errors);
  const entryZoneHigh = safeNum(params.entryZoneHigh, "entryZoneHigh", errors);
  const targetZone = safeNum(params.targetZone, "targetZone", errors, true);
  const invalidationPrice = safeNum(params.invalidationPrice, "invalidationPrice", errors);
  const rrRatio = safeNum(params.rrRatio, "rrRatio", errors);

  const hasCriticalNormalizationError =
    (price <= 0 && !params.priceProvenance.isFallback) ||
    errors.some((e) => e.startsWith("price:") || e.startsWith("ema9:") || e.startsWith("ema21:"));

  return {
    asset: params.asset,
    timeframe: params.timeframe,
    price,
    priceSource: params.priceProvenance.source,
    priceFetchedAt: params.priceProvenance.fetchedAt,
    priceAgeMs: params.priceProvenance.ageMs,
    priceIsStale: params.priceProvenance.isStale,
    priceIsFallback: params.priceProvenance.isFallback,
    historicalBarCount: params.historicalBarCount,
    historyIsStale: params.historyProvenance.isStale,
    historyIsFallback: params.historyProvenance.isFallback,
    historySource: params.historyProvenance.source,
    ema9,
    ema21,
    ema50,
    rsiValue,
    macdHistogram,
    atr,
    regime: params.regime,
    trendStrength,
    openInterestEstimate,
    oiChangePct24h,
    fundingRate,
    dominantSide: params.dominantSide,
    longShortRatio,
    tvlValue,
    globalOiUsd,
    entryZoneLow,
    entryZoneHigh,
    targetZone,
    invalidationPrice,
    rrRatio,
    normalizationErrors: errors,
    hasCriticalNormalizationError,
    normalizedAt: new Date().toISOString(),
  };
}

// ── Deterministic packet hash ─────────────────────────────────────────────────
// Stable precision constants. Same normalized input → same hash.

const P_PRICE = 2;
const P_INDICATOR = 6;
const P_RATIO = 4;

export function hashPacket(packet: NormalizedInputPacket): string {
  // Exclude time-varying metadata: normalizedAt, priceFetchedAt, priceAgeMs,
  // normalizationErrors, hasCriticalNormalizationError.
  const stable = {
    asset: packet.asset,
    timeframe: packet.timeframe,
    price: roundTo(packet.price, P_PRICE),
    priceSource: packet.priceSource,
    priceIsStale: packet.priceIsStale,
    priceIsFallback: packet.priceIsFallback,
    historicalBarCount: packet.historicalBarCount,
    historySource: packet.historySource,
    historyIsStale: packet.historyIsStale,
    historyIsFallback: packet.historyIsFallback,
    ema9: roundTo(packet.ema9, P_INDICATOR),
    ema21: roundTo(packet.ema21, P_INDICATOR),
    ema50: roundTo(packet.ema50, P_INDICATOR),
    rsiValue: roundTo(packet.rsiValue, P_INDICATOR),
    macdHistogram: roundTo(packet.macdHistogram, P_INDICATOR),
    atr: roundTo(packet.atr, P_INDICATOR),
    regime: packet.regime,
    entryZoneLow: roundTo(packet.entryZoneLow, P_PRICE),
    entryZoneHigh: roundTo(packet.entryZoneHigh, P_PRICE),
    targetZone: roundTo(packet.targetZone, P_PRICE),
    invalidationPrice: roundTo(packet.invalidationPrice, P_PRICE),
    rrRatio: roundTo(packet.rrRatio, P_RATIO),
  };

  // Sort keys for canonical representation — insertion-order independent
  const sortedKeys = Object.keys(stable).sort();
  const canonical = JSON.stringify(
    sortedKeys.reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = stable[k as keyof typeof stable];
      return acc;
    }, {}),
  );

  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
