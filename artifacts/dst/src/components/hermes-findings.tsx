import {
  useGetHermesFindings,
  useGetHermesFindingsForTarget,
  getGetHermesFindingsQueryKey,
  getGetHermesFindingsForTargetQueryKey,
  AgentFinding,
  AgentFindingEvidence,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const BOUNDARY_TEXT =
  "HERMES SUBMITS FINDINGS ONLY. Confidence is metadata — not a score. " +
  "Suggested flags are hints — not verdicts. DJZS is the deterministic audit gate. " +
  "Capital movement requires the user's decision.";

const OBS_COLOR: Record<string, string> = {
  FUNDING_RATE: "text-primary",
  OPEN_INTEREST: "text-primary",
  LIQUIDATION_CLUSTER: "text-destructive",
  THESIS_EVENT: "text-[hsl(var(--trade-wait))]",
  NEWS: "text-[hsl(var(--trade-wait))]",
  PROTOCOL_EVENT: "text-[hsl(var(--trade-wait))]",
  PRICE_ACTION: "text-foreground",
  WALLET_ACTIVITY: "text-foreground",
  CUSTOM: "text-muted-foreground",
};

export function HermesBoundaryPanel() {
  return (
    <div className="border border-primary/20 bg-primary/5 p-4">
      <div className="font-mono text-[10px] leading-relaxed uppercase tracking-wide text-muted-foreground">
        <span className="text-primary font-bold mr-2">BOUNDARY:</span>
        {BOUNDARY_TEXT}
      </div>
    </div>
  );
}

export function HermesFindingCard({ finding }: { finding: AgentFinding }) {
  const obsColor = OBS_COLOR[finding.observationType] ?? "text-foreground";
  const evidence = (finding.evidence ?? []) as AgentFindingEvidence[];

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("font-mono text-[10px] font-bold uppercase", obsColor)}>
            {finding.observationType}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {finding.marketType}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] font-bold text-foreground">{finding.target}</span>
          <span
            className={cn(
              "chip text-[8px]",
              finding.status === "ACTIVE" ? "chip-pass" : "chip-neutral",
            )}
          >
            {finding.status}
          </span>
        </div>
      </div>

      <p className="font-mono text-xs text-foreground leading-relaxed">{finding.summary}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-mono text-muted-foreground">
        <span>SOURCE: {finding.sourceAgent}</span>
        <span>
          CONF: {(finding.confidence * 100).toFixed(0)}%{" "}
          <span className="opacity-50">(metadata)</span>
        </span>
        <span>{new Date(finding.createdAt).toLocaleTimeString()}</span>
      </div>

      {finding.suggestedFlags && finding.suggestedFlags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          {finding.suggestedFlags.map((flag, i) => (
            <span key={i} className="chip-warn text-[8px]">
              {flag}
            </span>
          ))}
          <span className="font-mono text-[8px] text-muted-foreground/60 ml-1">
            hints — not verdicts
          </span>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="mt-1 space-y-1 border-t border-border pt-2">
          {evidence.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 font-mono text-[9px]">
              <span
                className={cn(
                  "shrink-0 uppercase font-bold",
                  ev.reliability === "VERIFIED"
                    ? "text-primary"
                    : ev.reliability === "CONFLICTING"
                      ? "text-destructive"
                      : ev.reliability === "STALE"
                        ? "text-[hsl(var(--trade-wait))]"
                        : "text-muted-foreground",
                )}
              >
                [{ev.reliability}]
              </span>
              <span className="text-muted-foreground truncate">{ev.source}</span>
              {ev.excerpt && (
                <span className="text-muted-foreground/60 italic truncate">{ev.excerpt}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HermesFindingsPanel({ limit = 20 }: { limit?: number }) {
  const queryClient = useQueryClient();
  const { data: findings, isLoading } = useGetHermesFindings({ limit });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetHermesFindingsQueryKey() });
  };

  return (
    <div className="bg-card border border-border flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <h3 className="font-mono text-sm font-bold uppercase text-foreground">
            FINDINGS LOG
          </h3>
          <p className="font-mono text-[10px] text-muted-foreground uppercase mt-0.5">
            INGRESS ONLY — AGENT OBSERVATIONS SUBMITTED TO HERMES
          </p>
        </div>
        <button
          onClick={refresh}
          className="font-mono text-[10px] uppercase border border-border px-3 py-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          REFRESH
        </button>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
          </div>
        ) : !findings || findings.length === 0 ? (
          <div className="py-10 text-center font-mono text-xs text-muted-foreground uppercase">
            <div className="mb-2">NO FINDINGS INGESTED YET</div>
            <div className="text-[10px] opacity-60">
              Hermes agents submit via POST /hermes/findings
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {findings.map((finding) => (
              <HermesFindingCard key={finding.findingId} finding={finding} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function HermesTargetFindingsPanel({ target }: { target: string }) {
  const queryClient = useQueryClient();
  const { data: findings, isLoading } = useGetHermesFindingsForTarget(target, {
    query: { enabled: !!target, queryKey: getGetHermesFindingsForTargetQueryKey(target) },
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: getGetHermesFindingsForTargetQueryKey(target),
    });
  };

  if (isLoading) {
    return (
      <div className="terminal-panel">
        <div className="terminal-panel-header">
          <span>HERMES CONTEXT</span>
          <span className="text-muted-foreground/40 text-[9px]">{target}</span>
        </div>
        <div className="p-4 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!findings || findings.length === 0) {
    return null;
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <span>HERMES CONTEXT — {target}</span>
        <div className="flex items-center gap-3">
          <span className="chip-neutral text-[8px]">{findings.length} FINDING{findings.length !== 1 ? "S" : ""}</span>
          <button
            onClick={refresh}
            className="font-mono text-[9px] uppercase text-muted-foreground/60 hover:text-primary transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <HermesBoundaryPanel />
        <div className="space-y-3">
          {findings.map((finding) => (
            <HermesFindingCard key={finding.findingId} finding={finding} />
          ))}
        </div>
      </div>
    </div>
  );
}
