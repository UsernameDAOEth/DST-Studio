import { createHash } from "crypto";
import {
  computeTradingSignal,
  type TradingSignal,
  type TradingSignalRequest,
} from "./tradingSignalEngine";

export type AgentAuditVerdict = "PASS" | "FAIL" | "WAIT";
export type AgentProposedSide = Exclude<TradingSignal, "WAIT">;
export type AgentAuditCheckResult = "PASS" | "FAIL" | "WARN";

export type AgentAuditRequest = TradingSignalRequest & {
  proposal?: unknown;
  sourceAgent?: unknown;
  sourceModel?: unknown;
  traceId?: unknown;
  proposedSide?: unknown;
  side?: unknown;
  thesis?: unknown;
  catalysts?: unknown;
  invalidationConditions?: unknown;
  entry?: unknown;
  stopLoss?: unknown;
  takeProfit?: unknown;
  proposedLeverage?: unknown;
  evidenceContext?: unknown;
};

export type NormalizedAgentTradeProposal = {
  sourceAgent: string | null;
  sourceModel: string | null;
  traceId: string | null;
  proposedSide: AgentProposedSide | null;
  thesis: string | null;
  catalysts: string[];
  invalidationConditions: string[];
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  proposedLeverage: number | null;
};

export type AgentAuditCheck = {
  name: string;
  result: AgentAuditCheckResult;
  detail: string;
  weight: number;
};

export type AgentAuditProofReceipt = {
  rulesVersion: "deterministic-agent-audit-v0";
  proposalHash: string;
  signalHash: string;
  proofHash: string;
};

export type AgentAuditResponse = {
  ok: true;
  symbol: string | null;
  venue: string | null;
  timeframe: string | null;
  auditVerdict: AgentAuditVerdict;
  riskScore: number;
  reasonCodes: string[];
  evidenceGaps: string[];
  proposal: NormalizedAgentTradeProposal;
  signalContext: {
    signal: TradingSignal;
    confidence: number;
    reasonCodes: string[];
    engine: "deterministic-signal-v0";
  };
  checks: AgentAuditCheck[];
  proofReceipt: AgentAuditProofReceipt;
  timestamp: string;
  engine: "deterministic-agent-audit-v0";
};

const EXTERNAL_EVIDENCE_PATTERNS = [
  /\bfunding\b/i,
  /\bopen interest\b/i,
  /\boi\b/i,
  /\bwhales?\b/i,
  /\bsocial\b/i,
  /\bsentiment\b/i,
  /\bnews\b/i,
  /\blisting\b/i,
  /\bregulat(?:ion|ory)\b/i,
  /\betf\b/i,
  /\bpartnership\b/i,
  /\bon[- ]?chain\b/i,
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter((item): item is string => item !== null);
}

function parseSide(value: unknown): AgentProposedSide | null {
  const normalized = cleanString(value)?.toUpperCase();
  return normalized === "LONG" || normalized === "SHORT" ? normalized : null;
}

function normalizeProposal(input: AgentAuditRequest): NormalizedAgentTradeProposal {
  const proposal = asRecord(input.proposal);

  return {
    sourceAgent: cleanString(firstDefined(proposal["sourceAgent"], input.sourceAgent)),
    sourceModel: cleanString(firstDefined(proposal["sourceModel"], input.sourceModel)),
    traceId: cleanString(firstDefined(proposal["traceId"], input.traceId)),
    proposedSide: parseSide(
      firstDefined(
        proposal["proposedSide"],
        proposal["side"],
        input.proposedSide,
        input.side,
      ),
    ),
    thesis: cleanString(firstDefined(proposal["thesis"], input.thesis)),
    catalysts: cleanStringArray(firstDefined(proposal["catalysts"], input.catalysts)),
    invalidationConditions: cleanStringArray(
      firstDefined(proposal["invalidationConditions"], input.invalidationConditions),
    ),
    entry: positiveNumber(firstDefined(proposal["entry"], input.entry)),
    stopLoss: positiveNumber(firstDefined(proposal["stopLoss"], input.stopLoss)),
    takeProfit: positiveNumber(firstDefined(proposal["takeProfit"], input.takeProfit)),
    proposedLeverage: positiveNumber(
      firstDefined(proposal["proposedLeverage"], input.proposedLeverage),
    ),
  };
}

function hasEvidenceContext(input: AgentAuditRequest): boolean {
  const proposal = asRecord(input.proposal);
  const raw = firstDefined(proposal["evidenceContext"], input.evidenceContext);

  if (typeof raw === "string") return raw.trim().length > 0;
  if (Array.isArray(raw)) return raw.length > 0;
  if (raw && typeof raw === "object") return Object.keys(raw as Record<string, unknown>).length > 0;
  return false;
}

function thesisRequiresExternalEvidence(thesis: string | null): boolean {
  if (!thesis) return false;
  return EXTERNAL_EVIDENCE_PATTERNS.some((pattern) => pattern.test(thesis));
}

function readSnapshotPrice(input: AgentAuditRequest): number | null {
  const snapshot = asRecord(input.marketSnapshot);
  const direct = positiveNumber(
    firstDefined(
      snapshot["price"],
      snapshot["lastPrice"],
      snapshot["markPrice"],
      snapshot["close"],
    ),
  );
  if (direct !== null) return direct;

  const candles = snapshot["candles"];
  if (!Array.isArray(candles) || candles.length === 0) return null;

  const latest = candles[candles.length - 1];
  if (Array.isArray(latest)) {
    return positiveNumber(latest[4]);
  }

  const latestRecord = asRecord(latest);
  return positiveNumber(firstDefined(latestRecord["close"], latestRecord["c"]));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(record[key]);
        return acc;
      }, {});
  }

  return value;
}

function hashStable(value: unknown): string {
  const canonical = JSON.stringify(canonicalize(value));
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function computeAgentAudit(input: AgentAuditRequest): AgentAuditResponse {
  const signalContext = computeTradingSignal(input);
  const proposal = normalizeProposal(input);
  const checks: AgentAuditCheck[] = [];
  const reasonCodes = new Set<string>();
  const evidenceGaps = new Set<string>();

  let riskScore = 0;
  let hardFail = false;
  let waitOnly = false;

  const addCheck = (
    name: string,
    result: AgentAuditCheckResult,
    detail: string,
    weight: number,
    options?: {
      reasonCode?: string;
      riskDelta?: number;
      hardFail?: boolean;
      waitOnly?: boolean;
      evidenceGap?: string;
    },
  ): void => {
    checks.push({ name, result, detail, weight });

    if (options?.reasonCode) reasonCodes.add(options.reasonCode);
    if (options?.evidenceGap) evidenceGaps.add(options.evidenceGap);
    if (options?.riskDelta) riskScore += options.riskDelta;
    if (options?.hardFail) hardFail = true;
    if (options?.waitOnly) waitOnly = true;
  };

  if (!proposal.sourceAgent) {
    addCheck(
      "AGENT_SOURCE",
      "WARN",
      "No sourceAgent was declared. The audit remains valid, but provenance is weaker.",
      0.05,
      { reasonCode: "AGENT_SOURCE_NOT_DECLARED", riskDelta: 5 },
    );
  } else {
    addCheck(
      "AGENT_SOURCE",
      "PASS",
      `Proposal source declared as ${proposal.sourceAgent}.`,
      0.05,
    );
  }

  if (!proposal.proposedSide) {
    addCheck(
      "PROPOSED_SIDE",
      "FAIL",
      "The proposal must declare LONG or SHORT.",
      0.2,
      {
        reasonCode: "AGENT_PROPOSAL_SIDE_MISSING",
        riskDelta: 25,
        hardFail: true,
      },
    );
  } else {
    addCheck(
      "PROPOSED_SIDE",
      "PASS",
      `Proposed side is ${proposal.proposedSide}.`,
      0.2,
    );
  }

  if (!proposal.thesis) {
    addCheck(
      "THESIS_PRESENT",
      "FAIL",
      "The proposal must include a thesis that can be verified.",
      0.15,
      {
        reasonCode: "AGENT_PROPOSAL_THESIS_MISSING",
        riskDelta: 20,
        hardFail: true,
      },
    );
  } else {
    addCheck(
      "THESIS_PRESENT",
      "PASS",
      "A non-empty thesis was provided.",
      0.15,
    );
  }

  if (proposal.stopLoss === null) {
    addCheck(
      "STOP_LOSS_PRESENT",
      "FAIL",
      "A deterministic audit requires a stop-loss level.",
      0.15,
      {
        reasonCode: "AGENT_PROPOSAL_MISSING_STOP",
        riskDelta: 25,
        hardFail: true,
      },
    );
  } else {
    addCheck(
      "STOP_LOSS_PRESENT",
      "PASS",
      `Stop loss provided at ${proposal.stopLoss}.`,
      0.15,
    );
  }

  if (proposal.takeProfit === null) {
    addCheck(
      "TAKE_PROFIT_PRESENT",
      "FAIL",
      "A deterministic audit requires a take-profit level.",
      0.1,
      {
        reasonCode: "AGENT_PROPOSAL_MISSING_TAKE_PROFIT",
        riskDelta: 15,
        hardFail: true,
      },
    );
  } else {
    addCheck(
      "TAKE_PROFIT_PRESENT",
      "PASS",
      `Take profit provided at ${proposal.takeProfit}.`,
      0.1,
    );
  }

  if (proposal.invalidationConditions.length === 0) {
    addCheck(
      "INVALIDATION_DEFINED",
      "FAIL",
      "The proposal must define at least one invalidation condition.",
      0.15,
      {
        reasonCode: "AGENT_INVALIDATION_NOT_DEFINED",
        riskDelta: 20,
        hardFail: true,
      },
    );
  } else {
    addCheck(
      "INVALIDATION_DEFINED",
      "PASS",
      `${proposal.invalidationConditions.length} invalidation condition(s) provided.`,
      0.15,
    );
  }

  if (signalContext.signal === "WAIT") {
    addCheck(
      "MARKET_SIGNAL_ALIGNMENT",
      "WARN",
      `Underlying deterministic market signal is WAIT: ${signalContext.reasonCodes.join(", ")}.`,
      0.15,
      {
        reasonCode: "MARKET_SIGNAL_WAIT",
        riskDelta: 20,
        waitOnly: true,
      },
    );
  } else if (proposal.proposedSide && proposal.proposedSide !== signalContext.signal) {
    addCheck(
      "MARKET_SIGNAL_ALIGNMENT",
      "FAIL",
      `Proposal side ${proposal.proposedSide} conflicts with deterministic signal ${signalContext.signal}.`,
      0.15,
      {
        reasonCode: "AGENT_PROPOSAL_SIDE_CONFLICTS_WITH_SIGNAL",
        riskDelta: 35,
        hardFail: true,
      },
    );
  } else if (proposal.proposedSide) {
    addCheck(
      "MARKET_SIGNAL_ALIGNMENT",
      "PASS",
      `Proposal side ${proposal.proposedSide} aligns with deterministic signal ${signalContext.signal}.`,
      0.15,
    );
  } else {
    addCheck(
      "MARKET_SIGNAL_ALIGNMENT",
      "WARN",
      `Deterministic signal is ${signalContext.signal}, but proposal direction is missing.`,
      0.15,
      {
        reasonCode: "MARKET_SIGNAL_ALIGNMENT_SKIPPED_SIDE_MISSING",
        riskDelta: 10,
        waitOnly: true,
      },
    );
  }

  const referencePrice = proposal.entry ?? readSnapshotPrice(input);

  if (
    proposal.proposedSide &&
    proposal.stopLoss !== null &&
    proposal.takeProfit !== null
  ) {
    if (referencePrice === null) {
      addCheck(
        "RISK_GEOMETRY",
        "WARN",
        "Risk geometry could not be verified because no entry or usable market reference price was provided.",
        0.05,
        {
          reasonCode: "RISK_GEOMETRY_REFERENCE_PRICE_MISSING",
          riskDelta: 10,
          waitOnly: true,
          evidenceGap: "referencePrice",
        },
      );
    } else {
      const stopValid = proposal.proposedSide === "LONG"
        ? proposal.stopLoss < referencePrice
        : proposal.stopLoss > referencePrice;
      const targetValid = proposal.proposedSide === "LONG"
        ? proposal.takeProfit > referencePrice
        : proposal.takeProfit < referencePrice;

      if (!stopValid) {
        addCheck(
          "STOP_GEOMETRY",
          "FAIL",
          `Stop loss ${proposal.stopLoss} is invalid for ${proposal.proposedSide} relative to reference price ${referencePrice}.`,
          0.05,
          {
            reasonCode: proposal.proposedSide === "LONG"
              ? "AGENT_STOP_INVALID_FOR_LONG"
              : "AGENT_STOP_INVALID_FOR_SHORT",
            riskDelta: 25,
            hardFail: true,
          },
        );
      } else {
        addCheck(
          "STOP_GEOMETRY",
          "PASS",
          `Stop loss geometry is valid relative to reference price ${referencePrice}.`,
          0.05,
        );
      }

      if (!targetValid) {
        addCheck(
          "TARGET_GEOMETRY",
          "FAIL",
          `Take profit ${proposal.takeProfit} is invalid for ${proposal.proposedSide} relative to reference price ${referencePrice}.`,
          0.05,
          {
            reasonCode: proposal.proposedSide === "LONG"
              ? "AGENT_TARGET_INVALID_FOR_LONG"
              : "AGENT_TARGET_INVALID_FOR_SHORT",
            riskDelta: 20,
            hardFail: true,
          },
        );
      } else {
        addCheck(
          "TARGET_GEOMETRY",
          "PASS",
          `Take-profit geometry is valid relative to reference price ${referencePrice}.`,
          0.05,
        );
      }
    }
  }

  const requiresExternalEvidence = thesisRequiresExternalEvidence(proposal.thesis);
  const evidencePresent = hasEvidenceContext(input);

  if (requiresExternalEvidence && !evidencePresent) {
    addCheck(
      "EVIDENCE_CONTEXT",
      "WARN",
      "The thesis references external claims that should be backed by evidenceContext before approval.",
      0.05,
      {
        reasonCode: "AGENT_THESIS_REQUIRES_EXTERNAL_EVIDENCE",
        riskDelta: 15,
        waitOnly: true,
        evidenceGap: "externalEvidenceContext",
      },
    );
  } else {
    addCheck(
      "EVIDENCE_CONTEXT",
      "PASS",
      requiresExternalEvidence
        ? "External evidence context was supplied for a thesis that requires it."
        : "No external-evidence trigger was detected in the thesis.",
      0.05,
    );
  }

  const boundedRiskScore = Math.min(100, Math.round(riskScore));
  const auditVerdict: AgentAuditVerdict = hardFail ? "FAIL" : waitOnly ? "WAIT" : "PASS";
  const reasonCodeList = Array.from(reasonCodes);
  const evidenceGapList = Array.from(evidenceGaps);

  const proposalHash = hashStable(proposal);
  const signalHash = hashStable({
    symbol: signalContext.symbol,
    venue: signalContext.venue,
    timeframe: signalContext.timeframe,
    signal: signalContext.signal,
    confidence: signalContext.confidence,
    reasonCodes: signalContext.reasonCodes,
    engine: signalContext.engine,
  });
  const proofHash = hashStable({
    proposalHash,
    signalHash,
    auditVerdict,
    riskScore: boundedRiskScore,
    reasonCodes: reasonCodeList,
    evidenceGaps: evidenceGapList,
  });

  return {
    ok: true,
    symbol: signalContext.symbol,
    venue: signalContext.venue,
    timeframe: signalContext.timeframe,
    auditVerdict,
    riskScore: boundedRiskScore,
    reasonCodes: reasonCodeList,
    evidenceGaps: evidenceGapList,
    proposal,
    signalContext: {
      signal: signalContext.signal,
      confidence: signalContext.confidence,
      reasonCodes: signalContext.reasonCodes,
      engine: signalContext.engine,
    },
    checks,
    proofReceipt: {
      rulesVersion: "deterministic-agent-audit-v0",
      proposalHash,
      signalHash,
      proofHash,
    },
    timestamp: new Date().toISOString(),
    engine: "deterministic-agent-audit-v0",
  };
}
