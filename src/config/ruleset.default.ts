/**
 * Default RuleSet (v1.0.0).
 * 
 * Safety & Integrity Guarantee:
 * - simulatedBetMin ($5.00) and simulatedBetMax ($20.00) are strictly EXPLICIT from the PDF.
 * - All other weights, cutoffs, and thresholds are PROVISIONAL IMPLEMENTATION BASELINES
 *   (or empirical data-quality conventions). They are NOT specified by the supplied PDF.
 * - Every parameter is tagged with full provenance metadata for complete auditability.
 */

import { RuleSet, RuleSetConfig, ParameterProvenance } from '../types/domain.js';

export const DEFAULT_RULESET_CONFIG: RuleSetConfig = {
  // [PDF_EXPLICIT] Strictly defined in supplied PDF logic spec
  simulatedBetMin: 5.0,
  simulatedBetMax: 20.0,

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Discovery & Filtering Thresholds
  minDiscoveryLiquidityUsd: 500.0,
  minResolvedTradesCount: 5,
  minCategoryResolvedTradesCount: 3,
  maxSingleMarketEdgeTrades: 2,

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] One-Hit-Wonder Penalty Parameters & Deductions
  singleTradeProfitConcentrationThreshold: 0.80, // Flag if >=80% profit from 1 trade
  minLiquidityQualityUsd: 1000.0,
  maxHistoricalSpread: 0.05,                     // 5 cents
  penaltySingleTradeConcentrationDeduction: 30.0, // Deduct 30 pts if profit concentrated
  penaltyIlliquidActivityDeduction: 25.0,         // Deduct 25 pts if liquidity below standard
  penaltyInsufficientResolvedTradesDeduction: 20.0, // Deduct 20 pts if thin history
  penaltyWideHistoricalSpreadDeduction: 15.0,       // Deduct 15 pts if spread wide
  penaltySingleMarketEdgeDeduction: 20.0,           // Deduct 20 pts if edge in only one market
  penaltyUnfollowablePricingDeduction: 20.0,        // Deduct 20 pts if extreme adverse pricing
  penaltyExcessivePostEntryMovementDeduction: 15.0, // Deduct 15 pts if adverse post-entry drift

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Pricing & Slippage Sensitivity Bounds
  extremePriceLowerBound: 0.05,
  extremePriceUpperBound: 0.95,
  unfollowablePricingThreshold: 0.50,
  adverseDriftThreshold: 0.40,
  fallbackUnobservedLiquidityUsd: 5000.0,
  fallbackUnobservedSpread: 0.02,

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Normalization & Qualitative Fallbacks
  roiTargetBenchmarkUsd: 10000.0,                // $10,000 profit = 100 normalized ROI score
  defaultWalletEntryTimingScore: 80.0,           // Baseline timing score if unobserved
  defaultTradeEntryTimingScore: 85.0,            // Baseline trade timing score
  defaultThesisScore: 80.0,                      // Baseline thesis score

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Wallet Scoring Dimension Weights (Sum = 1.0)
  walletWeightRoi: 0.25,
  walletWeightConsistency: 0.25,
  walletWeightCopyability: 0.20,
  walletWeightCategoryEdge: 0.15,
  walletWeightLiquidity: 0.10,
  walletWeightEntryTiming: 0.05,

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Wallet Status Thresholds
  walletTrackCutoffScore: 70.0,
  walletWatchCutoffScore: 45.0,

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Evidence Tier Thresholds (Data-Quality Conventions)
  evidenceTierHighThreshold: 75.0,
  evidenceTierModerateThreshold: 50.0,
  evidenceTierLowThreshold: 25.0,
  evidenceMinTradesHigh: 10,
  evidenceMinTradesModerate: 5,
  evidenceMinTradesLow: 3,

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Trade Scoring Dimension Weights (Sum = 1.0)
  tradeWeightWalletQuality: 0.25,
  tradeWeightCategoryFit: 0.15,
  tradeWeightPriceMovement: 0.20,
  tradeWeightSpread: 0.15,
  tradeWeightLiquidity: 0.10,
  tradeWeightEntryTiming: 0.10,
  tradeWeightThesis: 0.05,

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Trade Decision Cutoffs
  minPaperCopyScore: 75.0,
  minWatchlistScore: 50.0,
  maxAllowedPriceDrift: 0.03,  // 3 cents maximum post-entry drift
  maxAllowedSpread: 0.04,      // 4 cents maximum spread
  minTradeLiquidityUsd: 500.0, // $500 minimum top-of-book depth

  // [IMPLEMENTATION_BASELINE - NOT FROM PDF] Historical Copyability Research Parameters
  maxSnapshotAgeSeconds: 60,                   // 60s freshness tolerance
  copyDifficultSpreadThreshold: 0.04,         // $0.04 spread boundary for difficult copy
  copyUnfollowableSpreadThreshold: 0.08,       // $0.08 spread boundary for unfollowable copy
  copyDifficultAdverseDriftThreshold: 0.03,    // $0.03 adverse drift boundary
  copyUnfollowableAdverseDriftThreshold: 0.06, // $0.06 adverse drift boundary
  copyMinLiquidityThresholdUsd: 500.0,         // $500 minimum top-of-book depth

  // Real-Time Monitoring Parameters (Task 1.6)
  freshnessAgingThresholdSeconds: 60,          // 60s snapshot age threshold for AGING
  freshnessStaleThresholdSeconds: 300,         // 300s snapshot age threshold for STALE
  staleMarketDecision: 'watchlist',            // Degrade stale markets to watchlist
  allowWatchWalletCopy: false,                 // WATCH status wallets cannot generate paper trades
  minTimeToResolutionSeconds: 3600             // 3600s (1h) minimum time to resolution
};

export const DEFAULT_RULESET_PARAMETER_METADATA: Record<string, ParameterProvenance> = {
  simulatedBetMin: {
    key: 'simulatedBetMin',
    value: 5.0,
    sourceType: 'PDF_EXPLICIT',
    sourceReference: 'Supplied PDF Page 3 Section 6',
    status: 'ACTIVE',
    affectsDecisions: true,
    description: 'Minimum simulated position size per trade ($5.00)'
  },
  simulatedBetMax: {
    key: 'simulatedBetMax',
    value: 20.0,
    sourceType: 'PDF_EXPLICIT',
    sourceReference: 'Supplied PDF Page 3 Section 6',
    status: 'ACTIVE',
    affectsDecisions: true,
    description: 'Maximum simulated position size per trade ($20.00)'
  },
  minDiscoveryLiquidityUsd: {
    key: 'minDiscoveryLiquidityUsd',
    value: 500.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum market top-of-book depth required to observe or discover a trade ($500.00)'
  },
  minResolvedTradesCount: {
    key: 'minResolvedTradesCount',
    value: 5,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum resolved trades required to avoid insufficient-history penalty (5 trades)'
  },
  minCategoryResolvedTradesCount: {
    key: 'minCategoryResolvedTradesCount',
    value: 3,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum resolved trades required in a specific category to qualify as domain edge (3 trades)'
  },
  maxSingleMarketEdgeTrades: {
    key: 'maxSingleMarketEdgeTrades',
    value: 2,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Maximum resolved trades in a single market before flag for localized edge (<= 2 trades)'
  },
  singleTradeProfitConcentrationThreshold: {
    key: 'singleTradeProfitConcentrationThreshold',
    value: 0.80,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF requires penalizing one-hit-wonders but specifies no number',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Fraction of total profit originating from single largest win that triggers concentration penalty (0.80)'
  },
  minLiquidityQualityUsd: {
    key: 'minLiquidityQualityUsd',
    value: 1000.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Liquidity benchmark for assessing historical trade quality ($1,000.00)'
  },
  maxHistoricalSpread: {
    key: 'maxHistoricalSpread',
    value: 0.05,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Historical bid-ask spread ceiling beyond which penalty is triggered ($0.05)'
  },
  penaltySingleTradeConcentrationDeduction: {
    key: 'penaltySingleTradeConcentrationDeduction',
    value: 30.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Score deduction applied when single-trade profit concentration threshold is breached (30.0 pts)'
  },
  penaltyIlliquidActivityDeduction: {
    key: 'penaltyIlliquidActivityDeduction',
    value: 25.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Score deduction applied when wallet trades predominantly in thin illiquid books (25.0 pts)'
  },
  penaltyInsufficientResolvedTradesDeduction: {
    key: 'penaltyInsufficientResolvedTradesDeduction',
    value: 20.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Score deduction applied when wallet has fewer than minResolvedTradesCount (20.0 pts)'
  },
  penaltyWideHistoricalSpreadDeduction: {
    key: 'penaltyWideHistoricalSpreadDeduction',
    value: 15.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Score deduction applied when average spread exceeds maxHistoricalSpread (15.0 pts)'
  },
  penaltySingleMarketEdgeDeduction: {
    key: 'penaltySingleMarketEdgeDeduction',
    value: 20.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Score deduction applied when wallet edge is localized to a single isolated market (20.0 pts)'
  },
  penaltyUnfollowablePricingDeduction: {
    key: 'penaltyUnfollowablePricingDeduction',
    value: 20.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Score deduction applied when entries concentrate at extreme probabilities (20.0 pts)'
  },
  penaltyExcessivePostEntryMovementDeduction: {
    key: 'penaltyExcessivePostEntryMovementDeduction',
    value: 15.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Score deduction applied when excessive post-entry adverse price slippage occurs (15.0 pts)'
  },
  extremePriceLowerBound: {
    key: 'extremePriceLowerBound',
    value: 0.05,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Lower boundary for extreme/unfollowable pricing (0.05)'
  },
  extremePriceUpperBound: {
    key: 'extremePriceUpperBound',
    value: 0.95,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Upper boundary for extreme/unfollowable pricing (0.95)'
  },
  unfollowablePricingThreshold: {
    key: 'unfollowablePricingThreshold',
    value: 0.50,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Ratio of extreme trades required to trigger unfollowable pricing penalty (0.50)'
  },
  adverseDriftThreshold: {
    key: 'adverseDriftThreshold',
    value: 0.40,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Ratio of trades with adverse post-entry slippage to trigger penalty (0.40)'
  },
  fallbackUnobservedLiquidityUsd: {
    key: 'fallbackUnobservedLiquidityUsd',
    value: 5000.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Default liquidity assumed when contemporaneous orderbook snapshot is absent ($5,000.00)'
  },
  fallbackUnobservedSpread: {
    key: 'fallbackUnobservedSpread',
    value: 0.02,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Default spread assumed when contemporaneous orderbook snapshot is absent ($0.02)'
  },
  roiTargetBenchmarkUsd: {
    key: 'roiTargetBenchmarkUsd',
    value: 10000.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Invented normalization target, not from PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Benchmark dollar profit mapping to 100 normalized ROI score ($10,000.00)'
  },
  defaultWalletEntryTimingScore: {
    key: 'defaultWalletEntryTimingScore',
    value: 80.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Default neutral score for wallet entry timing when unobserved (80.0 pts)'
  },
  defaultTradeEntryTimingScore: {
    key: 'defaultTradeEntryTimingScore',
    value: 85.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Default score for trade entry timing evaluation (85.0 pts)'
  },
  defaultThesisScore: {
    key: 'defaultThesisScore',
    value: 80.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Not specified in PDF',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Default qualitative thesis score (80.0 pts)'
  },
  walletWeightRoi: {
    key: 'walletWeightRoi',
    value: 0.25,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF specifies ROI dimension but not numeric weight',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Composite weight assigned to 30-day ROI factor (0.25)'
  },
  walletWeightConsistency: {
    key: 'walletWeightConsistency',
    value: 0.25,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF specifies consistency dimension but not numeric weight',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Composite weight assigned to win rate/consistency factor (0.25)'
  },
  walletWeightCopyability: {
    key: 'walletWeightCopyability',
    value: 0.20,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF specifies copyability dimension but not numeric weight',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Composite weight assigned to copyability factor (0.20)'
  },
  walletWeightCategoryEdge: {
    key: 'walletWeightCategoryEdge',
    value: 0.15,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF specifies category domain edge but not numeric weight',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Composite weight assigned to category edge factor (0.15)'
  },
  walletWeightLiquidity: {
    key: 'walletWeightLiquidity',
    value: 0.10,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF specifies liquidity check but not numeric weight',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Composite weight assigned to liquidity quality factor (0.10)'
  },
  walletWeightEntryTiming: {
    key: 'walletWeightEntryTiming',
    value: 0.05,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF mentions entry timing but not numeric weight',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Composite weight assigned to entry timing factor (0.05)'
  },
  walletTrackCutoffScore: {
    key: 'walletTrackCutoffScore',
    value: 70.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF defines TRACK classification concept but not cutoff score',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum final composite score to classify wallet as TRACK (70.0 pts)'
  },
  walletWatchCutoffScore: {
    key: 'walletWatchCutoffScore',
    value: 45.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - PDF defines WATCH classification concept but not cutoff score',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum final composite score to classify wallet as WATCH (45.0 pts)'
  },
  evidenceTierHighThreshold: {
    key: 'evidenceTierHighThreshold',
    value: 75.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Data Quality Convention - Research completeness metric, not trading skill',
    status: 'PROVISIONAL',
    affectsDecisions: false,
    description: 'Evidence score threshold for HIGH_EVIDENCE tier (75.0)'
  },
  evidenceTierModerateThreshold: {
    key: 'evidenceTierModerateThreshold',
    value: 50.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Data Quality Convention - Research completeness metric, not trading skill',
    status: 'PROVISIONAL',
    affectsDecisions: false,
    description: 'Evidence score threshold for MODERATE_EVIDENCE tier (50.0)'
  },
  evidenceTierLowThreshold: {
    key: 'evidenceTierLowThreshold',
    value: 25.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Data Quality Convention - Research completeness metric, not trading skill',
    status: 'PROVISIONAL',
    affectsDecisions: false,
    description: 'Evidence score threshold for LOW_EVIDENCE tier (25.0)'
  },
  evidenceMinTradesHigh: {
    key: 'evidenceMinTradesHigh',
    value: 10,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Data Quality Convention - Research completeness metric',
    status: 'PROVISIONAL',
    affectsDecisions: false,
    description: 'Minimum resolved trades for HIGH_EVIDENCE tier (10 trades)'
  },
  evidenceMinTradesModerate: {
    key: 'evidenceMinTradesModerate',
    value: 5,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Data Quality Convention - Research completeness metric',
    status: 'PROVISIONAL',
    affectsDecisions: false,
    description: 'Minimum resolved trades for MODERATE_EVIDENCE tier (5 trades)'
  },
  evidenceMinTradesLow: {
    key: 'evidenceMinTradesLow',
    value: 3,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Data Quality Convention - Research completeness metric',
    status: 'PROVISIONAL',
    affectsDecisions: false,
    description: 'Minimum trades for LOW_EVIDENCE tier (3 trades)'
  },
  tradeWeightWalletQuality: {
    key: 'tradeWeightWalletQuality',
    value: 0.25,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Trade decision weighting',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Weight of wallet quality in trade copying decision (0.25)'
  },
  tradeWeightCategoryFit: {
    key: 'tradeWeightCategoryFit',
    value: 0.15,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Trade decision weighting',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Weight of category fit in trade copying decision (0.15)'
  },
  tradeWeightPriceMovement: {
    key: 'tradeWeightPriceMovement',
    value: 0.20,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Trade decision weighting',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Weight of price movement in trade copying decision (0.20)'
  },
  tradeWeightSpread: {
    key: 'tradeWeightSpread',
    value: 0.15,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Trade decision weighting',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Weight of spread in trade copying decision (0.15)'
  },
  tradeWeightLiquidity: {
    key: 'tradeWeightLiquidity',
    value: 0.10,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Trade decision weighting',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Weight of liquidity in trade copying decision (0.10)'
  },
  tradeWeightEntryTiming: {
    key: 'tradeWeightEntryTiming',
    value: 0.10,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Trade decision weighting',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Weight of entry timing in trade copying decision (0.10)'
  },
  tradeWeightThesis: {
    key: 'tradeWeightThesis',
    value: 0.05,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Trade decision weighting',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Weight of qualitative thesis in trade copying decision (0.05)'
  },
  minPaperCopyScore: {
    key: 'minPaperCopyScore',
    value: 75.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Decision cutoff',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum score to trigger paper_copy simulation (75.0 pts)'
  },
  minWatchlistScore: {
    key: 'minWatchlistScore',
    value: 50.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Decision cutoff',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum score to trigger watchlist placement (50.0 pts)'
  },
  maxAllowedPriceDrift: {
    key: 'maxAllowedPriceDrift',
    value: 0.03,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Drift cutoff',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Maximum allowable post-entry price drift before skipping ($0.03)'
  },
  maxAllowedSpread: {
    key: 'maxAllowedSpread',
    value: 0.04,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Spread cutoff',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Maximum allowable bid-ask spread before skipping ($0.04)'
  },
  minTradeLiquidityUsd: {
    key: 'minTradeLiquidityUsd',
    value: 500.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.3 Baseline - Liquidity cutoff',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum required book liquidity before skipping ($500.00)'
  },
  maxSnapshotAgeSeconds: {
    key: 'maxSnapshotAgeSeconds',
    value: 60,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.5 Research Baseline - Snapshot Freshness',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Maximum allowable snapshot age in seconds before classifying as STALE_SNAPSHOT (60s)'
  },
  copyDifficultSpreadThreshold: {
    key: 'copyDifficultSpreadThreshold',
    value: 0.04,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.5 Research Baseline - Spread Classification',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Spread threshold in USD for DIFFICULT copyability ($0.04)'
  },
  copyUnfollowableSpreadThreshold: {
    key: 'copyUnfollowableSpreadThreshold',
    value: 0.08,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.5 Research Baseline - Spread Classification',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Spread threshold in USD for UNFOLLOWABLE copyability ($0.08)'
  },
  copyDifficultAdverseDriftThreshold: {
    key: 'copyDifficultAdverseDriftThreshold',
    value: 0.03,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.5 Research Baseline - Drift Classification',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Adverse price drift threshold in USD for DIFFICULT copyability ($0.03)'
  },
  copyUnfollowableAdverseDriftThreshold: {
    key: 'copyUnfollowableAdverseDriftThreshold',
    value: 0.06,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.5 Research Baseline - Drift Classification',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Adverse price drift threshold in USD for UNFOLLOWABLE copyability ($0.06)'
  },
  copyMinLiquidityThresholdUsd: {
    key: 'copyMinLiquidityThresholdUsd',
    value: 500.0,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.5 Research Baseline - Liquidity Classification',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum required top-of-book liquidity in USD for COPYABLE status ($500.00)'
  },
  freshnessAgingThresholdSeconds: {
    key: 'freshnessAgingThresholdSeconds',
    value: 60,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.6 Baseline - Freshness Classification',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Threshold in seconds after which a market snapshot is considered AGING (60s)'
  },
  freshnessStaleThresholdSeconds: {
    key: 'freshnessStaleThresholdSeconds',
    value: 300,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.6 Baseline - Freshness Classification',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Threshold in seconds after which a market snapshot is considered STALE (300s)'
  },
  staleMarketDecision: {
    key: 'staleMarketDecision',
    value: 'watchlist',
    sourceType: 'OPERATOR_CONFIG',
    sourceReference: 'Task 1.6 Baseline - Safety Degrade Policy',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Decision verdict fallback when snapshot is stale (watchlist)'
  },
  allowWatchWalletCopy: {
    key: 'allowWatchWalletCopy',
    value: false,
    sourceType: 'OPERATOR_CONFIG',
    sourceReference: 'Task 1.6 Operator Policy - Only TRACK wallets are actively copy-traded',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Whether wallets with WATCH status can trigger paper trades (strictly false by default)'
  },
  minTimeToResolutionSeconds: {
    key: 'minTimeToResolutionSeconds',
    value: 3600,
    sourceType: 'IMPLEMENTATION_BASELINE',
    sourceReference: 'Task 1.6 Baseline - Resolution Volatility Filter',
    status: 'PROVISIONAL',
    affectsDecisions: true,
    description: 'Minimum seconds remaining until market resolution to allow copying (3600s / 1h)'
  }
};

export const DEFAULT_RULESET: RuleSet = {
  id: 'ruleset-v1.0.0-initial',
  version: '1.0.0',
  status: 'active',
  sourceReason: 'Initial baseline RuleSet extracted from Task 0 specification with configurable TBD placeholders and explicit parameter provenance.',
  createdAt: '2026-09-14T00:00:00.000Z',
  effectiveAt: '2026-09-14T00:00:00.000Z',
  retiredAt: null,
  config: DEFAULT_RULESET_CONFIG,
  parameterMetadata: DEFAULT_RULESET_PARAMETER_METADATA
};
