import { Router } from "express";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { computeSignal } from "../lib/dst/signalEngine";
import {
  GetSignalsQueryParams,
  GetSignalByAssetParams,
  GetSignalFeedQueryParams,
} from "@workspace/api-zod";
import { ASSET_MAP } from "../lib/dst/defillamaClient";

const router = Router();

async function getOrComputeSignal(asset: string) {
  const recent = await db
    .select()
    .from(signalsTable)
    .where(eq(signalsTable.asset, asset))
    .orderBy(desc(signalsTable.computedAt))
    .limit(1);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (recent.length > 0 && new Date(recent[0].computedAt) > fiveMinutesAgo) {
    return recent[0];
  }

  const signal = await computeSignal(asset);
  const [inserted] = await db
    .insert(signalsTable)
    .values({
      asset: signal.asset,
      timeframe: signal.timeframe,
      direction: signal.direction,
      confidence: String(signal.confidence),
      verdictDjzs: signal.verdictDjzs,
      entryZoneLow: String(signal.entryZoneLow),
      entryZoneHigh: String(signal.entryZoneHigh),
      targetZone: String(signal.targetZone),
      invalidationPrice: String(signal.invalidationPrice),
      reasonCodes: signal.reasonCodes,
      processVerdict: signal.processVerdict,
      logicAdmissibility: signal.logicAdmissibility,
      setupFamily: signal.setupFamily,
      entryQuality: signal.entryQuality,
      narrativeRisk: signal.narrativeRisk,
      rrRatio: String(signal.rrRatio),
      thesis: signal.thesis,
      whyTrade: signal.whyTrade,
      rejectIf: signal.rejectIf,
      rejectionCodes: signal.rejectionCodes,
      processQualityGrade: signal.processQualityGrade,
      preTradChecklist: signal.preTradChecklist as unknown as Record<string, unknown>,
      outcomeTracking: signal.outcomeTracking as unknown as Record<string, unknown>,
      marketSnapshot: signal.marketSnapshot as unknown as Record<string, unknown>,
      trendRegime: signal.trendRegime as unknown as Record<string, unknown>,
      openInterestContext: signal.openInterestContext as unknown as Record<string, unknown>,
      auditReport: signal.auditReport as unknown as Record<string, unknown>,
      dataQuality: signal.dataQuality as unknown as Record<string, unknown>,
      verificationReport: signal.verificationReport as unknown as Record<string, unknown>,
      packetHash: signal.packetHash,
    })
    .returning();
  return inserted;
}

function mapSignalRow(row: typeof signalsTable.$inferSelect) {
  return {
    id: row.id,
    asset: row.asset,
    timeframe: row.timeframe,
    direction: row.direction,
    confidence: Number(row.confidence),
    verdictDjzs: row.verdictDjzs,
    processVerdict: row.processVerdict,
    logicAdmissibility: row.logicAdmissibility,
    setupFamily: row.setupFamily,
    entryQuality: row.entryQuality,
    narrativeRisk: row.narrativeRisk,
    rrRatio: Number(row.rrRatio),
    thesis: row.thesis,
    whyTrade: row.whyTrade,
    rejectIf: row.rejectIf ?? [],
    rejectionCodes: row.rejectionCodes ?? [],
    processQualityGrade: row.processQualityGrade,
    entryZoneLow: row.entryZoneLow ? Number(row.entryZoneLow) : undefined,
    entryZoneHigh: row.entryZoneHigh ? Number(row.entryZoneHigh) : undefined,
    targetZone: row.targetZone ? Number(row.targetZone) : undefined,
    invalidationPrice: row.invalidationPrice ? Number(row.invalidationPrice) : undefined,
    reasonCodes: row.reasonCodes ?? [],
    computedAt: row.computedAt.toISOString(),
    dataQuality: row.dataQuality,
  };
}

router.get("/", async (req, res) => {
  const params = GetSignalsQueryParams.safeParse(req.query);
  const asset = params.success ? params.data.asset : undefined;
  const assets = asset ? [asset.toUpperCase()] : Object.keys(ASSET_MAP);

  const rows = await Promise.all(assets.map(getOrComputeSignal));
  res.json(rows.filter(Boolean).map(mapSignalRow));
});

router.get("/feed", async (req, res) => {
  const params = GetSignalFeedQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 20) : 20;

  const rows = await db
    .select()
    .from(signalsTable)
    .orderBy(desc(signalsTable.computedAt))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      id: r.id,
      asset: r.asset,
      direction: r.direction,
      verdict: r.verdictDjzs,
      logicAdmissibility: r.logicAdmissibility,
      processVerdict: r.processVerdict,
      setupFamily: r.setupFamily,
      confidence: Number(r.confidence),
      rrRatio: Number(r.rrRatio),
      summary: `${r.asset} ${r.direction} — DJZS ${r.logicAdmissibility === "ADMISSIBLE" ? "PASS" : r.logicAdmissibility === "CONDITIONAL" ? "WAIT" : r.logicAdmissibility === "INADMISSIBLE" ? "FAIL" : r.verdictDjzs} — Confidence ${Number(r.confidence).toFixed(0)}%`,
      computedAt: r.computedAt.toISOString(),
    }))
  );
});

router.get("/:asset", async (req, res) => {
  const params = GetSignalByAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid asset" });
    return;
  }
  const asset = params.data.asset.toUpperCase();
  if (!ASSET_MAP[asset]) {
    res.status(404).json({ error: `Unknown asset: ${asset}` });
    return;
  }

  const row = await getOrComputeSignal(asset);
  if (!row) {
    res.status(500).json({ error: "Failed to compute signal" });
    return;
  }

  res.json({
    ...mapSignalRow(row),
    marketSnapshot: row.marketSnapshot,
    trendRegime: row.trendRegime,
    openInterestContext: row.openInterestContext,
    auditReport: row.auditReport ? { ...(row.auditReport as Record<string, unknown>), pinned: false } : row.auditReport,
    preTradChecklist: row.preTradChecklist,
    outcomeTracking: row.outcomeTracking,
    dataQuality: row.dataQuality,
    verificationReport: row.verificationReport,
    packetHash: row.packetHash,
  });
});

export default router;
