import { Router, type IRouter } from "express";
import { db, signalsTable } from "@workspace/db";
import { gte } from "drizzle-orm";

const router: IRouter = Router();

const WINDOW_DAYS = 7;

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

export default router;
