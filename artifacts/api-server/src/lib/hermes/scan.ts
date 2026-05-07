import { HermesJob, HermesJobPhase, HermesScanStatus, HermesScanResult } from "./types";
import { computeSignal } from "../dst/signalEngine";
import { persistSignal } from "../dst/persistSignal";
import { getConstraints } from "./constraints";
import { logger } from "../logger";
import { isTelegramConfigured, maybeDeliverApprovedSignal } from "../integrations/telegram";
import { isAgentMailConfigured, maybeDeliverApprovedSignalEmail } from "../integrations/agentmail";

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

// Both timeframes are scanned every trigger. 4H stays DefiLlama-sourced
// (legacy, byte-identical); 15m is powered by the Pyth Benchmarks TradingView
// shim. Each (asset, timeframe) pair runs the full DJZS audit independently
// and persists as a separate row in `signals`.
const SCAN_TIMEFRAMES = ["4H", "15m"] as const;

export async function triggerScan(assets: string[]): Promise<HermesScanResult> {
  const constraints = getConstraints();
  lastRunAt = new Date().toISOString();

  const pairs: { asset: string; timeframe: string }[] = [];
  for (const asset of assets) {
    for (const tf of SCAN_TIMEFRAMES) pairs.push({ asset, timeframe: tf });
  }

  const jobs: HermesJob[] = pairs.map(({ asset, timeframe }) => ({
    id: Math.random().toString(36).substring(2, 15),
    asset: timeframe === "4H" ? asset : `${asset} (${timeframe})`,
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

  await Promise.all(jobs.map(async (job, idx) => {
    const start = Date.now();
    const pair = pairs[idx];

    const pDefi = job.phases.find(p => p.stage === "DEFILAMMA")!;
    pDefi.status = "RUNNING";
    let signal;
    let persistedSignal: Awaited<ReturnType<typeof persistSignal>> | null = null;
    try {
      signal = await computeSignal(pair.asset, pair.timeframe);
      pDefi.status = "COMPLETE";
    } catch (err) {
      logger.error({ err, asset: pair.asset, timeframe: pair.timeframe }, "Signal compute failed in Hermes scan");
      pDefi.status = "FAILED";
      pDefi.result = "Error computing signal";
    }
    pDefi.durationMs = Date.now() - start;

    if (signal) {
      try {
        persistedSignal = await persistSignal(signal);
      } catch (err) {
        logger.error({ err, asset: job.asset }, "Persist signal failed in Hermes scan");
      }
    }

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
    const routingStart = Date.now();
    const hasRouting = Object.values(constraints.alertRouting).some(v => v);
    const isApproved = persistedSignal && persistedSignal.verdictDjzs === "PASS" && persistedSignal.direction !== "WAIT";

    if (!isApproved) {
      pRouting.status = "SKIPPED";
      pRouting.skippedReason = hasRouting
        ? "No APPROVED tradeable signal to route"
        : "No alert routing configured";
    } else {
      type ChannelReport = { channel: string; status: "COMPLETE" | "SKIPPED" | "FAILED"; detail: string };
      const reports: ChannelReport[] = [];

      const tfTag = `[${persistedSignal!.timeframe ?? "4H"}]`;
      const tgChan = `Telegram${tfTag}`;
      const emailChan = `Email${tfTag}`;

      if (constraints.alertRouting.telegram) {
        if (!isTelegramConfigured()) {
          reports.push({ channel: tgChan, status: "SKIPPED", detail: "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing" });
        } else {
          const out = await maybeDeliverApprovedSignal(persistedSignal!);
          if (out.delivered) reports.push({ channel: tgChan, status: "COMPLETE", detail: "delivered" });
          else if (out.alreadyDelivered) reports.push({ channel: tgChan, status: "SKIPPED", detail: out.reason });
          else reports.push({ channel: tgChan, status: "FAILED", detail: out.reason });
        }
      }

      if (constraints.alertRouting.email) {
        if (!isAgentMailConfigured()) {
          reports.push({ channel: emailChan, status: "SKIPPED", detail: "AGENTMAIL_API_KEY/AGENTMAIL_TO missing" });
        } else {
          const out = await maybeDeliverApprovedSignalEmail(persistedSignal!);
          if (out.delivered) reports.push({ channel: emailChan, status: "COMPLETE", detail: "delivered" });
          else if (out.alreadyDelivered) reports.push({ channel: emailChan, status: "SKIPPED", detail: out.reason });
          else reports.push({ channel: emailChan, status: "FAILED", detail: out.reason });
        }
      }

      if (reports.length === 0) {
        pRouting.status = "SKIPPED";
        pRouting.skippedReason = hasRouting
          ? "No live channels enabled (XMTP/Discord scaffolded only)"
          : "No alert routing configured";
      } else {
        const summary = reports.map(r => `${r.channel}: ${r.detail}`).join("; ");
        if (reports.some(r => r.status === "FAILED")) {
          pRouting.status = "FAILED";
          pRouting.result = summary;
        } else if (reports.every(r => r.status === "SKIPPED")) {
          pRouting.status = "SKIPPED";
          pRouting.skippedReason = summary;
        } else {
          pRouting.status = "COMPLETE";
          pRouting.result = summary;
        }
      }
    }
    pRouting.durationMs = Date.now() - routingStart;

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
    message: `Triggered scan for ${assets.length} asset${assets.length !== 1 ? "s" : ""} × ${SCAN_TIMEFRAMES.length} timeframes`,
  };
}

export function getRecentJobs(limit: number): HermesJob[] {
  return recentJobs.slice(0, limit);
}
