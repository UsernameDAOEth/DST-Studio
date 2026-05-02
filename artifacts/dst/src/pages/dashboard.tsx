import { Link } from "wouter";
import { useGetSignals, useGetMarketSnapshot, useGetSignalFeed } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessVerdictBadge, SetupFamilyLabel } from "@/components/signal-process";

function AuditChip({ verdict }: { verdict: string }) {
  if (verdict === "PASS") return <span className="chip-pass"><span className="w-1.5 h-1.5 rounded-none bg-primary mr-1.5 inline-block"></span>PASS</span>;
  if (verdict === "FAIL") return <span className="chip-fail"><span className="w-1.5 h-1.5 rounded-none bg-destructive mr-1.5 inline-block"></span>FAIL</span>;
  if (verdict === "WARN") return <span className="chip-warn"><span className="w-1.5 h-1.5 rounded-none bg-[hsl(var(--trade-wait))] mr-1.5 inline-block"></span>WARN</span>;
  return <span className="chip-skip">SKIP</span>;
}

function DirectionChip({ direction }: { direction: string }) {
  if (direction === "LONG") return <span className="chip-long">{direction}</span>;
  if (direction === "SHORT") return <span className="chip-short">{direction}</span>;
  return <span className="chip-wait">{direction}</span>;
}

function AssetCard({ asset }: { asset: string }) {
  const { data: signals, isLoading: isLoadingSignals } = useGetSignals();
  const { data: snapshots, isLoading: isLoadingMarket } = useGetMarketSnapshot();

  const signal = signals?.find((s) => s.asset === asset);
  const snapshot = snapshots?.find((s) => s.asset === asset);

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

  if (!signal || !snapshot) return null;

  const isWait = signal.direction === "WAIT";
  const dirColor =
    signal.direction === "LONG" ? "hsl(var(--trade-long))" :
    signal.direction === "SHORT" ? "hsl(var(--trade-short))" :
    "hsl(var(--trade-wait))";

  return (
    <Link href={`/signal/${asset}`} className="block group">
      <div className={cn(
        "terminal-panel transition-all hover:border-primary/30 relative overflow-hidden",
        isWait && "opacity-80"
      )}>
        {/* direction bar */}
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ backgroundColor: dirColor }} />

        {/* header row */}
        <div className="terminal-panel-header">
          <span className="text-foreground tracking-widest">{asset}</span>
          <AuditChip verdict={signal.verdictDjzs} />
        </div>

        <div className="p-4 space-y-3">
          {/* price + direction */}
          <div className="flex justify-between items-end">
            <div>
              <div className="text-2xl font-mono text-foreground leading-none mb-1 mono-nums">
                {formatCurrency(snapshot.price)}
              </div>
              <div className={cn(
                "text-xs font-mono mono-nums",
                snapshot.priceChangePct24h >= 0 ? "text-primary" : "text-destructive"
              )}>
                {snapshot.priceChangePct24h >= 0 ? "+" : ""}{formatPercent(snapshot.priceChangePct24h)} 24H
              </div>
            </div>
            <DirectionChip direction={signal.direction} />
          </div>

          {/* wait panel or confidence bar */}
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

          {/* verdict + R/R footer */}
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

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">

      {/* ── PAGE HEADER ── */}
      <div className="pb-5 border-b border-border">
        <div className="flex items-baseline gap-4 mb-1">
          <h1 className="text-xl tracking-widest text-foreground">ADMISSIBILITY CONSOLE</h1>
          <span className="micro-label text-muted-foreground/60">4H · ETH · BTC · SOL · PAPER MODE</span>
        </div>

        {/* Three-layer system identity strip */}
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
      </div>

      {/* ── ASSET CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AssetCard asset="ETH" />
        <AssetCard asset="BTC" />
        <AssetCard asset="SOL" />
      </div>

      {/* ── SIGNAL FEED ── */}
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
                <th className="px-4 py-2 text-left micro-label">DJZS AUDIT</th>
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
              ) : feed?.map((entry) => (
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
                  <td className="px-4 py-2.5"><AuditChip verdict={entry.verdict} /></td>
                  <td className="px-4 py-2.5"><ProcessVerdictBadge verdict={entry.processVerdict} /></td>
                  <td className="px-4 py-2.5 font-mono mono-nums">
                    {entry.rrRatio ? (
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
              ))}
            </tbody>
          </table>
          {!isLoadingFeed && feed?.length === 0 && (
            <div className="p-8 text-center font-mono text-xs text-muted-foreground uppercase tracking-widest">
              NO SIGNALS FOUND — TRIGGER A SCAN FROM HERMES
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-border flex flex-col md:flex-row justify-between gap-2 micro-label text-muted-foreground/50">
        <span>DST — DETERMINISTIC SIGNAL TRADING. NOT A CHARTING TOOL. NOT AN EXECUTION PLATFORM.</span>
        <span>DJZS AUDIT PROTOCOL — NOT FINANCIAL ADVICE</span>
      </div>
    </div>
  );
}
