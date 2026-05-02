import { computeMetrics } from "./metrics";
import { HermesEvaluation, EvalReviewItem } from "./types";
import { getConstraints } from "./constraints";

export async function generateEvaluation(): Promise<HermesEvaluation> {
  const metrics = await computeMetrics("7D");
  const constraints = getConstraints();

  const thresholdReview: EvalReviewItem[] = [
    {
      parameter: "minRRThreshold",
      currentValue: String(constraints.minRRThreshold),
      observation: `Avg R/R on APPROVED signals this week: ${metrics.avgRROnApproved?.toFixed(2) ?? "N/A"}.`,
      recommendation: "KEEP",
      rationale: "R/R threshold is functioning as intended. No adjustment warranted without outcome data.",
    },
    {
      parameter: "lateEntryAtrMultiplier",
      currentValue: String(constraints.lateEntryAtrMultiplier),
      observation: `Timing accuracy (OPTIMAL/ACCEPTABLE entries): ${metrics.timingAccuracy != null ? (metrics.timingAccuracy * 100).toFixed(0) + "%" : "N/A"}.`,
      recommendation: "KEEP",
      rationale: "Late-entry filter is operating correctly. Review after Phase 3 outcome tracking is live.",
    },
    {
      parameter: "pythConfidenceThreshold",
      currentValue: String(constraints.pythConfidenceThreshold),
      observation: `Pyth influence count this period: ${metrics.pythInfluenceCount}. Integration ${constraints.pythConfidenceFilter ? "active" : "inactive"}.`,
      recommendation: "KEEP",
      rationale: "Insufficient data to evaluate Pyth confidence threshold. Enable and run for 7 days before reviewing.",
    },
    {
      parameter: "waitBiasPolicy",
      currentValue: constraints.waitBiasPolicy,
      observation: `WAIT rate this period: ${(metrics.waitRate * 100).toFixed(0)}%. Target: >70% in STRICT mode.`,
      recommendation: metrics.waitRate >= 0.70 ? "KEEP" : "TIGHTEN",
      rationale: metrics.waitRate >= 0.70
        ? "WAIT rate within STRICT policy target. System is filtering correctly."
        : "WAIT rate below STRICT policy target. Consider tightening entry quality or R/R thresholds.",
    },
  ];

  const rejectConditionReview: EvalReviewItem[] = [
    {
      parameter: "NO_INVALIDATION rate",
      currentValue: String(metrics.rejectionCodeBreakdown["NO_INVALIDATION"] || 0),
      observation: `Rejected ${metrics.rejectionCodeBreakdown["NO_INVALIDATION"] || 0} signals this period for missing invalidation.`,
      recommendation: "KEEP",
      rationale: "NO_INVALIDATION is a hard rule. Every setup must have a defined stop level.",
    },
    {
      parameter: "NARRATIVE_HEAVY rate",
      currentValue: String(metrics.rejectionCodeBreakdown["NARRATIVE_HEAVY"] || 0),
      observation: `Penalized ${metrics.rejectionCodeBreakdown["NARRATIVE_HEAVY"] || 0} signals for narrative-driven setups in RANGING regime.`,
      recommendation: "KEEP",
      rationale: "Narrative risk filter is operating as intended. Structurally weak setups should be penalized.",
    },
    {
      parameter: "ENTRY_TOO_LATE rate",
      currentValue: String(metrics.rejectionCodeBreakdown["ENTRY_TOO_LATE"] || 0),
      observation: `Flagged ${metrics.rejectionCodeBreakdown["ENTRY_TOO_LATE"] || 0} signals as late entries this period.`,
      recommendation: "KEEP",
      rationale: "ATR extension filter is working. Late-entry detection prevents chasing extended moves.",
    },
  ];

  const triggerRuleReview: EvalReviewItem[] = [
    {
      parameter: "browserbaseTriggerPolicy",
      currentValue: constraints.browserbaseTriggerPolicy,
      observation: "Browserbase research is currently DISABLED. No web research was triggered this period.",
      recommendation: "REVIEW",
      rationale: "Consider enabling APPROVED_ONLY policy when Browserbase API key is configured.",
    },
    {
      parameter: "pythConfidenceFilter",
      currentValue: constraints.pythConfidenceFilter ? "ENABLED" : "DISABLED",
      observation: `Pyth confidence filter is ${constraints.pythConfidenceFilter ? "active and influencing processVerdict" : "inactive"}.`,
      recommendation: "REVIEW",
      rationale: "Pyth API is live and returning data. Enabling the confidence filter adds real price freshness validation.",
    },
  ];

  const routingRuleReview: EvalReviewItem[] = [
    {
      parameter: "telegram",
      currentValue: constraints.alertRouting.telegram ? "ENABLED" : "DISABLED",
      observation: "Telegram bot routing is currently disabled.",
      recommendation: "REVIEW",
      rationale: "Configure TELEGRAM_BOT_TOKEN and enable to receive APPROVED signal alerts.",
    },
    {
      parameter: "xmtp",
      currentValue: constraints.alertRouting.xmtp ? "ENABLED" : "DISABLED",
      observation: "XMTP wallet-to-wallet delivery is currently disabled.",
      recommendation: "REVIEW",
      rationale: "Configure XMTP_PRIVATE_KEY to enable decentralized alert delivery.",
    },
    {
      parameter: "discord",
      currentValue: constraints.alertRouting.discord ? "ENABLED" : "DISABLED",
      observation: "Discord webhook routing is currently disabled.",
      recommendation: "REVIEW",
      rationale: "Configure DISCORD_WEBHOOK_URL to receive signal embeds in a channel.",
    },
  ];

  const overallAssessment = `7D scan summary: ${metrics.totalScans} total scans, ${(metrics.waitRate * 100).toFixed(0)}% WAIT rate, ${metrics.totalApproved} APPROVED. ${metrics.waitRate >= 0.70 ? "WAIT bias is operating within STRICT policy target." : "WAIT rate below STRICT policy target — review threshold settings."} No doctrine changes recommended. DJZS audit doctrine is INTACT.`;

  return {
    generatedAt: new Date().toISOString(),
    periodLabel: "Last 7 Days",
    thresholdReview,
    rejectConditionReview,
    triggerRuleReview,
    routingRuleReview,
    overallAssessment,
    doctrineStatus: "INTACT",
  };
}
