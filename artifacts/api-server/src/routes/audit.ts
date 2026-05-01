import { Router } from "express";
import { GetAuditByAssetParams } from "@workspace/api-zod";
import { computeSignal } from "../lib/dst/signalEngine";
import { ASSET_MAP } from "../lib/dst/defillamaClient";

const router = Router();

router.get("/:asset", async (req, res) => {
  const parsed = GetAuditByAssetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid asset" });
    return;
  }
  const asset = parsed.data.asset.toUpperCase();
  if (!ASSET_MAP[asset]) {
    res.status(404).json({ error: `Unknown asset: ${asset}` });
    return;
  }
  const signal = await computeSignal(asset);
  res.json(signal.auditReport);
});

export default router;
