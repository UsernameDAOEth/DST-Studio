import { Router } from "express";
import { fetchPythPrices, fetchPythPrice, PYTH_PRICE_IDS } from "../lib/pyth/pythClient";

const router = Router();

router.get("/prices", async (_, res) => {
  const assets = Object.keys(PYTH_PRICE_IDS);
  res.json(await fetchPythPrices(assets));
});

router.get("/prices/:asset", async (req, res) => {
  const asset = req.params.asset.toUpperCase();
  if (!PYTH_PRICE_IDS[asset]) { res.status(404).json({ error: "Asset not supported by Pyth" }); return; }
  const data = await fetchPythPrice(asset);
  if (!data) { res.status(503).json({ error: "Pyth unavailable" }); return; }
  res.json(data);
});

export default router;
