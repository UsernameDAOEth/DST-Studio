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

## DST — Crypto Signal Assistant

### Purpose
Paper-trading signal assistant for perp traders monitoring ETH, BTC, SOL on the 4H timeframe. Ingests DefiLlama free API data and computes deterministic LONG/SHORT/WAIT signals with full DJZS audit breakdowns.

### Architecture
- **Frontend** (`artifacts/dst`): React + Vite dark terminal UI
- **Backend** (`artifacts/api-server`): Express API at `/api`
- **Signal Engine** (`artifacts/api-server/src/lib/dst/signalEngine.ts`): Core signal computation
- **DefiLlama Client** (`artifacts/api-server/src/lib/dst/defillamaClient.ts`): Market data fetching
- **Agent Interpreter** (`artifacts/api-server/src/lib/dst/agentInterpreter.ts`): Chat command processing
- **Database**: PostgreSQL — signals, watchlist, alerts tables

### Signal Engine
- Fetches real-time prices from DefiLlama Coins API
- Fetches 4H historical candlestick data for indicator computation
- Computes EMA9/21/50, RSI(14), MACD, ATR
- Derives regime: BULL/BEAR/RANGING/UNDEFINED
- Issues LONG/SHORT/WAIT direction with reason codes
- DJZS audit: 6 weighted checks → PASS/FAIL/WAIT verdict

### API Routes
- `GET /api/signals` — all asset signals (cached 5 min)
- `GET /api/signals/:asset` — signal detail with full breakdown
- `GET /api/signals/feed` — chronological signal feed
- `GET /api/market/snapshot` — market snapshot for all assets
- `GET /api/market/snapshot/:asset` — snapshot for one asset
- `GET /api/audit/:asset` — DJZS audit report
- `GET/POST /api/watchlist` — watchlist CRUD
- `DELETE /api/watchlist/:id`
- `GET/POST /api/alerts` — alerts CRUD
- `DELETE /api/alerts/:id`
- `POST /api/agent/chat` — agent chat commands (signal, audit, help, etc.)

### DB Schema
- `watchlist` — tracked assets with timeframe
- `alerts` — configured alert conditions
- `signals` — computed signals cached with full JSON blobs

### Extending
- Add pro DefiLlama endpoints: update `defillamaClient.ts`
- Add MPP enrichment: add new fields to `ComputedSignal` and `signalEngine.ts`
- Add new assets: update `ASSET_MAP` in `defillamaClient.ts`
- Add new timeframes: pass `timeframe` param to `computeSignal()`
