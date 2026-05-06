import { useGetDstPipelineHealth } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export function PipelineHealthChip() {
  const { data, isLoading } = useGetDstPipelineHealth();

  if (isLoading || !data) return null;

  const { longCount, shortCount, shortShareOfDirectional, shortPipelineBroken } = data;
  const sharePct = (shortShareOfDirectional * 100).toFixed(0);

  return (
    <div
      className={cn(
        "terminal-panel flex items-center gap-3 px-3 py-2",
        shortPipelineBroken && "border-destructive/60",
      )}
    >
      <div className="micro-label text-muted-foreground">PIPELINE 7D</div>
      <div className="font-mono text-[10px] text-foreground mono-nums">
        L:{longCount} <span className="text-muted-foreground">/</span> S:{shortCount}{" "}
        <span className="text-muted-foreground">·</span> SHORT {sharePct}%
      </div>
      {shortPipelineBroken && (
        <div className="flex items-center gap-1 text-destructive">
          <AlertTriangle className="w-3 h-3" />
          <span className="micro-label">SHORT PIPELINE BROKEN</span>
        </div>
      )}
    </div>
  );
}
