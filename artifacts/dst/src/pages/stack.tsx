import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Check, X, ShieldCheck, Cpu, Database, Zap, AlertTriangle } from "lucide-react";

function SectionHeader({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="pb-4 border-b border-border mb-6">
      <h2 className="text-base tracking-widest text-foreground">{children}</h2>
      {sub && <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mt-1">{sub}</p>}
    </div>
  );
}

function DoctrineItem({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
      <span className="font-mono text-xs text-muted-foreground leading-tight">{label}</span>
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
  const statusChip: Record<PhaseStatus, string> = {
    LIVE: "chip-pass",
    NEXT: "chip-warn",
    SCAFFOLDED: "chip-neutral",
    PLANNED: "chip-neutral",
  };

  return (
    <div className={cn(
      "terminal-panel flex flex-col md:flex-row md:items-start gap-4 p-4",
      status === "LIVE" ? "border-primary/20" :
      status === "NEXT" ? "border-[hsl(var(--trade-wait))]/20" :
      "border-border"
    )}>
      <div className="w-28 shrink-0">
        <div className="micro-label mb-1.5">{phase}</div>
        <span className={statusChip[status]}>{status}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs font-bold text-foreground tracking-wide mb-0.5 uppercase">{name}</div>
        <div className="font-mono text-[10px] text-muted-foreground mb-1">{role}</div>
        <div className="micro-label text-muted-foreground/50">{tool}</div>
      </div>
      <div className="md:max-w-xs">
        <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{note}</p>
      </div>
    </div>
  );
}

export default function Stack() {
  return (
    <div className="space-y-14 max-w-5xl mx-auto pb-16">

      {/* ── HERO ── */}
      <div className="pb-6 border-b border-border">
        <h1 className="text-xl tracking-widest text-foreground mb-2">THE STACK</h1>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-5">
          WHAT DST IS · WHAT IT IS NOT · WHERE IT FITS IN YOUR WORKFLOW
        </p>
        <p className="font-mono text-xs text-muted-foreground max-w-2xl leading-relaxed">
          DST is an audit-first signal system for perp traders. It does not replace your charting tool, your execution venue, or your market intelligence subscriptions. It replaces the undisciplined part of your pre-trade process — the part where you convince yourself a setup is admissible because you already want to trade it. Every possible trade is run through the DJZS audit layer. WAIT is the most common and most correct output.
        </p>
      </div>

      {/* ── COMPARISON TABLE ── */}
      <div>
        <SectionHeader sub="where dst sits relative to the rest of your toolchain">
          DST VS. THE ALTERNATIVES — AUDIT-FIRST
        </SectionHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border">
          {/* Header Row */}
          <div className="bg-secondary p-4">
            <div className="micro-label">CAPABILITY</div>
          </div>
          <div className="bg-secondary p-4 text-center">
            <div className="font-mono text-sm font-bold text-primary tracking-widest glow-green">DST</div>
            <div className="micro-label text-muted-foreground/60 mt-1">AUDIT-FIRST SIGNALS</div>
          </div>
          <div className="bg-secondary p-4 text-center">
            <div className="font-mono text-sm font-bold text-foreground/70 tracking-widest">CHARTING</div>
            <div className="micro-label text-muted-foreground/60 mt-1">TRADINGVIEW ETC.</div>
          </div>
          <div className="bg-secondary p-4 text-center">
            <div className="font-mono text-sm font-bold text-foreground/70 tracking-widest">EXECUTION</div>
            <div className="micro-label text-muted-foreground/60 mt-1">HYPERLIQUID ETC.</div>
          </div>

          {[
            ["Pre-trade admissibility audit", true, false, false],
            ["Deterministic setup rejection", true, false, false],
            ["Evidence integration workflow", true, false, false],
            ["Explicit WAIT as disciplined outcome", true, false, false],
            ["Machine-readable rejection codes", true, false, false],
            ["R/R and invalidation enforcement", true, true, false],
            ["Live chart visualization", false, true, false],
            ["Draw tools and indicators", false, true, false],
            ["Order execution and fills", false, false, true],
            ["Position management", false, false, true],
            ["Live price feeds (raw)", false, true, true],
            ["Market intelligence / flow data", false, false, false],
          ].map(([label, dst, chart, exec], i) => (
            <div key={i} className="contents">
              <div className={cn("p-3 flex items-center", i % 2 === 0 ? "bg-card" : "bg-background")}>
                <span className="font-mono text-[10px] text-muted-foreground">{label as string}</span>
              </div>
              <div className={cn("p-3 flex justify-center items-center", i % 2 === 0 ? "bg-card" : "bg-background")}>
                {dst ? <Check className="w-3.5 h-3.5 text-primary" /> : <X className="w-3.5 h-3.5 text-muted-foreground/25" />}
              </div>
              <div className={cn("p-3 flex justify-center items-center", i % 2 === 0 ? "bg-card" : "bg-background")}>
                {chart ? <Check className="w-3.5 h-3.5 text-foreground/50" /> : <X className="w-3.5 h-3.5 text-muted-foreground/25" />}
              </div>
              <div className={cn("p-3 flex justify-center items-center", i % 2 === 0 ? "bg-card" : "bg-background")}>
                {exec ? <Check className="w-3.5 h-3.5 text-foreground/50" /> : <X className="w-3.5 h-3.5 text-muted-foreground/25" />}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 p-4 border border-border bg-card flex items-start gap-3">
          <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--trade-wait))] shrink-0 mt-0.5" />
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            DST does not have draw tools, order entry, fills, or raw price chart visualization. It is intentionally narrow. Use TradingView for charts. Use Hyperliquid or equivalent for execution. Use DST to run the audit workflow before you act on any setup.
          </p>
        </div>
      </div>

      {/* ── NOT BUILT FOR ── */}
      <div>
        <SectionHeader sub="intentional product boundaries">
          NOT BUILT FOR
        </SectionHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: "NOT A CHARTING PLATFORM",
              body: "DST does not render price charts, support drawing tools, or provide raw indicator overlays. Your charting tool does that better. DST reads indicators as inputs to the audit workflow — it does not visualize them.",
            },
            {
              title: "NOT AN EXECUTION VENUE",
              body: "DST does not connect to exchange APIs, submit orders, or manage positions. Live trading is explicitly disabled. DST produces an audit verdict: admissible or not. Execution is a separate layer.",
            },
            {
              title: "NOT A GENERAL-PURPOSE INTELLIGENCE PLATFORM",
              body: "DST does not aggregate news, social sentiment, or broad market intelligence. Integrations like Nansen, Hyblock, and Browserbase are narrowly scoped as targeted evidence layers for specific audit rules — not a general data dashboard.",
            },
            {
              title: "NOT A SIGNAL SUBSCRIPTION SERVICE",
              body: "DST does not sell signals or recommend trades. It audits whether a setup you are considering meets the structural and logical conditions required for admissibility. WAIT is the most common and most correct output.",
            },
          ].map((item) => (
            <div key={item.title} className="terminal-panel p-5">
              <div className="font-mono text-xs font-bold text-destructive/70 mb-2 uppercase tracking-wide">{item.title}</div>
              <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── DST ADVANTAGE ── */}
      <div>
        <SectionHeader sub="where dst is stronger than everything else in your stack">
          STRONGER HERE — THE AUDIT ADVANTAGE
        </SectionHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: ShieldCheck,
              title: "PRE-TRADE AUDIT DISCIPLINE",
              body: "Every possible trade is run through a mandatory audit checklist: thesis, regime, entry zone, invalidation, target, R/R, reason codes, reject conditions. A setup cannot be admissible until every field is accounted for.",
            },
            {
              icon: Database,
              title: "EVIDENCE-FIRST INTEGRATION",
              body: "DST integrates DefiLlama market data as the primary layer, real OKX perpetuals data (OI, funding, long-short ratio), Pyth price confidence, and structured technical regime into a single audit verdict. Each data point either reinforces admissibility or triggers a rejection code.",
            },
            {
              icon: Zap,
              title: "DETERMINISTIC AUDIT TRAIL",
              body: "DJZS produces a machine-readable audit verdict that is never overridden by narrative or manual input. Every WAIT or rejection has an explicit rejection code. Every approved setup has a process quality grade.",
            },
          ].map((item) => (
            <div key={item.title} className="terminal-panel border-primary/20 p-5">
              <item.icon className="w-4 h-4 text-primary mb-3" />
              <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wide mb-2">{item.title}</div>
              <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── ARCHITECTURE ROADMAP ── */}
      <div>
        <SectionHeader sub="phased integration stack — narrow, intentional, evidence-first">
          ARCHITECTURE ROADMAP
        </SectionHeader>
        <div className="space-y-px">
          <StackLayer
            phase="CORE"
            name="DefiLlama · Signal Engine"
            role="Primary data layer — market data, regime detection, technical indicators, pre-trade checklist"
            tool="DEFILAMMA COINS + DEFILLAMA API · FREE · NO KEY"
            status="LIVE"
            note="Provides 4H price history, EMA/RSI/MACD/ATR, regime classification, and market snapshot for every scan. First and non-negotiable data layer. Cannot be disabled."
          />
          <StackLayer
            phase="CORE"
            name="DJZS Audit Engine"
            role="Deterministic audit gate — rules setups in or out, never scores or predicts"
            tool="INTERNAL · NO EXTERNAL API"
            status="LIVE"
            note="Every setup produced by DST passes through the DJZS audit layer. Verdict is final. DJZS does not produce trading signals — it produces admissibility verdicts with machine-readable rejection codes."
          />
          <StackLayer
            phase="CORE"
            name="Hermes Orchestration Runtime"
            role="Scan scheduler, constraint enforcement, job tracking, alert routing"
            tool="INTERNAL · RUNS ON API SERVER"
            status="LIVE"
            note="Hermes manages the scan loop, enforces system constraints (timeframe, R/R threshold, wait bias policy), and routes approved signals when delivery channels are configured."
          />
          <StackLayer
            phase="PHASE 3"
            name="Pyth Network · Hermes REST"
            role="Live price confidence interval — degrades processVerdict when confidence is low"
            tool="PYTH HERMES REST API · FREE · NO KEY REQUIRED"
            status="LIVE"
            note="Live BTC/ETH/SOL prices and confidence ratios. When enabled in Hermes constraints, low-confidence prices degrade APPROVED signals to DEGRADED. Audit-side verifier — separate from the real-time ticker below."
          />
          <StackLayer
            phase="PHASE 3"
            name="Pyth Lazer Stream"
            role="Sub-second real-time price ticker on the dashboard — passive, additive, never feeds the audit"
            tool="PYTH LAZER WEBSOCKET SDK · REQUIRES PYTH_LAZER_API_KEY"
            status="LIVE"
            note="Singleton WebSocket subscribes to BTC/ETH/SOL at fixed_rate@200ms. Latest tick held in memory only — no DB persistence. Powers the live ticker panel and the Δ PYTH divergence chip on each asset card. Signal engine and DJZS are unaffected whether this is configured or not."
          />
          <StackLayer
            phase="PHASE 3"
            name="OKX Perpetuals"
            role="Real OI / funding rate / long-short ratio — drives the previously-dormant audit gates"
            tool="OKX PUBLIC PERPS API · FREE · NO KEY"
            status="LIVE"
            note="Real open interest, funding rate, and long-short account ratio for BTC/ETH/SOL via OKX public endpoints. 5-minute per-asset cache; falls through to a synthetic block on geo-block / network failure so signals never depend on OKX availability. When real data flows, OIContext.dataConfidence flips to REAL and the OI_CONTEXT audit, narrative-OI opposition, and CROWDING_TOO_HIGH gates begin contributing — all three were dormant before."
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
            role="Liquidation heatmap and CVD enrichment on top of OKX OI data"
            tool="HYBLOCK API · PAID"
            status="PLANNED"
            note="Refines the OKX-sourced OI context with liquidation cluster and CVD signals. OI and funding are already real via OKX — Hyblock adds microstructure detail for entry-quality scoring, not raw OI itself."
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
            role="Institutional positioning enrichment on top of retail-side OKX L/S ratio"
            tool="MPP API · PAID"
            status="PLANNED"
            note="OKX already supplies a long-short account ratio for retail flow. MPP adds an institutional-side view of crowding and dominant positioning to refine the audit's crowding assessment."
          />
        </div>
      </div>

      {/* ── HERMES MODULE PLAN ── */}
      <div>
        <SectionHeader sub="hermes as the runtime layer around dst and djzs">
          HERMES MODULE PLAN
        </SectionHeader>

        <div className="space-y-4">
          {/* Intro */}
          <p className="font-mono text-[10px] text-muted-foreground max-w-2xl leading-relaxed">
            Hermes is the always-on operator shell around DST and DJZS. It does not produce signals. It does not issue verdicts. It schedules scans, manages constraints, ingests evidence, hands off to the DJZS audit gate, and routes approved packets. The authority boundary is absolute and by design.
          </p>

          {/* CORE RUNTIME */}
          <div className="terminal-panel border-primary/20 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">CORE RUNTIME</div>
                <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 uppercase">Required — must be operational</div>
              </div>
              <span className="chip-pass">LIVE</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { cap: "SCAN SCHEDULING", note: "Manages the scan loop. Manual trigger in Phase 3. Autonomous scheduler is scaffolded." },
                { cap: "EVIDENCE INGRESS", note: "POST /hermes/findings accepts structured findings from any agent. Idempotent by findingId." },
                { cap: "AUDIT HANDOFF", note: "Each scan job submits to DJZS as a discrete phase. Hermes does not influence the verdict." },
                { cap: "ALERT ROUTING", note: "Routes APPROVED packets to configured delivery channels after the DJZS gate fires." },
                { cap: "WEBHOOK SUBSCRIPTIONS", note: "Inbound push endpoints for price alerts and flow signals. Scaffolded — Phase 4." },
                { cap: "RUNTIME MANAGEMENT", note: "Constraints are persisted and enforced on every scan. Controls all durable Hermes behavior." },
              ].map((c) => (
                <div key={c.cap} className="flex items-start gap-2">
                  <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-[10px] font-bold text-foreground uppercase">{c.cap}</div>
                    <div className="font-mono text-[9px] text-muted-foreground leading-relaxed mt-0.5">{c.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* REQUIRED SKILLS + OPTIONAL SKILLS side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* REQUIRED SKILLS */}
            <div className="terminal-panel p-5 space-y-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">REQUIRED SKILLS</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 uppercase">Active or scaffolded in Phase 3</div>
                </div>
                <span className="chip-warn">PHASE 3</span>
              </div>
              {[
                { name: "DEFILAMMA DATA READER", status: "ACTIVE", note: "Market data, regime, indicators — primary data layer" },
                { name: "DJZS AUDIT INTERFACE", status: "ACTIVE", note: "Submits DST proposals to the audit gate, reads verdict" },
                { name: "PYTH CONFIDENCE READER", status: "OPTIONAL", note: "Live price confidence overlay — no key required" },
                { name: "CONSTRAINTS ENFORCER", status: "ACTIVE", note: "Applies minRR, timeframe, waitBias on every scan" },
                { name: "OKX PERPS READER", status: "ACTIVE", note: "Real OI / funding / long-short ratio — drives crowding and OI gates" },
                { name: "JOB TRACKER", status: "ACTIVE", note: "Tracks phases (DEFILAMMA → OKX → PYTH → DJZS → ROUTING) per job" },
                { name: "FINDING INGESTER", status: "ACTIVE", note: "Accepts structured evidence from external agents" },
              ].map((s) => (
                <div key={s.name} className="flex items-start gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 mt-1.5",
                    s.status === "ACTIVE" ? "bg-primary" : "bg-[hsl(var(--trade-wait))]"
                  )} />
                  <div>
                    <div className="font-mono text-[10px] font-bold text-foreground uppercase">{s.name}</div>
                    <div className="font-mono text-[9px] text-muted-foreground">{s.note}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* OPTIONAL SKILLS */}
            <div className="terminal-panel p-5 space-y-3 opacity-80">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">OPTIONAL SKILLS</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 uppercase">Off by default — Phase 4+</div>
                </div>
                <span className="chip-neutral">PHASE 4+</span>
              </div>
              {[
                { name: "BROWSER RESEARCH", note: "Triggered narrative check via Browserbase — APPROVED_ONLY policy" },
                { name: "TELEGRAM ROUTING", note: "ACTIVE — delivers APPROVED signals via TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, dedup'd per asset+packetHash" },
                { name: "EMAIL ROUTING", note: "ACTIVE — delivers APPROVED signals via AGENTMAIL_API_KEY + AGENTMAIL_TO (inbox auto-resolved), dedup'd per asset+packetHash" },
                { name: "XMTP ROUTING", note: "Wallet-to-wallet delivery — requires XMTP_PRIVATE_KEY" },
                { name: "DISCORD ROUTING", note: "Channel delivery — requires DISCORD_WEBHOOK_URL" },
                { name: "CODEBASE INSPECTION", note: "MCP extension — read DST/DJZS rules for constraint diagnostics" },
                { name: "CODING HELPERS", note: "MCP extension — propose constraint changes as human-reviewed diffs" },
              ].map((s) => (
                <div key={s.name} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 border border-muted-foreground/30 shrink-0 mt-1.5" />
                  <div>
                    <div className="font-mono text-[10px] font-bold text-muted-foreground uppercase">{s.name}</div>
                    <div className="font-mono text-[9px] text-muted-foreground/70">{s.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MCP + PORTAL row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="terminal-panel p-5 opacity-70">
              <div className="flex items-start justify-between mb-3">
                <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">MCP — CONTROLLED EXTENSION LAYER</div>
                <span className="chip-neutral text-[9px]">PHASE 5</span>
              </div>
              <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                MCP tools are a later controlled extension. In Phase 3, MCP is not active and not required. When activated in Phase 5, MCP tools will run under strict human-approval gating — no autonomous write actions. Planned tools: codebase reader (read-only), diff proposer (approval required), web researcher (APPROVED_ONLY policy).
              </p>
            </div>
            <div className="terminal-panel p-5 opacity-70">
              <div className="flex items-start justify-between mb-3">
                <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">NOUS PORTAL — OPTIONAL PROVIDER</div>
                <span className="chip-neutral text-[9px]">OPTIONAL</span>
              </div>
              <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                Nous Portal is an optional LLM provider backend for any agent-assisted Hermes capabilities (research summarization, finding interpretation). It is not a runtime dependency. DST, DJZS, and all core Hermes functions operate without it. Can be swapped for any compatible inference endpoint. No Nous dependency is baked into Phase 3 architecture.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKFLOW ── */}
      <div>
        <SectionHeader sub="recommended usage pattern">
          WHERE DST FITS IN YOUR WORKFLOW
        </SectionHeader>
        <div className="terminal-panel">
          <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
            {[
              { step: "1", label: "IDENTIFY", tool: "Charting tool", desc: "You identify a possible setup on your chart — structure, liquidity, HTF context." },
              { step: "2", label: "ADMIT", tool: "DST + DJZS", desc: "Run the setup through DST. Check the audit packet: does it meet entry, invalidation, target, R/R, and regime requirements?" },
              { step: "3", label: "GATE", tool: "DJZS audit", desc: "DJZS audits it: ADMISSIBLE or not. If INADMISSIBLE or REJECTED, stop. The audit found a structural flaw." },
              { step: "4", label: "ROUTE", tool: "Hermes", desc: "If APPROVED, Hermes routes the signal to your configured delivery channel — or you see it on the dashboard." },
              { step: "5", label: "EXECUTE", tool: "Exchange", desc: "You execute on your preferred venue. DST has already done its job — it audited whether this was worth acting on." },
            ].map((step) => (
              <div key={step.step} className="p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border border-primary/40 flex items-center justify-center font-mono text-[10px] text-primary font-bold">
                    {step.step}
                  </div>
                  <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">{step.label}</div>
                </div>
                <div className="micro-label text-primary/60">{step.tool}</div>
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DOCTRINE ── */}
      <div className="terminal-panel p-6">
        <div className="flex items-start gap-4">
          <Cpu className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-mono text-xs font-bold text-foreground uppercase tracking-widest mb-4">OPERATING DOCTRINE</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <DoctrineItem label="WAIT is the default when any required field is missing" />
              <DoctrineItem label="DJZS audit verdict is never overridden by narrative or manual input" />
              <DoctrineItem label="Every rejection has a machine-readable code" />
              <DoctrineItem label="Process quality is graded independently of market outcome" />
              <DoctrineItem label="No live trading — paper mode only until Phase 6" />
              <DoctrineItem label="Integrations are narrowly scoped to admissibility evidence" />
              <DoctrineItem label="Hermes constraints are durable policy, not user preferences" />
              <DoctrineItem label="Pyth degrades but never approves — it can only reduce confidence" />
              <DoctrineItem label="DefiLlama is the primary data layer — always first, always required" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-5 border-t border-border flex flex-col md:flex-row justify-between gap-2 font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest">
        <span>DST V1.0.0 — PHASE 3 LIVE · AUDIT-FIRST SIGNAL SYSTEM</span>
        <Link href="/" className="text-primary/70 hover:text-primary transition-colors">← BACK TO DASHBOARD</Link>
      </div>
    </div>
  );
}
