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

function SignalDrilldown({ selection, timeframe }: { selection: Selection; timeframe: "4H" | "15m" }) {
  const params = { bucket: selection.bucket, name: selection.name, timeframe };
  const { data, isLoading, isError } = useGetDstShortBottleneckSignals(
    params,
    { query: { queryKey: getGetDstShortBottleneckSignalsQueryKey(params) } },
  );
  const [assetFilter, setAssetFilter] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("");
  const [rangeHours, setRangeHours] = useState<number | null>(null);

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
  const verdictOptions = Array.from(
    new Set(data.signals.map((s) => s.processVerdict).filter(Boolean)),
  ).sort();
  const assetQ = assetFilter.trim().toUpperCase();
  const cutoffMs = rangeHours ? Date.now() - rangeHours * 3600_000 : null;
  const filtered = data.signals.filter((s) => {
    if (assetQ && !s.asset.toUpperCase().includes(assetQ)) return false;
    if (verdictFilter && s.processVerdict !== verdictFilter) return false;
    if (cutoffMs !== null && new Date(s.computedAt).getTime() < cutoffMs)
      return false;
    return true;
  });
  const rangePresets: { label: string; hours: number | null }[] = [
    { label: "24h", hours: 24 },
    { label: "3d", hours: 72 },
    { label: "7d", hours: null },
  ];
  return (
    <div className="pl-3 py-1 space-y-0.5 border-l border-border/60">
      <div className="micro-label text-muted-foreground">
        {filtered.length} / {data.total} SHORT{data.total === 1 ? "" : "S"} ·{" "}
        {selection.name}
      </div>
      <div className="flex items-center gap-1.5 py-1">
        <input
          type="text"
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          placeholder="filter asset…"
          aria-label="Filter by asset"
          data-testid="bottleneck-filter-asset"
          className="font-mono text-[10px] bg-background border border-border px-1.5 py-0.5 w-[100px] focus:outline-none focus:border-primary"
        />
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          aria-label="Filter by process verdict"
          data-testid="bottleneck-filter-verdict"
          className="font-mono text-[10px] bg-background border border-border px-1 py-0.5 focus:outline-none focus:border-primary"
        >
          <option value="">all verdicts</option>
          {verdictOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground/60 font-mono text-[10px]">|</span>
        {rangePresets.map((p) => {
          const active = rangeHours === p.hours;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setRangeHours(p.hours)}
              aria-pressed={active}
              data-testid={`bottleneck-filter-range-${p.label}`}
              className={cn(
                "font-mono text-[10px] border px-1.5 py-0.5",
                active
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-primary",
              )}
            >
              {p.label}
            </button>
          );
        })}
        {(assetFilter || verdictFilter || rangeHours !== null) && (
          <button
            type="button"
            onClick={() => {
              setAssetFilter("");
              setVerdictFilter("");
              setRangeHours(null);
            }}
            data-testid="bottleneck-filter-clear"
            className="font-mono text-[10px] text-muted-foreground hover:text-primary"
          >
            clear
          </button>
        )}
      </div>
      {filtered.length === 0 && (
        <div className="font-mono text-[10px] text-muted-foreground py-1">
          no SHORTs match filter
        </div>
      )}
      {filtered.map((s) => (
        <Link
          key={s.id}
          href={`/audit/${s.asset}?signalId=${s.id}&timeframe=${timeframe}`}
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
  timeframe,
}: {
  label: string;
  bucket: BucketKind;
  items: Bucket[];
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  timeframe: "4H" | "15m";
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
                  <SignalDrilldown selection={{ bucket, name: b.name }} timeframe={timeframe} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineHealthChip({ timeframe = "4H" }: { timeframe?: "4H" | "15m" }) {
  const tfParams = { timeframe };
  const { data, isLoading } = useGetDstPipelineHealth(tfParams, {
    query: { queryKey: ["pipeline-health", timeframe] },
  });
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  const { data: bottleneck, isError: bottleneckError } = useGetDstShortBottleneck(tfParams, {
    query: {
      enabled: open,
      queryKey: getGetDstShortBottleneckQueryKey(tfParams),
    },
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
        <div className="micro-label text-muted-foreground">PIPELINE 7D · {timeframe}</div>
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
                  timeframe={timeframe}
                />
                <BucketList
                  label="FAILING CHECKS"
                  bucket="failingCheck"
                  items={bottleneck.failingChecks}
                  selection={selection}
                  onSelect={setSelection}
                  timeframe={timeframe}
                />
                <BucketList
                  label="REASON CODES"
                  bucket="reason"
                  items={bottleneck.reasonCodes}
                  selection={selection}
                  onSelect={setSelection}
                  timeframe={timeframe}
                />
                <BucketList
                  label="SETUP FAMILIES"
                  bucket="setup"
                  items={bottleneck.setupFamilies}
                  selection={selection}
                  onSelect={setSelection}
                  timeframe={timeframe}
                />
                <BucketList
                  label="SKIPPED CHECKS"
                  bucket="skippedCheck"
                  items={bottleneck.skippedChecks}
                  selection={selection}
                  onSelect={setSelection}
                  timeframe={timeframe}
                />
                <BucketList
                  label="VERDICTS"
                  bucket="verdict"
                  items={bottleneck.verdicts}
                  selection={selection}
                  onSelect={setSelection}
                  timeframe={timeframe}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
