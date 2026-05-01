import { useState } from "react";
import { useGetWatchlist, useAddToWatchlist, useRemoveFromWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Trash2, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Watchlist() {
  const queryClient = useQueryClient();
  const { data: watchlist, isLoading } = useGetWatchlist();
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();

  const [newAsset, setNewAsset] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.trim()) return;
    
    addMutation.mutate({ 
      data: { 
        asset: newAsset.trim().toUpperCase(),
        timeframe: "4H" 
      } 
    }, {
      onSuccess: () => {
        setNewAsset("");
        queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
      }
    });
  };

  const handleRemove = (id: number) => {
    removeMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-display text-foreground mb-1 uppercase">WATCHLIST</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase">ASSETS CURRENTLY MONITORED BY THE DST AGENT</p>
      </div>

      <div className="border border-border bg-card p-4">
        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-3">ADD ASSET</div>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input 
            type="text"
            value={newAsset}
            onChange={(e) => setNewAsset(e.target.value)}
            placeholder="e.g. SOL, DOGE" 
            className="w-64 px-3 py-2 font-mono text-sm uppercase bg-background border border-border text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
          <button 
            type="submit" 
            disabled={!newAsset.trim() || addMutation.isPending}
            className="bg-transparent border border-border text-foreground font-mono text-sm px-6 hover:border-primary hover:text-primary disabled:opacity-50 transition-colors uppercase"
          >
            ADD
          </button>
        </form>
      </div>

      <div className="border border-border bg-transparent overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">ASSET</th>
              <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">TIMEFRAME</th>
              <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">ADDED</th>
              <th className="px-4 py-3 text-right font-mono font-medium text-xs uppercase">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-transparent">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-12 rounded-none bg-muted" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-8 rounded-none bg-muted" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32 rounded-none bg-muted" /></td>
                  <td className="px-4 py-3 flex justify-end gap-2"><Skeleton className="h-8 w-8 rounded-none bg-muted" /><Skeleton className="h-8 w-8 rounded-none bg-muted" /></td>
                </tr>
              ))
            ) : watchlist?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground font-mono text-sm uppercase">
                  WATCHLIST IS EMPTY. ADD AN ASSET TO START MONITORING.
                </td>
              </tr>
            ) : (
              watchlist?.map((entry) => (
                <tr key={entry.id} className="hover:bg-card transition-colors group">
                  <td className="px-4 py-3 font-display font-bold text-lg text-foreground uppercase">{entry.asset}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground uppercase">{entry.timeframe}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground uppercase">
                    {new Date(entry.addedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/signal/${entry.asset}`}>
                        <button className="h-8 w-8 flex items-center justify-center border border-border bg-transparent text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </Link>
                      <button 
                        className="h-8 w-8 flex items-center justify-center border border-border bg-transparent text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                        onClick={() => handleRemove(entry.id)}
                        disabled={removeMutation.isPending}
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
