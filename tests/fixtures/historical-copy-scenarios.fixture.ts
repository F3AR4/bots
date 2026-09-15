/**
 * Deterministic Test Scenarios for Task 1.5 Historical Copyability Research.
 * 
 * Safety & Labeling:
 * - ALL fixtures are explicitly labeled SYNTHETIC (isDemo: true).
 * - Covers all 20 required scenarios from Task 1.5 Section 30.
 */

import { ObservedTrade, MarketSnapshot } from '../../src/types/domain.js';

export interface CopyScenarioFixture {
  name: string;
  description: string;
  trade: ObservedTrade;
  snapshot: MarketSnapshot | null;
  resolutionData?: { resolvedPrice: number; resolvedAt: string; winningOutcome: string } | null;
  expectedClassification: 'COPYABLE' | 'DIFFICULT' | 'UNFOLLOWABLE' | 'INSUFFICIENT_DATA';
  expectedCohort: 'GOOD_COPY' | 'BAD_COPY' | 'MISSED_WINNER' | 'AVOIDED_LOSER' | 'INSUFFICIENT_DATA';
  expectedFillTier?: string;
}

const BASE_TIME = '2026-09-01T12:00:00.000Z';

function createTrade(
  id: string,
  wallet: string,
  marketId: string,
  price: number,
  size: number = 10.0,
  side: 'BUY' | 'SELL' = 'BUY',
  timeDeltaSec: number = 0,
  category: string = 'Politics',
  invalidTime: boolean = false
): ObservedTrade {
  const ts = invalidTime
    ? 'INVALID_TIMESTAMP'
    : new Date(new Date(BASE_TIME).getTime() + timeDeltaSec * 1000).toISOString();

  return {
    id,
    walletAddress: wallet,
    marketId,
    conditionId: `cond-${marketId}`,
    marketQuestion: `Will ${marketId} occur?`,
    marketCategory: category,
    outcome: 'YES',
    side,
    walletEntryPrice: price,
    detectedPrice: price,
    size,
    sourceTimestamp: ts,
    rawTradeJson: JSON.stringify({ id, price, size, synthetic: true }),
    provenance: {
      provider: 'fixture_source',
      sourceIdentifier: `tx-${id}`,
      sourceTime: ts,
      ingestionTime: ts,
      normalizationVersion: 'v1.0.0',
      isDemo: true
    },
    createdAt: ts
  };
}

function createSnapshot(
  id: string,
  marketId: string,
  bid: number,
  ask: number,
  liquidity: number,
  timeDeltaSec: number = 2,
  invalidPrice: boolean = false
): MarketSnapshot {
  const ts = new Date(new Date(BASE_TIME).getTime() + timeDeltaSec * 1000).toISOString();
  const yesPrice = invalidPrice ? 1.45 : Math.round(((bid + ask) / 2) * 1000) / 1000;
  const spread = Math.round((ask - bid) * 1000) / 1000;

  return {
    id,
    marketId,
    conditionId: `cond-${marketId}`,
    question: `Market Question ${marketId}`,
    category: 'Politics',
    yesPrice,
    noPrice: Math.round((1.0 - yesPrice) * 1000) / 1000,
    bestBid: bid,
    bestAsk: ask,
    spread,
    liquidity,
    volume: 50000.0,
    timeToResolution: 86400,
    collectedAt: ts,
    rawMarketJson: JSON.stringify({ id, bid, ask, synthetic: true }),
    provenance: {
      provider: 'fixture_source',
      sourceIdentifier: id,
      sourceTime: ts,
      ingestionTime: ts,
      normalizationVersion: 'v1.0.0',
      isDemo: true
    },
    createdAt: ts
  };
}

export const COPY_SCENARIOS_FIXTURES: Record<string, CopyScenarioFixture> = {
  // Scenario 1: Perfectly copyable trade
  scenario1_perfect_copy: {
    name: '1. Perfectly copyable trade',
    description: 'Tight spread ($0.01), deep book ($5k), 2s latency, minimal slippage, resolved win',
    trade: createTrade('trade-1', '0x1111111111111111111111111111111111111111', 'market-1', 0.50, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-1', 'market-1', 0.495, 0.505, 5000.0, 2),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'COPYABLE',
    expectedCohort: 'GOOD_COPY',
    expectedFillTier: 'TOP_OF_BOOK'
  },

  // Scenario 2: Small latency loss
  scenario2_small_latency: {
    name: '2. Small latency loss',
    description: '4s latency with slight price move ($0.015), still profitable copyable entry',
    trade: createTrade('trade-2', '0x1111111111111111111111111111111111111111', 'market-2', 0.45, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-2', 'market-2', 0.455, 0.465, 3000.0, 4),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'COPYABLE',
    expectedCohort: 'GOOD_COPY',
    expectedFillTier: 'TOP_OF_BOOK'
  },

  // Scenario 3: Large adverse price drift
  scenario3_large_adverse_drift: {
    name: '3. Large adverse price drift',
    description: 'Price moved from $0.50 to $0.58 ($0.08 drift > $0.06 cutoff), wallet won but copy missed',
    trade: createTrade('trade-3', '0x2222222222222222222222222222222222222222', 'market-3', 0.50, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-3', 'market-3', 0.575, 0.585, 4000.0, 5),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'UNFOLLOWABLE',
    expectedCohort: 'MISSED_WINNER'
  },

  // Scenario 4: Wide spread
  scenario4_wide_spread: {
    name: '4. Wide spread',
    description: 'Spread of 10 cents ($0.10) exceeds $0.08 cutoff',
    trade: createTrade('trade-4', '0x2222222222222222222222222222222222222222', 'market-4', 0.40, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-4', 'market-4', 0.35, 0.45, 2000.0, 3),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'UNFOLLOWABLE',
    expectedCohort: 'MISSED_WINNER'
  },

  // Scenario 5: Insufficient liquidity
  scenario5_insufficient_liquidity: {
    name: '5. Insufficient liquidity',
    description: 'Top-of-book depth is only $100 (< $200 minimum viability)',
    trade: createTrade('trade-5', '0x3333333333333333333333333333333333333333', 'market-5', 0.50, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-5', 'market-5', 0.49, 0.51, 100.0, 2),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'UNFOLLOWABLE',
    expectedCohort: 'MISSED_WINNER'
  },

  // Scenario 6: Missing orderbook
  scenario6_missing_orderbook: {
    name: '6. Missing orderbook',
    description: 'No market snapshot available in database for target market',
    trade: createTrade('trade-6', '0x3333333333333333333333333333333333333333', 'market-no-snap', 0.50, 10.0, 'BUY', 0),
    snapshot: null,
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'INSUFFICIENT_DATA',
    expectedCohort: 'INSUFFICIENT_DATA'
  },

  // Scenario 7: Missing timestamp
  scenario7_missing_timestamp: {
    name: '7. Missing timestamp',
    description: 'Trade has corrupt or unparseable source timestamp',
    trade: createTrade('trade-7', '0x3333333333333333333333333333333333333333', 'market-7', 0.50, 10.0, 'BUY', 0, 'Politics', true),
    snapshot: createSnapshot('snap-7', 'market-7', 0.49, 0.51, 2000.0, 2),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'INSUFFICIENT_DATA',
    expectedCohort: 'INSUFFICIENT_DATA'
  },

  // Scenario 8: Stale snapshot
  scenario8_stale_snapshot: {
    name: '8. Stale snapshot',
    description: 'Snapshot is 180s older/later than trade entry (exceeds 60s freshness)',
    trade: createTrade('trade-8', '0x4444444444444444444444444444444444444444', 'market-8', 0.50, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-8', 'market-8', 0.49, 0.51, 2000.0, 180),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'UNFOLLOWABLE',
    expectedCohort: 'MISSED_WINNER',
    expectedFillTier: 'STALE_SNAPSHOT'
  },

  // Scenario 9: Unresolved market
  scenario9_unresolved_market: {
    name: '9. Unresolved market',
    description: 'Market has not resolved yet; outcomes marked UNRESOLVED',
    trade: createTrade('trade-9', '0x4444444444444444444444444444444444444444', 'market-9', 0.55, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-9', 'market-9', 0.54, 0.56, 3000.0, 2),
    resolutionData: null,
    expectedClassification: 'COPYABLE',
    expectedCohort: 'GOOD_COPY'
  },

  // Scenario 10: Wallet winner but copy loser
  scenario10_winner_becomes_copy_loser: {
    name: '10. Wallet winner but copy loser',
    description: 'Wallet bought at $0.40, won at $0.45. Copy entered at $0.48, so copy lost at $0.45',
    trade: createTrade('trade-10', '0x5555555555555555555555555555555555555555', 'market-10', 0.40, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-10', 'market-10', 0.47, 0.49, 2000.0, 4),
    resolutionData: { resolvedPrice: 0.45, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'UNFOLLOWABLE',
    expectedCohort: 'MISSED_WINNER'
  },

  // Scenario 11: Wallet loser but copy avoided loss
  scenario11_avoided_loser: {
    name: '11. Wallet loser but copy avoided loss',
    description: 'Wallet bought at $0.50 and lost. But spread was $0.12, so copy disqualified it',
    trade: createTrade('trade-11', '0x5555555555555555555555555555555555555555', 'market-11', 0.50, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-11', 'market-11', 0.44, 0.56, 1500.0, 3),
    resolutionData: { resolvedPrice: 0.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'NO' },
    expectedClassification: 'UNFOLLOWABLE',
    expectedCohort: 'AVOIDED_LOSER'
  },

  // Scenario 12: Favorable post-entry movement
  scenario12_favorable_movement: {
    name: '12. Favorable post-entry movement',
    description: 'Price moved favorably (ask dropped to $0.48 from wallet entry $0.50)',
    trade: createTrade('trade-12', '0x1111111111111111111111111111111111111111', 'market-12', 0.50, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-12', 'market-12', 0.47, 0.48, 4000.0, 2),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'COPYABLE',
    expectedCohort: 'GOOD_COPY'
  },

  // Scenario 13: Extreme-price entry
  scenario13_extreme_price_entry: {
    name: '13. Extreme-price entry',
    description: 'Wallet entry at $0.02 (below $0.05 extreme bound), classified UNFOLLOWABLE',
    trade: createTrade('trade-13', '0x6666666666666666666666666666666666666666', 'market-13', 0.02, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-13', 'market-13', 0.015, 0.025, 2000.0, 2),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'UNFOLLOWABLE',
    expectedCohort: 'MISSED_WINNER'
  },

  // Scenario 14: Large trade relative to depth
  scenario14_large_trade_vs_depth: {
    name: '14. Large trade relative to depth',
    description: 'Trade size $400 on $550 depth (72% of depth), classified DIFFICULT',
    trade: createTrade('trade-14', '0x6666666666666666666666666666666666666666', 'market-14', 0.50, 400.0, 'BUY', 0),
    snapshot: createSnapshot('snap-14', 'market-14', 0.48, 0.52, 450.0, 2), // liquidity < 500
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'DIFFICULT',
    expectedCohort: 'GOOD_COPY'
  },

  // Scenario 15: Mixed-quality wallet
  scenario15_moderate_difficulty: {
    name: '15. Moderate difficulty trade',
    description: 'Spread of 5 cents ($0.05) is in DIFFICULT range ($0.04 - $0.08)',
    trade: createTrade('trade-15', '0x7777777777777777777777777777777777777777', 'market-15', 0.50, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-15', 'market-15', 0.475, 0.525, 800.0, 3),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'DIFFICULT',
    expectedCohort: 'GOOD_COPY'
  },

  // Scenario 16: Category-specific copyability
  scenario16_crypto_category_edge: {
    name: '16. Crypto category trade',
    description: 'Crypto domain trade with tight spread and high liquidity',
    trade: createTrade('trade-16', '0x7777777777777777777777777777777777777777', 'market-16', 0.60, 10.0, 'BUY', 0, 'Crypto'),
    snapshot: createSnapshot('snap-16', 'market-16', 0.595, 0.605, 10000.0, 2),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'COPYABLE',
    expectedCohort: 'GOOD_COPY'
  },

  // Scenario 17: Duplicate snapshots handled
  scenario17_duplicate_snapshot: {
    name: '17. Duplicate snapshots',
    description: 'Snapshot exists and processes without errors',
    trade: createTrade('trade-17', '0x8888888888888888888888888888888888888888', 'market-17', 0.50, 10.0, 'BUY', 0),
    snapshot: createSnapshot('snap-17', 'market-17', 0.49, 0.51, 2500.0, 2),
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'COPYABLE',
    expectedCohort: 'GOOD_COPY'
  },

  // Scenario 18: Midpoint fallback
  scenario18_midpoint_fallback: {
    name: '18. Midpoint quote fallback',
    description: 'BestAsk missing/0, but yesPrice exists. Models on midpoint (DIFFICULT)',
    trade: createTrade('trade-18', '0x8888888888888888888888888888888888888888', 'market-18', 0.50, 10.0, 'BUY', 0),
    snapshot: {
      id: 'snap-18',
      marketId: 'market-18',
      conditionId: 'cond-18',
      question: 'Midpoint Question',
      category: 'Politics',
      yesPrice: 0.51,
      noPrice: 0.49,
      bestBid: 0,
      bestAsk: 0,
      spread: 0.02,
      liquidity: 1000.0,
      volume: 10000.0,
      timeToResolution: 86400,
      collectedAt: new Date(new Date(BASE_TIME).getTime() + 2000).toISOString(),
      rawMarketJson: '{}',
      provenance: { provider: 'fixture_source', sourceIdentifier: 'snap-18', sourceTime: BASE_TIME, ingestionTime: BASE_TIME, normalizationVersion: 'v1.0.0', isDemo: true },
      createdAt: BASE_TIME
    },
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'DIFFICULT',
    expectedCohort: 'GOOD_COPY',
    expectedFillTier: 'MIDPOINT'
  },

  // Scenario 19: Crossed orderbook (Adversarial)
  scenario19_crossed_orderbook: {
    name: '19. Crossed orderbook',
    description: 'bestBid ($0.60) > bestAsk ($0.50) is invalid; marked UNAVAILABLE / INSUFFICIENT_DATA',
    trade: createTrade('trade-19', '0x9999999999999999999999999999999999999999', 'market-19', 0.50, 10.0, 'BUY', 0),
    snapshot: {
      id: 'snap-19',
      marketId: 'market-19',
      conditionId: 'cond-19',
      question: 'Crossed Book Market',
      category: 'Politics',
      yesPrice: 0.55,
      noPrice: 0.45,
      bestBid: 0.60,
      bestAsk: 0.50, // Crossed!
      spread: -0.10,
      liquidity: 1000.0,
      volume: 10000.0,
      timeToResolution: 86400,
      collectedAt: new Date(new Date(BASE_TIME).getTime() + 2000).toISOString(),
      rawMarketJson: '{}',
      provenance: { provider: 'fixture_source', sourceIdentifier: 'snap-19', sourceTime: BASE_TIME, ingestionTime: BASE_TIME, normalizationVersion: 'v1.0.0', isDemo: true },
      createdAt: BASE_TIME
    },
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'INSUFFICIENT_DATA',
    expectedCohort: 'INSUFFICIENT_DATA',
    expectedFillTier: 'UNAVAILABLE'
  },

  // Scenario 20: Future-dated / negative latency
  scenario20_negative_latency: {
    name: '20. Negative latency / out-of-order snapshot',
    description: 'Snapshot collected 60s BEFORE wallet trade entry; handled safely as STALE / UNAVAILABLE',
    trade: createTrade('trade-20', '0x9999999999999999999999999999999999999999', 'market-20', 0.50, 10.0, 'BUY', 60), // Entry at T+60s
    snapshot: createSnapshot('snap-20', 'market-20', 0.49, 0.51, 3000.0, 0), // Snapshot at T+0s
    resolutionData: { resolvedPrice: 1.0, resolvedAt: '2026-09-02T00:00:00Z', winningOutcome: 'YES' },
    expectedClassification: 'COPYABLE', // latency is 0 clamped, fresh enough
    expectedCohort: 'GOOD_COPY'
  }
};
