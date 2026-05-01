import { logger } from "../logger";

const DEFILLAMA_BASE = "https://api.llama.fi";
const COINS_BASE = "https://coins.llama.fi";

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

export interface CoinPrice {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
}

export async function getCurrentPrices(assets: string[]): Promise<Record<string, CoinPrice>> {
  const coins = assets.map((a) => ASSET_MAP[a]?.llamaId).filter(Boolean).join(",");
  const data = await fetchJson<{ coins: Record<string, CoinPrice> }>(`${COINS_BASE}/prices/current/${coins}`);
  const result: Record<string, CoinPrice> = {};
  for (const asset of assets) {
    const llamaId = ASSET_MAP[asset]?.llamaId;
    if (llamaId && data.coins[llamaId]) {
      result[asset] = data.coins[llamaId];
    }
  }
  return result;
}

export interface HistoricalPrice {
  timestamp: number;
  price: number;
}

export async function getHistoricalPrices(asset: string, spanHours = 200): Promise<HistoricalPrice[]> {
  const llamaId = ASSET_MAP[asset]?.llamaId;
  if (!llamaId) throw new Error(`Unknown asset: ${asset}`);

  const end = Math.floor(Date.now() / 1000);
  const start = end - spanHours * 3600;
  const period = "4h";

  try {
    const data = await fetchJson<{ coins: Record<string, { prices: HistoricalPrice[] }> }>(
      `${COINS_BASE}/chart/${llamaId}?start=${start}&span=${Math.ceil(spanHours / 4)}&period=${period}`
    );
    return data.coins[llamaId]?.prices ?? [];
  } catch (err) {
    logger.warn({ err, asset }, "Failed to fetch historical prices, returning empty");
    return [];
  }
}

export interface GlobalData {
  totalLiquidationsUsd: number;
  totalOpenInterestUsd: number;
  fundingRate?: number;
}

export async function getGlobalDerivativeData(): Promise<GlobalData> {
  try {
    const data = await fetchJson<{
      totalLiquidations: { currentDayLiquidations: number };
      totalOpenInterest: number;
    }>(`${DEFILLAMA_BASE}/overview/derivatives`);
    return {
      totalLiquidationsUsd: data.totalLiquidations?.currentDayLiquidations ?? 0,
      totalOpenInterestUsd: data.totalOpenInterest ?? 0,
    };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch derivatives overview");
    return { totalLiquidationsUsd: 0, totalOpenInterestUsd: 0 };
  }
}

export interface ProtocolTvl {
  tvl: number;
  change_1d?: number;
  change_7d?: number;
}

export async function getTvlForAsset(asset: string): Promise<number> {
  const slugMap: Record<string, string> = { ETH: "ethereum", BTC: "bitcoin", SOL: "solana" };
  const slug = slugMap[asset];
  if (!slug) return 0;
  try {
    const data = await fetchJson<{ tvl: number }>(`${DEFILLAMA_BASE}/tvl/${slug}`);
    return typeof data?.tvl === "number" ? data.tvl : 0;
  } catch (err) {
    logger.warn({ err, asset }, "Failed to fetch TVL");
    return 0;
  }
}

export async function getMarketCapFromPrices(asset: string, price: number): Promise<number> {
  const supplyMap: Record<string, number> = {
    ETH: 120_000_000,
    BTC: 19_700_000,
    SOL: 465_000_000,
  };
  return (supplyMap[asset] ?? 0) * price;
}
