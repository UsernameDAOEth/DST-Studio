import { useGetLazerSnapshot } from "@workspace/api-client-react";
import { Radio, RadioTower, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  UNCONFIGURED: "NOT CONFIGURED",
  CONNECTING: "CONNECTING",
  CONNECTED: "LIVE",
  DISCONNECTED: "DISCONNECTED",
  ERROR: "ERROR",
};

function StatusChip({ status }: { status: string }) {
  if (status === "CONNECTED") {
    return (
      <span className="chip-long inline-flex items-center gap-1">
        <Radio className="w-2.5 h-2.5 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "CONNECTING") {
    return (
      <span className="chip-wait inline-flex items-center gap-1">
        <RadioTower className="w-2.5 h-2.5" />
        CONNECTING
      </span>
    );
  }
  if (status === "UNCONFIGURED") {
    return (
      <span className="chip-skip inline-flex items-center gap-1">
        <WifiOff className="w-2.5 h-2.5" />
        NOT CONFIGURED
      </span>
    );
  }
  return (
    <span className="chip-fail inline-flex items-center gap-1">
      <WifiOff className="w-2.5 h-2.5" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function formatAge(ageMs: number | null | undefined): string {
  if (ageMs == null) return "—";
  if (ageMs < 1000) return `${Math.max(0, Math.round(ageMs))}ms`;
  if (ageMs < 60000) return `${(ageMs / 1000).toFixed(1)}s`;
  return `${Math.round(ageMs / 60000)}m`;
}

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function formatConfPct(price: number | null | undefined, conf: number | null | undefined): string {
  if (price == null || conf == null || price === 0) return "—";
  return `±${((conf / price) * 100).toFixed(3)}%`;
}

export function LazerStreamPanel() {
  const { data, isLoading } = useGetLazerSnapshot({
    query: { refetchInterval: 1000 },
  });

  const status = data?.status ?? (isLoading ? "CONNECTING" : "UNCONFIGURED");
  const feeds = data?.feeds ?? [];
  const isUnconfigured = status === "UNCONFIGURED";

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <span className="text-foreground tracking-widest">PYTH LAZER · REAL-TIME STREAM</span>
        <StatusChip status={status} />
      </div>

      {isUnconfigured ? (
        <div className="p-4">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider leading-relaxed">
            Set <span className="text-foreground">PYTH_LAZER_API_KEY</span> to enable the live
            sub-second price stream. Hermes verifier and signal engine continue working without it.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/60">
          {feeds.map((f) => {
            const isStale = f.ageMs != null && f.ageMs > 2000;
            const isLive = f.price != null && !isStale;
            return (
              <div key={f.asset} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-foreground tracking-widest text-xs font-bold">
                    {f.asset}
                  </span>
                  <span
                    className={cn(
                      "micro-label text-[8px]",
                      isLive ? "text-primary" : isStale ? "text-[hsl(var(--trade-wait))]" : "text-muted-foreground/60",
                    )}
                  >
                    {isLive ? <Wifi className="w-2.5 h-2.5 inline" /> : null} {formatAge(f.ageMs)}
                  </span>
                </div>
                <div
                  className={cn(
                    "text-xl font-mono mono-nums leading-none mb-1",
                    isLive ? "text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  ${formatPrice(f.price)}
                </div>
                <div className="micro-label text-muted-foreground/70 text-[8px]">
                  CONF {formatConfPct(f.price, f.confidence)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data?.lastError && status !== "CONNECTED" ? (
        <div className="px-4 py-2 border-t border-border/60 bg-card/30">
          <span className="font-mono text-[9px] text-destructive uppercase tracking-wider">
            ERR: {data.lastError}
          </span>
        </div>
      ) : null}
    </div>
  );
}
