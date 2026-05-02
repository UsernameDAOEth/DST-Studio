import { useParams, Link } from "wouter";
import { useGetSignalByAsset, getGetSignalByAssetQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, formatNumber, formatLargeNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ProcessVerdictBadge,
  SetupFamilyLabel,
  EntryQualityBadge,
  NarrativeRiskBadge,
  ProcessGradeBadge,
  RRRatioBadge,
  PreTradeChecklistPanel,
  WaitDecisionPanel,
  DjzsGateBadge,
  RoutingPriorityPanel,
} from "@/components/signal-process";

function DirectionChip({ direction }: { direction: string }) {
  if (direction === "LONG") return <span className="chip-long">{direction}</span>;
  if (direction === "SHORT") return <span className="chip-short">{direction}</span>;
  return <span className="chip-wait">{direction}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mb-1">{children}</div>
  );
}

function PacketField({ label, value, accent }: { label: string; value: React.ReactNode; accent?: "long" | "short" | "wait" | "muted" }) {
  const accentClass =
    accent === "long" ? "text-primary" :
    accent === "short" ? "text-destructive" :
    accent === "wait" ? "text-[hsl(var(--trade-wait))]" :
    accent === "muted" ? "text-muted-foreground" :
    "text-foreground";

  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className={cn("font-mono text-base", accentClass)}>{value}</div>
    </div>
  );
}

export default function SignalDetail() {
  const { asset } = useParams();
  
  const { data: signal, isLoading } = useGetSignalByAsset(asset || "", {
    query: { enabled: !!asset, queryKey: getGetSignalByAssetQueryKey(asset || "") }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
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
  const isWait = signal.direction === "WAIT";
  const isApproved = signal.processVerdict === "APPROVED";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

      {/* ── HEADER ── */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/">
            <div className="p-1 border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </div>
          </Link>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">TRADE PACKET</div>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-display text-foreground">{asset}</h1>
              <DirectionChip direction={signal.direction} />
              <SetupFamilyLabel family={signal.setupFamily} />
            </div>
            <div className="flex items-baseline gap-4">
              <div className="text-2xl font-mono text-foreground">
                {marketSnapshot ? formatCurrency(marketSnapshot.price) : "---"}
              </div>
              {marketSnapshot && (
                <div className={cn(
                  "text-sm font-mono",
                  marketSnapshot.priceChangePct24h >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {marketSnapshot.priceChangePct24h >= 0 ? "+" : ""}{formatPercent(marketSnapshot.priceChangePct24h)} 24H
                </div>
              )}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">
              4H · COMPUTED {new Date(signal.computedAt).toLocaleString()} · PAPER MODE
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ProcessGradeBadge grade={signal.processQualityGrade} />
            <Link href={`/audit/${asset}`}>
              <div className="px-4 py-2 border border-border bg-card text-foreground font-mono text-xs uppercase hover:border-primary/40 hover:text-primary transition-colors cursor-pointer whitespace-nowrap">
                VIEW AUDIT →
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── DECISION GATE ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DjzsGateBadge verdict={signal.verdictDjzs} admissibility={signal.logicAdmissibility} />
        <div className="border border-border bg-card p-4 flex items-start gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">PROCESS VERDICT</div>
            <div className="flex items-center gap-3 mb-2">
              <ProcessVerdictBadge verdict={signal.processVerdict} />
              <RRRatioBadge ratio={signal.rrRatio} />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <EntryQualityBadge quality={signal.entryQuality} />
              <NarrativeRiskBadge risk={signal.narrativeRisk} />
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/70 mt-2 leading-tight">
              Confidence: {signal.confidence}% · {signal.processVerdict === "APPROVED" ? "Meets all hard execution rules." : "One or more hard rules failed."}
            </div>
          </div>
        </div>
      </div>

      {/* ── REJECTION / WAIT PANEL (shown prominently when not approved) ── */}
      <WaitDecisionPanel
        direction={signal.direction}
        processVerdict={signal.processVerdict}
        verdictDjzs={signal.verdictDjzs}
        rejectionCodes={signal.rejectionCodes}
        rejectIf={signal.rejectIf}
        logicAdmissibility={signal.logicAdmissibility}
      />

      {/* ── TRADE PARAMETERS ── */}
      <Card className={cn(
        "border-border bg-card",
        isWait && "opacity-60"
      )}>
        <CardHeader className="px-6 py-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-mono text-muted-foreground uppercase">TRADE PARAMETERS</CardTitle>
          {isWait && (
            <span className="font-mono text-[10px] text-muted-foreground uppercase">NOT APPLICABLE — WAIT</span>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <PacketField
              label="ENTRY ZONE"
              value={
                signal.entryZoneLow && signal.entryZoneHigh
                  ? `${formatCurrency(signal.entryZoneLow)} – ${formatCurrency(signal.entryZoneHigh)}`
                  : "---"
              }
            />
            <PacketField
              label="TARGET"
              value={signal.targetZone ? formatCurrency(signal.targetZone) : "---"}
              accent={isWait ? "muted" : "long"}
            />
            <PacketField
              label="INVALIDATION"
              value={signal.invalidationPrice ? formatCurrency(signal.invalidationPrice) : "---"}
              accent={isWait ? "muted" : "short"}
            />
            <PacketField
              label="R/R RATIO"
              value={signal.rrRatio > 0 ? `${signal.rrRatio.toFixed(1)}x` : "---"}
              accent={
                isWait ? "muted" :
                signal.rrRatio >= 2 ? "long" :
                signal.rrRatio >= 1.5 ? "wait" : "short"
              }
            />
          </div>

          {!isWait && signal.reasonCodes && signal.reasonCodes.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <SectionLabel>STRUCTURAL EVIDENCE</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {signal.reasonCodes.map(code => (
                  <span key={code} className="chip-reason">{code}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ROUTING ── */}
      <RoutingPriorityPanel direction={signal.direction} processVerdict={signal.processVerdict} />

      {/* ── THESIS + ASSESSMENT ── */}
      {(signal.thesis || signal.whyTrade) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {signal.thesis && (
            <div className="border border-border bg-card p-5">
              <SectionLabel>THESIS</SectionLabel>
              <p className="text-body italic mt-2 leading-relaxed">{signal.thesis}</p>
            </div>
          )}
          {signal.whyTrade && (
            <div className={cn(
              "border bg-card p-5",
              isWait ? "border-border" : isApproved ? "border-primary/20" : "border-destructive/20"
            )}>
              <SectionLabel>{isWait ? "ASSESSMENT (NOT A TRADE)" : "ASSESSMENT"}</SectionLabel>
              <p className="text-body mt-2 leading-relaxed">{signal.whyTrade}</p>
            </div>
          )}
        </div>
      )}

      {/* ── PRE-TRADE CHECKLIST ── */}
      <Card className="border-border bg-card">
        <CardHeader className="px-6 py-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-mono text-muted-foreground uppercase">PRE-TRADE CHECKLIST</CardTitle>
          {signal.preTradChecklist?.checklistComplete ? (
            <span className="text-primary font-mono text-xs font-bold uppercase">COMPLETE</span>
          ) : (
            <span className="text-[hsl(var(--trade-wait))] font-mono text-xs font-bold uppercase">INCOMPLETE</span>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <PreTradeChecklistPanel checklist={signal.preTradChecklist} />
        </CardContent>
      </Card>

      {/* ── MARKET EVIDENCE ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Market Data */}
        <Card className="border-border bg-card">
          <CardHeader className="px-4 py-3 border-b border-border">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase">MARKET STATE</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {marketSnapshot ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs font-mono uppercase">24H CHANGE</span>
                  <span className={cn("text-sm font-mono", marketSnapshot.priceChangePct24h >= 0 ? "text-primary" : "text-destructive")}>
                    {marketSnapshot.priceChangePct24h >= 0 ? "+" : ""}{formatPercent(marketSnapshot.priceChangePct24h)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs font-mono uppercase">VOLUME 24H</span>
                  <span className="text-sm font-mono">{marketSnapshot.volume24h ? `$${formatLargeNumber(marketSnapshot.volume24h)}` : "---"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs font-mono uppercase">MARKET CAP</span>
                  <span className="text-sm font-mono">{marketSnapshot.marketCap ? `$${formatLargeNumber(marketSnapshot.marketCap)}` : "---"}</span>
                </div>
              </div>
            ) : <div className="text-muted-foreground text-xs font-mono">NO MARKET DATA</div>}
          </CardContent>
        </Card>

        {/* Trend Regime */}
        <Card className="border-border bg-card">
          <CardHeader className="px-4 py-3 border-b border-border">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase">
              REGIME {trendRegime ? `— ${trendRegime.regime}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {trendRegime ? (
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">STRENGTH</span>
                  <span>{trendRegime.trendStrength ?? 0}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">EMA 9/21/50</span>
                  <span className="text-xs">{formatCurrency(trendRegime.ema9)} / {formatCurrency(trendRegime.ema21)} / {formatCurrency(trendRegime.ema50)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">RSI</span>
                  <span className={cn(
                    trendRegime.rsi && trendRegime.rsi > 70 ? "text-destructive" :
                    trendRegime.rsi && trendRegime.rsi < 30 ? "text-primary" : ""
                  )}>{formatNumber(trendRegime.rsi)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">MACD HIST</span>
                  <span className={trendRegime.macdHistogram && trendRegime.macdHistogram > 0 ? "text-primary" : "text-destructive"}>
                    {formatNumber(trendRegime.macdHistogram, 4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">ATR</span>
                  <span>{formatNumber(trendRegime.atr)}</span>
                </div>
              </div>
            ) : <div className="text-muted-foreground text-xs font-mono">NO REGIME DATA</div>}
          </CardContent>
        </Card>

        {/* OI Context */}
        <Card className="border-border bg-card">
          <CardHeader className="px-4 py-3 border-b border-border">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase">
              OPEN INTEREST {openInterestContext ? `— ${openInterestContext.dominantSide}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {openInterestContext ? (
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">TOTAL OI</span>
                  <span>{openInterestContext.openInterest ? `$${formatLargeNumber(openInterestContext.openInterest)}` : "---"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">OI 24H Δ</span>
                  <span className={openInterestContext.oiChangePct24h && openInterestContext.oiChangePct24h > 0 ? "text-primary" : "text-destructive"}>
                    {openInterestContext.oiChangePct24h && openInterestContext.oiChangePct24h > 0 ? "+" : ""}
                    {formatPercent(openInterestContext.oiChangePct24h)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">FUNDING</span>
                  <span className={openInterestContext.fundingRate && openInterestContext.fundingRate > 0 ? "text-primary" : "text-destructive"}>
                    {openInterestContext.fundingRate ? `${(openInterestContext.fundingRate * 100).toFixed(4)}%` : "---"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs uppercase">L/S RATIO</span>
                  <span>{formatNumber(openInterestContext.longShortRatio)}</span>
                </div>
              </div>
            ) : <div className="text-muted-foreground text-xs font-mono">NO OI DATA</div>}
          </CardContent>
        </Card>
      </div>

      {/* ── OUTCOME TRACKING STUB ── */}
      <Card className="border-border border-dashed bg-transparent opacity-60">
        <CardHeader className="px-6 py-3 border-b border-border border-dashed flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-mono text-muted-foreground uppercase">OUTCOME TRACKING</CardTitle>
          <span className="chip-warn font-bold">SCAFFOLDED</span>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground font-mono text-xs text-center uppercase">
            PHASE 3 — PROCESS QUALITY IS RECORDED INDEPENDENTLY OF MARKET OUTCOME.
            OUTCOME RESOLUTION LOOP NOT YET LIVE.
          </p>
        </CardContent>
      </Card>

      <div className="pt-6 border-t border-border flex flex-col md:flex-row justify-between text-xs font-mono text-muted-foreground uppercase">
        <div>DST — DECISION LAYER ONLY · NOT AN EXECUTION PLATFORM</div>
        <div>DJZS AUDIT PROTOCOL · NOT FINANCIAL ADVICE</div>
      </div>
    </div>
  );
}
