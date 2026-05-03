import { Router } from "express";
import { getConstraints, updateConstraints } from "../lib/hermes/constraints";
import { getScanStatus, triggerScan, getRecentJobs } from "../lib/hermes/scan";
import { computeMetrics } from "../lib/hermes/metrics";
import { generateEvaluation } from "../lib/hermes/evaluation";
import {
  ingestFinding,
  getRecentFindings,
  getFindingsForTarget,
  SubmitFindingSchema,
  BOUNDARY_REMINDER,
} from "../lib/hermes/findings";
import { GetHermesMetricsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/status", (_, res) => {
  res.json(getScanStatus());
});

router.get("/constraints", (_, res) => {
  res.json(getConstraints());
});

router.put("/constraints", async (req, res) => {
  res.json(await updateConstraints(req.body));
});

router.get("/metrics", async (req, res) => {
  const p = GetHermesMetricsQueryParams.safeParse(req.query);
  const period = p.success ? (p.data.period ?? "7D") : "7D";
  res.json(await computeMetrics(period as "24H" | "7D" | "30D"));
});

router.post("/scan", async (_, res) => {
  const c = getConstraints();
  res.json(await triggerScan(c.preferredAssets));
});

router.get("/evaluation", async (_, res) => {
  res.json(await generateEvaluation());
});

router.get("/jobs", async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  res.json(getRecentJobs(limit));
});

router.post("/findings", async (req, res) => {
  const parsed = SubmitFindingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_FINDING",
      details: parsed.error.flatten(),
    });
    return;
  }
  const finding = await ingestFinding(parsed.data);
  res.status(201).json({
    accepted: true,
    findingId: finding.findingId,
    target: finding.target,
    boundaryReminder: BOUNDARY_REMINDER,
    createdAt: finding.createdAt,
  });
});

router.get("/findings", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  res.json(await getRecentFindings(limit));
});

router.get("/findings/:target", async (req, res) => {
  const activeOnly = req.query.active !== "false";
  res.json(await getFindingsForTarget(req.params.target, activeOnly));
});

export default router;
