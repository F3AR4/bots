/**
 * Core Domain Entities & Type Definitions for Polymarket Copy-Trading Research & Paper System.
 * 
 * Safety Guarantee: ExecutionMode is PAPER ONLY in Version 1.
 * Distinguishes source time from ingestion, processing, and availability time.
 */

export type ExecutionMode = 'PAPER' | 'SHADOW' | 'FUTURE_PRODUCTION';

export type WalletStatus = 'track' | 'watch' | 'ignore';

export type TradeDecisionType = 'paper_copy' | 'watchlist' | 'skip';

export type PaperTradeStatus = 'open' | 'closed' | 'resolved';

export type RuleSetStatus = 'active' | 'retired' | 'candidate' | 'rejected' | 'superseded';

export type BenchmarkCohort = 'paper_copy' | 'blind_leaderboard' | 'watchlist' | 'skipped';

export interface ProvenanceMetadata {
  provider: string;              // e.g. 'polymarket_public', 'fixture_source'
  sourceIdentifier: string;      // e.g. tx hash, fill id, external scan id
  sourceTime: string;            // ISO timestamp from upstream
  ingestionTime: string;         // ISO timestamp when received
  processingTime?: string;       // ISO timestamp when evaluated
  availabilityTime?: string;     // ISO timestamp when visible to decisions
  normalizationVersion: string;  // Normalization schema version (e.g. 'v1.0.0')
  isDemo?: boolean;              // True if synthetic/fixture data
}

export interface LeaderboardScan {
  id: string;                    // UUID
  source: string;                // 'polymarket' | 'bullpen'
  scannedAt: string;             // ISO-8601
  walletCount: number;           // Top N scanned (e.g. 500)
  lookbackDays: number;          // Historical lookback window (e.g. 30)
  rawSummaryJson: string;        // Verbatim serialized response
  provenance: ProvenanceMetadata;
  createdAt: string;
}

export type IngestionOperationType = 'leaderboard' | 'wallet_activity' | 'market_data' | 'resolution';
export type IngestionStatus = 'requested' | 'running' | 'completed' | 'completed_with_warnings' | 'failed' | 'partial';

export interface IngestionOperation {
  id: string;
  operationType: IngestionOperationType;
  targetIdentifier: string | null;
  status: IngestionStatus;
  isLive: boolean;
  provider: string;
  endpoint: string | null;
  requestedWindowDays: number | null;
  actualStartTimestamp: string | null;
  actualEndTimestamp: string | null;
  recordsRequested: number;
  recordsReceived: number;
  recordsAccepted: number;
  recordsRejected: number;
  duplicatesCount: number;
  errorsCount: number;
  diagnosticsJson: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface RoiProvenance {
  type: 'provider_reported' | 'derived_normalized' | 'unavailable';
  value: number | null;
  pnlUsd: number | null;
  totalCostBasisUsd: number | null;
  denominatorDescription: string;
  sourceNotes: string;
}

export interface DataCompletenessReport {
  totalTradesObserved: number;
  resolvedTradesCount: number;
  unresolvedTradesCount: number;
  resolvedCoverage: number;       // Ratio of resolved / total
  marketSnapshotCoverage: number; // Ratio of trades with associated market snapshots
  timestampCoverage: number;      // Ratio of trades with valid upstream source timestamps
  categoryCoverage: number;       // Ratio of trades with verified market category
  liquidityCoverage: number;      // Ratio of trades with verified order book liquidity
  priceCoverage: number;          // Ratio of trades with valid entry prices
  overallEvidenceScore: number;   // [0-100] evidence density (distinct from trading score)
  evidenceTier: 'HIGH_EVIDENCE' | 'MODERATE_EVIDENCE' | 'LOW_EVIDENCE' | 'INSUFFICIENT_EVIDENCE';
}

export interface OneHitWonderDiagnostics {
  largestSingleWinUsd: number;
  totalPnlUsd: number;
  largestWinProfitRatio: number;  // largestSingleWinUsd / totalPnlUsd
  dominantMarketId: string | null;
  dominantMarketPnlRatio: number;
  dominantTradeAgeDays: number | null;
  isConcentratedInSingleTrade: boolean;
  isSingleMarketEdgeOnly: boolean;
  hasInsufficientResolvedTrades: boolean;
  notes: string;
}

export interface WalletFrequencyMetrics {
  tradesPerDay: number;
  activeDaysCount: number;
  activeMarketsCount: number;
  averageIntervalHours: number;
  medianIntervalHours: number;
  burstinessRatio: number;        // Peak day trades vs average
}

export interface WalletCopyabilityFactors {
  averageSpread: number;
  averageLiquidityUsd: number;
  averagePostEntryDrift: number;  // Price change after wallet entry
  adverseDriftCount: number;      // Entries moving unfavorably before detection
  unfollowablePriceCount: number; // Entries at extreme probabilities (<0.05 or >0.95)
  averageObservationDelayMs: number;
  copyabilityNormalized: number;  // [0-100]
  notes: string;
}

export interface WalletResearchEvaluation {
  id: string;                    // UUID
  walletAddress: string;
  ruleSetId: string;
  ruleVersion: string;
  analysisWindowDays: number;
  windowStartTimestamp: string | null;
  windowEndTimestamp: string | null;
  globalRank: number;
  categoryRank: number;
  bestCategory: string;
  status: WalletStatus;
  statusReasons: string[];
  finalScore: number;
  rawCompositeScore: number;
  totalPenaltyDeduction: number;
  roiProvenance: RoiProvenance;
  dataCompleteness: DataCompletenessReport;
  oneHitWonderDiagnostics: OneHitWonderDiagnostics;
  frequencyMetrics: WalletFrequencyMetrics;
  copyabilityFactors: WalletCopyabilityFactors;
  evaluatedAt: string;
  createdAt: string;
}

export interface WalletProfile {
  id: string;                    // UUID
  address: string;               // 0x... hex address
  label: string | null;          // Pseudonym or tag
  sourceRank: number;            // Upstream leaderboard rank (1-500)
  status: WalletStatus;          // 'track' | 'watch' | 'ignore'
  statusReason: string;          // Explicit human-readable reason for classification
  roi30d: number;                // 30-day return fraction / percentage
  consistencyScore: number;      // Consistency score [0-100]
  copyabilityScore: number;      // Practical replication score [0-100]
  oneHitWonderPenalty: number;   // Computed penalty deduction [0-100]
  globalScore: number;           // Composite wallet score [0-100]
  bestCategory: string;          // Category with highest edge (e.g., 'Politics', 'Crypto')
  categoryStrengthsJson: string; // JSON: Record<string, { winRate: number; tradeCount: number; roi: number }>
  averageTradeSize: number;      // Average trade size in USD
  tradeCount30d: number;         // Total trades in 30 days
  resolvedTradeCount30d: number; // Resolved trades in 30 days
  winRate30d: number;            // Win rate on resolved trades (0.0 to 1.0)
  averageLiquidity: number;      // Average liquidity at entry in USD
  averageSpread: number;         // Average bid-ask spread
  averageEntryTiming: number;    // Latency / entry timing quality score [0-100]
  copyabilityNotes: string;      // Qualitative assessment
  riskNotes: string;             // Identified risks
  ruleSetId: string;             // RuleSet version used to evaluate this profile
  lastScannedAt: string;         // ISO-8601
  provenance: ProvenanceMetadata;
  roiProvenance?: RoiProvenance;
  dataCompleteness?: DataCompletenessReport;
  oneHitWonderDiagnostics?: OneHitWonderDiagnostics;
  frequencyMetrics?: WalletFrequencyMetrics;
  copyabilityFactors?: WalletCopyabilityFactors;
  createdAt: string;
  updatedAt: string;
}

export interface ObservedTrade {
  id: string;                    // UUID
  walletAddress: string;         // Copied / observed wallet
  marketId: string;              // Polymarket market slug or condition ID
  conditionId: string;           // Token condition ID
  marketQuestion: string;        // Question title
  marketCategory: string;        // e.g. 'Politics', 'Pop Culture', 'Crypto'
  outcome: string;               // 'YES' | 'NO' | outcome token ID
  side: 'BUY' | 'SELL';          // Trade side
  walletEntryPrice: number;      // Wallet's execution price
  detectedPrice: number;         // Market price at detection moment
  size: number;                  // Shares or dollar size
  sourceTxHash?: string;         // On-chain transaction hash or fill ID for deduplication
  sourceTimestamp: string;       // Timestamp assigned by upstream chain/exchange
  rawTradeJson: string;          // Unaltered event payload for replay
  provenance: ProvenanceMetadata;
  createdAt: string;
}

export interface MarketSnapshot {
  id: string;                    // UUID
  marketId: string;              // Polymarket market ID
  conditionId: string;           // Condition ID
  question: string;              // Market question
  category: string;              // Category
  yesPrice: number;              // Current YES mid / last traded price
  noPrice: number;               // Current NO mid / last traded price
  bestBid: number;               // Best open bid price
  bestAsk: number;               // Best open ask price
  spread: number;                // bestAsk - bestBid
  liquidity: number;             // Top-of-book depth in USD
  volume: number;                // 24h trading volume
  timeToResolution: number;      // Estimated seconds until resolution
  collectedAt: string;           // Snapshot collection timestamp
  rawMarketJson: string;         // Verbatim market object
  provenance: ProvenanceMetadata;
  createdAt: string;
}

export interface DecisionJournal {
  id: string;                    // UUID
  observedTradeId: string;       // Foreign key to ObservedTrade
  marketSnapshotId: string;      // Foreign key to MarketSnapshot evaluated
  walletAddress: string;         // Wallet address
  marketId: string;              // Market identifier
  decision: TradeDecisionType;   // 'paper_copy' | 'watchlist' | 'skip'
  copyScore: number;             // Composite decision score [0-100]
  confidence: number | null;     // Sizing confidence [0-1]
  reasonsJson: string;           // JSON array of strings (positive contributing factors)
  risksJson: string;             // JSON array of strings (negative risk items)
  // Granular sub-scores [0-100]
  walletQualityScore: number;
  roiScore: number;
  consistencyScore: number;
  copyabilityScore: number;
  categoryFitScore: number;
  entryTimingScore: number;
  spreadScore: number;
  liquidityScore: number;
  thesisScore: number;
  // Execution parameters
  simulatedPositionSize: number; // $0 for skip/watchlist; $5.00-$20.00 for paper_copy
  ruleSetId: string;             // Exact immutable RuleSet ID used
  ruleVersion: string;           // Version string e.g. 'v1.0.0'
  evaluatedAt: string;           // Evaluation timestamp
  createdAt: string;
}

export interface PaperTrade {
  id: string;                    // UUID
  decisionJournalId: string;     // Foreign key to DecisionJournal
  observedTradeId: string;       // Link to originating observed trade
  walletAddress: string;         // Copied wallet
  marketId: string;              // Target market
  conditionId: string;           // Condition ID
  outcome: string;               // 'YES' | 'NO'
  side: 'BUY' | 'SELL';
  entryPrice: number;            // Simulated entry price
  currentPrice: number;          // Latest mark-to-market price
  simulatedPositionSize: number; // $5.00 to $20.00 (enforced bounds)
  shares: number;                // simulatedPositionSize / entryPrice
  unrealizedPnl: number;         // (currentPrice - entryPrice) * shares for BUY
  realizedPnl: number;           // Final PnL upon close/resolution
  status: PaperTradeStatus;      // 'open' | 'closed' | 'resolved'
  executionMode: 'PAPER';        // Invariant: strictly PAPER
  ruleSetId: string;             // RuleSet version at opening
  openedAt: string;              // Entry timestamp
  closedAt: string | null;       // Exit timestamp (if closed early by rule)
  resolvedAt: string | null;     // Settlement timestamp
  createdAt: string;
  updatedAt: string;
}

export interface PnlSnapshot {
  id: string;                    // UUID
  paperTradeId: string;          // Foreign key to PaperTrade
  snapshotHour: string;          // Formatted hour key e.g. '2026-09-14T12:00:00Z'
  priceAtSnapshot: number;       // Mark-to-market price at snapshot
  unrealizedPnl: number;         // Floating PnL at snapshot
  realizedPnl: number;           // Realized PnL at snapshot
  totalPositionValue: number;    // Current market value of position
  capturedAt: string;            // Timestamp
}

export interface OutcomeReview {
  id: string;                    // UUID
  paperTradeId: string;          // Foreign key to PaperTrade
  decisionJournalId: string;     // Link to originating decision
  milestone: 'T+1h' | 'T+6h' | 'T+24h' | 'resolution';
  priceAtMilestone: number;      // Recorded price at this milestone
  simulatedPnlAtMilestone: number;
  finalOutcome?: string;         // E.g. 'YES' won or 'NO' won
  wasDecisionGood: boolean;      // Retrospective binary judgment
  decisionQualityScore: number;  // 0-100 quality metric
  timingQualityScore: number;    // Evaluation of entry latency impact
  spreadLiquidityImpact: number; // Estimated drag from spread and thin book
  lessonsJson: string;           // Serialized array of qualitative lessons
  ruleSetId: string;             // Active RuleSet at time of review
  reviewedAt: string;            // Timestamp of review execution
  createdAt: string;
}

export type ParameterSourceType = 
  | 'PDF_EXPLICIT' 
  | 'IMPLEMENTATION_BASELINE' 
  | 'DERIVED' 
  | 'OPERATOR_CONFIG' 
  | 'NOT_SPECIFIED_TBD';

export type ParameterStatus = 'ACTIVE' | 'PROVISIONAL' | 'TBD';

export interface ParameterProvenance {
  key: string;
  value: number | string | boolean;
  sourceType: ParameterSourceType;
  sourceReference: string;
  status: ParameterStatus;
  affectsDecisions: boolean;
  description: string;
}

export interface RuleSet {
  id: string;                    // UUID
  version: string;               // e.g. 'v1.0.0'
  status: RuleSetStatus;         // 'active' | 'retired' | 'candidate'
  sourceReason: string;          // Initial seed or reason for adaptation
  createdAt: string;             // Timestamp
  effectiveAt: string;           // Timestamp when activated
  retiredAt?: string | null;     // Timestamp when replaced
  
  // Strategy configuration snapshot (strictly versioned and immutable)
  // All thresholds and weights are typed and explicit.
  config: RuleSetConfig;

  // Complete provenance metadata mapping every configuration parameter to its source of authority
  parameterMetadata?: Record<string, ParameterProvenance>;
}

export interface RuleSetConfig {
  // Paper Trading Bounds (Strict explicit constraints from PDF)
  simulatedBetMin: number;       // Explicitly $5.00 [PDF_EXPLICIT]
  simulatedBetMax: number;       // Explicitly $20.00 [PDF_EXPLICIT]
  
  // Discovery & Filtering Thresholds (PROVISIONAL BASELINE - NOT SPECIFIED IN PDF)
  minDiscoveryLiquidityUsd: number;
  minResolvedTradesCount: number;
  minCategoryResolvedTradesCount: number; // e.g. 3 resolved trades to qualify domain edge
  maxSingleMarketEdgeTrades: number;      // e.g. <= 2 trades indicates localized single-market edge
  
  // One-Hit-Wonder Penalty Parameters & Deductions (PROVISIONAL BASELINE - NOT SPECIFIED IN PDF)
  singleTradeProfitConcentrationThreshold: number; // e.g. 0.80 (80% profit from 1 trade)
  minLiquidityQualityUsd: number;
  maxHistoricalSpread: number;
  penaltySingleTradeConcentrationDeduction: number; // e.g. 30.0 points
  penaltyIlliquidActivityDeduction: number;         // e.g. 25.0 points
  penaltyInsufficientResolvedTradesDeduction: number; // e.g. 20.0 points
  penaltyWideHistoricalSpreadDeduction: number;       // e.g. 15.0 points
  penaltySingleMarketEdgeDeduction: number;           // e.g. 20.0 points
  penaltyUnfollowablePricingDeduction: number;        // e.g. 20.0 points
  penaltyExcessivePostEntryMovementDeduction: number; // e.g. 15.0 points

  // Pricing & Slippage Sensitivity Bounds (PROVISIONAL BASELINE - NOT SPECIFIED IN PDF)
  extremePriceLowerBound: number;         // e.g. 0.05
  extremePriceUpperBound: number;         // e.g. 0.95
  unfollowablePricingThreshold: number;   // e.g. 0.50 (50% extreme entries triggers penalty)
  adverseDriftThreshold: number;          // e.g. 0.40 (40% adverse drift triggers penalty)
  fallbackUnobservedLiquidityUsd: number; // e.g. 5000.0 USD fallback when orderbook snapshot missing
  fallbackUnobservedSpread: number;       // e.g. 0.02 (2c) fallback when orderbook snapshot missing

  // Normalization & Qualitative Fallbacks (PROVISIONAL BASELINE - NOT SPECIFIED IN PDF)
  roiTargetBenchmarkUsd: number;                      // e.g. $10,000 baseline for 100% normalized ROI
  defaultWalletEntryTimingScore: number;              // e.g. 80.0
  defaultTradeEntryTimingScore: number;               // e.g. 85.0
  defaultThesisScore: number;                         // e.g. 80.0

  // Wallet Scoring Weights (PROVISIONAL BASELINE - NOT SPECIFIED IN PDF)
  walletWeightRoi: number;
  walletWeightConsistency: number;
  walletWeightCopyability: number;
  walletWeightCategoryEdge: number;
  walletWeightLiquidity: number;
  walletWeightEntryTiming: number;

  // Wallet State Thresholds (PROVISIONAL BASELINE - NOT SPECIFIED IN PDF)
  walletTrackCutoffScore: number;
  walletWatchCutoffScore: number;

  // Evidence Tier Thresholds (Data-Quality Conventions - Research Metric, not trading skill score)
  evidenceTierHighThreshold: number;     // e.g. 75.0
  evidenceTierModerateThreshold: number; // e.g. 50.0
  evidenceTierLowThreshold: number;      // e.g. 25.0
  evidenceMinTradesHigh: number;         // e.g. 10 resolved trades
  evidenceMinTradesModerate: number;     // e.g. 5 resolved trades
  evidenceMinTradesLow: number;          // e.g. 3 trades

  // Trade Scoring Weights (PROVISIONAL BASELINE - NOT SPECIFIED IN PDF)
  tradeWeightWalletQuality: number;
  tradeWeightCategoryFit: number;
  tradeWeightPriceMovement: number;
  tradeWeightSpread: number;
  tradeWeightLiquidity: number;
  tradeWeightEntryTiming: number;
  tradeWeightThesis: number;

  // Trade Decision Thresholds (NOT SPECIFIED - Configurable TBD)
  minPaperCopyScore: number;     // e.g. 75.0
  minWatchlistScore: number;     // e.g. 50.0
  maxAllowedPriceDrift: number;  // Maximum difference between detected and entry price
  maxAllowedSpread: number;      // Maximum bid-ask spread
  minTradeLiquidityUsd: number;  // Minimum top-of-book depth

  // Historical Copyability Research Parameters (PROVISIONAL BASELINE - NOT SPECIFIED IN PDF)
  maxSnapshotAgeSeconds: number;               // Snapshot freshness limit (e.g. 60s) before STALE_SNAPSHOT
  copyDifficultSpreadThreshold: number;       // e.g. 0.04 ($0.04) boundary for difficult copy
  copyUnfollowableSpreadThreshold: number;     // e.g. 0.08 ($0.08) boundary for unfollowable copy
  copyDifficultAdverseDriftThreshold: number;  // e.g. 0.03 ($0.03) adverse drift boundary
  copyUnfollowableAdverseDriftThreshold: number; // e.g. 0.06 ($0.06) adverse drift boundary
  copyMinLiquidityThresholdUsd: number;        // e.g. $500 minimum top-of-book depth

  // Real-Time Wallet Trade Monitoring Parameters (PROVISIONAL BASELINE / OPERATOR CONFIG)
  freshnessAgingThresholdSeconds: number;     // e.g. 60s (snapshot is AGING if older than 60s)
  freshnessStaleThresholdSeconds: number;     // e.g. 300s (snapshot is STALE if older than 300s)
  staleMarketDecision: 'watchlist' | 'skip';  // Action when snapshot is stale
  allowWatchWalletCopy: boolean;              // Whether WATCH wallets may trigger paper copies (false per default)
  minTimeToResolutionSeconds: number;         // e.g. 3600s (1h minimum to avoid settlement volatility)
}

export interface RuleChange {
  id: string;                    // UUID
  oldRuleSetId: string;          // Foreign key to previous RuleSet
  newRuleSetId: string;          // Foreign key to new RuleSet
  changedBy: string;             // Identifier of operator or learning engine
  reason: string;                // Qualitative rationale
  evidenceSummary: string;       // Empirical statistical evidence from reviews
  beforeJson: string;            // Serialized snapshot of previous parameters
  afterJson: string;             // Serialized snapshot of new parameters
  expectedImprovement: string;   // Hypothesis of expected metric shift
  timestamp: string;             // UTC ISO-8601
  createdAt: string;
}

export interface DailyReport {
  id: string;                    // UUID
  reportDate: string;            // 'YYYY-MM-DD'
  paperPnlToday: number;         // Realized + unrealized delta today
  totalPaperPnl: number;         // Cumulative paper PnL to date
  winRate: number;               // Win rate on resolved paper trades today
  bestPaperTradeId?: string | null;
  worstPaperTradeId?: string | null;
  bestWalletToday?: string | null;
  tradesCopiedCount: number;
  tradesWatchedCount: number;
  tradesSkippedCount: number;
  activeRuleVersion: string;
  summaryNotes: string;
  createdAt: string;
}

export interface BenchmarkComparison {
  cohort: BenchmarkCohort;
  tradeCount: number;
  winRate: number;
  totalPnl: number;
  averagePnlPerTrade: number;
  missedWinnersCount: number;
  avoidedLosersCount: number;
  badCopiesCount: number;
  goodSkipsCount: number;
  lateEntriesAvoidedCount: number;
  spreadLossesAvoidedCount: number;
}

// --- Task 1.5: Historical Trade Research & Realistic Copyability Types ---

export type ResearchWindowDays = 1 | 7 | 30 | 90;
export type ResearchWindow = '24h' | '7d' | '30d' | '90d';

export type FillModelTier = 
  | 'EXACT_OBSERVED' 
  | 'TOP_OF_BOOK' 
  | 'MIDPOINT' 
  | 'STALE_SNAPSHOT' 
  | 'UNAVAILABLE';

export type CopyabilityClassification = 
  | 'COPYABLE' 
  | 'DIFFICULT' 
  | 'UNFOLLOWABLE' 
  | 'INSUFFICIENT_DATA';

export type ResearchCohort = 
  | 'GOOD_COPY' 
  | 'BAD_COPY' 
  | 'MISSED_WINNER' 
  | 'AVOIDED_LOSER' 
  | 'INSUFFICIENT_DATA';

export interface TradeTimeline {
  t0WalletEntry: string | null;            // Observed on-chain or upstream entry timestamp
  t1Observation: string | null;            // Timestamp when system first detected the trade
  t2Snapshot: string | null;               // Timestamp of first usable market snapshot after detection
  t3ModeledCopy: string | null;            // Timestamp of hypothetical copy execution
  t4Subsequent: string | null;             // Timestamp of subsequent market movement observation
  t5Resolution: string | null;             // Market resolution timestamp (null if unresolved)
  latencyWalletToObservationMs: number | null;
  latencyObservationToSnapshotMs: number | null;
  latencyTotalModeledMs: number | null;
  isTimelineComplete: boolean;
}

export interface HistoricalCopyPriceModelResult {
  modeledCopyPrice: number | null;
  modeledCopyTimestamp: string | null;
  fillModel: FillModelTier;
  spreadAtCopy: number | null;
  spreadBpsAtCopy: number | null;
  liquidityAtCopy: number | null;
  priceDeltaFromWallet: number | null;
  relativeTradeSizeToDepth: number | null;
  modelConfidence: number;                 // [0 - 1.0]
  evidenceCompleteness: number;            // [0 - 1.0]
  assumptionsUsed: string[];
  isAvailable: boolean;
}

export interface HistoricalCopyEvaluation {
  id: string;                              // UUID
  walletAddress: string;                   // Evaluated wallet address
  observedTradeId: string;                 // Target ObservedTrade ID
  marketId: string;                        // Market slug or condition ID
  timeline: TradeTimeline;
  walletEntryPrice: number;                // Actual observed wallet execution price (never overwritten)
  walletEntrySize: number;                 // Observed trade size in USD
  walletEntryTimestamp: string;
  observedPrice: number | null;            // Market price at detection
  observedTimestamp: string | null;
  modeledCopyPrice: number | null;         // Hypothetical fill price
  modeledCopyTimestamp: string | null;
  fillModel: FillModelTier;
  spreadAtEntry: number | null;
  spreadAtObservation: number | null;
  spreadAtCopy: number | null;
  liquidityAtEntry: number | null;
  liquidityAtObservation: number | null;
  liquidityAtCopy: number | null;
  relativeTradeSizeToDepth: number | null;
  priceDrift: number | null;               // Detected price minus wallet entry price
  adverseDrift: number | null;             // Unfavorable price movement magnitude
  latencySeconds: number | null;           // Total modeled latency in seconds
  walletOutcome: 'WIN' | 'LOSS' | 'UNRESOLVED' | null;
  walletPnl: number | null;
  modeledCopyOutcome: 'WIN' | 'LOSS' | 'UNRESOLVED' | null;
  modeledCopyPnl: number | null;
  copyPnlDelta: number | null;             // modeledCopyPnl - walletPnl
  classification: CopyabilityClassification;
  cohort: ResearchCohort;
  reasonCodes: string[];
  analysisWindow: string;                  // e.g. '30d'
  ruleSetId: string;
  ruleVersion: string;
  normalizationVersion: string;
  datasetId: string;
  datasetVersion: string;
  generatedAt: string;
  provenance: ProvenanceMetadata;
}

export interface WalletCopyabilityAggregation {
  walletAddress: string;
  totalTradesAnalyzed: number;
  copyableTradeCount: number;
  difficultTradeCount: number;
  unfollowableTradeCount: number;
  insufficientDataTradeCount: number;
  copyabilityRate: number;                 // copyable / total
  resolvedCount: number;
  walletResolvedPnL: number;
  modeledCopyPnL: number;
  copyPnLDelta: number;
  missedWinnerCount: number;
  avoidedLoserCount: number;
  medianCopyDelayMs: number;
  medianEntryDrift: number;
  medianSpread: number;
  medianLiquidityUsd: number;
}

export interface CategoryCopyabilityAggregation {
  category: string;
  tradeCount: number;
  resolvedCount: number;
  copyableCount: number;
  difficultCount: number;
  unfollowableCount: number;
  insufficientDataCount: number;
  copyabilityRate: number;
  walletPnL: number;
  modeledCopyPnL: number;
  copyPnLDelta: number;
  medianSpread: number;
  medianLiquidityUsd: number;
  medianDrift: number;
  latencyDistribution: Record<string, number>;
}

export interface LatencyBucketDistribution {
  bucketLabel: string;                     // e.g. '0-5s', '5-15s', '15-30s', '30-60s', '60-300s', '300s+'
  minSeconds: number;
  maxSeconds: number | null;
  tradeCount: number;
  medianAdverseMovement: number;
  meanAdverseMovement: number;
  worstAdverseMovement: number;
  medianSpread: number;
  medianLiquidity: number;
  winRate: number;
}

export interface ResearchDatasetMetadata {
  datasetId: string;
  datasetVersion: string;
  generatedAt: string;
  requestedStart: string;
  requestedEnd: string;
  actualStart: string;
  actualEnd: string;
  coverageRatio: number;
  normalizationVersion: string;
}

export interface EmpiricalCalibrationDataset {
  datasetMetadata: ResearchDatasetMetadata;
  ruleSetId: string;
  totalEvaluations: number;
  cohortCounts: Record<ResearchCohort, number>;
  classificationCounts: Record<CopyabilityClassification, number>;
  entryDriftDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
  adverseDriftDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
  spreadDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
  liquidityDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
  latencyDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
  pnlDeltaDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
  walletAggregations: WalletCopyabilityAggregation[];
  categoryAggregations: CategoryCopyabilityAggregation[];
  latencyBuckets: LatencyBucketDistribution[];
}

// Real-Time Wallet Trade Monitoring & Live Signal Types (Task 1.6)

export type MarketFreshness = 'FRESH' | 'AGING' | 'STALE' | 'UNAVAILABLE';
export type EvidenceCompleteness = 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT';

export interface CurrentCopyabilityResult {
  classification: CopyabilityClassification; // 'COPYABLE' | 'DIFFICULT' | 'UNFOLLOWABLE' | 'INSUFFICIENT_DATA'
  currentSpread: number | null;
  currentLiquidity: number | null;
  priceDrift: number | null;
  adverseDrift: number | null;
  detectionLatencyMs: number | null;
  marketFreshness: MarketFreshness;
  timeToResolutionSeconds: number | null;
  historicalCopyabilityRate: number | null;
  reasonCodes: string[];
  riskFlags: string[];
  evidenceCompleteness: EvidenceCompleteness;
  ruleSetId: string;
  ruleVersion: string;
  evaluatedAt: string;
}

export interface DetectedTradeEvent {
  id: string;                              // UUID
  observedTradeId: string;                 // FK to ObservedTrade
  walletAddress: string;                   // Monitored wallet
  marketId: string;                        // Market ID
  detectedAt: string;                      // ISO timestamp when detected
  sourceTimestamp: string;                 // Upstream trade timestamp
  detectionLatencyMs: number;              // detectedAt - sourceTimestamp in ms
  dataSource: string;                      // e.g. 'polymarket_data_api'
  normalizationVersion: string;            // e.g. 'v1.0.0'
  processed: boolean;                      // Whether decision was generated
  createdAt: string;
}

export interface LiveSignalView {
  id: string;                              // Detection event ID or Signal ID
  detectedAt: string;
  sourceTimestamp: string;
  detectionLatencyMs: number;
  walletAddress: string;
  walletRank: number;
  walletStatus: WalletStatus;
  walletScore: number;
  category: string;
  categoryWinRate: number;
  marketId: string;
  marketQuestion: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  walletEntryPrice: number;
  walletSize: number;
  currentPrice: number;
  priceMovement: number;
  spread: number;
  liquidity: number;
  marketFreshness: MarketFreshness;
  timeToResolutionSeconds: number | null;
  copyability: CopyabilityClassification;
  decision: TradeDecisionType;             // 'paper_copy' | 'watchlist' | 'skip'
  finalScore: number;
  confidence: number | null;
  reasons: string[];
  risks: string[];
  paperTradeId?: string | null;
  paperSize?: number | null;
  paperEntryPrice?: number | null;
  paperStatus?: string | null;
  ruleSetVersion: string;
  evidenceCompleteness: EvidenceCompleteness;
  // Provenance breakdown labels
  provenance: {
    historicalWalletEvidence: string;
    currentMarketEvidence: string;
    currentWalletTrade: string;
    modeledCopyCondition: string;
    paperDecision: string;
  };
}

export interface MonitorSystemHealth {
  ingestionStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  marketDataFreshness: MarketFreshness;
  walletMonitorStatus: 'RUNNING' | 'IDLE' | 'ERROR';
  paperEngineStatus: 'ACTIVE' | 'STOPPED';
  executionMode: 'PAPER ONLY';             // Permanent invariant
  lastPollAt: string | null;
  activeTrackedWallets: number;
  totalDetectedTrades: number;
  totalPaperTradesCreated: number;
  lastErrorMessage?: string | null;
}

// Runtime Daemon & Lifecycle Control Types (Task 2.0)

export type EngineLifecycleState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR' | 'UNKNOWN';

export type RuntimeJobName =
  | 'leaderboard'
  | 'wallet_scan'
  | 'trade_monitor'
  | 'market_snapshot'
  | 'pnl_update'
  | 'outcome_review'
  | 'daily_report'
  | 'calibration'
  | 'health_telemetry';

export interface RuntimeJobExecutionRecord {
  jobName: RuntimeJobName;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  totalExecutions: number;
  totalSuccesses: number;
  totalFailures: number;
  isRunning: boolean;
}

export interface RuntimeDaemonState {
  id: string; // 'singleton'
  lifecycleState: EngineLifecycleState;
  startedAt: string | null;
  stoppedAt: string | null;
  lastHeartbeatAt: string | null;
  lastSuccessfulCycleAt: string | null;
  cycleCount: number;
  activeJobsCount: number;
  lastError: string | null;
  lastErrorAt: string | null;
  lastErrorJob: string | null;
  telemetryJson: string;
  updatedAt: string;
}

export interface RuntimeTelemetry {
  id: string;
  lifecycleState: EngineLifecycleState;
  runtimeStartTimestamp: string | null;
  runtimeStopTimestamp: string | null;
  lastSuccessfulCycle: string | null;
  lastSuccessfulLeaderboardScan: string | null;
  lastSuccessfulWalletScan: string | null;
  lastSuccessfulTradeObservation: string | null;
  lastSuccessfulPnlUpdate: string | null;
  lastSuccessfulOutcomeReview: string | null;
  lastSuccessfulReport: string | null;
  cycleCount: number;
  activeJobCount: number;
  lastError: string | null;
  lastErrorTimestamp: string | null;
  lastErrorJob: string | null;
  currentRuleSetId: string;
  trackedWalletCount: number;
  activePaperTradeCount: number;
  totalPaperTradesCount: number;
  currentPaperPnl: {
    unrealized: number;
    realized: number;
    total: number;
  };
  ingestionProviderHealth: 'OPERATIONAL' | 'DEGRADED' | 'IDLE';
  currentDataFreshness: MarketFreshness;
  executionMode: 'PAPER ONLY';
  capturedAt: string;
}

export interface RuntimeConfigOptions {
  leaderboardIntervalMs?: number;
  walletScanIntervalMs?: number;
  tradeMonitorIntervalMs?: number;
  marketSnapshotIntervalMs?: number;
  pnlIntervalMs?: number;
  outcomeReviewIntervalMs?: number;
  dailyReportIntervalMs?: number;
  calibrationIntervalMs?: number;
  healthTelemetryIntervalMs?: number;
  providerRetryAttempts?: number;
  providerRetryBackoffMs?: number;
  shutdownTimeoutMs?: number;
  staleThresholdSeconds?: number;
}

// ==============================================================================
// Task 2.1: Empirical Calibration & Controlled Rule-Learning Types
// ==============================================================================

export type EvidenceTier = 'INSUFFICIENT' | 'WEAK' | 'MODERATE' | 'STRONG';

export type CalibrationState =
  | 'INSUFFICIENT_DATA'
  | 'CALIBRATION_READY'
  | 'CALIBRATION_RUNNING'
  | 'CALIBRATION_COMPLETE';

export interface CohortMetrics {
  cohort: BenchmarkCohort;
  sampleCount: number;
  winRate: number | null;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  averagePnlPerTrade: number | null;
  medianPnlPerTrade: number | null;
  maxDrawdown: number;
  profitFactor: number | null;
  avoidedLossValue: number;
  missedWinnerValue: number;
  badCopyCount: number;
  goodSkipCount: number;
  lateEntryLosses: number;
  spreadLosses: number;
  lateEntriesAvoidedCount: number;
  spreadLossesAvoidedCount: number;
  dataStatus: 'INSUFFICIENT_DATA' | 'AVAILABLE';
  dataReason?: string | null;
}

export interface FourCohortBenchmarkResult {
  state: CalibrationState;
  paperCopy: CohortMetrics;
  blindLeaderboard: CohortMetrics;
  watchlist: CohortMetrics;
  skipped: CohortMetrics;
  comparisonSummary: {
    paperVsBlindPnlDelta: number;
    avoidedLossRatio: number;
    badCopyRate: number;
    goodSkipRate: number;
    evidenceTier: EvidenceTier;
  };
  generatedAt: string;
  dataMode: 'OBSERVED_EMPIRICAL' | 'HISTORICAL_HYPOTHETICAL' | 'SYNTHETIC_FIXTURE';
}

export interface CalibrationSample {
  id: string;
  observedTradeId: string;
  walletAddress: string;
  walletEvaluationAtDecision: WalletResearchEvaluation | null;
  category: string;
  observedTrade: ObservedTrade;
  marketSnapshot: MarketSnapshot | null;
  decision: TradeDecisionType;
  decisionJournal: DecisionJournal;
  ruleSetId: string;
  paperTrade: PaperTrade | null;
  entryPrice: number;
  subsequentMarketPrices: number[];
  spread: number;
  liquidity: number;
  timeToResolution: number;
  outcome: 'WIN' | 'LOSS' | 'UNRESOLVED' | null;
  realizedPnl: number | null;
  outcomeReviews: OutcomeReview[];
  decisionFactors: Record<string, number>;
  dataCompleteness: DataCompletenessReport;
  provenance: ProvenanceMetadata;
}

export interface ExcludedSampleRecord {
  id: string;
  observedTradeId: string;
  reason: string;
  timestamp: string;
}

export interface CalibrationDataset {
  datasetId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  samples: CalibrationSample[];
  excludedSamples: ExcludedSampleRecord[];
  totalObserved: number;
  totalAccepted: number;
  totalExcluded: number;
  coverageRatio: number;
  evidenceTier: EvidenceTier;
}

export type LearningPolicyName =
  | 'SPREAD_ADAPTATION'
  | 'LIQUIDITY_ADAPTATION'
  | 'WALLET_QUALITY_ADAPTATION'
  | 'CATEGORY_ADAPTATION'
  | 'LATE_ENTRY_ADAPTATION'
  | 'CONSISTENCY_ADAPTATION';

export interface RuleLearningPolicyConfig {
  policyName: LearningPolicyName;
  enabled: boolean;
  minEvidenceTrades: number;
  thresholdTrigger: number;
  stepSize: number;
  maxAdjustmentPerCycle: number;
  description: string;
}

export interface RuleLearningConfig {
  minEvidenceTradesStrong: number;
  minEvidenceTradesModerate: number;
  minEvidenceTradesWeak: number;
  maxParameterStepPercent: number;
  parameterCooldownCycles: number;
  maxChangesPerCycle: number;
  trainWindowRatio: number; // e.g. 0.70 for 70% train / 30% out-of-sample validation
  minValidationTrades: number;
  minValidationImprovementPercent: number;
  policies: Record<LearningPolicyName, RuleLearningPolicyConfig>;
  guardrails: Record<string, { min: number; max: number }>;
}

export interface CandidateParameterProposal {
  paramKey: keyof RuleSetConfig;
  beforeValue: number;
  proposedValue: number;
  reason: string;
  evidence: string;
  evidenceTier: EvidenceTier;
  expectedImprovement: string;
  affectedDimension: string;
  policyName: LearningPolicyName;
}

export interface WalkForwardResult {
  candidateRuleSetId: string;
  trainWindowStart: string;
  trainWindowEnd: string;
  validationWindowStart: string;
  validationWindowEnd: string;
  trainTradesCount: number;
  validationTradesCount: number;
  candidateValidationPnl: number;
  activeValidationPnl: number;
  candidateWinRate: number;
  activeWinRate: number;
  pnlImprovementDelta: number;
  winRateImprovementDelta: number;
  badCopyReduction: number;
  lateEntryLossReduction: number;
  spreadLossReduction: number;
  isPromoted: boolean;
  rejectionReasons: string[];
  validationTier: EvidenceTier;
}

export type LearningEventStatus = 'PROMOTED' | 'REJECTED' | 'INSUFFICIENT_DATA' | 'NO_CHANGES_NEEDED';

export interface LearningEvent {
  id: string;
  timestamp: string;
  inputRuleSetId: string;
  candidateRuleSetId: string | null;
  outputRuleSetId: string | null;
  status: LearningEventStatus;
  calibrationWindowStart: string;
  calibrationWindowEnd: string;
  trainWindowStart: string;
  trainWindowEnd: string;
  validationWindowStart: string;
  validationWindowEnd: string;
  observationsCount: number;
  excludedObservationsCount: number;
  exclusionsJson: string;
  cohortMetricsJson: string;
  proposedChangesJson: string;
  acceptedChangesJson: string;
  rejectedChangesJson: string;
  evidenceTier: EvidenceTier;
  reason: string;
  expectedImprovement: string;
  validationResultJson: string | null;
  provenanceJson: string;
  configVersion: string;
  createdAt: string;
}



