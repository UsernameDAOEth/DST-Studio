import { useState } from "react";
import {
  getGetDstShortBottleneckQueryKey,
  useGetDstPipelineHealth,
  useGetDstShortBottleneck,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

type Bucket = { name: string; count: number };

function BucketList({ label, items }: { label: string; items: Bucket[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="micro-label text-muted-foreground mb-1">{label}</div>
      <div className="space-y-0.5">
        {items.map((b) => (
          <div
            key={b.name}
            className="font-mono text-[10px] flex justify-between gap-2 mono-nums"
          >
            <span className="truncate text-foreground">{b.name}</span>
            <span className="text-muted-foreground">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelineHealthChip() {
  const { data, isLoading } = useGetDstPipelineHealth();
  const [open, setOpen] = useState(false);

  const { data: bottleneck, isError: bottleneckError } = useGetDstShortBottleneck({
    query: { enabled: open, queryKey: getGetDstShortBottleneckQueryKey() },
  });

  if (isLoading || !data) return null;

  const { longCount, shortCount, shortShareOfDirectional, shortPipelineBroken } = data;
  const sharePct = (shortShareOfDirectional * 100).toFixed(0);

  return (
    <div
      className={cn(
        "terminal-panel",
        shortPipelineBroken && "border-destructive/60",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="micro-label text-muted-foreground">PIPELINE 7D</div>
        <div className="font-mono text-[10px] text-foreground mono-nums">
          L:{longCount} <span className="text-muted-foreground">/</span> S:{shortCount}{" "}
          <span className="text-muted-foreground">·</span> SHORT {sharePct}%
        </div>
        {shortPipelineBroken && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-destructive hover:opacity-80"
            aria-expanded={open}
            data-testid="short-bottleneck-toggle"
          >
            <AlertTriangle className="w-3 h-3" />
            <span className="micro-label">SHORT PIPELINE BROKEN</span>
            {open ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      {shortPipelineBroken && open && (
        <div
          className="border-t border-border px-3 py-2 space-y-2"
          data-testid="short-bottleneck-panel"
        >
          {!bottleneck && !bottleneckError && (
            <div className="font-mono text-[10px] text-muted-foreground">
              loading bottleneck breakdown…
            </div>
          )}
          {bottleneckError && (
            <div className="font-mono text-[10px] text-destructive">
              failed to load bottleneck breakdown — retry by collapsing and reopening
            </div>
          )}
          {bottleneck && (
            <>
              <div className="font-mono text-[10px] text-foreground">
                {bottleneck.totalShorts} SHORTs · {bottleneck.approvedShorts} approved
                {bottleneck.topBlocker && (
                  <>
                    {" · top blocker "}
                    <span className="text-destructive">{bottleneck.topBlocker}</span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <BucketList label="REJECTION CODES" items={bottleneck.rejectionCodes} />
                <BucketList label="FAILING CHECKS" items={bottleneck.failingChecks} />
                <BucketList label="REASON CODES" items={bottleneck.reasonCodes} />
                <BucketList label="SETUP FAMILIES" items={bottleneck.setupFamilies} />
                <BucketList label="SKIPPED CHECKS" items={bottleneck.skippedChecks} />
                <BucketList label="VERDICTS" items={bottleneck.verdicts} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
