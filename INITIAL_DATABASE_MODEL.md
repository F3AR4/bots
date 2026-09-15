# Initial Database Model Specification

## 1. Schema Design Philosophy

The database schema directly maps the 11 core domain entities explicitly outlined in the source specification. It is implemented using SQLite (with Drizzle ORM / Prisma) to guarantee zero-overhead, portable local storage while remaining completely compatible with serverless cloud hosting (e.g., Turso / Cloudflare D1 / PostgreSQL for Vercel deployment).

Every table incorporates strict typing, index optimizations for time-series queries and address lookups, and clear relational integrity.

---

## 2. Table Definitions & Entity Relational Mapping

### 2.1 `LeaderboardScan`
Captures historical metadata from each leaderboard discovery execution.

```typescript
export interface LeaderboardScan {
  id: string; // UUID primary key
  source: string; // 'polymarket' | 'bullpen'
  scannedAt: Date; // Timestamp of scan execution
  walletCount: number; // Number of wallets scanned (e.g., 500)
  lookbackDays: number; // Historical window analyzed (e.g., 30)
  rawSummaryJson: string; // Serialized JSON of raw leaderboard response
  createdAt: Date;
}
```

### 2.2 `WalletProfile`
Maintains persistent qualitative, quantitative, and penalty state for top wallets.

```typescript
export interface WalletProfile {
  id: string; // UUID primary key
  address: string; // Ethereum wallet address (0x...), unique, indexed
  label: string | null; // Known pseudonym or public label
  sourceRank: number; // Rank on upstream leaderboard (1 to 500)
  status: 'track' | 'watch' | 'ignore'; // Operational state
  roi30d: number; // 30-day percentage or fraction return
  consistencyScore: number; // Win-rate / volatility consistency rating [0-100]
  copyabilityScore: number; // Practical replication rating [0-100]
  oneHitWonderPenalty: number; // Deductive penalty metric [0-100]
  globalScore: number; // Composite quality score [0-100]
  bestCategory: string; // e.g., 'Politics', 'Crypto', 'Pop Culture'
  categoryStrengthsJson: string; // Serialized JSON breakdown by category
  averageTradeSize: number; // Average position size in USD
  tradeCount30d: number; // Total trades executed in past 30 days
  resolvedTradeCount30d: number; // Number of resolved trades in past 30 days
  winRate30d: number; // Win rate on resolved trades (0.0 to 1.0)
  averageLiquidity: number; // Average available liquidity on entries (USD)
  averageSpread: number; // Average bid-ask spread encountered
  averageEntryTiming: number; // Mean latency / timing quality metric
  copyabilityNotes: string; // Qualitative notes explaining copyability status
  riskNotes: string; // Qualitative notes explaining identified risks
  lastScannedAt: Date; // Timestamp of latest profile evaluation
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 `ObservedTrade`
Stores every observed trade executed by monitored wallets prior to evaluation.

```typescript
export interface ObservedTrade {
  id: string; // UUID primary key
  walletAddress: string; // Foreign key / address reference
  marketId: string; // Polymarket condition or market identifier
  conditionId: string; // Condition identifier
  marketQuestion: string; // Natural language market title/question
  marketCategory: string; // Category classification
  outcome: string; // 'YES' | 'NO' | outcome token name
  side: 'BUY' | 'SELL'; // Trade direction
  walletEntryPrice: number; // Execution price attained by the wallet
  detectedPrice: number; // Best price available at bot detection moment
  size: number; // Trade size in tokens / shares
  timestamp: Date; // On-chain / exchange transaction timestamp
  rawTradeJson: string; // Complete unedited event payload for replays
  createdAt: Date; // Ingestion timestamp
}
```

### 2.4 `MarketSnapshot`
Captures point-in-time order book state and market health metrics when trades occur.

```typescript
export interface MarketSnapshot {
  id: string; // UUID primary key
  marketId: string; // Polymarket condition or market identifier
  conditionId: string; // Condition identifier
  question: string; // Market title/question
  category: string; // Category tag
  yesPrice: number; // Midpoint or last traded YES price
  noPrice: number; // Midpoint or last traded NO price
  bestBid: number; // Highest open bid price
  bestAsk: number; // Lowest open ask price
  spread: number; // Absolute or relative spread (bestAsk - bestBid)
  liquidity: number; // Available top-of-book depth in USD
  volume: number; // 24-hour turnover
  timeToResolution: number; // Estimated seconds until market expiry
  collectedAt: Date; // Collection timestamp
  rawMarketJson: string; // Verbatim market object from API
}
```

### 2.5 `DecisionJournal`
Immutable audit log recording every automated evaluation and its reasoning.

```typescript
export interface DecisionJournal {
  id: string; // UUID primary key
  observedTradeId: string; // Foreign key linking to ObservedTrade
  walletAddress: string; // Initiating wallet address
  marketId: string; // Associated market identifier
  decision: 'paper_copy' | 'watchlist' | 'skip'; // Tri-state verdict
  copyScore: number; // Composite rating [0-100]
  confidence: number | null; // Optional confidence metric [0-1]
  reasonsJson: string; // JSON array of positive contributing reasons
  risksJson: string; // JSON array of negative/risk items
  walletQualityScore: number; // Sub-score: wallet reputation
  roiScore: number; // Sub-score: wallet ROI
  consistencyScore: number; // Sub-score: consistency
  copyabilityScore: number; // Sub-score: trade copyability
  categoryFitScore: number; // Sub-score: category alignment
  entryTimingScore: number; // Sub-score: entry latency
  spreadScore: number; // Sub-score: spread tolerance
  liquidityScore: number; // Sub-score: depth sufficiency
  thesisScore: number; // Sub-score: setup coherence
  simulatedPositionSize: number; // $0 if skip/watchlist, $5-$20 if paper_copy
  ruleVersion: string; // Active RuleSet version string
  createdAt: Date; // Evaluation timestamp
}
```

### 2.6 `PaperTrade`
Represents an active or settled simulated position triggered by a `paper_copy` decision.

```typescript
export interface PaperTrade {
  id: string; // UUID primary key
  decisionJournalId: string; // Foreign key linking to DecisionJournal
  walletAddress: string; // Copied wallet
  marketId: string; // Target market
  outcome: string; // Position token side ('YES' | 'NO')
  side: 'BUY' | 'SELL';
  entryPrice: number; // Simulated execution entry price
  currentPrice: number; // Mark-to-market latest price
  simulatedPositionSize: number; // Capital allocated ($5.00 to $20.00)
  unrealizedPnl: number; // Floating profit/loss in USD
  realizedPnl: number; // Final realized profit/loss upon close/settlement
  status: 'open' | 'closed' | 'resolved'; // Position state
  openedAt: Date; // Timestamp when paper order simulated
  closedAt: Date | null; // Timestamp when position closed prior to settlement
  resolvedAt: Date | null; // Timestamp when market oracle resolved
}
```

### 2.7 `PnlSnapshot`
Periodic (hourly) mark-to-market valuations for active paper positions.

```typescript
export interface PnlSnapshot {
  id: string; // UUID primary key
  paperTradeId: string; // Foreign key linking to PaperTrade
  price: number; // Current mark price at snapshot interval
  pnl: number; // Cumulative unrealized PnL at snapshot interval
  collectedAt: Date; // Hourly snapshot timestamp
}
```

### 2.8 `OutcomeReview`
Retrospective performance analysis tracking trade evolution at T+1h, T+6h, T+24h, and resolution.

```typescript
export interface OutcomeReview {
  id: string; // UUID primary key
  decisionJournalId: string; // Foreign key linking to DecisionJournal
  paperTradeId: string | null; // Linked PaperTrade (null for skip/watchlist)
  reviewTime: Date; // Timestamp of review execution
  priceAfter1h: number | null; // Market price 1 hour post-decision
  priceAfter6h: number | null; // Market price 6 hours post-decision
  priceAfter24h: number | null; // Market price 24 hours post-decision
  finalOutcome: string | null; // Winning outcome token ('YES', 'NO', etc.)
  simulatedPnl: number; // Actual or hypothetical PnL achieved
  wasDecisionGood: boolean; // Retrospective binary verdict
  lessonsJson: string; // Structured JSON of takeaways & empirical findings
  createdAt: Date;
}
```

### 2.9 `RuleSet`
Immutable versioned specification of scoring weights, thresholds, and filters.

```typescript
export interface RuleSet {
  id: string; // UUID primary key
  version: string; // Unique semantic version string (e.g., 'v1.0.0')
  active: boolean; // Whether this is currently the live evaluation ruleset
  rulesJson: string; // Verbatim JSON configuration of weights & thresholds
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.10 `RuleChange`
Audit log tracking the autonomous evolution of paper rules.

```typescript
export interface RuleChange {
  id: string; // UUID primary key
  oldRuleSetId: string; // Foreign key to preceding RuleSet
  newRuleSetId: string; // Foreign key to updated RuleSet
  changedBy: string; // Identifier: 'operator_agent' | 'system'
  reason: string; // Qualitative explanation of rule modification
  evidenceSummary: string; // Statistical data supporting the modification
  beforeJson: string; // Serialized pre-modification parameter state
  afterJson: string; // Serialized post-modification parameter state
  expectedImprovement: string; // Anticipated performance impact
  createdAt: Date; // Modification timestamp
}
```

### 2.11 `DailyReport`
Daily aggregation digest for performance metrics, benchmarks, and alerts.

```typescript
export interface DailyReport {
  id: string; // UUID primary key
  date: string; // YYYY-MM-DD
  paperPnl: number; // Today's net realized + unrealized PnL
  winRate: number; // Win rate on resolved paper trades today
  openPositions: number; // Count of open paper positions
  newSignals: number; // Total signals observed today
  copiedSignals: number; // Signals yielding paper_copy
  watchedSignals: number; // Signals yielding watchlist
  skippedSignals: number; // Signals yielding skip
  bestWalletsJson: string; // JSON of top-performing copied wallets
  worstWalletsJson: string; // JSON of bottom-performing wallets
  ruleChangesJson: string; // JSON list of any rule changes today
  summary: string; // Natural language executive summary
  sentToTelegram: boolean; // Dispatch confirmation flag
  createdAt: Date;
}
```

---

## 3. Database Indexes

- `WalletProfile(address)` - Unique
- `WalletProfile(status, globalScore DESC)` - Fast leaderboard queries
- `ObservedTrade(walletAddress, timestamp DESC)` - Rapid wallet trade timeline
- `ObservedTrade(marketId)` - Aggregation by market
- `DecisionJournal(decision, createdAt DESC)` - Streamlined journal filtering
- `PaperTrade(status, openedAt DESC)` - Active portfolio tracking
- `PnlSnapshot(paperTradeId, collectedAt DESC)` - Timeseries PnL charting
- `OutcomeReview(decisionJournalId)` - Retrospective lookups
- `RuleSet(version)` - Unique version constraint
- `DailyReport(date)` - Unique daily report constraint
