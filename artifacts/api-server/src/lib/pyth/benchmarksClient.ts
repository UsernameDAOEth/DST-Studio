/**
 * Pyth Benchmarks TradingView shim — historical OHLC for the 15m timeframe.
 *
 * Endpoint: https://benchmarks.pyth.network/v1/shims/tradingview/history
 *   ?symbol=Crypto.{ASSET}/USD
 *   &resolution=15
 *   &from=<unix-seconds>
 *   &to=<unix-seconds>
 *
 * Free, no API key. Returns TradingView UDF history shape:
 *   { s: "ok", t: number[], o: number[], h: number[], l: number[], c: number[], v: number[] }
 *
 * On any failure the result mirrors `getHistoricalPricesWithProvenance`'s
 * fallback shape so the caller can branch uniformly. We never persist OHLC
 * separately — only the close series feeds the existing indicator pipeline.
 */
import { logger } from "../logger";
import { makeProvenance } from "../quality/types";
import type {
  HistoricalPrice,
  NormalizedHistoryResult,
} from "../dst/defillamaClient";
import { ASSET_MAP } from "../dst/defillamaClient";
import { lazerStream } from "../dst/lazerClient";

const BENCHMARKS_BASE = "https://benchmarks.pyth.network";
const RESOLUTION_15M = "15";
const RESOLUTION_15M_MS = 15 * 60 * 1000;
// 200 bars × 15min = 50 hours of history — enough for EMA50 / RSI / MACD / ATR.
const HIST_BARS = 200;
// 15m bars rotate every 15min; treat anything older than 30min as stale.
export const HISTORY_15M_STALE_THRESHOLD_MS = 30 * 60 * 1000;
// 15m sufficiency floor: 96 bars = 24h. EMA50 needs 50, but the 15m engine
// also wants enough lookback to assess prev24Price (96 bars).
export const MIN_HISTORY_BARS_15M = 96;
// Bars rotate every 15min. When the Lazer stream is feeding live ticks we
// extend the historical-bar cache to ~14min (just under one bar period) and
// overlay the in-flight bar's close from the live tick — sub-second freshness
// without re-fetching the TradingView shim every scan. When the stream is
// unavailable we fall back to the original 45s polling cache so behaviour is
// indistinguishable from the pre-stream implementation.
const CACHE_TTL_STREAM_MS = 14 * 60 * 1000;
const CACHE_TTL_POLL_MS = 45_000;
// Live ticks older than this are ignored for overlay purposes.
const LIVE_TICK_MAX_AGE_MS = 15_000;

type CacheEntry = { result: NormalizedHistoryResult; fetchedAtMs: number };
const resultCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<NormalizedHistoryResult>>();

/**
 * Per-asset effective cache TTL. Long TTL only applies when the Lazer stream
 * is currently connected AND has a fresh tick for this asset (so the overlay
 * will keep the in-flight bar's close fresh). The freshness is re-evaluated
 * on every read, so a mid-cache disconnect or tick gap immediately reverts
 * to the original ~45s polling cadence.
 */
function effectiveTtlMs(asset: string): number {
  if (!lazerStream.isConnected()) return CACHE_TTL_POLL_MS;
  const tick = lazerStream.getLatest(asset);
  if (!tick || tick.price == null || tick.publishTimeMs == null) return CACHE_TTL_POLL_MS;
  if (tick.ageMs != null && tick.ageMs > LIVE_TICK_MAX_AGE_MS) return CACHE_TTL_POLL_MS;
  return CACHE_TTL_STREAM_MS;
}

const ASSET_TO_BENCHMARK_SYMBOL: Record<string, string> = {
  BTC: "Crypto.BTC/USD",
  ETH: "Crypto.ETH/USD",
  SOL: "Crypto.SOL/USD",
};

interface TvHistoryOk {
  s: "ok";
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v?: number[];
}

interface TvHistoryNoData {
  s: "no_data" | "error";
  errmsg?: string;
  nextTime?: number;
}

type TvHistoryResponse = TvHistoryOk | TvHistoryNoData;

async function fetchJson(url: string, signal: AbortSignal): Promise<TvHistoryResponse> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "DST/1.0" },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Pyth Benchmarks fetch failed: ${url} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<TvHistoryResponse>;
}

function emptyResult(asset: string, fetchedAt: Date): NormalizedHistoryResult {
  return {
    asset,
    prices: [],
    barCount: 0,
    provenance: makeProvenance(
      "FALLBACK_ZERO",
      fetchedAt,
      null,
      HISTORY_15M_STALE_THRESHOLD_MS,
      true,
    ),
    missing: true,
    insufficient: true,
  };
}

async function fetchOnce(asset: string): Promise<NormalizedHistoryResult> {
  const fetchedAt = new Date();
  const symbol = ASSET_TO_BENCHMARK_SYMBOL[asset];
  if (!symbol || !ASSET_MAP[asset]) {
    return emptyResult(asset, fetchedAt);
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - HIST_BARS * 15 * 60;
  const url = `${BENCHMARKS_BASE}/v1/shims/tradingview/history?symbol=${encodeURIComponent(
    symbol,
  )}&resolution=${RESOLUTION_15M}&from=${from}&to=${to}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const data = await fetchJson(url, controller.signal);
    if (data.s !== "ok" || !Array.isArray(data.t) || !Array.isArray(data.c)) {
      logger.warn(
        { asset, status: data.s, errmsg: (data as TvHistoryNoData).errmsg },
        "Pyth Benchmarks: no_data / error response",
      );
      return emptyResult(asset, fetchedAt);
    }
    const prices: HistoricalPrice[] = [];
    const len = Math.min(data.t.length, data.c.length);
    for (let i = 0; i < len; i++) {
      const close = data.c[i];
      const ts = data.t[i];
      if (typeof close === "number" && Number.isFinite(close) && close > 0 && typeof ts === "number") {
        prices.push({ timestamp: ts, price: close });
      }
    }
    const lastTs = prices.length > 0 ? prices[prices.length - 1].timestamp * 1000 : null;
    return {
      asset,
      prices,
      barCount: prices.length,
      provenance: makeProvenance(
        "PYTH_BENCHMARKS",
        fetchedAt,
        lastTs,
        HISTORY_15M_STALE_THRESHOLD_MS,
        false,
      ),
      missing: prices.length === 0,
      insufficient: prices.length < MIN_HISTORY_BARS_15M,
    };
  } catch (err) {
    logger.warn({ err, asset }, "getHistorical15mWithProvenance: failed, returning empty");
    return emptyResult(asset, fetchedAt);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Overlay the latest Lazer tick onto the most recent bar's close so the
 * indicator pipeline sees sub-second-fresh prices. If the tick falls inside
 * the same 15min bucket as the last bar we replace its close; if it has
 * crossed into a new bucket we append a synthetic in-flight bar (which the
 * next scheduled refetch will replace with the canonical Benchmarks bar).
 *
 * Returns the original result unchanged when:
 *   - the historical fetch failed (caller still routes to PYTH_BENCHMARKS_UNAVAILABLE)
 *   - the Lazer stream is not connected or has no tick for this asset
 *   - the tick is older than LIVE_TICK_MAX_AGE_MS
 */
function overlayLiveTick(
  asset: string,
  base: NormalizedHistoryResult,
): NormalizedHistoryResult {
  if (base.missing || base.prices.length === 0) return base;
  if (!lazerStream.isConnected()) return base;
  const tick = lazerStream.getLatest(asset);
  if (!tick || tick.price == null || tick.publishTimeMs == null) return base;
  if (tick.ageMs != null && tick.ageMs > LIVE_TICK_MAX_AGE_MS) return base;

  const overlaid = base.prices.slice();
  const last = overlaid[overlaid.length - 1];
  const tickBarStartMs =
    Math.floor(tick.publishTimeMs / RESOLUTION_15M_MS) * RESOLUTION_15M_MS;
  const lastBarStartMs = last.timestamp * 1000;

  if (tickBarStartMs === lastBarStartMs) {
    overlaid[overlaid.length - 1] = { timestamp: last.timestamp, price: tick.price };
  } else if (tickBarStartMs > lastBarStartMs) {
    overlaid.push({ timestamp: Math.floor(tickBarStartMs / 1000), price: tick.price });
  } else {
    return base;
  }

  return {
    ...base,
    prices: overlaid,
    barCount: overlaid.length,
    provenance: makeProvenance(
      "PYTH_LAZER_STREAM",
      new Date(),
      tick.publishTimeMs,
      HISTORY_15M_STALE_THRESHOLD_MS,
      false,
    ),
  };
}

export async function getHistorical15mWithProvenance(
  asset: string,
): Promise<NormalizedHistoryResult> {
  const now = Date.now();
  const cached = resultCache.get(asset);
  // Cache TTL is re-evaluated on every read so a mid-cache stream disconnect
  // or tick gap immediately reverts to the ~45s polling cadence — preserving
  // the pre-stream resilience guarantee. When the stream is healthy and a
  // fresh per-asset tick exists, the overlay keeps the in-flight bar's close
  // current so we can safely hold the cached bars for nearly a full bar
  // period without serving stale prices.
  if (cached && !cached.result.missing && now - cached.fetchedAtMs < effectiveTtlMs(asset)) {
    return overlayLiveTick(asset, cached.result);
  }
  const existing = inFlight.get(asset);
  if (existing) return existing.then((r) => overlayLiveTick(asset, r));

  const promise = fetchOnce(asset)
    .then((result) => {
      // Only cache successful fetches so transient failures retry on next call.
      if (!result.missing) {
        resultCache.set(asset, { result, fetchedAtMs: Date.now() });
      }
      return result;
    })
    .finally(() => {
      inFlight.delete(asset);
    });
  inFlight.set(asset, promise);
  return promise.then((r) => overlayLiveTick(asset, r));
}

export const RESOLUTION_15M_BAR_MS = RESOLUTION_15M_MS;
