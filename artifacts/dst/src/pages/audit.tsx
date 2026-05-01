import { useParams, Link } from "wouter";
import { useGetAuditByAsset, getGetAuditByAssetQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function AuditCheckBadge({ result }: { result: string }) {
  if (result === "PASS") return <Badge className="bg-[var(--color-trade-long)]/10 text-[var(--color-trade-long)] hover:bg-[var(--color-trade-long)]/20 font-mono"><CheckCircle2 className="w-3 h-3 mr-1" />PASS</Badge>;
  if (result === "FAIL") return <Badge className="bg-[var(--color-trade-short)]/10 text-[var(--color-trade-short)] hover:bg-[var(--color-trade-short)]/20 font-mono"><XCircle className="w-3 h-3 mr-1" />FAIL</Badge>;
  if (result === "WARN") return <Badge className="bg-[var(--color-trade-wait)]/10 text-[var(--color-trade-wait)] hover:bg-[var(--color-trade-wait)]/20 font-mono"><AlertTriangle className="w-3 h-3 mr-1" />WARN</Badge>;
  return <Badge className="bg-muted text-muted-foreground hover:bg-muted/80 font-mono"><Info className="w-3 h-3 mr-1" />SKIP</Badge>;
}

export default function Audit() {
  const { asset } = useParams();
  
  const { data: audit, isLoading } = useGetAuditByAsset(asset || "", { 
    query: { enabled: !!asset, queryKey: getGetAuditByAssetQueryKey(asset || "") } 
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-bold mb-2">Audit Not Found</h2>
        <p className="text-muted-foreground">Could not find audit report for {asset}</p>
        <Link href="/" className="text-primary hover:underline mt-4 inline-block">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/signal/${asset}`}>
            <div className="p-2 hover:bg-accent rounded-full transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            {asset} DJZS AUDIT
          </h1>
        </div>
        <div className="text-muted-foreground text-sm font-mono">
          GENERATED: {new Date(audit.generatedAt).toLocaleString()}
        </div>
      </div>

      <Card className="border-border bg-card border-t-4" style={{ 
        borderTopColor: audit.verdict === "PASS" ? "var(--color-trade-long)" : 
                        audit.verdict === "FAIL" ? "var(--color-trade-short)" : 
                        "var(--color-trade-wait)" 
      }}>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-sm font-mono text-muted-foreground mb-1">FINAL VERDICT</CardTitle>
            <div className={cn(
              "text-4xl font-bold font-mono",
              audit.verdict === "PASS" ? "text-[var(--color-trade-long)]" :
              audit.verdict === "FAIL" ? "text-[var(--color-trade-short)]" :
              "text-[var(--color-trade-wait)]"
            )}>
              {audit.verdict}
            </div>
          </div>
          <div className="text-right max-w-sm">
            <div className="text-sm font-mono text-muted-foreground mb-1">SUMMARY</div>
            <div className="text-sm leading-relaxed">{audit.summary}</div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 border-t border-border">
          <h3 className="text-sm font-mono text-muted-foreground mb-4">AUDIT CHECKS</h3>
          
          <div className="border border-border rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-mono font-medium w-1/4">CHECK</th>
                  <th className="px-4 py-3 text-left font-mono font-medium">RESULT</th>
                  <th className="px-4 py-3 text-left font-mono font-medium">DETAIL</th>
                  <th className="px-4 py-3 text-right font-mono font-medium">WEIGHT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audit.checks?.map((check, i) => (
                  <tr key={i} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-4 font-mono font-medium text-foreground">{check.name}</td>
                    <td className="px-4 py-4"><AuditCheckBadge result={check.result} /></td>
                    <td className="px-4 py-4 text-muted-foreground">{check.detail}</td>
                    <td className="px-4 py-4 text-right font-mono text-muted-foreground">{check.weight.toFixed(1)}</td>
                  </tr>
                ))}
                {(!audit.checks || audit.checks.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground font-mono">
                      NO AUDIT CHECKS EXECUTED
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
