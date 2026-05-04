import { useParams, Link, useSearch } from "wouter";
import { useGetAuditByAsset, getGetAuditByAssetQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerdictBadge, verdictTextClass, verdictBorderColor } from "@/components/signal-process";

export default function Audit() {
  const { asset } = useParams();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const signalId = searchParams.get("signalId");

  const queryParams = signalId ? { signalId: Number(signalId) } : undefined;

  const { data: audit, isLoading } = useGetAuditByAsset(asset || "", queryParams, {
    query: {
      enabled: !!asset,
      queryKey: getGetAuditByAssetQueryKey(asset || "", queryParams),
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-none bg-muted" />
        <Skeleton className="h-[500px] w-full rounded-none bg-muted" />
      </div>
    );
  }

  if (!audit) {
    return (
      <Empty className="max-w-md mx-auto mt-16 border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldOff className="w-5 h-5" />
          </EmptyMedia>
          <EmptyTitle className="font-mono text-sm uppercase tracking-widest">
            AUDIT NOT FOUND
          </EmptyTitle>
          <EmptyDescription className="font-mono text-[10px] uppercase tracking-wider">
            Could not find audit report for {asset}
          </EmptyDescription>
        </EmptyHeader>
        <Link href="/" className="text-primary hover:underline font-mono text-xs uppercase tracking-wider">
          RETURN TO DASHBOARD
        </Link>
      </Empty>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="pb-4 border-b border-border flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href={`/signal/${asset}`}>
              <div className="p-1 border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </div>
            </Link>
            <h1 className="text-2xl tracking-widest text-foreground">
              {asset} DJZS AUDIT
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-xs uppercase">
            DJZS PROTOCOL // RISK AUDIT
          </p>
        </div>
        <div className="flex items-center gap-3">
          {audit.pinned && audit.pinnedSignalId && (
            <span className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest">
              PINNED TO SIGNAL #{audit.pinnedSignalId}
            </span>
          )}
          <span className="text-muted-foreground text-xs font-mono uppercase">
            GENERATED: {new Date(audit.generatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="border-l-[1px] bg-card" style={{
        borderLeftColor: verdictBorderColor(audit.verdict || "")
      }}>
        <div className="p-8 border border-l-0 border-border">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8">
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-2 uppercase">DJZS VERDICT</div>
              <div className={cn(
                "text-[64px] leading-none font-bold font-mono tracking-tight uppercase",
                verdictTextClass(audit.verdict || "")
              )}>
                {audit.verdict}
              </div>
            </div>
            <div className="md:max-w-md">
              <div className="text-xs font-mono text-muted-foreground mb-2 uppercase">SUMMARY</div>
              <div className="font-mono text-xs text-muted-foreground leading-relaxed">{audit.summary}</div>
            </div>
          </div>

          <div className="border border-border bg-transparent overflow-hidden mt-8">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase w-1/4">CHECK</th>
                  <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">RESULT</th>
                  <th className="px-4 py-3 text-left font-mono font-medium text-xs uppercase">DETAIL</th>
                  <th className="px-4 py-3 text-right font-mono font-medium text-xs uppercase">WEIGHT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-transparent">
                {audit.checks?.map((check, i) => (
                  <tr key={i} className="hover:bg-card">
                    <td className="px-4 py-4 font-mono text-foreground uppercase">{check.name}</td>
                    <td className="px-4 py-4"><VerdictBadge value={check.result} /></td>
                    <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{check.detail}</td>
                    <td className="px-4 py-4 text-right font-mono text-muted-foreground">{check.weight.toFixed(1)}</td>
                  </tr>
                ))}
                {(!audit.checks || audit.checks.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground font-mono text-xs uppercase">
                      NO AUDIT CHECKS EXECUTED
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pt-8 mt-8 border-t border-border flex flex-col md:flex-row justify-between text-xs font-mono text-muted-foreground uppercase">
        <div>DST SIGNAL LAYER — PAPER MODE ONLY</div>
        <div>DJZS PROTOCOL v1 — NOT FINANCIAL ADVICE</div>
      </div>
    </div>
  );
}
