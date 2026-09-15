/**
 * Polymarket Copy-Trading Research & Paper-Trading Foundation
 * Frontend API Response Types & Data Contracts.
 * 
 * Safety Guarantee:
 * - Read-only API surface.
 * - Zero types for private keys, signing, or live order placement.
 */

export type ExecutionMode = 'PAPER';

export type DataMode = 'LIVE READ-ONLY DATA' | 'DEMO DATA' | 'NO DATA';

export type ProviderHealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'IDLE';

export interface SystemStatusResponse {
  executionMode: ExecutionMode;
  dataMode: DataMode;
  activeRuleset: Record<string, any> | null;
  activeRulesetId: string | null;
  openPaperTradesCount: number;
  closedPaperTradesCount: number;
  trackedWalletsCount: number;
  totalPaperPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  latestLeaderboardScan: {
    scanId: string;
    scannedAt: string;
    walletCount: number;
    lookbackDays: number;
    isDemo: boolean;
  } | null;
  latestMarketSnapshot: {
    id: string;
    marketId: string;
    question: string;
    spread: number;
    liquidity: number;
    collectedAt: string;
  } | null;
  latestSignal: {
    id: string;
    marketId: string;
    walletAddress: string;
    decision: 'paper_copy' | 'watchlist' | 'skip';
    finalScore: number;
    timestamp: string;
  } | null;
  latestDecision: {
    id: string;
    marketId: string;
    walletAddress: string;
    decision: 'paper_copy' | 'watchlist' | 'skip';
    copyScore: number;
    evaluatedAt: string;
  } | null;
  status?: 'HEALTHY' | 'DEGRADED';
  lastError?: string | null;
  timestamp: string;
}

export interface PerformanceMetrics {
  totalPaperTrades: number;
  openPaperTrades: number;
  closedPaperTrades: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  winRate: number | null;
  winRateStatus: 'AVAILABLE' | 'INSUFFICIENT DATA';
  winRateReason: string;
  wins: number;
  losses: number;
}

export interface DecisionsSummary {
  totalEvaluated: number;
  paperCopyCount: number;
  watchlistCount: number;
  skippedCount: number;
}

export interface CohortStats {
  tradeCount: number;
  winRate: number;
  totalPnl: number;
  averagePnlPerTrade: number;
  missedWinnersCount: number;
  avoidedLosersCount: number;
  badCopiesCount: number;
  goodSkipsCount: number;
}

export interface PerformanceResponse {
  executionMode: ExecutionMode;
  dataMode: string;
  safetyNotice?: string;
  metrics: PerformanceMetrics;
  decisionsSummary: DecisionsSummary & { totalDecisions?: number };
  benchmarkCohorts: {
    paper_copy: CohortStats;
    blind_leaderboard: CohortStats;
    watchlist: CohortStats;
    skipped: CohortStats;
  };
  cohortDataStatus: string;
  cohortDataReason?: string | null;
  historicalResearchBenchmark: {
    dataMode: string;
    totalTradesAnalyzed?: number;
    copyableCount?: number;
    modeledCopyPnL?: number;
    walletRealizedPnL?: number;
    pnlDelta?: number;
    missedWinners?: number;
    avoidedLosers?: number;
    avgLatencySeconds?: number;
    description?: string;
    baselineWinRate?: number;
    baselinePnl?: number;
  };
  recentPaperTrades?: PaperTradeItem[];
  timestamp: string;
}

export interface IngestionStatusResponse {
  dataMode: DataMode;
  executionMode: ExecutionMode;
  dataFreshness: {
    lastIngestionTime: string | null;
    ageSeconds: number | null;
    freshnessLabel: string;
  };
  providerHealth: {
    status: ProviderHealthStatus;
    lastVerifiedService: string;
    unsupportedCapabilitiesNotice: string;
  };
  latestLeaderboardScan: {
    scanId: string;
    scannedAt: string;
    walletCount: number;
    lookbackDays: number;
    isDemo: boolean;
  } | null;
  latestMarketSnapshot: {
    id: string;
    marketId: string;
    question: string;
    spread: number;
    liquidity: number;
    collectedAt: string;
  } | null;
  databaseCoverage: {
    walletsDiscovered: number;
    observedTradesCount: number;
  };
  recentOperations: Array<{
    id: string;
    operation: string;
    status: string;
    startedAt: string;
    durationMs: number;
    recordsProcessed: number;
    errorsCount: number;
  }>;
}

export interface LatestSignalResponse {
  signal: {
    id: string;
    marketId: string;
    walletAddress: string;
    decision: 'paper_copy' | 'watchlist' | 'skip';
    finalScore: number;
    timestamp: string;
  } | null;
}

export interface ApiClientError {
  message: string;
  status?: number;
  endpoint: string;
  timestamp: string;
}

export type WalletStatus = 'track' | 'watch' | 'ignore';

export interface WalletResearchEvaluation {
  id: string;
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
  roiProvenance: {
    reportedRoi: number | null;
    derivedRoi: number | null;
    source: 'provider' | 'derived' | 'unavailable';
    isSynthetic: boolean;
  };
  dataCompleteness: {
    hasFullHistoricalTransactions: boolean;
    hasContinuousResolutionCoverage: boolean;
    hasConsistentTimestamps: boolean;
    evidenceLevel: 'COMPLETE' | 'PARTIAL' | 'MINIMAL';
    missingAttributes: string[];
  };
  oneHitWonderDiagnostics: {
    hasSingleTradeDominance: boolean;
    largestWinUsd: number;
    totalProfitUsd: number;
    singleTradeProfitRatio: number;
    dominantMarketId: string | null;
    dominantMarketProfitRatio: number;
    dominantTradeTimestamp: string | null;
    isDormantAfterWin: boolean;
    appliedPenaltyDeduction: number;
  };
  frequencyMetrics: {
    averageTradesPerDay: number;
    activeTradingDaysCount: number;
    medianIntervalMinutes: number;
    isBurstTrader: boolean;
  };
  copyabilityFactors: {
    averageHistoricalSpread: number;
    medianLiquidityDepthUsd: number;
    unfollowablePriceFraction: number;
    adverseDriftFraction: number;
    entryTimingAverageScore: number;
  };
  evaluatedAt: string;
  createdAt: string;
}

export interface WalletProfile {
  id: string;
  address: string;
  label: string | null;
  sourceRank: number;
  status: WalletStatus;
  statusReason: string;
  roi30d: number;
  consistencyScore: number;
  copyabilityScore: number;
  oneHitWonderPenalty: number;
  globalScore: number;
  bestCategory: string;
  categoryStrengthsJson: string;
  averageTradeSize: number;
  tradeCount30d: number;
  resolvedTradeCount30d: number;
  winRate30d: number;
  averageLiquidity: number;
  averageSpread: number;
  averageEntryTiming: number;
  copyabilityNotes: string;
  riskNotes: string;
  ruleSetId: string;
  lastScannedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObservedTradeItem {
  id: string;
  walletAddress: string;
  marketId: string;
  conditionId: string;
  marketQuestion: string;
  marketCategory: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  walletEntryPrice: number;
  detectedPrice: number;
  size: number;
  sourceTxHash?: string;
  sourceTimestamp: string;
  createdAt: string;
}

export interface RankingsResponse {
  rankings: WalletResearchEvaluation[];
  total: number;
  activeRuleVersion: string;
  analysisWindowDays: number;
}

export interface WalletProfileResponse {
  wallet: WalletProfile;
  evaluation: WalletResearchEvaluation | null;
  recentTrades: ObservedTradeItem[];
  totalTrades: number;
}

export interface HistoricalCopySummary {
  analysisWindow: string;
  totalTradesAnalyzed: number;
  copyableCount: number;
  unfollowableCount: number;
  delayedFillCount: number;
  totalWalletPnL: number;
  totalModeledCopyPnL: number;
  totalCopyPnLDelta: number;
  avgLatencySeconds: number;
  missedWinnerCount: number;
  avoidedLoserCount: number;
}

export interface CopyabilitySummaryResponse {
  summary: HistoricalCopySummary;
  window: string;
}

export interface TradeTimeline {
  t0WalletEntry: string | null;
  t1Observation: string | null;
  t2Snapshot: string | null;
  t3ModeledCopy: string | null;
  t4Subsequent: string | null;
  t5Resolution: string | null;
  latencyWalletToObservationMs: number | null;
  latencyObservationToSnapshotMs: number | null;
  latencyTotalModeledMs: number | null;
  isTimelineComplete: boolean;
}

export interface HistoricalCopyEvaluationItem {
  id: string;
  walletAddress: string;
  observedTradeId: string;
  marketId: string;
  timeline: TradeTimeline;
  walletEntryPrice: number;
  walletEntrySize: number;
  walletEntryTimestamp: string;
  observedPrice: number | null;
  observedTimestamp: string | null;
  modeledCopyPrice: number | null;
  modeledCopyTimestamp: string | null;
  fillModel: 'EXACT_OBSERVED' | 'TOP_OF_BOOK' | 'MIDPOINT' | 'STALE_SNAPSHOT' | 'UNAVAILABLE';
  spreadAtEntry: number | null;
  spreadAtObservation: number | null;
  spreadAtCopy: number | null;
  liquidityAtEntry: number | null;
  liquidityAtObservation: number | null;
  liquidityAtCopy: number | null;
  relativeTradeSizeToDepth: number | null;
  priceDrift: number | null;
  adverseDrift: number | null;
  latencySeconds: number | null;
  walletOutcome: 'WIN' | 'LOSS' | 'UNRESOLVED' | null;
  walletPnl: number | null;
  modeledCopyOutcome: 'WIN' | 'LOSS' | 'UNRESOLVED' | null;
  modeledCopyPnl: number | null;
  copyPnlDelta: number | null;
  classification: 'COPYABLE' | 'DIFFICULT' | 'UNFOLLOWABLE' | 'INSUFFICIENT_DATA';
  cohort: 'GOOD_COPY' | 'BAD_COPY' | 'MISSED_WINNER' | 'AVOIDED_LOSER' | 'INSUFFICIENT_DATA';
  reasonCodes: string[];
  analysisWindow: string;
  ruleSetId: string;
  ruleVersion: string;
  generatedAt: string;
}

export interface CopyabilityEvaluationsResponse {
  evaluations: HistoricalCopyEvaluationItem[];
  total: number;
}

export interface LiveSignalView {
  id: string;
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
  marketFreshness: 'FRESH' | 'AGING' | 'STALE' | 'UNAVAILABLE';
  timeToResolutionSeconds: number | null;
  copyability: 'COPYABLE' | 'DIFFICULT' | 'UNFOLLOWABLE' | 'INSUFFICIENT_DATA';
  decision: 'paper_copy' | 'watchlist' | 'skip';
  finalScore: number;
  confidence: number | null;
  reasons: string[];
  risks: string[];
  paperTradeId?: string | null;
  paperSize?: number | null;
  paperEntryPrice?: number | null;
  paperStatus?: string | null;
  ruleSetVersion: string;
  evidenceCompleteness: 'COMPLETE' | 'PARTIAL' | 'MINIMAL';
  provenance: {
    historicalWalletEvidence: string;
    currentMarketEvidence: string;
    currentWalletTrade: string;
    modeledCopyCondition: string;
    paperDecision: string;
  };
}

export interface LiveSignalsResponse {
  signals: LiveSignalView[];
  total: number;
}

export interface LiveSignalDetailResponse {
  signal: LiveSignalView;
}

export interface PaperTradeItem {
  id: string;
  decisionJournalId: string;
  observedTradeId: string;
  walletAddress: string;
  marketId: string;
  conditionId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  simulatedPositionSize: number; // strictly bounded between $5.00 and $20.00
  shares: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: 'open' | 'closed' | 'resolved';
  executionMode: 'PAPER';
  ruleSetId: string;
  openedAt: string;
  closedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaperTradesResponse {
  paperTrades: PaperTradeItem[];
  totalTrades: number;
  totalPnl: number;
  executionMode: 'PAPER';
}

export interface PaperTradeDetailResponse {
  paperTrade: PaperTradeItem;
}

export interface DecisionJournalItem {
  id: string;
  observedTradeId: string;
  marketSnapshotId: string;
  walletAddress: string;
  marketId: string;
  decision: 'paper_copy' | 'watchlist' | 'skip';
  copyScore: number;
  confidence: number | null;
  reasonsJson: string;
  risksJson: string;
  walletQualityScore: number;
  roiScore: number;
  consistencyScore: number;
  copyabilityScore: number;
  categoryFitScore: number;
  entryTimingScore: number;
  spreadScore: number;
  liquidityScore: number;
  thesisScore: number;
  simulatedPositionSize: number;
  ruleSetId: string;
  ruleVersion: string;
  evaluatedAt: string;
  createdAt: string;
}

export interface DecisionJournalResponse {
  decisions: DecisionJournalItem[];
  total: number;
}

export interface ObservabilityStatus {
  monitorProcessStatus: 'RUNNING' | 'IDLE' | 'STALE' | 'UNKNOWN' | 'ERROR';
  engineLifecycleState?: 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR' | 'UNKNOWN';
  lastSuccessfulMonitoringCycle: string | null;
  lastSuccessfulLeaderboardScan: string | null;
  lastSuccessfulWalletScan: string | null;
  lastSuccessfulTradeObservation: string | null;
  lastSuccessfulPnlUpdate: string | null;
  lastSuccessfulOutcomeReview: string | null;
  lastError: string | null;
  lastErrorTimestamp: string | null;
  currentDataFreshness: 'FRESH' | 'AGING' | 'STALE' | 'UNAVAILABLE';
  trackedWalletCount: number;
  currentPaperTradeCount: number;
  currentPaperPnl: {
    unrealized: number;
    realized: number;
    total: number;
  };
  ingestionProviderHealth: 'OPERATIONAL' | 'DEGRADED' | 'IDLE';
  currentRuleSetId: string;
  executionMode: 'PAPER ONLY';
}

export interface MonitorSystemHealthResponse {
  ingestionStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  marketDataFreshness: 'FRESH' | 'AGING' | 'STALE' | 'UNAVAILABLE';
  walletMonitorStatus: 'RUNNING' | 'IDLE' | 'ERROR';
  paperEngineStatus: 'ACTIVE' | 'STOPPED' | 'RUNNING';
  engineLifecycleState?: 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR' | 'UNKNOWN';
  executionMode: 'PAPER ONLY';
  lastPollAt: string | null;
  activeTrackedWallets: number;
  totalDetectedTrades: number;
  totalPaperTradesCreated: number;
  lastErrorMessage?: string | null;
  observability?: ObservabilityStatus;
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

export interface RuleSetConfig {
  simulatedBetMin: number;
  simulatedBetMax: number;
  minDiscoveryLiquidityUsd: number;
  minResolvedTradesCount: number;
  minCategoryResolvedTradesCount: number;
  minLeaderboardLookbackDays: number;
  walletConsistencyWinRateThreshold: number;
  oneHitWonderProfitRatioThreshold: number;
  oneHitSingleTradeProfitRatioThreshold: number;
  oneHitDormantDaysThreshold: number;
  oneHitWonderMaxDeduction: number;
  burstTradeIntervalMinutesThreshold: number;
  burstTradeDailyCountThreshold: number;
  categoryScoreMinTradeCount: number;
  categoryWinRateBonusThreshold: number;
  categoryLossPenaltyThreshold: number;
  evidenceTierHighThreshold: number;
  evidenceTierModerateThreshold: number;
  evidenceTierLowThreshold: number;
  evidenceMinTradesHigh: number;
  evidenceMinTradesModerate: number;
  evidenceMinTradesLow: number;
  tradeWeightWalletQuality: number;
  tradeWeightCategoryFit: number;
  tradeWeightPriceMovement: number;
  tradeWeightSpread: number;
  tradeWeightLiquidity: number;
  tradeWeightEntryTiming: number;
  tradeWeightThesis: number;
  minPaperCopyScore: number;
  minWatchlistScore: number;
  maxAllowedPriceDrift: number;
  maxAllowedSpread: number;
  minTradeLiquidityUsd: number;
  maxSnapshotAgeSeconds: number;
  copyDifficultSpreadThreshold: number;
  copyUnfollowableSpreadThreshold: number;
  copyDifficultAdverseDriftThreshold: number;
  copyUnfollowableAdverseDriftThreshold: number;
  copyMinLiquidityThresholdUsd: number;
  freshnessAgingThresholdSeconds: number;
  freshnessStaleThresholdSeconds: number;
  staleMarketDecision: 'watchlist' | 'skip';
  allowWatchWalletCopy: boolean;
  minTimeToResolutionSeconds: number;
  [key: string]: any;
}

export interface RuleSetItem {
  id: string;
  version: string;
  status: 'active' | 'retired' | 'candidate';
  sourceReason: string;
  createdAt: string;
  effectiveAt: string;
  retiredAt?: string | null;
  config: RuleSetConfig;
  parameterMetadata?: Record<string, ParameterProvenance>;
}

export interface RuleChangeItem {
  id: string;
  oldRuleSetId: string;
  newRuleSetId: string;
  changedBy: string;
  reason: string;
  evidenceSummary: string;
  beforeJson: string;
  afterJson: string;
  expectedImprovement: string;
  timestamp: string;
  createdAt: string;
}

export interface RulesResponse {
  activeRuleSet: RuleSetItem;
  allRulesets: RuleSetItem[];
  auditChanges: RuleChangeItem[];
}

export interface DailyReportItem {
  id: string;
  reportDate: string;
  paperPnlToday: number;
  totalPaperPnl: number;
  winRate: number;
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

export interface ReportsResponse {
  reports: DailyReportItem[];
  total: number;
}

export interface EngineControlResponse {
  success: boolean;
  state: 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR' | 'UNKNOWN';
  message: string;
  executionMode: string;
  timestamp: string;
}




