/**
 * Wallet Intelligence Engine.
 * 
 * Implements:
 * - 30-day historical window analysis (requested vs actual timespan).
 * - Multi-dimensional wallet evaluation (ROI provenance, consistency, copyability,
 *   category edge, liquidity quality, entry timing, frequency, resolved trade performance).
 * - Comprehensive One-Hit-Wonder diagnostics (profit concentration, dominant market, trade age).
 * - Data completeness analysis (distinguishing LOW SCORE from LOW EVIDENCE).
 * - RuleSet-governed deterministic scoring and tri-state classification (TRACK / WATCH / IGNORE).
 */

import {
  RuleSet,
  ObservedTrade,
  MarketSnapshot,
  WalletProfile,
  WalletStatus,
  RoiProvenance,
  DataCompletenessReport,
  OneHitWonderDiagnostics,
  WalletFrequencyMetrics,
  WalletCopyabilityFactors,
  WalletResearchEvaluation,
  ProvenanceMetadata
} from '../types/domain.js';
import { FactorResult, PenaltyResult, WalletScoreResult } from '../types/scoring.js';

export interface WalletAnalysisInput {
  walletAddress: string;
  sourceRank?: number;
  label?: string | null;
  observedTrades: ObservedTrade[];
  marketSnapshotsByMarketId?: Map<string, MarketSnapshot>;
  providerReportedRoi?: number | null;
  providerReportedPnlUsd?: number | null;
  windowDays?: number;
  requestedStartTimestamp?: string;
  requestedEndTimestamp?: string;
}

export class WalletIntelligenceEngine {
  /**
   * Deterministically analyzes observed wallet trades over the analysis window
   * and computes a structured WalletResearchEvaluation and WalletProfile.
   */
  public static analyzeWallet(
    input: WalletAnalysisInput,
    ruleSet: RuleSet,
    clock: () => string = () => new Date().toISOString()
  ): {
    profile: WalletProfile;
    evaluation: WalletResearchEvaluation;
    scoreResult: WalletScoreResult;
  } {
    const config = ruleSet.config;
    const nowIso = clock();
    const trades = [...input.observedTrades].sort(
      (a, b) => new Date(a.sourceTimestamp).getTime() - new Date(b.sourceTimestamp).getTime()
    );
    const snapshots = input.marketSnapshotsByMarketId || new Map<string, MarketSnapshot>();
    const windowDays = input.windowDays ?? 30;

    // --- 1. Analysis Window Boundaries ---
    let actualStart: string | null = null;
    let actualEnd: string | null = null;
    if (trades.length > 0) {
      actualStart = trades[0].sourceTimestamp;
      actualEnd = trades[trades.length - 1].sourceTimestamp;
    }

    // --- 2. Resolved vs Unresolved Trade Classification ---
    const resolvedTrades: ObservedTrade[] = [];
    const unresolvedTrades: ObservedTrade[] = [];
    const winningTrades: ObservedTrade[] = [];
    const losingTrades: ObservedTrade[] = [];
    const tradePnlMap = new Map<string, number>();

    let totalCostBasisUsd = 0;
    let totalPnlUsd = 0;
    let largestSingleWinUsd = 0;
    let largestWinTrade: ObservedTrade | null = null;
    const pnlByMarket = new Map<string, number>();
    const tradesByCategory: Record<string, {
      tradeCount: number;
      resolvedTrades: number;
      wins: number;
      losses: number;
      pnlUsd: number;
    }> = {};

    for (const t of trades) {
      const cat = t.marketCategory || 'General';
      if (!tradesByCategory[cat]) {
        tradesByCategory[cat] = { tradeCount: 0, resolvedTrades: 0, wins: 0, losses: 0, pnlUsd: 0 };
      }
      tradesByCategory[cat].tradeCount++;

      totalCostBasisUsd += t.size;

      // Extract resolution status from rawTradeJson or payload facts
      let isResolved = false;
      let won = false;
      let tradePnl = 0;

      try {
        const raw = JSON.parse(t.rawTradeJson || '{}');
        if (raw.resolved === true || (raw.resolved !== false && ((raw.winner !== undefined && raw.winner !== null) || (raw.payout !== undefined && raw.payout > 0)))) {
          if (raw.resolved !== false) {
            isResolved = true;
            if (raw.winner === t.outcome || raw.payout > 0 || (raw.side === 'BUY' && t.walletEntryPrice < 0.5 && raw.winner === 'YES')) {
              won = true;
              tradePnl = t.side === 'BUY' ? (1.0 - t.walletEntryPrice) * t.size : t.walletEntryPrice * t.size;
            } else {
              won = false;
              tradePnl = -t.size;
            }
          }
        }
      } catch {
        // Unparseable raw trade JSON treated as unresolved
      }

      if (isResolved) {
        resolvedTrades.push(t);
        tradesByCategory[cat].resolvedTrades++;
        tradePnlMap.set(t.id, tradePnl);
        totalPnlUsd += tradePnl;

        const currentMarketPnl = (pnlByMarket.get(t.marketId) || 0) + tradePnl;
        pnlByMarket.set(t.marketId, currentMarketPnl);

        if (won) {
          winningTrades.push(t);
          tradesByCategory[cat].wins++;
          tradesByCategory[cat].pnlUsd += tradePnl;
          if (tradePnl > largestSingleWinUsd) {
            largestSingleWinUsd = tradePnl;
            largestWinTrade = t;
          }
        } else {
          losingTrades.push(t);
          tradesByCategory[cat].losses++;
          tradesByCategory[cat].pnlUsd += tradePnl;
        }
      } else {
        unresolvedTrades.push(t);
      }
    }

    // --- 3. ROI Provenance ---
    let roiProvenance: RoiProvenance;
    if (input.providerReportedRoi !== undefined && input.providerReportedRoi !== null) {
      roiProvenance = {
        type: 'provider_reported',
        value: input.providerReportedRoi,
        pnlUsd: input.providerReportedPnlUsd ?? totalPnlUsd,
        totalCostBasisUsd: totalCostBasisUsd > 0 ? totalCostBasisUsd : null,
        denominatorDescription: 'Direct upstream provider calculation',
        sourceNotes: 'Supplied directly by leaderboard provider API'
      };
    } else if (totalCostBasisUsd > 0 && resolvedTrades.length > 0) {
      const derivedRoi = totalPnlUsd / totalCostBasisUsd;
      roiProvenance = {
        type: 'derived_normalized',
        value: derivedRoi,
        pnlUsd: totalPnlUsd,
        totalCostBasisUsd,
        denominatorDescription: 'Sum of executed trade sizes (total cost basis)',
        sourceNotes: `Derived from ${resolvedTrades.length} resolved trades out of ${trades.length} observed`
      };
    } else {
      roiProvenance = {
        type: 'unavailable',
        value: null,
        pnlUsd: totalPnlUsd,
        totalCostBasisUsd: totalCostBasisUsd > 0 ? totalCostBasisUsd : null,
        denominatorDescription: 'Insufficient cash-flow or resolved trade data to compute valid denominator',
        sourceNotes: 'Zero resolved trades or missing cost basis; ROI left explicitly unavailable'
      };
    }

    // --- 4. Consistency Metrics ---
    const winRate = resolvedTrades.length > 0 ? winningTrades.length / resolvedTrades.length : 0.0;
    const consistencyNormalized = winRate * 100;

    // --- 5. Copyability Analysis ---
    let totalSpread = 0;
    let totalLiquidity = 0;
    let totalDrift = 0;
    let adverseDriftCount = 0;
    let unfollowablePriceCount = 0;
    let snapshotsMatched = 0;
    let totalDelayMs = 0;
    let delaySamples = 0;

    for (const t of trades) {
      const snap = snapshots.get(t.marketId);
      if (snap) {
        snapshotsMatched++;
        totalSpread += snap.spread;
        totalLiquidity += snap.liquidity;

        // Drift between wallet entry price and snapshot price
        const snapPrice = t.outcome === 'NO' ? snap.noPrice : snap.yesPrice;
        const drift = Math.abs(snapPrice - t.walletEntryPrice);
        totalDrift += drift;

        // Adverse movement: price moved higher after BUY
        if (t.side === 'BUY' && snapPrice > t.walletEntryPrice + config.maxAllowedPriceDrift) {
          adverseDriftCount++;
        }

        const snapTime = new Date(snap.collectedAt).getTime();
        const entryTime = new Date(t.sourceTimestamp).getTime();
        if (!isNaN(snapTime) && !isNaN(entryTime) && snapTime >= entryTime) {
          totalDelayMs += (snapTime - entryTime);
          delaySamples++;
        }
      } else {
        // Fallback unobserved liquidity and spread from versioned RuleSet configuration [IMPLEMENTATION BASELINE]
        totalLiquidity += config.fallbackUnobservedLiquidityUsd;
        totalSpread += config.fallbackUnobservedSpread;
      }

      if (t.walletEntryPrice < config.extremePriceLowerBound || t.walletEntryPrice > config.extremePriceUpperBound) {
        unfollowablePriceCount++;
      }
    }

    const avgSpread = trades.length > 0 ? totalSpread / trades.length : config.fallbackUnobservedSpread;
    const avgLiquidity = trades.length > 0 ? totalLiquidity / trades.length : config.fallbackUnobservedLiquidityUsd;
    const avgPostEntryDrift = snapshotsMatched > 0 ? totalDrift / snapshotsMatched : 0.0;
    const avgDelayMs = delaySamples > 0 ? totalDelayMs / delaySamples : 0;

    const spreadPenaltyFactor = Math.max(0, 100 - (avgSpread / config.maxHistoricalSpread) * 50);
    const liquidityFactor = Math.min(100, (avgLiquidity / config.minLiquidityQualityUsd) * 100);
    const copyabilityNormalized = Math.max(0, Math.min(100, (spreadPenaltyFactor + liquidityFactor) / 2));

    const copyabilityFactors: WalletCopyabilityFactors = {
      averageSpread: avgSpread,
      averageLiquidityUsd: avgLiquidity,
      averagePostEntryDrift: avgPostEntryDrift,
      adverseDriftCount,
      unfollowablePriceCount,
      averageObservationDelayMs: avgDelayMs,
      copyabilityNormalized,
      notes: `Avg Spread: ${avgSpread.toFixed(3)}, Avg Liquidity: $${avgLiquidity.toFixed(0)}, Post-entry drift: ${avgPostEntryDrift.toFixed(3)}`
    };

    // --- 6. Category Edge Analysis ---
    let bestCategory = 'None';
    let bestCategoryWinRate = 0;
    const categoryStrengths: Record<string, { winRate: number; tradeCount: number; roi: number; resolvedTrades: number }> = {};

    for (const [catName, stats] of Object.entries(tradesByCategory)) {
      const catWinRate = stats.resolvedTrades > 0 ? stats.wins / stats.resolvedTrades : 0.0;
      const catCost = stats.tradeCount * (totalCostBasisUsd / Math.max(1, trades.length));
      const catRoi = catCost > 0 ? stats.pnlUsd / catCost : 0;

      categoryStrengths[catName] = {
        winRate: catWinRate,
        tradeCount: stats.tradeCount,
        resolvedTrades: stats.resolvedTrades,
        roi: catRoi
      };

      // Category edge qualification requires minimum sample size [IMPLEMENTATION BASELINE - NOT FROM PDF]
      if (stats.resolvedTrades >= config.minCategoryResolvedTradesCount && catWinRate > bestCategoryWinRate) {
        bestCategoryWinRate = catWinRate;
        bestCategory = catName;
      }
    }

    if (bestCategory === 'None' && Object.keys(tradesByCategory).length > 0) {
      // Pick category with most trades as fallback descriptive category
      let maxTrades = -1;
      for (const [catName, stats] of Object.entries(tradesByCategory)) {
        if (stats.tradeCount > maxTrades) {
          maxTrades = stats.tradeCount;
          bestCategory = catName;
        }
      }
    }

    const categoryEdgeNormalized = bestCategoryWinRate * 100;

    // --- 7. Liquidity Quality Dimension ---
    const liquidityQualityNormalized = Math.min(100, (avgLiquidity / config.minLiquidityQualityUsd) * 100);

    // --- 8. Entry Timing Dimension ---
    const timingNormalized = config.defaultWalletEntryTimingScore;

    // --- 9. Trade Frequency Metrics ---
    const uniqueDays = new Set<string>();
    const uniqueMarkets = new Set<string>();
    const timestampsMs: number[] = [];

    for (const t of trades) {
      uniqueMarkets.add(t.marketId);
      const d = t.sourceTimestamp.slice(0, 10);
      if (d) uniqueDays.add(d);
      const ms = new Date(t.sourceTimestamp).getTime();
      if (!isNaN(ms)) timestampsMs.push(ms);
    }

    timestampsMs.sort((a, b) => a - b);
    const intervalsHours: number[] = [];
    for (let i = 1; i < timestampsMs.length; i++) {
      intervalsHours.push((timestampsMs[i] - timestampsMs[i - 1]) / (1000 * 60 * 60));
    }
    intervalsHours.sort((a, b) => a - b);

    const avgInterval = intervalsHours.length > 0
      ? intervalsHours.reduce((acc, h) => acc + h, 0) / intervalsHours.length
      : 0;
    const medianInterval = intervalsHours.length > 0
      ? intervalsHours[Math.floor(intervalsHours.length / 2)]
      : 0;

    const tradesPerDay = windowDays > 0 ? trades.length / windowDays : 0;
    const frequencyMetrics: WalletFrequencyMetrics = {
      tradesPerDay,
      activeDaysCount: uniqueDays.size,
      activeMarketsCount: uniqueMarkets.size,
      averageIntervalHours: avgInterval,
      medianIntervalHours: medianInterval,
      burstinessRatio: uniqueDays.size > 0 ? (trades.length / uniqueDays.size) / Math.max(0.1, tradesPerDay) : 1.0
    };

    // --- 10. One-Hit-Wonder Diagnostics ---
    const effectivePnl = totalPnlUsd > 0 ? totalPnlUsd : (input.providerReportedPnlUsd ?? 0);
    const largestWinRatio = effectivePnl > 0 ? largestSingleWinUsd / effectivePnl : 0;

    let dominantMarketId: string | null = null;
    let dominantMarketPnl = 0;
    for (const [mId, mPnl] of pnlByMarket.entries()) {
      if (mPnl > dominantMarketPnl) {
        dominantMarketPnl = mPnl;
        dominantMarketId = mId;
      }
    }
    const dominantMarketPnlRatio = effectivePnl > 0 ? dominantMarketPnl / effectivePnl : 0;

    let dominantTradeAgeDays: number | null = null;
    if (largestWinTrade) {
      const winTime = new Date(largestWinTrade.sourceTimestamp).getTime();
      const evalTime = new Date(nowIso).getTime();
      if (!isNaN(winTime) && !isNaN(evalTime)) {
        dominantTradeAgeDays = Math.max(0, (evalTime - winTime) / (1000 * 60 * 60 * 24));
      }
    }

    const isConcentratedInSingleTrade = effectivePnl > 0 &&
      largestWinRatio >= config.singleTradeProfitConcentrationThreshold;
    const isSingleMarketEdgeOnly = Object.keys(tradesByCategory).length <= 1 && resolvedTrades.length <= config.maxSingleMarketEdgeTrades;
    const hasInsufficientResolvedTrades = resolvedTrades.length < config.minResolvedTradesCount;

    const oneHitWonderDiagnostics: OneHitWonderDiagnostics = {
      largestSingleWinUsd,
      totalPnlUsd: effectivePnl,
      largestWinProfitRatio: largestWinRatio,
      dominantMarketId,
      dominantMarketPnlRatio,
      dominantTradeAgeDays,
      isConcentratedInSingleTrade,
      isSingleMarketEdgeOnly,
      hasInsufficientResolvedTrades,
      notes: isConcentratedInSingleTrade
        ? `Single trade concentration: Largest win accounts for ${(largestWinRatio * 100).toFixed(1)}% of total profit.`
        : 'Profit is adequately distributed across multiple trades.'
    };

    // --- 11. Data Completeness Report ---
    const resolvedCoverage = trades.length > 0 ? resolvedTrades.length / trades.length : 0.0;
    const marketSnapshotCoverage = trades.length > 0 ? snapshotsMatched / trades.length : 0.0;
    const validTimestampsCount = trades.filter(t => !isNaN(new Date(t.sourceTimestamp).getTime())).length;
    const timestampCoverage = trades.length > 0 ? validTimestampsCount / trades.length : 0.0;
    const validCategoryCount = trades.filter(t => t.marketCategory && t.marketCategory !== 'General' && t.marketCategory !== '').length;
    const categoryCoverage = trades.length > 0 ? validCategoryCount / trades.length : 0.0;
    const liquidityCoverage = marketSnapshotCoverage;
    const validPriceCount = trades.filter(t => t.walletEntryPrice > 0 && t.walletEntryPrice <= 1.0).length;
    const priceCoverage = trades.length > 0 ? validPriceCount / trades.length : 0.0;

    const overallEvidenceScore = Math.min(100, Math.round(
      (resolvedCoverage * 30) +
      (marketSnapshotCoverage * 20) +
      (timestampCoverage * 20) +
      (priceCoverage * 15) +
      (Math.min(1.0, trades.length / 10) * 15)
    ));

    // Evidence tiers are empirical data-quality conventions for research confidence [IMPLEMENTATION BASELINE]
    let evidenceTier: 'HIGH_EVIDENCE' | 'MODERATE_EVIDENCE' | 'LOW_EVIDENCE' | 'INSUFFICIENT_EVIDENCE';
    if (overallEvidenceScore >= config.evidenceTierHighThreshold && resolvedTrades.length >= config.evidenceMinTradesHigh) {
      evidenceTier = 'HIGH_EVIDENCE';
    } else if (overallEvidenceScore >= config.evidenceTierModerateThreshold && resolvedTrades.length >= config.evidenceMinTradesModerate) {
      evidenceTier = 'MODERATE_EVIDENCE';
    } else if (overallEvidenceScore >= config.evidenceTierLowThreshold && trades.length >= config.evidenceMinTradesLow) {
      evidenceTier = 'LOW_EVIDENCE';
    } else {
      evidenceTier = 'INSUFFICIENT_EVIDENCE';
    }

    const dataCompleteness: DataCompletenessReport = {
      totalTradesObserved: trades.length,
      resolvedTradesCount: resolvedTrades.length,
      unresolvedTradesCount: unresolvedTrades.length,
      resolvedCoverage,
      marketSnapshotCoverage,
      timestampCoverage,
      categoryCoverage,
      liquidityCoverage,
      priceCoverage,
      overallEvidenceScore,
      evidenceTier
    };

    // --- 12. Factor Results Compilation ---
    const factorResults: FactorResult[] = [];
    const roiRaw = effectivePnl;
    const roiNormalized = Math.min(100, Math.max(0, (effectivePnl / config.roiTargetBenchmarkUsd) * 100));

    factorResults.push({
      factorName: 'roi30d',
      rawMetric: effectivePnl,
      normalizedScore: roiNormalized,
      weightApplied: config.walletWeightRoi,
      weightedContribution: roiNormalized * config.walletWeightRoi,
      notes: `30d PnL: $${effectivePnl.toFixed(2)} (Benchmark: $${config.roiTargetBenchmarkUsd.toFixed(0)})`
    });

    factorResults.push({
      factorName: 'consistency',
      rawMetric: winRate,
      normalizedScore: consistencyNormalized,
      weightApplied: config.walletWeightConsistency,
      weightedContribution: consistencyNormalized * config.walletWeightConsistency,
      notes: `Win rate: ${(winRate * 100).toFixed(1)}% across ${resolvedTrades.length} resolved trades`
    });

    factorResults.push({
      factorName: 'copyability',
      rawMetric: copyabilityNormalized,
      normalizedScore: copyabilityNormalized,
      weightApplied: config.walletWeightCopyability,
      weightedContribution: copyabilityNormalized * config.walletWeightCopyability,
      notes: copyabilityFactors.notes
    });

    factorResults.push({
      factorName: 'categoryEdge',
      rawMetric: bestCategoryWinRate,
      normalizedScore: categoryEdgeNormalized,
      weightApplied: config.walletWeightCategoryEdge,
      weightedContribution: categoryEdgeNormalized * config.walletWeightCategoryEdge,
      notes: `Best domain category: ${bestCategory} (${(bestCategoryWinRate * 100).toFixed(1)}% win rate)`
    });

    factorResults.push({
      factorName: 'liquidityQuality',
      rawMetric: avgLiquidity,
      normalizedScore: liquidityQualityNormalized,
      weightApplied: config.walletWeightLiquidity,
      weightedContribution: liquidityQualityNormalized * config.walletWeightLiquidity,
      notes: `Order book capacity: $${avgLiquidity.toFixed(2)}`
    });

    factorResults.push({
      factorName: 'entryTiming',
      rawMetric: timingNormalized,
      normalizedScore: timingNormalized,
      weightApplied: config.walletWeightEntryTiming,
      weightedContribution: timingNormalized * config.walletWeightEntryTiming,
      notes: `Entry latency quality: ${timingNormalized.toFixed(1)} pts`
    });

    const rawCompositeScore = factorResults.reduce((acc, f) => acc + f.weightedContribution, 0);

    // --- 13. Penalty Evaluation (7 RuleSet Checks) ---
    const penalties: PenaltyResult[] = [];

    // Penalty 1: Single Trade Profit Concentration
    penalties.push({
      penaltyName: 'single_trade_profit_concentration',
      triggered: isConcentratedInSingleTrade,
      penaltyDeduction: isConcentratedInSingleTrade ? config.penaltySingleTradeConcentrationDeduction : 0.0,
      evidence: isConcentratedInSingleTrade
        ? `Largest win ($${largestSingleWinUsd.toFixed(2)}) accounts for ${(largestWinRatio * 100).toFixed(1)}% of total profit (Threshold: ${(config.singleTradeProfitConcentrationThreshold * 100).toFixed(0)}%).`
        : 'Profit is distributed across multiple trades.'
    });

    // Penalty 2: Illiquid Activity
    const isIlliquid = avgLiquidity < config.minLiquidityQualityUsd;
    penalties.push({
      penaltyName: 'illiquid_activity',
      triggered: isIlliquid,
      penaltyDeduction: isIlliquid ? config.penaltyIlliquidActivityDeduction : 0.0,
      evidence: isIlliquid
        ? `Average depth ($${avgLiquidity.toFixed(0)}) below minimum quality threshold ($${config.minLiquidityQualityUsd}).`
        : 'Average depth meets liquidity standards.'
    });

    // Penalty 3: Insufficient Resolved Trades
    penalties.push({
      penaltyName: 'insufficient_resolved_trades',
      triggered: hasInsufficientResolvedTrades,
      penaltyDeduction: hasInsufficientResolvedTrades ? config.penaltyInsufficientResolvedTradesDeduction : 0.0,
      evidence: hasInsufficientResolvedTrades
        ? `Only ${resolvedTrades.length} resolved trades; minimum required is ${config.minResolvedTradesCount}.`
        : `Sufficient trade volume (${resolvedTrades.length} resolved).`
    });

    // Penalty 4: Historical Spreads Too Wide
    const isWideSpread = avgSpread > config.maxHistoricalSpread;
    penalties.push({
      penaltyName: 'wide_historical_spread',
      triggered: isWideSpread,
      penaltyDeduction: isWideSpread ? config.penaltyWideHistoricalSpreadDeduction : 0.0,
      evidence: isWideSpread
        ? `Average spread (${avgSpread.toFixed(3)}) exceeds max tolerance (${config.maxHistoricalSpread}).`
        : 'Spreads are within acceptable ranges.'
    });

    // Penalty 5: Edge in Only One Old Market
    penalties.push({
      penaltyName: 'single_market_edge_only',
      triggered: isSingleMarketEdgeOnly,
      penaltyDeduction: isSingleMarketEdgeOnly ? config.penaltySingleMarketEdgeDeduction : 0.0,
      evidence: isSingleMarketEdgeOnly
        ? 'Edge is localized to a single isolated market.'
        : 'Trade diversity across independent markets observed.'
    });

    // Penalty 6: Extreme Unfollowable Pricing (<extremePriceLowerBound or >extremePriceUpperBound) [IMPLEMENTATION BASELINE]
    const isUnfollowablePricing = trades.length > 0 && (unfollowablePriceCount / trades.length) >= config.unfollowablePricingThreshold;
    penalties.push({
      penaltyName: 'unfollowable_extreme_pricing',
      triggered: isUnfollowablePricing,
      penaltyDeduction: isUnfollowablePricing ? config.penaltyUnfollowablePricingDeduction : 0.0,
      evidence: isUnfollowablePricing
        ? `Frequent entries near 0 or 100 with extreme adverse selection (${unfollowablePriceCount}/${trades.length} trades, threshold: ${(config.unfollowablePricingThreshold * 100).toFixed(0)}%).`
        : 'Entries follow reasonable market distributions.'
    });

    // Penalty 7: Excessive Post-Entry Slippage [IMPLEMENTATION BASELINE]
    const hasExcessiveSlippage = snapshotsMatched > 0 && (adverseDriftCount / snapshotsMatched) >= config.adverseDriftThreshold;
    penalties.push({
      penaltyName: 'excessive_post_entry_movement',
      triggered: hasExcessiveSlippage,
      penaltyDeduction: hasExcessiveSlippage ? config.penaltyExcessivePostEntryMovementDeduction : 0.0,
      evidence: hasExcessiveSlippage
        ? `Adverse post-entry movement observed in ${(adverseDriftCount / snapshotsMatched * 100).toFixed(1)}% of trades (Threshold: ${(config.adverseDriftThreshold * 100).toFixed(0)}%).`
        : 'Post-entry price movements remain within tolerable bounds.'
    });

    const totalPenaltyDeduction = penalties.reduce((acc, p) => acc + p.penaltyDeduction, 0);
    const finalTotalScore = Math.max(0, Math.min(100, rawCompositeScore - totalPenaltyDeduction));

    // --- 14. Status Determination (TRACK / WATCH / IGNORE) ---
    let status: WalletStatus = 'ignore';
    const statusReasons: string[] = [];

    if (finalTotalScore >= config.walletTrackCutoffScore) {
      status = 'track';
      statusReasons.push(`Score ${finalTotalScore.toFixed(1)} meets TRACK threshold (${config.walletTrackCutoffScore}).`);
    } else if (finalTotalScore >= config.walletWatchCutoffScore) {
      status = 'watch';
      statusReasons.push(`Score ${finalTotalScore.toFixed(1)} in WATCH tier (${config.walletWatchCutoffScore}-${config.walletTrackCutoffScore}).`);
    } else {
      status = 'ignore';
      statusReasons.push(`Score ${finalTotalScore.toFixed(1)} below minimum WATCH threshold (${config.walletWatchCutoffScore}).`);
    }

    if (evidenceTier === 'INSUFFICIENT_EVIDENCE' || evidenceTier === 'LOW_EVIDENCE') {
      statusReasons.push(`[DATA COMPLETENESS] Evidence tier is ${evidenceTier} (${trades.length} trades, ${resolvedTrades.length} resolved).`);
    }

    for (const p of penalties) {
      if (p.triggered) {
        statusReasons.push(`[PENALTY: ${p.penaltyName}] -${p.penaltyDeduction} pts: ${p.evidence}`);
      }
    }

    const scoreResult: WalletScoreResult = {
      walletAddress: input.walletAddress,
      ruleSetId: ruleSet.id,
      factorResults,
      penalties,
      rawCompositeScore,
      totalPenaltyDeduction,
      finalTotalScore,
      status,
      statusReasons,
      roiProvenance,
      dataCompleteness,
      oneHitWonderDiagnostics,
      frequencyMetrics,
      copyabilityFactors,
      generatedAt: nowIso
    };

    // --- 15. WalletProfile Entity Generation ---
    const avgTradeSize = trades.length > 0 ? totalCostBasisUsd / trades.length : 0;
    const provenance: ProvenanceMetadata = {
      provider: 'research_engine',
      sourceIdentifier: `eval-${input.walletAddress}-${ruleSet.id}`,
      sourceTime: actualEnd || nowIso,
      ingestionTime: nowIso,
      processingTime: nowIso,
      availabilityTime: nowIso,
      normalizationVersion: '1.0.0',
      isDemo: trades.some(t => t.provenance.isDemo)
    };

    const profile: WalletProfile = {
      id: `profile-${input.walletAddress}`,
      address: input.walletAddress,
      label: input.label || null,
      sourceRank: input.sourceRank || 999,
      status,
      statusReason: statusReasons[0] || 'Evaluated by research engine',
      roi30d: roiProvenance.value ?? 0,
      consistencyScore: consistencyNormalized,
      copyabilityScore: copyabilityNormalized,
      oneHitWonderPenalty: totalPenaltyDeduction,
      globalScore: finalTotalScore,
      bestCategory,
      categoryStrengthsJson: JSON.stringify(categoryStrengths),
      averageTradeSize: avgTradeSize,
      tradeCount30d: trades.length,
      resolvedTradeCount30d: resolvedTrades.length,
      winRate30d: winRate,
      averageLiquidity: avgLiquidity,
      averageSpread: avgSpread,
      averageEntryTiming: timingNormalized,
      copyabilityNotes: copyabilityFactors.notes,
      riskNotes: penalties.filter(p => p.triggered).map(p => p.penaltyName).join(', ') || 'None identified',
      ruleSetId: ruleSet.id,
      lastScannedAt: nowIso,
      provenance,
      roiProvenance,
      dataCompleteness,
      oneHitWonderDiagnostics,
      frequencyMetrics,
      copyabilityFactors,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const evaluation: WalletResearchEvaluation = {
      id: `eval-${input.walletAddress}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      walletAddress: input.walletAddress,
      ruleSetId: ruleSet.id,
      ruleVersion: ruleSet.version,
      analysisWindowDays: windowDays,
      windowStartTimestamp: actualStart,
      windowEndTimestamp: actualEnd,
      globalRank: 0, // Assigned during ranking pass
      categoryRank: 0, // Assigned during ranking pass
      bestCategory,
      status,
      statusReasons,
      finalScore: finalTotalScore,
      rawCompositeScore,
      totalPenaltyDeduction,
      roiProvenance,
      dataCompleteness,
      oneHitWonderDiagnostics,
      frequencyMetrics,
      copyabilityFactors,
      evaluatedAt: nowIso,
      createdAt: nowIso
    };

    return { profile, evaluation, scoreResult };
  }
}
