import { logger } from "../logger";

export interface PerpsSnapshot {
  asset: string;
  openInterestUsd: number;
  oiChange24h: number;
  oiChangePct24h: number;
  fundingRate: number;
  longShortRatio: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

const SUPPORTED_ASSETS = new Set(["BTC", "ETH", "SOL"]);

const cache = new Map<string, { value: PerpsSnapshot; expiresAt: number }>();
const inflight = new Map<string, Promise<PerpsSnapshot | null>>();

function instId(asset: string): string {
  return `${asset}-USDT-SWAP`;
}

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface OkxEnvelope<T> {
  code: string;
  msg?: string;
  data?: T;
}

function isOkxOk<T>(value: unknown): value is OkxEnvelope<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (value as { code: unknown }).code === "0"
  );
}

async function fetchCurrentOi(asset: string): Promise<number | null> {
  const data = await fetchJson(
    `https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${instId(asset)}`,
  );
  if (!isOkxOk<Array<{ oiUsd?: string }>>(data) || !Array.isArray(data.data) || data.data.length === 0) {
    return null;
  }
  const oiUsd = parseFloat(data.data[0]?.oiUsd ?? "");
  return Number.isFinite(oiUsd) && oiUsd > 0 ? oiUsd : null;
}

async function fetchFundingRate(asset: string): Promise<number | null> {
  const data = await fetchJson(
    `https://www.okx.com/api/v5/public/funding-rate?instId=${instId(asset)}`,
  );
  if (!isOkxOk<Array<{ fundingRate?: string }>>(data) || !Array.isArray(data.data) || data.data.length === 0) {
    return null;
  }
  const rate = parseFloat(data.data[0]?.fundingRate ?? "");
  return Number.isFinite(rate) ? rate : null;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function fetchOiHistory(asset: string): Promise<number | null> {
  // [ts, oiUsd, volUsd] returned most-recent first. Walk back by timestamp
  // (not by index) to find the bar closest to ~24h before the latest, so
  // partial responses or non-uniform spacing don't distort the percentage.
  const data = await fetchJson(
    `https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${asset}&period=1H`,
  );
  if (!isOkxOk<Array<[string, string, string]>>(data) || !Array.isArray(data.data) || data.data.length < 2) {
    return null;
  }
  const rows = data.data;
  const latestTs = parseInt(rows[0][0], 10);
  const latest = parseFloat(rows[0][1]);
  if (!Number.isFinite(latestTs) || !Number.isFinite(latest) || latest <= 0) return null;

  const targetTs = latestTs - TWENTY_FOUR_HOURS_MS;
  let pastIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    const ts = parseInt(rows[i][0], 10);
    if (Number.isFinite(ts) && ts <= targetTs) {
      pastIdx = i;
      break;
    }
  }
  // Require at least ~20h of history; otherwise the percentage is too noisy
  // to call "24h change" honestly. Returning null lets the caller fall back
  // to the neutral default (oiChangePct=0 → deriveSide returns NEUTRAL).
  const oldestTs = parseInt(rows[rows.length - 1][0], 10);
  if (pastIdx === -1 && Number.isFinite(oldestTs) && latestTs - oldestTs < 20 * 60 * 60 * 1000) {
    return null;
  }
  if (pastIdx === -1) pastIdx = rows.length - 1;

  const past = parseFloat(rows[pastIdx][1]);
  if (!Number.isFinite(past) || past <= 0) return null;
  return ((latest - past) / past) * 100;
}

async function fetchLongShortRatio(asset: string): Promise<number | null> {
  const data = await fetchJson(
    `https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${asset}&period=5m`,
  );
  if (!isOkxOk<Array<[string, string]>>(data) || !Array.isArray(data.data) || data.data.length === 0) {
    return null;
  }
  const ratio = parseFloat(data.data[0][1]);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

async function fetchSnapshotInternal(asset: string): Promise<PerpsSnapshot | null> {
  const [oi, funding, oiPct, lsr] = await Promise.all([
    fetchCurrentOi(asset),
    fetchFundingRate(asset),
    fetchOiHistory(asset),
    fetchLongShortRatio(asset),
  ]);

  // Required fields: OI + funding (these drive every audit gate that REAL
  // data re-enables — CROWDING_TOO_HIGH uses funding magnitude, OI_CONTEXT
  // uses dominantSide which derives from BOTH funding and oiChangePct).
  // OI history and L/S ratio are best-effort:
  //   - missing oiPct → defaults to 0, which makes deriveSide() return
  //     NEUTRAL whenever funding is also moderate — the conservative outcome.
  //     A non-neutral dominantSide therefore requires real, non-zero
  //     evidence from BOTH funding and OI flow.
  //   - missing lsr  → defaults to 1.0 (balanced); not consumed by audit
  //     logic today, only surfaced in OIContext for UI/debug.
  if (oi === null || funding === null) return null;

  const oiChangePct24h = oiPct ?? 0;
  const longShortRatio = lsr ?? 1.0;

  return {
    asset,
    openInterestUsd: oi,
    oiChange24h: (oi * oiChangePct24h) / 100,
    oiChangePct24h,
    fundingRate: funding,
    longShortRatio,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch real OI / funding / long-short ratio from OKX public perps endpoints.
 *
 * Returns null on any failure (network error, geo-block, malformed response,
 * unsupported asset). Callers must fall back to synthetic data and tag the
 * resulting OIContext as `dataConfidence: "ESTIMATED"`.
 *
 * Cached per-asset for 5 minutes; concurrent calls coalesce.
 */
export async function fetchPerpsSnapshot(asset: string): Promise<PerpsSnapshot | null> {
  if (!SUPPORTED_ASSETS.has(asset)) return null;

  const cached = cache.get(asset);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const existing = inflight.get(asset);
  if (existing) return existing;

  const p = (async () => {
    try {
      const snap = await fetchSnapshotInternal(asset);
      if (snap) {
        cache.set(asset, { value: snap, expiresAt: Date.now() + CACHE_TTL_MS });
      } else {
        logger.warn({ asset }, "[perps] OKX fetch returned null — falling back to synthetic");
      }
      return snap;
    } catch (err) {
      logger.warn({ asset, err }, "[perps] OKX fetch threw — falling back to synthetic");
      return null;
    } finally {
      inflight.delete(asset);
    }
  })();

  inflight.set(asset, p);
  return p;
}
