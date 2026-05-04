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
import {
  createRun,
  executeRun,
  getBoard,
  getRun,
  getRecentRuns,
  getWorkers,
  retryTask,
} from "../lib/hermes/board";
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

// ── BOARD ENDPOINTS ──────────────────────────────────────────────────────────

router.get("/board", (_, res) => {
  res.json(getBoard());
});

router.get("/runs", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  res.json(getRecentRuns(limit));
});

router.post("/runs", async (req, res) => {
  const { asset, timeframe } = req.body as { asset?: string; timeframe?: string };
  if (!asset || !timeframe) {
    res.status(400).json({ error: "asset and timeframe are required" });
    return;
  }
  const run = createRun(asset.toUpperCase(), timeframe);
  res.status(201).json(run);
  void executeRun(run.run_id);
});

router.get("/runs/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) { res.status(404).json({ error: "Run not found" }); return; }
  res.json(run);
});

router.post("/runs/:runId/tasks/:taskId/retry", async (req, res) => {
  const task = await retryTask(req.params.runId, req.params.taskId);
  if (!task) { res.status(404).json({ error: "Run or task not found, or task not in FAILED state" }); return; }
  res.json(task);
});

router.get("/workers", (_, res) => {
  res.json(getWorkers());
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
  const { finding, deduplicated } = await ingestFinding(parsed.data);
  res.status(deduplicated ? 200 : 201).json({
    accepted: true,
    deduplicated,
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
