# Implementation Plan: Polymarket Copy-Trading System

## 1. Plan Overview & Execution Principles

This implementation plan outlines the sequential phases to construct the self-improving Polymarket copy-trading system. Each phase defines concrete milestones, verification criteria, and strict safety guardrails.

**Key Invariant**: Version one is **paper-trading only**. No real execution, no private keys, and no autonomous live promotion.

---

## 2. Phased Roadmap

### Phase 0: PDF Extraction & Formal Strategy Specification (Completed in Task 0)
- **Objective**: Exhaustively extract the strategy logic from the PDF source of truth, classifying all parameters as [EXPLICIT], [IMPLIED], or [NOT SPECIFIED].
- **Deliverables**:
  - `PDF_LOGIC_SPEC.md`
  - `STRATEGY_REQUIREMENTS.md`
  - `DATA_REQUIREMENTS.md`
  - `DECISION_MODEL.md`
  - `LEARNING_BOUNDARY.md`
  - `PROJECT_ARCHITECTURE.md`
  - `INITIAL_DATABASE_MODEL.md`
  - `IMPLEMENTATION_PLAN.md`

### Phase 1: Project Architecture & Database Foundation
- **Objective**: Initialize the Next.js/TypeScript workspace and configure SQLite with Drizzle ORM.
- **Tasks**:
  - Initialize project with strict TypeScript settings (`tsconfig.json`).
  - Create database schema in `src/db/schema.ts` matching the 11 specified models.
  - Set up migrations and seeding script with labeled demo fixtures (`src/data/fixtures/`).
  - Establish CLI execution framework.
- **Exit Criteria**: `npm run db:migrate` and `npm run seed` execute successfully and verify relational constraints.

### Phase 2: Public Data Adapters Layer
- **Objective**: Build resilient adapters to communicate with Polymarket public endpoints without tight coupling.
- **Tasks**:
  - `LeaderboardAdapter`: Fetch top 500 leaderboard records (with backoff & error logging).
  - `MarketDepthAdapter`: Fetch order books, best bid/ask, and calculate spread/liquidity.
  - `TradeFeedAdapter`: Ingest recent public trade events for specified addresses.
  - `ResolutionAdapter`: Query market resolution statuses and final payout prices.
- **Exit Criteria**: Unit and mocked integration tests demonstrating transparent error states when APIs fail (no faked data).

### Phase 3: Leaderboard Scanner
- **Objective**: Implement the scanning pipeline for wallet discovery.
- **Tasks**:
  - Ingest top 500 wallets and persist records to `LeaderboardScan`.
  - Filter out fundamentally illiquid or inactive accounts.
  - Provide CLI runner: `npm run scan:leaderboard`.
- **Exit Criteria**: Correct population of `LeaderboardScan` table and raw JSON storage.

### Phase 4: Wallet Profiler & Scoring Engine
- **Objective**: Compute wallet scores, consistency, and one-hit-wonder penalties.
- **Tasks**:
  - Compute 30-day ROI, trade counts, win rate on resolved markets, and category breakdown.
  - Implement the **One-Hit-Wonder Penalty**:
    - Single-trade profit concentration check.
    - Illiquid market concentration check.
    - Post-entry slippage check.
    - Thin resolved trade count check.
  - Assign wallet status (`TRACK`, `WATCH`, `IGNORE`) with explicit explanatory notes.
  - Provide CLI runner: `npm run scan:wallets`.
- **Exit Criteria**: Deterministic scoring and penalty calculations tested against synthetic edge-case wallet histories.

### Phase 5: Trade Monitor
- **Objective**: Detect real-time trade events from `TRACK` status wallets.
- **Tasks**:
  - Ingest new trade occurrences, capturing execution price, size, and side.
  - Store unedited raw payloads in `ObservedTrade`.
  - Distinguish source timestamp from ingestion and detection timestamps.
  - Provide CLI runner: `npm run monitor:trades`.
- **Exit Criteria**: Deduplication of trades and verified zero-loss event persistence.

### Phase 6: Trade Scoring & Decision Journal
- **Objective**: Implement the explainable multi-factor trade evaluator.
- **Tasks**:
  - Evaluate observed trades using the active `RuleSet`.
  - Check entry timing, slippage drift, order book spread, and top-of-book liquidity.
  - Produce tri-state decision (`paper_copy`, `watchlist`, `skip`).
  - Commit complete reasoning, risks, sub-scores, and sizing to `DecisionJournal`.
  - Provide CLI runner: `npm run score:trades`.
- **Exit Criteria**: 100% deterministic decision replays given identical market and rule inputs.

### Phase 7: Paper Trading Engine
- **Objective**: Simulate trade execution for `paper_copy` events.
- **Tasks**:
  - Allocate simulated capital between \$5.00 and \$20.00 scaled by confidence.
  - Open new `PaperTrade` records linked to `DecisionJournal`.
  - Track open positions without touching real funds or private keys.
- **Exit Criteria**: Verified bounds enforcement ($5.00 $\le$ size $\le$ $20.00).

### Phase 8: Hourly PnL Tracker & Outcome Reviewer
- **Objective**: Track position lifecycles and evaluate historical accuracy.
- **Tasks**:
  - Hourly mark-to-market valuations written to `PnlSnapshot`.
  - Schedule retrospective milestone checks at T+1h, T+6h, T+24h, and resolution.
  - Record retrospective judgment (`wasDecisionGood`) and structured lessons.
  - Provide CLI runners: `npm run paper:update-pnl` and `npm run review:outcomes`.
- **Exit Criteria**: Hourly PnL series charted accurately without lookahead leakage.

### Phase 9: Benchmark Engine
- **Objective**: Quantify value-add versus naive baseline copying.
- **Tasks**:
  - Track simultaneous performance for:
    1. Filtered paper trades
    2. Blind copy of leaderboard wallets
    3. Watchlist trades
    4. Skipped trades
  - Calculate missed winners, avoided losers, bad copies, and good skips.
- **Exit Criteria**: Comparative cohort reports generated and validated.

### Phase 10: Autonomous Paper Rule Adaptation
- **Objective**: Implement closed-loop self-improvement within the paper environment.
- **Tasks**:
  - Analyze empirical outcome reviews for systemic patterns (e.g., spread drag, latency losses).
  - Propose and commit bounded rule adjustments to `RuleSet` and `RuleChange`.
  - Enforce immutable versioning and log detailed qualitative and quantitative evidence.
  - Provide CLI runner: `npm run update:rules`.
- **Exit Criteria**: Rules adapt autonomously in paper mode while strictly preserving invariant safety limits.

### Phase 11: Reporting & Alerts
- **Objective**: Deliver daily/weekly digests and minimal, non-spammy alerts.
- **Tasks**:
  - Aggregate day's PnL, win rate, best/worst trades, rule changes, and lessons learned into `DailyReport`.
  - Optional Telegram integration for critical alerts (EOD report, high-confidence signals, drawdown warning).
  - Provide CLI runner: `npm run report:daily`.
- **Exit Criteria**: Complete end-of-day markdown/HTML reports generated cleanly.

### Phase 12: Next.js Web Dashboard
- **Objective**: Deliver a clean, professional, responsive web interface.
- **Tasks**:
  - Build the 9 core views: Overview, Wallet Rankings, Wallet Profile, Trade Signals, Paper Trades, Decision Journal, Performance, Rules, Reports.
  - Ensure transparent exposure of reasoning, sub-scores, and rule histories.
  - Provide prominent labeling for demo/seed data modes.
  - Support local execution and Vercel deployment.
- **Exit Criteria**: Full navigation and inspection capabilities operating locally on port 3000.

### Phase 13: Android Observability Application
- **Objective**: Build a mobile client for real-time monitoring on Android.
- **Tasks**:
  - Implement read-only REST API endpoints (`/api/v1/mobile/...`).
  - Create Android UI (Jetpack Compose / React Native) displaying PnL, signals, and alerts.
  - Enforce zero-key, read-only constraints in the client bundle.
- **Exit Criteria**: Android application displaying real-time metrics connected to the local or cloud backend.

### Phase 14: Comprehensive Testing & Verification
- **Objective**: Validate end-to-end reliability, safety, and adversarial resilience.
- **Tasks**:
  - Execute automated test suite (`npm run test`).
  - Perform adversarial tests (stale data, API outages, duplicate events, extreme slippage).
  - Audit logs to confirm zero private key or secret leakage.
- **Exit Criteria**: All unit, integration, and security checks passing with zero errors.
