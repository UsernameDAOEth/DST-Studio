import { useParams, Link } from "wouter";
import { useGetSignalByAsset, getGetSignalByAssetQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Minus, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function SignalDirectionIcon({ direction, className }: { direction: string, className?: string }) {
  if (direction === "LONG") return <ArrowUpRight className={cn("text-[var(--color-trade-long)]", className)} />;
  if (direction === "SHORT") return <ArrowDownRight className={cn("text-[var(--color-trade-short)]", className)} />;
  return <Minus className={cn("text-[var(--color-trade-wait)]", className)} />;
}

function AuditCheckBadge({ result }: { result: string }) {
  if (result === "PASS") return <Badge className="bg-[var(--color-trade-long)]/10 text-[var(--color-trade-long)] hover:bg-[var(--color-trade-long)]/20 font-mono"><CheckCircle2 className="w-3 h-3 mr-1" />PASS</Badge>;
  if (result === "FAIL") return <Badge className="bg-[var(--color-trade-short)]/10 text-[var(--color-trade-short)] hover:bg-[var(--color-trade-short)]/20 font-mono"><XCircle className="w-3 h-3 mr-1" />FAIL</Badge>;
  if (result === "WARN") return <Badge className="bg-[var(--color-trade-wait)]/10 text-[var(--color-trade-wait)] hover:bg-[var(--color-trade-wait)]/20 font-mono"><AlertTriangle className="w-3 h-3 mr-1" />WARN</Badge>;
  return <Badge className="bg-muted text-muted-foreground hover:bg-muted/80 font-mono"><Info className="w-3 h-3 mr-1" />SKIP</Badge>;
}

export default function SignalDetail() {
  const { asset } = useParams();
  
  const { data: signal, isLoading } = useGetSignalByAsset(asset || "", { 
    query: { enabled: !!asset, queryKey: getGetSignalByAssetQueryKey(asset || "") } 
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-bold mb-2">Signal Not Found</h2>
        <p className="text-muted-foreground">Could not find signal data for {asset}</p>
        <Link href="/" className="text-primary hover:underline mt-4 inline-block">Return to Dashboard</Link>
      </div>
    );
  }

  const { marketSnapshot, trendRegime, openInterestContext, auditReport } = signal;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <div className="p-2 hover:bg-accent rounded-full transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{asset} SIGNAL</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm font-mono">
            {new Date(signal.computedAt).toLocaleString()}
          </span>
          <Link href={`/audit/${asset}`}>
            <div className="px-3 py-1.5 border border-border rounded-sm text-sm font-mono hover:bg-accent transition-colors cursor-pointer">
              VIEW FULL AUDIT
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Signal Card */}
        <div className="md:col-span-8">
          <Card className="border-border bg-card h-full border-l-4" style={{ 
            borderLeftColor: signal.direction === "LONG" ? "var(--color-trade-long)" : 
                            signal.direction === "SHORT" ? "var(--color-trade-short)" : 
                            "var(--color-trade-wait)" 
          }}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">PRIMARY SIGNAL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-8">
                <div className={cn(
                  "text-6xl font-bold font-mono flex items-center gap-2",
                  signal.direction === "LONG" ? "text-[var(--color-trade-long)]" :
                  signal.direction === "SHORT" ? "text-[var(--color-trade-short)]" :
                  "text-[var(--color-trade-wait)]"
                )}>
                  <SignalDirectionIcon direction={signal.direction} className="w-12 h-12" />
                  {signal.direction}
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">DJZS VERDICT</div>
                  <div className={cn(
                    "text-3xl font-bold font-mono",
                    signal.verdictDjzs === "PASS" ? "text-[var(--color-trade-long)]" :
                    signal.verdictDjzs === "FAIL" ? "text-[var(--color-trade-short)]" :
                    "text-[var(--color-trade-wait)]"
                  )}>
                    {signal.verdictDjzs}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                <div className="flex justify-between text-sm font-mono">
                  <span>CONFIDENCE SCORE</span>
                  <span className={signal.confidence > 75 ? "text-primary" : "text-muted-foreground"}>{signal.confidence}%</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-none overflow-hidden border border-border">
                  <div 
                    className={cn(
                      "h-full",
                      signal.direction === "LONG" ? "bg-[var(--color-trade-long)]" :
                      signal.direction === "SHORT" ? "bg-[var(--color-trade-short)]" :
                      "bg-[var(--color-trade-wait)]"
                    )}
                    style={{ width: `${signal.confidence}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-mono">ENTRY ZONE</div>
                  <div className="text-lg font-mono">
                    {signal.entryZoneLow && signal.entryZoneHigh 
                      ? `${formatCurrency(signal.entryZoneLow)} - ${formatCurrency(signal.entryZoneHigh)}`
                      : "---"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-mono">TARGET</div>
                  <div className="text-lg font-mono text-[var(--color-trade-long)]">
                    {signal.targetZone ? formatCurrency(signal.targetZone) : "---"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-mono">INVALIDATION</div>
                  <div className="text-lg font-mono text-[var(--color-trade-short)]">
                    {signal.invalidationPrice ? formatCurrency(signal.invalidationPrice) : "---"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market Context */}
        <div className="md:col-span-4 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-sm font-mono text-muted-foreground">MARKET DATA</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {marketSnapshot ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-mono">{formatCurrency(marketSnapshot.price)}</div>
                    <div className={cn(
                      "text-sm font-mono mt-1",
                      marketSnapshot.priceChangePct24h >= 0 ? "text-[var(--color-trade-long)]" : "text-[var(--color-trade-short)]"
                    )}>
                      {marketSnapshot.priceChangePct24h >= 0 ? "+" : ""}{formatPercent(marketSnapshot.priceChangePct24h)} 24h
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-4 text-sm font-mono">
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">VOLUME 24H</div>
                      <div>{marketSnapshot.volume24h ? `$${formatLargeNumber(marketSnapshot.volume24h)}` : "---"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">MARKET CAP</div>
                      <div>{marketSnapshot.marketCap ? `$${formatLargeNumber(marketSnapshot.marketCap)}` : "---"}</div>
                    </div>
                  </div>
                </div>
              ) : <div className="text-muted-foreground text-sm py-4">No market data available</div>}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-sm font-mono text-muted-foreground">REASON CODES</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {signal.reasonCodes && signal.reasonCodes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {signal.reasonCodes.map(code => (
                    <Badge key={code} variant="secondary" className="font-mono bg-secondary hover:bg-secondary/80 border-border text-xs rounded-sm">
                      {code}
                    </Badge>
                  ))}
                </div>
              ) : <div className="text-muted-foreground text-sm font-mono">NO_CODES_PROVIDED</div>}
            </CardContent>
          </Card>
        </div>

        {/* Trend Regime */}
        <div className="md:col-span-6">
          <Card className="border-border bg-card h-full">
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-sm font-mono text-muted-foreground">TREND REGIME</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {trendRegime ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl">{trendRegime.regime}</span>
                    <Badge variant="outline" className="font-mono border-border">STRENGTH: {trendRegime.trendStrength || 0}/100</Badge>
                  </div>
                  
                  <div className="border border-border rounded-sm overflow-hidden">
                    <table className="w-full text-sm font-mono">
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">EMA 9</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(trendRegime.ema9)}</td>
                        </tr>
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">EMA 21</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(trendRegime.ema21)}</td>
                        </tr>
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">EMA 50</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(trendRegime.ema50)}</td>
                        </tr>
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">RSI</td>
                          <td className={cn(
                            "px-4 py-2 text-right",
                            trendRegime.rsi && trendRegime.rsi > 70 ? "text-[var(--color-trade-short)]" :
                            trendRegime.rsi && trendRegime.rsi < 30 ? "text-[var(--color-trade-long)]" : ""
                          )}>{formatNumber(trendRegime.rsi)}</td>
                        </tr>
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">MACD HIST</td>
                          <td className={cn(
                            "px-4 py-2 text-right",
                            trendRegime.macdHistogram && trendRegime.macdHistogram > 0 ? "text-[var(--color-trade-long)]" : "text-[var(--color-trade-short)]"
                          )}>{formatNumber(trendRegime.macdHistogram, 4)}</td>
                        </tr>
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">ATR</td>
                          <td className="px-4 py-2 text-right">{formatNumber(trendRegime.atr)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : <div className="text-muted-foreground text-sm">No trend data available</div>}
            </CardContent>
          </Card>
        </div>

        {/* OI Context */}
        <div className="md:col-span-6">
          <Card className="border-border bg-card h-full">
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-sm font-mono text-muted-foreground">OPEN INTEREST CONTEXT</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {openInterestContext ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl">DOMINANT: <span className={cn(
                      openInterestContext.dominantSide === "LONG" ? "text-[var(--color-trade-long)]" :
                      openInterestContext.dominantSide === "SHORT" ? "text-[var(--color-trade-short)]" : ""
                    )}>{openInterestContext.dominantSide}</span></span>
                  </div>
                  
                  <div className="border border-border rounded-sm overflow-hidden">
                    <table className="w-full text-sm font-mono">
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">TOTAL OI</td>
                          <td className="px-4 py-2 text-right">{openInterestContext.openInterest ? `$${formatLargeNumber(openInterestContext.openInterest)}` : "---"}</td>
                        </tr>
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">OI 24H CHANGE</td>
                          <td className={cn(
                            "px-4 py-2 text-right",
                            openInterestContext.oiChangePct24h && openInterestContext.oiChangePct24h > 0 ? "text-[var(--color-trade-long)]" : "text-[var(--color-trade-short)]"
                          )}>
                            {openInterestContext.oiChangePct24h && openInterestContext.oiChangePct24h > 0 ? "+" : ""}
                            {formatPercent(openInterestContext.oiChangePct24h)}
                          </td>
                        </tr>
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">FUNDING RATE</td>
                          <td className={cn(
                            "px-4 py-2 text-right",
                            openInterestContext.fundingRate && openInterestContext.fundingRate > 0 ? "text-[var(--color-trade-long)]" : "text-[var(--color-trade-short)]"
                          )}>
                            {openInterestContext.fundingRate ? `${(openInterestContext.fundingRate * 100).toFixed(4)}%` : "---"}
                          </td>
                        </tr>
                        <tr className="hover:bg-accent/30">
                          <td className="px-4 py-2 text-muted-foreground">L/S RATIO</td>
                          <td className="px-4 py-2 text-right">{formatNumber(openInterestContext.longShortRatio)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : <div className="text-muted-foreground text-sm">No open interest data available</div>}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
