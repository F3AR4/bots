# PDF Logic Specification: Polymarket Copy-Trading System

> **Classification Standard**: Every item is strictly audited and categorized as **[EXPLICIT]**, **[IMPLIED]**, or **[NOT SPECIFIED]** per the strategy source-of-truth PDF. No numerical weights, formulas, or thresholds are invented.

---

## 1. Safety & Operational Constraints

- **[EXPLICIT]** Paper trading only in version one; real trades are strictly prohibited.
- **[EXPLICIT]** No private keys requested, stored, or managed.
- **[EXPLICIT]** No transaction signing or fund spending.
- **[EXPLICIT]** No live execution by default.
- **[EXPLICIT]** The long-term goal is eventual autonomy, but strictly after paper trading proves a verifiable edge.
- **[EXPLICIT]** If any external API fails, the system must show the real error and halt cleanly; it must never fabricate live data or replace missing data with simulated "live" feeds.
- **[EXPLICIT]** Demo or seed data is permitted only when explicitly tagged and displayed as demo data.
- **[EXPLICIT]** Environment variables must be used for optional API credentials; secrets must be redacted from logs and user interfaces.
- **[EXPLICIT]** No paid external services are required for version one.

---

## 2. Leaderboard & Wallet Discovery

- **[EXPLICIT]** Source: Pull Polymarket or Bullpen leaderboard.
- **[EXPLICIT]** Scope: Scan top 500 wallets.
- **[EXPLICIT]** Lookback: Analyze approximately the last 30 days of wallet activity.
- **[EXPLICIT]** Ranking dimensions: Rank wallets both globally and by category.
- **[EXPLICIT]** Filtering: Skip wallets or markets that are too illiquid to copy.
- **[EXPLICIT]** Selection: Track selected wallets for ongoing trade monitoring.
- **[IMPLIED]** An ingestion adapter boundary is required to decouple strategy logic from specific Polymarket / Bullpen REST or GraphQL endpoints.
- **[NOT SPECIFIED]** Exact endpoint URLs, pagination parameters, rate limits, and authentication for leaderboard fetching.
- **[NOT SPECIFIED]** Numerical threshold defining when a wallet is "too illiquid" at the discovery phase (TBD / Configurable).

---

## 3. Wallet Quality & Scoring Dimensions

The PDF specifies that each wallet must be scored across the following dimensions:

1. **ROI (30-day)** **[EXPLICIT]**
2. **Consistency** **[EXPLICIT]**
3. **Copyability** **[EXPLICIT]**
4. **Category Edge / Strengths** **[EXPLICIT]**
5. **Liquidity Quality** **[EXPLICIT]**
6. **Entry Timing** **[EXPLICIT]**
7. **Trade Frequency / Count** **[EXPLICIT]**
8. **Resolved Trade Performance / Win Rate** **[EXPLICIT]**
9. **One-Hit-Wonder Penalty** **[EXPLICIT]**

### One-Hit-Wonder Penalty Triggers
The PDF explicitly dictates that a wallet must be penalized if:
- **[EXPLICIT]** Most profit came from one lucky trade.
- **[EXPLICIT]** Trades are too illiquid.
- **[EXPLICIT]** Price moves too far after entry.
- **[EXPLICIT]** Apparent edge exists only in one old market.
- **[EXPLICIT]** There are not enough resolved trades.
- **[EXPLICIT]** Spread is usually too wide.
- **[EXPLICIT]** The system cannot realistically follow entries.

### Wallet States
- **[EXPLICIT]** `TRACK`, `WATCH`, `IGNORE`.
- **[EXPLICIT]** Reason for status must be recorded for every wallet.
- **[IMPLIED]** Wallet state transitions must be logged with timestamp and trigger reasoning.
- **[NOT SPECIFIED]** Exact mathematical weighting combining ROI, consistency, copyability, and penalty into `globalScore` (TBD / Configurable).
- **[NOT SPECIFIED]** Numerical threshold of resolved trade count required before a wallet qualifies for `TRACK` (TBD / Configurable).
- **[NOT SPECIFIED]** Percentage of PnL originating from a single trade that triggers the "one lucky trade" penalty (TBD / Configurable).

---

## 4. Copyability Concept

- **[EXPLICIT]** Copyability is a distinct first-class dimension separate from profitability.
- **[EXPLICIT]** A wallet may have high ROI but still be disqualified (`WATCH` or `IGNORE`) if its trades cannot realistically be replicated.
- **[EXPLICIT]** Copyability factors include:
  - Entry timing (is the entry timely or front-run/lagging?)
  - Liquidity available at wallet entry vs now
  - Bid-ask spread
  - Price movement after wallet entry
  - Average trade size
  - Market condition feasibility
- **[IMPLIED]** Copyability score must output a normalized metric alongside explanatory notes (`copyabilityNotes`).
- **[NOT SPECIFIED]** Max slippage tolerance or exact formulas calculating copyability score (TBD / Configurable).

---

## 5. Trade Detection & Trade Scoring

### Trade Detection
- **[EXPLICIT]** The operational loop monitors tracked wallets and detects new trades.
- **[EXPLICIT]** Detected trade properties: `walletAddress`, `marketId`, `conditionId`, `marketQuestion`, `marketCategory`, `outcome`, `side`, `walletEntryPrice`, `detectedPrice`, `size`, `timestamp`, `rawTradeJson`.
- **[IMPLIED]** Detection polling or event streaming mechanism must differentiate `OBSERVED` timestamp vs `DETECTED` timestamp.

### Trade Scoring Inputs
The PDF explicitly specifies that each new wallet trade must be scored by:
- **[EXPLICIT]** Wallet global score
- **[EXPLICIT]** Wallet category score
- **[EXPLICIT]** Current market price
- **[EXPLICIT]** Wallet entry price
- **[EXPLICIT]** Price movement since wallet entry
- **[EXPLICIT]** Current spread
- **[EXPLICIT]** Current liquidity
- **[EXPLICIT]** Time to market resolution
- **[EXPLICIT]** Current active rule thresholds
- **[EXPLICIT]** Thesis clarity

### Decision Outcomes
- **[EXPLICIT]** `paper_copy`: Strong enough to simulate a copy trade.
- **[EXPLICIT]** `watchlist`: Interesting but not clean enough.
- **[EXPLICIT]** `skip`: Too late, too illiquid, weak wallet, bad category fit, or poor setup.
- **[EXPLICIT]** Every decision must store: `copyScore`, `confidence`, `reasonsJson`, `risksJson`, component score breakdowns, and `ruleVersion`.
- **[NOT SPECIFIED]** Mathematical weights for each trade-scoring factor (TBD / Configurable).
- **[NOT SPECIFIED]** Exact cutoff score separating `paper_copy` from `watchlist` and `skip` (TBD / Configurable).
- **[NOT SPECIFIED]** Mathematical formula for `thesisScore` (must be modular/configurable, or qualitative input).

---

## 6. Paper Trading Execution & Position Lifecycle

- **[EXPLICIT]** For every `paper_copy` decision, create a `PaperTrade`.
- **[EXPLICIT]** Simulated bet size must be between **\$5 and \$20**.
- **[EXPLICIT]** Higher confidence can use a larger simulated size within this range.
- **[EXPLICIT]** Paper position fields: `entryPrice`, `currentPrice`, `simulatedPositionSize`, `unrealizedPnl`, `realizedPnl`, `status` (`open`, `closed`, `resolved`), `openedAt`, `closedAt`, `resolvedAt`.
- **[EXPLICIT]** Paper PnL must be updated every hour (`PnlSnapshot`).
- **[EXPLICIT]** Close or resolve paper trades when:
  - The market resolves, OR
  - Active paper-trading rules state the trade should be exited.
- **[NOT SPECIFIED]** Continuous position sizing curve between \$5 and \$20 based on confidence (TBD / Configurable).
- **[NOT SPECIFIED]** Specific intermediate exit rules prior to resolution, e.g., stop-loss, take-profit, or trailing stops (TBD / Configurable in `RuleSet`).

---

## 7. Outcome Review & Retrospective Analysis

- **[EXPLICIT]** Review trades after maturity:
  - Price after 1 hour (`priceAfter1h`)
  - Price after 6 hours (`priceAfter6h`)
  - Price after 24 hours (`priceAfter24h`)
  - Final outcome (`finalOutcome`)
  - Simulated PnL (`simulatedPnl`)
  - Judgment: whether the decision was good or bad (`wasDecisionGood`)
  - Structured lessons learned (`lessonsJson`)
- **[EXPLICIT]** Outcome review must be strictly separated from original trade decision (preventing lookahead bias or retrospective data contamination).
- **[IMPLIED]** Automated scheduler must queue reviews at T+1h, T+6h, T+24h, and post-resolution.

---

## 8. Benchmark Comparison Engine

The PDF explicitly requires tracking and comparing four distinct streams:
1. **[EXPLICIT]** **Bot-filtered paper trades** (`paper_copy`)
2. **[EXPLICIT]** **Blind copying of leaderboard wallets** (copying all trades without filter)
3. **[EXPLICIT]** **Watchlist trades** (trades that were flagged interesting but uncopied)
4. **[EXPLICIT]** **Skipped trades** (trades rejected by filters)

### Benchmark Metrics
- **[EXPLICIT]** Missed winners (trades skipped/watched that became profitable)
- **[EXPLICIT]** Avoided losers (trades skipped/watched that lost money)
- **[EXPLICIT]** Bad copies (paper trades copied that lost money)
- **[EXPLICIT]** Good skips (skipped trades that would have lost)
- **[EXPLICIT]** Late entries avoided
- **[EXPLICIT]** Spread losses avoided

---

## 9. Self-Improvement & Automatic Rule Adaptation

- **[EXPLICIT]** System automatically updates paper-trading rules based on observed performance.
- **[EXPLICIT]** System does **not** ask for human approval before changing paper-trading rules.
- **[EXPLICIT]** Every rule change must be logged, explained, and versioned.
- **[EXPLICIT]** Stored fields per rule change:
  - `oldRuleSetId`
  - `newRuleSetId`
  - `changedBy` (e.g., `operator_agent` / `system`)
  - `reason`
  - `evidenceSummary`
  - `beforeJson`
  - `afterJson`
  - `expectedImprovement`
  - `timestamp`
  - `newRuleVersion`
- **[EXPLICIT]** Rule adaptation examples cited in PDF:
  - Lower max spread threshold if spread-heavy trades underperform.
  - Raise minimum liquidity if low-liquidity trades perform poorly.
  - Downgrade wallets with poor recent paper performance.
  - Mark wallets as category-specific.
  - Reduce allowed price movement if late entries lose.
  - Increase consistency weighting if high-ROI wallets are too volatile.
- **[IMPLIED]** Rule sets must be immutable entities; updates create a new `RuleSet` row linked via `RuleChange`.
- **[NOT SPECIFIED]** Quantitative triggering algorithms that initiate each adaptation (TBD / Configurable engine).

---

## 10. Reporting & Alerts

- **[EXPLICIT]** Daily Report contents:
  - `paperPnl` today
  - `totalPaperPnl`
  - `winRate`
  - `bestPaperTrade`
  - `worstPaperTrade`
  - `bestWalletToday`
  - `worstWalletToday`
  - `ruleChangesMade`
  - `topLessonLearned`
  - Whether bot-filtered strategy beat blind copy today
  - What to watch tomorrow
  - `sentToTelegram` flag
- **[EXPLICIT]** Telegram alerts must remain minimal (avoiding alert storms).
- **[EXPLICIT]** Alert triggers:
  1. Minimum 1 end-of-day report per day
  2. Very high-confidence paper trade
  3. Major rule change
  4. Significant wallet upgrade or downgrade
  5. Performance drawdown warning
- **[NOT SPECIFIED]** Telegram bot token / chat ID structure (Configured via env vars).
- **[NOT SPECIFIED]** Numerical threshold for "performance drawdown warning" (TBD / Configurable).

---

## 11. User Interface & Operator Architecture

- **[EXPLICIT]** 9 required UI areas:
  1. Overview
  2. Wallet Rankings
  3. Wallet Profile
  4. Trade Signals
  5. Paper Trades
  6. Decision Journal
  7. Performance
  8. Rules
  9. Reports
- **[EXPLICIT]** Tech Stack: TypeScript, Next.js, React, Tailwind, SQLite locally, Prisma or Drizzle, Vercel-ready architecture.
- **[EXPLICIT]** CLI / Operator commands:
  - `npm run dev`
  - `npm run db:migrate`
  - `npm run seed`
  - `npm run scan:leaderboard`
  - `npm run scan:wallets`
  - `npm run monitor:trades`
  - `npm run score:trades`
  - `npm run paper:update-pnl`
  - `npm run review:outcomes`
  - `npm run update:rules`
  - `npm run report:daily`
  - `npm run test`
