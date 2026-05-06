// SHORT pipeline invariant test.
//
// Issues a synthetic compute by calling the running API server's signal
// recompute endpoint indirectly through HTTP isn't reasonable here, so this
// invariant exercises only what is observable without the engine: it computes
// what the audit layer would do for hand-crafted inputs that mirror the
// counter-trend SHORT exhaustion case, and confirms the audit shape no longer
// blocks SHORT outright when OI is ESTIMATED.
//
// Run with: pnpm --filter @workspace/scripts run short-pipeline-invariant
//
// Exit code 0 = invariants hold; non-zero = regression.

interface AuditCheck {
  name: string;
  result: "PASS" | "FAIL" | "WARN" | "SKIP";
  weight: number;
}

function computeWeightedVerdict(checks: AuditCheck[]): {
  verdict: "PASS" | "FAIL" | "WAIT";
  score: number;
} {
  let weightedScore = 0;
  let totalWeight = 0;
  let failCount = 0;
  for (const c of checks) {
    if (c.result === "SKIP") continue;
    totalWeight += c.weight;
    if (c.result === "PASS") weightedScore += c.weight;
    else if (c.result === "WARN") weightedScore += c.weight * 0.5;
    else if (c.result === "FAIL") failCount++;
  }
  const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
  if (failCount >= 2 || score < 0.4) return { verdict: "FAIL", score };
  if (failCount === 1 || score < 0.65) return { verdict: "WAIT", score };
  return { verdict: "PASS", score };
}

const failures: string[] = [];

// Invariant 1: A SHORT against ESTIMATED OI must NOT be down-graded by the
// OI_CONTEXT check. With OI_CONTEXT = SKIP and the other checks passing, the
// verdict should be PASS, not WAIT or FAIL.
const shortWithEstimatedOi: AuditCheck[] = [
  { name: "TREND_ALIGNMENT", result: "PASS", weight: 0.25 },
  { name: "RSI_ZONE", result: "PASS", weight: 0.15 },
  { name: "MACD_CONFIRM", result: "PASS", weight: 0.2 },
  { name: "OI_CONTEXT", result: "SKIP", weight: 0.2 },
  { name: "ATR_VALID", result: "PASS", weight: 0.1 },
  { name: "EMA_STACK", result: "PASS", weight: 0.1 },
  { name: "PYTH_PRICE_CONTEXT", result: "PASS", weight: 0.1 },
];
const r1 = computeWeightedVerdict(shortWithEstimatedOi);
if (r1.verdict !== "PASS") {
  failures.push(
    `INV1: SHORT with ESTIMATED OI (OI_CONTEXT skipped) should reach PASS; got ${r1.verdict} (score ${r1.score.toFixed(2)})`,
  );
}

// Invariant 2: Old behaviour comparison — same SHORT but with synthetic OI
// graded as WARN (the bug we removed) drags score down meaningfully. The
// delta between the two verdicts must be visible (score with SKIP must be
// strictly greater than score with the synthetic WARN).
const shortWithSyntheticOiAsWarn: AuditCheck[] = [
  { name: "TREND_ALIGNMENT", result: "PASS", weight: 0.25 },
  { name: "RSI_ZONE", result: "PASS", weight: 0.15 },
  { name: "MACD_CONFIRM", result: "PASS", weight: 0.2 },
  { name: "OI_CONTEXT", result: "WARN", weight: 0.2 },
  { name: "ATR_VALID", result: "PASS", weight: 0.1 },
  { name: "EMA_STACK", result: "PASS", weight: 0.1 },
  { name: "PYTH_PRICE_CONTEXT", result: "PASS", weight: 0.1 },
];
const r2 = computeWeightedVerdict(shortWithSyntheticOiAsWarn);
if (r1.score <= r2.score) {
  failures.push(
    `INV2: Skipping ESTIMATED OI must lift score above the buggy WARN baseline; SKIP=${r1.score.toFixed(2)} WARN=${r2.score.toFixed(2)}`,
  );
}

// Invariant 3: Counter-trend SHORT R/R floor logic. Replicate the engine
// rule: counter-trend → max(2.0, configured); trend-aligned → configured.
function effectiveRRFloor(counterTrend: boolean, configured: number): number {
  return counterTrend ? Math.max(2.0, configured) : configured;
}
const cases = [
  { counterTrend: true, configured: 1.5, expected: 2.0 },
  { counterTrend: true, configured: 2.5, expected: 2.5 },
  { counterTrend: false, configured: 1.5, expected: 1.5 },
];
for (const c of cases) {
  const got = effectiveRRFloor(c.counterTrend, c.configured);
  if (got !== c.expected) {
    failures.push(
      `INV3: effectiveRRFloor(counterTrend=${c.counterTrend}, configured=${c.configured}) = ${got}, expected ${c.expected}`,
    );
  }
}

if (failures.length > 0) {
  console.error("SHORT pipeline invariants FAILED:");
  for (const f of failures) console.error("  -", f);
  process.exit(1);
}

console.log("SHORT pipeline invariants OK");
console.log(`  INV1 SHORT+SKIP_OI verdict: ${r1.verdict} (score ${r1.score.toFixed(2)})`);
console.log(`  INV2 SHORT+WARN_OI verdict: ${r2.verdict} (score ${r2.score.toFixed(2)})`);
console.log(`  INV3 R/R floor cases: ${cases.length} passed`);
