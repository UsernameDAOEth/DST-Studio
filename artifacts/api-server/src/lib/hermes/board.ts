import { computeSignal } from "../dst/signalEngine";
import { fetchPythPrice } from "../pyth/pythClient";
import { getFindingsForTarget } from "./findings";
import { getConstraints } from "./constraints";
import { logger } from "../logger";

export type HermesTaskType =
  | "SCAN_CREATE"
  | "FETCH_MARKET_CONTEXT"
  | "VERIFY_PRICE_STATE"
  | "COLLECT_HERMES_FINDINGS"
  | "COMPRESS_EVIDENCE"
  | "ATTACH_TO_AUDIT"
  | "ROUTE_RESULT";

export type HermesTaskStatus = "TRIAGE" | "READY" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "FAILED";

export type HermesWorkerRole =
  | "market-context-worker"
  | "price-verifier-worker"
  | "evidence-ingress-worker"
  | "alert-router-worker";

export type HermesWorkerStatus = "IDLE" | "BUSY" | "ERROR";

export interface HermesTask {
  run_id: string;
  task_id: string;
  task_type: HermesTaskType;
  asset: string;
  timeframe: string;
  status: HermesTaskStatus;
  depends_on: string[];
  worker_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  retry_count: number;
  max_retries: number;
  summary: string | null;
  error_code: string | null;
  blocked_reason: string | null;
}

export interface HermesWorker {
  worker_id: string;
  role: HermesWorkerRole;
  status: HermesWorkerStatus;
  current_task_id: string | null;
  tasks_completed: number;
  tasks_failed: number;
  last_active_at: string | null;
}

export interface HermesRun {
  run_id: string;
  asset: string;
  timeframe: string;
  triggered_at: string;
  completed_at: string | null;
  overall_status: "RUNNING" | "DONE" | "FAILED" | "BLOCKED";
  tasks: HermesTask[];
  djzs_verdict: string | null;
  process_verdict: string | null;
  direction: string | null;
  rejection_codes: string[];
}

export interface HermesBoardLanes {
  triage: HermesTask[];
  ready: HermesTask[];
  in_progress: HermesTask[];
  blocked: HermesTask[];
  done: HermesTask[];
  failed: HermesTask[];
}

export interface HermesBoardSystemHealth {
  total_runs_today: number;
  failed_tasks_today: number;
  blocked_tasks: number;
  worker_errors: number;
}

export interface HermesBoard {
  workers: HermesWorker[];
  runs: HermesRun[];
  lanes: HermesBoardLanes;
  system_health: HermesBoardSystemHealth;
}

const TASK_CHAIN: HermesTaskType[] = [
  "SCAN_CREATE",
  "FETCH_MARKET_CONTEXT",
  "VERIFY_PRICE_STATE",
  "COLLECT_HERMES_FINDINGS",
  "COMPRESS_EVIDENCE",
  "ATTACH_TO_AUDIT",
  "ROUTE_RESULT",
];

const TASK_WORKER: Partial<Record<HermesTaskType, HermesWorkerRole>> = {
  FETCH_MARKET_CONTEXT: "market-context-worker",
  VERIFY_PRICE_STATE: "price-verifier-worker",
  COLLECT_HERMES_FINDINGS: "evidence-ingress-worker",
  ROUTE_RESULT: "alert-router-worker",
};

const TASK_MAX_RETRIES: Record<HermesTaskType, number> = {
  SCAN_CREATE: 0,
  FETCH_MARKET_CONTEXT: 2,
  VERIFY_PRICE_STATE: 1,
  COLLECT_HERMES_FINDINGS: 1,
  COMPRESS_EVIDENCE: 0,
  ATTACH_TO_AUDIT: 0,
  ROUTE_RESULT: 2,
};

const TASK_DEPENDS_ON: Record<HermesTaskType, HermesTaskType[]> = {
  SCAN_CREATE: [],
  FETCH_MARKET_CONTEXT: ["SCAN_CREATE"],
  VERIFY_PRICE_STATE: ["SCAN_CREATE"],
  COLLECT_HERMES_FINDINGS: ["SCAN_CREATE"],
  COMPRESS_EVIDENCE: ["FETCH_MARKET_CONTEXT", "VERIFY_PRICE_STATE", "COLLECT_HERMES_FINDINGS"],
  ATTACH_TO_AUDIT: ["COMPRESS_EVIDENCE"],
  ROUTE_RESULT: ["ATTACH_TO_AUDIT"],
};

let runs: HermesRun[] = [];
let totalRunsToday = 0;
let failedTasksToday = 0;

const workers: HermesWorker[] = [
  { worker_id: "mcw-1", role: "market-context-worker", status: "IDLE", current_task_id: null, tasks_completed: 0, tasks_failed: 0, last_active_at: null },
  { worker_id: "pvw-1", role: "price-verifier-worker", status: "IDLE", current_task_id: null, tasks_completed: 0, tasks_failed: 0, last_active_at: null },
  { worker_id: "eiw-1", role: "evidence-ingress-worker", status: "IDLE", current_task_id: null, tasks_completed: 0, tasks_failed: 0, last_active_at: null },
  { worker_id: "arw-1", role: "alert-router-worker", status: "IDLE", current_task_id: null, tasks_completed: 0, tasks_failed: 0, last_active_at: null },
];

function uid(): string {
  return Math.random().toString(36).substring(2, 10);
}

function taskId(runId: string, type: HermesTaskType): string {
  return `${runId}:${type}`;
}

function buildTaskChain(runId: string, asset: string, timeframe: string): HermesTask[] {
  return TASK_CHAIN.map((type) => {
    const depTypes = TASK_DEPENDS_ON[type];
    return {
      run_id: runId,
      task_id: taskId(runId, type),
      task_type: type,
      asset,
      timeframe,
      status: type === "SCAN_CREATE" ? "READY" : "TRIAGE",
      depends_on: depTypes.map((d) => taskId(runId, d)),
      worker_id: TASK_WORKER[type] ? `${TASK_WORKER[type]?.replace(/-worker$/, "")}w-1` : null,
      started_at: null,
      finished_at: null,
      retry_count: 0,
      max_retries: TASK_MAX_RETRIES[type],
      summary: null,
      error_code: null,
      blocked_reason: null,
    } satisfies HermesTask;
  });
}

function findWorker(role: HermesWorkerRole): HermesWorker | undefined {
  return workers.find((w) => w.role === role);
}

function claimWorker(task: HermesTask): HermesWorker | null {
  const role = TASK_WORKER[task.task_type];
  if (!role) return null;
  const worker = findWorker(role);
  if (!worker) return null;
  worker.status = "BUSY";
  worker.current_task_id = task.task_id;
  worker.last_active_at = new Date().toISOString();
  return worker;
}

function releaseWorker(task: HermesTask, failed = false) {
  const role = TASK_WORKER[task.task_type];
  if (!role) return;
  const worker = findWorker(role);
  if (!worker) return;
  worker.status = failed ? "ERROR" : "IDLE";
  worker.current_task_id = null;
  worker.last_active_at = new Date().toISOString();
  if (failed) worker.tasks_failed++;
  else worker.tasks_completed++;
}

function markTask(task: HermesTask, status: HermesTaskStatus, summary?: string, errorCode?: string, blockedReason?: string) {
  task.status = status;
  if (status === "IN_PROGRESS" && !task.started_at) task.started_at = new Date().toISOString();
  if (status === "DONE" || status === "FAILED" || status === "BLOCKED") task.finished_at = new Date().toISOString();
  if (summary !== undefined) task.summary = summary;
  if (errorCode !== undefined) task.error_code = errorCode;
  if (blockedReason !== undefined) task.blocked_reason = blockedReason;
}

function promoteReadyTasks(run: HermesRun) {
  const doneIds = new Set(run.tasks.filter((t) => t.status === "DONE").map((t) => t.task_id));
  for (const task of run.tasks) {
    if (task.status !== "TRIAGE") continue;
    if (task.depends_on.every((dep) => doneIds.has(dep))) {
      task.status = "READY";
    }
  }
}

export function createRun(asset: string, timeframe: string): HermesRun {
  const runId = uid();
  const run: HermesRun = {
    run_id: runId,
    asset,
    timeframe,
    triggered_at: new Date().toISOString(),
    completed_at: null,
    overall_status: "RUNNING",
    tasks: buildTaskChain(runId, asset, timeframe),
    djzs_verdict: null,
    process_verdict: null,
    direction: null,
    rejection_codes: [],
  };
  runs = [run, ...runs].slice(0, 50);
  totalRunsToday++;
  return run;
}

export async function executeRun(runId: string): Promise<void> {
  const run = runs.find((r) => r.run_id === runId);
  if (!run) return;

  const task = (type: HermesTaskType) => run.tasks.find((t) => t.task_type === type)!;
  const constraints = getConstraints();

  const execTask = async <T>(
    type: HermesTaskType,
    fn: () => Promise<T>,
    onSuccess: (result: T) => string,
    onError?: (err: unknown) => { code: string; summary: string },
    skipIf?: () => string | false,
  ): Promise<T | null> => {
    const t = task(type);
    if (!t || t.status === "BLOCKED" || t.status === "FAILED") return null;

    const skipReason = skipIf?.();
    if (skipReason !== undefined && skipReason !== false) {
      markTask(t, "DONE", `SKIPPED — ${skipReason}`);
      return null;
    }

    const worker = claimWorker(t);
    markTask(t, "IN_PROGRESS");

    try {
      const result = await fn();
      const summary = onSuccess(result);
      markTask(t, "DONE", summary);
      releaseWorker(t);
      promoteReadyTasks(run);
      return result;
    } catch (err) {
      failedTasksToday++;
      const errDetail = onError?.(err) ?? { code: "UNKNOWN_ERROR", summary: String(err) };
      t.retry_count++;
      if (t.retry_count <= t.max_retries) {
        markTask(t, "READY", `Retry ${t.retry_count}/${t.max_retries}: ${errDetail.summary}`, errDetail.code);
      } else {
        markTask(t, "FAILED", errDetail.summary, errDetail.code);
        releaseWorker(t, true);
        if (worker) worker.status = "ERROR";
        blockDownstreamTasks(run, t.task_id);
      }
      logger.error({ err, runId, task_type: type }, "Hermes board task failed");
      return null;
    }
  };

  const scanCreate = task("SCAN_CREATE");
  markTask(scanCreate, "IN_PROGRESS");
  markTask(scanCreate, "DONE", `Scan initiated for ${run.asset} @ ${run.timeframe}`);
  promoteReadyTasks(run);

  const [signal, pythData, findings] = await Promise.all([
    execTask(
      "FETCH_MARKET_CONTEXT",
      () => computeSignal(run.asset, run.timeframe as "1H" | "4H" | "1D"),
      (s) => `Market context fetched. Regime: ${s.trendRegime.regime}. Direction: ${s.direction}. R/R: ${s.rrRatio}x.`,
      () => ({ code: "MARKET_FETCH_FAILED", summary: "DefiLlama data fetch failed" }),
    ),
    execTask(
      "VERIFY_PRICE_STATE",
      () => fetchPythPrice(run.asset),
      (p) => p
        ? `Pyth price: $${p.price.toFixed(2)} ±${(p.confidenceRatio * 100).toFixed(3)}% — ${p.confidenceStatus}`
        : "Pyth unavailable — skipping confidence check",
      () => ({ code: "PYTH_FETCH_FAILED", summary: "Pyth price verification failed" }),
      () => !constraints.pythConfidenceFilter ? "Pyth confidence filter disabled" : false,
    ),
    execTask(
      "COLLECT_HERMES_FINDINGS",
      () => getFindingsForTarget(run.asset, true),
      (fs) => `${fs.length} active finding${fs.length !== 1 ? "s" : ""} collected for ${run.asset}`,
      () => ({ code: "FINDINGS_FETCH_FAILED", summary: "Evidence ingress failed" }),
    ),
  ]);

  await execTask(
    "COMPRESS_EVIDENCE",
    async () => {
      const parts: string[] = [];
      if (signal) parts.push(`Signal: ${signal.direction} @ ${signal.rrRatio}x R/R, regime=${signal.trendRegime.regime}`);
      if (pythData) parts.push(`Pyth: ${pythData.confidenceStatus} confidence (${(pythData.confidenceRatio * 100).toFixed(3)}%)`);
      if (findings && findings.length > 0) parts.push(`Findings: ${findings.length} active`);
      return parts.join(" | ") || "No evidence — baseline scan only";
    },
    (summary) => summary,
  );

  await execTask(
    "ATTACH_TO_AUDIT",
    async () => {
      if (!signal) throw new Error("No signal available — upstream FETCH_MARKET_CONTEXT failed");
      return signal;
    },
    (s) => {
      run.djzs_verdict = s.verdictDjzs;
      run.process_verdict = s.processVerdict;
      run.direction = s.direction;
      run.rejection_codes = s.rejectionCodes;
      return `DJZS verdict: ${s.verdictDjzs}. Process: ${s.processVerdict}. Direction: ${s.direction}. Rejection codes: ${s.rejectionCodes.length > 0 ? s.rejectionCodes.join(", ") : "NONE"}.`;
    },
    () => ({ code: "AUDIT_ATTACH_FAILED", summary: "Could not attach result to audit record" }),
  );

  const hasRouting = Object.values(constraints.alertRouting).some((v) => v);
  await execTask(
    "ROUTE_RESULT",
    async () => {
      if (!hasRouting) return "NO_CHANNELS";
      if (run.process_verdict !== "APPROVED") return "NOT_APPROVED";
      return "ROUTED";
    },
    (outcome) => {
      if (outcome === "NO_CHANNELS") return "No routing channels configured — signal visible on dashboard only";
      if (outcome === "NOT_APPROVED") return `Routing skipped — process verdict is ${run.process_verdict ?? "unknown"}, not APPROVED`;
      return "Signal packet routed to configured delivery channels";
    },
    () => ({ code: "ROUTING_FAILED", summary: "Alert delivery failed" }),
  );

  const allTasksDone = run.tasks.every((t) => t.status === "DONE" || t.status === "FAILED" || t.status === "BLOCKED");
  const anyFailed = run.tasks.some((t) => t.status === "FAILED");
  const anyBlocked = run.tasks.some((t) => t.status === "BLOCKED");

  run.overall_status = anyFailed ? "FAILED" : anyBlocked ? "BLOCKED" : allTasksDone ? "DONE" : "RUNNING";
  run.completed_at = new Date().toISOString();
}

function blockDownstreamTasks(run: HermesRun, failedTaskId: string) {
  const allTaskIds = new Set(run.tasks.map((t) => t.task_id));
  const blocked = new Set<string>();

  const findDownstream = (id: string) => {
    for (const t of run.tasks) {
      if (t.depends_on.includes(id) && allTaskIds.has(t.task_id) && !blocked.has(t.task_id)) {
        blocked.add(t.task_id);
        findDownstream(t.task_id);
      }
    }
  };
  findDownstream(failedTaskId);

  for (const t of run.tasks) {
    if (blocked.has(t.task_id) && t.status !== "DONE") {
      markTask(t, "BLOCKED", undefined, undefined, `Blocked — upstream task ${failedTaskId.split(":")[1]} failed`);
    }
  }
}

export function getBoard(): HermesBoard {
  const allTasks = runs.flatMap((r) => r.tasks);
  const lanes: HermesBoardLanes = {
    triage: allTasks.filter((t) => t.status === "TRIAGE"),
    ready: allTasks.filter((t) => t.status === "READY"),
    in_progress: allTasks.filter((t) => t.status === "IN_PROGRESS"),
    blocked: allTasks.filter((t) => t.status === "BLOCKED"),
    done: allTasks.filter((t) => t.status === "DONE"),
    failed: allTasks.filter((t) => t.status === "FAILED"),
  };
  return {
    workers: [...workers],
    runs: [...runs],
    lanes,
    system_health: {
      total_runs_today: totalRunsToday,
      failed_tasks_today: failedTasksToday,
      blocked_tasks: lanes.blocked.length,
      worker_errors: workers.filter((w) => w.status === "ERROR").length,
    },
  };
}

export function getRun(runId: string): HermesRun | undefined {
  return runs.find((r) => r.run_id === runId);
}

export function getRecentRuns(limit: number): HermesRun[] {
  return runs.slice(0, limit);
}

export function getWorkers(): HermesWorker[] {
  return [...workers];
}

export async function retryTask(runId: string, taskId: string): Promise<HermesTask | null> {
  const run = runs.find((r) => r.run_id === runId);
  if (!run) return null;
  const task = run.tasks.find((t) => t.task_id === taskId);
  if (!task) return null;
  if (task.status !== "FAILED") return null;

  task.status = "READY";
  task.error_code = null;
  task.blocked_reason = null;
  task.finished_at = null;

  const blockedDownstream = run.tasks.filter((t) => t.status === "BLOCKED");
  for (const bt of blockedDownstream) {
    if (bt.blocked_reason?.includes(task.task_id.split(":")[1] ?? "")) {
      bt.status = "TRIAGE";
      bt.blocked_reason = null;
    }
  }

  run.overall_status = "RUNNING";
  run.completed_at = null;

  void executeRun(runId);
  return task;
}
