/**
 * Real-Time Copyability Evaluation Engine (Task 1.6).
 * 
 * Evaluates the real-time execution feasibility of copying an observed wallet trade
 * against current read-only market snapshot state, orderbook depth, spread, and latency.
 * 
 * Invariants:
 * - Pure, deterministic evaluation without network side-effects.
 * - Strictly isolates CURRENT MARKET CONDITION from HISTORICAL WALLET EVIDENCE.
 * - Fail-closed: missing, crossed, or stale market states are labeled accordingly.
 */

import { ObservedTrade, MarketSnapshot, RuleSet, CurrentCopyabilityResult, MarketFreshness, EvidenceCompleteness, CopyabilityClassification } from '../types/domain.js';

export interface CurrentCopyabilityInput {
  trade: ObservedTrade;
  market: MarketSnapshot | null;
  ruleSet: RuleSet;
  detectedAt: string;
  historicalCopyabilityRate?: number | null;
  historicalEvaluationId?: string | null;
  clock?: () => string;
}

export class CurrentCopyabilityEvaluator {
  /**
   * Evaluates real-time copyability for an observed trade under current market conditions.
   */
  public static evaluate(input: CurrentCopyabilityInput): CurrentCopyabilityResult {
    const { trade, market, ruleSet, detectedAt, historicalCopyabilityRate, clock = () => new Date().toISOString() } = input;
    const config = ruleSet.config;
    const evaluatedAt = clock();

    const reasonCodes: string[] = [];
    const riskFlags: string[] = [];

    // --- 1. Validate Market Presence ---
    if (!market) {
      riskFlags.push('MARKET_SNAPSHOT_UNAVAILABLE');
      return {
        classification: 'INSUFFICIENT_DATA',
        currentSpread: null,
        currentLiquidity: null,
        priceDrift: null,
        adverseDrift: null,
        detectionLatencyMs: null,
        marketFreshness: 'UNAVAILABLE',
        timeToResolutionSeconds: null,
        historicalCopyabilityRate: historicalCopyabilityRate ?? null,
        reasonCodes: ['NO_MARKET_SNAPSHOT_FOUND'],
        riskFlags,
        evidenceCompleteness: 'INSUFFICIENT',
        ruleSetId: ruleSet.id,
        ruleVersion: ruleSet.version,
        evaluatedAt
      };
    }

    // --- 2. Snapshot Freshness Classification ---
    const snapshotTimeMs = new Date(market.collectedAt).getTime();
    const detectedTimeMs = new Date(detectedAt).getTime();
    const snapshotAgeSeconds = Math.max(0, (detectedTimeMs - snapshotTimeMs) / 1000);

    let marketFreshness: MarketFreshness = 'FRESH';
    if (isNaN(snapshotTimeMs) || snapshotAgeSeconds < 0) {
      marketFreshness = 'UNAVAILABLE';
      riskFlags.push('INVALID_SNAPSHOT_TIMESTAMP');
    } else if (snapshotAgeSeconds > config.freshnessStaleThresholdSeconds) {
      marketFreshness = 'STALE';
      riskFlags.push(`MARKET_SNAPSHOT_STALE: Age ${snapshotAgeSeconds.toFixed(1)}s exceeds ${config.freshnessStaleThresholdSeconds}s limit.`);
    } else if (snapshotAgeSeconds > config.freshnessAgingThresholdSeconds) {
      marketFreshness = 'AGING';
      riskFlags.push(`MARKET_SNAPSHOT_AGING: Age ${snapshotAgeSeconds.toFixed(1)}s exceeds ${config.freshnessAgingThresholdSeconds}s.`);
    } else {
      reasonCodes.push(`MARKET_SNAPSHOT_FRESH: Age ${snapshotAgeSeconds.toFixed(1)}s.`);
    }

    // --- 3. Order Book Validity Checks ---
    const isCrossedBook = market.bestBid > market.bestAsk && market.bestAsk > 0;
    const hasInvalidPrices = market.bestBid < 0 || market.bestAsk > 1.0 || market.yesPrice < 0 || market.yesPrice > 1.0;
    const hasMissingBook = market.bestBid <= 0 && market.bestAsk <= 0;

    if (isCrossedBook) {
      riskFlags.push(`CROSSED_ORDERBOOK: Best bid ($${market.bestBid.toFixed(3)}) exceeds best ask ($${market.bestAsk.toFixed(3)}).`);
    }
    if (hasInvalidPrices) {
      riskFlags.push(`INVALID_PRICES_DETECTED: Market quotes outside [0.0, 1.0] probability interval.`);
    }
    if (hasMissingBook) {
      riskFlags.push('EMPTY_ORDERBOOK: Zero bids and asks observed.');
    }

    // --- 4. Latency Calculation ---
    let detectionLatencyMs: number | null = null;
    const sourceTimeMs = new Date(trade.sourceTimestamp).getTime();
    if (!isNaN(sourceTimeMs) && !isNaN(detectedTimeMs)) {
      detectionLatencyMs = Math.max(0, detectedTimeMs - sourceTimeMs);
    }

    // --- 5. Current Observable Price & Price Drift ---
    // If trade was BUY on YES, relevant observable price is bestAsk; if SELL, bestBid.
    const observablePrice = trade.outcome.toUpperCase() === 'YES' 
      ? (trade.side === 'BUY' ? (market.bestAsk > 0 ? market.bestAsk : market.yesPrice) : (market.bestBid > 0 ? market.bestBid : market.yesPrice))
      : (trade.side === 'BUY' ? (market.bestAsk > 0 ? market.bestAsk : market.noPrice) : (market.bestBid > 0 ? market.bestBid : market.noPrice));

    const priceDrift = Math.round((observablePrice - trade.walletEntryPrice) * 10000) / 10000;
    
    // Adverse drift: for BUY, higher price is adverse; for SELL, lower price is adverse
    let adverseDrift = 0;
    if (trade.side === 'BUY') {
      adverseDrift = Math.max(0, observablePrice - trade.walletEntryPrice);
    } else {
      adverseDrift = Math.max(0, trade.walletEntryPrice - observablePrice);
    }
    adverseDrift = Math.round(adverseDrift * 10000) / 10000;

    // --- 6. Spread & Liquidity Assessment ---
    const spread = Math.max(0, market.spread);
    const liquidity = Math.max(0, market.liquidity);
    const timeToResolutionSeconds = market.timeToResolution;

    // Time to resolution check
    if (timeToResolutionSeconds > 0 && timeToResolutionSeconds < config.minTimeToResolutionSeconds) {
      riskFlags.push(`NEAR_RESOLUTION: Market resolves in ${Math.round(timeToResolutionSeconds / 60)}m (< ${Math.round(config.minTimeToResolutionSeconds / 60)}m threshold).`);
    }

    // --- 7. Copyability Classification ---
    let classification: CopyabilityClassification = 'COPYABLE';

    // Disqualification rules
    if (isCrossedBook || hasInvalidPrices || marketFreshness === 'UNAVAILABLE') {
      classification = 'INSUFFICIENT_DATA';
    } else if (marketFreshness === 'STALE') {
      classification = 'UNFOLLOWABLE';
      riskFlags.push('STALE_MARKET_CONDITION_UNFOLLOWABLE');
    } else if (
      spread > config.copyUnfollowableSpreadThreshold ||
      adverseDrift > config.copyUnfollowableAdverseDriftThreshold ||
      liquidity <= 0
    ) {
      classification = 'UNFOLLOWABLE';
      if (spread > config.copyUnfollowableSpreadThreshold) {
        riskFlags.push(`EXCESSIVE_SPREAD: $${spread.toFixed(3)} > max unfollowable threshold ($${config.copyUnfollowableSpreadThreshold.toFixed(3)}).`);
      }
      if (adverseDrift > config.copyUnfollowableAdverseDriftThreshold) {
        riskFlags.push(`EXCESSIVE_ADVERSE_DRIFT: $${adverseDrift.toFixed(3)} > max unfollowable drift ($${config.copyUnfollowableAdverseDriftThreshold.toFixed(3)}).`);
      }
      if (liquidity <= 0) {
        riskFlags.push('ZERO_LIQUIDITY_DEPTH');
      }
    } else if (
      spread > config.copyDifficultSpreadThreshold ||
      adverseDrift > config.copyDifficultAdverseDriftThreshold ||
      liquidity < config.copyMinLiquidityThresholdUsd ||
      marketFreshness === 'AGING'
    ) {
      classification = 'DIFFICULT';
      if (spread > config.copyDifficultSpreadThreshold) {
        riskFlags.push(`ELEVATED_SPREAD: $${spread.toFixed(3)} exceeds clean threshold ($${config.copyDifficultSpreadThreshold.toFixed(3)}).`);
      }
      if (adverseDrift > config.copyDifficultAdverseDriftThreshold) {
        riskFlags.push(`ELEVATED_ADVERSE_DRIFT: $${adverseDrift.toFixed(3)} exceeds clean drift threshold ($${config.copyDifficultAdverseDriftThreshold.toFixed(3)}).`);
      }
      if (liquidity < config.copyMinLiquidityThresholdUsd) {
        riskFlags.push(`THIN_LIQUIDITY: $${liquidity.toFixed(0)} < $${config.copyMinLiquidityThresholdUsd.toFixed(0)}.`);
      }
    } else {
      classification = 'COPYABLE';
      reasonCodes.push(`CLEAN_EXECUTION_CONDITIONS: Spread $${spread.toFixed(3)}, adverse drift $${adverseDrift.toFixed(3)}, liquidity $${liquidity.toFixed(0)}.`);
    }

    // Historical copyability corroboration (labeled separately)
    if (historicalCopyabilityRate !== undefined && historicalCopyabilityRate !== null) {
      if (historicalCopyabilityRate >= 0.70) {
        reasonCodes.push(`HISTORICAL_EVIDENCE: Wallet has high historical copyability rate (${(historicalCopyabilityRate * 100).toFixed(0)}%).`);
      } else if (historicalCopyabilityRate < 0.40) {
        riskFlags.push(`HISTORICAL_EVIDENCE: Wallet historically low copyability rate (${(historicalCopyabilityRate * 100).toFixed(0)}%).`);
      }
    }

    // Completeness determination
    let evidenceCompleteness: EvidenceCompleteness = 'COMPLETE';
    if (classification === 'INSUFFICIENT_DATA' || marketFreshness === 'UNAVAILABLE') {
      evidenceCompleteness = 'INSUFFICIENT';
    } else if (marketFreshness === 'AGING' || hasMissingBook) {
      evidenceCompleteness = 'PARTIAL';
    }

    return {
      classification,
      currentSpread: spread,
      currentLiquidity: liquidity,
      priceDrift,
      adverseDrift,
      detectionLatencyMs,
      marketFreshness,
      timeToResolutionSeconds: timeToResolutionSeconds > 0 ? timeToResolutionSeconds : null,
      historicalCopyabilityRate: historicalCopyabilityRate ?? null,
      reasonCodes,
      riskFlags,
      evidenceCompleteness,
      ruleSetId: ruleSet.id,
      ruleVersion: ruleSet.version,
      evaluatedAt
    };
  }
}
