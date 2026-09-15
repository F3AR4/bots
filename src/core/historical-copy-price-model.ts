/**
 * Historical Copy Price Model.
 * 
 * Safety & Integrity:
 * - RESEARCH ONLY: Models hypothetical execution prices based on observable historical states.
 * - NOT a live execution engine: Does not place orders, sign transactions, or promise fills.
 * - Explicit fill-model tiers: EXACT_OBSERVED, TOP_OF_BOOK, MIDPOINT, STALE_SNAPSHOT, UNAVAILABLE.
 * - Preserves missingness without synthesizing unbacked numbers.
 */

import {
  ObservedTrade,
  MarketSnapshot,
  RuleSetConfig,
  HistoricalCopyPriceModelResult,
  FillModelTier
} from '../types/domain.js';

export class HistoricalCopyPriceModel {
  /**
   * Evaluates the realistic hypothetical fill price for an observed trade given market state.
   */
  public static evaluateCopyPrice(
    trade: ObservedTrade,
    snapshot: MarketSnapshot | null,
    config: RuleSetConfig
  ): HistoricalCopyPriceModelResult {
    const assumptions: string[] = [];

    // Case 1: No snapshot available
    if (!snapshot) {
      return {
        modeledCopyPrice: null,
        modeledCopyTimestamp: null,
        fillModel: 'UNAVAILABLE',
        spreadAtCopy: null,
        spreadBpsAtCopy: null,
        liquidityAtCopy: null,
        priceDeltaFromWallet: null,
        relativeTradeSizeToDepth: null,
        modelConfidence: 0.0,
        evidenceCompleteness: 0.0,
        assumptionsUsed: ['No market snapshot available for target market ID'],
        isAvailable: false
      };
    }

    // Validate timestamps
    const tradeEntryMs = new Date(trade.sourceTimestamp).getTime();
    const snapshotMs = new Date(snapshot.collectedAt).getTime();
    
    // Check for future-dated or impossible timestamps
    if (isNaN(tradeEntryMs) || isNaN(snapshotMs)) {
      return {
        modeledCopyPrice: null,
        modeledCopyTimestamp: null,
        fillModel: 'UNAVAILABLE',
        spreadAtCopy: null,
        spreadBpsAtCopy: null,
        liquidityAtCopy: null,
        priceDeltaFromWallet: null,
        relativeTradeSizeToDepth: null,
        modelConfidence: 0.0,
        evidenceCompleteness: 0.0,
        assumptionsUsed: ['Invalid or non-parsable timestamp in trade or market snapshot'],
        isAvailable: false
      };
    }

    const latencySeconds = Math.max(0, (snapshotMs - tradeEntryMs) / 1000);
    const maxAgeSeconds = config.maxSnapshotAgeSeconds || 60;
    const isStale = latencySeconds > maxAgeSeconds;

    // Check for impossible prices outside [0.0, 1.0] binary bounds
    if (
      snapshot.bestAsk > 1.0 || snapshot.bestAsk < 0.0 ||
      snapshot.bestBid > 1.0 || snapshot.bestBid < 0.0 ||
      snapshot.yesPrice > 1.0 || snapshot.yesPrice < 0.0
    ) {
      return {
        modeledCopyPrice: null,
        modeledCopyTimestamp: snapshot.collectedAt,
        fillModel: 'UNAVAILABLE',
        spreadAtCopy: null,
        spreadBpsAtCopy: null,
        liquidityAtCopy: null,
        priceDeltaFromWallet: null,
        relativeTradeSizeToDepth: null,
        modelConfidence: 0.0,
        evidenceCompleteness: 0.0,
        assumptionsUsed: ['Market snapshot exhibits impossible price outside binary bounds [0.0, 1.0]'],
        isAvailable: false
      };
    }

    // Validate market price bounds [0.0, 1.0]
    const hasValidQuotes = 
      snapshot.bestAsk > 0 && 
      snapshot.bestAsk <= 1.0 && 
      snapshot.bestBid >= 0 && 
      snapshot.bestBid <= 1.0;

    // Check for crossed order book (bid > ask is an invalid market condition)
    if (hasValidQuotes && snapshot.bestBid > snapshot.bestAsk) {
      return {
        modeledCopyPrice: null,
        modeledCopyTimestamp: snapshot.collectedAt,
        fillModel: 'UNAVAILABLE',
        spreadAtCopy: null,
        spreadBpsAtCopy: null,
        liquidityAtCopy: snapshot.liquidity > 0 ? snapshot.liquidity : null,
        priceDeltaFromWallet: null,
        relativeTradeSizeToDepth: null,
        modelConfidence: 0.0,
        evidenceCompleteness: 0.3,
        assumptionsUsed: ['Market snapshot exhibits crossed book condition (bestBid > bestAsk)'],
        isAvailable: false
      };
    }

    let modeledPrice: number | null = null;
    let fillModel: FillModelTier = 'UNAVAILABLE';
    let confidence = 0.0;

    // Model execution price based on trade side
    if (trade.side === 'BUY') {
      if (hasValidQuotes && snapshot.bestAsk > 0) {
        modeledPrice = snapshot.bestAsk;
        fillModel = isStale ? 'STALE_SNAPSHOT' : 'TOP_OF_BOOK';
        confidence = isStale ? 0.40 : 0.90;
        assumptions.push(`Modeled BUY fill at historical top-of-book ask: $${modeledPrice.toFixed(3)}`);
      } else if (snapshot.yesPrice > 0 && snapshot.yesPrice <= 1.0) {
        modeledPrice = snapshot.yesPrice;
        fillModel = isStale ? 'STALE_SNAPSHOT' : 'MIDPOINT';
        confidence = isStale ? 0.25 : 0.50;
        assumptions.push(`Modeled BUY fill at midpoint / last price: $${modeledPrice.toFixed(3)} (quotes missing)`);
      }
    } else {
      // Side is SELL
      if (hasValidQuotes && snapshot.bestBid > 0) {
        modeledPrice = snapshot.bestBid;
        fillModel = isStale ? 'STALE_SNAPSHOT' : 'TOP_OF_BOOK';
        confidence = isStale ? 0.40 : 0.90;
        assumptions.push(`Modeled SELL fill at historical top-of-book bid: $${modeledPrice.toFixed(3)}`);
      } else if (snapshot.yesPrice > 0 && snapshot.yesPrice <= 1.0) {
        modeledPrice = snapshot.yesPrice;
        fillModel = isStale ? 'STALE_SNAPSHOT' : 'MIDPOINT';
        confidence = isStale ? 0.25 : 0.50;
        assumptions.push(`Modeled SELL fill at midpoint / last price: $${modeledPrice.toFixed(3)} (quotes missing)`);
      }
    }

    if (isStale) {
      assumptions.push(`Snapshot latency (${latencySeconds.toFixed(1)}s) exceeds max threshold (${maxAgeSeconds}s)`);
    }

    if (modeledPrice === null) {
      return {
        modeledCopyPrice: null,
        modeledCopyTimestamp: snapshot.collectedAt,
        fillModel: 'UNAVAILABLE',
        spreadAtCopy: snapshot.spread > 0 ? snapshot.spread : null,
        spreadBpsAtCopy: null,
        liquidityAtCopy: snapshot.liquidity > 0 ? snapshot.liquidity : null,
        priceDeltaFromWallet: null,
        relativeTradeSizeToDepth: null,
        modelConfidence: 0.0,
        evidenceCompleteness: 0.2,
        assumptionsUsed: ['Unable to model executable price from snapshot quotes or midpoint'],
        isAvailable: false
      };
    }

    // Compute spreads and liquidity
    const spreadAtCopy = snapshot.spread > 0 ? snapshot.spread : Math.max(0, snapshot.bestAsk - snapshot.bestBid);
    const spreadBpsAtCopy = modeledPrice > 0 ? Math.round((spreadAtCopy / modeledPrice) * 10000) : null;
    const liquidityAtCopy = snapshot.liquidity > 0 ? snapshot.liquidity : null;
    const priceDeltaFromWallet = Math.round((modeledPrice - trade.walletEntryPrice) * 10000) / 10000;
    
    const relativeTradeSizeToDepth = (liquidityAtCopy && liquidityAtCopy > 0 && trade.size > 0)
      ? Math.round((trade.size / liquidityAtCopy) * 1000) / 1000
      : null;

    if (relativeTradeSizeToDepth && relativeTradeSizeToDepth > 0.50) {
      assumptions.push(`Trade size ($${trade.size}) exceeds 50% of top-of-book depth ($${liquidityAtCopy})`);
    }

    const evidenceCompleteness = (hasValidQuotes ? 0.5 : 0.2) + (liquidityAtCopy ? 0.3 : 0.0) + (isStale ? 0.0 : 0.2);

    return {
      modeledCopyPrice: Math.round(modeledPrice * 1000) / 1000,
      modeledCopyTimestamp: snapshot.collectedAt,
      fillModel,
      spreadAtCopy: Math.round(spreadAtCopy * 1000) / 1000,
      spreadBpsAtCopy,
      liquidityAtCopy,
      priceDeltaFromWallet,
      relativeTradeSizeToDepth,
      modelConfidence: Math.round(confidence * 100) / 100,
      evidenceCompleteness: Math.round(evidenceCompleteness * 100) / 100,
      assumptionsUsed: assumptions,
      isAvailable: true
    };
  }
}
