import { useState } from "react";
import { useGetWatchlist, useAddToWatchlist, useRemoveFromWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Trash2, Plus, ArrowRight, Eye } from "lucide-react";
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">WATCHLIST</h1>
        <p className="text-muted-foreground text-sm">Assets currently monitored by the DST agent.</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-mono text-muted-foreground">ADD ASSET</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input 
              value={newAsset}
              onChange={(e) => setNewAsset(e.target.value)}
              placeholder="e.g. SOL, DOGE, ARB" 
              className="max-w-xs font-mono uppercase bg-background border-border"
            />
            <Button 
              type="submit" 
              disabled={!newAsset.trim() || addMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              ADD
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="border border-border rounded-sm overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-mono font-medium">ASSET</th>
              <th className="px-4 py-3 text-left font-mono font-medium">TIMEFRAME</th>
              <th className="px-4 py-3 text-left font-mono font-medium">ADDED</th>
              <th className="px-4 py-3 text-right font-mono font-medium">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3 flex justify-end gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></td>
                </tr>
              ))
            ) : watchlist?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Watchlist is empty. Add an asset to start monitoring.
                </td>
              </tr>
            ) : (
              watchlist?.map((entry) => (
                <tr key={entry.id} className="hover:bg-accent/30 transition-colors group">
                  <td className="px-4 py-3 font-bold font-mono text-lg">{entry.asset}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{entry.timeframe}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {new Date(entry.addedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/signal/${entry.asset}`}>
                        <Button variant="outline" size="sm" className="h-8 border-border bg-background hover:bg-secondary">
                          <ArrowRight className="w-4 h-4 mr-1" />
                          SIGNAL
                        </Button>
                      </Link>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="h-8"
                        onClick={() => handleRemove(entry.id)}
                        disabled={removeMutation.isPending}
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
