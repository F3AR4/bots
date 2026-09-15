/**
 * Benchmark Cohort Engine.
 * 
 * Compares 4 distinct cohorts:
 * 1. Bot-filtered paper trades ('paper_copy')
 * 2. Blind leaderboard copy ('blind_leaderboard')
 * 3. Watchlist trades ('watchlist')
 * 4. Skipped trades ('skipped')
 * 
 * Evaluates:
 * - Realized / Unrealized PnL, Win Rate, Median PnL, Max Drawdown, Profit Factor
 * - Missed winners, Avoided losers, Bad copies, Good skips, Late entries avoided, Spread losses avoided.
 * - Explicit INSUFFICIENT_DATA states when evidence is below configurable minimums.
 */

import {
  DecisionJournal,
  BenchmarkComparison,
  BenchmarkCohort,
  CalibrationSample,
  CohortMetrics,
  FourCohortBenchmarkResult,
  EvidenceTier,
  RuleLearningConfig
} from '../types/domain.js';
import { DEFAULT_RULE_LEARNING_CONFIG } from '../config/learning.default.js';

export interface EvaluatedDecisionItem {
  journal: DecisionJournal;
  hypotheticalPnl: number;
  marketOutcomeWon: boolean;
  spreadAtEntry: number;
  entryDrift: number;
}

export class BenchmarkEngine {
  /**
   * Evaluates comprehensive 4-cohort benchmark statistics from a CalibrationSample collection.
   */
  public static evaluateFourCohorts(
    samples: CalibrationSample[],
    config: RuleLearningConfig = DEFAULT_RULE_LEARNING_CONFIG,
    dataMode: 'OBSERVED_EMPIRICAL' | 'HISTORICAL_HYPOTHETICAL' | 'SYNTHETIC_FIXTURE' = 'OBSERVED_EMPIRICAL'
  ): FourCohortBenchmarkResult {
    const paperCopySamples = samples.filter(s => s.decision === 'paper_copy');
    const blindLeaderboardSamples = [...samples]; // Every trade is evaluated as if blindly copied
    const watchlistSamples = samples.filter(s => s.decision === 'watchlist');
    const skippedSamples = samples.filter(s => s.decision === 'skip');

    const minFloor = config.minEvidenceTradesWeak;

    const paperMetrics = this.computeCohortMetrics('paper_copy', paperCopySamples, samples, minFloor);
    const blindMetrics = this.computeCohortMetrics('blind_leaderboard', blindLeaderboardSamples, samples, minFloor);
    const watchlistMetrics = this.computeCohortMetrics('watchlist', watchlistSamples, samples, minFloor);
    const skippedMetrics = this.computeCohortMetrics('skipped', skippedSamples, samples, minFloor);

    // Calculate evidence tier
    let evidenceTier: EvidenceTier = 'INSUFFICIENT';
    if (samples.length >= config.minEvidenceTradesStrong) {
      evidenceTier = 'STRONG';
    } else if (samples.length >= config.minEvidenceTradesModerate) {
      evidenceTier = 'MODERATE';
    } else if (samples.length >= config.minEvidenceTradesWeak) {
      evidenceTier = 'WEAK';
    } else {
      evidenceTier = 'INSUFFICIENT';
    }

    const state = samples.length === 0
      ? 'INSUFFICIENT_DATA'
      : (evidenceTier === 'INSUFFICIENT' ? 'INSUFFICIENT_DATA' : 'CALIBRATION_READY');

    const paperVsBlindPnlDelta = Math.round((paperMetrics.totalPnl - blindMetrics.totalPnl) * 100) / 100;
    const badCopyRate = paperMetrics.sampleCount > 0
      ? Math.round((paperMetrics.badCopyCount / paperMetrics.sampleCount) * 1000) / 1000
      : 0;
    const goodSkipRate = skippedMetrics.sampleCount > 0
      ? Math.round((skippedMetrics.goodSkipCount / skippedMetrics.sampleCount) * 1000) / 1000
      : 0;
    const avoidedLossRatio = blindMetrics.totalPnl < 0 && paperMetrics.avoidedLossValue > 0
      ? Math.round((paperMetrics.avoidedLossValue / Math.abs(blindMetrics.totalPnl)) * 1000) / 1000
      : 0;

    return {
      state,
      paperCopy: paperMetrics,
      blindLeaderboard: blindMetrics,
      watchlist: watchlistMetrics,
      skipped: skippedMetrics,
      comparisonSummary: {
        paperVsBlindPnlDelta,
        avoidedLossRatio,
        badCopyRate,
        goodSkipRate,
        evidenceTier
      },
      generatedAt: new Date().toISOString(),
      dataMode
    };
  }

  private static computeCohortMetrics(
    cohort: BenchmarkCohort,
    cohortSamples: CalibrationSample[],
    allSamples: CalibrationSample[],
    minEvidenceFloor: number
  ): CohortMetrics {
    const sampleCount = cohortSamples.length;

    if (sampleCount === 0) {
      return {
        cohort,
        sampleCount: 0,
        winRate: null,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalPnl: 0,
        averagePnlPerTrade: null,
        medianPnlPerTrade: null,
        maxDrawdown: 0,
        profitFactor: null,
        avoidedLossValue: 0,
        missedWinnerValue: 0,
        badCopyCount: 0,
        goodSkipCount: 0,
        lateEntryLosses: 0,
        spreadLosses: 0,
        lateEntriesAvoidedCount: 0,
        spreadLossesAvoidedCount: 0,
        dataStatus: 'INSUFFICIENT_DATA',
        dataReason: 'Zero trade samples observed in cohort'
      };
    }

    let realizedPnl = 0;
    let unrealizedPnl = 0;
    let wins = 0;
    let losses = 0;
    let totalGain = 0;
    let totalLossAbs = 0;
    const pnlValues: number[] = [];
    let runningPnl = 0;
    let peakPnl = 0;
    let maxDrawdown = 0;

    let badCopies = 0;
    let lateEntryLosses = 0;
    let spreadLosses = 0;

    for (const sample of cohortSamples) {
      let pnl = 0;
      if (sample.paperTrade) {
        if (sample.paperTrade.status === 'resolved' || sample.paperTrade.status === 'closed') {
          pnl = sample.paperTrade.realizedPnl;
          realizedPnl += pnl;
        } else {
          pnl = sample.paperTrade.unrealizedPnl;
          unrealizedPnl += pnl;
        }
      } else if (sample.realizedPnl !== null) {
        pnl = sample.realizedPnl;
        realizedPnl += pnl;
      } else if (sample.outcomeReviews.length > 0) {
        const rev = sample.outcomeReviews[sample.outcomeReviews.length - 1];
        pnl = rev.simulatedPnlAtMilestone;
        realizedPnl += pnl;
      }

      pnlValues.push(pnl);

      if (pnl > 0) {
        wins++;
        totalGain += pnl;
      } else if (pnl < 0) {
        losses++;
        totalLossAbs += Math.abs(pnl);
        if (cohort === 'paper_copy') badCopies++;
        if (sample.spread > 0.04) spreadLosses += Math.abs(pnl);
        if (sample.decisionFactors?.entryTiming < 70 || (sample.observedTrade.detectedPrice - sample.observedTrade.walletEntryPrice) > 0.02) {
          lateEntryLosses += Math.abs(pnl);
        }
      }

      runningPnl += pnl;
      if (runningPnl > peakPnl) peakPnl = runningPnl;
      const dd = peakPnl - runningPnl;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const totalPnl = realizedPnl + unrealizedPnl;
    const resolvedCount = wins + losses;
    const winRate = resolvedCount > 0 ? Math.round((wins / resolvedCount) * 1000) / 1000 : null;
    const avgPnl = Math.round((totalPnl / sampleCount) * 100) / 100;

    // Median PnL
    pnlValues.sort((a, b) => a - b);
    const mid = Math.floor(pnlValues.length / 2);
    const medianPnl = pnlValues.length % 2 !== 0
      ? pnlValues[mid]
      : Math.round(((pnlValues[mid - 1] + pnlValues[mid]) / 2) * 100) / 100;

    // Profit factor (Gain / Loss)
    const profitFactor = totalLossAbs > 0
      ? Math.round((totalGain / totalLossAbs) * 100) / 100
      : (totalGain > 0 ? 99.99 : null);

    // Cross-cohort missed winners and avoided losses
    let missedWinnerValue = 0;
    let avoidedLossValue = 0;
    let goodSkips = 0;
    let lateEntriesAvoided = 0;
    let spreadLossesAvoided = 0;

    for (const sample of allSamples) {
      const samplePnl = sample.paperTrade?.realizedPnl ?? sample.realizedPnl ?? (sample.outcomeReviews[0]?.simulatedPnlAtMilestone ?? 0);
      if (sample.decision === 'skip' || sample.decision === 'watchlist') {
        if (samplePnl > 0) {
          missedWinnerValue += samplePnl;
        } else if (samplePnl < 0) {
          avoidedLossValue += Math.abs(samplePnl);
          if (sample.decision === 'skip') goodSkips++;
          if (sample.spread > 0.04) spreadLossesAvoided++;
          if ((sample.observedTrade.detectedPrice - sample.observedTrade.walletEntryPrice) > 0.02) lateEntriesAvoided++;
        }
      }
    }

    const isSufficient = sampleCount >= minEvidenceFloor;

    return {
      cohort,
      sampleCount,
      winRate,
      realizedPnl: Math.round(realizedPnl * 100) / 100,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      averagePnlPerTrade: avgPnl,
      medianPnlPerTrade: medianPnl,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      profitFactor,
      avoidedLossValue: Math.round(avoidedLossValue * 100) / 100,
      missedWinnerValue: Math.round(missedWinnerValue * 100) / 100,
      badCopyCount: badCopies,
      goodSkipCount: goodSkips,
      lateEntryLosses: Math.round(lateEntryLosses * 100) / 100,
      spreadLosses: Math.round(spreadLosses * 100) / 100,
      lateEntriesAvoidedCount: lateEntriesAvoided,
      spreadLossesAvoidedCount: spreadLossesAvoided,
      dataStatus: isSufficient ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
      dataReason: isSufficient ? null : `Sample count (${sampleCount}) is below minimum floor (${minEvidenceFloor})`
    };
  }

  /**
   * Backward-compatible cohort comparison for EvaluatedDecisionItem arrays.
   */
  public static compareCohorts(items: EvaluatedDecisionItem[]): Record<BenchmarkCohort, BenchmarkComparison> {
    const cohorts: Record<BenchmarkCohort, EvaluatedDecisionItem[]> = {
      paper_copy: [],
      blind_leaderboard: [...items],
      watchlist: [],
      skipped: []
    };

    for (const item of items) {
      if (item.journal.decision === 'paper_copy') cohorts.paper_copy.push(item);
      else if (item.journal.decision === 'watchlist') cohorts.watchlist.push(item);
      else cohorts.skipped.push(item);
    }

    return {
      paper_copy: this.computeLegacyCohortStats('paper_copy', cohorts.paper_copy, items),
      blind_leaderboard: this.computeLegacyCohortStats('blind_leaderboard', cohorts.blind_leaderboard, items),
      watchlist: this.computeLegacyCohortStats('watchlist', cohorts.watchlist, items),
      skipped: this.computeLegacyCohortStats('skipped', cohorts.skipped, items)
    };
  }

  private static computeLegacyCohortStats(
    cohort: BenchmarkCohort,
    cohortItems: EvaluatedDecisionItem[],
    allItems: EvaluatedDecisionItem[]
  ): BenchmarkComparison {
    const tradeCount = cohortItems.length;
    if (tradeCount === 0) {
      return {
        cohort,
        tradeCount: 0,
        winRate: 0,
        totalPnl: 0,
        averagePnlPerTrade: 0,
        missedWinnersCount: 0,
        avoidedLosersCount: 0,
        badCopiesCount: 0,
        goodSkipsCount: 0,
        lateEntriesAvoidedCount: 0,
        spreadLossesAvoidedCount: 0
      };
    }

    const wins = cohortItems.filter(i => i.hypotheticalPnl > 0).length;
    const totalPnl = cohortItems.reduce((acc, i) => acc + i.hypotheticalPnl, 0);

    let missedWinners = 0;
    let avoidedLosers = 0;
    let badCopies = 0;
    let goodSkips = 0;
    let lateEntriesAvoided = 0;
    let spreadLossesAvoided = 0;

    for (const item of allItems) {
      if (item.journal.decision === 'paper_copy') {
        if (item.hypotheticalPnl < 0) badCopies++;
      } else {
        if (item.hypotheticalPnl > 0) missedWinners++;
        if (item.hypotheticalPnl < 0) {
          avoidedLosers++;
          if (item.journal.decision === 'skip') goodSkips++;
          if (item.entryDrift > 0.03) lateEntriesAvoided++;
          if (item.spreadAtEntry > 0.04) spreadLossesAvoided++;
        }
      }
    }

    return {
      cohort,
      tradeCount,
      winRate: Math.round((wins / tradeCount) * 1000) / 1000,
      totalPnl: Math.round(totalPnl * 100) / 100,
      averagePnlPerTrade: Math.round((totalPnl / tradeCount) * 100) / 100,
      missedWinnersCount: missedWinners,
      avoidedLosersCount: avoidedLosers,
      badCopiesCount: badCopies,
      goodSkipsCount: goodSkips,
      lateEntriesAvoidedCount: lateEntriesAvoided,
      spreadLossesAvoidedCount: spreadLossesAvoided
    };
  }
}
