import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Check, X, ShieldCheck, Cpu, Database, Zap, Radio, AlertTriangle } from "lucide-react";

function SectionHeader({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="pb-4 border-b border-border mb-6">
      <h2 className="text-xl font-display text-foreground">{children}</h2>
      {sub && <p className="text-muted-foreground font-mono text-xs uppercase mt-1">{sub}</p>}
    </div>
  );
}

function CompareCell({ yes, label }: { yes: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {yes ? (
        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
      ) : (
        <X className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
      )}
      <span className={cn("font-mono text-xs leading-tight", yes ? "text-foreground" : "text-muted-foreground/50")}>{label}</span>
    </div>
  );
}

type PhaseStatus = "LIVE" | "NEXT" | "SCAFFOLDED" | "PLANNED";

function StackLayer({
  phase,
  name,
  role,
  tool,
  status,
  note,
}: {
  phase: string;
  name: string;
  role: string;
  tool: string;
  status: PhaseStatus;
  note: string;
}) {
  const statusStyle: Record<PhaseStatus, string> = {
    LIVE: "text-primary border-primary/40 bg-primary/5",
    NEXT: "text-[hsl(var(--trade-wait))] border-[hsl(var(--trade-wait))]/40 bg-[hsl(var(--trade-wait))]/5",
    SCAFFOLDED: "text-muted-foreground border-border bg-card",
    PLANNED: "text-muted-foreground/50 border-border/40 bg-transparent",
  };

  return (
    <div className={cn(
      "border p-4 flex flex-col md:flex-row md:items-start gap-4",
      status === "LIVE" ? "border-primary/20 bg-primary/3" :
      status === "NEXT" ? "border-[hsl(var(--trade-wait))]/20" :
      "border-border"
    )}>
      <div className="w-20 shrink-0">
        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">{phase}</div>
        <div className={cn("inline-block border px-2 py-0.5 font-mono text-[10px] uppercase", statusStyle[status])}>
          {status}
        </div>
      </div>
      <div className="flex-1">
        <div className="font-display text-sm text-foreground mb-0.5">{name}</div>
        <div className="font-mono text-xs text-muted-foreground mb-1">{role}</div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase">{tool}</div>
      </div>
      <div className="md:max-w-xs">
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">{note}</p>
      </div>
    </div>
  );
}

export default function Stack() {
  return (
    <div className="space-y-16 max-w-5xl mx-auto pb-16">

      {/* ── HERO ── */}
      <div className="pb-6 border-b border-border">
        <h1 className="text-3xl font-display text-foreground mb-2">THE STACK</h1>
        <p className="font-mono text-xs uppercase text-muted-foreground mb-4">
          WHAT DST IS · WHAT IT IS NOT · WHERE IT FITS IN YOUR WORKFLOW
        </p>
        <p className="text-body max-w-2xl leading-relaxed text-muted-foreground">
          DST is a deterministic decision layer for perp traders. It does not replace your charting tool, your execution venue, or your market intelligence subscriptions. It replaces the undisciplined part of your pre-trade process — the part where you convince yourself a setup is good because you already want to trade it.
        </p>
      </div>

      {/* ── POSITIONING COMPARISON ── */}
      <div>
        <SectionHeader sub="where dst sits relative to the rest of your toolchain">
          DECISION LAYER VS. THE ALTERNATIVES
        </SectionHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border">
          {/* Header Row */}
          <div className="bg-secondary p-4">
            <div className="font-mono text-xs text-muted-foreground uppercase">CAPABILITY</div>
          </div>
          <div className="bg-secondary p-4 text-center">
            <div className="font-display text-sm text-primary">DST</div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase mt-0.5">DECISION LAYER</div>
          </div>
          <div className="bg-secondary p-4 text-center">
            <div className="font-display text-sm text-foreground">CHARTING</div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase mt-0.5">TRADINGVIEW ETC.</div>
          </div>
          <div className="bg-secondary p-4 text-center">
            <div className="font-display text-sm text-foreground">EXECUTION</div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase mt-0.5">HYPERLIQUID ETC.</div>
          </div>

          {/* Rows */}
          {[
            ["Pre-trade admissibility gate", true, false, false],
            ["Deterministic setup rejection", true, false, false],
            ["Evidence integration workflow", true, false, false],
            ["Explicit WAIT as disciplined outcome", true, false, false],
            ["Rejection code audit trail", true, false, false],
            ["R/R and invalidation enforcement", true, true, false],
            ["Live chart visualization", false, true, false],
            ["Draw tools and indicators", false, true, false],
            ["Order execution and fills", false, false, true],
            ["Position management", false, false, true],
            ["Live price feeds (raw)", false, true, true],
            ["Market intelligence / flow data", false, false, false],
          ].map(([label, dst, chart, exec], i) => (
            <div key={i} className="contents">
              <div className={cn("bg-card p-3 flex items-center", i % 2 === 0 ? "" : "bg-background")}>
                <span className="font-mono text-xs text-muted-foreground">{label as string}</span>
              </div>
              <div className={cn("p-3 flex justify-center items-center", i % 2 === 0 ? "bg-card" : "bg-background")}>
                {dst ? <Check className="w-4 h-4 text-primary" /> : <X className="w-4 h-4 text-muted-foreground/30" />}
              </div>
              <div className={cn("p-3 flex justify-center items-center", i % 2 === 0 ? "bg-card" : "bg-background")}>
                {chart ? <Check className="w-4 h-4 text-foreground/60" /> : <X className="w-4 h-4 text-muted-foreground/30" />}
              </div>
              <div className={cn("p-3 flex justify-center items-center", i % 2 === 0 ? "bg-card" : "bg-background")}>
                {exec ? <Check className="w-4 h-4 text-foreground/60" /> : <X className="w-4 h-4 text-muted-foreground/30" />}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 border border-border bg-card">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--trade-wait))] shrink-0 mt-0.5" />
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              DST does not have draw tools, order entry, fills, or raw price chart visualization. It is intentionally narrow. Use TradingView for charts. Use Hyperliquid or equivalent for execution. Use DST to decide whether a trade is admissible before you act on it.
            </p>
          </div>
        </div>
      </div>

      {/* ── WHAT DST IS NOT ── */}
      <div>
        <SectionHeader sub="intentional product boundaries">
          NOT BUILT FOR
        </SectionHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: "NOT A CHARTING PLATFORM",
              body: "DST does not render price charts, support drawing tools, or provide raw indicator overlays. Your charting tool does that better. DST reads indicators as inputs to its admissibility workflow — it does not visualize them.",
            },
            {
              title: "NOT AN EXECUTION VENUE",
              body: "DST does not connect to exchange APIs, submit orders, or manage positions. Live trading is explicitly disabled. DST outputs a decision: admissible or not. Execution is a separate layer.",
            },
            {
              title: "NOT A GENERAL-PURPOSE INTELLIGENCE PLATFORM",
              body: "DST does not aggregate news, social sentiment, or broad market intelligence. Integrations like Nansen, Hyblock, and Browserbase are scaffolded as targeted evidence layers for specific admissibility rules — not as a general data dashboard.",
            },
            {
              title: "NOT A SIGNAL SUBSCRIPTION SERVICE",
              body: "DST does not sell signals or recommend trades. It determines whether a setup you are considering meets the structural and logical conditions required for admissibility. WAIT is the most common and most correct output.",
            },
          ].map((item) => (
            <div key={item.title} className="border border-border bg-card p-5">
              <div className="font-display text-sm text-destructive/80 mb-2">{item.title}</div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── DST'S ADVANTAGE ── */}
      <div>
        <SectionHeader sub="where dst is stronger than everything else in your stack">
          STRONGER HERE
        </SectionHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: ShieldCheck,
              title: "PRE-TRADE DISCIPLINE",
              body: "Every possible trade is run through a mandatory pre-trade checklist: thesis, regime, entry zone, invalidation, target, R/R, reason codes, reject conditions. A setup cannot be presented as tradeable until every field is accounted for.",
            },
            {
              icon: Database,
              title: "EVIDENCE INTEGRATION",
              body: "DST integrates DefiLlama market data, Pyth price confidence, and structured technical regime into a single admissibility verdict. Each data point either reinforces the gate or triggers a rejection code — not a chart overlay.",
            },
            {
              icon: Zap,
              title: "DETERMINISTIC AUDIT TRAIL",
              body: "DJZS produces a machine-readable audit verdict that is never overridden by narrative or manual override. Every WAIT or rejection has an explicit rejection code. Every setup that passes has a process quality grade.",
            },
          ].map((item) => (
            <div key={item.title} className="border border-primary/20 bg-primary/3 p-5">
              <item.icon className="w-5 h-5 text-primary mb-3" />
              <div className="font-display text-sm text-foreground mb-2">{item.title}</div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── ARCHITECTURE STACK ROADMAP ── */}
      <div>
        <SectionHeader sub="phased integration stack — narrow, intentional, evidence-first">
          ARCHITECTURE ROADMAP
        </SectionHeader>

        <div className="space-y-px">
          <StackLayer
            phase="CORE"
            name="DefiLlama · Signal Engine"
            role="Market data, regime detection, technical indicators, pre-trade checklist"
            tool="DEFILAMMA COINS + DEFILLAMA API · FREE · NO KEY"
            status="LIVE"
            note="Primary data layer. Provides 4H price history, EMA/RSI/MACD/ATR, regime classification, and market snapshot for every scan. Cannot be disabled."
          />
          <StackLayer
            phase="CORE"
            name="DJZS Admissibility Engine"
            role="Deterministic audit gate — rules setups in or out, never scores or predicts"
            tool="INTERNAL · NO EXTERNAL API"
            status="LIVE"
            note="Every setup produced by DST passes through the DJZS audit layer. Verdict is final. DJZS does not produce trading signals — it produces admissibility decisions."
          />
          <StackLayer
            phase="CORE"
            name="Hermes Orchestration Runtime"
            role="Scan scheduler, constraint enforcement, job tracking, alert routing"
            tool="INTERNAL · RUNS ON API SERVER"
            status="LIVE"
            note="Hermes manages the scan loop, enforces system constraints (timeframe, R/R threshold, wait bias policy), and will route approved signals when delivery channels are configured."
          />
          <StackLayer
            phase="PHASE 3"
            name="Pyth Network"
            role="Live price confidence interval — degrades processVerdict when confidence is low"
            tool="PYTH HERMES REST API · FREE · NO KEY REQUIRED"
            status="LIVE"
            note="Live BTC/ETH/SOL prices and confidence ratios. When Pyth confidence filter is enabled in Hermes constraints, low-confidence prices degrade APPROVED signals to DEGRADED."
          />
          <StackLayer
            phase="PHASE 4"
            name="Browserbase"
            role="Triggered web research — narrative check on high-interest setups before approval"
            tool="BROWSERBASE API · REQUIRES BROWSERBASE_API_KEY"
            status="SCAFFOLDED"
            note="Will be triggered on APPROVED_ONLY or HIGH_CONFIDENCE setups when configured. Adds a web research phase to the Hermes scan job. Not yet connected."
          />
          <StackLayer
            phase="PHASE 4"
            name="Telegram · XMTP · Discord"
            role="Alert delivery — routes approved signals to configured channels"
            tool="BOT TOKEN / PRIVATE KEY / WEBHOOK URL REQUIRED"
            status="SCAFFOLDED"
            note="Delivery layer for APPROVED signals. Configured via Hermes alert routing settings. All three channels are scaffolded — none are connected until keys are provided."
          />
          <StackLayer
            phase="PHASE 5"
            name="Hyblock"
            role="OI delta, liquidation heatmap, and CVD enrichment for entry quality scoring"
            tool="HYBLOCK API · PAID"
            status="PLANNED"
            note="Will enrich the open interest context used by the admissibility gate. Replaces synthetic OI estimates with real liquidation cluster and CVD data."
          />
          <StackLayer
            phase="PHASE 5"
            name="Nansen"
            role="On-chain smart money flow enrichment for narrative admissibility"
            tool="NANSEN API · PAID"
            status="PLANNED"
            note="Will add smart money flow signals to the narrative risk assessment layer. Helps distinguish momentum backed by structural flow from pure narrative-driven setups."
          />
          <StackLayer
            phase="PHASE 5"
            name="MPP (Institutional Flow)"
            role="Institutional positioning enrichment"
            tool="MPP API · PAID"
            status="PLANNED"
            note="Enrichment layer for crowding risk and dominant side assessment. Will replace synthetic long/short ratio estimates with real institutional flow data."
          />
        </div>
      </div>

      {/* ── HOW TO USE DST IN YOUR WORKFLOW ── */}
      <div>
        <SectionHeader sub="recommended usage pattern">
          WHERE DST FITS IN YOUR WORKFLOW
        </SectionHeader>

        <div className="border border-border bg-card">
          <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
            {[
              { step: "1", label: "IDENTIFY", tool: "Charting tool", desc: "You identify a possible setup on your chart — structure, liquidity, HTF context." },
              { step: "2", label: "ADMIT", tool: "DST + DJZS", desc: "Run the setup through DST. Check the trade packet: does it meet entry, invalidation, target, R/R, and regime requirements?" },
              { step: "3", label: "GATE", tool: "DJZS audit", desc: "DJZS rules it ADMISSIBLE or not. If INADMISSIBLE or REJECTED, stop. The process has found a structural flaw." },
              { step: "4", label: "ROUTE", tool: "Hermes", desc: "If APPROVED, Hermes routes the signal to your configured delivery channel — or you see it on the dashboard." },
              { step: "5", label: "EXECUTE", tool: "Exchange", desc: "You execute on your preferred venue. DST has already done its job — it decided whether this was worth acting on." },
            ].map((step) => (
              <div key={step.step} className="p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border border-primary/40 flex items-center justify-center font-mono text-[10px] text-primary">{step.step}</div>
                  <div className="font-display text-xs text-foreground">{step.label}</div>
                </div>
                <div className="text-[10px] font-mono uppercase text-primary/70">{step.tool}</div>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DOCTRINE ── */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <Cpu className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-display text-sm text-foreground mb-2">OPERATING DOCTRINE</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <CompareCell yes label="WAIT is the default when any required field is missing" />
              <CompareCell yes label="DJZS verdict is never overridden by narrative or manual input" />
              <CompareCell yes label="Every rejection has a machine-readable code" />
              <CompareCell yes label="Process quality is graded independently of market outcome" />
              <CompareCell yes label="No live trading — paper mode only until Phase 6" />
              <CompareCell yes label="Integrations are narrowly scoped to admissibility evidence" />
              <CompareCell yes label="Hermes constraints are durable policy, not user preferences" />
              <CompareCell yes label="Pyth degrades but never approves — it can only reduce confidence" />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border flex flex-col md:flex-row justify-between text-xs font-mono text-muted-foreground uppercase">
        <div>DST V1.0.0 — PHASE 3 LIVE</div>
        <Link href="/" className="text-primary hover:underline">← BACK TO DASHBOARD</Link>
      </div>
    </div>
  );
}
