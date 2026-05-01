import { useState } from "react";
import { useGetAlerts, useCreateAlert, useDeleteAlert, getGetAlertsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function Alerts() {
  const queryClient = useQueryClient();
  const { data: alerts, isLoading } = useGetAlerts();
  const createMutation = useCreateAlert();
  const deleteMutation = useDeleteAlert();

  const [asset, setAsset] = useState("");
  const [condition, setCondition] = useState<string>("PRICE_ABOVE");
  const [threshold, setThreshold] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset.trim() || !condition) return;
    
    createMutation.mutate({ 
      data: { 
        asset: asset.trim().toUpperCase(),
        condition: condition as any,
        threshold: threshold ? parseFloat(threshold) : undefined
      } 
    }, {
      onSuccess: () => {
        setAsset("");
        setThreshold("");
        queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-display text-foreground mb-1 uppercase">ALERTS</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase">CONFIGURE DETERMINISTIC CONDITIONS FOR AUTOMATED NOTIFICATIONS.</p>
      </div>

      <div className="border border-border bg-card p-4">
        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-4">NEW ALERT RULE</div>
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-1.5 flex-1">
            <label className="text-[10px] font-mono text-muted-foreground uppercase">ASSET</label>
            <input 
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="e.g. SOL" 
              className="w-full px-3 py-2 font-mono text-sm uppercase bg-background border border-border text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
              required
            />
          </div>
          <div className="space-y-1.5 flex-[2]">
            <label className="text-[10px] font-mono text-muted-foreground uppercase">CONDITION</label>
            <select 
              value={condition} 
              onChange={(e) => setCondition(e.target.value)} 
              className="w-full px-3 py-2 font-mono text-sm uppercase bg-background border border-border text-foreground focus:outline-none focus:border-primary appearance-none rounded-none"
              required
            >
              <option value="PRICE_ABOVE">PRICE ABOVE</option>
              <option value="PRICE_BELOW">PRICE BELOW</option>
              <option value="LONG_SIGNAL">LONG SIGNAL FIRES</option>
              <option value="SHORT_SIGNAL">SHORT SIGNAL FIRES</option>
              <option value="DJZS_PASS">DJZS VERDICT PASSES</option>
            </select>
          </div>
          {(condition === "PRICE_ABOVE" || condition === "PRICE_BELOW") && (
            <div className="space-y-1.5 flex-[1.5]">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">THRESHOLD (USD)</label>
              <input 
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="0.00" 
                className="w-full px-3 py-2 font-mono text-sm uppercase bg-background border border-border text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                required
              />
            </div>
          )}
          <button 
            type="submit" 
            disabled={createMutation.isPending || !asset || !condition || ((condition === "PRICE_ABOVE" || condition === "PRICE_BELOW") && !threshold)}
            className="bg-transparent border border-border text-foreground font-mono text-sm px-8 py-2 hover:border-primary hover:text-primary disabled:opacity-50 transition-colors uppercase h-[38px]"
          >
            CREATE
          </button>
        </form>
      </div>

      <div className="border border-border bg-transparent overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase w-12">STATUS</th>
              <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">ASSET</th>
              <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">CONDITION</th>
              <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">THRESHOLD</th>
              <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">CREATED</th>
              <th className="px-4 py-3 text-right font-mono font-medium text-xs uppercase">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-transparent">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-4 rounded-none bg-muted" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-12 rounded-none bg-muted" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24 rounded-none bg-muted" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16 rounded-none bg-muted" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32 rounded-none bg-muted" /></td>
                  <td className="px-4 py-3 flex justify-end"><Skeleton className="h-8 w-8 rounded-none bg-muted" /></td>
                </tr>
              ))
            ) : alerts?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground font-mono text-sm uppercase">
                  NO ALERTS CONFIGURED
                </td>
              </tr>
            ) : (
              alerts?.map((alert) => (
                <tr key={alert.id} className="hover:bg-card transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-none",
                        alert.active ? "bg-primary" : "bg-muted-foreground"
                      )} />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-display font-bold text-foreground uppercase">{alert.asset}</td>
                  <td className="px-4 py-3">
                    <span className="chip-reason">{alert.condition.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground uppercase">
                    {alert.threshold !== null && alert.threshold !== undefined ? `$${alert.threshold}` : "---"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground uppercase">
                    {new Date(alert.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button 
                        className="h-8 w-8 flex items-center justify-center border border-transparent bg-transparent text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                        onClick={() => handleDelete(alert.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-8 mt-8 border-t border-border flex flex-col md:flex-row justify-between text-xs font-mono text-muted-foreground uppercase">
        <div>DST SIGNAL LAYER — PAPER MODE ONLY</div>
        <div>DJZS AUDIT PROTOCOL — NOT FINANCIAL ADVICE</div>
      </div>
    </div>
  );
}
