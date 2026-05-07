import { useQueryClient } from "@tanstack/react-query";
import { useGetIntegrations, getGetIntegrationsQueryKey, useToggleIntegration, useGetPythPrices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export default function Integrations() {
  const queryClient = useQueryClient();
  const { data: integrations, isLoading } = useGetIntegrations();
  const { data: pythPrices, isLoading: isLoadingPyth } = useGetPythPrices();
  const toggleMutation = useToggleIntegration();

  const handleToggle = (name: string) => {
    toggleMutation.mutate({ name }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-display text-foreground mb-1">INTEGRATIONS</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase">SYSTEM EXPANSION SCAFFOLD — PHASE 2 / 3 / 4</p>
      </div>

      {/* ARCHITECTURE MODEL */}
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold text-foreground uppercase tracking-widest">INTEGRATION ARCHITECTURE MODEL</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              How external systems connect to DST/Hermes — and where they sit in the authority chain
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-border text-[10px] font-mono">
          <div className="bg-secondary px-3 py-2 font-bold text-muted-foreground uppercase">INTEGRATION TIER</div>
          <div className="bg-secondary px-3 py-2 font-bold text-muted-foreground uppercase">ROLE</div>
          <div className="bg-secondary px-3 py-2 font-bold text-muted-foreground uppercase">AUTHORITY</div>
          <div className="bg-secondary px-3 py-2 font-bold text-muted-foreground uppercase">SCOPE TOKEN</div>
          <div className="bg-secondary px-3 py-2 font-bold text-muted-foreground uppercase">PHASE</div>
          {[
            { tier: "DEFILAMMA",           role: "Primary data layer — market data, regime, indicators",         authority: "REQUIRED INPUT",       scope: "N/A — always loaded",        phase: "CORE"     },
            { tier: "PYTH NETWORK",        role: "Price confidence overlay — degrades but never approves",       authority: "EVIDENCE ONLY",        scope: "pyth:read",                  phase: "PHASE 3"  },
            { tier: "BROWSERBASE",         role: "Triggered narrative research — full sanitize before evidence", authority: "EVIDENCE ONLY",        scope: "browserbase:fetch",          phase: "PHASE 4"  },
            { tier: "TELEGRAM / XMTP / DC",role: "Alert delivery — post-DJZS approved packets only",            authority: "ROUTING ONLY",         scope: "telegram/xmtp/discord:write", phase: "PHASE 4"  },
            { tier: "NOUS PORTAL",         role: "Optional LLM provider for Hermes agent research layer",       authority: "NO AUTHORITY",         scope: "N/A — evidence input only",  phase: "OPTIONAL" },
            { tier: "MCP TOOLS",           role: "Controlled codebase inspection — read-only, human-gated",     authority: "READ / HUMAN-GATED",   scope: "mcp:inspect (never auto-granted)", phase: "PHASE 5"  },
          ].map((row, i) => (
            <div key={i} className="contents">
              <div className={cn("px-3 py-2 font-bold text-foreground", i % 2 === 0 ? "bg-card" : "bg-background")}>{row.tier}</div>
              <div className={cn("px-3 py-2 text-muted-foreground", i % 2 === 0 ? "bg-card" : "bg-background")}>{row.role}</div>
              <div className={cn("px-3 py-2 text-muted-foreground/70", i % 2 === 0 ? "bg-card" : "bg-background")}>{row.authority}</div>
              <div className={cn("px-3 py-2", i % 2 === 0 ? "bg-card" : "bg-background")}>
                <span className={cn("font-mono text-[9px]",
                  row.scope.startsWith("N/A") ? "text-muted-foreground/30" :
                  row.scope.includes("never") ? "text-muted-foreground/50 italic" :
                  "text-primary/60"
                )}>{row.scope}</span>
              </div>
              <div className={cn("px-3 py-2", i % 2 === 0 ? "bg-card" : "bg-background")}>
                <span className={cn(
                  "chip text-[9px]",
                  row.phase === "CORE" ? "chip-pass" :
                  row.phase === "PHASE 3" ? "chip-warn" :
                  row.phase === "OPTIONAL" ? "chip-neutral" : "chip-neutral opacity-70"
                )}>{row.phase}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="font-mono text-[9px] text-muted-foreground/50 italic border-t border-border pt-3">
          No integration has scoring or verdict authority. DJZS is the only authority in the system. Scope tokens are granted via runtime constraints and can be revoked instantly. Coding and repo-assistance integrations are permanently deferred from the Hermes runtime.
        </p>
      </div>

      {/* HERMES SECURITY BOUNDARY */}
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold text-foreground uppercase tracking-widest">HERMES SECURITY BOUNDARY</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Safeguards enforced at runtime — not configurable — not bypassable by any integration
            </p>
          </div>
          <span className="chip-pass text-[9px]">ENFORCED</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {[
            {
              label: "SCOPE TOKEN SYSTEM",
              desc: "Every optional skill requires a scope token granted by runtime constraints. No token = skill does not run. Revocation is immediate on next scan cycle.",
              status: "ACTIVE",
            },
            {
              label: "VERDICT IMMUTABILITY GATE",
              desc: "DJZS verdict payload is sealed at submission. Hermes cannot read, modify, or re-submit after the gate closes. Verdict is recorded as-is in the action log.",
              status: "ACTIVE",
            },
            {
              label: "SKILL OUTPUT SANITIZATION",
              desc: "All untrusted skill output (Browserbase HTML, MCP tool output, webhooks) is stripped, schema-validated, and truncated before entering any evidence bundle.",
              status: "ACTIVE",
            },
            {
              label: "APPEND-ONLY ACTION LOG",
              desc: "Every Hermes runtime action is logged with scope token, sanitize verdict, and outcome. Log is append-only with hash-chain tamper detection. Phase 4 implementation.",
              status: "PLANNED",
            },
          ].map((item) => (
            <div key={item.label} className="bg-card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="font-mono text-[10px] font-bold text-foreground uppercase">{item.label}</div>
                <span className={cn("text-[9px] shrink-0 ml-2", item.status === "ACTIVE" ? "chip-pass" : "chip-neutral opacity-70")}>{item.status}</span>
              </div>
              <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="border border-[hsl(var(--trade-wait))]/20 bg-[hsl(var(--trade-wait))]/5 px-4 py-3">
          <span className="font-mono text-[9px] text-[hsl(var(--trade-wait))]/70 font-bold uppercase">DEFERRED: </span>
          <span className="font-mono text-[9px] text-muted-foreground/60">CODING_ASSISTANT and REPO_ASSISTANT skills are permanently excluded from the Hermes integration surface. Hermes is an audit-before-act orchestrator — not an engineering agent. See the Skills Manifest tab on the Hermes page for full deferral details.</span>
        </div>
      </div>

      {/* LIVE INTEGRATION DATA */}
      <div className="space-y-4">
        <h2 className="text-sm font-mono text-muted-foreground uppercase">LIVE INTEGRATION DATA</h2>
        
        <Card className="border-border bg-card">
          <CardHeader className="px-6 py-4 border-b border-border">
            <CardTitle className="text-lg font-display text-foreground">PYTH NETWORK — LIVE DATA</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingPyth ? (
              <div className="p-6"><Skeleton className="h-20 w-full" /></div>
            ) : (!pythPrices || pythPrices.length === 0) ? (
              <div className="p-6 text-muted-foreground font-mono text-sm">
                <span className="text-[hsl(var(--trade-wait))]">PYTH UNAVAILABLE</span> — using DefiLlama prices
              </div>
            ) : (
              <table className="w-full text-sm font-mono text-left">
                <thead className="bg-secondary text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-6 py-2 font-medium uppercase text-xs">ASSET</th>
                    <th className="px-6 py-2 font-medium uppercase text-xs">PRICE</th>
                    <th className="px-6 py-2 font-medium uppercase text-xs">CONFIDENCE ±</th>
                    <th className="px-6 py-2 font-medium uppercase text-xs">STATUS</th>
                    <th className="px-6 py-2 font-medium uppercase text-xs">FRESH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pythPrices.map(price => (
                    <tr key={price.asset} className="hover:bg-muted/50">
                      <td className="px-6 py-3 font-bold text-foreground">{price.asset}</td>
                      <td className="px-6 py-3">{formatCurrency(price.price)}</td>
                      <td className="px-6 py-3 text-muted-foreground">
                        ±{formatCurrency(price.confidence)} ({(price.confidenceRatio * 100).toFixed(2)}%)
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn(
                          "chip",
                          price.confidenceStatus === "HIGH" ? "chip-pass" :
                          price.confidenceStatus === "MEDIUM" ? "chip-warn" : "chip-fail"
                        )}>{price.confidenceStatus}</span>
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">
                        {price.fresh ? "FRESH" : "STALE"} • {new Date(price.publishTime).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NOUS PORTAL — OPTIONAL PROVIDER */}
      <div className="bg-card border border-border p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold text-foreground uppercase tracking-widest">NOUS PORTAL — OPTIONAL PROVIDER BACKEND</h2>
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Optional LLM inference backend for Hermes agent layer — not a system dependency
            </p>
          </div>
          <span className="chip-neutral text-[9px]">OPTIONAL</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Nous Portal can serve as the LLM inference backend for any AI-assisted Hermes capabilities — such as research summarization, finding interpretation, or agent-assisted constraint review. It is not required for any Phase 3 functionality.
            </p>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              DST signal computation, DJZS audit, Hermes scan orchestration, Pyth integration, and all core runtime functions operate entirely without Nous Portal or any LLM provider. It becomes relevant only when optional agent skills (Phase 5) are activated.
            </p>
          </div>
          <div className="border border-border bg-background p-4 space-y-2">
            {[
              { label: "SYSTEM DEPENDENCY", value: "NONE — core functions run without it", ok: true },
              { label: "USE CASE", value: "LLM provider for optional Hermes agent layer", ok: true },
              { label: "ALTERNATIVES", value: "Any compatible inference endpoint (OpenAI, Anthropic, etc.)", ok: true },
              { label: "ENV KEY", value: "NOUS_API_KEY (not required in Phase 3)", ok: false },
              { label: "AUTHORITY", value: "No verdict authority. Evidence input only.", ok: true },
              { label: "PHASE", value: "Phase 5 — optional skills layer", ok: false },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-3 font-mono text-[9px]">
                <div className="w-32 shrink-0 text-muted-foreground/50 uppercase">{row.label}</div>
                <div className={row.ok ? "text-muted-foreground" : "text-muted-foreground/50"}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-body max-w-3xl leading-relaxed">
        The following integrations are scaffolded and ready for activation. Each is disabled by default and requires credentials or configuration. Enabling here toggles in-memory state only — no live connections are made until credentials are configured.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-1/2 bg-muted rounded-none" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full bg-muted rounded-none" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations?.map(integration => (
            <Card key={integration.name} className="border-border bg-card flex flex-col h-full hover:border-border/80 transition-colors">
              <CardHeader className="px-6 py-4 border-b border-border">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <CardTitle className="text-lg font-display text-foreground">
                      {integration.displayName}
                    </CardTitle>
                    <span className="chip-neutral opacity-80">{integration.category}</span>
                  </div>
                  <span className="chip-neutral opacity-60 text-[10px]">{integration.phase}</span>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 flex-1 flex flex-col gap-4">
                <div className="flex items-center">
                  {integration.status === "ACTIVE" ? <span className="chip-pass">ACTIVE</span> :
                   integration.status === "DISABLED" ? <span className="chip-neutral">DISABLED</span> :
                   integration.status === "NOT_CONFIGURED" ? <span className="chip-warn">NOT_CONFIGURED</span> :
                   <span className="chip-neutral">{integration.status}</span>}
                </div>
                
                <p className="text-sm text-body leading-relaxed flex-1">
                  {integration.description}
                </p>

                {integration.name === "pyth" && pythPrices && pythPrices.length > 0 && (
                  <div className="p-3 bg-secondary/50 border border-border rounded-none space-y-1">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase">Live API Preview</div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="font-bold">{pythPrices[0].asset}</span>
                      <span className="text-primary">{formatCurrency(pythPrices[0].price)}</span>
                    </div>
                  </div>
                )}

                {(integration.name === "telegram" || integration.name === "agentmail") && integration.deliveryStatus && (
                  <div className="p-3 bg-secondary/50 border border-border rounded-none space-y-1.5">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase">Delivery Telemetry</div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">DELIVERED</span>
                      <span className="text-primary">{integration.deliveryStatus.totalDeliveries}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">ERRORS</span>
                      <span className={integration.deliveryStatus.totalErrors > 0 ? "text-destructive" : "text-muted-foreground/60"}>
                        {integration.deliveryStatus.totalErrors}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">LAST OK</span>
                      <span className="text-foreground">
                        {integration.deliveryStatus.lastSuccessAt
                          ? new Date(integration.deliveryStatus.lastSuccessAt).toLocaleTimeString()
                          : "—"}
                      </span>
                    </div>
                    {integration.deliveryStatus.lastError && (
                      <div className="text-[10px] font-mono text-destructive break-all">
                        ERR: {integration.deliveryStatus.lastError}
                      </div>
                    )}
                    {!integration.configured && integration.name === "telegram" && (
                      <div className="text-[10px] font-mono text-[hsl(var(--trade-wait))]">
                        Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to activate.
                      </div>
                    )}
                    {!integration.configured && integration.name === "agentmail" && (
                      <div className="text-[10px] font-mono text-[hsl(var(--trade-wait))]">
                        Set AGENTMAIL_API_KEY and AGENTMAIL_TO to activate.
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  {integration.envKeyRequired && (
                    <div className="text-xs font-mono text-destructive/80">
                      REQUIRES: {integration.envKeyRequired}
                    </div>
                  )}
                  {integration.docsUrl && (
                    <div>
                      <a href={integration.docsUrl} target="_blank" rel="noreferrer" className="text-xs font-mono text-primary hover:underline">
                        DOCS →
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="p-6 pt-0 mt-auto">
                <button
                  onClick={() => handleToggle(integration.name)}
                  disabled={toggleMutation.isPending}
                  className={cn(
                    "w-full py-2 font-mono text-xs uppercase transition-colors border",
                    integration.enabled 
                      ? "border-destructive text-destructive hover:bg-destructive/10" 
                      : "border-border text-foreground hover:border-primary hover:text-primary",
                    toggleMutation.isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {integration.enabled ? "DISABLE" : "ENABLE"}
                </button>
              </CardFooter>
            </Card>
          ))}
          {integrations?.length === 0 && (
            <div className="col-span-1 md:col-span-2 p-8 text-center text-muted-foreground font-mono text-sm border border-border">
              NO INTEGRATIONS FOUND
            </div>
          )}
        </div>
      )}
    </div>
  );
}
