import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

// ── Types mirroring the backend canonical model ───────────────────────────────

type DataQualityGrade = "GOOD" | "DEGRADED" | "POOR" | "CRITICAL";

type QualityFlag =
  | "STALE_PRICE" | "STALE_HISTORY" | "MISSING_PRICE" | "MISSING_HISTORY"
  | "INSUFFICIENT_HISTORY" | "FALLBACK_PRICE_USED" | "SYNTHETIC_OI"
  | "SYNTHETIC_FUNDING" | "LOW_CONFIDENCE" | "CONFLICTING_PRICES"
  | "PYTH_DIVERGENCE" | "PYTH_UNAVAILABLE" | "TVL_MISSING"
  | "VOLUME_MISSING" | "DATA_UNAVAILABLE";

interface DataProvenance {
  source: string;
  fetchedAt: string;
  dataTimestamp?: string | null;
  ageMs: number;
  isStale: boolean;
  isFallback: boolean;
  stallThresholdMs: number;
}

interface PythVerifierResult {
  scaffolded: true;
  checked: boolean;
  pythPrice: number | null;
  defillamaPrice: number | null;
  priceDivergencePct: number | null;
  confidenceRatio: number | null;
  confidenceStatus: "HIGH" | "MEDIUM" | "LOW" | null;
  fresh: boolean | null;
  verdict: "CONFIRMS" | "DIVERGES" | "UNAVAILABLE" | "SKIPPED";
  verdictDetail: string;
  influencesProcessVerdict: boolean;
}

interface DataQualityReport {
  grade: DataQualityGrade;
  flags: QualityFlag[];
  priceProvenance: DataProvenance;
  historyProvenance: DataProvenance;
  oiProvenance: DataProvenance;
  tvlProvenance: DataProvenance | null;
  pythVerifier: PythVerifierResult;
  historicalBarCount: number;
  minHistoricalBarsRequired: number;
  dataReadyForSignal: boolean;
  degradedConfidence: boolean;
  forcedWaitReason: string | null;
  computedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gradeColor(grade: DataQualityGrade): string {
  if (grade === "GOOD") return "text-primary";
  if (grade === "DEGRADED") return "text-[hsl(var(--trade-wait))]";
  if (grade === "POOR") return "text-amber-500";
  return "text-destructive";
}

function gradeBorder(grade: DataQualityGrade): string {
  if (grade === "GOOD") return "border-primary/20";
  if (grade === "DEGRADED") return "border-[hsl(var(--trade-wait))]/30";
  if (grade === "POOR") return "border-amber-500/30";
  return "border-destructive/40";
}

function flagSeverity(flag: QualityFlag): "critical" | "warn" | "info" {
  if (["MISSING_PRICE", "DATA_UNAVAILABLE", "FALLBACK_PRICE_USED"].includes(flag)) return "critical";
  if (["STALE_PRICE", "STALE_HISTORY", "INSUFFICIENT_HISTORY", "LOW_CONFIDENCE", "CONFLICTING_PRICES"].includes(flag)) return "warn";
  return "info";
}

function flagColor(flag: QualityFlag): string {
  const s = flagSeverity(flag);
  if (s === "critical") return "text-destructive border-destructive/40 bg-destructive/5";
  if (s === "warn") return "text-[hsl(var(--trade-wait))] border-[hsl(var(--trade-wait))]/40 bg-[hsl(var(--trade-wait))]/5";
  return "text-muted-foreground border-border bg-muted/20";
}

function formatAge(ageMs: number): string {
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m ago`;
  return `${Math.round(ageMs / 3_600_000)}h ago`;
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    DEFILLAMA_COINS: "DefiLlama Coins",
    DEFILLAMA_DERIVATIVES: "DefiLlama Derivatives",
    DEFILLAMA_TVL: "DefiLlama TVL",
    PYTH_HERMES: "Pyth Hermes REST",
    OKX_PERPS: "OKX Perpetuals",
    SYNTHETIC: "Synthetic (estimated)",
    DERIVED: "Derived",
    FALLBACK_ZERO: "Fallback (zero)",
    FALLBACK_ESTIMATED: "Fallback (estimated)",
  };
  return map[source] ?? source;
}

function pythVerdictColor(verdict: PythVerifierResult["verdict"]): string {
  if (verdict === "CONFIRMS") return "text-primary";
  if (verdict === "DIVERGES") return "text-destructive";
  if (verdict === "SKIPPED") return "text-muted-foreground/50";
  return "text-[hsl(var(--trade-wait))]";
}

function pythConfidenceColor(status: "HIGH" | "MEDIUM" | "LOW" | null): string {
  if (status === "HIGH") return "text-primary";
  if (status === "MEDIUM") return "text-[hsl(var(--trade-wait))]";
  return "text-destructive";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProvenanceRow({
  label,
  source,
  ageMs,
  isStale,
  isFallback,
  extra,
}: {
  label: string;
  source: string;
  ageMs: number;
  isStale: boolean;
  isFallback: boolean;
  extra?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <div className="micro-label mb-0.5">{label}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{sourceLabel(source)}</div>
        {extra && (
          <div className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">{extra}</div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn(
          "font-mono text-[9px] font-bold uppercase tracking-wider",
          isStale || isFallback ? "text-[hsl(var(--trade-wait))]" : "text-primary"
        )}>
          {isFallback ? "FALLBACK" : isStale ? "STALE" : "FRESH"}
        </span>
        {!isFallback && (
          <span className="font-mono text-[9px] text-muted-foreground/60">
            {formatAge(ageMs)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DataQualityPanel({ dataQuality }: { dataQuality: DataQualityReport }) {
  const { grade, flags, priceProvenance, historyProvenance, oiProvenance, tvlProvenance, pythVerifier } = dataQuality;

  const criticalFlags = flags.filter(f => flagSeverity(f) === "critical");
  const warnFlags = flags.filter(f => flagSeverity(f) === "warn");
  const infoFlags = flags.filter(f => flagSeverity(f) === "info");
  const visibleFlags = [...criticalFlags, ...warnFlags, ...infoFlags].filter(
    f => !["SYNTHETIC_OI", "SYNTHETIC_FUNDING", "VOLUME_MISSING"].includes(f)
  );
  const syntheticFlags = flags.filter(f => ["SYNTHETIC_OI", "SYNTHETIC_FUNDING"].includes(f));

  return (
    <div className={cn("terminal-panel", gradeBorder(grade))}>
      <div className="terminal-panel-header">
        <span>DATA QUALITY &amp; PROVENANCE</span>
        <span className={cn("font-mono text-[10px] font-bold tracking-widest", gradeColor(grade))}>
          {grade}
        </span>
      </div>

      <div className="p-5 space-y-5">

        {/* Forced WAIT notice */}
        {dataQuality.forcedWaitReason && (
          <div className="px-3 py-2 border border-destructive/40 bg-destructive/5">
            <div className="micro-label text-destructive mb-1">DATA GUARD — FORCED WAIT</div>
            <div className="font-mono text-[10px] text-destructive/80 leading-relaxed">
              {dataQuality.forcedWaitReason}
            </div>
          </div>
        )}

        {/* Quality flags */}
        {visibleFlags.length > 0 && (
          <div>
            <div className="micro-label mb-2">QUALITY FLAGS</div>
            <div className="flex flex-wrap gap-1.5">
              {visibleFlags.map(flag => (
                <span
                  key={flag}
                  className={cn(
                    "px-1.5 py-0.5 border font-mono text-[8px] font-bold uppercase tracking-wider",
                    flagColor(flag)
                  )}
                >
                  {flag.replace(/_/g, " ")}
                </span>
              ))}
              {syntheticFlags.length > 0 && (
                <span className="px-1.5 py-0.5 border border-border font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40">
                  OI + FUNDING: SYNTHETIC
                </span>
              )}
            </div>
          </div>
        )}

        {/* Source provenance table */}
        <div>
          <div className="micro-label mb-2">SOURCE HIERARCHY</div>
          <div className="divide-y-0">
            <ProvenanceRow
              label="PRICE"
              source={priceProvenance.source}
              ageMs={priceProvenance.ageMs}
              isStale={priceProvenance.isStale}
              isFallback={priceProvenance.isFallback}
            />
            <ProvenanceRow
              label="CHART HISTORY"
              source={historyProvenance.source}
              ageMs={historyProvenance.ageMs}
              isStale={historyProvenance.isStale}
              isFallback={historyProvenance.isFallback}
              extra={`${dataQuality.historicalBarCount} bars · min ${dataQuality.minHistoricalBarsRequired}`}
            />
            <ProvenanceRow
              label="OPEN INTEREST"
              source={oiProvenance.source}
              ageMs={oiProvenance.ageMs}
              isStale={oiProvenance.isStale}
              isFallback={oiProvenance.isFallback}
              extra="Estimated from global OI × asset share"
            />
            {tvlProvenance && (
              <ProvenanceRow
                label="TVL"
                source={tvlProvenance.source}
                ageMs={tvlProvenance.ageMs}
                isStale={tvlProvenance.isStale}
                isFallback={tvlProvenance.isFallback}
              />
            )}
          </div>
        </div>

        {/* Pyth secondary verifier */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="micro-label">PYTH SECONDARY VERIFIER</div>
            <span className={cn("font-mono text-[9px] font-bold uppercase tracking-wider", pythVerdictColor(pythVerifier.verdict))}>
              {pythVerifier.verdict}
            </span>
          </div>

          {pythVerifier.verdict === "SKIPPED" ? (
            <div className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider">
              DISABLED IN HERMES CONSTRAINTS — ENABLE PYTH CONFIDENCE FILTER TO ACTIVATE
            </div>
          ) : (
            <div className="space-y-2">
              {pythVerifier.checked && pythVerifier.pythPrice != null && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="micro-label mb-0.5">PYTH PRICE</div>
                    <div className="font-mono text-[10px] text-foreground">
                      ${formatNumber(pythVerifier.pythPrice, 2)}
                    </div>
                  </div>
                  {pythVerifier.priceDivergencePct != null && (
                    <div>
                      <div className="micro-label mb-0.5">DIVERGENCE</div>
                      <div className={cn(
                        "font-mono text-[10px] font-bold",
                        pythVerifier.priceDivergencePct > 0.5 ? "text-destructive" : "text-primary"
                      )}>
                        {pythVerifier.priceDivergencePct.toFixed(3)}%
                      </div>
                    </div>
                  )}
                  {pythVerifier.confidenceStatus && (
                    <div>
                      <div className="micro-label mb-0.5">CONFIDENCE</div>
                      <div className={cn("font-mono text-[10px] font-bold", pythConfidenceColor(pythVerifier.confidenceStatus))}>
                        {pythVerifier.confidenceStatus}
                        {pythVerifier.confidenceRatio != null && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ({(pythVerifier.confidenceRatio * 100).toFixed(3)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="micro-label mb-0.5">FRESHNESS</div>
                    <div className={cn(
                      "font-mono text-[10px] font-bold",
                      pythVerifier.fresh ? "text-primary" : "text-[hsl(var(--trade-wait))]"
                    )}>
                      {pythVerifier.fresh ? "FRESH" : "STALE"}
                    </div>
                  </div>
                </div>
              )}
              <div className="font-mono text-[9px] text-muted-foreground/60 leading-relaxed border-t border-border/40 pt-2">
                {pythVerifier.verdictDetail}
              </div>
              {pythVerifier.influencesProcessVerdict && (
                <div className="font-mono text-[9px] text-[hsl(var(--trade-wait))]/80 uppercase tracking-wider">
                  ↳ INFLUENCES PROCESS VERDICT
                </div>
              )}
            </div>
          )}
        </div>

        {/* Readiness summary */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
          <div className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
            SIGNAL DATA READY
          </div>
          <span className={cn(
            "font-mono text-[9px] font-bold uppercase tracking-widest",
            dataQuality.dataReadyForSignal ? "text-primary" : "text-destructive"
          )}>
            {dataQuality.dataReadyForSignal ? "YES" : "NO"}
          </span>
        </div>

      </div>
    </div>
  );
}
