import { Link } from "wouter";
import { useGetSignals, useGetMarketSnapshot, useGetSignalFeed, useGetLazerSnapshot, getGetLazerSnapshotQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { ArrowRight, ShieldOff, Radio, AlertTriangle, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessVerdictBadge, SetupFamilyLabel, VerdictBadge, gateDisplayVerdict } from "@/components/signal-process";
import { LazerStreamPanel } from "@/components/lazer-stream-panel";
import { PipelineHealthChip } from "@/components/pipeline-health-chip";

function DirectionChip({ direction }: { direction: string }) {
  if (direction === "LONG") return <span className="chip-long">{direction}</span>;
  if (direction === "SHORT") return <span className="chip-short">{direction}</span>;
  return <span className="chip-wait">{direction}</span>;
}

function DataGradeChip({ grade }: { grade?: string }) {
  if (!grade || grade === "GOOD") return null;
  if (grade === "DEGRADED") return <span className="chip-warn text-[7px]">DEGRADED</span>;
  if (grade === "POOR") return <span className="chip-fail text-[7px]">POOR</span>;
  if (grade === "CRITICAL") return <span className="chip-fail text-[7px]">CRITICAL</span>;
  return <span className="chip-skip text-[7px]">{grade}</span>;
}

function PipelineChips({ dataQuality }: { dataQuality?: { grade?: string; flags?: string[]; pythVerifier?: { verdict?: string } } }) {
  if (!dataQuality) return null;
  const flags = dataQuality.flags ?? [];
  const chips: { label: string; variant: "warn" | "fail" }[] = [];
  if (flags.includes("SYNTHETIC_OI")) chips.push({ label: "OI: EST", variant: "warn" });
  if (flags.includes("SYNTHETIC_FUNDING")) chips.push({ label: "FUND: EST", variant: "warn" });
  if (flags.includes("VOLUME_MISSING")) chips.push({ label: "VOL: N/A", variant: "fail" });
  const pythVerdict = dataQuality.pythVerifier?.verdict;
  if (pythVerdict === "SKIPPED" || pythVerdict === "UNAVAILABLE") chips.push({ label: "PYTH: OFF", variant: "warn" });
  const hasGradeChip = dataQuality.grade && dataQuality.grade !== "GOOD";
  if (!hasGradeChip && chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {hasGradeChip && <DataGradeChip grade={dataQuality.grade} />}
      {chips.map(c => <span key={c.label} className={cn(c.variant === "fail" ? "chip-fail" : "chip-warn", "text-[7px]")}>{c.label}</span>)}
    </div>
  );
}

function formatClockHM(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

function PriceDivergenceChip({ snapshotPrice, lazerPrice }: { snapshotPrice: number; lazerPrice: number | null | undefined }) {
  if (lazerPrice == null || !Number.isFinite(lazerPrice) || lazerPrice <= 0 || snapshotPrice <= 0) return null;
  const deltaPct = ((snapshotPrice - lazerPrice) / lazerPrice) * 100;
  const absPct = Math.abs(deltaPct);
  const tone =
    absPct >= 0.5 ? "chip-fail" :
    absPct >= 0.1 ? "chip-warn" :
    "chip-skip";
  const sign = deltaPct >= 0 ? "+" : "";
  return (
    <span className={cn(tone, "text-[7px]")} title="DefiLlama snapshot price vs live Pyth Lazer oracle">
      Δ PYTH {sign}{deltaPct.toFixed(absPct >= 0.1 ? 2 : 3)}%
    </span>
  );
}

function AssetCard({ asset }: { asset: string }) {
  const { data: signals, isLoading: isLoadingSignals } = useGetSignals();
  const { data: snapshots, isLoading: isLoadingMarket } = useGetMarketSnapshot();
  const { data: lazerData } = useGetLazerSnapshot({
    query: { queryKey: getGetLazerSnapshotQueryKey(), refetchInterval: 1000 },
  });

  const signal = signals?.find((s) => s.asset === asset);
  const snapshot = snapshots?.find((s) => s.asset === asset);
  const lazerFeed = lazerData?.feeds?.find((f) => f.asset === asset);
  const lazerLive = lazerData?.status === "CONNECTED" && lazerFeed?.price != null
    && (lazerFeed.ageMs == null || lazerFeed.ageMs <= 5000);

  if (isLoadingSignals || isLoadingMarket) {
    return (
      <div className="terminal-panel">
        <div className="terminal-panel-header">
          <Skeleton className="h-3 w-24 bg-muted rounded-none" />
        </div>
        <div className="p-4">
          <Skeleton className="h-8 w-32 mb-4 bg-muted rounded-none" />
          <Skeleton className="h-1 w-full bg-muted rounded-none" />
        </div>
      </div>
    );
  }

  if (!signal || !snapshot) {
    return (
      <div className="terminal-panel opacity-50">
        <div className="terminal-panel-header">
          <span className="text-foreground tracking-widest">{asset}</span>
          <span className="chip-skip text-[8px]">PENDING</span>
        </div>
        <div className="p-4 flex items-center justify-center min-h-[120px]">
          <div className="text-center">
            <Scan className="w-4 h-4 text-muted-foreground/40 mx-auto mb-2" />
            <div className="micro-label text-muted-foreground/50">AWAITING FIRST SCAN</div>
          </div>
        </div>
      </div>
    );
  }

  const isWait = signal.direction === "WAIT";
  const dirColor =
    signal.direction === "LONG" ? "hsl(var(--trade-long))" :
    signal.direction === "SHORT" ? "hsl(var(--trade-short))" :
    "hsl(var(--trade-wait))";

  const sig = signal as typeof signal & { dataQuality?: { grade?: string; flags?: string[]; pythVerifier?: { verdict?: string } } };

  return (
    <Link href={`/signal/${asset}`} className="block group">
      <div className={cn(
        "terminal-panel transition-all hover:border-primary/30 relative overflow-hidden",
        isWait && "opacity-80"
      )}>
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ backgroundColor: dirColor }} />

        <div className="terminal-panel-header">
          <span className="text-foreground tracking-widest">{asset}</span>
          <VerdictBadge value={gateDisplayVerdict(signal.logicAdmissibility) || signal.verdictDjzs} />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex justify-between items-end">
            <div className="min-w-0">
              <div className="text-2xl font-mono text-foreground leading-none mb-1 mono-nums">
                {formatCurrency(snapshot.price)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="micro-label text-muted-foreground/60 text-[8px]">
                  DEFILLAMA @ {formatClockHM(snapshot.updatedAt)}
                </span>
                {lazerLive && <PriceDivergenceChip snapshotPrice={snapshot.price} lazerPrice={lazerFeed?.price} />}
              </div>
              <div className={cn(
                "text-xs font-mono mono-nums mt-1",
                snapshot.priceChangePct24h >= 0 ? "text-primary" : "text-destructive"
              )}>
                {formatPercent(snapshot.priceChangePct24h)} 24H
              </div>
            </div>
            <DirectionChip direction={signal.direction} />
          </div>

          {isWait ? (
            <div className="border border-[hsl(var(--trade-wait))]/25 bg-[hsl(var(--trade-wait))]/4 p-3 flex items-start gap-2">
              <ShieldOff className="w-3 h-3 text-[hsl(var(--trade-wait))] shrink-0 mt-0.5" />
              <div className="micro-label text-[hsl(var(--trade-wait))]/80 leading-relaxed normal-case text-[9px] uppercase tracking-wider">
                WAIT — NO ADMISSIBLE SETUP. AUDIT FOUND INSUFFICIENT STRUCTURAL EVIDENCE.
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between micro-label">
                <span>CONFIDENCE</span>
                <span className="text-foreground">{signal.confidence}%</span>
              </div>
              <div className="h-px w-full bg-secondary overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${signal.confidence}%`, backgroundColor: dirColor }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-border/40">
            <div className="flex flex-col gap-1">
              <ProcessVerdictBadge verdict={signal.processVerdict} />
              <SetupFamilyLabel family={signal.setupFamily} />
            </div>
            {signal.rrRatio > 0 && !isWait && (
              <div className={cn(
                "font-mono text-xs mono-nums font-bold",
                signal.rrRatio >= 2 ? "text-primary" : signal.rrRatio >= 1.5 ? "text-[hsl(var(--trade-wait))]" : "text-destructive"
              )}>R/R {signal.rrRatio.toFixed(1)}x</div>
            )}
          </div>

          <PipelineChips dataQuality={sig.dataQuality} />
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: feed, isLoading: isLoadingFeed } = useGetSignalFeed({ limit: 10 });

  const totalWait = feed?.filter(f => f.direction === "WAIT").length ?? 0;
  const totalFeed = feed?.length ?? 0;
  const waitPct = totalFeed > 0 ? Math.round((totalWait / totalFeed) * 100) : null;
  const allWait = totalFeed > 0 && totalWait === totalFeed;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">

      <div className="pb-5 border-b border-border">
        <div className="flex items-baseline gap-4 mb-1">
          <h1 className="text-xl tracking-widest text-foreground">ADMISSIBILITY CONSOLE</h1>
          <span className="micro-label text-muted-foreground/60">4H · ETH · BTC · SOL · PAPER MODE</span>
        </div>

        <div className="grid grid-cols-3 border border-border bg-card mt-4">
          <div className="px-4 py-3 border-r border-border">
            <div className="micro-label mb-1.5">① DST SIGNALS</div>
            <div className="font-mono text-[10px] text-foreground leading-relaxed">
              Possible trades from DefiLlama data, technical regime, and market structure
            </div>
          </div>
          <div className="px-4 py-3 border-r border-border">
            <div className="micro-label text-primary mb-1.5">② DJZS AUDITS</div>
            <div className="font-mono text-[10px] text-foreground leading-relaxed">
              Deterministic audit verdict — rules setups in or out, never overridden
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="micro-label mb-1.5">③ HERMES RUNS</div>
            <div className="font-mono text-[10px] text-foreground leading-relaxed">
              Orchestration runtime — constraints, scan loop, Pyth, alert routing
            </div>
          </div>
        </div>

        {waitPct !== null && (
          <div className="mt-2.5 font-mono text-[9px] text-muted-foreground/60 uppercase tracking-widest">
            SIGNAL FEED: {waitPct}% WAIT — WAIT IS THE CORRECT OUTCOME WHEN NO SETUP PASSES AUDIT
          </div>
        )}

        <div className="mt-3">
          <PipelineHealthChip />
        </div>
      </div>

      <LazerStreamPanel />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AssetCard asset="ETH" />
        <AssetCard asset="BTC" />
        <AssetCard asset="SOL" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="micro-label text-foreground">SIGNAL FEED</div>
          <div className="micro-label text-muted-foreground/60">
            MOST SCANS END IN WAIT — THIS IS BY DESIGN
          </div>
        </div>

        <div className="border border-border bg-transparent overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary border-b border-border">
                <th className="px-4 py-2 text-left micro-label">TIME</th>
                <th className="px-4 py-2 text-left micro-label">ASSET</th>
                <th className="px-4 py-2 text-left micro-label">DIR</th>
                <th className="px-4 py-2 text-left micro-label">CONF</th>
                <th className="px-4 py-2 text-left micro-label">DJZS GATE</th>
                <th className="px-4 py-2 text-left micro-label">PROCESS</th>
                <th className="px-4 py-2 text-left micro-label">R/R</th>
                <th className="px-4 py-2 text-left micro-label">SUMMARY</th>
                <th className="px-4 py-2 text-right micro-label">PKT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-transparent">
              {isLoadingFeed ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(9).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-3 w-full rounded-none bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : feed?.map((entry) => {
                const feedEntry = entry as typeof entry & { logicAdmissibility?: string };
                return (
                  <tr key={entry.id} className={cn(
                    "hover:bg-card transition-colors group",
                    entry.direction === "WAIT" && "opacity-60"
                  )}>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap mono-nums">
                      {new Date(entry.computedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground font-bold tracking-wider">{entry.asset}</td>
                    <td className="px-4 py-2.5"><DirectionChip direction={entry.direction} /></td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground mono-nums">{entry.confidence}%</td>
                    <td className="px-4 py-2.5"><VerdictBadge value={gateDisplayVerdict(feedEntry.logicAdmissibility) || entry.verdict} /></td>
                    <td className="px-4 py-2.5"><ProcessVerdictBadge verdict={entry.processVerdict} /></td>
                    <td className="px-4 py-2.5 font-mono mono-nums">
                      {entry.rrRatio && entry.direction !== "WAIT" ? (
                        <span className={cn(
                          "font-bold",
                          entry.rrRatio >= 2 ? "text-primary" : entry.rrRatio >= 1.5 ? "text-[hsl(var(--trade-wait))]" : "text-destructive"
                        )}>
                          {entry.rrRatio.toFixed(1)}x
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{entry.summary}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/signal/${entry.asset}`}>
                        <div className="inline-flex items-center justify-center p-1 border border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isLoadingFeed && (!feed || feed.length === 0) && (
            <div className="p-4">
              <Empty className="border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Scan className="w-5 h-5" />
                  </EmptyMedia>
                  <EmptyTitle className="font-mono text-sm uppercase tracking-widest">
                    PENDING FIRST SCAN
                  </EmptyTitle>
                  <EmptyDescription className="font-mono text-[10px] uppercase tracking-wider">
                    No signals have been computed yet. Trigger a scan from Hermes or wait for the scheduled scan loop.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
          {!isLoadingFeed && allWait && feed && feed.length > 0 && (
            <div className="px-4 py-3 border-t border-border/40 bg-card/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-[hsl(var(--trade-wait))]/60 shrink-0" />
                <span className="font-mono text-[9px] text-[hsl(var(--trade-wait))]/70 uppercase tracking-widest">
                  ALL RECENT SIGNALS ARE WAIT — NO ADMISSIBLE SETUPS FOUND. THIS IS THE SYSTEM WORKING AS DESIGNED.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-border flex flex-col md:flex-row justify-between gap-2 micro-label text-muted-foreground/50">
        <span>DST — DETERMINISTIC SIGNAL TRADING. NOT A CHARTING TOOL. NOT AN EXECUTION PLATFORM.</span>
        <span>DJZS AUDIT PROTOCOL — NOT FINANCIAL ADVICE</span>
      </div>
    </div>
  );
}
