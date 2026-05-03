import { cn } from "@/lib/utils";

type VerificationStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

type FailureModeCode =
  | "DETERMINISM_VIOLATION"
  | "INPUT_NORMALIZATION_ERROR"
  | "STALE_MARKET_STATE"
  | "MISSING_REQUIRED_FIELD"
  | "CONFLICTING_SOURCE_DATA"
  | "SEMANTIC_LAYER_UNAVAILABLE"
  | "FALLBACK_ONLY_MODE";

interface VerificationCheck {
  code: string;
  status: VerificationStatus;
  detail: string;
  sourceDependency: string;
  isHardFail: boolean;
  failureModeCode?: FailureModeCode;
}

interface VerificationReport {
  packetHash: string;
  normalizationError: boolean;
  fastPathPassed: boolean;
  shortCircuited: boolean;
  shortCircuitReason: string | null;
  checks: VerificationCheck[];
  failureCodes: FailureModeCode[];
  degradedState: boolean;
  fallbackOnlyMode: boolean;
  semanticLayerAllowed: boolean;
  hermesEvidenceOnly: true;
  verifiedAt: string;
}

function statusDot(status: VerificationStatus): string {
  if (status === "PASS") return "bg-primary";
  if (status === "FAIL") return "bg-destructive";
  if (status === "WARN") return "bg-[hsl(var(--trade-wait))]";
  return "bg-muted-foreground/20";
}

function statusTextColor(status: VerificationStatus): string {
  if (status === "PASS") return "text-primary";
  if (status === "FAIL") return "text-destructive";
  if (status === "WARN") return "text-[hsl(var(--trade-wait))]";
  return "text-muted-foreground/40";
}

function failureModeChipClass(code: FailureModeCode): string {
  if (code === "INPUT_NORMALIZATION_ERROR" || code === "DETERMINISM_VIOLATION" || code === "FALLBACK_ONLY_MODE") {
    return "text-destructive border-destructive/40 bg-destructive/5";
  }
  if (code === "STALE_MARKET_STATE" || code === "CONFLICTING_SOURCE_DATA") {
    return "text-[hsl(var(--trade-wait))] border-[hsl(var(--trade-wait))]/40 bg-[hsl(var(--trade-wait))]/5";
  }
  return "text-muted-foreground border-border bg-muted/20";
}

function panelBorder(report: VerificationReport): string {
  if (!report.fastPathPassed) return "border-destructive/40";
  if (report.degradedState) return "border-[hsl(var(--trade-wait))]/30";
  return "border-primary/20";
}

function overallLabel(report: VerificationReport): { label: string; color: string } {
  if (!report.fastPathPassed) return { label: "HARD FAIL", color: "text-destructive" };
  if (report.degradedState) return { label: "DEGRADED", color: "text-[hsl(var(--trade-wait))]" };
  return { label: "VERIFIED", color: "text-primary" };
}

export function VerificationPanel({ report }: { report: VerificationReport }) {
  const { label, color } = overallLabel(report);
  const passCount = report.checks.filter((c) => c.status === "PASS").length;
  const warnCount = report.checks.filter((c) => c.status === "WARN").length;
  const hardFailCount = report.checks.filter((c) => c.isHardFail && c.status === "FAIL").length;

  return (
    <div className={cn("terminal-panel", panelBorder(report))}>
      <div className="terminal-panel-header">
        <span>PACKET VERIFICATION</span>
        <span className={cn("font-mono text-[10px] font-bold tracking-widest", color)}>{label}</span>
      </div>

      <div className="p-5 space-y-4">

        {/* Hash identity + summary counts */}
        <div className="flex flex-col md:flex-row md:items-start gap-4 pb-4 border-b border-border/40">
          <div className="flex-1 min-w-0">
            <div className="micro-label mb-1">CANONICAL PACKET HASH</div>
            <div className="font-mono text-[12px] text-primary tracking-[0.15em] font-bold">
              {report.packetHash}
            </div>
            <div className="font-mono text-[8px] text-muted-foreground/35 mt-1 uppercase tracking-widest">
              SHA-256 · NORMALIZED INPUT · 16 HEX CHARS · SAME INPUT → SAME HASH
            </div>
          </div>
          <div className="flex gap-5 shrink-0">
            <div className="text-center">
              <div className="font-mono text-lg text-primary font-bold leading-none">{passCount}</div>
              <div className="micro-label mt-1">PASS</div>
            </div>
            <div className="text-center">
              <div className={cn("font-mono text-lg font-bold leading-none", warnCount > 0 ? "text-[hsl(var(--trade-wait))]" : "text-muted-foreground/20")}>
                {warnCount}
              </div>
              <div className="micro-label mt-1">WARN</div>
            </div>
            <div className="text-center">
              <div className={cn("font-mono text-lg font-bold leading-none", hardFailCount > 0 ? "text-destructive" : "text-muted-foreground/20")}>
                {hardFailCount}
              </div>
              <div className="micro-label mt-1">HARD FAIL</div>
            </div>
          </div>
        </div>

        {/* Normalization error notice */}
        {report.normalizationError && (
          <div className="px-3 py-2 border border-destructive/40 bg-destructive/5">
            <div className="micro-label text-destructive mb-1">INPUT NORMALIZATION ERROR</div>
            <div className="font-mono text-[10px] text-destructive/80 leading-relaxed">
              One or more input fields could not be cleanly normalized. Verification running on best-available inputs.
            </div>
          </div>
        )}

        {/* Short-circuit notice */}
        {report.shortCircuited && report.shortCircuitReason && (
          <div className="px-3 py-2 border border-destructive/40 bg-destructive/5">
            <div className="micro-label text-destructive mb-1">FAST PATH SHORT-CIRCUITED</div>
            <div className="font-mono text-[10px] text-destructive/80 leading-relaxed">
              {report.shortCircuitReason}
            </div>
          </div>
        )}

        {/* Failure mode codes */}
        {report.failureCodes.length > 0 && (
          <div>
            <div className="micro-label mb-2">FAILURE MODE CODES</div>
            <div className="flex flex-wrap gap-1.5">
              {report.failureCodes.map((code) => (
                <span
                  key={code}
                  className={cn(
                    "px-2 py-0.5 border font-mono text-[8px] font-bold uppercase tracking-wider",
                    failureModeChipClass(code),
                  )}
                >
                  {code.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Per-check table */}
        <div>
          <div className="micro-label mb-2">FAST-PATH CHECKS — {report.checks.length} TOTAL</div>
          <div className="space-y-0">
            {report.checks.map((c) => (
              <div
                key={c.code}
                className={cn(
                  "flex items-start gap-3 py-2.5 border-b border-border/20 last:border-0",
                  c.status === "FAIL" && c.isHardFail ? "bg-destructive/4" : "",
                )}
              >
                {/* Status indicator */}
                <div className="shrink-0 pt-0.5">
                  <div className={cn("w-1.5 h-1.5 mt-0.5", statusDot(c.status))} />
                </div>

                {/* Code + detail */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                    <span className={cn("font-mono text-[9px] font-bold uppercase tracking-wider", statusTextColor(c.status))}>
                      {c.code.replace(/_/g, " ")}
                    </span>
                    {c.isHardFail && c.status !== "SKIP" && (
                      <span className="font-mono text-[7px] text-destructive/50 border border-destructive/20 px-1 py-px uppercase tracking-wider">
                        HARD
                      </span>
                    )}
                    {c.failureModeCode && (c.status === "FAIL" || c.status === "WARN") && (
                      <span className="font-mono text-[7px] text-muted-foreground/40 uppercase tracking-wider">
                        {c.failureModeCode.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground/60 leading-relaxed">
                    {c.detail}
                  </div>
                </div>

                {/* Source dependency */}
                <div className="shrink-0 text-right hidden md:block">
                  <div className="font-mono text-[8px] text-muted-foreground/30 uppercase tracking-wider whitespace-nowrap">
                    {c.sourceDependency}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semantic layer gate + Hermes boundary */}
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
              SEMANTIC / NARRATIVE LAYER
            </div>
            <span className={cn(
              "font-mono text-[9px] font-bold uppercase tracking-widest",
              report.semanticLayerAllowed ? "text-primary" : "text-muted-foreground/30",
            )}>
              {report.semanticLayerAllowed ? "ALLOWED" : "BLOCKED"}
            </span>
          </div>
          <div className="font-mono text-[8px] text-muted-foreground/25 uppercase tracking-widest leading-tight">
            HERMES EVIDENCE ONLY · FINDINGS CANNOT DRIVE VERIFICATION OUTCOMES · DJZS IS THE AUDIT GATE
          </div>
        </div>

      </div>
    </div>
  );
}
