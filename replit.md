# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## DST — Deterministic Signal Trader (Phase 5 — Data Quality Hardening)

### Purpose
DST is an **audit-first signal system** — a deterministic pre-trade audit layer for perp traders. It does not replace charting tools (TradingView) or execution venues (Hyperliquid). It replaces the undisciplined part of the pre-trade process. DST signals possible trades. DJZS audits whether they are admissible. Hermes runs the system. WAIT is not a failure state — it is the correct outcome when no setup passes the audit threshold.

**Roles (canonical):** DST = Deterministic Signal Trading (finds possible trades). DJZS = Audit layer (audits setups for admissibility — deterministic, never overridden). Hermes = Runtime (scan loop, constraints, routing).
**DST is NOT:** a charting platform, an execution venue, a signal subscription service, or a general-purpose intelligence dashboard.
**DST IS:** an audit-first signal system. DJZS audits setups — rules them in or out with machine-readable rejection codes and an immutable process quality grade. WAIT is the most common and most correct output.

### Architecture
- **Frontend** (`artifacts/dst`): React + Vite terminal brutalist UI — JetBrains Mono throughout, near-black #070A0D, green #84CC16, amber #F59E0B, red #F23030. No Space Grotesk. No border-radius. Restrained green glow on active elements. `terminal-panel`, `terminal-panel-header`, `micro-label`, `glow-green` utilities in index.css.
- **Backend** (`artifacts/api-server`): Express API at `/api`
- **Signal Engine** (`artifacts/api-server/src/lib/dst/signalEngine.ts`): Full pre-trade process enforcement, reads HermesConstraints, now includes DataQualityReport + data guards
- **Quality Model** (`artifacts/api-server/src/lib/quality/types.ts`): Canonical data-quality types — DataProvenance, DataQualityReport, QualityFlag, PythVerifierResult
- **Hermes Module** (`artifacts/api-server/src/lib/hermes/`): Orchestration runtime — constraints, scan loop, metrics, evaluation
- **Pyth Client** (`artifacts/api-server/src/lib/pyth/pythClient.ts`): Secondary price-confidence verifier via Hermes REST API (free, no key). Scaffolded as CONFIRMS/DIVERGES/UNAVAILABLE/SKIPPED verifier.
- **Integration Registry** (`artifacts/api-server/src/lib/integrations/registry.ts`): 7 scaffolded integration stubs
- **DefiLlama Client** (`artifacts/api-server/src/lib/dst/defillamaClient.ts`): Hardened ingestion with provenance — `NormalizedPriceResult`, `NormalizedHistoryResult`, stale thresholds, fallback flags
- **Agent Interpreter** (`artifacts/api-server/src/lib/dst/agentInterpreter.ts`): Chat command processing
- **Database**: PostgreSQL — signals, watchlist, alerts tables. signals table now has `data_quality` jsonb column (Phase 5).

### Hermes Module — Phase 3 (complete)
- `constraints.ts` — system constraints (timeframe, R/R threshold, Pyth filter, alert routing, wait bias policy). Persisted to `/tmp/hermes-constraints.json`
- `scan.ts` — scan trigger, job tracking, in-memory stats (totalScansToday, totalApprovedToday, totalWaitToday)
- `metrics.ts` — DB-backed metrics computation (24H/7D/30D): wait rate, approval rate, rejection code breakdown, setup family breakdown
- `evaluation.ts` — weekly policy evaluation report with per-parameter recommendations (KEEP/TIGHTEN/LOOSEN/REVIEW)
- `findings.ts` — evidence ingress: SubmitFindingSchema (Zod), ingestFinding(), getFindingsForTarget(), getRecentFindings(), adaptFindingsToAuditContext(), BOUNDARY_REMINDER constant
- `types.ts` — local type definitions (HermesConstraints, HermesJob, HermesMetrics, HermesEvaluation, PythPriceData, EvalReviewItem)

### Hermes Findings Ingress — Phase 3 Architecture
Boundary doctrine is enforced at every layer:
- **POST /api/hermes/findings** — protected ingress. Accepts SubmitFindingRequest, validates via Zod, persists to `hermes_findings` DB table, returns `SubmitFindingAccepted` with BOUNDARY_REMINDER in every response.
- **GET /api/hermes/findings** — recent findings log (up to 100)
- **GET /api/hermes/findings/:target** — active findings for an asset (used in signal-detail hermesContext section)
- **`hermes_findings` DB table** — findingId, runId, sourceAgent, marketType, target, observationType, summary, evidence (jsonb), confidence (numeric metadata, never used for scoring), suggestedFlags, status (ACTIVE/EXPIRED/DISMISSED), expiresAt
- **BOUNDARY_REMINDER** (constant): "HERMES SUBMITS FINDINGS ONLY. Confidence is metadata — not a score. Suggested flags are hints — not verdicts. DJZS is the deterministic audit gate. Capital movement requires the user's decision."

### Codegen Pipeline
- `lib/api-spec/fix-api-zod-index.mjs` — post-codegen fixup that strips a phantom `api.schemas` export from Orval v8 generated `lib/api-zod/src/index.ts`
- Codegen command: `pnpm --filter @workspace/api-spec run codegen`

### Signal Engine — Phase 2 Logic
- Fetches real-time prices from DefiLlama Coins API
- Computes EMA9/21/50, RSI(14), MACD, ATR from 4H historical data
- **Hard execution rules** (any violation → WAIT):
  - NO_REGIME: regime=UNDEFINED
  - NO_INVALIDATION: invalidation price missing or zero
  - RR_BELOW_THRESHOLD: reward/risk < 1.5
- **Setup families**: TREND_CONTINUATION_LONG/SHORT (primary), RANGE_LONG/SHORT (secondary, penalized), NO_SETUP
- **Late entry ATR filter**: price > EMA9 + 1.5×ATR for LONG → ENTRY_TOO_LATE
- **Narrative risk assessment**: regime=RANGING + momentum codes → NARRATIVE_HEAVY
- **Process verdict**: APPROVED / REJECTED / DEGRADED (separate from direction and DJZS verdict)
- **Logic admissibility**: ADMISSIBLE / INADMISSIBLE / CONDITIONAL
- **Process quality grade**: A–F
- **Pre-trade checklist**: thesis, regime, entry zone, invalidation, target, reason codes, reject conditions, R/R
- **Outcome tracking**: scaffolded stub, all nulls until Phase 3

### Rejection Codes
`NO_REGIME` `ENTRY_TOO_LATE` `STOP_INVALID` `TARGET_UNREALISTIC` `NARRATIVE_HEAVY` `CONFLICTING_SIGNALS` `CROWDING_TOO_HIGH` `NO_INVALIDATION` `RR_BELOW_THRESHOLD` `CONFIDENCE_STRUCTURE_MISMATCH` `UNDEFINED_REGIME` `RANGE_SECONDARY`

### API Routes
- `GET /api/signals` — all asset signals (cached 5 min)
- `GET /api/signals/:asset` — signal detail with pre-trade checklist, process verdict, outcome stub
- `GET /api/signals/feed` — chronological feed with processVerdict, setupFamily, rrRatio
- `GET /api/market/snapshot` / `/:asset` — market data
- `GET /api/audit/:asset` — DJZS audit report
- `GET/POST /api/watchlist`, `DELETE /api/watchlist/:id`
- `GET/POST /api/alerts`, `DELETE /api/alerts/:id`
- `POST /api/agent/chat` — agent chat
- `GET /api/integrations` — all integration scaffold statuses
- `GET /api/integrations/:name` — individual integration status
- `POST /api/integrations/:name/toggle` — enable/disable (in-memory)
- `GET /api/hermes/status` — scan loop state, recent jobs, daily stats
- `GET /api/hermes/constraints` — current system constraints
- `PUT /api/hermes/constraints` — update constraints (persisted to disk)
- `POST /api/hermes/scan` — manual scan trigger (runs all preferred assets)
- `GET /api/hermes/jobs` — recent job list with phase-by-phase status
- `GET /api/hermes/metrics?period=24H|7D|30D` — DB-backed scan metrics
- `GET /api/hermes/evaluation` — weekly policy evaluation report
- `POST /api/hermes/findings` — protected evidence ingress (Zod-validated, persisted to DB, returns BOUNDARY_REMINDER)
- `GET /api/hermes/findings?limit=N` — recent findings log
- `GET /api/hermes/findings/:target` — active findings for a specific asset
- `GET /api/pyth/prices` — live BTC/ETH/SOL prices from Pyth Hermes REST API
- `GET /api/pyth/prices/:asset` — single asset Pyth price + confidence

### DB Schema — Phase 2
`signals` table includes: direction, confidence, verdictDjzs, processVerdict, logicAdmissibility, setupFamily, entryQuality, narrativeRisk, rrRatio, thesis, whyTrade, rejectIf, rejectionCodes, processQualityGrade, preTradChecklist (jsonb), outcomeTracking (jsonb), marketSnapshot (jsonb), trendRegime (jsonb), openInterestContext (jsonb), auditReport (jsonb)

### Integration Scaffold (Phase 2–4, all off by default)
- **Hermes** (SCHEDULER) — 15-min recurring scan, Phase 2
- **Pyth** (PRICE_FEED) — confidence interval overlay, requires `PYTH_ENDPOINT`, Phase 2
- **Browserbase** (RESEARCH) — triggered web research, requires `BROWSERBASE_API_KEY`, Phase 2
- **XMTP** (ALERTS) — wallet-to-wallet delivery, requires `XMTP_PRIVATE_KEY`, Phase 3
- **Telegram** (ALERTS) — bot delivery, requires `TELEGRAM_BOT_TOKEN`, Phase 3
- **Discord** (ALERTS) — webhook embeds, requires `DISCORD_WEBHOOK_URL`, Phase 3
- **MPP** (ENRICHMENT) — institutional flow enrichment, requires `MPP_API_KEY`, Phase 4

### Frontend Pages
- `/` Dashboard (Admissibility Console) — 3-layer positioning strip (DST FINDS / DJZS GATES / HERMES RUNS), asset cards with prominent WAIT panels, signal feed with WAIT-bias framing
- `/signal/:asset` — Canonical trade packet: header + decision gate (DJZS + process verdict side-by-side) + prominent rejection/WAIT panel + trade parameters + routing priority + thesis + checklist + market evidence
- `/audit/:asset` — DJZS audit breakdown
- `/watchlist` — tracked assets
- `/alerts` — alert configuration
- `/agent` — chat agent
- `/integrations` — integration scaffold + live Pyth price confidence display
- `/hermes` — Hermes operations console (pipeline stages, system constraints editor, subagent roles, job log, findings ingress section with boundary panel + live findings log)
- `/evaluation` — stage metrics (24H/7D/30D) + weekly policy evaluation with per-parameter recommendations
- `/signal/:asset` (signal-detail) — includes HermesTargetFindingsPanel after DataQualityPanel: renders active findings for the asset if any exist, each with boundary panel, evidence reliability indicators, and confidence as metadata label
- `/stack` — Product positioning: DST vs charting vs execution, "NOT BUILT FOR" section, DST advantage (pre-trade discipline, evidence integration, deterministic audit), full architecture roadmap with phased integration stack, 5-step workflow diagram, operating doctrine

### Extending
- Add new assets: update `ASSET_MAP` in `defillamaClient.ts`
- Add new timeframes: pass `timeframe` param to `computeSignal()`
- Activate integrations: set env vars + flip `configured: true` in registry.ts, then toggle via UI
- Enable outcome tracking: implement the Phase 3 outcome resolution loop
