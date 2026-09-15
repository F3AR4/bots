# Strategy Requirements: Polymarket Copy-Trading System

## 1. Executive Summary

This document specifies the strategy requirements extracted from the source PDF specification for the Polymarket copy-trading research and paper-trading bot. The system is designed as an evidence-driven, explainable copy-trading pipeline that systematically discovers, filters, scores, simulates, and evaluates trades executed by top Polymarket wallets while operating under strict paper-trading safety constraints.

---

## 2. Wallet Discovery Requirements

### 2.1 Leaderboard Ingestion
- **[EXPLICIT]** The system must ingest the top 500 wallets from Polymarket or Bullpen leaderboards.
- **[EXPLICIT]** Lookback period for historical analysis must span approximately the last 30 days.
- **[EXPLICIT]** Wallets must be ranked globally and by category.
- **[IMPLIED]** Ingestion pipeline must support pagination, backoff on rate limits, and graceful failure without crashing or faking data.
- **[NOT SPECIFIED]** Leaderboard update frequency (e.g., hourly vs daily). *Default: Configurable, scheduled periodic task.*

### 2.2 Initial Filtering
- **[EXPLICIT]** Wallets or markets that are too illiquid to copy must be skipped.
- **[IMPLIED]** Wallets whose trading history is dominated by zero-volume, zero-bid/ask books are disqualified.
- **[NOT SPECIFIED]** Minimum average order book depth / liquidity dollar threshold required for discovery. *Configurable: `minDiscoveryLiquidityUsd` (TBD).*

---

## 3. Wallet Quality & Scoring Requirements

### 3.1 Required Scoring Dimensions
Every evaluated wallet profile must compute and persist scores for:
1. **ROI (30 days)**: Normalized return over investment across the 30-day window.
2. **Consistency Score**: Frequency and stability of returns across multiple independent events.
3. **Copyability Score**: Practical feasibility of replicating the wallet's past entries.
4. **Category Edge / Strengths**: Breakdown of performance across market categories (e.g., Politics, Pop Culture, Crypto, Sports).
5. **Liquidity Quality**: Average liquidity available in markets traded by the wallet.
6. **Entry Timing**: Degree to which the wallet enters before price moves vs chasing momentum.
7. **Trade Frequency**: Total trade count over 30 days.
8. **Resolved Trade Performance**: Win rate and realized PnL across markets that have resolved.
9. **One-Hit-Wonder Penalty**: Negative penalty applied for concentrated or non-replicable edge.

### 3.2 One-Hit-Wonder Penalty Triggers
The penalty engine must evaluate and flag:
- **[EXPLICIT]** Single-trade profit concentration (e.g., >80% of total 30-day PnL from one trade).
- **[EXPLICIT]** Trades concentrated in illiquid markets.
- **[EXPLICIT]** Price moving too far after entry (slippage/market impact makes copying impossible).
- **[EXPLICIT]** Apparent historical edge existing only in one old, resolved market.
- **[EXPLICIT]** Insufficient resolved trades to establish statistical significance.
- **[EXPLICIT]** Historical spreads on trades being too wide.
- **[EXPLICIT]** Structural inability of a retail follower to realistically replicate entries.
- **[IMPLIED]** The penalty must be a transparent, modular, inspectable breakdown rather than a black-box scalar deduction.

### 3.3 Wallet Categorization & States
- **[EXPLICIT]** Statuses:
  - `TRACK`: Active high-quality wallets whose real-time trades are monitored for copy trading.
  - `WATCH`: Interesting wallets requiring more history, better liquidity, or category validation.
  - `IGNORE`: Disqualified wallets (e.g., penalized, illiquid, uncopyable).
- **[EXPLICIT]** Every status assignment must include an explicit, human-readable reason (`reason for status`).
- **[NOT SPECIFIED]** Strict numeric cutoffs for state transitions. *Configurable in `RuleSet`.*

---

## 4. Copyability Requirements

- **[EXPLICIT]** Profitability does NOT equal copyability. High-ROI wallets must be rejected if uncopyable.
- **[EXPLICIT]** Evaluated factors:
  - **Latency / Entry Timing**: Time delta between wallet on-chain transaction and bot detection.
  - **Liquidity at Current Price**: Depth of top-of-book and allowable slippage.
  - **Spread**: Bid-ask spread percentage at current market state.
  - **Post-Entry Price Movement**: How much the market price moved between the wallet's fill and detection.
  - **Trade Size vs Market Capacity**: Whether replicating size impacts market equilibrium.
- **[IMPLIED]** If price has drifted past a maximum tolerance threshold before detection, copyability drops to zero.
- **[NOT SPECIFIED]** Exact max drift tolerance (e.g., 2 cents, 5%). *Configurable: `maxAllowedPriceDrift`.*

---

## 5. Trade Detection & Trade Scoring Requirements

### 5.1 Trade Ingestion
- **[EXPLICIT]** Monitor tracked wallets in real-time or near real-time.
- **[EXPLICIT]** Captured fields: `walletAddress`, `marketId`, `conditionId`, `marketQuestion`, `marketCategory`, `outcome`, `side`, `walletEntryPrice`, `detectedPrice`, `size`, `timestamp`, `rawTradeJson`.
- **[IMPLIED]** System must deduplicate on-chain transaction hashes or fill IDs to prevent re-scoring duplicate signals.

### 5.2 Trade Scoring Engine
Score each detected trade across:
- `walletQualityScore` (from `WalletProfile.globalScore`)
- `categoryFitScore` (wallet's historical edge in this specific category)
- `priceMovementScore` (`detectedPrice` vs `walletEntryPrice`)
- `spreadScore` (penalizing wide bid-ask spreads)
- `liquidityScore` (rewarding deep, liquid books)
- `entryTimingScore` (recency of trade execution)
- `timeToResolutionScore` (market expiry feasibility)
- `thesisScore` (clarity/coherence of the trade setup)

### 5.3 Tri-State Decision Output
- **[EXPLICIT]** Decisions:
  1. `paper_copy`: Meets all active threshold criteria; triggers a simulated paper trade.
  2. `watchlist`: Fails one or more strict filters but shows potential; monitored for benchmark analysis.
  3. `skip`: Disqualified due to latency, illiquidity, wide spread, weak wallet, or category mismatch.
- **[EXPLICIT]** Persist full score breakdown, reasons list, and risks list to `DecisionJournal`.

---

## 6. Paper Trading Execution Requirements

- **[EXPLICIT]** Safety: 100% paper trading. No private keys, no signing, no fund disbursement.
- **[EXPLICIT]** Position Sizing: Simulated size between **\$5 and \$20** per position.
- **[EXPLICIT]** Higher confidence trades receive larger simulated allocations within the \$5–\$20 window.
- **[EXPLICIT]** Position Tracking:
  - Track `entryPrice`, `currentPrice`, `simulatedPositionSize`, `unrealizedPnl`, `realizedPnl`, and status (`open`, `closed`, `resolved`).
- **[EXPLICIT]** PnL Updates: Re-mark open paper positions against live market prices every hour.
- **[EXPLICIT]** Exit Logic: Close or mark resolved when the market settles, or if active strategy exit rules trigger.
- **[NOT SPECIFIED]** Continuous function mapping `confidence` $\in [0, 1]$ to $[5, 20]$ dollars. *Formula: Linear interpolation $5 + 15 \times \text{confidence}$ (configurable).*

---

## 7. Outcome Review & Benchmark Requirements

### 7.1 Retrospective Outcome Review
- **[EXPLICIT]** Track market prices at fixed post-trade milestones:
  - $T + 1$ hour (`priceAfter1h`)
  - $T + 6$ hours (`priceAfter6h`)
  - $T + 24$ hours (`priceAfter24h`)
  - Market resolution (`finalOutcome`, `simulatedPnl`)
- **[EXPLICIT]** Retrospective evaluation: `wasDecisionGood` (boolean/score) and `lessonsJson`.
- **[EXPLICIT]** Zero lookahead bias: Decision journal records must remain immutable and untouched by outcome reviews.

### 7.2 Strategy Benchmarking
- **[EXPLICIT]** Simultaneously track four performance cohorts:
  1. **Filtered Paper Trades** (`paper_copy`)
  2. **Blind Leaderboard Copy** (hypothetical execution on all trades from top 500 wallets)
  3. **Watchlist Cohort**
  4. **Skipped Cohort**
- **[EXPLICIT]** Compute:
  - Missed winners (trades skipped/watched that resulted in gains)
  - Avoided losers (trades skipped/watched that resulted in losses)
  - Bad copies (trades copied that incurred losses)
  - Good skips (filtered trades that prevented capital loss)
  - Late entries avoided
  - Spread losses avoided

---

## 8. Self-Improvement & Rule Adaptation Requirements

- **[EXPLICIT]** Automated updating of paper-trading rules based on empirical outcome reviews.
- **[EXPLICIT]** Operates autonomously within the paper environment without requiring manual human approval.
- **[EXPLICIT]** Every adaptation must produce an immutable `RuleChange` entry recording:
  - `oldRuleSetId`, `newRuleSetId`
  - `changedBy` (Operator agent identifier)
  - `reason`
  - `evidenceSummary` (e.g., empirical win-rate or spread loss data)
  - `beforeJson`, `afterJson`
  - `expectedImprovement`
  - `timestamp`
- **[EXPLICIT]** Permitted adaptation categories from PDF:
  - Lower maximum spread threshold if spread losses exceed target.
  - Raise minimum liquidity if slippage in low-liquidity markets harms paper returns.
  - Downgrade wallets with deteriorating paper performance.
  - Specialize wallets into category-specific filters.
  - Tighten allowed price movement for late-detected signals.
  - Re-weight consistency vs raw ROI.
- **[NOT SPECIFIED]** Frequency of autonomous rule reviews (e.g., nightly vs weekly). *Default: Executed during daily EOD reporting cycle.*
