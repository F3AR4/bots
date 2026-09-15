/**
 * Historical Trade Research & Realistic Copyability Pipeline.
 * 
 * Safety Guarantee:
 * - RESEARCH ONLY: Strictly offline analysis of observed historical records.
 * - Zero network calls inside evaluation engine.
 * - Zero execution: Does not create live or paper orders.
 * - Deterministic replay: Produces byte-for-byte identical results for same inputs.
 */

import {
  ObservedTrade,
  MarketSnapshot,
  RuleSet,
  HistoricalCopyEvaluation,
  TradeTimeline,
  CopyabilityClassification,
  ResearchCohort,
  WalletCopyabilityAggregation,
  CategoryCopyabilityAggregation,
  LatencyBucketDistribution,
  EmpiricalCalibrationDataset,
  ResearchDatasetMetadata
} from '../types/domain.js';
import { HistoricalCopyPriceModel } from './historical-copy-price-model.js';

export interface ResearchPipelineOptions {
  windowDays?: number;
  datasetId?: string;
  datasetVersion?: string;
  targetWallets?: string[];
}

export class HistoricalTradeResearchPipeline {
  /**
   * Reconstructs granular trade timeline for an observed trade.
   */
  public static reconstructTimeline(
    trade: ObservedTrade,
    snapshot: MarketSnapshot | null,
    resolutionTimestamp: string | null = null
  ): TradeTimeline {
    const t0 = trade.sourceTimestamp || null;
    const t1 = trade.provenance?.ingestionTime || trade.sourceTimestamp || null;
    const t2 = snapshot?.collectedAt || null;
    const t3 = snapshot?.collectedAt || null; // Modeled copy order matches at snapshot
    const t4 = null; // Subsequent observation
    const t5 = resolutionTimestamp;

    let latWalletToObs: number | null = null;
    let latObsToSnap: number | null = null;
    let latTotal: number | null = null;

    if (t0 && t1) {
      const ms0 = new Date(t0).getTime();
      const ms1 = new Date(t1).getTime();
      if (!isNaN(ms0) && !isNaN(ms1)) {
        latWalletToObs = Math.max(0, ms1 - ms0);
      }
    }

    if (t1 && t2) {
      const ms1 = new Date(t1).getTime();
      const ms2 = new Date(t2).getTime();
      if (!isNaN(ms1) && !isNaN(ms2)) {
        latObsToSnap = Math.max(0, ms2 - ms1);
      }
    }

    if (t0 && t3) {
      const ms0 = new Date(t0).getTime();
      const ms3 = new Date(t3).getTime();
      if (!isNaN(ms0) && !isNaN(ms3)) {
        latTotal = Math.max(0, ms3 - ms0);
      }
    }

    const isComplete = Boolean(t0 && t1 && t2 && t3 && latTotal !== null);

    return {
      t0WalletEntry: t0,
      t1Observation: t1,
      t2Snapshot: t2,
      t3ModeledCopy: t3,
      t4Subsequent: t4,
      t5Resolution: t5,
      latencyWalletToObservationMs: latWalletToObs,
      latencyObservationToSnapshotMs: latObsToSnap,
      latencyTotalModeledMs: latTotal,
      isTimelineComplete: isComplete
    };
  }

  /**
   * Evaluates a single observed trade against its closest market snapshot.
   */
  public static evaluateTradeCopyability(
    trade: ObservedTrade,
    snapshot: MarketSnapshot | null,
    ruleSet: RuleSet,
    resolutionData?: { resolvedPrice: number; resolvedAt: string; winningOutcome: string } | null,
    datasetMeta?: { datasetId: string; datasetVersion: string; analysisWindow: string }
  ): HistoricalCopyEvaluation {
    const config = ruleSet.config;
    const timeline = this.reconstructTimeline(trade, snapshot, resolutionData?.resolvedAt || null);
    const copyPriceResult = HistoricalCopyPriceModel.evaluateCopyPrice(trade, snapshot, config);

    const reasons: string[] = [...copyPriceResult.assumptionsUsed];
    let priceDrift: number | null = null;
    let adverseDrift: number | null = null;

    if (copyPriceResult.modeledCopyPrice !== null && trade.walletEntryPrice > 0) {
      priceDrift = Math.round((copyPriceResult.modeledCopyPrice - trade.walletEntryPrice) * 10000) / 10000;
      if (trade.side === 'BUY') {
        adverseDrift = Math.max(0, priceDrift);
      } else {
        adverseDrift = Math.max(0, -priceDrift);
      }
    }

    const latencySeconds = timeline.latencyTotalModeledMs !== null
      ? Math.round((timeline.latencyTotalModeledMs / 1000) * 10) / 10
      : null;

    // --- Classification Logic ---
    let classification: CopyabilityClassification = 'INSUFFICIENT_DATA';

    if (!copyPriceResult.isAvailable || copyPriceResult.modeledCopyPrice === null || !snapshot) {
      classification = 'INSUFFICIENT_DATA';
      reasons.push('Insufficient market data to model realistic copy execution');
    } else {
      const spread = copyPriceResult.spreadAtCopy ?? 0;
      const adv = adverseDrift ?? 0;
      const liq = copyPriceResult.liquidityAtCopy ?? 0;
      const isExtremePrice = trade.walletEntryPrice <= config.extremePriceLowerBound || trade.walletEntryPrice >= config.extremePriceUpperBound;

      const isUnfollowable = 
        copyPriceResult.fillModel === 'STALE_SNAPSHOT' ||
        spread > config.copyUnfollowableSpreadThreshold ||
        adv > config.copyUnfollowableAdverseDriftThreshold ||
        liq < 200.0 ||
        isExtremePrice;

      const isDifficult =
        copyPriceResult.fillModel === 'MIDPOINT' ||
        spread > config.copyDifficultSpreadThreshold ||
        adv > config.copyDifficultAdverseDriftThreshold ||
        liq < config.copyMinLiquidityThresholdUsd;

      if (isUnfollowable) {
        classification = 'UNFOLLOWABLE';
        if (isExtremePrice) reasons.push(`Extreme entry price ($${trade.walletEntryPrice.toFixed(3)}) difficult to replicate safely`);
        if (spread > config.copyUnfollowableSpreadThreshold) reasons.push(`Wide spread ($${spread.toFixed(3)}) exceeds unfollowable cutoff ($${config.copyUnfollowableSpreadThreshold})`);
        if (adv > config.copyUnfollowableAdverseDriftThreshold) reasons.push(`Severe adverse drift ($${adv.toFixed(3)}) exceeds cutoff ($${config.copyUnfollowableAdverseDriftThreshold})`);
        if (liq < 200.0) reasons.push(`Critical illiquidity ($${liq.toFixed(0)}) below minimum viability ($200)`);
      } else if (isDifficult) {
        classification = 'DIFFICULT';
        if (spread > config.copyDifficultSpreadThreshold) reasons.push(`Elevated spread ($${spread.toFixed(3)}) introduces notable friction`);
        if (adv > config.copyDifficultAdverseDriftThreshold) reasons.push(`Moderate adverse drift ($${adv.toFixed(3)}) reduces margin`);
        if (liq < config.copyMinLiquidityThresholdUsd) reasons.push(`Thin liquidity ($${liq.toFixed(0)}) below quality target ($${config.copyMinLiquidityThresholdUsd})`);
        if (copyPriceResult.fillModel === 'MIDPOINT') reasons.push('Modeled on midpoint rather than top-of-book ask');
      } else {
        classification = 'COPYABLE';
        reasons.push('Entry executed within tight spread, adequate depth, and minimal price drift');
      }
    }

    // --- Resolution & Outcome Analysis ---
    let walletOutcome: 'WIN' | 'LOSS' | 'UNRESOLVED' | null = null;
    let walletPnl: number | null = null;
    let modeledCopyOutcome: 'WIN' | 'LOSS' | 'UNRESOLVED' | null = null;
    let modeledCopyPnl: number | null = null;
    let copyPnlDelta: number | null = null;

    if (resolutionData && resolutionData.resolvedPrice !== undefined) {
      const isTradeWin = trade.side === 'BUY'
        ? resolutionData.resolvedPrice > trade.walletEntryPrice
        : resolutionData.resolvedPrice < trade.walletEntryPrice;

      walletOutcome = isTradeWin ? 'WIN' : 'LOSS';
      const tradeSize = trade.size > 0 ? trade.size : 10.0; // fallback standard trade size
      const shares = tradeSize / Math.max(0.01, trade.walletEntryPrice);

      walletPnl = trade.side === 'BUY'
        ? Math.round((resolutionData.resolvedPrice - trade.walletEntryPrice) * shares * 100) / 100
        : Math.round((trade.walletEntryPrice - resolutionData.resolvedPrice) * shares * 100) / 100;

      if (copyPriceResult.modeledCopyPrice !== null) {
        const copyShares = tradeSize / Math.max(0.01, copyPriceResult.modeledCopyPrice);
        const isCopyWin = trade.side === 'BUY'
          ? resolutionData.resolvedPrice > copyPriceResult.modeledCopyPrice
          : resolutionData.resolvedPrice < copyPriceResult.modeledCopyPrice;

        modeledCopyOutcome = isCopyWin ? 'WIN' : 'LOSS';
        modeledCopyPnl = trade.side === 'BUY'
          ? Math.round((resolutionData.resolvedPrice - copyPriceResult.modeledCopyPrice) * copyShares * 100) / 100
          : Math.round((copyPriceResult.modeledCopyPrice - resolutionData.resolvedPrice) * copyShares * 100) / 100;

        copyPnlDelta = Math.round((modeledCopyPnl - walletPnl) * 100) / 100;
      }
    } else {
      walletOutcome = 'UNRESOLVED';
      modeledCopyOutcome = 'UNRESOLVED';
    }

    // --- Research Cohort Assignment ---
    let cohort: ResearchCohort = 'INSUFFICIENT_DATA';

    if (classification === 'INSUFFICIENT_DATA') {
      cohort = 'INSUFFICIENT_DATA';
    } else if (walletOutcome === 'WIN') {
      if (classification === 'UNFOLLOWABLE' || (modeledCopyOutcome === 'LOSS') || (copyPnlDelta !== null && copyPnlDelta < -0.5 * Math.abs(walletPnl || 1))) {
        cohort = 'MISSED_WINNER';
        reasons.push('Missed Winner: Wallet won, but copy would have been unfollowable or suffered substantial drag');
      } else {
        cohort = 'GOOD_COPY';
        reasons.push('Good Copy: Wallet won and copy replication was viable and profitable');
      }
    } else if (walletOutcome === 'LOSS') {
      if (classification === 'UNFOLLOWABLE') {
        cohort = 'AVOIDED_LOSER';
        reasons.push('Avoided Loser: Wallet lost, but realistic copy rules would have disqualified/avoided the entry');
      } else {
        cohort = 'BAD_COPY';
        reasons.push('Bad Copy: Wallet lost and copy followed into the losing trade');
      }
    } else {
      // Unresolved
      cohort = classification === 'COPYABLE' ? 'GOOD_COPY' : 'BAD_COPY';
    }

    const evalId = `hce-${trade.id.slice(0, 8)}-${Date.now()}`;
    const generatedAt = new Date().toISOString();

    return {
      id: evalId,
      walletAddress: trade.walletAddress,
      observedTradeId: trade.id,
      marketId: trade.marketId,
      timeline,
      walletEntryPrice: trade.walletEntryPrice,
      walletEntrySize: trade.size,
      walletEntryTimestamp: trade.sourceTimestamp,
      observedPrice: trade.detectedPrice || null,
      observedTimestamp: trade.provenance?.ingestionTime || null,
      modeledCopyPrice: copyPriceResult.modeledCopyPrice,
      modeledCopyTimestamp: copyPriceResult.modeledCopyTimestamp,
      fillModel: copyPriceResult.fillModel,
      spreadAtEntry: null, // unless captured separately
      spreadAtObservation: snapshot?.spread ?? null,
      spreadAtCopy: copyPriceResult.spreadAtCopy,
      liquidityAtEntry: null,
      liquidityAtObservation: snapshot?.liquidity ?? null,
      liquidityAtCopy: copyPriceResult.liquidityAtCopy,
      relativeTradeSizeToDepth: copyPriceResult.relativeTradeSizeToDepth,
      priceDrift,
      adverseDrift,
      latencySeconds,
      walletOutcome,
      walletPnl,
      modeledCopyOutcome,
      modeledCopyPnl,
      copyPnlDelta,
      classification,
      cohort,
      reasonCodes: reasons,
      analysisWindow: datasetMeta?.analysisWindow || '30d',
      ruleSetId: ruleSet.id,
      ruleVersion: ruleSet.version,
      normalizationVersion: trade.provenance?.normalizationVersion || 'v1.0.0',
      datasetId: datasetMeta?.datasetId || 'dataset-fixture-v1',
      datasetVersion: datasetMeta?.datasetVersion || '1.0.0',
      generatedAt,
      provenance: {
        provider: 'polymarket_copy_research',
        sourceIdentifier: trade.id,
        sourceTime: trade.sourceTimestamp,
        ingestionTime: generatedAt,
        normalizationVersion: 'v1.0.0',
        isDemo: trade.provenance?.isDemo ?? true
      }
    };
  }

  /**
   * Aggregates historical copy evaluations by wallet.
   */
  public static aggregateByWallet(evaluations: HistoricalCopyEvaluation[]): WalletCopyabilityAggregation[] {
    const byWallet = new Map<string, HistoricalCopyEvaluation[]>();
    for (const e of evaluations) {
      const list = byWallet.get(e.walletAddress) || [];
      list.push(e);
      byWallet.set(e.walletAddress, list);
    }

    const results: WalletCopyabilityAggregation[] = [];
    for (const [address, evals] of byWallet.entries()) {
      const total = evals.length;
      let copyable = 0;
      let difficult = 0;
      let unfollowable = 0;
      let insufficient = 0;
      let missedWinners = 0;
      let avoidedLosers = 0;

      let walletResolvedPnL = 0;
      let modeledCopyPnL = 0;
      let resolvedCount = 0;

      const delays: number[] = [];
      const drifts: number[] = [];
      const spreads: number[] = [];
      const liquidities: number[] = [];

      for (const e of evals) {
        if (e.classification === 'COPYABLE') copyable++;
        else if (e.classification === 'DIFFICULT') difficult++;
        else if (e.classification === 'UNFOLLOWABLE') unfollowable++;
        else insufficient++;

        if (e.cohort === 'MISSED_WINNER') missedWinners++;
        if (e.cohort === 'AVOIDED_LOSER') avoidedLosers++;

        if (e.walletPnl !== null && e.walletOutcome !== 'UNRESOLVED') {
          walletResolvedPnL += e.walletPnl;
          resolvedCount++;
        }
        if (e.modeledCopyPnl !== null && e.modeledCopyOutcome !== 'UNRESOLVED') {
          modeledCopyPnL += e.modeledCopyPnl;
        }

        if (e.timeline.latencyTotalModeledMs !== null) delays.push(e.timeline.latencyTotalModeledMs);
        if (e.adverseDrift !== null) drifts.push(e.adverseDrift);
        if (e.spreadAtCopy !== null) spreads.push(e.spreadAtCopy);
        if (e.liquidityAtCopy !== null) liquidities.push(e.liquidityAtCopy);
      }

      const copyabilityRate = total > 0 ? Math.round((copyable / total) * 1000) / 1000 : 0;
      const copyPnLDelta = Math.round((modeledCopyPnL - walletResolvedPnL) * 100) / 100;

      results.push({
        walletAddress: address,
        totalTradesAnalyzed: total,
        copyableTradeCount: copyable,
        difficultTradeCount: difficult,
        unfollowableTradeCount: unfollowable,
        insufficientDataTradeCount: insufficient,
        copyabilityRate,
        resolvedCount,
        walletResolvedPnL: Math.round(walletResolvedPnL * 100) / 100,
        modeledCopyPnL: Math.round(modeledCopyPnL * 100) / 100,
        copyPnLDelta,
        missedWinnerCount: missedWinners,
        avoidedLoserCount: avoidedLosers,
        medianCopyDelayMs: this.median(delays),
        medianEntryDrift: Math.round(this.median(drifts) * 1000) / 1000,
        medianSpread: Math.round(this.median(spreads) * 1000) / 1000,
        medianLiquidityUsd: Math.round(this.median(liquidities) * 100) / 100
      });
    }

    return results.sort((a, b) => b.copyabilityRate - a.copyabilityRate);
  }

  /**
   * Aggregates historical copy evaluations by category.
   */
  public static aggregateByCategory(
    evaluations: HistoricalCopyEvaluation[],
    tradeMap: Map<string, ObservedTrade>
  ): CategoryCopyabilityAggregation[] {
    const byCategory = new Map<string, HistoricalCopyEvaluation[]>();
    for (const e of evaluations) {
      const trade = tradeMap.get(e.observedTradeId);
      const cat = trade?.marketCategory || 'Unknown';
      const list = byCategory.get(cat) || [];
      list.push(e);
      byCategory.set(cat, list);
    }

    const results: CategoryCopyabilityAggregation[] = [];
    for (const [category, evals] of byCategory.entries()) {
      const total = evals.length;
      let copyable = 0;
      let difficult = 0;
      let unfollowable = 0;
      let insufficient = 0;
      let resolvedCount = 0;
      let walletPnL = 0;
      let modeledCopyPnL = 0;

      const spreads: number[] = [];
      const liquidities: number[] = [];
      const drifts: number[] = [];
      const latencyDist: Record<string, number> = {
        '0-5s': 0, '5-15s': 0, '15-30s': 0, '30-60s': 0, '60-300s': 0, '300s+': 0
      };

      for (const e of evals) {
        if (e.classification === 'COPYABLE') copyable++;
        else if (e.classification === 'DIFFICULT') difficult++;
        else if (e.classification === 'UNFOLLOWABLE') unfollowable++;
        else insufficient++;

        if (e.walletPnl !== null && e.walletOutcome !== 'UNRESOLVED') {
          walletPnL += e.walletPnl;
          resolvedCount++;
        }
        if (e.modeledCopyPnl !== null && e.modeledCopyOutcome !== 'UNRESOLVED') {
          modeledCopyPnL += e.modeledCopyPnl;
        }

        if (e.spreadAtCopy !== null) spreads.push(e.spreadAtCopy);
        if (e.liquidityAtCopy !== null) liquidities.push(e.liquidityAtCopy);
        if (e.adverseDrift !== null) drifts.push(e.adverseDrift);

        const sec = e.latencySeconds ?? 0;
        if (sec <= 5) latencyDist['0-5s']++;
        else if (sec <= 15) latencyDist['5-15s']++;
        else if (sec <= 30) latencyDist['15-30s']++;
        else if (sec <= 60) latencyDist['30-60s']++;
        else if (sec <= 300) latencyDist['60-300s']++;
        else latencyDist['300s+']++;
      }

      results.push({
        category,
        tradeCount: total,
        resolvedCount,
        copyableCount: copyable,
        difficultCount: difficult,
        unfollowableCount: unfollowable,
        insufficientDataCount: insufficient,
        copyabilityRate: total > 0 ? Math.round((copyable / total) * 1000) / 1000 : 0,
        walletPnL: Math.round(walletPnL * 100) / 100,
        modeledCopyPnL: Math.round(modeledCopyPnL * 100) / 100,
        copyPnLDelta: Math.round((modeledCopyPnL - walletPnL) * 100) / 100,
        medianSpread: Math.round(this.median(spreads) * 1000) / 1000,
        medianLiquidityUsd: Math.round(this.median(liquidities) * 100) / 100,
        medianDrift: Math.round(this.median(drifts) * 1000) / 1000,
        latencyDistribution: latencyDist
      });
    }

    return results.sort((a, b) => b.tradeCount - a.tradeCount);
  }

  /**
   * Evaluates copyability and latency relationship across configurable time buckets.
   */
  public static analyzeLatencyBuckets(evaluations: HistoricalCopyEvaluation[]): LatencyBucketDistribution[] {
    const buckets = [
      { label: '0-5s', min: 0, max: 5 },
      { label: '5-15s', min: 5, max: 15 },
      { label: '15-30s', min: 15, max: 30 },
      { label: '30-60s', min: 30, max: 60 },
      { label: '60-300s', min: 60, max: 300 },
      { label: '300s+', min: 300, max: null }
    ];

    return buckets.map(b => {
      const inBucket = evaluations.filter(e => {
        const sec = e.latencySeconds ?? 0;
        return sec >= b.min && (b.max === null ? true : sec < b.max);
      });

      const count = inBucket.length;
      const adverseDrifts = inBucket.map(e => e.adverseDrift ?? 0);
      const spreads = inBucket.map(e => e.spreadAtCopy ?? 0);
      const liquidities = inBucket.map(e => e.liquidityAtCopy ?? 0);
      
      const resolved = inBucket.filter(e => e.modeledCopyOutcome !== 'UNRESOLVED');
      const wins = resolved.filter(e => e.modeledCopyOutcome === 'WIN').length;
      const winRate = resolved.length > 0 ? Math.round((wins / resolved.length) * 1000) / 1000 : 0;

      const sumAdverse = adverseDrifts.reduce((acc, v) => acc + v, 0);
      const meanAdverse = count > 0 ? Math.round((sumAdverse / count) * 1000) / 1000 : 0;
      const worstAdverse = adverseDrifts.length > 0 ? Math.max(...adverseDrifts) : 0;

      return {
        bucketLabel: b.label,
        minSeconds: b.min,
        maxSeconds: b.max,
        tradeCount: count,
        medianAdverseMovement: Math.round(this.median(adverseDrifts) * 1000) / 1000,
        meanAdverseMovement: meanAdverse,
        worstAdverseMovement: Math.round(worstAdverse * 1000) / 1000,
        medianSpread: Math.round(this.median(spreads) * 1000) / 1000,
        medianLiquidity: Math.round(this.median(liquidities) * 100) / 100,
        winRate
      };
    });
  }

  /**
   * Generates empirical calibration dataset for future parameter optimization.
   */
  public static generateCalibrationDataset(
    evaluations: HistoricalCopyEvaluation[],
    tradeMap: Map<string, ObservedTrade>,
    datasetMeta: ResearchDatasetMetadata,
    ruleSetId: string
  ): EmpiricalCalibrationDataset {
    const cohortCounts: Record<ResearchCohort, number> = {
      GOOD_COPY: 0,
      BAD_COPY: 0,
      MISSED_WINNER: 0,
      AVOIDED_LOSER: 0,
      INSUFFICIENT_DATA: 0
    };

    const classCounts: Record<CopyabilityClassification, number> = {
      COPYABLE: 0,
      DIFFICULT: 0,
      UNFOLLOWABLE: 0,
      INSUFFICIENT_DATA: 0
    };

    const entryDrifts: number[] = [];
    const adverseDrifts: number[] = [];
    const spreads: number[] = [];
    const liquidities: number[] = [];
    const latencies: number[] = [];
    const pnlDeltas: number[] = [];

    for (const e of evaluations) {
      cohortCounts[e.cohort] = (cohortCounts[e.cohort] || 0) + 1;
      classCounts[e.classification] = (classCounts[e.classification] || 0) + 1;

      if (e.priceDrift !== null) entryDrifts.push(e.priceDrift);
      if (e.adverseDrift !== null) adverseDrifts.push(e.adverseDrift);
      if (e.spreadAtCopy !== null) spreads.push(e.spreadAtCopy);
      if (e.liquidityAtCopy !== null) liquidities.push(e.liquidityAtCopy);
      if (e.latencySeconds !== null) latencies.push(e.latencySeconds);
      if (e.copyPnlDelta !== null) pnlDeltas.push(e.copyPnlDelta);
    }

    return {
      datasetMetadata: datasetMeta,
      ruleSetId,
      totalEvaluations: evaluations.length,
      cohortCounts,
      classificationCounts: classCounts,
      entryDriftDistribution: this.calculatePercentiles(entryDrifts),
      adverseDriftDistribution: this.calculatePercentiles(adverseDrifts),
      spreadDistribution: this.calculatePercentiles(spreads),
      liquidityDistribution: this.calculatePercentiles(liquidities),
      latencyDistribution: this.calculatePercentiles(latencies),
      pnlDeltaDistribution: this.calculatePercentiles(pnlDeltas),
      walletAggregations: this.aggregateByWallet(evaluations),
      categoryAggregations: this.aggregateByCategory(evaluations, tradeMap),
      latencyBuckets: this.analyzeLatencyBuckets(evaluations)
    };
  }

  // --- Helper Math Utilities ---
  private static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private static calculatePercentiles(values: number[]): {
    p10: number; p25: number; p50: number; p75: number; p90: number;
  } {
    if (values.length === 0) {
      return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const getP = (p: number) => {
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
      return Math.round(sorted[idx] * 1000) / 1000;
    };
    return {
      p10: getP(0.10),
      p25: getP(0.25),
      p50: getP(0.50),
      p75: getP(0.75),
      p90: getP(0.90)
    };
  }
}
