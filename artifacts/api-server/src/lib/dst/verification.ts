import type { NormalizedInputPacket } from "./normalization";

// ── Check codes ───────────────────────────────────────────────────────────────

export type VerificationCheckCode =
  | "PRICE_NOT_ZERO"
  | "MARKET_DATA_FRESH"
  | "HISTORY_SUFFICIENT"
  | "REGIME_EXISTS"
  | "INVALIDATION_EXISTS"
  | "RR_THRESHOLD"
  | "ENTRY_NOT_LATE"
  | "SIGNAL_REGIME_ALIGNED"
  | "SOURCES_CONSISTENT"
  | "PYTH_CONFIRMS";

export type VerificationStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

// ── Failure mode codes ────────────────────────────────────────────────────────
// Higher-level abstraction over quality flags. Surfaced on the packet and in UI.

export type FailureModeCode =
  | "DETERMINISM_VIOLATION"
  | "INPUT_NORMALIZATION_ERROR"
  | "STALE_MARKET_STATE"
  | "MISSING_REQUIRED_FIELD"
  | "CONFLICTING_SOURCE_DATA"
  | "SEMANTIC_LAYER_UNAVAILABLE"
  | "FALLBACK_ONLY_MODE";

// ── Per-check verification status ─────────────────────────────────────────────

export interface VerificationCheck {
  code: VerificationCheckCode;
  status: VerificationStatus;
  detail: string;
  sourceDependency: string;
  isHardFail: boolean;
  failureModeCode?: FailureModeCode;
}

// ── Full verification report ──────────────────────────────────────────────────

export interface VerificationReport {
  packetHash: string;
  normalizationError: boolean;
  fastPathPassed: boolean;
  shortCircuited: boolean;
  shortCircuitReason: string | null;
  checks: VerificationCheck[];
  failureCodes: FailureModeCode[];
  degradedState: boolean;
  fallbackOnlyMode: boolean;
  semanticLayerAllowed: boolean;
  hermesEvidenceOnly: true;
  verifiedAt: string;
}

// ── Builder helpers ───────────────────────────────────────────────────────────

function mk(
  code: VerificationCheckCode,
  status: VerificationStatus,
  detail: string,
  sourceDependency: string,
  isHardFail: boolean,
  failureModeCode?: FailureModeCode,
): VerificationCheck {
  return { code, status, detail, sourceDependency, isHardFail, failureModeCode };
}

function buildReport(
  packetHash: string,
  n: NormalizedInputPacket,
  checks: VerificationCheck[],
  shortCircuited: boolean,
  shortCircuitReason: string | null,
): VerificationReport {
  const hardFails = checks.filter((c) => c.isHardFail && c.status === "FAIL");
  const fastPathPassed = hardFails.length === 0;

  const failureCodes = [
    ...new Set(
      checks
        .filter((c) => c.status === "FAIL" || c.status === "WARN")
        .map((c) => c.failureModeCode)
        .filter((c): c is FailureModeCode => c !== undefined),
    ),
  ];

  const fallbackOnlyMode = failureCodes.includes("FALLBACK_ONLY_MODE");
  const degradedState = !fastPathPassed || checks.some((c) => c.status === "WARN");
  const semanticLayerAllowed = fastPathPassed && !n.hasCriticalNormalizationError;

  return {
    packetHash,
    normalizationError: n.hasCriticalNormalizationError || n.normalizationErrors.length > 0,
    fastPathPassed,
    shortCircuited,
    shortCircuitReason,
    checks,
    failureCodes,
    degradedState,
    fallbackOnlyMode,
    semanticLayerAllowed,
    hermesEvidenceOnly: true,
    verifiedAt: new Date().toISOString(),
  };
}

// ── Fast-path verification ────────────────────────────────────────────────────
// Runs 10 explicit checks in order. Hard-fail checks short-circuit immediately.
// Semantic/narrative layer is only allowed when fast path passes entirely.
// Hermes findings are EVIDENCE ONLY — they are not read here.

export interface FastPathParams {
  normalizedPacket: NormalizedInputPacket;
  packetHash: string;
  direction: string;
  minRRThreshold: number;
  entryQuality: string;
  minHistoryBars: number;
  pythVerdict?: "CONFIRMS" | "DIVERGES" | "UNAVAILABLE" | "SKIPPED";
}

export function runFastPathVerification(params: FastPathParams): VerificationReport {
  const { normalizedPacket: n, packetHash, direction, minRRThreshold, entryQuality, minHistoryBars } = params;
  const checks: VerificationCheck[] = [];

  function add(c: VerificationCheck) {
    checks.push(c);
  }

  // ── 1. PRICE_NOT_ZERO — hard ─────────────────────────────────────────────────
  if (n.price <= 0) {
    add(mk(
      "PRICE_NOT_ZERO", "FAIL",
      `Price is ${n.price} — cannot compute any signal from a zero or negative price.`,
      n.priceSource, true, "INPUT_NORMALIZATION_ERROR",
    ));
    return buildReport(packetHash, n, checks, true, "PRICE_NOT_ZERO: price is zero or negative");
  }
  add(mk("PRICE_NOT_ZERO", "PASS", `Price ${n.price} is positive and finite.`, n.priceSource, true));

  // ── 2. MARKET_DATA_FRESH — hard on fallback, warn on stale ──────────────────
  if (n.priceIsFallback) {
    add(mk(
      "MARKET_DATA_FRESH", "FAIL",
      `Price source is FALLBACK (${n.priceSource}) — no live market data available.`,
      n.priceSource, true, "FALLBACK_ONLY_MODE",
    ));
    return buildReport(packetHash, n, checks, true, "MARKET_DATA_FRESH: price is fallback-only");
  }
  if (n.priceIsStale) {
    add(mk(
      "MARKET_DATA_FRESH", "WARN",
      `Price is stale — ${Math.round(n.priceAgeMs / 1000)}s old, threshold exceeded. Confidence degraded.`,
      n.priceSource, false, "STALE_MARKET_STATE",
    ));
  } else {
    add(mk(
      "MARKET_DATA_FRESH", "PASS",
      `Price fresh — ${Math.round(n.priceAgeMs / 1000)}s old from ${n.priceSource}.`,
      n.priceSource, true,
    ));
  }

  // ── 3. HISTORY_SUFFICIENT — hard ─────────────────────────────────────────────
  if (n.historicalBarCount < minHistoryBars) {
    add(mk(
      "HISTORY_SUFFICIENT", "FAIL",
      `Only ${n.historicalBarCount}/${minHistoryBars} bars — indicators are unreliable below this minimum.`,
      n.historySource, true, "MISSING_REQUIRED_FIELD",
    ));
    return buildReport(packetHash, n, checks, true, `HISTORY_SUFFICIENT: ${n.historicalBarCount}/${minHistoryBars} bars`);
  }
  if (n.historyIsStale) {
    add(mk(
      "HISTORY_SUFFICIENT", "WARN",
      `${n.historicalBarCount} bars present but history feed is stale.`,
      n.historySource, false, "STALE_MARKET_STATE",
    ));
  } else {
    add(mk(
      "HISTORY_SUFFICIENT", "PASS",
      `${n.historicalBarCount} bars from ${n.historySource} — above minimum ${minHistoryBars}.`,
      n.historySource, true,
    ));
  }

  // ── 4. REGIME_EXISTS — hard ───────────────────────────────────────────────────
  if (!n.regime || n.regime === "UNDEFINED") {
    add(mk(
      "REGIME_EXISTS", "FAIL",
      `Regime is UNDEFINED — no structural market state derivable from the indicator set.`,
      "DERIVED", true, "MISSING_REQUIRED_FIELD",
    ));
    return buildReport(packetHash, n, checks, true, "REGIME_EXISTS: regime is UNDEFINED");
  }
  add(mk(
    "REGIME_EXISTS", "PASS",
    `Regime: ${n.regime}. EMA stack ${n.ema9.toFixed(2)} / ${n.ema21.toFixed(2)} / ${n.ema50.toFixed(2)} derivable.`,
    "DERIVED", true,
  ));

  // ── 5. INVALIDATION_EXISTS — hard when directional ────────────────────────────
  if (direction === "WAIT") {
    add(mk("INVALIDATION_EXISTS", "SKIP", "Direction is WAIT — invalidation check not applicable.", "DERIVED", false));
  } else if (n.invalidationPrice <= 0 || n.invalidationPrice === n.price) {
    add(mk(
      "INVALIDATION_EXISTS", "FAIL",
      `Invalidation price (${n.invalidationPrice}) is absent or equals entry price — stop cannot be defined.`,
      "DERIVED", true, "MISSING_REQUIRED_FIELD",
    ));
  } else {
    add(mk(
      "INVALIDATION_EXISTS", "PASS",
      `Invalidation at ${n.invalidationPrice.toFixed(2)} — defined, differs from price ${n.price.toFixed(2)}.`,
      "DERIVED", true,
    ));
  }

  // ── 6. RR_THRESHOLD — hard when directional ────────────────────────────────────
  if (direction === "WAIT") {
    add(mk("RR_THRESHOLD", "SKIP", "Direction is WAIT — R/R check not applicable.", "DERIVED", false));
  } else if (n.rrRatio < minRRThreshold) {
    add(mk(
      "RR_THRESHOLD", "FAIL",
      `R/R ${n.rrRatio.toFixed(2)} below minimum ${minRRThreshold}. Process discipline requires rejection.`,
      "DERIVED", true, "MISSING_REQUIRED_FIELD",
    ));
  } else {
    add(mk(
      "RR_THRESHOLD", "PASS",
      `R/R ${n.rrRatio.toFixed(2)} meets or exceeds minimum ${minRRThreshold}.`,
      "DERIVED", true,
    ));
  }

  // ── 7. ENTRY_NOT_LATE — soft ──────────────────────────────────────────────────
  if (entryQuality === "INVALID") {
    add(mk(
      "ENTRY_NOT_LATE", "FAIL",
      "Entry quality INVALID — insufficient indicator data to assess entry timing.",
      "DERIVED", true, "MISSING_REQUIRED_FIELD",
    ));
  } else if (entryQuality === "LATE") {
    add(mk(
      "ENTRY_NOT_LATE", "WARN",
      "Entry quality LATE — price extended beyond optimal zone by more than 1.5× ATR.",
      "DERIVED", false,
    ));
  } else {
    add(mk(
      "ENTRY_NOT_LATE", "PASS",
      `Entry quality: ${entryQuality}. Within acceptable zone relative to EMA9 and ATR.`,
      "DERIVED", false,
    ));
  }

  // ── 8. SIGNAL_REGIME_ALIGNED — hard on clear counter-regime, warn on ranging ──
  const regimeLong = n.regime === "BULL" && direction === "LONG";
  const regimeShort = n.regime === "BEAR" && direction === "SHORT";
  const isAligned = regimeLong || regimeShort || direction === "WAIT";
  const isRanging = n.regime === "RANGING";

  if (!isAligned && !isRanging && direction !== "WAIT") {
    add(mk(
      "SIGNAL_REGIME_ALIGNED", "FAIL",
      `Direction ${direction} conflicts with regime ${n.regime} — counter-regime trade, structural mismatch.`,
      "DERIVED", true, "CONFLICTING_SOURCE_DATA",
    ));
  } else if (isRanging && direction !== "WAIT") {
    add(mk(
      "SIGNAL_REGIME_ALIGNED", "WARN",
      `Regime RANGING — directional signal in ranging market is secondary-family. Lower structural conviction.`,
      "DERIVED", false,
    ));
  } else {
    add(mk(
      "SIGNAL_REGIME_ALIGNED", "PASS",
      `Direction ${direction} aligned with regime ${n.regime}.`,
      "DERIVED", false,
    ));
  }

  // ── 9. SOURCES_CONSISTENT — soft ──────────────────────────────────────────────
  const allFallback = n.priceIsFallback && n.historyIsFallback;
  const mixedFallback = n.priceIsFallback !== n.historyIsFallback;

  if (allFallback) {
    add(mk(
      "SOURCES_CONSISTENT", "FAIL",
      "All data layers are in fallback mode — no live market data available from any source.",
      `${n.priceSource} / ${n.historySource}`, true, "FALLBACK_ONLY_MODE",
    ));
  } else if (mixedFallback) {
    add(mk(
      "SOURCES_CONSISTENT", "WARN",
      `Mixed reliability: price=${n.priceIsFallback ? "FALLBACK" : "LIVE"}, history=${n.historyIsFallback ? "FALLBACK" : "LIVE"}. Cross-layer consistency reduced.`,
      `${n.priceSource} / ${n.historySource}`, false, "CONFLICTING_SOURCE_DATA",
    ));
  } else {
    add(mk(
      "SOURCES_CONSISTENT", "PASS",
      `Price (${n.priceSource}) and history (${n.historySource}) both from live sources.`,
      `${n.priceSource} / ${n.historySource}`, false,
    ));
  }

  // ── 10. PYTH_CONFIRMS — soft, only when checked ────────────────────────────────
  const pv = params.pythVerdict;
  if (!pv || pv === "SKIPPED") {
    add(mk("PYTH_CONFIRMS", "SKIP", "Pyth secondary verifier disabled in Hermes constraints.", "PYTH_HERMES", false));
  } else if (pv === "UNAVAILABLE") {
    add(mk("PYTH_CONFIRMS", "WARN", "Pyth Hermes secondary verifier unavailable — cross-check incomplete.", "PYTH_HERMES", false));
  } else if (pv === "DIVERGES") {
    add(mk("PYTH_CONFIRMS", "WARN", "Pyth price diverges from primary source — cross-source price conflict.", "PYTH_HERMES", false, "CONFLICTING_SOURCE_DATA"));
  } else {
    add(mk("PYTH_CONFIRMS", "PASS", "Pyth secondary verifier confirms primary price within threshold.", "PYTH_HERMES", false));
  }

  return buildReport(packetHash, n, checks, false, null);
}
