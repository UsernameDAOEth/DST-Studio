import { logger } from "../logger";
import { getConstraints } from "../hermes/constraints";

export interface TelegramDeliveryStatus {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  totalDeliveries: number;
  totalErrors: number;
}

const status: TelegramDeliveryStatus = {
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  totalDeliveries: 0,
  totalErrors: 0,
};

// Dedup by stable signal identity (asset + packet hash) so re-scans of an
// unchanged setup don't re-notify even though a new DB row is inserted each scan.
const deliveredKeys = new Set<string>();

const TELEGRAM_TIMEOUT_MS = 8_000;

export function getTelegramStatus(): TelegramDeliveryStatus {
  return { ...status };
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

const MD_V2_RESERVED = /[_*\[\]()~`>#+\-=|{}.!\\]/g;
function escapeMd(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "—";
  return String(input).replace(MD_V2_RESERVED, "\\$&");
}

function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

interface SignalLike {
  id: number;
  asset: string;
  timeframe?: string | null;
  direction: string;
  verdictDjzs: string;
  processVerdict: string;
  processQualityGrade: string;
  setupFamily: string;
  confidence: string | number;
  rrRatio: string | number;
  entryZoneLow: string | number | null;
  entryZoneHigh: string | number | null;
  invalidationPrice: string | number | null;
  targetZone: string | number | null;
  rejectionCodes: string[] | null;
  packetHash: string | null;
}

function dedupKey(signal: SignalLike): string {
  const tf = signal.timeframe ?? "4H";
  return `${tf}:${signal.asset}:${signal.packetHash ?? `id-${signal.id}`}`;
}

function buildSignalUrl(asset: string, timeframe: string | null | undefined): string | null {
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const dev = process.env.REPLIT_DEV_DOMAIN;
  const host = domains[0] ?? dev;
  if (!host) return null;
  const tf = timeframe ?? "4H";
  return `https://${host}/signal/${encodeURIComponent(asset.toLowerCase())}?timeframe=${encodeURIComponent(tf)}`;
}

export function formatSignalMessage(signal: SignalLike): string {
  const conf = typeof signal.confidence === "string" ? Number(signal.confidence) : signal.confidence;
  const rr = typeof signal.rrRatio === "string" ? Number(signal.rrRatio) : signal.rrRatio;
  const entryLow = signal.entryZoneLow !== null ? Number(signal.entryZoneLow) : null;
  const entryHigh = signal.entryZoneHigh !== null ? Number(signal.entryZoneHigh) : null;
  const inv = signal.invalidationPrice !== null ? Number(signal.invalidationPrice) : null;
  const tgt = signal.targetZone !== null ? Number(signal.targetZone) : null;
  const url = buildSignalUrl(signal.asset, signal.timeframe);

  const lines: string[] = [];
  const tfLabel = signal.timeframe ?? "4H";
  lines.push(`*DST · ${escapeMd(signal.asset)} · ${escapeMd(tfLabel)} · ${escapeMd(signal.direction)}*`);
  lines.push(`DJZS: \`${escapeMd(signal.verdictDjzs)}\` · Process: \`${escapeMd(signal.processVerdict)}\` · Grade: \`${escapeMd(signal.processQualityGrade)}\``);
  lines.push(`Setup: \`${escapeMd(signal.setupFamily)}\``);
  lines.push("");
  const entryStr = entryLow !== null && entryHigh !== null
    ? `${formatNumber(entryLow)} – ${formatNumber(entryHigh)}`
    : "—";
  lines.push(`Entry: \`${escapeMd(entryStr)}\``);
  lines.push(`Invalidation: \`${escapeMd(formatNumber(inv))}\``);
  lines.push(`Target: \`${escapeMd(formatNumber(tgt))}\``);
  lines.push(`R/R: \`${escapeMd(formatNumber(rr, 2))}\` · Confidence: \`${escapeMd(formatNumber(conf, 0))}%\``);
  const codes = signal.rejectionCodes ?? [];
  if (codes.length > 0) {
    lines.push("");
    lines.push(`Notes: ${escapeMd(codes.join(", "))}`);
  }
  if (url) {
    lines.push("");
    lines.push(`[Open audit ↗](${url})`);
  }
  return lines.join("\n");
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set");
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new Error(`Telegram API ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Telegram API timeout after ${TELEGRAM_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type DeliveryOutcome =
  | { delivered: true }
  | { delivered: false; reason: string; alreadyDelivered?: boolean };

export async function maybeDeliverApprovedSignal(signal: SignalLike): Promise<DeliveryOutcome> {
  if (signal.verdictDjzs !== "PASS" || signal.direction === "WAIT") {
    return { delivered: false, reason: "Not an APPROVED tradeable signal" };
  }
  if (!getConstraints().alertRouting.telegram) {
    return { delivered: false, reason: "Telegram routing disabled in Hermes constraints" };
  }
  if (!isTelegramConfigured()) {
    return { delivered: false, reason: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured" };
  }
  const key = dedupKey(signal);
  if (deliveredKeys.has(key)) {
    return { delivered: false, reason: `Already delivered (${key})`, alreadyDelivered: true };
  }
  deliveredKeys.add(key);
  try {
    await sendTelegramMessage(formatSignalMessage(signal));
    status.lastSuccessAt = new Date().toISOString();
    status.totalDeliveries++;
    logger.info({ signalId: signal.id, asset: signal.asset, key }, "Telegram signal delivered");
    return { delivered: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    status.lastErrorAt = new Date().toISOString();
    status.lastError = msg;
    status.totalErrors++;
    deliveredKeys.delete(key);
    logger.error({ err, signalId: signal.id, asset: signal.asset }, "Telegram delivery failed");
    return { delivered: false, reason: msg };
  }
}
