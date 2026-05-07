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
// Bars rotate every 15min — a ~45s in-process cache absorbs the per-scan
// fan-out (every Hermes scan triggers 3 assets × N callers) without ever
// returning a stale-by-bar result.
const CACHE_TTL_MS = 45_000;

type CacheEntry = { result: NormalizedHistoryResult; expiresAt: number };
const resultCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<NormalizedHistoryResult>>();

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

export async function getHistorical15mWithProvenance(
  asset: string,
): Promise<NormalizedHistoryResult> {
  const now = Date.now();
  const cached = resultCache.get(asset);
  if (cached && cached.expiresAt > now && !cached.result.missing) {
    return cached.result;
  }
  const existing = inFlight.get(asset);
  if (existing) return existing;

  const promise = fetchOnce(asset)
    .then((result) => {
      // Only cache successful fetches so transient failures retry on next call.
      if (!result.missing) {
        resultCache.set(asset, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return result;
    })
    .finally(() => {
      inFlight.delete(asset);
    });
  inFlight.set(asset, promise);
  return promise;
}

export const RESOLUTION_15M_BAR_MS = RESOLUTION_15M_MS;
