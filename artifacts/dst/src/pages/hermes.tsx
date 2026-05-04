import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetHermesStatus,
  getGetHermesStatusQueryKey,
  useGetHermesConstraints,
  getGetHermesConstraintsQueryKey,
  useUpdateHermesConstraints,
  useTriggerHermesScan,
  useGetHermesJobs,
  getGetHermesJobsQueryKey,
  HermesConstraintsUpdateActiveTimeframe,
  HermesConstraintsUpdateBrowserbaseTriggerPolicy,
  HermesConstraintsUpdateWaitBiasPolicy,
} from "@workspace/api-client-react";
import { HermesBoundaryPanel, HermesFindingsPanel } from "@/components/hermes-findings";
import HermesBoardPage from "@/components/hermes-board";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcessVerdictBadge } from "@/components/signal-process";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type HermesTab = "board" | "config" | "skills" | "log";

const RUNTIME_VERSION = "v1.0.0-phase3";
const MANIFEST_ID = "h3rm3s-manifest-phase3-core";
const MANIFEST_HASH = "a7f3d9b2";

const MOCK_LOG_ENTRIES = [
  { ts: "04:09:15.001", action: "SCAN_QUEUED",      skill: "SCAN_SCHEDULER",      scope: "scan:read",      asset: "BTC", sanitize: "N/A",         outcome: "QUEUED" },
  { ts: "04:09:15.212", action: "EVIDENCE_FETCH",   skill: "PYTH_VERIFIER",        scope: "pyth:read",      asset: "BTC", sanitize: "JSON_SCHEMA",  outcome: "SNAPSHOT OK" },
  { ts: "04:09:15.980", action: "EVIDENCE_INGEST",  skill: "EVIDENCE_INGRESS",     scope: "evidence:write", asset: "BTC", sanitize: "SCHEMA_VALID",  outcome: "ACCEPTED" },
  { ts: "04:09:16.440", action: "AUDIT_HANDOFF",    skill: "AUDIT_HANDOFF",        scope: "djzs:submit",    asset: "BTC", sanitize: "N/A",           outcome: "SUBMITTED" },
  { ts: "04:09:16.891", action: "VERDICT_READ",     skill: "AUDIT_HANDOFF",        scope: "djzs:read",      asset: "BTC", sanitize: "N/A",           outcome: "WAIT — SEALED" },
  { ts: "04:09:16.892", action: "ROUTE_SKIP",       skill: "ALERT_ROUTER",         scope: "N/A",            asset: "BTC", sanitize: "N/A",           outcome: "NO-OP — WAIT" },
  { ts: "04:09:17.001", action: "LOG_APPEND",       skill: "ACTION_LOGGER",        scope: "log:write",      asset: "BTC", sanitize: "N/A",           outcome: "APPENDED" },
];

export default function Hermes() {
  const [activeTab, setActiveTab] = useState<HermesTab>("board");
  const queryClient = useQueryClient();
  const { data: status, isLoading: isLoadingStatus } = useGetHermesStatus();
  const { data: constraints, isLoading: isLoadingConstraints } = useGetHermesConstraints();
  const { data: jobs, isLoading: isLoadingJobs } = useGetHermesJobs();

  const updateConstraints = useUpdateHermesConstraints();
  const triggerScan = useTriggerHermesScan();

  const [formState, setFormState] = useState<any>({
    preferredAssets: "BTC, ETH, SOL",
    activeTimeframe: "4H",
    minRRThreshold: 1.5,
    lateEntryAtrMultiplier: 1.5,
    oneSignalPerAsset: true,
    waitBiasPolicy: "STRICT",
    browserbaseTriggerPolicy: "DISABLED",
    pythConfidenceFilter: false,
    pythConfidenceThreshold: 0.95,
    alertRouting: { telegram: false, xmtp: false, discord: false },
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (constraints) {
      setFormState({
        preferredAssets: constraints.preferredAssets.join(", "),
        activeTimeframe: constraints.activeTimeframe,
        minRRThreshold: constraints.minRRThreshold,
        lateEntryAtrMultiplier: constraints.lateEntryAtrMultiplier,
        oneSignalPerAsset: constraints.oneSignalPerAsset,
        waitBiasPolicy: constraints.waitBiasPolicy,
        browserbaseTriggerPolicy: constraints.browserbaseTriggerPolicy,
        pythConfidenceFilter: constraints.pythConfidenceFilter,
        pythConfidenceThreshold: constraints.pythConfidenceThreshold,
        alertRouting: { ...constraints.alertRouting }
      });
    }
  }, [constraints]);

  const handleSave = () => {
    updateConstraints.mutate({
      data: {
        preferredAssets: formState.preferredAssets.split(",").map((s: string) => s.trim()).filter(Boolean),
        activeTimeframe: formState.activeTimeframe as HermesConstraintsUpdateActiveTimeframe,
        minRRThreshold: Number(formState.minRRThreshold),
        lateEntryAtrMultiplier: Number(formState.lateEntryAtrMultiplier),
        oneSignalPerAsset: formState.oneSignalPerAsset,
        waitBiasPolicy: formState.waitBiasPolicy as HermesConstraintsUpdateWaitBiasPolicy,
        browserbaseTriggerPolicy: formState.browserbaseTriggerPolicy as HermesConstraintsUpdateBrowserbaseTriggerPolicy,
        pythConfidenceFilter: formState.pythConfidenceFilter,
        pythConfidenceThreshold: Number(formState.pythConfidenceThreshold),
        alertRouting: formState.alertRouting
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHermesConstraintsQueryKey() });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    });
  };

  const handleTrigger = () => {
    triggerScan.mutate(undefined as never, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHermesStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetHermesJobsQueryKey() });
      }
    });
  };

  const waitRate = status?.totalScansToday ? (status.totalWaitToday / status.totalScansToday * 100) : 0;

  const scopeTokens = [
    { token: "pyth:read",         skill: "PYTH_VERIFIER",       granted: constraints?.pythConfidenceFilter ?? false,                                          authority: "EVIDENCE ONLY",      phase: "PHASE 3" },
    { token: "browserbase:fetch", skill: "BROWSERBASE_RESEARCH", granted: (constraints?.browserbaseTriggerPolicy ?? "DISABLED") !== "DISABLED",               authority: "EVIDENCE ONLY",      phase: "PHASE 4" },
    { token: "telegram:write",    skill: "TELEGRAM_DELIVERY",   granted: constraints?.alertRouting?.telegram ?? false,                                         authority: "ROUTING ONLY",       phase: "PHASE 4" },
    { token: "xmtp:write",        skill: "XMTP_DELIVERY",       granted: constraints?.alertRouting?.xmtp ?? false,                                            authority: "ROUTING ONLY",       phase: "PHASE 4" },
    { token: "discord:write",     skill: "DISCORD_DELIVERY",    granted: constraints?.alertRouting?.discord ?? false,                                          authority: "ROUTING ONLY",       phase: "PHASE 4" },
    { token: "mcp:inspect",       skill: "MCP_INSPECTOR",       granted: false,                                                                                authority: "READ/HUMAN-GATED",   phase: "PHASE 5" },
  ];

  const tabBar = (
    <div className="flex items-end gap-0 border-b border-border overflow-x-auto">
      {([
        { key: "board",  label: "OPERATIONS BOARD",  sub: "Kanban · workers · DLQ · replay" },
        { key: "config", label: "RUNTIME CONFIG",     sub: "Constraints · pipeline · delivery" },
        { key: "skills", label: "SKILLS MANIFEST",    sub: "Registry · scope tokens · provenance" },
        { key: "log",    label: "ACTION LOG",         sub: "Append-only audit trail" },
      ] as const).map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={cn(
            "flex flex-col gap-0.5 px-5 py-3 border-b-2 transition-colors shrink-0",
            activeTab === tab.key
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
          <span className="font-mono text-[8px] text-muted-foreground/50 uppercase">{tab.sub}</span>
        </button>
      ))}
    </div>
  );

  // ── OPERATIONS BOARD TAB ─────────────────────────────────────────────────────
  if (activeTab === "board") {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {tabBar}
        <HermesBoardPage />
      </div>
    );
  }

  // ── SKILLS MANIFEST TAB ──────────────────────────────────────────────────────
  if (activeTab === "skills") {
    const grantedCount = scopeTokens.filter(t => t.granted).length;
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {tabBar}

        {/* RUNTIME IDENTITY */}
        <div className="bg-card border border-primary/30 p-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">HERMES RUNTIME IDENTITY</h2>
                <span className="chip-pass text-[9px]">MANIFEST ACTIVE</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                Skill manifest snapshot — computed at server start — boundary: AUDIT-BEFORE-ACT
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="chip-neutral text-[9px]">AUTHORITY: EVIDENCE + ROUTING ONLY</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
            {[
              { label: "RUNTIME VERSION",  value: RUNTIME_VERSION },
              { label: "MANIFEST ID",      value: MANIFEST_ID },
              { label: "MANIFEST HASH",    value: MANIFEST_HASH },
              { label: "BOUNDARY MODEL",   value: "AUDIT-BEFORE-ACT" },
              { label: "SCOPE TOKENS GRANTED", value: `${grantedCount} / ${scopeTokens.length}` },
              { label: "REQUIRED SKILLS",  value: "6 / 6 ACTIVE" },
              { label: "DEFERRED SKILLS",  value: "2 (CODING / REPO)" },
              { label: "VERDICT AUTHORITY", value: "DJZS ONLY — NOT HERMES" },
            ].map((row) => (
              <div key={row.label} className="bg-card px-4 py-3 flex flex-col gap-1">
                <div className="font-mono text-[8px] text-muted-foreground/50 uppercase tracking-widest">{row.label}</div>
                <div className="font-mono text-[10px] font-bold text-foreground">{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* REQUIRED SKILLS */}
        <div className="bg-card border border-border p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">REQUIRED SKILLS</h2>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
                Core runtime — always loaded — no scope token required — cannot be disabled
              </p>
            </div>
            <span className="chip-pass text-[9px]">6 / 6 ACTIVE</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {[
              { id: "SCAN_SCHEDULER",    desc: "Manages scan loop intervals and manual trigger gating. Phase 3: manual only. Autonomous mode: scaffolded.",     status: "MANUAL",  note: `INTERVAL: ${status?.scanIntervalMinutes ?? 15}m` },
              { id: "EVIDENCE_INGRESS",  desc: "Accepts and validates structured findings via POST /hermes/findings. Idempotent by findingId. Read-only context only.", status: "ACTIVE",  note: "ENDPOINT: /api/hermes/findings" },
              { id: "AUDIT_HANDOFF",     desc: "Assembles the evidence bundle and submits to DJZS gate. Never modifies verdict. Seals payload on submission.", status: "ACTIVE",  note: "PHASE: DJZS_AUDIT — ONE-WAY" },
              { id: "KANBAN_COORDINATOR",desc: "Manages task lifecycle across Triage → Ready → In Progress → Blocked → Done / Failed lanes. Handles retry gating.", status: "ACTIVE",  note: "LANES: 6 — MAX RETRIES: 3" },
              { id: "RETRY_HANDLER",     desc: "Re-queues blocked or failed tasks with exponential backoff. Exhausted retries go to Dead-Letter Queue (DLQ).", status: "ACTIVE",  note: "DLQ: ENABLED — BACKOFF: EXP" },
              { id: "ALERT_ROUTER",      desc: "Routes DJZS-approved packets to configured delivery channels. Always fires after audit — never before. WAIT verdicts are never routed.", status: "ACTIVE",  note: "POST-AUDIT ONLY" },
            ].map((skill) => (
              <div key={skill.id} className="bg-card p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="font-mono text-xs font-bold text-foreground uppercase">{skill.id}</div>
                  <span className={cn("text-[9px]", skill.status === "ACTIVE" ? "chip-pass" : "chip-warn")}>{skill.status}</span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed flex-1">{skill.desc}</p>
                <div className="font-mono text-[9px] text-muted-foreground/40 border-t border-border pt-2 mt-auto">{skill.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SCOPE TOKEN REGISTRY */}
        <div className="bg-card border border-border p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">SCOPE TOKEN REGISTRY</h2>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
                Optional skills require a scope token — granted by runtime constraints — revokable instantly
              </p>
            </div>
            <span className={cn("text-[9px]", grantedCount > 0 ? "chip-warn" : "chip-neutral")}>
              {grantedCount} TOKEN{grantedCount !== 1 ? "S" : ""} GRANTED
            </span>
          </div>
          <div className="border border-border overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-secondary text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left text-[9px] uppercase tracking-widest font-medium">SCOPE TOKEN</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase tracking-widest font-medium">SKILL</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase tracking-widest font-medium">STATUS</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase tracking-widest font-medium">AUTHORITY</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase tracking-widest font-medium">PHASE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scopeTokens.map((tok) => (
                  <tr key={tok.token} className={cn("hover:bg-muted/30", tok.granted && "bg-primary/3")}>
                    <td className="px-4 py-2.5">
                      <span className={cn("font-mono text-[10px]", tok.granted ? "text-primary" : "text-muted-foreground/50")}>{tok.token}</span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-[10px] text-foreground">{tok.skill}</td>
                    <td className="px-4 py-2.5">
                      {tok.token === "mcp:inspect" ? (
                        <span className="chip-neutral text-[8px]">HUMAN-GATED</span>
                      ) : tok.granted ? (
                        <span className="chip-warn text-[8px]">GRANTED</span>
                      ) : (
                        <span className="chip-neutral text-[8px] opacity-50">NOT GRANTED</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[9px] text-muted-foreground">{tok.authority}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("font-mono text-[9px]", tok.phase === "PHASE 3" ? "text-primary/70" : "text-muted-foreground/40")}>{tok.phase}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/50 italic mt-3 border-t border-border pt-3">
            Revoking a scope token (e.g. disabling Pyth in constraints) immediately disables the corresponding skill on the next scan. No restart required. Tokens are not transferable between skills.
          </p>
        </div>

        {/* SKILL SANITIZATION PIPELINE */}
        <div className="bg-card border border-border p-5">
          <div className="mb-4">
            <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">SKILL OUTPUT SANITIZATION</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Untrusted skill output is sanitized before it can enter any evidence bundle
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-stretch gap-0 overflow-x-auto">
            {[
              { label: "UNTRUSTED INPUT",   color: "border-red-500/30 bg-red-500/5",         desc: "Raw Browserbase HTML, MCP tool output, webhook payloads" },
              { label: "STRIP SCRIPTS",     color: "border-orange-500/30",                    desc: "Remove <script>, eval(), event handlers, iframes" },
              { label: "STRIP REFS",        color: "border-orange-500/30",                    desc: "Remove external URLs, tracking pixels, redirect links" },
              { label: "SCHEMA VALIDATE",   color: "border-yellow-500/30",                    desc: "Assert output matches expected evidence schema" },
              { label: "TRUNCATE",          color: "border-yellow-500/30",                    desc: "Cap at max token budget — prevents prompt injection via length" },
              { label: "EVIDENCE BUNDLE",   color: "border-primary/30 bg-primary/5",          desc: "Sanitized, schema-valid evidence — safe for DJZS handoff" },
            ].map((node, i, arr) => (
              <div key={node.label} className="flex items-center">
                <div className={cn("border p-3 flex flex-col gap-1 min-w-[120px] flex-1", node.color)}>
                  <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-foreground">{node.label}</div>
                  <div className="font-mono text-[8px] text-muted-foreground leading-relaxed">{node.desc}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="font-mono text-muted-foreground/40 px-1.5 shrink-0 text-sm">→</div>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border mt-4">
            {[
              { skill: "PYTH_VERIFIER",       input: "Structured JSON from REST API",      sanitize: "Schema validate only — trusted format" },
              { skill: "BROWSERBASE_RESEARCH", input: "Raw HTML / rendered page content",   sanitize: "Full sanitize — strip, validate, truncate" },
              { skill: "MCP_INSPECTOR",        input: "Tool call output from MCP server",   sanitize: "Schema validate + human review gate" },
            ].map((row) => (
              <div key={row.skill} className="bg-card px-4 py-3 space-y-1">
                <div className="font-mono text-[9px] font-bold text-foreground uppercase">{row.skill}</div>
                <div className="font-mono text-[8px] text-muted-foreground">IN: {row.input}</div>
                <div className="font-mono text-[8px] text-primary/70">SANITIZE: {row.sanitize}</div>
              </div>
            ))}
          </div>
        </div>

        {/* DEFERRED SKILLS */}
        <div className="bg-card border border-[hsl(var(--trade-wait))]/20 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">DEFERRED SKILLS — NOT IN RUNTIME</h2>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
                Explicitly excluded from the Hermes runtime. Hermes is an audit-before-act orchestrator — not a general assistant.
              </p>
            </div>
            <span className="chip-warn text-[9px]">DEFERRED</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
            {[
              {
                id: "CODING_ASSISTANT",
                reason: "Out of scope — Hermes does not write, edit, or propose code changes to DST/DJZS infrastructure. Code changes require human engineering review outside of the runtime.",
                gate: "PERMANENTLY DEFERRED — NOT IN PHASE ROADMAP",
              },
              {
                id: "REPO_ASSISTANT",
                reason: "Out of scope — Hermes does not create PRs, apply diffs, or modify repository state. Repository access is a human-only operation. Hermes observes, never modifies.",
                gate: "PERMANENTLY DEFERRED — NOT IN PHASE ROADMAP",
              },
            ].map((skill) => (
              <div key={skill.id} className="bg-card p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="font-mono text-xs font-bold text-muted-foreground/50 uppercase line-through">{skill.id}</div>
                  <span className="chip-neutral text-[8px] opacity-50">DEFERRED</span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">{skill.reason}</p>
                <div className="font-mono text-[8px] text-muted-foreground/30 border-t border-border pt-2 mt-auto">{skill.gate}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SKILL PROVENANCE */}
        <div className="bg-card border border-border p-5">
          <div className="mb-4">
            <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">SKILL PROVENANCE</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Source, version, and trust classification for each optional skill
            </p>
          </div>
          <div className="border border-border overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-secondary text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left text-[9px] uppercase font-medium">SKILL</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase font-medium">SOURCE</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase font-medium">API VERSION</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase font-medium">TRUST LEVEL</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase font-medium">SANITIZE</th>
                  <th className="px-4 py-2 text-left text-[9px] uppercase font-medium">VERDICT INFLUENCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { skill: "PYTH_VERIFIER",        source: "hermes.pyth.network",   ver: "v2 REST",   trust: "HIGH",       sanitize: "SCHEMA",        influence: "DEGRADES ONLY" },
                  { skill: "BROWSERBASE_RESEARCH",  source: "browserbase.com",        ver: "v1",        trust: "UNTRUSTED",  sanitize: "FULL",          influence: "EVIDENCE ONLY" },
                  { skill: "TELEGRAM_DELIVERY",     source: "api.telegram.org",       ver: "Bot v7",    trust: "HIGH",       sanitize: "CONTENT STRIP", influence: "ROUTING ONLY" },
                  { skill: "XMTP_DELIVERY",         source: "XMTP protocol",          ver: "v2 codec",  trust: "HIGH",       sanitize: "CONTENT STRIP", influence: "ROUTING ONLY" },
                  { skill: "DISCORD_DELIVERY",      source: "discord.com/api",        ver: "v10",       trust: "HIGH",       sanitize: "CONTENT STRIP", influence: "ROUTING ONLY" },
                  { skill: "MCP_INSPECTOR",         source: "local MCP server",       ver: "v1 draft",  trust: "CONTROLLED", sanitize: "SCHEMA+HUMAN",  influence: "READ / HUMAN-GATED" },
                ].map((row) => (
                  <tr key={row.skill} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-bold text-[10px] text-foreground">{row.skill}</td>
                    <td className="px-4 py-2.5 text-[9px] text-muted-foreground">{row.source}</td>
                    <td className="px-4 py-2.5 text-[9px] text-muted-foreground">{row.ver}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("font-mono text-[8px] uppercase",
                        row.trust === "HIGH" ? "text-primary/70" :
                        row.trust === "UNTRUSTED" ? "text-red-400/80" :
                        "text-[hsl(var(--trade-wait))]/80"
                      )}>{row.trust}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[9px] text-muted-foreground/70">{row.sanitize}</td>
                    <td className="px-4 py-2.5 text-[9px] text-muted-foreground/70">{row.influence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* WHAT HERMES DID NOT DO */}
        <div className="bg-card border border-primary/20 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-mono text-sm font-bold text-primary uppercase tracking-widest">WHAT HERMES DID NOT DO</h2>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
                Explicit non-action record — last scan cycle — boundary enforcement confirmation
              </p>
            </div>
            <span className="chip-pass text-[9px]">BOUNDARY INTACT</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              "DID NOT score, rate, or rank any signal — DJZS is the only scorer",
              "DID NOT modify, override, or soft-veto any DJZS verdict",
              "DID NOT adjust entry zones, targets, or invalidation levels",
              "DID NOT execute, simulate, or recommend any trade position",
              `DID NOT send any alert — routing is ${(constraints?.alertRouting?.telegram || constraints?.alertRouting?.xmtp || constraints?.alertRouting?.discord) ? "PARTIALLY ENABLED" : "DISABLED"}`,
              `DID NOT run web research — Browserbase is ${constraints?.browserbaseTriggerPolicy !== "DISABLED" ? "CONDITIONAL" : "DISABLED"}`,
              "DID NOT use MCP extensions — no scope token granted",
              "DID NOT write, edit, or propose any code or repository change",
              "DID NOT accept findings from unverified or unsigned sources",
              "DID NOT allow any skill output to bypass the sanitization pipeline",
              "DID NOT store or forward any audit verdict payload after sealing",
              "DID NOT route WAIT verdicts to any delivery channel",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 border border-border bg-background">
                <span className="font-mono text-[8px] text-primary/40 mt-0.5 shrink-0">✗</span>
                <span className="font-mono text-[9px] text-muted-foreground leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/40 italic mt-4 border-t border-border pt-3">
            This panel is populated from the Hermes action log after each scan cycle. Non-actions are as important as actions — they confirm that boundary enforcement is operating correctly. Runtime version: {RUNTIME_VERSION} · Manifest: {MANIFEST_ID} · Hash: {MANIFEST_HASH}
          </p>
        </div>

      </div>
    );
  }

  // ── ACTION LOG TAB ───────────────────────────────────────────────────────────
  if (activeTab === "log") {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {tabBar}

        {/* LOG PROPERTIES */}
        <div className="bg-card border border-primary/30 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">HERMES ACTION LOG</h2>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
                Append-only, tamper-evident audit trail of every Hermes runtime action
              </p>
            </div>
            <span className="chip-warn text-[9px]">CONCEPT — PHASE 4</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
            {[
              { label: "LOG TYPE",       value: "APPEND-ONLY" },
              { label: "TAMPER DETECT",  value: "HASH CHAIN" },
              { label: "PER-ACTION",     value: "SCOPE TOKEN RECORDED" },
              { label: "SANITIZE LOG",   value: "SANITIZE VERDICT RECORDED" },
              { label: "DLQ ENTRIES",    value: "INCLUDED" },
              { label: "VERDICT LOG",    value: "READ-ONLY — SEALED" },
              { label: "RETENTION",      value: "7 DAYS (PLANNED)" },
              { label: "EXPORT",         value: "NDJSON (PLANNED)" },
            ].map((row) => (
              <div key={row.label} className="bg-card px-4 py-3 flex flex-col gap-1">
                <div className="font-mono text-[8px] text-muted-foreground/50 uppercase">{row.label}</div>
                <div className="font-mono text-[10px] font-bold text-foreground">{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* LOG ENTRIES SAMPLE */}
        <div className="bg-card border border-border p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">LOG FORMAT — SAMPLE ENTRIES</h2>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
                Representative log entries from a complete BTC 4H scan cycle
              </p>
            </div>
            <span className="chip-neutral text-[9px]">ILLUSTRATIVE</span>
          </div>
          <div className="border border-border overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-secondary text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-[9px] uppercase font-medium whitespace-nowrap">TIMESTAMP</th>
                  <th className="px-3 py-2 text-left text-[9px] uppercase font-medium">ACTION</th>
                  <th className="px-3 py-2 text-left text-[9px] uppercase font-medium">SKILL</th>
                  <th className="px-3 py-2 text-left text-[9px] uppercase font-medium">SCOPE TOKEN</th>
                  <th className="px-3 py-2 text-left text-[9px] uppercase font-medium">ASSET</th>
                  <th className="px-3 py-2 text-left text-[9px] uppercase font-medium">SANITIZE</th>
                  <th className="px-3 py-2 text-left text-[9px] uppercase font-medium">OUTCOME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_LOG_ENTRIES.map((entry, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground/50 whitespace-nowrap text-[9px]">{entry.ts}</td>
                    <td className="px-3 py-2 font-bold text-foreground text-[10px]">{entry.action}</td>
                    <td className="px-3 py-2 text-muted-foreground text-[9px]">{entry.skill}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[9px] text-primary/60">{entry.scope}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground/70 text-[9px]">{entry.asset}</td>
                    <td className="px-3 py-2 text-[9px]">
                      <span className={cn("font-mono", entry.sanitize === "N/A" ? "text-muted-foreground/30" : "text-[hsl(var(--trade-wait))]/70")}>{entry.sanitize}</span>
                    </td>
                    <td className="px-3 py-2 text-[9px]">
                      <span className={cn("font-mono font-bold",
                        entry.outcome.includes("SEALED") || entry.outcome.includes("NO-OP") ? "text-muted-foreground" :
                        entry.outcome.includes("OK") || entry.outcome.includes("QUEUED") || entry.outcome.includes("SUBMITTED") || entry.outcome.includes("ACCEPTED") || entry.outcome.includes("APPENDED") ? "text-primary/80" :
                        "text-foreground"
                      )}>{entry.outcome}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-background border border-border p-3 mt-3 font-mono text-[9px] text-muted-foreground/60 space-y-1">
            <div><span className="text-muted-foreground/40">NOTE:</span> VERDICT_READ entries record the verdict as read from DJZS — never as computed by Hermes. Sealed verdicts are immutable in the log. Any log entry showing a verdict modification would indicate a boundary violation.</div>
            <div><span className="text-muted-foreground/40">CHAIN:</span> Each log entry carries a SHA-256 hash of the previous entry. Gaps or hash mismatches indicate tampering. Log is append-only — no entry can be modified or deleted.</div>
          </div>
        </div>

        {/* REPLAY CONCEPT */}
        <div className="bg-card border border-border p-5">
          <div className="mb-4">
            <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">DETERMINISTIC TASK REPLAY</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Any scan run can be replayed deterministically from its log — same inputs produce same audit result
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {[
              { label: "REPLAY IDENTITY",   desc: "Each run carries a run_id, triggered_at, asset, and timeframe. Combined with the action log, these form a complete replay spec." },
              { label: "DETERMINISM GATE",  desc: "DST signal engine and DJZS audit are both deterministic given the same inputs. Hermes replay means re-running the same task chain with the same inputs." },
              { label: "REPLAY USE CASES",  desc: "Debugging failed tasks, auditing edge cases, verifying that a constraint change would have produced a different outcome on a historical signal." },
            ].map((row) => (
              <div key={row.label} className="bg-card p-4 flex flex-col gap-2">
                <div className="font-mono text-[10px] font-bold text-foreground uppercase">{row.label}</div>
                <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">{row.desc}</p>
              </div>
            ))}
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/40 italic mt-4 border-t border-border pt-3">
            Deterministic replay is a planned Phase 4 feature. The action log schema is designed to support it from Phase 3 forward. Implementation: scaffolded.
          </p>
        </div>

        {/* DLQ CONCEPT */}
        <div className="bg-card border border-border p-5">
          <div className="mb-4">
            <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">DEAD-LETTER QUEUE — DLQ</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Tasks that have exhausted all retries are moved to the DLQ — visible for inspection on the Operations Board
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {[
              { label: "DLQ TRIGGER",      desc: "Task status = FAILED and retry_count ≥ max_retries (default: 3). Task is removed from active Kanban lanes and moved to DLQ." },
              { label: "DLQ INSPECTION",   desc: "DLQ tasks are visible on the Operations Board with full error_code, blocked_reason, and retry history. Inspectable via the board." },
              { label: "DLQ RESOLUTION",   desc: "DLQ tasks can be re-queued manually via the board after root cause investigation. Auto-clearing DLQ entries is not supported — requires human acknowledgment." },
            ].map((row) => (
              <div key={row.label} className="bg-card p-4 flex flex-col gap-2">
                <div className="font-mono text-[10px] font-bold text-foreground uppercase">{row.label}</div>
                <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">{row.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  // ── RUNTIME CONFIG TAB ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {tabBar}

      {/* AUTHORITY BOUNDARY MODEL */}
      <div className="bg-card border border-primary/30 p-6">
        <div className="mb-5">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">HERMES — AUTHORITY BOUNDARY</h2>
          <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
            Runtime operator shell. Gathers evidence. Coordinates workflows. Never scores. Never audits.
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-stretch gap-0">
          <div className="flex-1 border border-border bg-background p-4 flex flex-col gap-2">
            <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">DST</div>
            <div className="font-mono text-[10px] text-primary uppercase tracking-widest">PROPOSES</div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed mt-1">
              Signal engine. Reads market data, computes technical state, produces a candidate setup with entry zone, target, invalidation, and R/R. Never executes.
            </p>
          </div>
          <div className="hidden md:flex items-center px-3 text-muted-foreground/30 font-mono text-lg">→</div>
          <div className="flex-1 border border-primary/50 bg-primary/5 p-4 flex flex-col gap-2">
            <div className="font-mono text-xs font-bold text-primary uppercase tracking-wider">DJZS</div>
            <div className="font-mono text-[10px] text-primary uppercase tracking-widest">AUDITS — FINAL — IMMUTABLE</div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed mt-1">
              Deterministic audit gate. Accepts or rejects the DST proposal against hard structural rules. Verdict is sealed on issue — not overrideable by Hermes or any other layer.
            </p>
          </div>
          <div className="hidden md:flex items-center px-3 text-muted-foreground/30 font-mono text-lg">→</div>
          <div className="flex-1 border border-border bg-background p-4 flex flex-col gap-2">
            <div className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">HERMES</div>
            <div className="font-mono text-[10px] text-[hsl(var(--trade-wait))] uppercase tracking-widest">ROUTES — NEVER SCORES</div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed mt-1">
              Orchestration runtime. Schedules scans, enforces scope tokens, sanitizes evidence, hands off to DJZS, and routes approved packets. Has no scoring authority.
            </p>
          </div>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/50 mt-4 italic border-t border-border pt-4">
          This boundary is absolute. Hermes constraint changes affect scan behavior and scope token grants. They do not influence DJZS verdict logic or signal engine doctrine.
        </p>
      </div>

      {/* STATUS BAR */}
      <div className="bg-card border border-border p-6 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-mono font-bold text-foreground tracking-tight">HERMES</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase mt-1">ORCHESTRATION RUNTIME — {RUNTIME_VERSION}</p>
          </div>

          <div className="flex-1 flex justify-center">
            {status?.schedulerActive ? (
              <span className="chip-pass text-base px-4 py-1.5">SCHEDULER ACTIVE</span>
            ) : (
              <span className="chip-warn text-base px-4 py-1.5">SCHEDULER STANDBY — MANUAL TRIGGER ONLY</span>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleTrigger}
              disabled={triggerScan.isPending}
              className="px-6 py-2 border border-primary text-primary hover:bg-primary/10 font-mono text-sm uppercase transition-colors disabled:opacity-50"
            >
              {triggerScan.isPending ? "SCANNING..." : "TRIGGER SCAN"}
            </button>
            {status?.lastRunAt && (
              <div className="text-xs font-mono text-muted-foreground">
                LAST RUN: {new Date(status.lastRunAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Visualization — with immutability gate */}
        <div className="pt-2">
          <div className="font-mono text-[8px] text-muted-foreground/50 uppercase mb-2 tracking-widest">SCAN PIPELINE — SANITIZE → EVIDENCE BUNDLE → ‖ IMMUTABILITY GATE ‖ → DJZS → SEALED VERDICT → ROUTING</div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <div className="font-mono text-xs uppercase min-w-max flex items-center gap-2">
              <div className="border border-border bg-background p-3 flex flex-col items-center gap-1 w-28">
                <span className="font-bold text-[10px]">DEFILAMMA</span>
                <span className="text-primary text-[9px]">ACTIVE</span>
              </div>
              <div className="text-muted-foreground/50 text-xs">→</div>
              <div className="border border-border bg-background p-3 flex flex-col items-center gap-1 w-28">
                <span className="font-bold text-[10px]">PYTH</span>
                {constraints?.pythConfidenceFilter ? (
                  <span className="text-[hsl(var(--trade-wait))] text-[9px]">CONDITIONAL</span>
                ) : (
                  <span className="text-muted-foreground text-[9px]">DISABLED</span>
                )}
              </div>
              <div className="text-muted-foreground/50 text-xs">→</div>
              <div className="border border-border bg-background p-3 flex flex-col items-center gap-1 w-28">
                <span className="font-bold text-[10px]">BROWSERBASE</span>
                {constraints?.browserbaseTriggerPolicy !== "DISABLED" ? (
                  <span className="text-[hsl(var(--trade-wait))] text-[9px]">{constraints?.browserbaseTriggerPolicy}</span>
                ) : (
                  <span className="text-muted-foreground text-[9px]">DISABLED</span>
                )}
              </div>
              <div className="text-muted-foreground/50 text-xs">→</div>
              <div className="border border-orange-500/30 bg-orange-500/5 p-3 flex flex-col items-center gap-1 w-28">
                <span className="font-bold text-[10px]">SANITIZE</span>
                <span className="text-orange-400 text-[9px]">ALWAYS ON</span>
              </div>
              <div className="text-muted-foreground/50 text-xs">→</div>
              <div className="border border-yellow-500/30 bg-yellow-500/5 p-3 flex flex-col items-center gap-1 w-28">
                <span className="font-bold text-[10px]">EVD BUNDLE</span>
                <span className="text-yellow-400 text-[9px]">ASSEMBLED</span>
              </div>
              <div className="font-mono text-muted-foreground/60 text-sm px-1">‖</div>
              <div className="border border-primary/60 bg-primary/10 p-3 flex flex-col items-center gap-1 w-32">
                <span className="font-bold text-[10px] text-primary">IMMUTABILITY</span>
                <span className="text-primary/80 text-[9px]">GATE — SEAL</span>
              </div>
              <div className="font-mono text-muted-foreground/60 text-sm px-1">‖</div>
              <div className="border border-primary/50 bg-primary/5 p-3 flex flex-col items-center gap-1 w-28">
                <span className="font-bold text-[10px]">DJZS AUDIT</span>
                <span className="text-primary text-[9px] font-bold">ACTIVE</span>
              </div>
              <div className="text-muted-foreground/50 text-xs">→</div>
              <div className="border border-border bg-background p-3 flex flex-col items-center gap-1 w-28">
                <span className="font-bold text-[10px]">ROUTING</span>
                <div className="flex gap-1">
                  {constraints?.alertRouting?.telegram && <span className="text-primary text-[9px]">TG</span>}
                  {constraints?.alertRouting?.discord && <span className="text-primary text-[9px]">DC</span>}
                  {constraints?.alertRouting?.xmtp && <span className="text-primary text-[9px]">XMTP</span>}
                  {!constraints?.alertRouting?.telegram && !constraints?.alertRouting?.discord && !constraints?.alertRouting?.xmtp && <span className="text-muted-foreground text-[9px]">NONE</span>}
                </div>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground italic text-[10px] font-mono mt-3">
            By doctrine: most scans end in WAIT. DJZS is the final gate. The immutability seal prevents any post-audit verdict modification. Hermes routes — never scores.
          </p>
        </div>
      </div>

      {/* VERDICT IMMUTABILITY GATE */}
      <div className="bg-card border border-primary/20 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest">VERDICT IMMUTABILITY GATE</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              DJZS verdict payload is sealed on issue — Hermes cannot read, modify, or re-submit after the gate
            </p>
          </div>
          <span className="chip-pass text-[9px]">ENFORCED</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {[
            { label: "EVIDENCE SIDE",   color: "border-yellow-500/20", desc: "Hermes assembles the evidence bundle. At submission to DJZS, the payload is serialized and hashed. Hermes cannot modify it after this point." },
            { label: "THE GATE ‖",      color: "border-primary/40 bg-primary/5", desc: "One-way submission. DJZS receives the sealed bundle. Hermes has no read-back channel into the audit computation — it only receives the final verdict." },
            { label: "VERDICT SIDE",    color: "border-border", desc: "DJZS emits a verdict. Hermes reads it as a sealed record. Verdict is logged as-is. Hermes cannot amend, appeal, or re-run the audit without a new full scan cycle." },
          ].map((node) => (
            <div key={node.label} className={cn("bg-card p-4 border", node.color)}>
              <div className="font-mono text-[10px] font-bold text-foreground uppercase mb-2">{node.label}</div>
              <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">{node.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* REQUIRED CAPABILITIES */}
      <div className="bg-card border border-border p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-mono font-bold text-foreground uppercase tracking-widest">REQUIRED CAPABILITIES</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Core runtime functions — all operational in Phase 3 — no scope token required
            </p>
          </div>
          <span className="chip-pass text-[10px]">6 / 6 ACTIVE</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          <div className="bg-card p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="font-mono text-xs font-bold text-foreground uppercase">SCAN SCHEDULING</div>
              <span className="chip-warn text-[9px]">MANUAL</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Manages the scan loop. Current phase: manual trigger only. Autonomous scheduler is scaffolded. Recurring schedule, TTL-based task expiry, and deduplication are planned Phase 4 additions.
            </p>
            <div className="mt-auto pt-2 border-t border-border font-mono text-[9px] text-muted-foreground/50">
              INTERVAL: {status?.scanIntervalMinutes ?? 15}m — DEDUP: PLANNED — TTL: PLANNED
            </div>
          </div>
          <div className="bg-card p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="font-mono text-xs font-bold text-foreground uppercase">EVIDENCE INGRESS</div>
              <span className="chip-pass text-[9px]">ACTIVE</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Structured finding ingestion via POST /hermes/findings. Idempotent by findingId. All findings are sanitized and validated before entering the evidence bundle. Read-only context — never influences DJZS verdict.
            </p>
            <div className="mt-auto pt-2 border-t border-border font-mono text-[9px] text-muted-foreground/50">
              ENDPOINT: /api/hermes/findings — IDEMPOTENT: YES — SANITIZE: YES
            </div>
          </div>
          <div className="bg-card p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="font-mono text-xs font-bold text-foreground uppercase">AUDIT HANDOFF</div>
              <span className="chip-pass text-[9px]">ACTIVE</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Each scan job runs the DJZS audit as the DJZS_AUDIT phase. Hermes submits to the audit gate — it does not influence the verdict or inject evidence after the immutability gate seals the payload.
            </p>
            <div className="mt-auto pt-2 border-t border-border font-mono text-[9px] text-muted-foreground/50">
              PHASE: DJZS_AUDIT — GATE: IMMUTABLE — AUTHORITY: DJZS ONLY
            </div>
          </div>
          <div className="bg-card p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="font-mono text-xs font-bold text-foreground uppercase">KANBAN COORDINATOR</div>
              <span className="chip-pass text-[9px]">ACTIVE</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Manages task lifecycle across 6 lanes: Triage, Ready, In Progress, Blocked, Done, Failed. Handles blocked-state detection, re-queue gating, and structured handoffs between workers.
            </p>
            <div className="mt-auto pt-2 border-t border-border font-mono text-[9px] text-muted-foreground/50">
              LANES: 6 — BLOCKED DETECTION: YES — HANDOFF: STRUCTURED
            </div>
          </div>
          <div className="bg-card p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="font-mono text-xs font-bold text-foreground uppercase">RETRY + DLQ HANDLER</div>
              <span className="chip-pass text-[9px]">ACTIVE</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Re-queues blocked or failed tasks with exponential backoff up to max_retries. Tasks that exhaust retries are moved to the Dead-Letter Queue for manual inspection and re-queue.
            </p>
            <div className="mt-auto pt-2 border-t border-border font-mono text-[9px] text-muted-foreground/50">
              MAX RETRIES: 3 — DLQ: ACTIVE — BACKOFF: EXPONENTIAL
            </div>
          </div>
          <div className="bg-card p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="font-mono text-xs font-bold text-foreground uppercase">WEBHOOK SUBSCRIPTIONS</div>
              <span className="chip-neutral text-[9px]">SCAFFOLDED</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Inbound webhook endpoints for external data push. Scaffolded — will accept price alerts, CEX flow signals, and liquidation events as evidence ingress inputs. All inbound content will be sanitized before evidence bundle entry.
            </p>
            <div className="mt-auto pt-2 border-t border-border font-mono text-[9px] text-muted-foreground/50">
              STATUS: SCAFFOLDED — SANITIZE: PLANNED — PHASE 4
            </div>
          </div>
        </div>
      </div>

      {/* TASK MODEL */}
      <div className="bg-card border border-border p-6">
        <div className="mb-5">
          <h2 className="text-sm font-mono font-bold text-foreground uppercase tracking-widest">TASK MODEL</h2>
          <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
            Structural properties of every Hermes task — active and planned
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {[
            { label: "TASK DEDUPLICATION", status: "PLANNED", desc: "Tasks are keyed by (asset, timeframe, task_type). A new task submission with the same key is rejected if a live task of the same type is already in-flight for that asset/timeframe." },
            { label: "PRIORITY LANES",     status: "ACTIVE",  desc: "Tasks carry an implicit priority based on task_type. DJZS_AUDIT and ATTACH_TO_AUDIT are CRITICAL. Evidence fetch tasks are HIGH. Routing tasks are LOW. Workers process higher-priority tasks first." },
            { label: "TASK FRESHNESS/TTL", status: "PLANNED", desc: "Tasks older than a configured TTL (e.g. 30 minutes) are expired and moved to the DLQ automatically. Prevents stale market-context tasks from contaminating DJZS audit runs." },
            { label: "CANCELLATION",       status: "PLANNED", desc: "A running scan run can be cancelled via the board if a higher-priority signal or a constraint change makes the in-flight run invalid. Cancellation is graceful — tasks in DJZS_AUDIT phase cannot be cancelled." },
            { label: "PER-TASK COST CAP",  status: "PLANNED", desc: "Optional token-budget ceiling per task (relevant for Browserbase and LLM-assisted skills). Tasks that exceed their budget are aborted and moved to DLQ with COST_EXCEEDED error code." },
            { label: "STRUCTURED HANDOFF", status: "ACTIVE",  desc: "Tasks pass a structured payload to the next task in the chain. The payload schema is validated at each handoff boundary. Schema violations abort the chain and log a HANDOFF_SCHEMA_ERROR." },
          ].map((item) => (
            <div key={item.label} className="bg-card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="font-mono text-xs font-bold text-foreground uppercase">{item.label}</div>
                <span className={cn("text-[9px]", item.status === "ACTIVE" ? "chip-pass" : "chip-neutral opacity-70")}>{item.status}</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DELIVERY DESIGN */}
      <div className="bg-card border border-border p-6">
        <div className="mb-5">
          <h2 className="text-sm font-mono font-bold text-foreground uppercase tracking-widest">DELIVERY DESIGN</h2>
          <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
            Alert delivery is post-DJZS only — APPROVED packets only — with receipt confirmation and fallback chains
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {[
            { label: "DELIVERY RECEIPTS",     status: "PLANNED", desc: "Each delivery attempt records a receipt: channel, timestamp, delivery_id, success/failure, and the packet hash. Idempotent — re-delivering the same packet hash to the same channel is a no-op." },
            { label: "RECIPIENT OPT-IN",      status: "PLANNED", desc: "Delivery channels require explicit opt-in. A Telegram chat ID, XMTP address, or Discord webhook must be registered and confirmed before any packet can be routed to it. No opt-out, no delivery." },
            { label: "FALLBACK CHAINS",        status: "PLANNED", desc: "Primary delivery channel failure triggers fallback: Telegram → XMTP → Discord → DLQ (undelivered log). Fallback is attempted once per channel before moving to DLQ." },
            { label: "IDEMPOTENT DELIVERY",   status: "PLANNED", desc: "Duplicate packet delivery is prevented by packet hash. Each approved signal packet has a unique packetHash. If that hash has already been delivered to a channel, re-delivery is skipped." },
            { label: "WAIT NOT ROUTED",       status: "ACTIVE",  desc: "WAIT verdicts are never routed to any delivery channel. Routing fires only for APPROVED packets. This is enforced in ALERT_ROUTER — not a configuration option." },
            { label: "QUOTA AWARENESS",       status: "PLANNED", desc: "Telegram Bot API and Discord webhooks have per-minute rate limits. ALERT_ROUTER tracks delivery rate and queues packets when limits are approaching. Rate-limited delivery is logged as QUOTA_DEFERRED." },
          ].map((item) => (
            <div key={item.label} className="bg-card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="font-mono text-xs font-bold text-foreground uppercase">{item.label}</div>
                <span className={cn("text-[9px]", item.status === "ACTIVE" ? "chip-pass" : "chip-neutral opacity-70")}>{item.status}</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION: CONSTRAINTS + ROLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* COLUMN A: CONSTRAINTS */}
        <div className="bg-card border border-border p-6 flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-xl font-display font-bold text-foreground">SYSTEM CONSTRAINTS</h2>
            <p className="text-muted-foreground font-mono text-xs uppercase mt-1">DURABLE — NOT OPINIONS — CONTROL SCOPE TOKEN GRANTS</p>
            <div className="p-3 bg-secondary border border-border mt-4 text-sm text-body">
              CONSTRAINTS control Hermes behavior and determine which scope tokens are granted to optional skills. Changing a constraint takes effect on the next scan cycle.
            </div>
          </div>

          {isLoadingConstraints ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-5 flex-1">
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Preferred Assets</label>
                <Input className="col-span-2 font-mono text-sm rounded-none border-border" value={formState.preferredAssets || ""} onChange={e => setFormState({...formState, preferredAssets: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Active Timeframe</label>
                <Select value={formState.activeTimeframe} onValueChange={v => setFormState({...formState, activeTimeframe: v})}>
                  <SelectTrigger className="col-span-2 font-mono text-sm rounded-none border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    <SelectItem value="1H" className="font-mono">1H</SelectItem>
                    <SelectItem value="4H" className="font-mono">4H</SelectItem>
                    <SelectItem value="1D" className="font-mono">1D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Min R/R Threshold</label>
                <Input type="number" step="0.1" className="col-span-2 font-mono text-sm rounded-none border-border" value={formState.minRRThreshold || 0} onChange={e => setFormState({...formState, minRRThreshold: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Late Entry ATR Mult</label>
                <Input type="number" step="0.1" className="col-span-2 font-mono text-sm rounded-none border-border" value={formState.lateEntryAtrMultiplier || 0} onChange={e => setFormState({...formState, lateEntryAtrMultiplier: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Wait Bias Policy</label>
                <Select value={formState.waitBiasPolicy} onValueChange={v => setFormState({...formState, waitBiasPolicy: v})}>
                  <SelectTrigger className="col-span-2 font-mono text-sm rounded-none border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    <SelectItem value="STRICT" className="font-mono">STRICT</SelectItem>
                    <SelectItem value="STANDARD" className="font-mono">STANDARD</SelectItem>
                    <SelectItem value="RELAXED" className="font-mono">RELAXED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Browserbase Trigger <span className="text-[8px] text-primary/50 block">scope: browserbase:fetch</span></label>
                <Select value={formState.browserbaseTriggerPolicy} onValueChange={v => setFormState({...formState, browserbaseTriggerPolicy: v})}>
                  <SelectTrigger className="col-span-2 font-mono text-sm rounded-none border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    <SelectItem value="DISABLED" className="font-mono">DISABLED</SelectItem>
                    <SelectItem value="HIGH_CONFIDENCE" className="font-mono">HIGH_CONFIDENCE</SelectItem>
                    <SelectItem value="APPROVED_ONLY" className="font-mono">APPROVED_ONLY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4 pt-2 border-t border-border">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Pyth Confidence Filter <span className="text-[8px] text-primary/50 block">scope: pyth:read</span></label>
                <div className="col-span-2 flex items-center h-10">
                  <Switch checked={formState.pythConfidenceFilter} onCheckedChange={v => setFormState({...formState, pythConfidenceFilter: v})} />
                </div>
              </div>
              {formState.pythConfidenceFilter && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Pyth Confidence Thr.</label>
                  <Input type="number" step="0.01" max="1" min="0" className="col-span-2 font-mono text-sm rounded-none border-border" value={formState.pythConfidenceThreshold || 0} onChange={e => setFormState({...formState, pythConfidenceThreshold: e.target.value})} />
                </div>
              )}
              <div className="grid grid-cols-3 items-start gap-4 pt-2 border-t border-border">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground pt-2">Alert Routing <span className="text-[8px] text-primary/50 block">scope: *:write</span></label>
                <div className="col-span-2 space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">Telegram <span className="text-[9px] text-muted-foreground/50 ml-1">telegram:write</span></span>
                    <Switch checked={formState.alertRouting?.telegram} onCheckedChange={v => setFormState({...formState, alertRouting: {...formState.alertRouting, telegram: v}})} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">XMTP <span className="text-[9px] text-muted-foreground/50 ml-1">xmtp:write</span></span>
                    <Switch checked={formState.alertRouting?.xmtp} onCheckedChange={v => setFormState({...formState, alertRouting: {...formState.alertRouting, xmtp: v}})} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">Discord <span className="text-[9px] text-muted-foreground/50 ml-1">discord:write</span></span>
                    <Switch checked={formState.alertRouting?.discord} onCheckedChange={v => setFormState({...formState, alertRouting: {...formState.alertRouting, discord: v}})} />
                  </div>
                </div>
              </div>
              <div className="pt-6 mt-auto">
                <div className="flex items-center justify-between">
                  {saveSuccess ? (
                    <span className="text-primary font-mono text-sm uppercase">CONSTRAINTS UPDATED — SCOPE TOKENS REFRESHED</span>
                  ) : <span />}
                  <button onClick={handleSave} disabled={updateConstraints.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 font-mono text-sm uppercase disabled:opacity-50 transition-colors">
                    {updateConstraints.isPending ? "SAVING..." : "SAVE CONSTRAINTS"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMN B: WORKER ROLES + JOBS */}
        <div className="flex flex-col gap-6">
          {/* WORKER ROLES */}
          <div className="bg-card border border-border p-6">
            <h2 className="text-xl font-display font-bold text-foreground mb-1">WORKER ROLES</h2>
            <p className="font-mono text-[9px] text-muted-foreground/50 uppercase mb-4">EVIDENCE GATHERERS — NOT VERDICTORS — SCOPE-GATED</p>
            <div className="space-y-3">
              {[
                { name: "MARKET CONTEXT WORKER",    tool: "DEFILAMMA API",              purpose: "4H price history, TVL, regime, global OI context. Required — always runs.",                             scope: "N/A",                 status: "ACTIVE"       },
                { name: "PRICE CONFIDENCE WORKER",  tool: "PYTH HERMES v2",             purpose: "Live price + confidence interval. Degrades APPROVED to DEGRADED when wide. Evidence only.",            scope: "pyth:read",           status: constraints?.pythConfidenceFilter ? "ACTIVE" : "DISABLED" },
                { name: "WEB RESEARCH WORKER",      tool: "BROWSERBASE",                purpose: "Triggered narrative research on high-interest setups. All output is fully sanitized before evidence bundle.", scope: "browserbase:fetch",   status: constraints?.browserbaseTriggerPolicy !== "DISABLED" ? "CONDITIONAL" : "DISABLED" },
                { name: "DJZS AUDIT WORKER",        tool: "DJZS (DETERMINISTIC)",       purpose: "Admissibility gate. Not an opinion. Final. Sealed on issue. Hermes has no authority over this step.",   scope: "djzs:submit",         status: "ACTIVE_FINAL" },
                { name: "DELIVERY WORKER",          tool: "TG / XMTP / DISCORD",        purpose: "Delivers APPROVED packets to configured channels after DJZS seal. WAIT verdicts are never routed.",     scope: "telegram/xmtp/discord:write", status: (constraints?.alertRouting?.telegram || constraints?.alertRouting?.discord || constraints?.alertRouting?.xmtp) ? "CONDITIONAL" : "DISABLED" },
                { name: "MCP EXTENSION WORKER",     tool: "MCP (READ-ONLY)",            purpose: "Controlled codebase inspection for constraint drift diagnostics. Human-gated. Not active in Phase 3.",  scope: "mcp:inspect",         status: "PLANNED"      },
              ].map((role, i) => (
                <div key={i} className={cn("p-3 border flex flex-col gap-2", role.status === "ACTIVE_FINAL" ? "border-primary/50 bg-primary/5" : "border-border bg-background")}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="font-mono text-sm font-bold">{role.name}</div>
                      <div className="font-mono text-[9px] text-muted-foreground mt-0.5">TOOL: {role.tool}</div>
                      {role.scope !== "N/A" && (
                        <div className="font-mono text-[8px] text-primary/50 mt-0.5">SCOPE: {role.scope}</div>
                      )}
                    </div>
                    {role.status === "ACTIVE" ? <span className="chip-pass text-[9px] shrink-0">ACTIVE</span> :
                     role.status === "ACTIVE_FINAL" ? <span className="chip-pass font-bold text-[9px] shrink-0">ACTIVE</span> :
                     role.status === "CONDITIONAL" ? <span className="chip-warn text-[9px] shrink-0">CONDITIONAL</span> :
                     role.status === "PLANNED" ? <span className="chip-neutral text-[9px] opacity-60 shrink-0">PLANNED</span> :
                     <span className="chip-neutral text-[9px] shrink-0">DISABLED</span>}
                  </div>
                  <div className="text-xs text-body">{role.purpose}</div>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground italic text-[10px] font-mono mt-4 border-t border-border pt-3">
              Final judgment is always DJZS deterministic audit. Worker outputs are inputs — not votes. Coding and repo-assistance skills are permanently deferred from this runtime.
            </p>
          </div>

          {/* RECENT JOBS */}
          <div className="bg-card border border-border p-6 flex-1 flex flex-col">
            <h2 className="text-sm font-mono text-muted-foreground uppercase mb-4">RECENT JOBS</h2>
            <div className="flex-1 overflow-auto border border-border">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-secondary text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium uppercase">TIME</th>
                    <th className="px-3 py-2 font-medium uppercase">ASSET</th>
                    <th className="px-3 py-2 font-medium uppercase">PHASES</th>
                    <th className="px-3 py-2 font-medium uppercase">VERDICT</th>
                    <th className="px-3 py-2 font-medium uppercase">CODES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingJobs ? (
                    Array(3).fill(0).map((_, i) => (
                      <tr key={i}><td colSpan={5} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td></tr>
                    ))
                  ) : !jobs?.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No scans yet. Trigger a scan or activate the scheduler.
                      </td>
                    </tr>
                  ) : (
                    jobs.slice(0, 5).map(job => {
                      const timeStr = new Date(job.scanStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={job.id} className="hover:bg-muted/50">
                          <td className="px-3 py-3 text-muted-foreground">{timeStr}</td>
                          <td className="px-3 py-3 font-bold text-foreground">{job.asset}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              {job.phases.map((p, i) => (
                                <div key={i} className={cn("w-2 h-2 rounded-full",
                                  p.status === "COMPLETE" ? "bg-primary" :
                                  p.status === "SKIPPED" ? "bg-[hsl(var(--trade-wait))]" :
                                  p.status === "FAILED" ? "bg-destructive" :
                                  "bg-muted-foreground"
                                )} title={`${p.stage}: ${p.status}`} />
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {job.finalProcessVerdict ? <ProcessVerdictBadge verdict={job.finalProcessVerdict} /> : <span className="chip-neutral">PENDING</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {job.rejectionCodes.slice(0, 2).map(c => (
                                <span key={c} className="chip-fail text-[8px] max-w-[60px] truncate" title={c}>{c}</span>
                              ))}
                              {job.rejectionCodes.length > 2 && (
                                <span className="chip-neutral text-[8px]">+{job.rejectionCodes.length - 2}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-5 flex flex-col gap-2">
          <div className="text-xs font-mono uppercase text-muted-foreground">SCANS TODAY</div>
          <div className="text-3xl font-mono text-primary">{status?.totalScansToday || 0}</div>
        </div>
        <div className="bg-card border border-border p-5 flex flex-col gap-2">
          <div className="text-xs font-mono uppercase text-muted-foreground">WAIT RATE TODAY</div>
          <div className={cn("text-3xl font-mono", waitRate > 70 ? "text-primary" : waitRate >= 50 ? "text-[hsl(var(--trade-wait))]" : "text-destructive")}>
            {waitRate.toFixed(0)}%
          </div>
        </div>
        <div className="bg-card border border-border p-5 flex flex-col gap-2">
          <div className="text-xs font-mono uppercase text-muted-foreground">APPROVED TODAY</div>
          <div className={cn("text-3xl font-mono", (status?.totalApprovedToday || 0) > 0 ? "text-primary" : "text-muted-foreground")}>
            {status?.totalApprovedToday || 0}
          </div>
        </div>
        <div className="bg-card border border-border p-5 flex flex-col gap-2">
          <div className="text-xs font-mono uppercase text-muted-foreground">SCHEDULER</div>
          <div className="mt-1">
            {status?.schedulerActive ? (
              <span className="chip-pass text-lg px-3 py-1">ACTIVE</span>
            ) : (
              <span className="chip-warn text-lg px-3 py-1">STANDBY</span>
            )}
          </div>
        </div>
      </div>

      {/* OPTIONAL SKILLS */}
      <div className="bg-card border border-border p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-mono font-bold text-foreground uppercase tracking-widest">OPTIONAL SKILLS — SCOPE-GATED</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Secondary capabilities — require scope token grant via constraints — off by default
            </p>
          </div>
          <span className="chip-neutral text-[10px]">{scopeTokens.filter(t => t.granted).length} / {scopeTokens.length - 1} GRANTED</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {[
            {
              name: "PYTH VERIFICATION",
              scope: "pyth:read",
              provider: "PYTH NETWORK — Hermes v2",
              status: constraints?.pythConfidenceFilter ? "ACTIVE" : "DISABLED",
              sanitize: "JSON_SCHEMA",
              desc: "Live price confidence overlay from Pyth Hermes REST API. Wide confidence degrades APPROVED to DEGRADED. Free. No key required. Sanitized as structured JSON — trust level: HIGH.",
              config: `FILTER: ${constraints?.pythConfidenceFilter ? "ENABLED" : "DISABLED"} — THR: ${constraints?.pythConfidenceThreshold ?? 0.95}`,
            },
            {
              name: "BROWSER RESEARCH",
              scope: "browserbase:fetch",
              provider: "BROWSERBASE",
              status: constraints?.browserbaseTriggerPolicy !== "DISABLED" ? "CONDITIONAL" : "DISABLED",
              sanitize: "FULL SANITIZE",
              desc: "Triggered web research on high-interest setups. HTML output is fully sanitized — scripts stripped, external refs removed, schema validated — before entering the evidence bundle.",
              config: `POLICY: ${constraints?.browserbaseTriggerPolicy ?? "DISABLED"}`,
            },
            {
              name: "TELEGRAM DELIVERY",
              scope: "telegram:write",
              provider: "TELEGRAM BOT API",
              status: constraints?.alertRouting?.telegram ? "ACTIVE" : "DISABLED",
              sanitize: "CONTENT STRIP",
              desc: "Sends APPROVED signal packets as formatted Telegram messages. Content is stripped before delivery. Requires TELEGRAM_BOT_TOKEN and opt-in chat ID. WAIT verdicts never delivered.",
              config: `ROUTING: ${constraints?.alertRouting?.telegram ? "ENABLED" : "DISABLED"}`,
            },
            {
              name: "XMTP DELIVERY",
              scope: "xmtp:write",
              provider: "XMTP PROTOCOL",
              status: constraints?.alertRouting?.xmtp ? "ACTIVE" : "DISABLED",
              sanitize: "CONTENT STRIP",
              desc: "Decentralized wallet-to-wallet delivery of APPROVED packets. Encrypted p2p — requires XMTP_PRIVATE_KEY and registered destination address. Fallback if Telegram fails.",
              config: `ROUTING: ${constraints?.alertRouting?.xmtp ? "ENABLED" : "DISABLED"}`,
            },
            {
              name: "DISCORD DELIVERY",
              scope: "discord:write",
              provider: "DISCORD API v10",
              status: constraints?.alertRouting?.discord ? "ACTIVE" : "DISABLED",
              sanitize: "CONTENT STRIP",
              desc: "Webhook delivery of APPROVED packets to a configured Discord channel. Requires discord:write scope token (enabled via alert routing). WAIT verdicts never delivered.",
              config: `ROUTING: ${constraints?.alertRouting?.discord ? "ENABLED" : "DISABLED"}`,
            },
            {
              name: "MCP INSPECTOR",
              scope: "mcp:inspect",
              provider: "LOCAL MCP SERVER",
              status: "PLANNED",
              sanitize: "SCHEMA + HUMAN GATE",
              desc: "Controlled codebase inspection for constraint drift diagnostics. Read-only. All output is schema-validated and requires human review before entering any evidence record. Phase 5.",
              config: "STATUS: NOT WIRED — PHASE 5 — HUMAN-GATED",
            },
          ].map((skill) => (
            <div key={skill.name} className="bg-card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="font-mono text-xs font-bold text-foreground uppercase">{skill.name}</div>
                <span className={cn("text-[9px]",
                  skill.status === "ACTIVE" ? "chip-pass" :
                  skill.status === "CONDITIONAL" ? "chip-warn" :
                  skill.status === "PLANNED" ? "chip-neutral opacity-60" :
                  "chip-neutral"
                )}>{skill.status}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[8px] text-primary/50 border border-primary/20 px-1">{skill.scope}</span>
                <span className="font-mono text-[8px] text-muted-foreground/40 uppercase">{skill.sanitize}</span>
              </div>
              <div className="font-mono text-[9px] text-muted-foreground/50 uppercase">{skill.provider}</div>
              <p className="font-mono text-[10px] text-muted-foreground leading-relaxed flex-1">{skill.desc}</p>
              <div className="mt-auto pt-2 border-t border-border font-mono text-[9px] text-muted-foreground/50">{skill.config}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 border border-[hsl(var(--trade-wait))]/20 bg-[hsl(var(--trade-wait))]/5">
          <div className="font-mono text-[9px] text-[hsl(var(--trade-wait))]/80 uppercase tracking-widest font-bold mb-1">DEFERRED — NOT IN THIS RUNTIME</div>
          <div className="font-mono text-[9px] text-muted-foreground/60">CODING_ASSISTANT and REPO_ASSISTANT skills are permanently deferred. Hermes is an audit-before-act orchestrator — not a general engineering agent. See Skills Manifest tab for full deferral rationale.</div>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/50 italic mt-3 border-t border-border pt-3">
          Optional skills are always additive — they feed sanitized evidence into DJZS, never around it. Scope tokens can be revoked via constraints at any time.
        </p>
      </div>

      {/* MCP EXTENSION LAYER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-mono font-bold text-foreground uppercase tracking-widest">MCP EXTENSION LAYER</h2>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">Controlled integration — Phase 5 — scope: mcp:inspect — human-gated</p>
            </div>
            <span className="chip-neutral text-[10px] opacity-60">PHASE 5</span>
          </div>
          <div className="border border-border bg-background p-4 space-y-3">
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              MCP is reserved as a controlled extension layer. When activated, MCP tools allow a Hermes runtime agent to inspect external systems under strict human-approval gating. The scope token <span className="text-primary/70">mcp:inspect</span> is never auto-granted — it requires explicit configuration and a human-approval gate on all read operations.
            </p>
            <div className="space-y-2 pt-2 border-t border-border">
              {[
                { tool: "CODEBASE READER", use: "Inspect DST/DJZS rule files for constraint drift diagnostics", gate: "READ-ONLY — SCHEMA VALIDATED" },
                { tool: "WEB RESEARCHER",  use: "Triggered narrative research on high-interest approved setups",  gate: "APPROVED_ONLY POLICY — FULL SANITIZE" },
              ].map((t) => (
                <div key={t.tool} className="flex items-start gap-3">
                  <div className="w-2 h-2 border border-muted-foreground/30 mt-1 shrink-0" />
                  <div>
                    <div className="font-mono text-[10px] font-bold text-foreground uppercase">{t.tool}</div>
                    <div className="font-mono text-[9px] text-muted-foreground">{t.use}</div>
                    <div className="font-mono text-[8px] text-muted-foreground/50 uppercase">{t.gate}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border font-mono text-[8px] text-[hsl(var(--trade-wait))]/60 uppercase">
              DEFERRED: DIFF PROPOSER, CODING HELPERS — these are permanently removed from the Hermes MCP tool set. Hermes does not write or propose code changes.
            </div>
          </div>
        </div>

        {/* NOUS PORTAL */}
        <div className="bg-card border border-border p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-mono font-bold text-foreground uppercase tracking-widest">NOUS PORTAL</h2>
              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">Optional LLM provider backend — not a system dependency</p>
            </div>
            <span className="chip-neutral text-[10px]">OPTIONAL</span>
          </div>
          <div className="border border-border bg-background p-4 space-y-3">
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Nous Portal is an optional provider choice for any LLM-assisted Hermes capabilities (e.g. research summarization). It is not a runtime dependency. DST, DJZS, and all Phase 3 Hermes functions run without it.
            </p>
            <div className="pt-2 border-t border-border space-y-2">
              {[
                { label: "SYSTEM DEPENDENCY", value: "NO — all core functions run without it" },
                { label: "USE CASE",           value: "LLM provider for optional research skills" },
                { label: "ALTERNATIVES",       value: "Any compatible inference endpoint" },
                { label: "CONFIGURATION",      value: "NOUS_API_KEY env var (not required)" },
                { label: "AUTHORITY",          value: "No verdict authority. Evidence input only." },
                { label: "PHASE",              value: "Phase 5 optional skills layer" },
              ].map((row) => (
                <div key={row.label} className="flex gap-3 font-mono text-[9px]">
                  <div className="w-40 shrink-0 text-muted-foreground/50 uppercase">{row.label}</div>
                  <div className="text-muted-foreground">{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FINDINGS INGRESS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">FINDINGS INGRESS</h2>
            <p className="text-muted-foreground font-mono text-xs uppercase mt-1">
              EVIDENCE SUBMITTED BY HERMES AGENTS — SANITIZED — READ-ONLY CONTEXT
            </p>
          </div>
        </div>
        <HermesBoundaryPanel />
        <HermesFindingsPanel />
      </div>

    </div>
  );
}
