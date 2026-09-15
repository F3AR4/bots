/**
 * Deterministic Trade Scoring & Decision Engine.
 * 
 * Implements:
 * - Multi-factor trade evaluation:
 *   1. Wallet Quality Score
 *   2. Category Fit Score
 *   3. Price Movement / Drift
 *   4. Spread Tolerance
 *   5. Liquidity Depth
 *   6. Entry Timing / Latency
 *   7. Thesis Clarity
 * - Tri-state Decision: 'paper_copy' | 'watchlist' | 'skip'
 * - Preserves complete explainability (sub-scores, reasons, risks).
 * - Sizing strictly bounded to [$5.00, $20.00] for paper_copy.
 */

import { ObservedTrade, MarketSnapshot, WalletProfile, RuleSet, CurrentCopyabilityResult } from '../types/domain.js';
import { TradeScoreResult, TradeFactorResult } from '../types/scoring.js';

export class TradeScorer {
  /**
   * Deterministically evaluates an observed trade against market conditions and RuleSet.
   */
  public static evaluateTrade(
    trade: ObservedTrade,
    market: MarketSnapshot,
    wallet: WalletProfile,
    ruleSet: RuleSet,
    copyabilityOrClock?: CurrentCopyabilityResult | null | (() => string),
    clockParam?: () => string
  ): TradeScoreResult {
    let copyability: CurrentCopyabilityResult | null = null;
    let clock: () => string = () => new Date().toISOString();

    if (typeof copyabilityOrClock === 'function') {
      clock = copyabilityOrClock;
    } else {
      copyability = copyabilityOrClock ?? null;
      if (clockParam) clock = clockParam;
    }

    const config = ruleSet.config;
    const factorResults: TradeFactorResult[] = [];
    const reasons: string[] = [];
    const risks: string[] = [];

    // --- Hard Gate: Wallet Status ---
    if (wallet.status === 'ignore') {
      risks.push(`Wallet ${wallet.address} is marked IGNORE: ${wallet.statusReason}`);
      return {
        observedTradeId: trade.id,
        marketSnapshotId: market.id,
        walletAddress: trade.walletAddress,
        marketId: trade.marketId,
        ruleSetId: ruleSet.id,
        factorResults: [],
        compositeCopyScore: 0,
        confidence: 0,
        decision: 'skip',
        reasons: [],
        risks,
        simulatedPositionSize: 0,
        generatedAt: clock()
      };
    }

    // --- Dimension 1: Wallet Quality Score ---
    const walletQualityScore = wallet.globalScore;
    factorResults.push({
      dimension: 'walletQuality',
      rawMetric: wallet.globalScore,
      normalizedScore: walletQualityScore,
      weightApplied: config.tradeWeightWalletQuality,
      weightedContribution: walletQualityScore * config.tradeWeightWalletQuality,
      notes: `Wallet global reputation score: ${wallet.globalScore.toFixed(1)}`
    });
    if (walletQualityScore >= config.walletTrackCutoffScore) {
      reasons.push(`High wallet reputation score (${walletQualityScore.toFixed(1)}).`);
    } else {
      risks.push(`Moderate or low wallet reputation (${walletQualityScore.toFixed(1)}).`);
    }

    // --- Dimension 2: Category Fit Score ---
    let categoryFitScore = 50.0;
    try {
      const strengths = JSON.parse(wallet.categoryStrengthsJson) as Record<
        string,
        { winRate?: number; wins?: number; resolvedTrades?: number }
      >;
      const cat = strengths[trade.marketCategory];
      if (cat) {
        if (cat.winRate !== undefined) {
          categoryFitScore = cat.winRate * 100;
        } else if (cat.wins !== undefined && cat.resolvedTrades !== undefined && cat.resolvedTrades > 0) {
          categoryFitScore = (cat.wins / cat.resolvedTrades) * 100;
        }
      }
    } catch {
      categoryFitScore = 50.0;
    }
    factorResults.push({
      dimension: 'categoryFit',
      rawMetric: categoryFitScore,
      normalizedScore: categoryFitScore,
      weightApplied: config.tradeWeightCategoryFit,
      weightedContribution: categoryFitScore * config.tradeWeightCategoryFit,
      notes: `Wallet historical win rate in ${trade.marketCategory}: ${categoryFitScore.toFixed(1)}%`
    });
    if (categoryFitScore >= 70) {
      reasons.push(`Strong category edge in ${trade.marketCategory} (${categoryFitScore.toFixed(0)}%).`);
    }

    // --- Dimension 3: Price Movement / Drift ---
    const priceDrift = Math.abs(trade.detectedPrice - trade.walletEntryPrice);
    const driftRatio = priceDrift / Math.max(0.01, trade.walletEntryPrice);
    const driftScore = Math.max(0, 100 - (driftRatio / config.maxAllowedPriceDrift) * 100);
    factorResults.push({
      dimension: 'priceMovement',
      rawMetric: priceDrift,
      normalizedScore: driftScore,
      weightApplied: config.tradeWeightPriceMovement,
      weightedContribution: driftScore * config.tradeWeightPriceMovement,
      notes: `Price drift: $${priceDrift.toFixed(3)} (Entry: $${trade.walletEntryPrice.toFixed(3)}, Current: $${trade.detectedPrice.toFixed(3)})`
    });
    if (priceDrift > config.maxAllowedPriceDrift) {
      risks.push(`Price drift ($${priceDrift.toFixed(3)}) exceeds allowed threshold ($${config.maxAllowedPriceDrift}).`);
    } else {
      reasons.push(`Minimal price drift ($${priceDrift.toFixed(3)}) within tolerance.`);
    }

    // --- Dimension 4: Spread Score ---
    const spread = market.spread;
    const spreadScore = Math.max(0, 100 - (spread / config.maxAllowedSpread) * 100);
    factorResults.push({
      dimension: 'spread',
      rawMetric: spread,
      normalizedScore: spreadScore,
      weightApplied: config.tradeWeightSpread,
      weightedContribution: spreadScore * config.tradeWeightSpread,
      notes: `Market spread: $${spread.toFixed(3)} (Max: $${config.maxAllowedSpread})`
    });
    if (spread > config.maxAllowedSpread) {
      risks.push(`Wide bid-ask spread ($${spread.toFixed(3)}) exceeds max threshold ($${config.maxAllowedSpread}).`);
    } else {
      reasons.push(`Tight spread ($${spread.toFixed(3)}).`);
    }

    // --- Dimension 5: Liquidity Depth ---
    const liquidity = market.liquidity;
    const liquidityScore = Math.min(100, (liquidity / config.minTradeLiquidityUsd) * 100);
    factorResults.push({
      dimension: 'liquidity',
      rawMetric: liquidity,
      normalizedScore: liquidityScore,
      weightApplied: config.tradeWeightLiquidity,
      weightedContribution: liquidityScore * config.tradeWeightLiquidity,
      notes: `Top-of-book depth: $${liquidity.toFixed(0)} (Min: $${config.minTradeLiquidityUsd})`
    });
    if (liquidity < config.minTradeLiquidityUsd) {
      risks.push(`Low book liquidity ($${liquidity.toFixed(0)}) below threshold ($${config.minTradeLiquidityUsd}).`);
    } else {
      reasons.push(`Adequate book depth ($${liquidity.toFixed(0)}).`);
    }

    // --- Dimension 6: Entry Timing ---
    // Measure latency if timestamps present, otherwise use baseline
    let timingScore = config.defaultTradeEntryTimingScore;
    if (trade.sourceTimestamp && trade.provenance?.ingestionTime) {
      const latencyMs = Math.max(0, new Date(trade.provenance.ingestionTime).getTime() - new Date(trade.sourceTimestamp).getTime());
      const latencySeconds = latencyMs / 1000;
      timingScore = Math.max(0, Math.min(100, 100 - (latencySeconds / 30) * 100)); // 30s latency decay
    }
    factorResults.push({
      dimension: 'entryTiming',
      rawMetric: timingScore,
      normalizedScore: timingScore,
      weightApplied: config.tradeWeightEntryTiming,
      weightedContribution: timingScore * config.tradeWeightEntryTiming,
      notes: `Entry timing quality: ${timingScore.toFixed(1)} pts`
    });

    // --- Dimension 7: Thesis Clarity ---
    // Task 1.6 Invariant: No artificial NLP/AI models. Clearly state provenance.
    const thesisScore = config.defaultThesisScore;
    factorResults.push({
      dimension: 'thesis',
      rawMetric: thesisScore,
      normalizedScore: thesisScore,
      weightApplied: config.tradeWeightThesis,
      weightedContribution: thesisScore * config.tradeWeightThesis,
      notes: `Thesis clarity: NOT_SUPPORTED_BY_SOURCE_DATA (baseline fallback: ${thesisScore.toFixed(1)} pts)`
    });

    // --- Composite Copy Score ---
    const compositeCopyScore = factorResults.reduce((acc, f) => acc + f.weightedContribution, 0);

    // --- Decision Determination ---
    let decision: 'paper_copy' | 'watchlist' | 'skip' = 'skip';
    let confidence = 0.0;
    let simulatedPositionSize = 0.0;

    // Hard disqualification checks (Copyability Gate per DECISION_MODEL.md Step 2)
    const violatesHardSpread = spread > config.maxAllowedSpread;
    const violatesHardDrift = priceDrift > config.maxAllowedPriceDrift;
    const violatesLiquidity = liquidity < config.minTradeLiquidityUsd;
    const violatesWalletQuality = wallet.globalScore < config.walletTrackCutoffScore;
    const isNearResolution = market.timeToResolution > 0 && market.timeToResolution < config.minTimeToResolutionSeconds;

    if (violatesHardSpread || violatesHardDrift || violatesLiquidity || violatesWalletQuality) {
      decision = 'skip';
      if (violatesHardSpread) {
        risks.push(`Spread ($${spread.toFixed(3)}) exceeds active threshold ($${config.maxAllowedSpread.toFixed(3)}).`);
      }
      if (violatesHardDrift) {
        risks.push(`Price drift ($${priceDrift.toFixed(3)}) exceeds active tolerance ($${config.maxAllowedPriceDrift.toFixed(3)}).`);
      }
      if (violatesLiquidity) {
        risks.push(`Liquidity ($${liquidity.toFixed(0)}) is below minimum requirement ($${config.minTradeLiquidityUsd.toFixed(0)}).`);
      }
      if (violatesWalletQuality) {
        risks.push(`Wallet quality score (${wallet.globalScore.toFixed(1)}) is below minimum track threshold (${config.walletTrackCutoffScore.toFixed(1)}).`);
      }
    } else if (isNearResolution) {
      decision = 'skip';
      risks.push(`Market resolves in ${Math.round(market.timeToResolution / 60)}m (< ${Math.round(config.minTimeToResolutionSeconds / 60)}m threshold). Volatility risk high.`);
    } else if (compositeCopyScore >= config.minPaperCopyScore) {
      decision = 'paper_copy';
      // Sizing between $5 and $20 bounded
      confidence = Math.min(1.0, Math.max(0.0, (compositeCopyScore - config.minPaperCopyScore) / (100 - config.minPaperCopyScore)));
      // Interpolate between min and max bounds ($5.00 to $20.00)
      simulatedPositionSize = config.simulatedBetMin + (config.simulatedBetMax - config.simulatedBetMin) * confidence;
      simulatedPositionSize = Math.round(simulatedPositionSize * 100) / 100;
      reasons.push(`Score ${compositeCopyScore.toFixed(1)} qualifies for simulated copy ($${simulatedPositionSize.toFixed(2)}).`);
    } else if (compositeCopyScore >= config.minWatchlistScore) {
      decision = 'watchlist';
      confidence = (compositeCopyScore - config.minWatchlistScore) / (config.minPaperCopyScore - config.minWatchlistScore);
      reasons.push(`Score ${compositeCopyScore.toFixed(1)} placed on watchlist for benchmark comparison.`);
    } else {
      decision = 'skip';
      risks.push(`Score ${compositeCopyScore.toFixed(1)} below watchlist cutoff (${config.minWatchlistScore}).`);
    }

    // --- Post-Decision Gating via Real-Time Copyability & Wallet Status ---
    if (copyability) {
      if (copyability.reasonCodes.length > 0) {
        for (const rc of copyability.reasonCodes) {
          if (!reasons.includes(rc)) reasons.push(rc);
        }
      }
      if (copyability.riskFlags.length > 0) {
        for (const rf of copyability.riskFlags) {
          if (!risks.includes(rf)) risks.push(rf);
        }
      }

      if (copyability.classification === 'INSUFFICIENT_DATA') {
        decision = 'skip';
        risks.push('Copyability evaluation indicates INSUFFICIENT_DATA.');
      } else if (copyability.marketFreshness === 'STALE') {
        decision = config.staleMarketDecision;
        risks.push(`Market data is STALE. Downgraded to ${config.staleMarketDecision}.`);
      } else if (copyability.classification === 'UNFOLLOWABLE') {
        decision = 'skip';
        risks.push('Copyability evaluation indicates UNFOLLOWABLE market conditions.');
      }
    }

    // WATCH status wallet gate: unless config explicitly allows it, WATCH cannot create paper trades
    if (wallet.status === 'watch' && !config.allowWatchWalletCopy && decision === 'paper_copy') {
      decision = 'watchlist';
      risks.push(`Wallet ${wallet.address} is status WATCH: RuleSet prohibits automatic paper_copy without TRACK status.`);
    }

    // Zero position size if not paper_copy
    if (decision !== 'paper_copy') {
      simulatedPositionSize = 0.0;
    }

    return {
      observedTradeId: trade.id,
      marketSnapshotId: market.id,
      walletAddress: trade.walletAddress,
      marketId: trade.marketId,
      ruleSetId: ruleSet.id,
      factorResults,
      compositeCopyScore,
      confidence,
      decision,
      reasons,
      risks,
      simulatedPositionSize,
      generatedAt: clock()
    };
  }
}
