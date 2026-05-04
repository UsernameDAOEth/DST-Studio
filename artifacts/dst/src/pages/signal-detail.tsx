import { useParams, Link } from "wouter";
import { useGetSignalByAsset, getGetSignalByAssetQueryKey, useGetHermesConstraints } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, formatNumber, formatLargeNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { ArrowLeft, AlertTriangle } from "lucide-react";
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
import { DataQualityPanel } from "@/components/data-quality";
import { VerificationPanel } from "@/components/verification-panel";
import { HermesTargetFindingsPanel } from "@/components/hermes-findings";

function DirectionChip({ direction }: { direction: string }) {
  if (direction === "LONG") return <span className="chip-long">{direction}</span>;
  if (direction === "SHORT") return <span className="chip-short">{direction}</span>;
  return <span className="chip-wait">{direction}</span>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
      {children}
    </div>
  );
}

function PacketField({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "long" | "short" | "wait" | "muted";
}) {
  const accentClass =
    accent === "long" ? "text-primary" :
    accent === "short" ? "text-destructive" :
    accent === "wait" ? "text-[hsl(var(--trade-wait))]" :
    accent === "muted" ? "text-muted-foreground/50" :
    "text-foreground";

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className={cn("font-mono text-sm font-bold mono-nums", accentClass)}>{value}</div>
    </div>
  );
}

function PipelineIndicators({ dataQuality, constraints }: {
  dataQuality?: { flags?: string[] };
  constraints?: { pythConfidenceFilter?: boolean; browserbaseTriggerPolicy?: string; alertRouting?: { telegram?: boolean; xmtp?: boolean; discord?: boolean } };
}) {
  const flags = dataQuality?.flags ?? [];
  const indicators: { label: string; active: boolean }[] = [];

  if (flags.includes("SYNTHETIC_OI")) indicators.push({ label: "OI: ESTIMATED", active: true });
  if (flags.includes("SYNTHETIC_FUNDING")) indicators.push({ label: "FUNDING: ESTIMATED", active: true });
  if (flags.includes("VOLUME_MISSING")) indicators.push({ label: "VOLUME: UNAVAILABLE", active: true });

  if (constraints) {
    if (!constraints.pythConfidenceFilter) indicators.push({ label: "PYTH: DISABLED", active: true });
    if (constraints.browserbaseTriggerPolicy === "DISABLED") indicators.push({ label: "BROWSERBASE: DISABLED", active: true });
    const routing = constraints.alertRouting;
    if (routing && !routing.telegram && !routing.xmtp && !routing.discord) {
      indicators.push({ label: "ROUTING: NONE", active: true });
    }
  }

  if (indicators.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border border-border/60 bg-card/50">
      <AlertTriangle className="w-3 h-3 text-[hsl(var(--trade-wait))]/70 shrink-0" />
      <span className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-widest mr-1">PIPELINE</span>
      {indicators.map(ind => (
        <span key={ind.label} className="chip-warn text-[8px]">{ind.label}</span>
      ))}
    </div>
  );
}

export default function SignalDetail() {
  const { asset } = useParams();

  const { data: signal, isLoading } = useGetSignalByAsset(asset || "", {
    query: { enabled: !!asset, queryKey: getGetSignalByAssetQueryKey(asset || "") }
  });

  const { data: hermesConstraints } = useGetHermesConstraints();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-none bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 w-full rounded-none bg-muted" />
          <Skeleton className="h-48 w-full rounded-none bg-muted" />
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <Empty className="max-w-md mx-auto mt-16 border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle className="w-5 h-5" />
          </EmptyMedia>
          <EmptyTitle className="font-mono text-sm uppercase tracking-widest">
            SIGNAL NOT FOUND
          </EmptyTitle>
          <EmptyDescription className="font-mono text-[10px] uppercase tracking-wider">
            Could not find signal data for {asset}
          </EmptyDescription>
        </EmptyHeader>
        <Link href="/" className="text-primary hover:underline font-mono text-xs uppercase tracking-wider">
          RETURN TO DASHBOARD
        </Link>
      </Empty>
    );
  }

  const { marketSnapshot, trendRegime, openInterestContext } = signal;
  const isWait = signal.direction === "WAIT";
  const isApproved = signal.processVerdict === "APPROVED";
  const auditLink = signal.id
    ? `/audit/${asset}?signalId=${signal.id}`
    : `/audit/${asset}`;

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-16">

      {/* HEADER */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/">
            <div className="p-1.5 border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
          </Link>
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
            AUDIT PACKET — {asset}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl tracking-widest text-foreground">{asset}</h1>
              <DirectionChip direction={signal.direction} />
              <SetupFamilyLabel family={signal.setupFamily} />
            </div>
            <div className="flex items-baseline gap-4">
              <div className="text-xl font-mono text-foreground mono-nums">
                {marketSnapshot ? formatCurrency(marketSnapshot.price) : "—"}
              </div>
              {marketSnapshot && (
                <div className={cn(
                  "text-xs font-mono mono-nums",
                  marketSnapshot.priceChangePct24h >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {formatPercent(marketSnapshot.priceChangePct24h)} 24H
                </div>
              )}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-widest mt-1.5">
              4H · COMPUTED {new Date(signal.computedAt).toLocaleString()} · PAPER MODE
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ProcessGradeBadge grade={signal.processQualityGrade} />
            <Link href={auditLink}>
              <div className="px-4 py-2 border border-border bg-card text-foreground font-mono text-[10px] uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-colors cursor-pointer whitespace-nowrap">
                VIEW AUDIT →
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* PIPELINE INDICATORS */}
      <PipelineIndicators
        dataQuality={signal.dataQuality as { flags?: string[] } | undefined}
        constraints={hermesConstraints as { pythConfidenceFilter?: boolean; browserbaseTriggerPolicy?: string; alertRouting?: { telegram?: boolean; xmtp?: boolean; discord?: boolean } } | undefined}
      />

      {/* AUDIT VERDICT GATE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DjzsGateBadge verdict={signal.verdictDjzs} admissibility={signal.logicAdmissibility} />
        <div className="terminal-panel">
          <div className="terminal-panel-header">
            <span>PROCESS VERDICT</span>
            <span className="text-muted-foreground/40">HERMES ENGINE</span>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <ProcessVerdictBadge verdict={signal.processVerdict} />
              {!isWait && <RRRatioBadge ratio={signal.rrRatio} />}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <EntryQualityBadge quality={signal.entryQuality} overridden={signal.processVerdict === "REJECTED"} />
              <NarrativeRiskBadge risk={signal.narrativeRisk} />
            </div>
            <div className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wide leading-relaxed">
              CONFIDENCE: {signal.confidence}% ·{" "}
              {signal.processVerdict === "APPROVED"
                ? "ALL HARD EXECUTION RULES MET."
                : "ONE OR MORE HARD RULES FAILED."}
            </div>
          </div>
        </div>
      </div>

      {/* WAIT / REJECTION PANEL */}
      <WaitDecisionPanel
        direction={signal.direction}
        processVerdict={signal.processVerdict}
        verdictDjzs={signal.verdictDjzs}
        rejectionCodes={signal.rejectionCodes}
        rejectIf={signal.rejectIf}
        logicAdmissibility={signal.logicAdmissibility}
      />

      {/* TRADE PARAMETERS */}
      <div className={cn("terminal-panel", isWait && "opacity-50")}>
        <div className="terminal-panel-header">
          <span>TRADE PARAMETERS</span>
          {isWait && <span className="text-muted-foreground/50 text-[9px] tracking-widest">NOT APPLICABLE — WAIT</span>}
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <PacketField
              label="ENTRY ZONE"
              value={
                signal.entryZoneLow && signal.entryZoneHigh
                  ? `${formatCurrency(signal.entryZoneLow)} – ${formatCurrency(signal.entryZoneHigh)}`
                  : "—"
              }
            />
            <PacketField
              label="TARGET"
              value={signal.targetZone ? formatCurrency(signal.targetZone) : "—"}
              accent={isWait ? "muted" : "long"}
            />
            <PacketField
              label="INVALIDATION"
              value={signal.invalidationPrice ? formatCurrency(signal.invalidationPrice) : "—"}
              accent={isWait ? "muted" : "short"}
            />
            <PacketField
              label="R/R RATIO"
              value={!isWait && signal.rrRatio > 0 ? `${signal.rrRatio.toFixed(1)}x` : "—"}
              accent={
                isWait ? "muted" :
                signal.rrRatio >= 2 ? "long" :
                signal.rrRatio >= 1.5 ? "wait" : "short"
              }
            />
          </div>

          {!isWait && signal.reasonCodes && signal.reasonCodes.length > 0 && (
            <div className="mt-5 pt-5 border-t border-border">
              <FieldLabel>STRUCTURAL EVIDENCE</FieldLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {signal.reasonCodes.map(code => (
                  <span key={code} className="chip-reason">{code}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROUTING */}
      <RoutingPriorityPanel direction={signal.direction as string} processVerdict={signal.processVerdict as string | undefined} />

      {/* THESIS + ASSESSMENT */}
      {(signal.thesis || signal.whyTrade) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {signal.thesis && (
            <div className="terminal-panel">
              <div className="terminal-panel-header">THESIS</div>
              <div className="p-5">
                <p className="font-mono text-xs text-muted-foreground italic leading-relaxed">{signal.thesis}</p>
              </div>
            </div>
          )}
          {signal.whyTrade && (
            <div className={cn(
              "terminal-panel",
              isWait ? "border-border" :
              isApproved ? "border-primary/20 glow-green-box" :
              "border-destructive/20"
            )}>
              <div className="terminal-panel-header">
                {isWait ? "ASSESSMENT — NOT A TRADE" : "ASSESSMENT"}
              </div>
              <div className="p-5">
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{signal.whyTrade}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRE-TRADE CHECKLIST */}
      <div className="terminal-panel">
        <div className="terminal-panel-header">
          <span>PRE-TRADE CHECKLIST</span>
          {signal.preTradChecklist?.checklistComplete ? (
            <span className="text-primary text-[9px] font-bold tracking-widest">COMPLETE</span>
          ) : (
            <span className="text-[hsl(var(--trade-wait))] text-[9px] font-bold tracking-widest">INCOMPLETE</span>
          )}
        </div>
        <div className="p-5">
          <PreTradeChecklistPanel checklist={signal.preTradChecklist} />
        </div>
      </div>

      {/* MARKET EVIDENCE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Market State */}
        <div className="terminal-panel">
          <div className="terminal-panel-header">MARKET STATE</div>
          <div className="p-4">
            {marketSnapshot ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="micro-label">24H CHANGE</span>
                  <span className={cn("text-xs font-mono font-bold mono-nums", marketSnapshot.priceChangePct24h >= 0 ? "text-primary" : "text-destructive")}>
                    {formatPercent(marketSnapshot.priceChangePct24h)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">VOLUME 24H</span>
                  <span className="text-xs font-mono mono-nums text-foreground">
                    {marketSnapshot.volume24h ? `$${formatLargeNumber(marketSnapshot.volume24h)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">MARKET CAP</span>
                  <span className="text-xs font-mono mono-nums text-foreground">
                    {marketSnapshot.marketCap ? `$${formatLargeNumber(marketSnapshot.marketCap)}` : "—"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="micro-label text-muted-foreground/50">NO MARKET DATA</div>
            )}
          </div>
        </div>

        {/* Trend Regime */}
        <div className="terminal-panel">
          <div className="terminal-panel-header">
            <span>REGIME</span>
            {trendRegime && <span className="text-foreground/60">{trendRegime.regime}</span>}
          </div>
          <div className="p-4">
            {trendRegime ? (
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="micro-label">STRENGTH</span>
                  <span className="text-xs font-mono mono-nums text-foreground">{trendRegime.trendStrength ?? 0}/100</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">EMA 9/21/50</span>
                  <span className="text-[10px] font-mono mono-nums text-foreground">
                    {formatCurrency(trendRegime.ema9)} / {formatCurrency(trendRegime.ema21)} / {formatCurrency(trendRegime.ema50)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">RSI</span>
                  <span className={cn("text-xs font-mono mono-nums font-bold",
                    trendRegime.rsi && trendRegime.rsi > 70 ? "text-destructive" :
                    trendRegime.rsi && trendRegime.rsi < 30 ? "text-primary" : "text-foreground"
                  )}>{formatNumber(trendRegime.rsi)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">MACD HIST</span>
                  <span className={cn("text-xs font-mono mono-nums font-bold",
                    trendRegime.macdHistogram && trendRegime.macdHistogram > 0 ? "text-primary" : "text-destructive"
                  )}>
                    {formatNumber(trendRegime.macdHistogram, 4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">ATR</span>
                  <span className="text-xs font-mono mono-nums text-foreground">{formatNumber(trendRegime.atr)}</span>
                </div>
              </div>
            ) : (
              <div className="micro-label text-muted-foreground/50">NO REGIME DATA</div>
            )}
          </div>
        </div>

        {/* OI Context */}
        <div className="terminal-panel">
          <div className="terminal-panel-header">
            <span>OPEN INTEREST</span>
            <span className="flex items-center gap-1.5">
              {openInterestContext && <span className="text-foreground/60">{openInterestContext.dominantSide}</span>}
              <span className="chip-warn text-[7px]">EST</span>
            </span>
          </div>
          <div className="p-4">
            {openInterestContext ? (
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="micro-label">TOTAL OI</span>
                  <span className="text-xs font-mono mono-nums text-foreground">
                    {openInterestContext.openInterest ? `$${formatLargeNumber(openInterestContext.openInterest)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">OI 24H Δ</span>
                  <span className={cn("text-xs font-mono mono-nums font-bold",
                    openInterestContext.oiChangePct24h && openInterestContext.oiChangePct24h > 0 ? "text-primary" : "text-destructive"
                  )}>
                    {formatPercent(openInterestContext.oiChangePct24h)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">FUNDING</span>
                  <span className={cn("text-xs font-mono mono-nums font-bold",
                    openInterestContext.fundingRate && openInterestContext.fundingRate > 0 ? "text-primary" : "text-destructive"
                  )}>
                    {openInterestContext.fundingRate ? `${(openInterestContext.fundingRate * 100).toFixed(4)}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="micro-label">L/S RATIO</span>
                  <span className="text-xs font-mono mono-nums text-foreground">{formatNumber(openInterestContext.longShortRatio)}</span>
                </div>
              </div>
            ) : (
              <div className="micro-label text-muted-foreground/50">NO OI DATA</div>
            )}
          </div>
        </div>
      </div>

      {/* DATA QUALITY & PROVENANCE */}
      {signal.dataQuality && (
        <DataQualityPanel dataQuality={signal.dataQuality as Parameters<typeof DataQualityPanel>[0]["dataQuality"]} />
      )}

      {/* PACKET VERIFICATION */}
      {signal.verificationReport && (
        <VerificationPanel report={signal.verificationReport as unknown as Parameters<typeof VerificationPanel>[0]["report"]} />
      )}

      {/* HERMES CONTEXT */}
      <HermesTargetFindingsPanel target={asset || ""} />

      {/* OUTCOME TRACKING STUB */}
      <div className="terminal-panel border-dashed opacity-50">
        <div className="terminal-panel-header">
          <span>OUTCOME TRACKING</span>
          <span className="chip-warn">SCAFFOLDED</span>
        </div>
        <div className="p-5">
          <p className="font-mono text-[10px] text-center text-muted-foreground uppercase tracking-widest">
            PHASE 3 — PROCESS QUALITY IS RECORDED INDEPENDENTLY OF MARKET OUTCOME.
            OUTCOME RESOLUTION LOOP NOT YET LIVE.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-5 border-t border-border flex flex-col md:flex-row justify-between gap-2 font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest">
        <span>DST — DETERMINISTIC SIGNAL TRADING · NOT AN EXECUTION PLATFORM</span>
        <span>DJZS AUDIT PROTOCOL · NOT FINANCIAL ADVICE</span>
      </div>
    </div>
  );
}
