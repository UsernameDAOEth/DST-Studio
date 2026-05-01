import { useParams, Link } from "wouter";
import { useGetAuditByAsset, getGetAuditByAssetQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

function AuditCheckChip({ result }: { result: string }) {
  if (result === "PASS") return <span className="chip-pass">PASS</span>;
  if (result === "FAIL") return <span className="chip-fail">FAIL</span>;
  if (result === "WARN") return <span className="chip-warn">WARN</span>;
  return <span className="chip-skip">SKIP</span>;
}

export default function Audit() {
  const { asset } = useParams();
  
  const { data: audit, isLoading } = useGetAuditByAsset(asset || "", { 
    query: { enabled: !!asset, queryKey: getGetAuditByAssetQueryKey(asset || "") } 
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
      <div className="text-center p-12">
        <h2 className="text-2xl font-display mb-2">AUDIT NOT FOUND</h2>
        <p className="text-muted-foreground font-mono text-sm uppercase">COULD NOT FIND AUDIT REPORT FOR {asset}</p>
        <Link href="/" className="text-primary hover:underline mt-4 inline-block font-mono text-sm uppercase">RETURN TO DASHBOARD</Link>
      </div>
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
            <h1 className="text-2xl font-display text-foreground">
              {asset} DJZS AUDIT
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-xs uppercase">
            DJZS PROTOCOL // RISK AUDIT
          </p>
        </div>
        <div className="text-muted-foreground text-xs font-mono uppercase">
          GENERATED: {new Date(audit.generatedAt).toLocaleString()}
        </div>
      </div>

      <div className="border-l-[1px] bg-card" style={{ 
        borderLeftColor: audit.verdict === "PASS" ? "var(--color-primary)" : 
                        audit.verdict === "FAIL" ? "var(--color-destructive)" : 
                        "hsl(var(--trade-wait))" 
      }}>
        <div className="p-8 border border-l-0 border-border">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8">
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-2 uppercase">FINAL VERDICT</div>
              <div className={cn(
                "text-[64px] leading-none font-bold font-display tracking-tight uppercase",
                audit.verdict === "PASS" ? "text-primary" :
                audit.verdict === "FAIL" ? "text-destructive" :
                "text-[hsl(var(--trade-wait))]"
              )}>
                {audit.verdict}
              </div>
            </div>
            <div className="md:max-w-md">
              <div className="text-xs font-mono text-muted-foreground mb-2 uppercase">SUMMARY</div>
              <div className="text-body leading-relaxed">{audit.summary}</div>
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
                    <td className="px-4 py-4"><AuditCheckChip result={check.result} /></td>
                    <td className="px-4 py-4 text-body">{check.detail}</td>
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
