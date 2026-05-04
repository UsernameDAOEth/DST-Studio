import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, ShieldOff, ShieldCheck } from "lucide-react";
import { PreTradeChecklist } from "@workspace/api-client-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function VerdictBadge({ value, size = "sm" }: { value?: string; size?: "sm" | "lg" }) {
  if (!value) return null;
  const chipClass =
    value === "PASS" || value === "APPROVED" || value === "ADMISSIBLE" ? "chip-pass" :
    value === "FAIL" || value === "REJECTED" || value === "INADMISSIBLE" ? "chip-fail" :
    value === "WARN" || value === "DEGRADED" || value === "CONDITIONAL" ? "chip-warn" :
    value === "SKIP" ? "chip-skip" :
    "chip-neutral";
  const dotClass =
    value === "PASS" || value === "APPROVED" || value === "ADMISSIBLE" ? "bg-primary" :
    value === "FAIL" || value === "REJECTED" || value === "INADMISSIBLE" ? "bg-destructive" :
    value === "WARN" || value === "DEGRADED" || value === "CONDITIONAL" ? "bg-[hsl(var(--trade-wait))]" :
    null;
  if (size === "lg") {
    return (
      <span className={cn(chipClass, "text-xs px-3 py-1")}>
        {dotClass && <span className={cn("w-1.5 h-1.5 rounded-none mr-1.5 inline-block", dotClass)} />}
        {value}
      </span>
    );
  }
  return (
    <span className={chipClass}>
      {dotClass && <span className={cn("w-1.5 h-1.5 rounded-none mr-1.5 inline-block", dotClass)} />}
      {value}
    </span>
  );
}

export function ProcessVerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return null;
  return <VerdictBadge value={verdict} />;
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
  if (family === "TREND_CONTINUATION_LONG") return <span className="text-primary font-mono text-[10px] uppercase tracking-wider">TREND CONT ↑</span>;
  if (family === "TREND_CONTINUATION_SHORT") return <span className="text-destructive font-mono text-[10px] uppercase tracking-wider">TREND CONT ↓</span>;
  if (family === "RANGE_LONG" || family === "RANGE_SHORT") return <span className="text-[hsl(var(--trade-wait))]/80 font-mono text-[10px] uppercase tracking-wider">RANGE (2°)</span>;
  if (family === "NO_SETUP") return <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">NO SETUP</span>;
  return <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">{family}</span>;
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
  const colorClass =
    risk === "LOW" ? "bg-primary" :
    risk === "MEDIUM" ? "bg-[hsl(var(--trade-wait))]" :
    "bg-destructive";
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] text-foreground uppercase tracking-wider">
      <div className={cn("w-2 h-2 rounded-none shrink-0", colorClass)} />
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

const GRADE_TOOLTIPS: Record<string, string> = {
  A: "All hard rules met, strong structural evidence, high-conviction setup",
  B: "All hard rules met, moderate structural evidence",
  C: "Marginal — some rules met, reduced conviction",
  D: "Weak — multiple soft failures, significant risk of false signal",
  F: "Hard execution rule failure — no admissible setup",
};

export function ProcessGradeBadge({ grade }: { grade?: string }) {
  if (!grade) return null;
  const gradeStyles: Record<string, string> = {
    A: "bg-primary/15 text-primary border-primary/40",
    B: "bg-primary/8 text-primary/80 border-primary/25",
    C: "bg-[hsl(var(--trade-wait))]/15 text-[hsl(var(--trade-wait))] border-[hsl(var(--trade-wait))]/40",
    D: "bg-destructive/15 text-destructive/80 border-destructive/40",
    F: "bg-destructive/25 text-destructive border-destructive/60",
  };
  const style = gradeStyles[grade] || "bg-muted text-muted-foreground border-border";
  const tooltipText = GRADE_TOOLTIPS[grade] || "Process quality grade";
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn("w-11 h-11 flex items-center justify-center border font-mono text-xl font-bold rounded-none cursor-help", style)}
          >
            {grade}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-mono text-[10px] uppercase tracking-wider max-w-[220px] text-center">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
      {grade === "F" && (
        <span className="font-mono text-[9px] text-destructive/70 uppercase tracking-wider max-w-[120px] leading-tight">
          HARD RULE FAILURE
        </span>
      )}
    </div>
  );
}

export function RRRatioBadge({ ratio }: { ratio?: number }) {
  if (ratio === undefined || ratio === null) return null;
  const colorClass =
    ratio >= 2 ? "text-primary" :
    ratio >= 1.5 ? "text-[hsl(var(--trade-wait))]" :
    "text-destructive";
  return (
    <span className={cn("font-mono font-bold text-sm mono-nums", colorClass)}>
      {ratio.toFixed(1)}x R/R
    </span>
  );
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-2.5 font-mono text-xs">
            {item.pass ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            )}
            <span className={item.pass ? "text-foreground" : "text-muted-foreground/60"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {!checklist.checklistComplete && checklist.missingFields && checklist.missingFields.length > 0 && (
        <div className="mt-3 p-3 border border-[hsl(var(--trade-wait))]/30 bg-[hsl(var(--trade-wait))]/6 text-[hsl(var(--trade-wait))] font-mono text-[10px]">
          <div className="uppercase font-bold tracking-widest mb-1.5">MISSING REQUIRED FIELDS:</div>
          <div className="flex flex-wrap gap-2">
            {checklist.missingFields.map(f => (
              <span key={f} className="chip-warn">{f}</span>
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
      <div className="border border-destructive/35 bg-destructive/4 p-5 space-y-4" style={{ boxShadow: "0 0 12px color-mix(in srgb, hsl(0 90% 58%) 6%, transparent)" }}>
        <div className="flex items-start gap-3">
          <ShieldOff className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="font-mono text-sm text-destructive font-bold uppercase tracking-wide mb-1.5">
              {isWait ? "NOT A TRADE — WAIT IS DISCIPLINED" : "AUDIT REJECTED — PROCESS HALTED"}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground leading-relaxed uppercase tracking-wide">
              {isWait
                ? "WAIT is the correct output when no setup meets the admissibility threshold. The DJZS audit found insufficient structural evidence for a directional position. This is the system working as designed — not a missed opportunity."
                : "DJZS audit returned a rejection verdict. One or more hard admissibility rules failed. Review rejection codes before reconsidering any directional position."}
            </div>
          </div>
        </div>

        {rejectionCodes && rejectionCodes.length > 0 && (
          <div>
            <div className="micro-label text-destructive/60 mb-2">WHY THIS IS NOT A TRADE</div>
            <div className="flex flex-wrap gap-2">
              {rejectionCodes.map(code => (
                <span key={code} className="chip-fail">{code}</span>
              ))}
            </div>
          </div>
        )}

        {logicAdmissibility === "INADMISSIBLE" && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-destructive/70 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 bg-destructive rounded-none shrink-0" />
            DJZS AUDIT: SETUP IS LOGICALLY INADMISSIBLE — CANNOT APPROVE REGARDLESS OF MARKET CONDITIONS
          </div>
        )}

        {rejectIf && rejectIf.length > 0 && (
          <div>
            <div className="micro-label text-muted-foreground/60 mb-2">INVALIDATION CONDITIONS</div>
            <ul className="space-y-1">
              {rejectIf.map((cond, i) => (
                <li key={i} className="flex items-start gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="text-destructive/50 shrink-0">—</span>
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
      <div className="border border-[hsl(var(--trade-wait))]/30 bg-[hsl(var(--trade-wait))]/4 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[hsl(var(--trade-wait))] shrink-0 mt-0.5" />
          <div>
            <div className="font-mono text-sm text-[hsl(var(--trade-wait))] font-bold uppercase tracking-wide mb-1.5">
              SIGNAL DEGRADED — REDUCED CONVICTION
            </div>
            <div className="font-mono text-[10px] text-muted-foreground leading-relaxed uppercase tracking-wide">
              SETUP PASSED THE STRUCTURAL AUDIT BUT WAS DEGRADED BY AN EXTERNAL CONFIDENCE LAYER (PYTH). POSITION SIZING AND CONVICTION SHOULD BE REDUCED ACCORDINGLY.
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
      isPass ? "border-primary/25 bg-primary/4" :
      isFail ? "border-destructive/25 bg-destructive/4" :
      "border-border bg-card"
    )}>
      {isPass ? (
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      ) : isFail ? (
        <ShieldOff className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <div className="micro-label mb-1.5">DJZS AUDIT VERDICT</div>
        <div className={cn(
          "font-mono text-sm font-bold uppercase tracking-wider",
          isPass ? "text-primary" : isFail ? "text-destructive" : "text-muted-foreground"
        )}>
          {verdict || "—"}
        </div>
        {admissibility && (
          <div className="mt-2">
            <LogicAdmissibilityBadge admissibility={admissibility} />
          </div>
        )}
        <div className="micro-label text-muted-foreground/50 mt-2.5 leading-relaxed normal-case text-[9px] uppercase tracking-wider">
          DJZS audits setups for admissibility. Verdict is final — deterministic, never overridden by narrative or market conditions.
        </div>
      </div>
    </div>
  );
}

export function RoutingPriorityPanel({ direction, processVerdict }: { direction: string; processVerdict?: string }) {
  const isApproved = processVerdict === "APPROVED";
  const isDegraded = processVerdict === "DEGRADED";

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <span>ROUTING PRIORITY</span>
        <span className="text-muted-foreground/40">HERMES DELIVERY LAYER</span>
      </div>
      <div className="p-4">
        {direction === "WAIT" || (!isApproved && !isDegraded) ? (
          <div className="font-mono text-xs text-muted-foreground flex items-center gap-3">
            <span className="chip-skip">NONE</span>
            <span>Setup did not pass audit. No alert or delivery channel will be triggered.</span>
          </div>
        ) : isDegraded ? (
          <div className="font-mono text-xs text-[hsl(var(--trade-wait))] flex items-center gap-3">
            <span className="chip-warn">LOW</span>
            <span>Degraded signals route at reduced priority. Manual review required before acting on this setup.</span>
          </div>
        ) : (
          <div className="font-mono text-xs text-primary flex items-center gap-3">
            <span className="chip-pass">STANDARD</span>
            <span>Audit approved — eligible for configured alert routing (Telegram, XMTP, Discord) when enabled in Hermes.</span>
          </div>
        )}
      </div>
    </div>
  );
}
