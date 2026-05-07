import { logger } from "../logger";
import { getConstraints } from "../hermes/constraints";

export interface AgentMailDeliveryStatus {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  totalDeliveries: number;
  totalErrors: number;
}

const status: AgentMailDeliveryStatus = {
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  totalDeliveries: 0,
  totalErrors: 0,
};

const deliveredKeys = new Set<string>();
const AGENTMAIL_TIMEOUT_MS = 8_000;
const AGENTMAIL_BASE_URL = "https://api.agentmail.to";

export function getAgentMailStatus(): AgentMailDeliveryStatus {
  return { ...status };
}

export function isAgentMailConfigured(): boolean {
  return Boolean(process.env.AGENTMAIL_API_KEY && process.env.AGENTMAIL_TO);
}

let cachedInboxId: string | null = null;

async function resolveInboxId(apiKey: string): Promise<string> {
  if (process.env.AGENTMAIL_INBOX_ID) return process.env.AGENTMAIL_INBOX_ID;
  if (cachedInboxId) return cachedInboxId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENTMAIL_TIMEOUT_MS);
  try {
    const res = await fetch(`${AGENTMAIL_BASE_URL}/v0/inboxes`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new Error(`AgentMail list-inboxes ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json() as { inboxes?: Array<{ inbox_id?: string; id?: string }> } | Array<{ inbox_id?: string; id?: string }>;
    const list = Array.isArray(data) ? data : (data.inboxes ?? []);
    const first = list[0];
    const id = first?.inbox_id ?? first?.id;
    if (!id) throw new Error("AgentMail account has no inboxes; set AGENTMAIL_INBOX_ID or create one");
    cachedInboxId = id;
    return id;
  } finally {
    clearTimeout(timer);
  }
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

function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSignalUrl(asset: string): string | null {
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const dev = process.env.REPLIT_DEV_DOMAIN;
  const host = domains[0] ?? dev;
  if (!host) return null;
  return `https://${host}/signal/${encodeURIComponent(asset.toLowerCase())}`;
}

export interface FormattedEmail {
  subject: string;
  text: string;
  html: string;
}

export function formatSignalEmail(signal: SignalLike): FormattedEmail {
  const conf = typeof signal.confidence === "string" ? Number(signal.confidence) : signal.confidence;
  const rr = typeof signal.rrRatio === "string" ? Number(signal.rrRatio) : signal.rrRatio;
  const entryLow = signal.entryZoneLow !== null ? Number(signal.entryZoneLow) : null;
  const entryHigh = signal.entryZoneHigh !== null ? Number(signal.entryZoneHigh) : null;
  const inv = signal.invalidationPrice !== null ? Number(signal.invalidationPrice) : null;
  const tgt = signal.targetZone !== null ? Number(signal.targetZone) : null;
  const url = buildSignalUrl(signal.asset);
  const codes = signal.rejectionCodes ?? [];
  const entryStr = entryLow !== null && entryHigh !== null
    ? `${formatNumber(entryLow)} – ${formatNumber(entryHigh)}`
    : "—";

  const tfLabel = signal.timeframe ?? "4H";
  const subject = `DST · ${signal.asset} · ${tfLabel} · ${signal.direction} · ${signal.setupFamily}`;

  const textLines = [
    `DST · ${signal.asset} · ${tfLabel} · ${signal.direction}`,
    `DJZS: ${signal.verdictDjzs}  Process: ${signal.processVerdict}  Grade: ${signal.processQualityGrade}`,
    `Setup: ${signal.setupFamily}`,
    "",
    `Entry:        ${entryStr}`,
    `Invalidation: ${formatNumber(inv)}`,
    `Target:       ${formatNumber(tgt)}`,
    `R/R: ${formatNumber(rr, 2)}   Confidence: ${formatNumber(conf, 0)}%`,
  ];
  if (codes.length > 0) {
    textLines.push("", `Notes: ${codes.join(", ")}`);
  }
  if (url) {
    textLines.push("", `Open audit: ${url}`);
  }
  const text = textLines.join("\n");

  const htmlRows: string[] = [];
  htmlRows.push(`<h2 style="font-family:monospace;margin:0 0 8px">DST · ${escapeHtml(signal.asset)} · ${escapeHtml(tfLabel)} · ${escapeHtml(signal.direction)}</h2>`);
  htmlRows.push(`<p style="font-family:monospace;color:#555;margin:0 0 12px"><b>DJZS:</b> ${escapeHtml(signal.verdictDjzs)} &nbsp; <b>Process:</b> ${escapeHtml(signal.processVerdict)} &nbsp; <b>Grade:</b> ${escapeHtml(signal.processQualityGrade)} &nbsp; <b>Setup:</b> ${escapeHtml(signal.setupFamily)}</p>`);
  htmlRows.push(`<table style="font-family:monospace;border-collapse:collapse"><tbody>`);
  htmlRows.push(`<tr><td style="padding:2px 12px 2px 0;color:#777">Entry</td><td>${escapeHtml(entryStr)}</td></tr>`);
  htmlRows.push(`<tr><td style="padding:2px 12px 2px 0;color:#777">Invalidation</td><td>${escapeHtml(formatNumber(inv))}</td></tr>`);
  htmlRows.push(`<tr><td style="padding:2px 12px 2px 0;color:#777">Target</td><td>${escapeHtml(formatNumber(tgt))}</td></tr>`);
  htmlRows.push(`<tr><td style="padding:2px 12px 2px 0;color:#777">R/R</td><td>${escapeHtml(formatNumber(rr, 2))}</td></tr>`);
  htmlRows.push(`<tr><td style="padding:2px 12px 2px 0;color:#777">Confidence</td><td>${escapeHtml(formatNumber(conf, 0))}%</td></tr>`);
  htmlRows.push(`</tbody></table>`);
  if (codes.length > 0) {
    htmlRows.push(`<p style="font-family:monospace;color:#555;margin:12px 0 0"><b>Notes:</b> ${escapeHtml(codes.join(", "))}</p>`);
  }
  if (url) {
    htmlRows.push(`<p style="font-family:monospace;margin:16px 0 0"><a href="${escapeHtml(url)}">Open audit ↗</a></p>`);
  }
  const html = `<div>${htmlRows.join("")}</div>`;

  return { subject, text, html };
}

export async function sendAgentMailEmail(email: FormattedEmail): Promise<void> {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  const to = process.env.AGENTMAIL_TO;
  if (!apiKey || !to) {
    throw new Error("AGENTMAIL_API_KEY and AGENTMAIL_TO must be set");
  }
  const inboxId = await resolveInboxId(apiKey);
  const url = `${AGENTMAIL_BASE_URL}/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENTMAIL_TIMEOUT_MS);
  try {
    const recipients = to.split(",").map(s => s.trim()).filter(Boolean);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: recipients,
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new Error(`AgentMail API ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`AgentMail API timeout after ${AGENTMAIL_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type EmailDeliveryOutcome =
  | { delivered: true }
  | { delivered: false; reason: string; alreadyDelivered?: boolean };

export async function maybeDeliverApprovedSignalEmail(signal: SignalLike): Promise<EmailDeliveryOutcome> {
  if (signal.verdictDjzs !== "PASS" || signal.direction === "WAIT") {
    return { delivered: false, reason: "Not an APPROVED tradeable signal" };
  }
  if (!getConstraints().alertRouting.email) {
    return { delivered: false, reason: "Email routing disabled in Hermes constraints" };
  }
  if (!isAgentMailConfigured()) {
    return { delivered: false, reason: "AGENTMAIL_API_KEY / AGENTMAIL_TO not configured" };
  }
  const key = dedupKey(signal);
  if (deliveredKeys.has(key)) {
    return { delivered: false, reason: `Already delivered (${key})`, alreadyDelivered: true };
  }
  deliveredKeys.add(key);
  try {
    await sendAgentMailEmail(formatSignalEmail(signal));
    status.lastSuccessAt = new Date().toISOString();
    status.totalDeliveries++;
    logger.info({ signalId: signal.id, asset: signal.asset, key }, "AgentMail signal delivered");
    return { delivered: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    status.lastErrorAt = new Date().toISOString();
    status.lastError = msg;
    status.totalErrors++;
    deliveredKeys.delete(key);
    logger.error({ err, signalId: signal.id, asset: signal.asset }, "AgentMail delivery failed");
    return { delivered: false, reason: msg };
  }
}
