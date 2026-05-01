import { useParams, Link } from "wouter";
import { useGetSignalByAsset, getGetSignalByAssetQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, formatNumber, formatLargeNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
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

export default function SignalDetail() {
  const { asset } = useParams();
  
  const { data: signal, isLoading } = useGetSignalByAsset(asset || "", { 
    query: { enabled: !!asset, queryKey: getGetSignalByAssetQueryKey(asset || "") } 
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-none bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-none bg-muted" />
          <Skeleton className="h-64 w-full rounded-none bg-muted" />
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-display mb-2">SIGNAL NOT FOUND</h2>
        <p className="text-muted-foreground font-mono text-sm">COULD NOT FIND SIGNAL DATA FOR {asset}</p>
        <Link href="/" className="text-primary hover:underline mt-4 inline-block font-mono text-sm">RETURN TO DASHBOARD</Link>
      </div>
    );
  }

  const { marketSnapshot, trendRegime, openInterestContext } = signal;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="pb-4 border-b border-border flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/">
              <div className="p-1 border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </div>
            </Link>
            <h1 className="text-2xl font-display text-foreground flex items-center gap-3">
              {asset} SIGNAL
              <DirectionChip direction={signal.direction} />
              <VerdictChip verdict={signal.verdictDjzs} />
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-xs uppercase">
            COMPUTED: {new Date(signal.computedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center">
          <Link href={`/audit/${asset}`}>
            <div className="px-4 py-2 border border-border bg-card text-foreground font-mono text-xs uppercase hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
              VIEW FULL AUDIT
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Signal Card */}
        <div className="md:col-span-8">
          <Card className="border-border bg-card h-full">
            <CardHeader className="px-6 py-3 border-b border-border">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase">PRIMARY SIGNAL</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col gap-8">
                {/* Price and Confidence */}
                <div>
                  <div className="text-[40px] leading-none font-mono text-foreground mb-4">
                    {marketSnapshot ? formatCurrency(marketSnapshot.price) : "---"}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono text-muted-foreground uppercase">
                      <span>CONFIDENCE SCORE</span>
                      <span className="text-foreground">{signal.confidence}%</span>
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

                {/* Zones Horizontal Stat Row */}
                <div className="flex flex-wrap gap-x-12 gap-y-6 pt-6 border-t border-border">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1 font-mono uppercase">ENTRY ZONE</div>
                    <div className="text-lg font-mono text-foreground">
                      {signal.entryZoneLow && signal.entryZoneHigh 
                        ? `${formatCurrency(signal.entryZoneLow)} - ${formatCurrency(signal.entryZoneHigh)}`
                        : "---"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1 font-mono uppercase">TARGET</div>
                    <div className="text-lg font-mono text-primary">
                      {signal.targetZone ? formatCurrency(signal.targetZone) : "---"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1 font-mono uppercase">INVALIDATION</div>
                    <div className="text-lg font-mono text-destructive">
                      {signal.invalidationPrice ? formatCurrency(signal.invalidationPrice) : "---"}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market Context & Reason Codes */}
        <div className="md:col-span-4 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="px-4 py-3 border-b border-border">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase">MARKET DATA</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {marketSnapshot ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-muted-foreground text-xs font-mono uppercase">24H CHANGE</div>
                    <div className={cn(
                      "text-sm font-mono",
                      marketSnapshot.priceChangePct24h >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {marketSnapshot.priceChangePct24h >= 0 ? "+" : ""}{formatPercent(marketSnapshot.priceChangePct24h)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-muted-foreground text-xs font-mono uppercase">VOLUME 24H</div>
                    <div className="text-sm font-mono">{marketSnapshot.volume24h ? `$${formatLargeNumber(marketSnapshot.volume24h)}` : "---"}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-muted-foreground text-xs font-mono uppercase">MARKET CAP</div>
                    <div className="text-sm font-mono">{marketSnapshot.marketCap ? `$${formatLargeNumber(marketSnapshot.marketCap)}` : "---"}</div>
                  </div>
                </div>
              ) : <div className="text-muted-foreground text-xs font-mono">NO MARKET DATA AVAILABLE</div>}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="px-4 py-3 border-b border-border">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase">REASON CODES</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {signal.reasonCodes && signal.reasonCodes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {signal.reasonCodes.map(code => (
                    <span key={code} className="chip-reason">
                      {code}
                    </span>
                  ))}
                </div>
              ) : <div className="text-muted-foreground text-xs font-mono">NO_CODES_PROVIDED</div>}
            </CardContent>
          </Card>
        </div>

        {/* Trend Regime */}
        <div className="md:col-span-6">
          <div className="space-y-4">
            <h2 className="text-sm font-mono text-muted-foreground uppercase border-b border-border pb-2">TREND REGIME</h2>
            <div className="border border-border bg-transparent overflow-hidden">
              {trendRegime ? (
                <table className="w-full text-sm font-mono">
                  <thead className="bg-secondary text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-normal text-xs uppercase" colSpan={2}>
                        {trendRegime.regime} • STRENGTH: {trendRegime.trendStrength || 0}/100
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-transparent">
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">EMA 9</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(trendRegime.ema9)}</td>
                    </tr>
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">EMA 21</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(trendRegime.ema21)}</td>
                    </tr>
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">EMA 50</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(trendRegime.ema50)}</td>
                    </tr>
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">RSI</td>
                      <td className={cn(
                        "px-4 py-3 text-right",
                        trendRegime.rsi && trendRegime.rsi > 70 ? "text-destructive" :
                        trendRegime.rsi && trendRegime.rsi < 30 ? "text-primary" : ""
                      )}>{formatNumber(trendRegime.rsi)}</td>
                    </tr>
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">MACD HIST</td>
                      <td className={cn(
                        "px-4 py-3 text-right",
                        trendRegime.macdHistogram && trendRegime.macdHistogram > 0 ? "text-primary" : "text-destructive"
                      )}>{formatNumber(trendRegime.macdHistogram, 4)}</td>
                    </tr>
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">ATR</td>
                      <td className="px-4 py-3 text-right">{formatNumber(trendRegime.atr)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : <div className="p-4 text-muted-foreground text-xs font-mono">No trend data available</div>}
            </div>
          </div>
        </div>

        {/* OI Context */}
        <div className="md:col-span-6">
          <div className="space-y-4">
            <h2 className="text-sm font-mono text-muted-foreground uppercase border-b border-border pb-2">OPEN INTEREST CONTEXT</h2>
            <div className="border border-border bg-transparent overflow-hidden">
              {openInterestContext ? (
                <table className="w-full text-sm font-mono">
                  <thead className="bg-secondary text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-normal text-xs uppercase" colSpan={2}>
                        DOMINANT: <span className={cn(
                          openInterestContext.dominantSide === "LONG" ? "text-primary" :
                          openInterestContext.dominantSide === "SHORT" ? "text-destructive" : ""
                        )}>{openInterestContext.dominantSide}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-transparent">
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">TOTAL OI</td>
                      <td className="px-4 py-3 text-right">{openInterestContext.openInterest ? `$${formatLargeNumber(openInterestContext.openInterest)}` : "---"}</td>
                    </tr>
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">OI 24H CHANGE</td>
                      <td className={cn(
                        "px-4 py-3 text-right",
                        openInterestContext.oiChangePct24h && openInterestContext.oiChangePct24h > 0 ? "text-primary" : "text-destructive"
                      )}>
                        {openInterestContext.oiChangePct24h && openInterestContext.oiChangePct24h > 0 ? "+" : ""}
                        {formatPercent(openInterestContext.oiChangePct24h)}
                      </td>
                    </tr>
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">FUNDING RATE</td>
                      <td className={cn(
                        "px-4 py-3 text-right",
                        openInterestContext.fundingRate && openInterestContext.fundingRate > 0 ? "text-primary" : "text-destructive"
                      )}>
                        {openInterestContext.fundingRate ? `${(openInterestContext.fundingRate * 100).toFixed(4)}%` : "---"}
                      </td>
                    </tr>
                    <tr className="hover:bg-card">
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">L/S RATIO</td>
                      <td className="px-4 py-3 text-right">{formatNumber(openInterestContext.longShortRatio)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : <div className="p-4 text-muted-foreground text-xs font-mono">No open interest data available</div>}
            </div>
          </div>
        </div>

      </div>

      <div className="pt-8 mt-8 border-t border-border flex flex-col md:flex-row justify-between text-xs font-mono text-muted-foreground uppercase">
        <div>DST SIGNAL LAYER — PAPER MODE ONLY</div>
        <div>DJZS AUDIT PROTOCOL — NOT FINANCIAL ADVICE</div>
      </div>
    </div>
  );
}
