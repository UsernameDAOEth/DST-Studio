import { db, signalsTable } from "@workspace/db";

type ComputedSignal = Awaited<ReturnType<typeof import("./signalEngine").computeSignal>>;

export async function persistSignal(signal: ComputedSignal): Promise<typeof signalsTable.$inferSelect> {
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
