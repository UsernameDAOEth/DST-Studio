import { z } from "zod";
import { db, hermesFindingsTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { randomUUID, createHash } from "crypto";
import type { HermesFinding } from "@workspace/db";

export const EvidenceItemSchema = z.object({
  source: z.string().min(1).max(200),
  url: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  timestamp: z.string().optional(),
  reliability: z
    .enum(["VERIFIED", "UNVERIFIED", "CONFLICTING", "STALE"])
    .default("UNVERIFIED"),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const SubmitFindingSchema = z.object({
  finding_id: z.string().optional(),
  run_id: z.string().optional(),
  source_agent: z.string().min(1).max(100),
  market_type: z
    .enum(["PERP", "SPOT", "CROSS_MARKET", "PROTOCOL"])
    .default("PERP"),
  target: z
    .string()
    .min(1)
    .max(20)
    .transform((s: string) => s.toUpperCase()),
  observation_type: z.enum([
    "FUNDING_RATE",
    "OPEN_INTEREST",
    "LIQUIDATION_CLUSTER",
    "THESIS_EVENT",
    "NEWS",
    "PROTOCOL_EVENT",
    "PRICE_ACTION",
    "WALLET_ACTIVITY",
    "CUSTOM",
  ]),
  summary: z.string().min(1).max(500),
  evidence: z.array(EvidenceItemSchema).max(10).default([]),
  confidence: z.number().min(0).max(1),
  suggested_flags: z.array(z.string().max(50)).max(10).default([]),
  expires_at: z.string().optional(),
});
export type SubmitFindingPayload = z.infer<typeof SubmitFindingSchema>;

export interface HermesFindingPublic {
  findingId: string;
  runId: string | null;
  sourceAgent: string;
  marketType: string;
  target: string;
  observationType: string;
  summary: string;
  evidence: EvidenceItem[];
  confidence: number;
  suggestedFlags: string[];
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface HermesFindingsContext {
  findingCount: number;
  activeFindings: HermesFindingPublic[];
  suggestedFlagHints: string[];
  boundaryReminder: string;
  attachedAt: string;
}

export const BOUNDARY_REMINDER =
  "HERMES SUBMITS FINDINGS ONLY. Confidence is metadata — not a score. " +
  "Suggested flags are hints — not verdicts. DJZS is the deterministic audit gate. " +
  "Capital movement requires the user's decision.";

function toPublic(f: HermesFinding): HermesFindingPublic {
  return {
    findingId: f.findingId,
    runId: f.runId ?? null,
    sourceAgent: f.sourceAgent,
    marketType: f.marketType,
    target: f.target,
    observationType: f.observationType,
    summary: f.summary,
    evidence: (f.evidence as EvidenceItem[]) ?? [],
    confidence: Number(f.confidence),
    suggestedFlags: (f.suggestedFlags as string[]) ?? [],
    status: f.status,
    expiresAt: f.expiresAt?.toISOString() ?? null,
    createdAt: f.createdAt.toISOString(),
  };
}

function contentHash(target: string, observationType: string, summary: string): string {
  return createHash("sha256")
    .update(`${target}:${observationType}:${summary}`)
    .digest("hex")
    .slice(0, 16);
}

export async function ingestFinding(
  payload: SubmitFindingPayload,
): Promise<{ finding: HermesFindingPublic; deduplicated: boolean }> {
  const findingId = payload.finding_id ?? randomUUID();

  const existing = findingId
    ? await db
        .select()
        .from(hermesFindingsTable)
        .where(eq(hermesFindingsTable.findingId, findingId))
        .limit(1)
    : [];

  if (existing.length > 0) {
    return { finding: toPublic(existing[0]), deduplicated: true };
  }

  const hash = contentHash(payload.target, payload.observation_type, payload.summary);
  const dedupWindow = new Date(Date.now() - 5 * 60 * 1000);
  const contentDupe = await db
    .select()
    .from(hermesFindingsTable)
    .where(
      and(
        eq(hermesFindingsTable.target, payload.target),
        eq(hermesFindingsTable.observationType, payload.observation_type),
        eq(hermesFindingsTable.contentHash, hash),
        ...(payload.run_id
          ? [eq(hermesFindingsTable.runId, payload.run_id)]
          : [gte(hermesFindingsTable.createdAt, dedupWindow)]),
      ),
    )
    .limit(1);

  if (contentDupe.length > 0) {
    return { finding: toPublic(contentDupe[0]), deduplicated: true };
  }

  const [inserted] = await db
    .insert(hermesFindingsTable)
    .values({
      findingId,
      runId: payload.run_id ?? null,
      sourceAgent: payload.source_agent,
      marketType: payload.market_type,
      target: payload.target,
      observationType: payload.observation_type,
      summary: payload.summary,
      evidence: payload.evidence as unknown as Record<string, unknown>[],
      confidence: String(payload.confidence),
      suggestedFlags: payload.suggested_flags,
      status: "ACTIVE",
      expiresAt: payload.expires_at ? new Date(payload.expires_at) : null,
      contentHash: hash,
    })
    .returning();
  return { finding: toPublic(inserted), deduplicated: false };
}

export async function getFindingsForTarget(
  target: string,
  activeOnly = true,
): Promise<HermesFindingPublic[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(hermesFindingsTable)
    .where(eq(hermesFindingsTable.target, target.toUpperCase()))
    .orderBy(desc(hermesFindingsTable.createdAt))
    .limit(50);
  const filtered = activeOnly
    ? rows.filter(
        (r) => r.status === "ACTIVE" && (!r.expiresAt || r.expiresAt > now),
      )
    : rows;
  return filtered.map(toPublic);
}

export async function getRecentFindings(
  limit = 20,
): Promise<HermesFindingPublic[]> {
  const rows = await db
    .select()
    .from(hermesFindingsTable)
    .orderBy(desc(hermesFindingsTable.createdAt))
    .limit(limit);
  return rows.map(toPublic);
}

export function adaptFindingsToAuditContext(
  findings: HermesFindingPublic[],
): HermesFindingsContext {
  const activeFindings = findings.filter((f) => f.status === "ACTIVE");
  const suggestedFlagHints = [
    ...new Set(activeFindings.flatMap((f) => f.suggestedFlags)),
  ];
  return {
    findingCount: activeFindings.length,
    activeFindings,
    suggestedFlagHints,
    boundaryReminder: BOUNDARY_REMINDER,
    attachedAt: new Date().toISOString(),
  };
}
