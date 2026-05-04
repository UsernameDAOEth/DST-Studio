# Overview

DST (Deterministic Signal Trader) is an audit-first signal system designed as a pre-trade audit layer for perp traders. Its primary purpose is to provide deterministic signals for potential trades and ensure they pass a rigorous audit process (DJZS) before execution. DST focuses on disciplined pre-trade analysis, integrating evidence and providing clear, machine-readable audit verdicts, with "WAIT" being a common and correct outcome when no setup meets the audit threshold.

Key capabilities include:
- **Signal Generation**: Identifying potential trade setups.
- **Deterministic Audit (DJZS)**: Rigorous, immutable auditing of trade setups with machine-readable rejection codes and process quality grades.
- **Orchestration (Hermes)**: Manages the scan loop, enforces constraints, and tracks metrics for the entire system.
- **Data Quality Hardening**: Focus on data provenance, quality reports, and validation during signal processing.

DST is not a charting platform, execution venue, or general intelligence dashboard; it is a specialized tool for pre-trade audit and signal generation.

# User Preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and clear explanations of the rationale. Before implementing major architectural changes or introducing new dependencies, please ask for confirmation. I value code that is clean, modular, and follows TypeScript best practices. Avoid making changes to the `.vscode` folder.

# System Architecture

The project is a pnpm workspace monorepo built with Node.js 24 and TypeScript 5.9.

**Core Architectural Decisions:**
- **Monorepo Structure**: pnpm workspaces manage multiple packages (`@workspace/api-spec`, `@workspace/db`, `@workspace/api-server`, `artifacts/dst`).
- **API**: Express 5 serves as the backend API.
- **Database**: PostgreSQL with Drizzle ORM for schema management and data interaction.
- **Validation**: Zod for robust data validation across the system, including `drizzle-zod`.
- **API Codegen**: Orval is used to generate API hooks and Zod schemas from an OpenAPI specification, ensuring type safety and consistency between frontend and backend.
- **Build System**: esbuild is used for CJS bundle compilation.
- **Audit-First Design**: The core philosophy dictates that all trade signals must pass a deterministic audit layer (DJZS) before being presented.
- **Modularity**: Separation of concerns into distinct modules like Signal Engine, Quality Model, Hermes Module, Pyth Client, and Agent Interpreter.

**UI/UX Decisions (Frontend - `artifacts/dst`):**
- **Design Philosophy**: Terminal brutalist UI.
- **Typography**: Exclusively JetBrains Mono.
- **Color Palette**: Near-black background (`#070A0D`), with accent colors for different states: green (`#84CC16`), amber (`#F59E0B`), and red (`#F23030`).
- **Styling**: No border-radius, restrained green glow on active elements. Utilizes `terminal-panel`, `terminal-panel-header`, `micro-label`, `glow-green` utility classes.
- **Components**: `VerdictBadge` for unified signal status display, `ProcessGradeBadge` with inline explanations (F-grade: HARD RULE FAILURE, D-grade: DEGRADED note), `DjzsGateBadge` derives display verdict from `logicAdmissibility` (ADMISSIBLE→PASS, CONDITIONAL→WAIT, INADMISSIBLE→FAIL), `EntryQualityBadge` with `overridden` prop for line-through when REJECTED, `gateDisplayVerdict` helper exported for dashboard/feed use. Pipeline health chips (`DataGradeChip`, `PipelineChips`) show data quality flags on dashboard cards.
- **Navigation**: Dedicated pages for Dashboard, Signal Details, Audit Reports, Watchlist, Alerts, Agent Chat, Integrations, Hermes Operations Console, and Evaluation.

**Technical Implementations:**
- **Signal Engine**: Enforces the full pre-trade process, reading HermesConstraints and incorporating `DataQualityReport` and data guards. Computes technical indicators (EMA, RSI, MACD, ATR) from 4H historical data.
- **Quality Model**: Defines canonical data quality types including `DataProvenance`, `DataQualityReport`, `QualityFlag`, and `PythVerifierResult`.
- **Hermes Module**:
    - **Constraints**: System constraints (timeframe, R/R, Pyth filter, wait bias) persisted to `/tmp/hermes-constraints.json`.
    - **Scan Loop**: Manages scan triggers, job tracking, and in-memory statistics.
    - **Metrics**: DB-backed computation of wait rate, approval rate, rejection breakdown.
    - **Evaluation**: Weekly policy evaluation with parameter recommendations.
    - **Findings Ingress**: Protected endpoint for submitting findings, validated by Zod, persisted to `hermes_findings` DB table, with content hashing for deduplication.
    - **Kanban Board**: In-memory operational console for tracking workflow tasks (SCAN_CREATE, FETCH_MARKET_CONTEXT, VERIFY_PRICE_STATE, COLLECT_HERMES_FINDINGS, COMPRESS_EVIDENCE, ATTACH_TO_AUDIT, ROUTE_RESULT) with retry mechanisms and blocked-state propagation.
- **Pyth Client**: Integrates with Hermes REST API for secondary price-confidence verification.
- **DefiLlama Client**: Hardened data ingestion with `NormalizedPriceResult`, `NormalizedHistoryResult`, stale thresholds, and fallback flags.
- **Agent Interpreter**: Processes chat commands for system interaction.
- **DB Schema**: `signals` table includes `data_quality` jsonb column and comprehensive trade-related data. `hermes_findings` table stores audit findings.

**Feature Specifications:**
- **Rejection Codes**: Granular codes for various audit failures (e.g., `NO_REGIME`, `ENTRY_TOO_LATE`, `RR_BELOW_THRESHOLD`).
- **Pre-trade Checklist**: Automated checklist generation for each signal, covering thesis, regime, entry, invalidation, target, reason codes.
- **Snapshot Integrity**: Audit endpoint (`GET /api/audit/:asset`) uses latest stored signal's audit report (ordered by `computedAt DESC`), never recomputes independently. Returns 404 if no stored signal exists.
- **API Routes**: Comprehensive API for signals, market data, audit reports, watchlist, alerts, agent chat, integrations, and Hermes operations (status, constraints, scan, jobs, metrics, findings, evaluation). Signal list endpoint includes `dataQuality` in response. Signal feed includes `logicAdmissibility` and gate-aware summary text.

# External Dependencies

- **API Framework**: Express 5
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API Codegen**: Orval
- **Build Tool**: esbuild
- **Data Providers**:
    - DefiLlama Coins API (for real-time prices and historical data)
    - Pyth Hermes REST API (for secondary price confidence verification)
- **Messaging/Alerting (Scaffolded Integrations - configurable via env vars and UI toggle)**:
    - XMTP (wallet-to-wallet delivery)
    - Telegram (bot delivery)
    - Discord (webhook embeds)
- **Research/Enrichment (Scaffolded Integrations - configurable via env vars and UI toggle)**:
    - Browserbase (triggered web research)
    - MPP (institutional flow enrichment)