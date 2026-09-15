/**
 * Walk-Forward Validation Engine.
 * 
 * Safety & Invariant Guarantees:
 * - Candidate RuleSets are strictly evaluated on out-of-sample observations.
 * - Out-of-sample data is strictly partitioned by timestamp to prevent data leakage.
 * - Compares candidate performance against the active baseline RuleSet.
 * - Emits deterministic promotion or rejection verdicts with full statistical justification.
 */

import {
  RuleSet,
  CalibrationDataset,
  CalibrationSample,
  WalkForwardResult,
  EvidenceTier,
  RuleLearningConfig
} from '../types/domain.js';
import { DEFAULT_RULE_LEARNING_CONFIG } from '../config/learning.default.js';

export class WalkForwardValidator {
  constructor(private config: RuleLearningConfig = DEFAULT_RULE_LEARNING_CONFIG) {}

  /**
   * Partitions dataset into Train and Out-of-Sample Validation windows and evaluates candidate RuleSet.
   */
  public validate(
    activeRuleSet: RuleSet,
    candidateRuleSet: RuleSet,
    dataset: CalibrationDataset
  ): WalkForwardResult {
    const samples = [...dataset.samples].sort((a, b) => {
      const timeA = new Date(a.observedTrade.sourceTimestamp).getTime();
      const timeB = new Date(b.observedTrade.sourceTimestamp).getTime();
      return timeA - timeB;
    });

    const totalCount = samples.length;
    const splitIndex = Math.max(1, Math.floor(totalCount * this.config.trainWindowRatio));

    const trainSamples = samples.slice(0, splitIndex);
    const validationSamples = samples.slice(splitIndex);

    const trainStart = trainSamples.length > 0 ? trainSamples[0].observedTrade.sourceTimestamp : dataset.windowStart;
    const trainEnd = trainSamples.length > 0 ? trainSamples[trainSamples.length - 1].observedTrade.sourceTimestamp : dataset.windowStart;
    const valStart = validationSamples.length > 0 ? validationSamples[0].observedTrade.sourceTimestamp : trainEnd;
    const valEnd = validationSamples.length > 0 ? validationSamples[validationSamples.length - 1].observedTrade.sourceTimestamp : dataset.windowEnd;

    // Check validation sample sufficiency
    if (validationSamples.length < this.config.minValidationTrades) {
      return {
        candidateRuleSetId: candidateRuleSet.id,
        trainWindowStart: trainStart,
        trainWindowEnd: trainEnd,
        validationWindowStart: valStart,
        validationWindowEnd: valEnd,
        trainTradesCount: trainSamples.length,
        validationTradesCount: validationSamples.length,
        candidateValidationPnl: 0,
        activeValidationPnl: 0,
        candidateWinRate: 0,
        activeWinRate: 0,
        pnlImprovementDelta: 0,
        winRateImprovementDelta: 0,
        badCopyReduction: 0,
        lateEntryLossReduction: 0,
        spreadLossReduction: 0,
        isPromoted: false,
        rejectionReasons: [
          `Insufficient validation samples (${validationSamples.length} < required ${this.config.minValidationTrades})`
        ],
        validationTier: 'INSUFFICIENT'
      };
    }

    // Evaluate both RuleSets deterministically on out-of-sample validation data
    let activePnl = 0;
    let candidatePnl = 0;
    let activeWins = 0;
    let activeTradesCount = 0;
    let candidateWins = 0;
    let candidateTradesCount = 0;
    let activeBadCopies = 0;
    let candidateBadCopies = 0;
    let activeLateLosses = 0;
    let candidateLateLosses = 0;
    let activeSpreadLosses = 0;
    let candidateSpreadLosses = 0;

    for (const sample of validationSamples) {
      // Evaluate with Active RuleSet
      const activeDecision = this.simulateDecision(activeRuleSet, sample);
      // Evaluate with Candidate RuleSet
      const candidateDecision = this.simulateDecision(candidateRuleSet, sample);

      const sampleRealizedPnl = sample.paperTrade?.realizedPnl ?? sample.realizedPnl ?? (sample.outcomeReviews[0]?.simulatedPnlAtMilestone ?? 0);
      const isWin = sample.outcome === 'WIN' || sampleRealizedPnl > 0;
      const isLoss = sample.outcome === 'LOSS' || sampleRealizedPnl < 0;

      // Active RuleSet outcome
      if (activeDecision === 'paper_copy') {
        activeTradesCount++;
        activePnl += sampleRealizedPnl;
        if (isWin) activeWins++;
        if (isLoss) {
          activeBadCopies++;
          if (sample.spread > activeRuleSet.config.maxAllowedSpread * 0.75) activeSpreadLosses += Math.abs(sampleRealizedPnl);
          if ((sample.observedTrade.detectedPrice - sample.observedTrade.walletEntryPrice) > activeRuleSet.config.maxAllowedPriceDrift * 0.6) {
            activeLateLosses += Math.abs(sampleRealizedPnl);
          }
        }
      }

      // Candidate RuleSet outcome
      if (candidateDecision === 'paper_copy') {
        candidateTradesCount++;
        candidatePnl += sampleRealizedPnl;
        if (isWin) candidateWins++;
        if (isLoss) {
          candidateBadCopies++;
          if (sample.spread > candidateRuleSet.config.maxAllowedSpread * 0.75) candidateSpreadLosses += Math.abs(sampleRealizedPnl);
          if ((sample.observedTrade.detectedPrice - sample.observedTrade.walletEntryPrice) > candidateRuleSet.config.maxAllowedPriceDrift * 0.6) {
            candidateLateLosses += Math.abs(sampleRealizedPnl);
          }
        }
      }
    }

    const activeWinRate = activeTradesCount > 0 ? activeWins / activeTradesCount : 0;
    const candidateWinRate = candidateTradesCount > 0 ? candidateWins / candidateTradesCount : 0;
    const pnlImprovementDelta = Math.round((candidatePnl - activePnl) * 100) / 100;
    const winRateImprovementDelta = Math.round((candidateWinRate - activeWinRate) * 1000) / 1000;
    const badCopyReduction = activeBadCopies - candidateBadCopies;
    const lateEntryLossReduction = Math.round((activeLateLosses - candidateLateLosses) * 100) / 100;
    const spreadLossReduction = Math.round((activeSpreadLosses - candidateSpreadLosses) * 100) / 100;

    const rejectionReasons: string[] = [];

    // Check promotion criteria:
    // 1. Candidate PnL must be >= Active PnL (or delta >= minValidationImprovementPercent)
    if (pnlImprovementDelta < this.config.minValidationImprovementPercent) {
      rejectionReasons.push(
        `Candidate out-of-sample PnL ($${candidatePnl.toFixed(2)}) did not improve upon active baseline ($${activePnl.toFixed(2)}). Delta: $${pnlImprovementDelta.toFixed(2)}`
      );
    }

    // 2. Candidate Win Rate must not degrade significantly (e.g. win rate delta >= -0.05)
    if (candidateTradesCount > 0 && winRateImprovementDelta < -0.05) {
      rejectionReasons.push(
        `Candidate win rate (${(candidateWinRate * 100).toFixed(1)}%) degraded significantly vs active (${(activeWinRate * 100).toFixed(1)}%)`
      );
    }

    // 3. Must not generate 0 trades if active generated healthy trades
    if (candidateTradesCount === 0 && activeTradesCount >= 5) {
      rejectionReasons.push(
        'Candidate rule set over-filtered all trades in validation window, producing zero copies.'
      );
    }

    let validationTier: EvidenceTier = 'INSUFFICIENT';
    if (validationSamples.length >= 15) {
      validationTier = 'STRONG';
    } else if (validationSamples.length >= 8) {
      validationTier = 'MODERATE';
    } else if (validationSamples.length >= 3) {
      validationTier = 'WEAK';
    }

    const isPromoted = rejectionReasons.length === 0;

    return {
      candidateRuleSetId: candidateRuleSet.id,
      trainWindowStart: trainStart,
      trainWindowEnd: trainEnd,
      validationWindowStart: valStart,
      validationWindowEnd: valEnd,
      trainTradesCount: trainSamples.length,
      validationTradesCount: validationSamples.length,
      candidateValidationPnl: Math.round(candidatePnl * 100) / 100,
      activeValidationPnl: Math.round(activePnl * 100) / 100,
      candidateWinRate: Math.round(candidateWinRate * 1000) / 1000,
      activeWinRate: Math.round(activeWinRate * 1000) / 1000,
      pnlImprovementDelta,
      winRateImprovementDelta,
      badCopyReduction,
      lateEntryLossReduction,
      spreadLossReduction,
      isPromoted,
      rejectionReasons,
      validationTier
    };
  }

  /**
   * Deterministically evaluates decision for a sample using given RuleSet.
   */
  private simulateDecision(ruleSet: RuleSet, sample: CalibrationSample): 'paper_copy' | 'watchlist' | 'skip' {
    // Check drift
    const drift = sample.observedTrade.detectedPrice - sample.observedTrade.walletEntryPrice;
    if (drift > ruleSet.config.maxAllowedPriceDrift) {
      return 'skip';
    }

    // Check spread
    if (sample.spread > ruleSet.config.maxAllowedSpread) {
      return 'skip';
    }

    // Check liquidity
    if (sample.liquidity < ruleSet.config.minTradeLiquidityUsd) {
      return 'skip';
    }

    // Check wallet score if evaluation exists
    if (sample.walletEvaluationAtDecision) {
      if (sample.walletEvaluationAtDecision.finalScore < ruleSet.config.walletTrackCutoffScore) {
        return 'watchlist';
      }
    }

    // Score trade with DeterministicScoringEngine
    const factors = {
      walletQuality: sample.decisionFactors?.walletQuality ?? 75,
      categoryFit: sample.decisionFactors?.categoryFit ?? 75,
      priceMovement: sample.decisionFactors?.priceMovement ?? 80,
      spread: sample.decisionFactors?.spread ?? 80,
      liquidity: sample.decisionFactors?.liquidity ?? 80,
      entryTiming: sample.decisionFactors?.entryTiming ?? 80,
      thesis: sample.decisionFactors?.thesis ?? 80
    };

    const weightedScore = (
      factors.walletQuality * ruleSet.config.tradeWeightWalletQuality +
      factors.categoryFit * ruleSet.config.tradeWeightCategoryFit +
      factors.priceMovement * ruleSet.config.tradeWeightPriceMovement +
      factors.spread * ruleSet.config.tradeWeightSpread +
      factors.liquidity * ruleSet.config.tradeWeightLiquidity +
      factors.entryTiming * ruleSet.config.tradeWeightEntryTiming +
      factors.thesis * ruleSet.config.tradeWeightThesis
    );

    if (weightedScore >= ruleSet.config.minPaperCopyScore) {
      return 'paper_copy';
    } else if (weightedScore >= ruleSet.config.minWatchlistScore) {
      return 'watchlist';
    } else {
      return 'skip';
    }
  }
}
