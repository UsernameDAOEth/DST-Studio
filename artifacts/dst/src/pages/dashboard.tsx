import { Link } from "wouter";
import { useGetSignals, useGetMarketSnapshot, useGetSignalFeed } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessVerdictBadge, SetupFamilyLabel } from "@/components/signal-process";

function VerdictChip({ verdict }: { verdict: string }) {
  if (verdict === "PASS") return <span className="chip-pass"><span className="w-1.5 h-1.5 rounded-none bg-primary mr-1.5"></span>PASS</span>;
  if (verdict === "FAIL") return <span className="chip-fail"><span className="w-1.5 h-1.5 rounded-none bg-destructive mr-1.5"></span>FAIL</span>;
  if (verdict === "WARN") return <span className="chip-warn"><span className="w-1.5 h-1.5 rounded-none bg-[hsl(var(--trade-wait))] mr-1.5"></span>WARN</span>;
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
      <Card className="border-border bg-card">
        <CardHeader className="pb-2 border-b border-border">
          <Skeleton className="h-6 w-24 bg-muted rounded-none" />
        </CardHeader>
        <CardContent className="pt-4">
          <Skeleton className="h-8 w-32 mb-4 bg-muted rounded-none" />
          <Skeleton className="h-1 w-full bg-muted rounded-none" />
        </CardContent>
      </Card>
    );
  }

  if (!signal || !snapshot) return null;

  const isWait = signal.direction === "WAIT";

  return (
    <Card className={cn(
      "border-border bg-card hover:border-primary/40 transition-colors relative group overflow-hidden",
      isWait && "opacity-90"
    )}>
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[2px]",
        signal.direction === "LONG" ? "bg-primary" :
        signal.direction === "SHORT" ? "bg-destructive" :
        "bg-[hsl(var(--trade-wait))]"
      )} />
      
      <Link href={`/signal/${asset}`} className="absolute inset-0 z-10" />
      
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 border-b border-border px-4">
        <CardTitle className="text-xl font-display text-foreground">{asset}</CardTitle>
        <VerdictChip verdict={signal.verdictDjzs} />
      </CardHeader>
      
      <CardContent className="px-4 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-mono text-foreground leading-none mb-1">{formatCurrency(snapshot.price)}</div>
              <div className={cn(
                "text-sm font-mono flex items-center",
                snapshot.priceChangePct24h >= 0 ? "text-primary" : "text-destructive"
              )}>
                {snapshot.priceChangePct24h >= 0 ? "+" : ""}{formatPercent(snapshot.priceChangePct24h)}
              </div>
            </div>
            <DirectionChip direction={signal.direction} />
          </div>

          {isWait ? (
            <div className="border border-[hsl(var(--trade-wait))]/30 bg-[hsl(var(--trade-wait))]/5 p-3 flex items-start gap-2">
              <ShieldOff className="w-3.5 h-3.5 text-[hsl(var(--trade-wait))] shrink-0 mt-0.5" />
              <div className="text-[10px] font-mono text-muted-foreground uppercase leading-tight">
                WAIT IS THE CORRECT OUTCOME — NO ADMISSIBLE SETUP FOUND. REVIEW TRADE PACKET FOR REASONS.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] uppercase text-muted-foreground font-mono">
                <span>CONFIDENCE</span>
                <span>{signal.confidence}%</span>
              </div>
              <div className="h-[1px] w-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    "h-full",
                    signal.direction === "LONG" ? "bg-primary" :
                    signal.direction === "SHORT" ? "bg-destructive" :
                    "bg-[hsl(var(--trade-wait))]"
                  )}
                  style={{ width: `${signal.confidence}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-border/50">
            <div className="flex flex-col gap-1">
              <ProcessVerdictBadge verdict={signal.processVerdict} />
              <SetupFamilyLabel family={signal.setupFamily} />
            </div>
            {signal.rrRatio > 0 && !isWait && (
              <div className={cn(
                "font-mono text-xs",
                signal.rrRatio >= 2 ? "text-primary" : signal.rrRatio >= 1.5 ? "text-[hsl(var(--trade-wait))]" : "text-destructive"
              )}>R/R: {signal.rrRatio.toFixed(1)}x</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: feed, isLoading: isLoadingFeed } = useGetSignalFeed({ limit: 10 });

  const totalWait = feed?.filter(f => f.direction === "WAIT").length ?? 0;
  const totalFeed = feed?.length ?? 0;
  const waitPct = totalFeed > 0 ? Math.round((totalWait / totalFeed) * 100) : null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">

      {/* ── HEADER + LAYER STRIP ── */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-display text-foreground mb-1">ADMISSIBILITY CONSOLE</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase mb-3">
          4H TIMEFRAME // ETH · BTC · SOL // PAPER MODE ONLY
        </p>

        {/* Three-layer positioning strip */}
        <div className="grid grid-cols-3 border border-border bg-card">
          <div className="px-4 py-3 border-r border-border">
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">① DST FINDS</div>
            <div className="text-xs font-mono text-foreground leading-tight">
              Possible trades from DefiLlama data, technical regime, and structure
            </div>
          </div>
          <div className="px-4 py-3 border-r border-border">
            <div className="text-[10px] font-mono uppercase text-primary mb-1">② DJZS GATES</div>
            <div className="text-xs font-mono text-foreground leading-tight">
              Admissibility verdict — deterministic, not predictive, never overridden
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">③ HERMES RUNS</div>
            <div className="text-xs font-mono text-foreground leading-tight">
              Orchestration runtime — constraints, scan loop, Pyth, alert routing
            </div>
          </div>
        </div>

        {waitPct !== null && (
          <div className="mt-2 text-[10px] font-mono text-muted-foreground uppercase">
            SIGNAL FEED: {waitPct}% WAIT — WAIT IS THE CORRECT OUTCOME WHEN NO SETUP MEETS ADMISSIBILITY THRESHOLD
          </div>
        )}
      </div>

      {/* ── ASSET CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AssetCard asset="ETH" />
        <AssetCard asset="BTC" />
        <AssetCard asset="SOL" />
      </div>

      {/* ── SIGNAL FEED ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-sm font-mono text-muted-foreground uppercase">SIGNAL FEED</h2>
          <div className="text-[10px] font-mono text-muted-foreground uppercase">
            MOST SCANS END IN WAIT — THIS IS BY DESIGN
          </div>
        </div>
        
        <div className="border border-border bg-transparent overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">TIME</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">ASSET</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">DIR</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">CONF</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">DJZS</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">PROCESS</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">R/R</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">SUMMARY</th>
                <th className="px-4 py-2 text-right font-mono font-medium text-xs uppercase">PKT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-transparent">
              {isLoadingFeed ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(9).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded-none bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : feed?.map((entry) => (
                <tr key={entry.id} className={cn(
                  "hover:bg-card transition-colors group",
                  entry.direction === "WAIT" && "opacity-70"
                )}>
                  <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(entry.computedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-display text-foreground font-bold">{entry.asset}</td>
                  <td className="px-4 py-3"><DirectionChip direction={entry.direction} /></td>
                  <td className="px-4 py-3 font-mono">{entry.confidence}%</td>
                  <td className="px-4 py-3"><VerdictChip verdict={entry.verdict} /></td>
                  <td className="px-4 py-3"><ProcessVerdictBadge verdict={entry.processVerdict} /></td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {entry.rrRatio ? (
                      <span className={cn(entry.rrRatio >= 2 ? "text-primary" : entry.rrRatio >= 1.5 ? "text-[hsl(var(--trade-wait))]" : "text-destructive")}>
                        {entry.rrRatio.toFixed(1)}x
                      </span>
                    ) : <span className="text-muted-foreground/50">---</span>}
                  </td>
                  <td className="px-4 py-3 text-body max-w-md truncate">{entry.summary}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/signal/${entry.asset}`} className="inline-flex items-center justify-center p-1 border border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingFeed && feed?.length === 0 && (
            <div className="p-8 text-center text-muted-foreground font-mono text-sm uppercase">NO_SIGNALS_FOUND — TRIGGER A SCAN FROM HERMES</div>
          )}
        </div>
      </div>
      
      <div className="pt-8 mt-8 border-t border-border flex flex-col md:flex-row justify-between text-xs font-mono text-muted-foreground uppercase">
        <div>DST — DECISION LAYER ONLY. NOT A CHARTING TOOL. NOT AN EXECUTION PLATFORM.</div>
        <div>DJZS AUDIT PROTOCOL — NOT FINANCIAL ADVICE</div>
      </div>
    </div>
  );
}
