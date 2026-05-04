import { Router } from "express";
import {
  fetchPythPrices,
  fetchPythPrice,
  fetchPythSnapshot,
  fetchPythSnapshots,
  discoverFeed,
  discoverAllFeeds,
  PYTH_PRICE_IDS,
} from "../lib/pyth/pythClient";

const router = Router();

router.get("/prices", async (_, res) => {
  const assets = Object.keys(PYTH_PRICE_IDS);
  res.json(await fetchPythPrices(assets));
});

router.get("/prices/:asset", async (req, res) => {
  const asset = req.params.asset.toUpperCase();
  if (!PYTH_PRICE_IDS[asset]) {
    res.status(404).json({ error: "Asset not supported by Pyth" });
    return;
  }
  const data = await fetchPythPrice(asset);
  if (!data) { res.status(503).json({ error: "Pyth unavailable" }); return; }
  res.json(data);
});

router.get("/feeds", async (_, res) => {
  const feeds = await discoverAllFeeds();
  res.json(feeds);
});

router.get("/feeds/:symbol", async (req, res) => {
  const raw = decodeURIComponent(req.params.symbol).toUpperCase();
  const normalized = raw.includes("/") ? raw : `${raw}/USD`;
  const feed = await discoverFeed(normalized);
  if (!feed) {
    res.status(404).json({ error: `No Pyth feed found for symbol: ${normalized}` });
    return;
  }
  res.json(feed);
});

router.get("/snapshot", async (_, res) => {
  const assets = Object.keys(PYTH_PRICE_IDS);
  res.json(await fetchPythSnapshots(assets));
});

router.get("/snapshot/:symbol", async (req, res) => {
  const raw = req.params.symbol.toUpperCase();
  const asset = raw.includes("/") ? raw.split("/")[0] : raw;
  if (!PYTH_PRICE_IDS[asset]) {
    res.status(404).json({ error: `Asset not supported: ${asset}` });
    return;
  }
  const snap = await fetchPythSnapshot(asset);
  if (!snap) { res.status(503).json({ error: "Pyth unavailable" }); return; }
  res.json(snap);
});

export default router;
