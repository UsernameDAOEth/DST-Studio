import { Router } from "express";
import { GetAuditByAssetParams } from "@workspace/api-zod";
import { ASSET_MAP } from "../lib/dst/defillamaClient";
import { db, signalsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

const router = Router();

const VALID_TIMEFRAMES = new Set(["4H", "15m"]);

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

  const signalIdParam = req.query.signalId;
  if (signalIdParam) {
    const signalId = Number(signalIdParam);
    if (!Number.isInteger(signalId) || signalId <= 0) {
      res.status(400).json({ error: "Invalid signalId" });
      return;
    }
    const [row] = await db
      .select()
      .from(signalsTable)
      .where(eq(signalsTable.id, signalId))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: `Signal #${signalId} not found` });
      return;
    }
    if (row.asset !== asset) {
      res.status(400).json({ error: `Signal #${signalId} belongs to ${row.asset}, not ${asset}` });
      return;
    }
    res.json({ ...row.auditReport, pinned: true, pinnedSignalId: signalId });
    return;
  }

  const tfRaw = req.query.timeframe;
  const timeframe = typeof tfRaw === "string" && VALID_TIMEFRAMES.has(tfRaw) ? tfRaw : "4H";

  const [latest] = await db
    .select()
    .from(signalsTable)
    .where(and(eq(signalsTable.asset, asset), eq(signalsTable.timeframe, timeframe)))
    .orderBy(desc(signalsTable.computedAt))
    .limit(1);

  if (latest) {
    res.json({ ...latest.auditReport, pinned: false });
    return;
  }

  // Intentional 404: audit must never recompute independently (snapshot integrity).
  // A signal must be computed via /api/signals first before its audit is available.
  res.status(404).json({ error: `No stored ${timeframe} signal for ${asset}. Trigger a scan first.` });
});

export default router;
