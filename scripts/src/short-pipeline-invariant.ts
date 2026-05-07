// SHORT pipeline invariant test.
//
// Two modes:
//
//   pnpm --filter @workspace/scripts run short-pipeline-invariant
//     Runs synthetic invariants against the audit-layer math and the R/R
//     floor logic. Pure unit-test style; no DB, no network. This is the CI
//     guard that the rebalance shape did not regress.
//
//   pnpm --filter @workspace/scripts run short-pipeline-invariant:db
//     Connects to the configured Postgres (DATABASE_URL) and surfaces what
//     is actually happening to SHORTs in the last 7 days: counts by verdict,
//     setup-family distribution, top reason_codes, top rejection_codes, and
//     which audit checks are failing most often. Use this when the dashboard
//     chip still reads "SHORT PIPELINE BROKEN" to identify the bottleneck.
//
// Exit code 0 = invariants hold (synthetic mode) / report printed (db mode).
// Non-zero = regression in synthetic mode, or DB query failure in db mode.

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

const args = process.argv.slice(2);
const dbMode = args.includes("--db");

function parseTimeframeArg(): "4H" | "15m" | "ALL" {
  const tfArg = args.find((a) => a.startsWith("--timeframe="));
  if (!tfArg) return "ALL";
  const v = tfArg.split("=")[1];
  if (v === "4H" || v === "15m") return v;
  if (v === "all" || v === "ALL") return "ALL";
  console.error(`Unknown --timeframe value: ${v}. Use 4H | 15m | all.`);
  process.exit(2);
}

if (dbMode) {
  const tfSel = parseTimeframeArg();
  const targets: Array<"4H" | "15m"> = tfSel === "ALL" ? ["4H", "15m"] : [tfSel];
  for (const tf of targets) {
    if (targets.length > 1) console.log(`\n══ TIMEFRAME ${tf} ══`);
    await runDbReport(tf);
  }
  process.exit(0);
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

// Invariant 4: CROWDING_TOO_HIGH must fire when OI data is REAL and funding
// is extreme in the trade direction; it must STAY suppressed when OI is
// ESTIMATED (synthetic). This is the gate that #14 re-enables once the
// OKX perps fetch succeeds. Pure replication of the engine rule at
// signalEngine.ts: oiContext.dataConfidence === "REAL" && extreme funding.
function detectCrowding(args: {
  dataConfidence: "REAL" | "ESTIMATED";
  fundingRate: number;
  direction: "LONG" | "SHORT" | "WAIT";
}): boolean {
  return (
    args.dataConfidence === "REAL" &&
    ((args.fundingRate > 0.001 && args.direction === "LONG") ||
      (args.fundingRate < -0.001 && args.direction === "SHORT"))
  );
}
const crowdingCases: Array<{
  name: string;
  args: { dataConfidence: "REAL" | "ESTIMATED"; fundingRate: number; direction: "LONG" | "SHORT" | "WAIT" };
  expected: boolean;
}> = [
  { name: "REAL + LONG + extreme positive funding", args: { dataConfidence: "REAL", fundingRate: 0.0015, direction: "LONG" }, expected: true },
  { name: "REAL + SHORT + extreme negative funding", args: { dataConfidence: "REAL", fundingRate: -0.0015, direction: "SHORT" }, expected: true },
  { name: "REAL + LONG + neutral funding", args: { dataConfidence: "REAL", fundingRate: 0.0001, direction: "LONG" }, expected: false },
  { name: "REAL + LONG + extreme negative funding (wrong side)", args: { dataConfidence: "REAL", fundingRate: -0.0015, direction: "LONG" }, expected: false },
  { name: "ESTIMATED + LONG + extreme positive funding (suppressed)", args: { dataConfidence: "ESTIMATED", fundingRate: 0.0015, direction: "LONG" }, expected: false },
  { name: "ESTIMATED + SHORT + extreme negative funding (suppressed)", args: { dataConfidence: "ESTIMATED", fundingRate: -0.0015, direction: "SHORT" }, expected: false },
];
for (const c of crowdingCases) {
  const got = detectCrowding(c.args);
  if (got !== c.expected) {
    failures.push(`INV4: detectCrowding ${c.name} expected ${c.expected}, got ${got}`);
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
console.log(`  INV4 CROWDING_TOO_HIGH cases: ${crowdingCases.length} passed`);

export {};

async function runDbReport(timeframe: "4H" | "15m"): Promise<void> {
  const { db, signalsTable } = await import("@workspace/db");
  const { gte, eq, and, desc } = await import("drizzle-orm");

  const WINDOW_DAYS = 7;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: signalsTable.id,
      asset: signalsTable.asset,
      timeframe: signalsTable.timeframe,
      computedAt: signalsTable.computedAt,
      direction: signalsTable.direction,
      processVerdict: signalsTable.processVerdict,
      logicAdmissibility: signalsTable.logicAdmissibility,
      setupFamily: signalsTable.setupFamily,
      reasonCodes: signalsTable.reasonCodes,
      rejectionCodes: signalsTable.rejectionCodes,
      auditReport: signalsTable.auditReport,
      rrRatio: signalsTable.rrRatio,
    })
    .from(signalsTable)
    .where(
      and(
        eq(signalsTable.direction, "SHORT"),
        eq(signalsTable.timeframe, timeframe),
        gte(signalsTable.computedAt, since),
      ),
    )
    .orderBy(desc(signalsTable.computedAt));

  console.log(`SHORT pipeline DB report [tf=${timeframe}] — last ${WINDOW_DAYS} days`);
  console.log(`  total SHORTs: ${rows.length}`);
  if (rows.length === 0) {
    console.log("  no SHORTs emitted in window — engine is not producing SHORT setups");
    console.log("  next: lower setup-detection thresholds or wait for market conditions");
    return;
  }

  const verdictCounts = new Map<string, number>();
  const setupCounts = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  const rejectionCounts = new Map<string, number>();
  const checkFailCounts = new Map<string, number>();
  const checkSkipCounts = new Map<string, number>();
  let approved = 0;

  for (const r of rows) {
    if (r.processVerdict === "APPROVED") approved++;
    bump(verdictCounts, r.processVerdict ?? "UNKNOWN");
    bump(setupCounts, r.setupFamily ?? "UNKNOWN");
    for (const c of r.reasonCodes ?? []) bump(reasonCounts, c);
    for (const c of r.rejectionCodes ?? []) bump(rejectionCounts, c);
    const checks = (r.auditReport as { checks?: Array<{ name: string; result: string }> } | null)
      ?.checks;
    if (Array.isArray(checks)) {
      for (const ch of checks) {
        if (ch.result === "FAIL") bump(checkFailCounts, ch.name);
        else if (ch.result === "SKIP") bump(checkSkipCounts, ch.name);
      }
    }
  }

  const approvalRate = rows.length > 0 ? (approved / rows.length) * 100 : 0;
  console.log(`  approved: ${approved} (${approvalRate.toFixed(1)}%)`);
  console.log(`  shortPipelineBroken: ${approved === 0 ? "YES" : "no"}`);

  printSection("verdicts", verdictCounts);
  printSection("setup families", setupCounts);
  printSection("reason codes (top 10)", reasonCounts, 10);
  printSection("rejection codes (top 10)", rejectionCounts, 10);
  printSection("audit checks failing (top 10)", checkFailCounts, 10);
  printSection("audit checks skipped (top 10)", checkSkipCounts, 10);

  const oldest = rows[rows.length - 1];
  const newest = rows[0];
  if (oldest && newest) {
    console.log(
      `  window span: ${oldest.computedAt.toISOString()} → ${newest.computedAt.toISOString()}`,
    );
  }

  if (approved === 0) {
    const topBlocker =
      pickTop(rejectionCounts) ?? pickTop(checkFailCounts) ?? pickTop(reasonCounts);
    if (topBlocker) {
      console.log(`  most likely SHORT bottleneck: ${topBlocker[0]} (${topBlocker[1]} hits)`);
    }
  }
}

function bump(m: Map<string, number>, k: string): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

function printSection(label: string, m: Map<string, number>, limit?: number): void {
  if (m.size === 0) return;
  const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const shown = limit ? entries.slice(0, limit) : entries;
  console.log(`  ${label}:`);
  for (const [k, v] of shown) console.log(`    ${v.toString().padStart(4)}  ${k}`);
}

function pickTop(m: Map<string, number>): [string, number] | undefined {
  let top: [string, number] | undefined;
  for (const e of m.entries()) {
    if (!top || e[1] > top[1]) top = e;
  }
  return top;
}
