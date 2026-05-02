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

## DST — Deterministic Signal Trader (Phase 3)

### Purpose
DST is the **predictive layer** — a disciplined pre-trade process system for perp traders monitoring ETH, BTC, SOL on the 4H timeframe. DJZS is the **admissibility and audit layer**. Every signal is a complete process report with full pre-trade checklist, logic admissibility gate, process verdict, and explicit rejection reasons. WAIT is the default when any required field is missing or any hard rule is violated.

### Architecture
- **Frontend** (`artifacts/dst`): React + Vite DJZS dark terminal UI (near-black #080B0F, acid lime #A3E635)
- **Backend** (`artifacts/api-server`): Express API at `/api`
- **Signal Engine** (`artifacts/api-server/src/lib/dst/signalEngine.ts`): Full pre-trade process enforcement, reads HermesConstraints
- **Hermes Module** (`artifacts/api-server/src/lib/hermes/`): Orchestration runtime — constraints, scan loop, metrics, evaluation
- **Pyth Client** (`artifacts/api-server/src/lib/pyth/pythClient.ts`): Live price + confidence via Hermes REST API (free, no key)
- **Integration Registry** (`artifacts/api-server/src/lib/integrations/registry.ts`): 7 scaffolded integration stubs
- **DefiLlama Client** (`artifacts/api-server/src/lib/dst/defillamaClient.ts`): Market data fetching
- **Agent Interpreter** (`artifacts/api-server/src/lib/dst/agentInterpreter.ts`): Chat command processing
- **Database**: PostgreSQL — signals, watchlist, alerts tables (Phase 2 schema)

### Hermes Module — Phase 3
- `constraints.ts` — system constraints (timeframe, R/R threshold, Pyth filter, alert routing, wait bias policy). Persisted to `/tmp/hermes-constraints.json`
- `scan.ts` — scan trigger, job tracking, in-memory stats (totalScansToday, totalApprovedToday, totalWaitToday)
- `metrics.ts` — DB-backed metrics computation (24H/7D/30D): wait rate, approval rate, rejection code breakdown, setup family breakdown
- `evaluation.ts` — weekly policy evaluation report with per-parameter recommendations (KEEP/TIGHTEN/LOOSEN/REVIEW)
- `types.ts` — local type definitions (HermesConstraints, HermesJob, HermesMetrics, HermesEvaluation, PythPriceData, EvalReviewItem)

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
- `GET /api/pyth/prices` — live BTC/ETH/SOL prices from Pyth Hermes REST API
- `GET /api/pyth/price/:asset` — single asset price

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
- `/` Dashboard — asset cards + signal feed (with PROCESS + R/R columns)
- `/signal/:asset` — full process report (checklist, verdict, rejection codes, assessment, outcome stub)
- `/audit/:asset` — DJZS audit breakdown
- `/watchlist` — tracked assets
- `/alerts` — alert configuration
- `/agent` — chat agent
- `/integrations` — integration scaffold + live Pyth price confidence display
- `/hermes` — Hermes operations console (pipeline stages, system constraints editor, subagent roles, job log)
- `/evaluation` — stage metrics (24H/7D/30D) + weekly policy evaluation with per-parameter recommendations

### Extending
- Add new assets: update `ASSET_MAP` in `defillamaClient.ts`
- Add new timeframes: pass `timeframe` param to `computeSignal()`
- Activate integrations: set env vars + flip `configured: true` in registry.ts, then toggle via UI
- Enable outcome tracking: implement the Phase 3 outcome resolution loop
