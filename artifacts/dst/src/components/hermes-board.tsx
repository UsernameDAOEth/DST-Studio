import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetHermesBoard,
  useCreateHermesRun,
  useRetryHermesTask,
  getGetHermesBoardQueryKey,
  HermesTaskStatus,
  HermesWorkerStatus,
  HermesRunOverallStatus,
  CreateHermesRunRequestTimeframe,
} from "@workspace/api-client-react";
import type {
  HermesTask,
  HermesRun,
  HermesWorker,
  HermesBoardSystemHealth,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function humanTaskType(t: string) {
  return t.replace(/_/g, " ");
}

function duration(started: string | null | undefined, finished: string | null | undefined): string {
  if (!started) return "—";
  const end = finished ? new Date(finished) : new Date();
  const ms = end.getTime() - new Date(started).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

// ── sub-components ───────────────────────────────────────────────────────────

const LANE_META: Record<string, { label: string; accent: string; dot: string }> = {
  triage:      { label: "TRIAGE",      accent: "border-muted-foreground/20", dot: "bg-muted-foreground/40" },
  ready:       { label: "READY",       accent: "border-blue-500/30",         dot: "bg-blue-400" },
  in_progress: { label: "IN PROGRESS", accent: "border-yellow-500/30",       dot: "bg-yellow-400" },
  blocked:     { label: "BLOCKED",     accent: "border-orange-500/40",       dot: "bg-orange-400" },
  done:        { label: "DONE",        accent: "border-emerald-500/30",      dot: "bg-emerald-400" },
  failed:      { label: "FAILED",      accent: "border-red-500/30",          dot: "bg-red-400" },
};

function WorkerChip({ w }: { w: HermesWorker }) {
  const isBusy = w.status === (HermesWorkerStatus.BUSY as string);
  const isError = w.status === (HermesWorkerStatus.ERROR as string);
  return (
    <div className={cn(
      "flex flex-col gap-0.5 border px-3 py-2 min-w-[140px]",
      isBusy  ? "border-yellow-500/40 bg-yellow-500/5" :
      isError ? "border-red-500/40 bg-red-500/5" :
                "border-border bg-background",
    )}>
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isBusy  ? "bg-yellow-400 animate-pulse" :
          isError ? "bg-red-400" :
                    "bg-emerald-400",
        )} />
        <span className="font-mono text-[9px] font-bold text-foreground uppercase tracking-widest">
          {w.worker_id}
        </span>
      </div>
      <span className="font-mono text-[8px] text-muted-foreground uppercase">
        {w.role.replace(/-worker$/, "")}
      </span>
      <span className={cn(
        "font-mono text-[8px] uppercase",
        isBusy  ? "text-yellow-400" :
        isError ? "text-red-400" :
                  "text-emerald-400/70",
      )}>
        {isBusy ? "BUSY" : isError ? "ERROR" : "IDLE"}
      </span>
      <div className="flex gap-2 mt-0.5">
        <span className="font-mono text-[8px] text-muted-foreground/50">
          ✓{w.tasks_completed}
        </span>
        {w.tasks_failed > 0 && (
          <span className="font-mono text-[8px] text-red-400/70">
            ✗{w.tasks_failed}
          </span>
        )}
      </div>
    </div>
  );
}

function HealthStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn(
        "font-mono text-lg font-bold tabular-nums",
        warn && value > 0 ? "text-orange-400" : "text-foreground",
      )}>
        {value}
      </span>
      <span className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

function TaskCard({
  task,
  onRetry,
  retrying,
  compact,
}: {
  task: HermesTask;
  onRetry?: (task: HermesTask) => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  const isFailed  = task.status === (HermesTaskStatus.FAILED  as string);
  const isBlocked = task.status === (HermesTaskStatus.BLOCKED as string);
  const isRunning = task.status === (HermesTaskStatus.IN_PROGRESS as string);
  const isDone    = task.status === (HermesTaskStatus.DONE as string);

  return (
    <div className={cn(
      "border p-2.5 space-y-1.5 text-left",
      isFailed  ? "border-red-500/30 bg-red-500/5" :
      isBlocked ? "border-orange-500/30 bg-orange-500/5" :
      isRunning ? "border-yellow-500/20 bg-yellow-500/5" :
      isDone    ? "border-emerald-500/20 bg-background" :
                  "border-border bg-background",
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[9px] font-bold text-foreground uppercase leading-tight">
          {humanTaskType(task.task_type)}
        </span>
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0 mt-0.5" />
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[8px] text-muted-foreground border border-border px-1">{task.asset}</span>
        <span className="font-mono text-[8px] text-muted-foreground/60">{task.timeframe}</span>
        {task.worker_id && (
          <span className="font-mono text-[8px] text-blue-400/70">{task.worker_id}</span>
        )}
      </div>

      {(task.started_at || task.finished_at) && (
        <div className="font-mono text-[8px] text-muted-foreground/50">
          {isRunning ? `running ${duration(task.started_at, null)}` : `${duration(task.started_at, task.finished_at)}`}
        </div>
      )}

      {task.summary && !compact && (
        <p className="font-mono text-[8px] text-muted-foreground leading-relaxed line-clamp-2">
          {task.summary}
        </p>
      )}

      {task.error_code && (
        <div className="font-mono text-[8px] text-red-400 border border-red-500/20 px-1.5 py-0.5">
          {task.error_code}
          {task.retry_count > 0 && (
            <span className="text-red-400/60 ml-1">retry {task.retry_count}/{task.max_retries}</span>
          )}
        </div>
      )}

      {task.blocked_reason && (
        <div className="font-mono text-[8px] text-orange-400/80 border border-orange-500/20 px-1.5 py-0.5">
          {task.blocked_reason}
        </div>
      )}

      {isFailed && task.retry_count < task.max_retries && onRetry && (
        <button
          onClick={() => onRetry(task)}
          disabled={retrying}
          className="font-mono text-[8px] uppercase tracking-widest border border-muted-foreground/30 px-2 py-0.5 hover:border-foreground hover:text-foreground transition-colors disabled:opacity-40 text-muted-foreground"
        >
          {retrying ? "QUEUING…" : `RETRY (${task.retry_count}/${task.max_retries})`}
        </button>
      )}
    </div>
  );
}

function KanbanLane({
  laneKey,
  tasks,
  onRetry,
  retryingId,
}: {
  laneKey: string;
  tasks: HermesTask[];
  onRetry: (task: HermesTask) => void;
  retryingId: string | null;
}) {
  const meta = LANE_META[laneKey] ?? LANE_META.triage;
  return (
    <div className={cn("border flex flex-col min-h-[200px] min-w-[180px] flex-1", meta.accent)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-inherit">
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", meta.dot)} />
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-foreground">{meta.label}</span>
        <span className="font-mono text-[9px] text-muted-foreground/50 ml-auto">{tasks.length}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[340px]">
        {tasks.length === 0 ? (
          <p className="font-mono text-[8px] text-muted-foreground/30 text-center pt-4 uppercase">empty</p>
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.task_id}
              task={t}
              onRetry={onRetry}
              retrying={retryingId === t.task_id}
              compact
            />
          ))
        )}
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "font-mono text-[8px] uppercase px-1.5 py-0.5 border",
      status === (HermesRunOverallStatus.DONE    as string) ? "border-emerald-500/40 text-emerald-400" :
      status === (HermesRunOverallStatus.FAILED  as string) ? "border-red-500/40 text-red-400" :
      status === (HermesRunOverallStatus.BLOCKED as string) ? "border-orange-500/40 text-orange-400" :
                                                               "border-yellow-500/40 text-yellow-400 animate-pulse",
    )}>
      {status}
    </span>
  );
}

function RunTaskPipeline({ run, onRetry, retryingId }: { run: HermesRun; onRetry: (task: HermesTask) => void; retryingId: string | null }) {
  const CHAIN_ORDER = [
    "SCAN_CREATE",
    "FETCH_MARKET_CONTEXT",
    "VERIFY_PRICE_STATE",
    "COLLECT_HERMES_FINDINGS",
    "COMPRESS_EVIDENCE",
    "ATTACH_TO_AUDIT",
    "ROUTE_RESULT",
  ];

  const orderedTasks = [...run.tasks].sort(
    (a, b) => CHAIN_ORDER.indexOf(a.task_type as string) - CHAIN_ORDER.indexOf(b.task_type as string),
  );

  return (
    <div className="space-y-2">
      {/* DJZS verdict summary */}
      {run.djzs_verdict && (
        <div className="border border-primary/30 bg-primary/5 p-3 flex flex-wrap gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[8px] text-muted-foreground uppercase">DJZS VERDICT</span>
            <span className={cn("font-mono text-xs font-bold uppercase",
              run.djzs_verdict === "PASS" ? "text-emerald-400" : "text-red-400",
            )}>{run.djzs_verdict}</span>
          </div>
          {run.process_verdict && (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[8px] text-muted-foreground uppercase">PROCESS</span>
              <span className={cn("font-mono text-xs font-bold uppercase",
                run.process_verdict === "APPROVED" ? "text-emerald-400" :
                run.process_verdict === "DEGRADED" ? "text-yellow-400" : "text-red-400",
              )}>{run.process_verdict}</span>
            </div>
          )}
          {run.direction && (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[8px] text-muted-foreground uppercase">DIRECTION</span>
              <span className={cn("font-mono text-xs font-bold uppercase",
                run.direction === "LONG" ? "text-emerald-400" :
                run.direction === "SHORT" ? "text-red-400" : "text-muted-foreground",
              )}>{run.direction}</span>
            </div>
          )}
          {run.rejection_codes.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[8px] text-muted-foreground uppercase">REJECTION CODES</span>
              <span className="font-mono text-[9px] text-red-400">{run.rejection_codes.join(", ")}</span>
            </div>
          )}
          <p className="w-full font-mono text-[8px] text-muted-foreground/50 italic mt-1 pt-1 border-t border-border">
            DJZS verdict computed by the deterministic audit engine. Hermes coordinates evidence delivery — it has no authority over this result.
          </p>
        </div>
      )}

      {/* Task chain */}
      <div className="space-y-1">
        {orderedTasks.map((task, idx) => (
          <div key={task.task_id} className="flex gap-2 items-start">
            <div className="flex flex-col items-center pt-2">
              <span className="font-mono text-[8px] text-muted-foreground/40 w-3 text-right">{idx + 1}</span>
              {idx < orderedTasks.length - 1 && (
                <div className="w-px h-4 bg-border mt-1" />
              )}
            </div>
            <div className="flex-1">
              <TaskCard
                task={task}
                onRetry={onRetry}
                retrying={retryingId === task.task_id}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── main board component ──────────────────────────────────────────────────────

const ASSETS = ["BTC", "ETH", "SOL", "AVAX", "ARB", "OP"];
const TIMEFRAMES = [
  CreateHermesRunRequestTimeframe["1H"],
  CreateHermesRunRequestTimeframe["4H"],
  CreateHermesRunRequestTimeframe["1D"],
];

export default function HermesBoardPage() {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [triggerAsset, setTriggerAsset] = useState("BTC");
  const [triggerTimeframe, setTriggerTimeframe] = useState<string>(CreateHermesRunRequestTimeframe["4H"] as string);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);

  const { data: board, isLoading } = useGetHermesBoard({
    query: { queryKey: getGetHermesBoardQueryKey(), refetchInterval: 2500 },
  });

  const createRun = useCreateHermesRun({
    mutation: {
      onSuccess: (run) => {
        queryClient.invalidateQueries({ queryKey: getGetHermesBoardQueryKey() });
        setSelectedRunId(run.run_id);
      },
    },
  });

  const retryTask = useRetryHermesTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHermesBoardQueryKey() });
        setRetryingTaskId(null);
      },
      onError: () => setRetryingTaskId(null),
    },
  });

  const handleTrigger = () => {
    createRun.mutate({
      data: { asset: triggerAsset, timeframe: triggerTimeframe as "1H" | "4H" | "1D" },
    });
  };

  const handleRetry = (task: HermesTask) => {
    setRetryingTaskId(task.task_id);
    retryTask.mutate({ runId: task.run_id, taskId: task.task_id });
  };

  const selectedRun = board?.runs.find((r) => r.run_id === selectedRunId) ?? board?.runs[0] ?? null;

  const hasActiveRuns = board?.runs.some((r) => r.overall_status === (HermesRunOverallStatus.RUNNING as string));
  const health: HermesBoardSystemHealth | undefined = board?.system_health;

  return (
    <div className="space-y-5 pb-12">

      {/* AUTHORITY BOUNDARY NOTICE */}
      <div className="border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
        <div className="w-1 h-full min-h-[16px] bg-primary/40 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-primary/70">
            Authority Boundary — Operations Board
          </p>
          <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
            This board coordinates workflow and evidence movement only.
            Hermes workers gather and hand off evidence — they do not determine LONG / SHORT, PASS / FAIL, or admissibility.
            <span className="text-foreground font-bold"> DJZS remains the sole deterministic audit authority.</span>
            {" "}Verdicts shown here are read from the audit record — not computed by this board.
          </p>
        </div>
      </div>

      {/* WORKER POOL + SYSTEM HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">

        {/* Worker chips */}
        <div className="bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              WORKER POOL
            </h3>
            {hasActiveRuns && (
              <span className="font-mono text-[8px] text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 animate-pulse">
                CYCLE ACTIVE
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(board?.workers ?? []).map((w) => (
              <WorkerChip key={w.worker_id} w={w} />
            ))}
            {isLoading && !board && (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border bg-background px-3 py-2 w-[140px] h-[72px] animate-pulse" />
              ))
            )}
          </div>
        </div>

        {/* System health */}
        <div className="bg-card border border-border p-4 space-y-3 min-w-[260px]">
          <h3 className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            SYSTEM HEALTH
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <HealthStat label="RUNS TODAY"    value={health?.total_runs_today  ?? 0} />
            <HealthStat label="FAILED TASKS"  value={health?.failed_tasks_today ?? 0} warn />
            <HealthStat label="BLOCKED"       value={health?.blocked_tasks ?? 0}     warn />
            <HealthStat label="WORKER ERRORS" value={health?.worker_errors  ?? 0}    warn />
          </div>
        </div>
      </div>

      {/* TRIGGER NEW SCAN RUN */}
      <div className="bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              TRIGGER SCAN RUN
            </h3>
            <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5 uppercase">
              Initiates one full 7-task pipeline cycle for the selected asset
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[8px] uppercase text-muted-foreground">ASSET</label>
            <select
              value={triggerAsset}
              onChange={(e) => setTriggerAsset(e.target.value)}
              className="bg-background border border-border font-mono text-xs text-foreground px-2 py-1.5 h-8 focus:outline-none focus:border-primary"
            >
              {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[8px] uppercase text-muted-foreground">TIMEFRAME</label>
            <select
              value={triggerTimeframe}
              onChange={(e) => setTriggerTimeframe(e.target.value)}
              className="bg-background border border-border font-mono text-xs text-foreground px-2 py-1.5 h-8 focus:outline-none focus:border-primary"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf as string} value={tf as string}>{tf as string}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[8px] uppercase text-muted-foreground opacity-0 select-none">X</label>
            <button
              onClick={handleTrigger}
              disabled={createRun.isPending}
              className="font-mono text-xs uppercase tracking-widest border border-primary text-primary px-4 h-8 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40"
            >
              {createRun.isPending ? "INITIATING…" : "▶ INITIATE SCAN"}
            </button>
          </div>
        </div>
      </div>

      {/* KANBAN LANES */}
      <div className="bg-card border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
            TASK LANES
          </h3>
          <p className="font-mono text-[8px] text-muted-foreground/50 uppercase">
            Live view — all runs · auto-refreshes every 2.5s
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["triage", "ready", "in_progress", "blocked", "done", "failed"] as const).map((lk) => (
            <KanbanLane
              key={lk}
              laneKey={lk}
              tasks={(board?.lanes as unknown as Record<string, HermesTask[]>)?.[lk] ?? []}
              onRetry={handleRetry}
              retryingId={retryingTaskId}
            />
          ))}
        </div>
      </div>

      {/* RECENT RUNS LIST */}
      <div className="bg-card border border-border p-4 space-y-3">
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
          RECENT RUNS
        </h3>

        {isLoading && !board && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border h-12 animate-pulse" />
            ))}
          </div>
        )}

        {board && board.runs.length === 0 && (
          <div className="border border-border p-6 text-center">
            <p className="font-mono text-[9px] text-muted-foreground uppercase">
              No runs yet — trigger a scan to begin
            </p>
          </div>
        )}

        <div className="space-y-1">
          {(board?.runs ?? []).map((run) => {
            const isSelected = run.run_id === (selectedRun?.run_id ?? null);
            const failed = run.tasks.filter((t) => t.status === (HermesTaskStatus.FAILED as string)).length;
            const done = run.tasks.filter((t) => t.status === (HermesTaskStatus.DONE as string)).length;
            return (
              <button
                key={run.run_id}
                onClick={() => setSelectedRunId(run.run_id)}
                className={cn(
                  "w-full text-left border p-3 flex items-center gap-4 hover:border-primary/50 transition-colors",
                  isSelected ? "border-primary/40 bg-primary/5" : "border-border bg-background",
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-[100px]">
                  <span className="font-mono text-[9px] font-bold text-foreground">
                    {run.asset} / {run.timeframe}
                  </span>
                  <span className="font-mono text-[8px] text-muted-foreground/50">
                    {run.run_id}
                  </span>
                </div>

                <RunStatusBadge status={run.overall_status as string} />

                <div className="flex gap-3 font-mono text-[8px] text-muted-foreground/60">
                  <span>✓{done} / 7</span>
                  {failed > 0 && <span className="text-red-400">✗{failed}</span>}
                </div>

                <div className="ml-auto font-mono text-[8px] text-muted-foreground/40">
                  {relativeTime(run.triggered_at)}
                </div>

                {run.djzs_verdict && (
                  <span className={cn(
                    "font-mono text-[8px] uppercase border px-1.5 py-0.5",
                    run.djzs_verdict === "PASS" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400",
                  )}>
                    DJZS {run.djzs_verdict}
                  </span>
                )}

                <span className="font-mono text-[9px] text-muted-foreground/30">
                  {isSelected ? "▲" : "▼"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED RUN DETAIL */}
      {selectedRun && (
        <div className="bg-card border border-border p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                RUN DETAIL — {selectedRun.asset} / {selectedRun.timeframe}
              </h3>
              <p className="font-mono text-[8px] text-muted-foreground/50 mt-0.5">
                {selectedRun.run_id} · triggered {relativeTime(selectedRun.triggered_at)}
                {selectedRun.completed_at && ` · completed ${relativeTime(selectedRun.completed_at)}`}
              </p>
            </div>
            <RunStatusBadge status={selectedRun.overall_status as string} />
          </div>

          <div className="border-t border-border pt-3">
            <p className="font-mono text-[8px] text-muted-foreground/50 uppercase mb-3">
              TASK PIPELINE — SCAN_CREATE → FETCH_MARKET_CONTEXT ↓ VERIFY_PRICE_STATE ↓ COLLECT_HERMES_FINDINGS → COMPRESS_EVIDENCE → ATTACH_TO_AUDIT → ROUTE_RESULT
            </p>
            <RunTaskPipeline
              run={selectedRun}
              onRetry={handleRetry}
              retryingId={retryingTaskId}
            />
          </div>
        </div>
      )}

      {/* BOUNDARY FOOTER */}
      <div className="border border-border px-4 py-3">
        <p className="font-mono text-[8px] text-muted-foreground/40 uppercase leading-relaxed">
          HERMES KANBAN — WORKFLOW COORDINATION ONLY · TASK STATUSES: TRIAGE → READY → IN PROGRESS → BLOCKED / DONE / FAILED ·
          DJZS AUDIT AT ATTACH_TO_AUDIT IS DETERMINISTIC — NO KANBAN OVERRIDE IS POSSIBLE ·
          BLOCKED STATE SURFACES FAILED UPSTREAM DEPENDENCIES WITHOUT SILENT PASS-THROUGH ·
          RETRY CONTROLS RE-QUEUE FAILED TASKS ONLY — THEY DO NOT MODIFY AUDIT RULES OR SIGNAL SCORING
        </p>
      </div>

    </div>
  );
}
