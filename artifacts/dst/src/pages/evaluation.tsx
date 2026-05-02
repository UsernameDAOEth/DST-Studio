import { useState } from "react";
import {
  useGetHermesMetrics,
  useGetHermesEvaluation,
  HermesMetricsPeriod
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Evaluation() {
  const [period, setPeriod] = useState<HermesMetricsPeriod>("7D");
  
  const { data: metrics, isLoading: isLoadingMetrics } = useGetHermesMetrics({ period });
  const { data: evaluation, isLoading: isLoadingEval } = useGetHermesEvaluation();

  const waitRate = metrics?.waitRate ? metrics.waitRate * 100 : 0;
  const approvalRate = metrics?.approvalRate ? metrics.approvalRate * 100 : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-display text-foreground mb-1">EVALUATION</h1>
          <p className="text-muted-foreground font-mono text-xs uppercase">STAGE METRICS + WEEKLY REVIEW</p>
        </div>
        <div className="flex gap-2 font-mono text-xs">
          {(["24H", "7D", "30D"] as HermesMetricsPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 border transition-colors",
                period === p ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION A: SCAN SUMMARY */}
      <div className="space-y-3">
        {isLoadingMetrics ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-4 flex flex-col gap-1">
              <div className="text-xs font-mono uppercase text-muted-foreground">TOTAL SCANS</div>
              <div className="text-2xl font-mono text-foreground">{metrics?.totalScans || 0}</div>
            </div>
            <div className="bg-card border border-border p-4 flex flex-col gap-1">
              <div className="text-xs font-mono uppercase text-muted-foreground">WAIT RATE</div>
              <div className={cn(
                "text-2xl font-mono",
                waitRate > 70 ? "text-primary" : "text-[hsl(var(--trade-wait))]"
              )}>{waitRate.toFixed(1)}%</div>
            </div>
            <div className="bg-card border border-border p-4 flex flex-col gap-1">
              <div className="text-xs font-mono uppercase text-muted-foreground">APPROVAL RATE</div>
              <div className="text-2xl font-mono text-foreground">{approvalRate.toFixed(1)}%</div>
            </div>
            <div className="bg-card border border-border p-4 flex flex-col gap-1">
              <div className="text-xs font-mono uppercase text-muted-foreground">APPROVED</div>
              <div className={cn("text-2xl font-mono", (metrics?.totalApproved || 0) > 0 ? "text-primary" : "text-foreground")}>
                {metrics?.totalApproved || 0}
              </div>
            </div>
            <div className="bg-card border border-border p-4 flex flex-col gap-1">
              <div className="text-xs font-mono uppercase text-muted-foreground">DEGRADED</div>
              <div className={cn("text-2xl font-mono", (metrics?.totalDegraded || 0) > 0 ? "text-[hsl(var(--trade-wait))]" : "text-foreground")}>
                {metrics?.totalDegraded || 0}
              </div>
            </div>
            <div className="bg-card border border-border p-4 flex flex-col gap-1">
              <div className="text-xs font-mono uppercase text-muted-foreground">REJECTED</div>
              <div className={cn("text-2xl font-mono", (metrics?.totalRejected || 0) > 0 ? "text-destructive" : "text-foreground")}>
                {metrics?.totalRejected || 0}
              </div>
            </div>
          </div>
        )}
        <div className="text-muted-foreground italic text-xs pt-1">
          Target: wait rate &gt; 70% in STRICT mode. Low wait rates indicate the filter may be too loose.
        </div>
      </div>

      {/* SECTION B: STAGE ACCURACY TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-mono text-muted-foreground uppercase">PROCESS METRICS</h2>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">METRIC</th>
                  <th className="px-4 py-2 font-medium">VALUE</th>
                  <th className="px-4 py-2 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">Candidate Accuracy</td>
                  <td className="px-4 py-3 text-muted-foreground">null — Phase 3</td>
                  <td className="px-4 py-3"><span className="chip-warn">SCAFFOLDED</span></td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">Filter Accuracy</td>
                  <td className="px-4 py-3 text-muted-foreground">null — Phase 3</td>
                  <td className="px-4 py-3"><span className="chip-warn">SCAFFOLDED</span></td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">Timing Accuracy</td>
                  <td className="px-4 py-3">
                    {metrics?.timingAccuracy ? `${(metrics.timingAccuracy * 100).toFixed(0)}%` : "null — Phase 3"}
                  </td>
                  <td className="px-4 py-3">
                    {metrics?.timingAccuracy ? <span className="chip-pass">ACTIVE</span> : <span className="chip-warn">SCAFFOLDED</span>}
                  </td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">No-Trade Quality</td>
                  <td className="px-4 py-3 text-muted-foreground">null — Phase 3</td>
                  <td className="px-4 py-3"><span className="chip-warn">SCAFFOLDED</span></td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">Research Lift</td>
                  <td className="px-4 py-3 text-muted-foreground">null — Phase 3</td>
                  <td className="px-4 py-3"><span className="chip-warn">SCAFFOLDED</span></td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">Alert Usefulness</td>
                  <td className="px-4 py-3 text-muted-foreground">null — Phase 3</td>
                  <td className="px-4 py-3"><span className="chip-warn">SCAFFOLDED</span></td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">Avg R/R (APPROVED)</td>
                  <td className={cn("px-4 py-3 font-bold", metrics?.avgRROnApproved && metrics.avgRROnApproved >= 2 ? "text-primary" : "text-foreground")}>
                    {metrics?.avgRROnApproved ? `${metrics.avgRROnApproved.toFixed(2)}x` : "—"}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">Avg Confidence (APPROVED)</td>
                  <td className="px-4 py-3 font-bold">
                    {metrics?.avgConfidenceOnApproved ? `${metrics.avgConfidenceOnApproved.toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="px-4 py-3">Pyth Influence Count</td>
                  <td className="px-4 py-3 font-bold">{metrics?.pythInfluenceCount || 0}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-card border border-border p-4 flex-1">
            <h2 className="text-sm font-mono text-muted-foreground uppercase mb-4 border-b border-border pb-2">REJECTION CODE BREAKDOWN</h2>
            <div className="space-y-3 font-mono text-xs">
              {isLoadingMetrics ? (
                <Skeleton className="h-20 w-full" />
              ) : !metrics?.rejectionCodeBreakdown || Object.keys(metrics.rejectionCodeBreakdown).length === 0 ? (
                <div className="text-muted-foreground text-center py-4">No signals in this period.</div>
              ) : (
                Object.entries(metrics.rejectionCodeBreakdown)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([code, count]) => {
                    const max = Math.max(...Object.values(metrics.rejectionCodeBreakdown) as number[]);
                    const pct = Math.max(5, ((count as number) / max) * 100);
                    return (
                      <div key={code} className="flex items-center gap-3">
                        <div className="w-32 truncate" title={code}>{code}</div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="h-4 bg-primary/20" style={{ width: `${pct}%` }}>
                            <div className="h-full bg-primary" style={{ width: '100%' }} />
                          </div>
                          <div className="w-6 text-right text-muted-foreground">{count as number}</div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="bg-card border border-border p-4 flex-1">
            <h2 className="text-sm font-mono text-muted-foreground uppercase mb-4 border-b border-border pb-2">SETUP FAMILY BREAKDOWN</h2>
            <div className="space-y-3 font-mono text-xs">
              {isLoadingMetrics ? (
                <Skeleton className="h-20 w-full" />
              ) : !metrics?.setupFamilyBreakdown || Object.keys(metrics.setupFamilyBreakdown).length === 0 ? (
                <div className="text-muted-foreground text-center py-4">No signals in this period.</div>
              ) : (
                Object.entries(metrics.setupFamilyBreakdown)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([code, count]) => {
                    const max = Math.max(...Object.values(metrics.setupFamilyBreakdown) as number[]);
                    const pct = Math.max(5, ((count as number) / max) * 100);
                    return (
                      <div key={code} className="flex items-center gap-3">
                        <div className="w-32 truncate" title={code}>{code}</div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="h-4 bg-primary/20" style={{ width: `${pct}%` }}>
                            <div className="h-full bg-primary" style={{ width: '100%' }} />
                          </div>
                          <div className="w-6 text-right text-muted-foreground">{count as number}</div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C: WEEKLY EVALUATION */}
      <div className="bg-card border border-border flex flex-col pt-2">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-display font-bold">WEEKLY EVALUATION REPORT</h2>
          <span className="chip-pass font-bold">DOCTRINE: INTACT</span>
        </div>

        {isLoadingEval ? (
          <div className="p-6">
            <Skeleton className="h-40 w-full mb-4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
              {/* THRESHOLD REVIEW */}
              <div className="bg-card p-4">
                <h3 className="font-mono text-sm uppercase text-muted-foreground mb-3">THRESHOLD REVIEW</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-left">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-2">PARAMETER</th>
                        <th className="pb-2 pr-2">CURRENT</th>
                        <th className="pb-2 pr-2">OBSERVATION</th>
                        <th className="pb-2">REC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {evaluation?.thresholdReview.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-2 font-bold">{item.parameter}</td>
                          <td className="py-2 pr-2">{item.currentValue}</td>
                          <td className="py-2 pr-2 text-muted-foreground">{item.observation}</td>
                          <td className="py-2">
                            <span className={cn(
                              "chip",
                              item.recommendation === "KEEP" ? "chip-pass" :
                              item.recommendation === "REVIEW" ? "chip-neutral" : "chip-warn"
                            )}>{item.recommendation}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* REJECT CONDITION REVIEW */}
              <div className="bg-card p-4">
                <h3 className="font-mono text-sm uppercase text-muted-foreground mb-3">REJECT CONDITION REVIEW</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-left">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-2">PARAMETER</th>
                        <th className="pb-2 pr-2">CURRENT</th>
                        <th className="pb-2 pr-2">OBSERVATION</th>
                        <th className="pb-2">REC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {evaluation?.rejectConditionReview.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-2 font-bold">{item.parameter}</td>
                          <td className="py-2 pr-2">{item.currentValue}</td>
                          <td className="py-2 pr-2 text-muted-foreground">{item.observation}</td>
                          <td className="py-2">
                            <span className={cn(
                              "chip",
                              item.recommendation === "KEEP" ? "chip-pass" :
                              item.recommendation === "REVIEW" ? "chip-neutral" : "chip-warn"
                            )}>{item.recommendation}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TRIGGER RULE REVIEW */}
              <div className="bg-card p-4">
                <h3 className="font-mono text-sm uppercase text-muted-foreground mb-3">TRIGGER RULE REVIEW</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-left">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-2">PARAMETER</th>
                        <th className="pb-2 pr-2">CURRENT</th>
                        <th className="pb-2 pr-2">OBSERVATION</th>
                        <th className="pb-2">REC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {evaluation?.triggerRuleReview.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-2 font-bold">{item.parameter}</td>
                          <td className="py-2 pr-2">{item.currentValue}</td>
                          <td className="py-2 pr-2 text-muted-foreground">{item.observation}</td>
                          <td className="py-2">
                            <span className={cn(
                              "chip",
                              item.recommendation === "KEEP" ? "chip-pass" :
                              item.recommendation === "REVIEW" ? "chip-neutral" : "chip-warn"
                            )}>{item.recommendation}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ROUTING RULE REVIEW */}
              <div className="bg-card p-4">
                <h3 className="font-mono text-sm uppercase text-muted-foreground mb-3">ROUTING RULE REVIEW</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-left">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-2">PARAMETER</th>
                        <th className="pb-2 pr-2">CURRENT</th>
                        <th className="pb-2 pr-2">OBSERVATION</th>
                        <th className="pb-2">REC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {evaluation?.routingRuleReview.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-2 font-bold">{item.parameter}</td>
                          <td className="py-2 pr-2">{item.currentValue}</td>
                          <td className="py-2 pr-2 text-muted-foreground">{item.observation}</td>
                          <td className="py-2">
                            <span className={cn(
                              "chip",
                              item.recommendation === "KEEP" ? "chip-pass" :
                              item.recommendation === "REVIEW" ? "chip-neutral" : "chip-warn"
                            )}>{item.recommendation}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-4 md:p-6 border-t border-border bg-muted/20">
              <div className="border border-primary/20 bg-primary/5 p-4 font-mono text-sm leading-relaxed text-foreground">
                <span className="font-bold text-primary mr-2 uppercase">Assessment:</span>
                {evaluation?.overallAssessment}
              </div>
              <p className="text-muted-foreground italic text-xs mt-4">
                Evaluation reviews operational thresholds and rules. It does not modify DJZS doctrine or signal logic.
              </p>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
