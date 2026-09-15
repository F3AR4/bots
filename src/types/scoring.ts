/**
 * Scoring Interfaces and Factor Breakdown Structures.
 * 
 * Complies with deterministic scoring and explainability requirements.
 * Factors and penalties are represented independently and inspectably.
 */

import {
  WalletStatus,
  TradeDecisionType,
  RoiProvenance,
  DataCompletenessReport,
  OneHitWonderDiagnostics,
  WalletFrequencyMetrics,
  WalletCopyabilityFactors
} from './domain.js';

export interface FactorResult {
  factorName: string;            // e.g. 'roi30d', 'consistency', 'copyability', 'liquidityQuality'
  rawMetric: number;             // Raw observed value (e.g. 1.45 = +145% ROI, or $15,000 liquidity)
  normalizedScore: number;       // Normalized [0-100] score
  weightApplied: number;         // Weight from active RuleSet
  weightedContribution: number;  // (normalizedScore * weightApplied)
  notes: string;                 // Human-readable explanation
}

export interface PenaltyResult {
  penaltyName: string;           // e.g. 'single_trade_concentration', 'illiquid_activity', 'excessive_post_entry_drift', etc.
  triggered: boolean;            // True if condition met
  penaltyDeduction: number;      // Points deducted from score [0-100]
  evidence: string;              // Evidence supporting the penalty trigger
}

export interface WalletScoreResult {
  walletAddress: string;
  ruleSetId: string;
  factorResults: FactorResult[];
  penalties: PenaltyResult[];
  rawCompositeScore: number;     // Sum of weighted factors
  totalPenaltyDeduction: number; // Sum of active penalties
  finalTotalScore: number;       // Math.max(0, rawCompositeScore - totalPenaltyDeduction)
  status: WalletStatus;          // 'track' | 'watch' | 'ignore'
  statusReasons: string[];       // Explicit explanations
  roiProvenance?: RoiProvenance;
  dataCompleteness?: DataCompletenessReport;
  oneHitWonderDiagnostics?: OneHitWonderDiagnostics;
  frequencyMetrics?: WalletFrequencyMetrics;
  copyabilityFactors?: WalletCopyabilityFactors;
  generatedAt: string;           // ISO-8601
}

export interface TradeFactorResult {
  dimension: string;             // e.g. 'walletQuality', 'categoryFit', 'priceMovement', 'spread', 'liquidity', 'entryTiming', 'thesis'
  rawMetric: number | string;
  normalizedScore: number;       // [0-100]
  weightApplied: number;
  weightedContribution: number;
  notes: string;
}

export interface TradeScoreResult {
  observedTradeId: string;
  marketSnapshotId: string;
  walletAddress: string;
  marketId: string;
  ruleSetId: string;
  factorResults: TradeFactorResult[];
  compositeCopyScore: number;    // [0-100]
  confidence: number;            // [0-1]
  decision: TradeDecisionType;   // 'paper_copy' | 'watchlist' | 'skip'
  reasons: string[];
  risks: string[];
  simulatedPositionSize: number; // $5.00 to $20.00 for paper_copy, 0 for watchlist/skip
  generatedAt: string;
}
