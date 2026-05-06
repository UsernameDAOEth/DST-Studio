import { useState } from "react";
import { Link } from "wouter";
import {
  getGetDstShortBottleneckQueryKey,
  getGetDstShortBottleneckSignalsQueryKey,
  useGetDstPipelineHealth,
  useGetDstShortBottleneck,
  useGetDstShortBottleneckSignals,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";

type Bucket = { name: string; count: number };
type BucketKind =
  | "rejection"
  | "reason"
  | "failingCheck"
  | "skippedCheck"
  | "setup"
  | "verdict";

type Selection = { bucket: BucketKind; name: string };

function SignalDrilldown({ selection }: { selection: Selection }) {
  const { data, isLoading, isError } = useGetDstShortBottleneckSignals(
    { bucket: selection.bucket, name: selection.name },
    { query: { queryKey: getGetDstShortBottleneckSignalsQueryKey(selection) } },
  );

  if (isLoading) {
    return (
      <div className="font-mono text-[10px] text-muted-foreground pl-3 py-1">
        loading matching SHORTs…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="font-mono text-[10px] text-destructive pl-3 py-1">
        failed to load matching SHORTs
      </div>
    );
  }
  if (data.signals.length === 0) {
    return (
      <div className="font-mono text-[10px] text-muted-foreground pl-3 py-1">
        no matching SHORTs in window
      </div>
    );
  }
  return (
    <div className="pl-3 py-1 space-y-0.5 border-l border-border/60">
      <div className="micro-label text-muted-foreground">
        {data.total} SHORT{data.total === 1 ? "" : "S"} · {selection.name}
      </div>
      {data.signals.map((s) => (
        <Link
          key={s.id}
          href={`/audit/${s.asset}?signalId=${s.id}`}
          className="font-mono text-[10px] flex items-center gap-2 mono-nums hover:text-primary"
          data-testid={`bottleneck-signal-${s.id}`}
          title={`View pinned audit report for signal #${s.id}`}
        >
          <span className="text-muted-foreground w-[88px] truncate">
            {new Date(s.computedAt).toLocaleString("en-US", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
          <span className="text-foreground font-bold w-[36px]">{s.asset}</span>
          <span className="text-muted-foreground w-[72px] truncate">
            {s.processVerdict}
          </span>
          <span className="text-muted-foreground/70 truncate flex-1">
            {s.setupFamily}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
        </Link>
      ))}
    </div>
  );
}

function BucketList({
  label,
  bucket,
  items,
  selection,
  onSelect,
}: {
  label: string;
  bucket: BucketKind;
  items: Bucket[];
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="micro-label text-muted-foreground mb-1">{label}</div>
      <div className="space-y-0.5">
        {items.map((b) => {
          const isOpen =
            selection?.bucket === bucket && selection.name === b.name;
          return (
            <div key={b.name}>
              <button
                type="button"
                onClick={() => onSelect(isOpen ? null : { bucket, name: b.name })}
                aria-expanded={isOpen}
                data-testid={`bottleneck-row-${bucket}-${b.name}`}
                className={cn(
                  "w-full font-mono text-[10px] flex justify-between gap-2 mono-nums text-left hover:text-primary",
                  isOpen && "text-primary",
                )}
              >
                <span className="truncate flex items-center gap-1">
                  {isOpen ? (
                    <ChevronDown className="w-2.5 h-2.5" />
                  ) : (
                    <ChevronRight className="w-2.5 h-2.5" />
                  )}
                  {b.name}
                </span>
                <span className="text-muted-foreground">{b.count}</span>
              </button>
              {isOpen && (
                <div className="mt-1 mb-1">
                  <SignalDrilldown selection={{ bucket, name: b.name }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineHealthChip() {
  const { data, isLoading } = useGetDstPipelineHealth();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

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
            onClick={() => {
              setOpen((v) => !v);
              setSelection(null);
            }}
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
                <span className="text-muted-foreground/70">
                  {" "}
                  · click any row to see matching SHORTs
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <BucketList
                  label="REJECTION CODES"
                  bucket="rejection"
                  items={bottleneck.rejectionCodes}
                  selection={selection}
                  onSelect={setSelection}
                />
                <BucketList
                  label="FAILING CHECKS"
                  bucket="failingCheck"
                  items={bottleneck.failingChecks}
                  selection={selection}
                  onSelect={setSelection}
                />
                <BucketList
                  label="REASON CODES"
                  bucket="reason"
                  items={bottleneck.reasonCodes}
                  selection={selection}
                  onSelect={setSelection}
                />
                <BucketList
                  label="SETUP FAMILIES"
                  bucket="setup"
                  items={bottleneck.setupFamilies}
                  selection={selection}
                  onSelect={setSelection}
                />
                <BucketList
                  label="SKIPPED CHECKS"
                  bucket="skippedCheck"
                  items={bottleneck.skippedChecks}
                  selection={selection}
                  onSelect={setSelection}
                />
                <BucketList
                  label="VERDICTS"
                  bucket="verdict"
                  items={bottleneck.verdicts}
                  selection={selection}
                  onSelect={setSelection}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
