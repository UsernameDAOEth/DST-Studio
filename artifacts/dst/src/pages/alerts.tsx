import { useState } from "react";
import { Link } from "wouter";
import { useGetAlerts, useCreateAlert, useDeleteAlert, getGetAlertsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, ArrowRight, Bell, Activity } from "lucide-react";
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> ALERTS
          </h1>
          <p className="text-muted-foreground text-sm">Configure deterministic conditions for automated notifications.</p>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-mono text-muted-foreground">NEW ALERT RULE</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-xs font-mono text-muted-foreground">ASSET</label>
              <Input 
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                placeholder="e.g. SOL" 
                className="font-mono uppercase bg-background border-border"
                required
              />
            </div>
            <div className="space-y-2 flex-[2]">
              <label className="text-xs font-mono text-muted-foreground">CONDITION</label>
              <Select value={condition} onValueChange={setCondition} required>
                <SelectTrigger className="font-mono bg-background border-border">
                  <SelectValue placeholder="Select Condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRICE_ABOVE">PRICE ABOVE</SelectItem>
                  <SelectItem value="PRICE_BELOW">PRICE BELOW</SelectItem>
                  <SelectItem value="LONG_SIGNAL">LONG SIGNAL FIRES</SelectItem>
                  <SelectItem value="SHORT_SIGNAL">SHORT SIGNAL FIRES</SelectItem>
                  <SelectItem value="DJZS_PASS">DJZS VERDICT PASSES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(condition === "PRICE_ABOVE" || condition === "PRICE_BELOW") && (
              <div className="space-y-2 flex-[1.5]">
                <label className="text-xs font-mono text-muted-foreground">THRESHOLD (USD)</label>
                <Input 
                  type="number"
                  step="any"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="0.00" 
                  className="font-mono bg-background border-border"
                  required
                />
              </div>
            )}
            <Button 
              type="submit" 
              disabled={createMutation.isPending || !asset || !condition || ((condition === "PRICE_ABOVE" || condition === "PRICE_BELOW") && !threshold)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]"
            >
              <Plus className="w-4 h-4 mr-2" />
              CREATE
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="border border-border rounded-sm overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-mono font-medium">STATUS</th>
              <th className="px-4 py-3 text-left font-mono font-medium">ASSET</th>
              <th className="px-4 py-3 text-left font-mono font-medium">CONDITION</th>
              <th className="px-4 py-3 text-left font-mono font-medium">THRESHOLD</th>
              <th className="px-4 py-3 text-left font-mono font-medium">CREATED</th>
              <th className="px-4 py-3 text-right font-mono font-medium">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3 flex justify-end"><Skeleton className="h-8 w-8" /></td>
                </tr>
              ))
            ) : alerts?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground font-mono">
                  NO ALERTS CONFIGURED
                </td>
              </tr>
            ) : (
              alerts?.map((alert) => (
                <tr key={alert.id} className="hover:bg-accent/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        alert.active ? "bg-green-500" : "bg-muted-foreground"
                      )} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {alert.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold font-mono">{alert.asset}</td>
                  <td className="px-4 py-3 font-mono">{alert.condition.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {alert.threshold !== null && alert.threshold !== undefined ? `$${alert.threshold}` : "---"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="h-8 w-8 p-0 bg-transparent border border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDelete(alert.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
