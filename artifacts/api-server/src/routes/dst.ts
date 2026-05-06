import { Router, type IRouter } from "express";
import { db, signalsTable } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";

const router: IRouter = Router();

const WINDOW_DAYS = 7;
const TOP_LIMIT = 10;

function bump(m: Map<string, number>, k: string): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

function topBuckets(
  m: Map<string, number>,
  limit?: number,
): Array<{ name: string; count: number }> {
  const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const shown = limit ? entries.slice(0, limit) : entries;
  return shown.map(([name, count]) => ({ name, count }));
}

function pickTopName(m: Map<string, number>): string | null {
  let top: [string, number] | undefined;
  for (const e of m.entries()) {
    if (!top || e[1] > top[1]) top = e;
  }
  return top ? top[0] : null;
}

router.get("/pipeline-health", async (req, res): Promise<void> => {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        direction: signalsTable.direction,
        processVerdict: signalsTable.processVerdict,
      })
      .from(signalsTable)
      .where(gte(signalsTable.computedAt, since));

    let longCount = 0;
    let shortCount = 0;
    let waitCount = 0;
    let longApproved = 0;
    let shortApproved = 0;

    for (const row of rows) {
      if (row.direction === "LONG") {
        longCount++;
        if (row.processVerdict === "APPROVED") longApproved++;
      } else if (row.direction === "SHORT") {
        shortCount++;
        if (row.processVerdict === "APPROVED") shortApproved++;
      } else {
        waitCount++;
      }
    }

    const directional = longCount + shortCount;
    const shortShareOfDirectional = directional > 0 ? shortCount / directional : 0;
    const longApprovalRate = longCount > 0 ? longApproved / longCount : 0;
    const shortApprovalRate = shortCount > 0 ? shortApproved / shortCount : 0;
    const shortPipelineBroken = shortCount > 0 && shortApproved === 0;

    res.json({
      windowDays: WINDOW_DAYS,
      longCount,
      shortCount,
      waitCount,
      shortShareOfDirectional,
      longApprovalRate,
      shortApprovalRate,
      shortPipelineBroken,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "pipeline-health query failed");
    res.status(500).json({ error: "pipeline_health_query_failed" });
  }
});

router.get("/pipeline-health/short-bottleneck", async (req, res): Promise<void> => {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        computedAt: signalsTable.computedAt,
        processVerdict: signalsTable.processVerdict,
        setupFamily: signalsTable.setupFamily,
        reasonCodes: signalsTable.reasonCodes,
        rejectionCodes: signalsTable.rejectionCodes,
        auditReport: signalsTable.auditReport,
      })
      .from(signalsTable)
      .where(and(eq(signalsTable.direction, "SHORT"), gte(signalsTable.computedAt, since)))
      .orderBy(desc(signalsTable.computedAt));

    const verdictCounts = new Map<string, number>();
    const setupCounts = new Map<string, number>();
    const reasonCounts = new Map<string, number>();
    const rejectionCounts = new Map<string, number>();
    const checkFailCounts = new Map<string, number>();
    const checkSkipCounts = new Map<string, number>();
    let approvedShorts = 0;

    for (const r of rows) {
      if (r.processVerdict === "APPROVED") approvedShorts++;
      bump(verdictCounts, r.processVerdict ?? "UNKNOWN");
      bump(setupCounts, r.setupFamily ?? "UNKNOWN");
      for (const c of r.reasonCodes ?? []) bump(reasonCounts, c);
      for (const c of r.rejectionCodes ?? []) bump(rejectionCounts, c);
      const checks = (r.auditReport as { checks?: Array<{ name: string; result: string }> } | null)
        ?.checks;
      if (Array.isArray(checks)) {
        for (const ch of checks) {
          if (ch.result === "FAIL") bump(checkFailCounts, ch.name);
          else if (ch.result === "SKIP") bump(checkSkipCounts, ch.name);
        }
      }
    }

    const shortPipelineBroken = rows.length > 0 && approvedShorts === 0;
    const topBlocker = shortPipelineBroken
      ? (pickTopName(rejectionCounts) ??
        pickTopName(checkFailCounts) ??
        pickTopName(reasonCounts))
      : null;

    const newest = rows[0];
    const oldest = rows[rows.length - 1];

    res.json({
      windowDays: WINDOW_DAYS,
      totalShorts: rows.length,
      approvedShorts,
      shortPipelineBroken,
      topBlocker,
      windowStart: oldest?.computedAt.toISOString() ?? null,
      windowEnd: newest?.computedAt.toISOString() ?? null,
      verdicts: topBuckets(verdictCounts),
      setupFamilies: topBuckets(setupCounts),
      reasonCodes: topBuckets(reasonCounts, TOP_LIMIT),
      rejectionCodes: topBuckets(rejectionCounts, TOP_LIMIT),
      failingChecks: topBuckets(checkFailCounts, TOP_LIMIT),
      skippedChecks: topBuckets(checkSkipCounts, TOP_LIMIT),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "short-bottleneck query failed");
    res.status(500).json({ error: "short_bottleneck_query_failed" });
  }
});

const VALID_BUCKETS = new Set([
  "rejection",
  "reason",
  "failingCheck",
  "skippedCheck",
  "setup",
  "verdict",
]);

router.get(
  "/pipeline-health/short-bottleneck/signals",
  async (req, res): Promise<void> => {
    try {
      const bucket = String(req.query.bucket ?? "");
      const name = String(req.query.name ?? "");
      if (!VALID_BUCKETS.has(bucket) || name.length === 0) {
        res.status(400).json({ error: "invalid_bucket_or_name" });
        return;
      }

      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          id: signalsTable.id,
          asset: signalsTable.asset,
          computedAt: signalsTable.computedAt,
          processVerdict: signalsTable.processVerdict,
          setupFamily: signalsTable.setupFamily,
          reasonCodes: signalsTable.reasonCodes,
          rejectionCodes: signalsTable.rejectionCodes,
          auditReport: signalsTable.auditReport,
          thesis: signalsTable.thesis,
        })
        .from(signalsTable)
        .where(
          and(eq(signalsTable.direction, "SHORT"), gte(signalsTable.computedAt, since)),
        )
        .orderBy(desc(signalsTable.computedAt));

      const matches = rows.filter((r) => {
        switch (bucket) {
          case "rejection":
            return (r.rejectionCodes ?? []).includes(name);
          case "reason":
            return (r.reasonCodes ?? []).includes(name);
          case "setup":
            return (r.setupFamily ?? "UNKNOWN") === name;
          case "verdict":
            return (r.processVerdict ?? "UNKNOWN") === name;
          case "failingCheck":
          case "skippedCheck": {
            const target = bucket === "failingCheck" ? "FAIL" : "SKIP";
            const checks = (
              r.auditReport as { checks?: Array<{ name: string; result: string }> } | null
            )?.checks;
            if (!Array.isArray(checks)) return false;
            return checks.some((c) => c.name === name && c.result === target);
          }
          default:
            return false;
        }
      });

      res.json({
        windowDays: WINDOW_DAYS,
        bucket,
        name,
        total: matches.length,
        signals: matches.map((r) => ({
          id: r.id,
          asset: r.asset,
          computedAt: r.computedAt.toISOString(),
          processVerdict: r.processVerdict,
          setupFamily: r.setupFamily,
          thesis: r.thesis,
        })),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, "short-bottleneck signals query failed");
      res.status(500).json({ error: "short_bottleneck_signals_query_failed" });
    }
  },
);

export default router;
