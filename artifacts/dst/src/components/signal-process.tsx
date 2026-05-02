import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, ShieldOff, ShieldCheck } from "lucide-react";
import { PreTradeChecklist } from "@workspace/api-client-react";

export function ProcessVerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return null;
  if (verdict === "APPROVED") return <span className="chip-pass"><span className="w-1.5 h-1.5 rounded-none bg-primary mr-1.5"></span>APPROVED</span>;
  if (verdict === "REJECTED") return <span className="chip-fail"><span className="w-1.5 h-1.5 rounded-none bg-destructive mr-1.5"></span>REJECTED</span>;
  if (verdict === "DEGRADED") return <span className="chip-warn"><span className="w-1.5 h-1.5 rounded-none bg-[hsl(var(--trade-wait))] mr-1.5"></span>DEGRADED</span>;
  return <span className="chip-neutral">{verdict}</span>;
}

export function LogicAdmissibilityBadge({ admissibility }: { admissibility?: string }) {
  if (!admissibility) return null;
  if (admissibility === "ADMISSIBLE") return <span className="chip-pass">ADMISSIBLE</span>;
  if (admissibility === "INADMISSIBLE") return <span className="chip-fail">INADMISSIBLE</span>;
  if (admissibility === "CONDITIONAL") return <span className="chip-warn">CONDITIONAL</span>;
  return <span className="chip-neutral">{admissibility}</span>;
}

export function SetupFamilyLabel({ family }: { family?: string }) {
  if (!family) return null;
  if (family === "TREND_CONTINUATION_LONG") return <span className="text-primary font-mono text-xs">TREND CONT. ↑</span>;
  if (family === "TREND_CONTINUATION_SHORT") return <span className="text-destructive font-mono text-xs">TREND CONT. ↓</span>;
  if (family === "RANGE_LONG" || family === "RANGE_SHORT") return <span className="text-[hsl(var(--trade-wait))] opacity-80 font-mono text-xs">RANGE (2°)</span>;
  if (family === "NO_SETUP") return <span className="text-muted-foreground font-mono text-xs">NO SETUP</span>;
  return <span className="text-muted-foreground font-mono text-xs">{family}</span>;
}

export function EntryQualityBadge({ quality }: { quality?: string }) {
  if (!quality) return null;
  if (quality === "OPTIMAL") return <span className="chip-pass">OPTIMAL</span>;
  if (quality === "ACCEPTABLE") return <span className="chip-neutral">ACCEPTABLE</span>;
  if (quality === "LATE") return <span className="chip-warn">LATE</span>;
  if (quality === "INVALID") return <span className="chip-fail">INVALID</span>;
  return <span className="chip-neutral">{quality}</span>;
}

export function NarrativeRiskBadge({ risk }: { risk?: string }) {
  if (!risk) return null;
  const colorClass = risk === "LOW" ? "bg-primary" : risk === "MEDIUM" ? "bg-[hsl(var(--trade-wait))]" : "bg-destructive";
  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-foreground uppercase">
      <div className={cn("w-2 h-2 rounded-none", colorClass)} />
      {risk} RISK
    </div>
  );
}

export function RejectionCodeList({ codes }: { codes?: string[] }) {
  if (!codes || codes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {codes.map(code => (
        <span key={code} className="chip-fail">{code}</span>
      ))}
    </div>
  );
}

export function ProcessGradeBadge({ grade }: { grade?: string }) {
  if (!grade) return null;
  const gradeStyles: Record<string, string> = {
    A: "bg-primary/20 text-primary border-primary",
    B: "bg-primary/10 text-primary/80 border-primary/50",
    C: "bg-[hsl(var(--trade-wait))]/20 text-[hsl(var(--trade-wait))] border-[hsl(var(--trade-wait))]",
    D: "bg-destructive/20 text-destructive/80 border-destructive/50",
    F: "bg-destructive/30 text-destructive border-destructive",
  };
  const style = gradeStyles[grade] || "bg-muted text-muted-foreground border-border";
  return (
    <div className={cn("w-12 h-12 flex items-center justify-center border font-mono text-2xl font-bold rounded-none", style)}>
      {grade}
    </div>
  );
}

export function RRRatioBadge({ ratio }: { ratio?: number }) {
  if (ratio === undefined || ratio === null) return null;
  const colorClass = ratio >= 2 ? "text-primary" : ratio >= 1.5 ? "text-[hsl(var(--trade-wait))]" : "text-destructive";
  return <span className={cn("font-mono font-bold", colorClass)}>{ratio.toFixed(1)}x R/R</span>;
}

export function PreTradeChecklistPanel({ checklist }: { checklist?: PreTradeChecklist }) {
  if (!checklist) return null;
  
  const items = [
    { key: "thesis", label: "Thesis Defined", pass: !!checklist.thesis },
    { key: "regimeConfirmed", label: "Regime Confirmed", pass: checklist.regimeConfirmed },
    { key: "entryZoneDefined", label: "Entry Zone Defined", pass: checklist.entryZoneDefined },
    { key: "invalidationDefined", label: "Invalidation Defined", pass: checklist.invalidationDefined },
    { key: "targetDefined", label: "Target Defined", pass: checklist.targetDefined },
    { key: "reasonCodesPresent", label: "Reason Codes Present", pass: checklist.reasonCodesPresent },
    { key: "rejectConditionsDefined", label: "Reject Conditions Defined", pass: checklist.rejectConditionsDefined },
    { key: "rrRatioAcceptable", label: "R/R Ratio Acceptable", pass: checklist.rrRatioAcceptable },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-3 font-mono text-sm">
            {item.pass ? (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive shrink-0" />
            )}
            <span className={item.pass ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      
      {!checklist.checklistComplete && checklist.missingFields && checklist.missingFields.length > 0 && (
        <div className="mt-4 p-3 border border-[hsl(var(--trade-wait))] bg-[hsl(var(--trade-wait))]/10 text-[hsl(var(--trade-wait))] font-mono text-xs">
          <div className="uppercase font-bold mb-1">MISSING REQUIRED FIELDS:</div>
          <div className="flex flex-wrap gap-2">
            {checklist.missingFields.map(f => (
              <span key={f} className="opacity-90">{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function WaitDecisionPanel({
  direction,
  processVerdict,
  verdictDjzs,
  rejectionCodes,
  rejectIf,
  logicAdmissibility,
}: {
  direction: string;
  processVerdict?: string;
  verdictDjzs?: string;
  rejectionCodes?: string[];
  rejectIf?: string[];
  logicAdmissibility?: string;
}) {
  const isWait = direction === "WAIT";
  const isRejected = processVerdict === "REJECTED" || verdictDjzs === "FAIL";
  const isDegraded = processVerdict === "DEGRADED";

  if (!isWait && !isRejected && !isDegraded) return null;

  if (isWait || isRejected) {
    return (
      <div className="border border-destructive/40 bg-destructive/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldOff className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="font-display text-base text-destructive font-bold mb-1">
              {isWait ? "NOT A TRADE — DISCIPLINED PASS" : "PROCESS REJECTED"}
            </div>
            <div className="font-mono text-xs text-muted-foreground leading-relaxed">
              {isWait
                ? "WAIT is a deliberate outcome. The admissibility workflow found insufficient structural evidence for a directional position. This is not a missed opportunity — it is the system working as designed."
                : "The process engine has rejected this setup. One or more hard rules failed. Review the rejection codes below before reconsidering any directional position."}
            </div>
          </div>
        </div>

        {rejectionCodes && rejectionCodes.length > 0 && (
          <div>
            <div className="text-[10px] font-mono uppercase text-destructive/70 mb-2">WHY THIS IS NOT A TRADE</div>
            <div className="flex flex-wrap gap-2">
              {rejectionCodes.map(code => (
                <span key={code} className="chip-fail">{code}</span>
              ))}
            </div>
          </div>
        )}

        {logicAdmissibility === "INADMISSIBLE" && (
          <div className="text-xs font-mono text-destructive/80 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-destructive rounded-none shrink-0" />
            DJZS GATE: SETUP IS LOGICALLY INADMISSIBLE — CANNOT APPROVE REGARDLESS OF MARKET CONDITIONS
          </div>
        )}

        {rejectIf && rejectIf.length > 0 && (
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">ADDITIONAL REJECT CONDITIONS</div>
            <ul className="space-y-1">
              {rejectIf.map((cond, i) => (
                <li key={i} className="flex items-start gap-2 text-xs font-mono text-muted-foreground">
                  <span className="text-destructive/60 shrink-0">—</span>
                  <span>{cond}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (isDegraded) {
    return (
      <div className="border border-[hsl(var(--trade-wait))]/40 bg-[hsl(var(--trade-wait))]/5 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[hsl(var(--trade-wait))] shrink-0 mt-0.5" />
          <div>
            <div className="font-display text-base text-[hsl(var(--trade-wait))] font-bold mb-1">SIGNAL DEGRADED</div>
            <div className="font-mono text-xs text-muted-foreground leading-relaxed">
              This setup passed the structural gate but was degraded by an external confidence layer (Pyth or equivalent). Position sizing and conviction should be reduced accordingly.
            </div>
          </div>
        </div>
        {rejectionCodes && rejectionCodes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rejectionCodes.map(code => (
              <span key={code} className="chip-warn">{code}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function DjzsGateBadge({ verdict, admissibility }: { verdict?: string; admissibility?: string }) {
  const isPass = verdict === "PASS";
  const isFail = verdict === "FAIL";

  return (
    <div className={cn(
      "border p-4 flex items-start gap-3",
      isPass ? "border-primary/30 bg-primary/5" : isFail ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
    )}>
      {isPass ? (
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      ) : isFail ? (
        <ShieldOff className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <div>
        <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">DJZS ADMISSIBILITY GATE</div>
        <div className={cn(
          "font-display text-sm font-bold",
          isPass ? "text-primary" : isFail ? "text-destructive" : "text-muted-foreground"
        )}>
          {verdict || "---"}
        </div>
        {admissibility && (
          <div className="mt-1">
            <LogicAdmissibilityBadge admissibility={admissibility} />
          </div>
        )}
        <div className="text-[10px] font-mono text-muted-foreground/70 mt-2 leading-tight">
          DJZS is deterministic. It does not score setups — it rules them admissible or not.
        </div>
      </div>
    </div>
  );
}

export function RoutingPriorityPanel({ direction, processVerdict }: { direction: string; processVerdict?: string }) {
  const isApproved = processVerdict === "APPROVED";
  const isDegraded = processVerdict === "DEGRADED";

  return (
    <div className="border border-border bg-card p-4">
      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">ROUTING PRIORITY</div>
      {direction === "WAIT" || !isApproved && !isDegraded ? (
        <div className="font-mono text-xs text-muted-foreground">
          <span className="chip-skip mr-2">NONE</span>
          Setup does not meet routing threshold. No alert or delivery channel will be triggered.
        </div>
      ) : isDegraded ? (
        <div className="font-mono text-xs text-[hsl(var(--trade-wait))]">
          <span className="chip-warn mr-2">LOW</span>
          Degraded signals route at reduced priority. Manual review recommended before acting.
        </div>
      ) : (
        <div className="font-mono text-xs text-primary">
          <span className="chip-pass mr-2">STANDARD</span>
          Approved signal eligible for configured alert routing (Telegram, XMTP, Discord) when enabled in Hermes.
        </div>
      )}
    </div>
  );
}
