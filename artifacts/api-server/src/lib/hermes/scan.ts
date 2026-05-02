import { HermesJob, HermesJobPhase, HermesScanStatus, HermesScanResult } from "./types";
import { computeSignal } from "../dst/signalEngine";
import { getConstraints } from "./constraints";
import { logger } from "../logger";

let recentJobs: HermesJob[] = [];
let totalScansToday = 0;
let totalApprovedToday = 0;
let totalWaitToday = 0;
let lastRunAt: string | null = null;

export function getScanStatus(): HermesScanStatus {
  return {
    running: recentJobs.some(j => j.phases.some(p => p.status === "RUNNING")),
    schedulerActive: false,
    lastRunAt,
    nextRunAt: null,
    scanIntervalMinutes: 15,
    totalScansToday,
    totalApprovedToday,
    totalWaitToday,
    activeJobs: recentJobs.filter(j => j.phases.some(p => p.status === "RUNNING" || p.status === "PENDING")),
    recentJobs: recentJobs.slice(0, 10),
    phase: "PHASE 2 — MANUAL TRIGGER",
  };
}

export async function triggerScan(assets: string[]): Promise<HermesScanResult> {
  const constraints = getConstraints();
  lastRunAt = new Date().toISOString();

  const jobs: HermesJob[] = assets.map(asset => ({
    id: Math.random().toString(36).substring(2, 15),
    asset,
    scanStartedAt: new Date().toISOString(),
    scanCompletedAt: null,
    phases: [
      { stage: "DEFILAMMA", status: "PENDING", durationMs: null },
      { stage: "PYTH", status: "PENDING", durationMs: null },
      { stage: "BROWSERBASE", status: "PENDING", durationMs: null },
      { stage: "DJZS_AUDIT", status: "PENDING", durationMs: null },
      { stage: "ROUTING", status: "PENDING", durationMs: null },
    ] as HermesJobPhase[],
    rejectionCodes: [],
    triggered: true,
    finalDirection: null,
    finalProcessVerdict: null,
    setupFamily: null,
  }));

  recentJobs = [...jobs, ...recentJobs].slice(0, 50);

  await Promise.all(jobs.map(async (job) => {
    const start = Date.now();

    const pDefi = job.phases.find(p => p.stage === "DEFILAMMA")!;
    pDefi.status = "RUNNING";
    let signal;
    try {
      signal = await computeSignal(job.asset, constraints.activeTimeframe);
      pDefi.status = "COMPLETE";
    } catch (err) {
      logger.error({ err, asset: job.asset }, "Signal compute failed in Hermes scan");
      pDefi.status = "FAILED";
      pDefi.result = "Error computing signal";
    }
    pDefi.durationMs = Date.now() - start;

    const pPyth = job.phases.find(p => p.stage === "PYTH")!;
    if (constraints.pythConfidenceFilter) {
      pPyth.status = "COMPLETE";
      pPyth.result = "Pyth confidence applied via signal engine";
    } else {
      pPyth.status = "SKIPPED";
      pPyth.skippedReason = "Pyth integration not active";
    }
    pPyth.durationMs = 0;

    const pBrowser = job.phases.find(p => p.stage === "BROWSERBASE")!;
    if (constraints.browserbaseTriggerPolicy === "DISABLED") {
      pBrowser.status = "SKIPPED";
      pBrowser.skippedReason = "Browserbase trigger policy: DISABLED";
    } else {
      pBrowser.status = "SKIPPED";
      pBrowser.skippedReason = "Browserbase research not yet implemented";
    }
    pBrowser.durationMs = 0;

    const pAudit = job.phases.find(p => p.stage === "DJZS_AUDIT")!;
    pAudit.status = "COMPLETE";
    pAudit.result = signal ? signal.verdictDjzs : "SKIPPED";
    pAudit.durationMs = 0;

    const pRouting = job.phases.find(p => p.stage === "ROUTING")!;
    const hasRouting = Object.values(constraints.alertRouting).some(v => v);
    pRouting.status = "SKIPPED";
    pRouting.skippedReason = hasRouting ? "Routing not yet implemented" : "No alert routing configured";
    pRouting.durationMs = 0;

    job.scanCompletedAt = new Date().toISOString();

    if (signal) {
      job.finalDirection = signal.direction as "LONG" | "SHORT" | "WAIT";
      job.finalProcessVerdict = signal.processVerdict as "APPROVED" | "REJECTED" | "DEGRADED";
      job.setupFamily = signal.setupFamily;
      job.rejectionCodes = signal.rejectionCodes;

      totalScansToday++;
      if (signal.processVerdict === "APPROVED") totalApprovedToday++;
      if (signal.direction === "WAIT") totalWaitToday++;
    }
  }));

  return {
    triggeredAt: lastRunAt,
    assets,
    jobIds: jobs.map(j => j.id),
    message: `Triggered scan for ${assets.length} asset${assets.length !== 1 ? "s" : ""}`,
  };
}

export function getRecentJobs(limit: number): HermesJob[] {
  return recentJobs.slice(0, limit);
}
