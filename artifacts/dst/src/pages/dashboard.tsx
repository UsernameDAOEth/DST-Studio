import { Link } from "wouter";
import { useGetSignals, useGetMarketSnapshot, useGetSignalFeed } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <Card className="border-border bg-card hover:border-primary/40 transition-colors relative group overflow-hidden">
      {/* Top accent strip */}
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
        <div className="flex flex-col gap-5">
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
            <div className="flex flex-col items-end">
              <DirectionChip direction={signal.direction} />
            </div>
          </div>
          
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
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: feed, isLoading: isLoadingFeed } = useGetSignalFeed({ limit: 10 });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-display text-foreground mb-1">DASHBOARD</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase">4H TIMEFRAME // DETERMINISTIC SIGNALS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AssetCard asset="ETH" />
        <AssetCard asset="BTC" />
        <AssetCard asset="SOL" />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-mono text-muted-foreground uppercase border-b border-border pb-2">SIGNAL FEED</h2>
        
        <div className="border border-border bg-transparent overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">TIME</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">ASSET</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">DIR</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">CONF</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">DJZS</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-xs uppercase">SUMMARY</th>
                <th className="px-4 py-2 text-right font-mono font-medium text-xs uppercase">ACT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-transparent">
              {isLoadingFeed ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20 rounded-none bg-muted" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12 rounded-none bg-muted" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 rounded-none bg-muted" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-10 rounded-none bg-muted" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 rounded-none bg-muted" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-48 rounded-none bg-muted" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-6 w-6 ml-auto rounded-none bg-muted" /></td>
                  </tr>
                ))
              ) : feed?.map((entry) => (
                <tr key={entry.id} className="hover:bg-card transition-colors group">
                  <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(entry.computedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-display text-foreground font-bold">{entry.asset}</td>
                  <td className="px-4 py-3">
                    <DirectionChip direction={entry.direction} />
                  </td>
                  <td className="px-4 py-3 font-mono">{entry.confidence}%</td>
                  <td className="px-4 py-3"><VerdictChip verdict={entry.verdict} /></td>
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
            <div className="p-8 text-center text-muted-foreground font-mono text-sm uppercase">NO_SIGNALS_FOUND</div>
          )}
        </div>
      </div>
      
      <div className="pt-8 mt-8 border-t border-border flex flex-col md:flex-row justify-between text-xs font-mono text-muted-foreground uppercase">
        <div>DST SIGNAL LAYER — PAPER MODE ONLY</div>
        <div>DJZS AUDIT PROTOCOL — NOT FINANCIAL ADVICE</div>
      </div>
    </div>
  );
}
