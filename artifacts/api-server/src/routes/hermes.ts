import { Router } from "express";
import { getConstraints, updateConstraints } from "../lib/hermes/constraints";
import { getScanStatus, triggerScan, getRecentJobs } from "../lib/hermes/scan";
import { computeMetrics } from "../lib/hermes/metrics";
import { generateEvaluation } from "../lib/hermes/evaluation";
import { GetHermesMetricsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/status", (_, res) => { res.json(getScanStatus()); });
router.get("/constraints", (_, res) => { res.json(getConstraints()); });
router.put("/constraints", async (req, res) => { res.json(await updateConstraints(req.body)); });
router.get("/metrics", async (req, res) => {
  const p = GetHermesMetricsQueryParams.safeParse(req.query);
  const period = p.success ? (p.data.period ?? "7D") : "7D";
  res.json(await computeMetrics(period as "24H" | "7D" | "30D"));
});
router.post("/scan", async (_, res) => {
  const c = getConstraints();
  res.json(await triggerScan(c.preferredAssets));
});
router.get("/evaluation", async (_, res) => { res.json(await generateEvaluation()); });
router.get("/jobs", async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  res.json(getRecentJobs(limit));
});
export default router;
