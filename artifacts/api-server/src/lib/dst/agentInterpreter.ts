import { computeSignal } from "./signalEngine";
import { ASSET_MAP } from "./defillamaClient";
import { logger } from "../logger";

export interface AgentResponse {
  reply: string;
  command: string;
  data: Record<string, unknown>;
  sessionId: string;
}

const HELP_TEXT = `DST Agent Commands:
  help              — Show this help message
  signal <ASSET>    — Compute and show signal for asset (ETH, BTC, SOL)
  audit <ASSET>     — Run full DJZS audit for asset
  watch <ASSET>     — Add asset to watchlist (use the UI watchlist panel)
  status            — Show system status
  assets            — List tracked assets

Supported assets: ${Object.keys(ASSET_MAP).join(", ")}
Timeframe: 4H (default)
Mode: Paper signals only — no live execution.`;

export async function interpretCommand(message: string, sessionId: string): Promise<AgentResponse> {
  const input = message.trim();
  const lower = input.toLowerCase();

  logger.info({ message, sessionId }, "Agent command received");

  if (lower === "help" || lower === "?") {
    return { reply: HELP_TEXT, command: "help", data: {}, sessionId };
  }

  if (lower === "status") {
    return {
      reply: "DST is online. Signal engine operational. DefiLlama data source active. Paper mode only.",
      command: "status",
      data: { mode: "paper", assets: Object.keys(ASSET_MAP), timeframe: "4H", version: "1.0.0" },
      sessionId,
    };
  }

  if (lower === "assets") {
    const list = Object.entries(ASSET_MAP).map(([sym, info]) => `${sym} — ${info.name}`).join("\n");
    return {
      reply: `Tracked assets:\n${list}`,
      command: "assets",
      data: { assets: Object.keys(ASSET_MAP) },
      sessionId,
    };
  }

  const signalMatch = lower.match(/^signal\s+(\w+)$/);
  if (signalMatch) {
    const asset = signalMatch[1].toUpperCase();
    if (!ASSET_MAP[asset]) {
      return {
        reply: `Unknown asset: ${asset}. Supported: ${Object.keys(ASSET_MAP).join(", ")}`,
        command: "signal_error",
        data: {},
        sessionId,
      };
    }
    try {
      const signal = await computeSignal(asset);
      const reply = [
        `Signal for ${asset} (4H):`,
        `Direction: ${signal.direction}`,
        `DJZS Verdict: ${signal.verdictDjzs}`,
        `Confidence: ${signal.confidence.toFixed(0)}%`,
        `Entry Zone: $${signal.entryZoneLow.toFixed(2)} – $${signal.entryZoneHigh.toFixed(2)}`,
        `Target: $${signal.targetZone.toFixed(2)}`,
        `Invalidation: $${signal.invalidationPrice.toFixed(2)}`,
        `Reason Codes: ${signal.reasonCodes.join(", ")}`,
      ].join("\n");
      return {
        reply,
        command: "signal",
        data: { type: "signal", signal },
        sessionId,
      };
    } catch (err) {
      logger.error({ err, asset }, "Agent signal error");
      return {
        reply: `Failed to compute signal for ${asset}: ${err instanceof Error ? err.message : String(err)}`,
        command: "signal_error",
        data: {},
        sessionId,
      };
    }
  }

  const auditMatch = lower.match(/^audit\s+(\w+)$/) || lower.match(/^audit this$/);
  const auditAsset = auditMatch ? (auditMatch[1]?.toUpperCase() ?? "ETH") : null;
  if (auditMatch && auditAsset) {
    if (!ASSET_MAP[auditAsset]) {
      return {
        reply: `Unknown asset: ${auditAsset}. Supported: ${Object.keys(ASSET_MAP).join(", ")}`,
        command: "audit_error",
        data: {},
        sessionId,
      };
    }
    try {
      const signal = await computeSignal(auditAsset);
      const { auditReport } = signal;
      const checkSummary = auditReport.checks
        .map((c) => `  [${c.result}] ${c.name}: ${c.detail}`)
        .join("\n");
      const reply = [
        `DJZS Audit for ${auditAsset}:`,
        `Verdict: ${auditReport.verdict}`,
        ``,
        checkSummary,
        ``,
        `Summary: ${auditReport.summary}`,
      ].join("\n");
      return {
        reply,
        command: "audit",
        data: { type: "audit", auditReport, signal },
        sessionId,
      };
    } catch (err) {
      logger.error({ err, auditAsset }, "Agent audit error");
      return {
        reply: `Failed to run audit for ${auditAsset}: ${err instanceof Error ? err.message : String(err)}`,
        command: "audit_error",
        data: {},
        sessionId,
      };
    }
  }

  if (lower.startsWith("watch ")) {
    const sym = lower.replace("watch ", "").trim().toUpperCase();
    if (!ASSET_MAP[sym]) {
      return {
        reply: `Unknown asset: ${sym}. Use the watchlist panel in the UI to add assets.`,
        command: "watch_error",
        data: {},
        sessionId,
      };
    }
    return {
      reply: `To add ${sym} to your watchlist, use the Watchlist panel in the sidebar or navigate to /watchlist.`,
      command: "watch_hint",
      data: { asset: sym },
      sessionId,
    };
  }

  return {
    reply: `Unknown command: "${input}". Type "help" for a list of commands.`,
    command: "unknown",
    data: {},
    sessionId,
  };
}
