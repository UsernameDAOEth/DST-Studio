import { Router } from "express";
import { GetMarketSnapshotByAssetParams } from "@workspace/api-zod";
import { getCurrentPrices, getTvlForAsset, getMarketCapFromPrices, ASSET_MAP } from "../lib/dst/defillamaClient";

const router = Router();

async function buildSnapshot(asset: string) {
  const prices = await getCurrentPrices([asset]);
  const currentPrice = prices[asset]?.price ?? 0;
  const [tvl, marketCap] = await Promise.all([
    getTvlForAsset(asset),
    getMarketCapFromPrices(asset, currentPrice),
  ]);
  return {
    asset,
    price: currentPrice,
    priceChange24h: 0,
    priceChangePct24h: 0,
    volume24h: 0,
    marketCap,
    totalValueLocked: tvl,
    defiLlamaSlug: ASSET_MAP[asset]?.llamaId ?? "",
    updatedAt: new Date().toISOString(),
  };
}

router.get("/snapshot", async (_req, res) => {
  const assets = Object.keys(ASSET_MAP);
  const snapshots = await Promise.all(assets.map(buildSnapshot));
  res.json(snapshots);
});

router.get("/snapshot/:asset", async (req, res) => {
  const parsed = GetMarketSnapshotByAssetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid asset" });
    return;
  }
  const asset = parsed.data.asset.toUpperCase();
  if (!ASSET_MAP[asset]) {
    res.status(404).json({ error: `Unknown asset: ${asset}` });
    return;
  }
  const snapshot = await buildSnapshot(asset);
  res.json(snapshot);
});

export default router;
