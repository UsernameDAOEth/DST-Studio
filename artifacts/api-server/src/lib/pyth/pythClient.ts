import { PythPriceData } from "../hermes/types";
import { logger } from "../logger";
import { getConstraints } from "../hermes/constraints";

export const PYTH_PRICE_IDS: Record<string, string> = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

const PYTH_BASE_URL = "https://hermes.pyth.network/v2/updates/price/latest";

const ID_TO_ASSET: Record<string, string> = Object.fromEntries(
  Object.entries(PYTH_PRICE_IDS).map(([asset, id]) => [id, asset])
);

export async function fetchPythPrices(assets: string[]): Promise<PythPriceData[]> {
  const ids = assets
    .map((a) => PYTH_PRICE_IDS[a.toUpperCase()])
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return [];

  const url = new URL(PYTH_BASE_URL);
  ids.forEach((id) => url.searchParams.append("ids[]", id));
  url.searchParams.append("encoding", "hex");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Pyth API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as { parsed: Array<{
      id: string;
      price: { price: string; conf: string; expo: number; publish_time: number };
      ema_price: { price: string; conf: string; expo: number };
      status?: string;
    }> };

    const constraints = getConstraints();

    return data.parsed.map((item) => {
      const expo = item.price.expo;
      const price = Number(item.price.price) * Math.pow(10, expo);
      const conf = Number(item.price.conf) * Math.pow(10, expo);
      const emaPrice = Number(item.ema_price.price) * Math.pow(10, item.ema_price.expo);
      const emaConf = Number(item.ema_price.conf) * Math.pow(10, item.ema_price.expo);
      const confidenceRatio = price > 0 ? conf / price : 1;
      const publishTimeMs = item.price.publish_time * 1000;
      const publishTime = new Date(publishTimeMs).toISOString();
      const fresh = (Date.now() - publishTimeMs) < 30000;
      const normalizedId = item.id.startsWith("0x") ? item.id.slice(2) : item.id;
      const asset = ID_TO_ASSET[normalizedId] ?? "UNKNOWN";

      let confidenceStatus: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (confidenceRatio < 0.001) confidenceStatus = "HIGH";
      else if (confidenceRatio < 0.01) confidenceStatus = "MEDIUM";

      return {
        asset,
        pythId: item.id,
        price,
        confidence: conf,
        confidenceRatio,
        confidenceStatus,
        emaPrice,
        emaConfidence: emaConf,
        publishTime,
        slotAge: 0,
        fresh,
        influencesProcessVerdict: constraints.pythConfidenceFilter,
      } satisfies PythPriceData;
    });
  } catch (error) {
    logger.error({ error, assets }, "Failed to fetch Pyth prices");
    return [];
  }
}

export async function fetchPythPrice(asset: string): Promise<PythPriceData | null> {
  const prices = await fetchPythPrices([asset]);
  return prices.length > 0 ? prices[0] : null;
}
