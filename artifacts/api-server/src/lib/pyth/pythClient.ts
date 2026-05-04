import { PythPriceData } from "../hermes/types";
import { logger } from "../logger";
import { getConstraints } from "../hermes/constraints";

// ── Feed registry (expandable) ────────────────────────────────────────────────

export const PYTH_PRICE_IDS: Record<string, string> = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

export const ASSET_TO_SYMBOL: Record<string, string> = {
  BTC: "BTC/USD",
  ETH: "ETH/USD",
  SOL: "SOL/USD",
};

const ID_TO_ASSET: Record<string, string> = Object.fromEntries(
  Object.entries(PYTH_PRICE_IDS).map(([asset, id]) => [id, asset])
);

const PYTH_HERMES_BASE = "https://hermes.pyth.network";
const PRICE_LATEST_URL = `${PYTH_HERMES_BASE}/v2/updates/price/latest`;
const PRICE_FEEDS_URL = `${PYTH_HERMES_BASE}/v2/price_feeds`;

const STALE_THRESHOLD_SEC = 60;
const CONFIDENCE_WIDE_THRESHOLD = 0.01;

// ── Canonical PythSnapshot packet model ───────────────────────────────────────

export interface PythSnapshot {
  provider: "PYTH_HERMES_V2";
  source: "PYTH_HERMES";
  feedId: string;
  symbol: string;
  asset: string;
  price: number;
  confidence: number;
  confidencePct: number;
  confidenceStatus: "HIGH" | "MEDIUM" | "LOW";
  expo: number;
  publishTime: string;
  stalenessSec: number;
  isStale: boolean;
  isConfidenceWide: boolean;
  emaPrice: number;
  emaConfidence: number;
  metadata: {
    prevPublishTime: number;
    prevPrice: string | null;
    prevConf: string | null;
  };
  raw: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  fetchedAt: string;
}

// ── Feed discovery ─────────────────────────────────────────────────────────────

export interface PythFeedInfo {
  feedId: string;
  symbol: string;
  asset: string;
  description: string;
  assetType: string;
}

export async function discoverFeed(symbol: string): Promise<PythFeedInfo | null> {
  try {
    const url = new URL(PRICE_FEEDS_URL);
    url.searchParams.set("query", symbol);
    url.searchParams.set("asset_type", "crypto");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const feeds = await res.json() as Array<{
      id: string;
      attributes: { symbol: string; description: string; asset_type: string };
    }>;
    if (!feeds.length) return null;
    const exact = feeds.find((f) => f.attributes.symbol === symbol) ?? feeds[0];
    const asset =
      Object.entries(ASSET_TO_SYMBOL).find(([, s]) => s === symbol)?.[0] ??
      symbol.split("/")[0];
    return {
      feedId: exact.id,
      symbol: exact.attributes.symbol,
      asset,
      description: exact.attributes.description,
      assetType: exact.attributes.asset_type,
    };
  } catch (err) {
    logger.warn({ symbol, err }, "Pyth feed discovery failed");
    return null;
  }
}

export async function discoverAllFeeds(): Promise<PythFeedInfo[]> {
  const results = await Promise.allSettled(
    Object.values(ASSET_TO_SYMBOL).map((sym) => discoverFeed(sym))
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<PythFeedInfo> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}

// ── Snapshot parsing ──────────────────────────────────────────────────────────

function parseRawItem(item: {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
  ema_price: { price: string; conf: string; expo: number };
  metadata?: { prev_publish_time?: number; prev_price?: string; prev_conf?: string };
}): PythSnapshot {
  const expo = item.price.expo;
  const multiplier = Math.pow(10, expo);
  const price = Number(item.price.price) * multiplier;
  const confidence = Number(item.price.conf) * multiplier;
  const emaPrice = Number(item.ema_price.price) * Math.pow(10, item.ema_price.expo);
  const emaConf = Number(item.ema_price.conf) * Math.pow(10, item.ema_price.expo);
  const confidencePct = price > 0 ? (confidence / price) * 100 : 100;
  const publishTimeMs = item.price.publish_time * 1000;
  const publishTime = new Date(publishTimeMs).toISOString();
  const stalenessSec = (Date.now() - publishTimeMs) / 1000;
  const isStale = stalenessSec > STALE_THRESHOLD_SEC;
  const isConfidenceWide = price > 0 && confidence / price > CONFIDENCE_WIDE_THRESHOLD;

  let confidenceStatus: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (confidencePct < 0.1) confidenceStatus = "HIGH";
  else if (confidencePct < 1.0) confidenceStatus = "MEDIUM";

  const normalizedId = item.id.startsWith("0x") ? item.id.slice(2) : item.id;
  const asset = ID_TO_ASSET[normalizedId] ?? "UNKNOWN";
  const symbol = ASSET_TO_SYMBOL[asset] ?? asset;

  return {
    provider: "PYTH_HERMES_V2",
    source: "PYTH_HERMES",
    feedId: normalizedId,
    symbol,
    asset,
    price,
    confidence,
    confidencePct,
    confidenceStatus,
    expo,
    publishTime,
    stalenessSec,
    isStale,
    isConfidenceWide,
    emaPrice,
    emaConfidence: emaConf,
    metadata: {
      prevPublishTime: item.metadata?.prev_publish_time ?? 0,
      prevPrice: item.metadata?.prev_price ?? null,
      prevConf: item.metadata?.prev_conf ?? null,
    },
    raw: {
      price: item.price.price,
      conf: item.price.conf,
      expo: item.price.expo,
      publish_time: item.price.publish_time,
    },
    fetchedAt: new Date().toISOString(),
  };
}

// ── Snapshot fetch ────────────────────────────────────────────────────────────

export async function fetchPythSnapshots(assets: string[]): Promise<PythSnapshot[]> {
  const ids = assets
    .map((a) => PYTH_PRICE_IDS[a.toUpperCase()])
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return [];

  const url = new URL(PRICE_LATEST_URL);
  ids.forEach((id) => url.searchParams.append("ids[]", id));
  url.searchParams.append("encoding", "hex");
  url.searchParams.append("parsed", "true");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Pyth API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as {
      parsed: Array<{
        id: string;
        price: { price: string; conf: string; expo: number; publish_time: number };
        ema_price: { price: string; conf: string; expo: number };
        metadata?: { prev_publish_time?: number; prev_price?: string; prev_conf?: string };
      }>;
    };
    return data.parsed.map(parseRawItem);
  } catch (error) {
    logger.error({ error, assets }, "Failed to fetch Pyth snapshots");
    return [];
  }
}

export async function fetchPythSnapshot(asset: string): Promise<PythSnapshot | null> {
  const snaps = await fetchPythSnapshots([asset]);
  return snaps.length > 0 ? snaps[0] : null;
}

// ── Legacy API (backward compat) ──────────────────────────────────────────────

export async function fetchPythPrices(assets: string[]): Promise<PythPriceData[]> {
  const snaps = await fetchPythSnapshots(assets);
  const constraints = getConstraints();
  return snaps.map((snap) => ({
    asset: snap.asset,
    pythId: snap.feedId,
    price: snap.price,
    confidence: snap.confidence,
    confidenceRatio: snap.price > 0 ? snap.confidence / snap.price : 1,
    confidenceStatus: snap.confidenceStatus,
    emaPrice: snap.emaPrice,
    emaConfidence: snap.emaConfidence,
    publishTime: snap.publishTime,
    slotAge: 0,
    fresh: !snap.isStale,
    influencesProcessVerdict: constraints.pythConfidenceFilter,
  }));
}

export async function fetchPythPrice(asset: string): Promise<PythPriceData | null> {
  const prices = await fetchPythPrices([asset]);
  return prices.length > 0 ? prices[0] : null;
}
