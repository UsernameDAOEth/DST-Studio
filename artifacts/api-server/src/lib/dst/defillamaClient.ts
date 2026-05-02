import { logger } from "../logger";
import {
  DataProvenance,
  makeProvenance,
  type DataSource,
} from "../quality/types";

const DEFILLAMA_BASE = "https://api.llama.fi";
const COINS_BASE = "https://coins.llama.fi";

export const PRICE_STALE_THRESHOLD_MS = 5 * 60 * 1000;
export const HISTORY_STALE_THRESHOLD_MS = 60 * 60 * 1000;
export const MIN_HISTORY_BARS = 50;

export const ASSET_MAP: Record<string, { coingeckoId: string; llamaId: string; name: string }> = {
  ETH: { coingeckoId: "ethereum", llamaId: "coingecko:ethereum", name: "Ethereum" },
  BTC: { coingeckoId: "bitcoin", llamaId: "coingecko:bitcoin", name: "Bitcoin" },
  SOL: { coingeckoId: "solana", llamaId: "coingecko:solana", name: "Solana" },
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "DST/1.0" },
  });
  if (!res.ok) {
    throw new Error(`DefiLlama fetch failed: ${url} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Raw types returned by the API ─────────────────────────────────────────────

export interface CoinPrice {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
}

// ── Normalized price result with provenance ───────────────────────────────────

export interface NormalizedPriceResult {
  asset: string;
  price: number;
  symbol: string;
  apiConfidence: number;
  provenance: DataProvenance;
  missing: boolean;
}

export interface NormalizedHistoryResult {
  asset: string;
  prices: HistoricalPrice[];
  barCount: number;
  provenance: DataProvenance;
  missing: boolean;
  insufficient: boolean;
}

// ── Price fetching ────────────────────────────────────────────────────────────

export async function getCurrentPricesWithProvenance(
  assets: string[]
): Promise<Record<string, NormalizedPriceResult>> {
  const fetchedAt = new Date();
  const coins = assets.map((a) => ASSET_MAP[a]?.llamaId).filter(Boolean).join(",");
  const result: Record<string, NormalizedPriceResult> = {};

  let rawCoins: Record<string, CoinPrice> = {};
  let fetchFailed = false;

  try {
    const data = await fetchJson<{ coins: Record<string, CoinPrice> }>(
      `${COINS_BASE}/prices/current/${coins}`
    );
    rawCoins = data.coins ?? {};
  } catch (err) {
    logger.warn({ err, assets }, "getCurrentPricesWithProvenance: fetch failed, returning fallback zeros");
    fetchFailed = true;
  }

  for (const asset of assets) {
    const llamaId = ASSET_MAP[asset]?.llamaId;
    const raw = llamaId ? rawCoins[llamaId] : undefined;

    if (fetchFailed || !raw || typeof raw.price !== "number" || raw.price <= 0) {
      result[asset] = {
        asset,
        price: 0,
        symbol: asset,
        apiConfidence: 0,
        provenance: makeProvenance(
          fetchFailed ? ("FALLBACK_ZERO" as DataSource) : ("DEFILLAMA_COINS" as DataSource),
          fetchedAt,
          null,
          PRICE_STALE_THRESHOLD_MS,
          true,
        ),
        missing: true,
      };
    } else {
      const dataTimestampMs = raw.timestamp ? raw.timestamp * 1000 : null;
      result[asset] = {
        asset,
        price: raw.price,
        symbol: raw.symbol ?? asset,
        apiConfidence: raw.confidence ?? 0,
        provenance: makeProvenance(
          "DEFILLAMA_COINS",
          fetchedAt,
          dataTimestampMs,
          PRICE_STALE_THRESHOLD_MS,
          false,
        ),
        missing: false,
      };
    }
  }

  return result;
}

export async function getCurrentPrices(assets: string[]): Promise<Record<string, CoinPrice>> {
  const normalized = await getCurrentPricesWithProvenance(assets);
  const result: Record<string, CoinPrice> = {};
  for (const [asset, n] of Object.entries(normalized)) {
    if (!n.missing) {
      result[asset] = {
        price: n.price,
        symbol: n.symbol,
        timestamp: n.provenance.dataTimestamp
          ? new Date(n.provenance.dataTimestamp).getTime() / 1000
          : Date.now() / 1000,
        confidence: n.apiConfidence,
      };
    }
  }
  return result;
}

// ── Historical prices ─────────────────────────────────────────────────────────

export interface HistoricalPrice {
  timestamp: number;
  price: number;
}

export async function getHistoricalPricesWithProvenance(
  asset: string,
  spanHours = 200
): Promise<NormalizedHistoryResult> {
  const fetchedAt = new Date();
  const llamaId = ASSET_MAP[asset]?.llamaId;
  if (!llamaId) {
    return {
      asset,
      prices: [],
      barCount: 0,
      provenance: makeProvenance("FALLBACK_ZERO", fetchedAt, null, HISTORY_STALE_THRESHOLD_MS, true),
      missing: true,
      insufficient: true,
    };
  }

  const end = Math.floor(Date.now() / 1000);
  const start = end - spanHours * 3600;
  const period = "4h";

  try {
    const data = await fetchJson<{ coins: Record<string, { prices: HistoricalPrice[] }> }>(
      `${COINS_BASE}/chart/${llamaId}?start=${start}&span=${Math.ceil(spanHours / 4)}&period=${period}`
    );
    const prices = data.coins[llamaId]?.prices ?? [];
    const lastTs = prices.length > 0 ? prices[prices.length - 1].timestamp * 1000 : null;

    return {
      asset,
      prices,
      barCount: prices.length,
      provenance: makeProvenance(
        "DEFILLAMA_COINS",
        fetchedAt,
        lastTs,
        HISTORY_STALE_THRESHOLD_MS,
        false,
      ),
      missing: prices.length === 0,
      insufficient: prices.length < MIN_HISTORY_BARS,
    };
  } catch (err) {
    logger.warn({ err, asset }, "getHistoricalPricesWithProvenance: failed, returning empty");
    return {
      asset,
      prices: [],
      barCount: 0,
      provenance: makeProvenance("FALLBACK_ZERO", fetchedAt, null, HISTORY_STALE_THRESHOLD_MS, true),
      missing: true,
      insufficient: true,
    };
  }
}

export async function getHistoricalPrices(asset: string, spanHours = 200): Promise<HistoricalPrice[]> {
  const result = await getHistoricalPricesWithProvenance(asset, spanHours);
  return result.prices;
}

// ── Derivatives / global data ─────────────────────────────────────────────────

export interface GlobalDataResult {
  totalLiquidationsUsd: number;
  totalOpenInterestUsd: number;
  fundingRate?: number;
  provenance: DataProvenance;
  missing: boolean;
}

export async function getGlobalDerivativeData(): Promise<GlobalDataResult> {
  const fetchedAt = new Date();
  try {
    const data = await fetchJson<{
      totalLiquidations: { currentDayLiquidations: number };
      totalOpenInterest: number;
    }>(`${DEFILLAMA_BASE}/overview/derivatives`);
    return {
      totalLiquidationsUsd: data.totalLiquidations?.currentDayLiquidations ?? 0,
      totalOpenInterestUsd: data.totalOpenInterest ?? 0,
      provenance: makeProvenance("DEFILLAMA_DERIVATIVES", fetchedAt, null, PRICE_STALE_THRESHOLD_MS, false),
      missing: false,
    };
  } catch (err) {
    logger.warn({ err }, "getGlobalDerivativeData: failed, returning zeros");
    return {
      totalLiquidationsUsd: 0,
      totalOpenInterestUsd: 0,
      provenance: makeProvenance("FALLBACK_ZERO", fetchedAt, null, PRICE_STALE_THRESHOLD_MS, true),
      missing: true,
    };
  }
}

// ── TVL ───────────────────────────────────────────────────────────────────────

export interface TvlResult {
  tvl: number;
  provenance: DataProvenance;
  missing: boolean;
}

export async function getTvlForAssetWithProvenance(asset: string): Promise<TvlResult> {
  const fetchedAt = new Date();
  const slugMap: Record<string, string> = { ETH: "ethereum", BTC: "bitcoin", SOL: "solana" };
  const slug = slugMap[asset];
  if (!slug) {
    return {
      tvl: 0,
      provenance: makeProvenance("FALLBACK_ZERO", fetchedAt, null, PRICE_STALE_THRESHOLD_MS, true),
      missing: true,
    };
  }
  try {
    const data = await fetchJson<{ tvl: number }>(`${DEFILLAMA_BASE}/tvl/${slug}`);
    return {
      tvl: typeof data?.tvl === "number" ? data.tvl : 0,
      provenance: makeProvenance("DEFILLAMA_TVL", fetchedAt, null, PRICE_STALE_THRESHOLD_MS, false),
      missing: typeof data?.tvl !== "number",
    };
  } catch (err) {
    logger.warn({ err, asset }, "getTvlForAsset: failed, returning zero");
    return {
      tvl: 0,
      provenance: makeProvenance("FALLBACK_ZERO", fetchedAt, null, PRICE_STALE_THRESHOLD_MS, true),
      missing: true,
    };
  }
}

export async function getTvlForAsset(asset: string): Promise<number> {
  const result = await getTvlForAssetWithProvenance(asset);
  return result.tvl;
}

// ── Market cap (derived from fixed supply constants) ──────────────────────────

export async function getMarketCapFromPrices(asset: string, price: number): Promise<number> {
  const supplyMap: Record<string, number> = {
    ETH: 120_000_000,
    BTC: 19_700_000,
    SOL: 465_000_000,
  };
  return (supplyMap[asset] ?? 0) * price;
}

export interface ProtocolTvl {
  tvl: number;
  change_1d?: number;
  change_7d?: number;
}
