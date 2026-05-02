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
  HermesConstraintsUpdateWaitBiasPolicy
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcessVerdictBadge } from "@/components/signal-process";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function Hermes() {
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
    triggerScan.mutate({}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHermesStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetHermesJobsQueryKey() });
      }
    });
  };

  const waitRate = status?.totalScansToday ? (status.totalWaitToday / status.totalScansToday * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* SECTION 1: STATUS BAR */}
      <div className="bg-card border border-border p-6 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-mono font-bold text-foreground tracking-tight">HERMES</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase mt-1">ORCHESTRATION RUNTIME</p>
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

        {/* Pipeline Visualization */}
        <div className="pt-2">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            <div className="flex items-center gap-3 font-mono text-xs uppercase min-w-max">
              <div className="border border-border bg-background p-3 flex flex-col items-center gap-2 w-32">
                <span className="font-bold">DEFILAMMA</span>
                <span className="text-primary">ACTIVE</span>
              </div>
              <div className="text-muted-foreground/50">→</div>
              
              <div className="border border-border bg-background p-3 flex flex-col items-center gap-2 w-32">
                <span className="font-bold">PYTH</span>
                {constraints?.pythConfidenceFilter ? (
                  <span className="text-[hsl(var(--trade-wait))]">CONDITIONAL</span>
                ) : (
                  <span className="text-muted-foreground">DISABLED</span>
                )}
              </div>
              <div className="text-muted-foreground/50">→</div>

              <div className="border border-border bg-background p-3 flex flex-col items-center gap-2 w-32">
                <span className="font-bold">BROWSERBASE</span>
                {constraints?.browserbaseTriggerPolicy === "DISABLED" ? (
                  <span className="text-muted-foreground">DISABLED</span>
                ) : (
                  <span className="text-[hsl(var(--trade-wait))]">{constraints?.browserbaseTriggerPolicy}</span>
                )}
              </div>
              <div className="text-muted-foreground/50">→</div>

              <div className="border border-primary/50 bg-primary/5 p-3 flex flex-col items-center gap-2 w-32">
                <span className="font-bold">DJZS AUDIT</span>
                <span className="text-primary font-bold">ACTIVE</span>
              </div>
              <div className="text-muted-foreground/50">→</div>

              <div className="border border-border bg-background p-3 flex flex-col items-center gap-2 w-32">
                <span className="font-bold">ROUTING</span>
                <div className="flex gap-1">
                  {constraints?.alertRouting?.telegram && <span className="text-primary">TG</span>}
                  {constraints?.alertRouting?.discord && <span className="text-primary">DC</span>}
                  {constraints?.alertRouting?.xmtp && <span className="text-primary">XMTP</span>}
                  {!constraints?.alertRouting?.telegram && !constraints?.alertRouting?.discord && !constraints?.alertRouting?.xmtp && <span className="text-muted-foreground">NONE</span>}
                </div>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground italic text-xs mt-4">
            By doctrine: most scans end in WAIT. DJZS audit is the final gate. Hermes routes — never scores.
          </p>
        </div>
      </div>

      {/* SECTION 2: GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COLUMN A: CONSTRAINTS */}
        <div className="bg-card border border-border p-6 flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-xl font-display font-bold text-foreground">SYSTEM CONSTRAINTS</h2>
            <p className="text-muted-foreground font-mono text-xs uppercase mt-1">DURABLE — NOT OPINIONS</p>
            <div className="p-3 bg-secondary border border-border mt-4 text-sm text-body">
              CONSTRAINTS control Hermes behavior. They are enforced on every scan. Add analyst notes in AGENT — not here.
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
                <Input 
                  className="col-span-2 font-mono text-sm rounded-none border-border" 
                  value={formState.preferredAssets || ""} 
                  onChange={e => setFormState({...formState, preferredAssets: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Active Timeframe</label>
                <Select value={formState.activeTimeframe} onValueChange={v => setFormState({...formState, activeTimeframe: v})}>
                  <SelectTrigger className="col-span-2 font-mono text-sm rounded-none border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    <SelectItem value="1H" className="font-mono">1H</SelectItem>
                    <SelectItem value="4H" className="font-mono">4H</SelectItem>
                    <SelectItem value="1D" className="font-mono">1D</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Min R/R Threshold</label>
                <Input 
                  type="number" step="0.1"
                  className="col-span-2 font-mono text-sm rounded-none border-border" 
                  value={formState.minRRThreshold || 0} 
                  onChange={e => setFormState({...formState, minRRThreshold: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Late Entry ATR Mult</label>
                <Input 
                  type="number" step="0.1"
                  className="col-span-2 font-mono text-sm rounded-none border-border" 
                  value={formState.lateEntryAtrMultiplier || 0} 
                  onChange={e => setFormState({...formState, lateEntryAtrMultiplier: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Wait Bias Policy</label>
                <Select value={formState.waitBiasPolicy} onValueChange={v => setFormState({...formState, waitBiasPolicy: v})}>
                  <SelectTrigger className="col-span-2 font-mono text-sm rounded-none border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    <SelectItem value="STRICT" className="font-mono">STRICT</SelectItem>
                    <SelectItem value="STANDARD" className="font-mono">STANDARD</SelectItem>
                    <SelectItem value="RELAXED" className="font-mono">RELAXED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Browserbase Trigger</label>
                <Select value={formState.browserbaseTriggerPolicy} onValueChange={v => setFormState({...formState, browserbaseTriggerPolicy: v})}>
                  <SelectTrigger className="col-span-2 font-mono text-sm rounded-none border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    <SelectItem value="DISABLED" className="font-mono">DISABLED</SelectItem>
                    <SelectItem value="HIGH_CONFIDENCE" className="font-mono">HIGH_CONFIDENCE</SelectItem>
                    <SelectItem value="APPROVED_ONLY" className="font-mono">APPROVED_ONLY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 items-center gap-4 pt-2 border-t border-border">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Pyth Confidence Filter</label>
                <div className="col-span-2 flex items-center h-10">
                  <Switch 
                    checked={formState.pythConfidenceFilter} 
                    onCheckedChange={v => setFormState({...formState, pythConfidenceFilter: v})} 
                  />
                </div>
              </div>

              {formState.pythConfidenceFilter && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground">Pyth Confidence Thr.</label>
                  <Input 
                    type="number" step="0.01" max="1" min="0"
                    className="col-span-2 font-mono text-sm rounded-none border-border" 
                    value={formState.pythConfidenceThreshold || 0} 
                    onChange={e => setFormState({...formState, pythConfidenceThreshold: e.target.value})} 
                  />
                </div>
              )}

              <div className="grid grid-cols-3 items-start gap-4 pt-2 border-t border-border">
                <label className="col-span-1 text-xs font-mono uppercase text-muted-foreground pt-2">Alert Routing</label>
                <div className="col-span-2 space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">Telegram</span>
                    <Switch checked={formState.alertRouting?.telegram} onCheckedChange={v => setFormState({...formState, alertRouting: {...formState.alertRouting, telegram: v}})} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">XMTP</span>
                    <Switch checked={formState.alertRouting?.xmtp} onCheckedChange={v => setFormState({...formState, alertRouting: {...formState.alertRouting, xmtp: v}})} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">Discord</span>
                    <Switch checked={formState.alertRouting?.discord} onCheckedChange={v => setFormState({...formState, alertRouting: {...formState.alertRouting, discord: v}})} />
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-auto">
                <div className="flex items-center justify-between">
                  {saveSuccess ? (
                    <span className="text-primary font-mono text-sm uppercase">CONSTRAINTS UPDATED</span>
                  ) : <span />}
                  <button 
                    onClick={handleSave}
                    disabled={updateConstraints.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 font-mono text-sm uppercase disabled:opacity-50 transition-colors"
                  >
                    {updateConstraints.isPending ? "SAVING..." : "SAVE CONSTRAINTS"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMN B: ROLES & JOBS */}
        <div className="flex flex-col gap-6">
          {/* ROLES */}
          <div className="bg-card border border-border p-6">
            <h2 className="text-xl font-display font-bold text-foreground mb-4">SUBAGENT ROLES</h2>
            
            <div className="space-y-3">
              {[
                { name: "MARKET CONTEXT", tool: "DEFILAMMA API", purpose: "4H price history, regime, TVL context", status: "ACTIVE" },
                { name: "PRICE CONFIDENCE", tool: "PYTH NETWORK", purpose: "Live price + confidence interval overlay", status: constraints?.pythConfidenceFilter ? "CONDITIONAL" : "DISABLED" },
                { name: "WEB RESEARCH", tool: "BROWSERBASE", purpose: "Triggered narrative check on high-interest setups", status: constraints?.browserbaseTriggerPolicy !== "DISABLED" ? "CONDITIONAL" : "DISABLED" },
                { name: "AUDIT AGENT", tool: "DJZS (DETERMINISTIC)", purpose: "Admissibility gate. Not an opinion. Final.", status: "ACTIVE_FINAL" },
                { name: "ROUTING AGENT", tool: "TG / XMTP / DC", purpose: "Delivers APPROVED packets to configured channels", status: (constraints?.alertRouting?.telegram || constraints?.alertRouting?.discord || constraints?.alertRouting?.xmtp) ? "CONDITIONAL" : "DISABLED" },
              ].map((role, i) => (
                <div key={i} className={cn("p-3 border flex flex-col gap-2", role.status === "ACTIVE_FINAL" ? "border-primary/50 bg-primary/5" : "border-border bg-background")}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-mono text-sm font-bold">{role.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">TOOL: {role.tool}</div>
                    </div>
                    {role.status === "ACTIVE" ? <span className="chip-pass">ACTIVE</span> :
                     role.status === "ACTIVE_FINAL" ? <span className="chip-pass font-bold">ACTIVE</span> :
                     role.status === "CONDITIONAL" ? <span className="chip-warn">CONDITIONAL</span> :
                     <span className="chip-neutral">DISABLED</span>}
                  </div>
                  <div className="text-xs text-body">{role.purpose}</div>
                </div>
              ))}
            </div>
            
            <p className="text-muted-foreground italic text-xs mt-4">
              Final judgment is always DJZS deterministic audit. Subagent outputs are inputs — not votes.
            </p>
          </div>

          {/* JOBS */}
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
                                <div key={i} className={cn(
                                  "w-2 h-2 rounded-full",
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

      {/* SECTION 3: STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-5 flex flex-col gap-2">
          <div className="text-xs font-mono uppercase text-muted-foreground">SCANS TODAY</div>
          <div className="text-3xl font-mono text-primary">{status?.totalScansToday || 0}</div>
        </div>
        
        <div className="bg-card border border-border p-5 flex flex-col gap-2">
          <div className="text-xs font-mono uppercase text-muted-foreground">WAIT RATE TODAY</div>
          <div className={cn(
            "text-3xl font-mono",
            waitRate > 70 ? "text-primary" : waitRate >= 50 ? "text-[hsl(var(--trade-wait))]" : "text-destructive"
          )}>
            {waitRate.toFixed(0)}%
          </div>
        </div>

        <div className="bg-card border border-border p-5 flex flex-col gap-2">
          <div className="text-xs font-mono uppercase text-muted-foreground">APPROVED TODAY</div>
          <div className={cn(
            "text-3xl font-mono",
            (status?.totalApprovedToday || 0) > 0 ? "text-primary" : "text-muted-foreground"
          )}>
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
      
    </div>
  );
}
