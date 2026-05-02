import { db, signalsTable } from "@workspace/db";
import { HermesMetrics } from "./types";
import { gte, sql, and, ne, eq, inArray, or } from "drizzle-orm";

export async function computeMetrics(period: "24H" | "7D" | "30D"): Promise<HermesMetrics> {
  const now = new Date();
  let startDate: Date;
  if (period === "24H") startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  else if (period === "7D") startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const signals = await db.select().from(signalsTable).where(gte(signalsTable.computedAt, startDate));

  const totalScans = signals.length;
  const totalCandidates = signals.filter(s => s.direction !== 'WAIT').length;
  const totalApproved = signals.filter(s => s.processVerdict === 'APPROVED').length;
  const totalDegraded = signals.filter(s => s.processVerdict === 'DEGRADED').length;
  const totalRejected = signals.filter(s => s.processVerdict === 'REJECTED').length;
  const totalWait = signals.filter(s => s.direction === 'WAIT').length;

  const waitRate = totalScans > 0 ? totalWait / totalScans : 0;
  const approvalRate = totalScans > 0 ? totalApproved / totalScans : 0;

  const approvedSignals = signals.filter(s => s.processVerdict === 'APPROVED');
  const avgRROnApproved = approvedSignals.length > 0 
    ? approvedSignals.reduce((acc, s) => acc + Number(s.rrRatio), 0) / approvedSignals.length 
    : null;
  const avgConfidenceOnApproved = approvedSignals.length > 0
    ? approvedSignals.reduce((acc, s) => acc + Number(s.confidence), 0) / approvedSignals.length
    : null;

  const timingAccuracy = approvedSignals.length > 0
    ? approvedSignals.filter(s => ['OPTIMAL', 'ACCEPTABLE'].includes(s.entryQuality)).length / approvedSignals.length
    : null;

  const rejectionCodeBreakdown: Record<string, number> = {};
  signals.forEach(s => {
    s.rejectionCodes.forEach(code => {
      rejectionCodeBreakdown[code] = (rejectionCodeBreakdown[code] || 0) + 1;
    });
  });

  const setupFamilyBreakdown: Record<string, number> = {};
  signals.forEach(s => {
    setupFamilyBreakdown[s.setupFamily] = (setupFamilyBreakdown[s.setupFamily] || 0) + 1;
  });

  return {
    period,
    totalScans,
    totalCandidates,
    totalApproved,
    totalDegraded,
    totalRejected,
    totalWait,
    waitRate,
    approvalRate,
    avgRROnApproved,
    avgConfidenceOnApproved,
    timingAccuracy,
    candidateAccuracy: null,
    filterAccuracy: null,
    noTradeQuality: null,
    researchLift: null,
    alertUsefulness: null,
    rejectionCodeBreakdown,
    setupFamilyBreakdown,
    pythInfluenceCount: 0,
    computedAt: new Date().toISOString(),
  } as HermesMetrics;
}
