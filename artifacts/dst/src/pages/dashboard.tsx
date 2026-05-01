import { Link } from "wouter";
import { useGetSignals, useGetMarketSnapshot, useGetSignalFeed } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ArrowUpRight, ArrowDownRight, Minus, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function SignalDirectionIcon({ direction, className }: { direction: string, className?: string }) {
  if (direction === "LONG") return <ArrowUpRight className={cn("text-[var(--color-trade-long)]", className)} />;
  if (direction === "SHORT") return <ArrowDownRight className={cn("text-[var(--color-trade-short)]", className)} />;
  return <Minus className={cn("text-[var(--color-trade-wait)]", className)} />;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "PASS") {
    return (
      <Badge variant="outline" className="bg-[var(--color-trade-long)]/10 text-[var(--color-trade-long)] border-[var(--color-trade-long)]/20 font-mono">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        PASS
      </Badge>
    );
  }
  if (verdict === "FAIL") {
    return (
      <Badge variant="outline" className="bg-[var(--color-trade-short)]/10 text-[var(--color-trade-short)] border-[var(--color-trade-short)]/20 font-mono">
        <XCircle className="w-3 h-3 mr-1" />
        FAIL
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-[var(--color-trade-wait)]/10 text-[var(--color-trade-wait)] border-[var(--color-trade-wait)]/20 font-mono">
      <Minus className="w-3 h-3 mr-1" />
      WAIT
    </Badge>
  );
}

function AssetCard({ asset }: { asset: string }) {
  const { data: signals, isLoading: isLoadingSignals } = useGetSignals();
  const { data: snapshots, isLoading: isLoadingMarket } = useGetMarketSnapshot();

  const signal = signals?.find((s) => s.asset === asset);
  const snapshot = snapshots?.find((s) => s.asset === asset);

  if (isLoadingSignals || isLoadingMarket) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-24 bg-muted" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-4 bg-muted" />
          <Skeleton className="h-4 w-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!signal || !snapshot) return null;

  return (
    <Card className="border-border bg-card hover:border-primary/50 transition-colors relative group overflow-hidden">
      <Link href={`/signal/${asset}`} className="absolute inset-0 z-10" />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-bold tracking-tight">{asset}</CardTitle>
        <VerdictBadge verdict={signal.verdictDjzs} />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-2xl font-mono tracking-tight">{formatCurrency(snapshot.price)}</div>
              <div className={cn(
                "text-sm font-mono flex items-center",
                snapshot.priceChangePct24h >= 0 ? "text-[var(--color-trade-long)]" : "text-[var(--color-trade-short)]"
              )}>
                {snapshot.priceChangePct24h >= 0 ? "+" : ""}{formatPercent(snapshot.priceChangePct24h)}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className={cn(
                "text-lg font-bold font-mono flex items-center gap-1",
                signal.direction === "LONG" ? "text-[var(--color-trade-long)]" :
                signal.direction === "SHORT" ? "text-[var(--color-trade-short)]" :
                "text-[var(--color-trade-wait)]"
              )}>
                <SignalDirectionIcon direction={signal.direction} className="w-5 h-5" />
                {signal.direction}
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>CONFIDENCE</span>
              <span>{signal.confidence}%</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full",
                  signal.direction === "LONG" ? "bg-[var(--color-trade-long)]" :
                  signal.direction === "SHORT" ? "bg-[var(--color-trade-short)]" :
                  "bg-[var(--color-trade-wait)]"
                )}
                style={{ width: `${signal.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: feed, isLoading: isLoadingFeed } = useGetSignalFeed({ limit: 10 });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">DASHBOARD</h1>
        <p className="text-muted-foreground text-sm">4H Timeframe • Deterministic Signals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AssetCard asset="ETH" />
        <AssetCard asset="BTC" />
        <AssetCard asset="SOL" />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-border pb-2">SIGNAL FEED</h2>
        
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-mono font-medium">TIME</th>
                <th className="px-4 py-2 text-left font-mono font-medium">ASSET</th>
                <th className="px-4 py-2 text-left font-mono font-medium">DIR</th>
                <th className="px-4 py-2 text-left font-mono font-medium">CONF</th>
                <th className="px-4 py-2 text-left font-mono font-medium">DJZS</th>
                <th className="px-4 py-2 text-left font-mono font-medium">SUMMARY</th>
                <th className="px-4 py-2 text-right font-mono font-medium">ACT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoadingFeed ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : feed?.map((entry) => (
                <tr key={entry.id} className="hover:bg-accent/30 transition-colors group">
                  <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(entry.computedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-bold">{entry.asset}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "font-mono font-bold flex items-center gap-1",
                      entry.direction === "LONG" ? "text-[var(--color-trade-long)]" :
                      entry.direction === "SHORT" ? "text-[var(--color-trade-short)]" :
                      "text-[var(--color-trade-wait)]"
                    )}>
                      {entry.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{entry.confidence}%</td>
                  <td className="px-4 py-3"><VerdictBadge verdict={entry.verdict} /></td>
                  <td className="px-4 py-3 text-muted-foreground max-w-md truncate">{entry.summary}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/signal/${entry.asset}`} className="inline-flex items-center justify-center p-1.5 rounded bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingFeed && feed?.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No recent signals.</div>
          )}
        </div>
      </div>
    </div>
  );
}
