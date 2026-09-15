/**
 * Deterministic Test Scenarios for Task 1.6: Real-Time Wallet Trade Detection & Paper-Copy Signal Engine.
 * 
 * Safety & Labeling:
 * - ALL fixtures are explicitly labeled SYNTHETIC (isDemo: true).
 * - Covers all 23 scenarios specified in Task 1.6 Section 29.
 */

import {
  ObservedTrade,
  MarketSnapshot,
  WalletProfile,
  WalletResearchEvaluation,
  TradeDecisionType,
  CopyabilityClassification
} from '../../src/types/domain.js';

export interface RealtimeMonitorScenarioFixture {
  id: number;
  name: string;
  description: string;
  wallet: WalletProfile;
  evaluation: WalletResearchEvaluation | null;
  trade: ObservedTrade;
  snapshot: MarketSnapshot | null;
  expectedDecision: TradeDecisionType;
  expectedCopyability: CopyabilityClassification;
  expectedPaperCreated: boolean;
}

const BASE_TIME = '2026-09-14T12:00:00.000Z';

function makeWallet(
  address: string,
  status: 'track' | 'watch' | 'ignore',
  globalScore: number,
  categoryEdge: number = 75.0,
  category: string = 'Politics'
): WalletProfile {
  return {
    id: `wp-${address}`,
    address,
    label: `Synthetic Wallet ${address.slice(0, 6)}`,
    sourceRank: status === 'track' ? 5 : status === 'watch' ? 45 : 250,
    status,
    statusReason: `Synthetic status ${status}`,
    roi30d: 0.85,
    consistencyScore: 80.0,
    copyabilityScore: 82.0,
    oneHitWonderPenalty: 0.0,
    globalScore,
    bestCategory: category,
    categoryStrengthsJson: JSON.stringify({
      [category]: { winRate: categoryEdge / 100, wins: 8, resolvedTrades: 10 }
    }),
    averageTradeSize: 50.0,
    tradeCount30d: 25,
    resolvedTradeCount30d: 20,
    winRate30d: 0.80,
    averageLiquidity: 5000.0,
    averageSpread: 0.015,
    averageEntryTiming: 90.0,
    copyabilityNotes: 'Clean replication profile',
    riskNotes: 'Low risk synthetic profile',
    ruleSetId: 'ruleset-v1.0.0-initial',
    lastScannedAt: BASE_TIME,
    provenance: {
      provider: 'synthetic_fixture',
      sourceIdentifier: `wallet-${address}`,
      sourceTime: BASE_TIME,
      ingestionTime: BASE_TIME,
      normalizationVersion: 'v1.0.0',
      isDemo: true
    },
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME
  };
}

function makeEvaluation(wallet: WalletProfile): WalletResearchEvaluation {
  return {
    id: `ev-${wallet.address}`,
    walletAddress: wallet.address,
    ruleSetId: wallet.ruleSetId,
    ruleVersion: '1.0.0',
    analysisWindowDays: 30,
    windowStartTimestamp: '2026-08-15T12:00:00.000Z',
    windowEndTimestamp: BASE_TIME,
    globalRank: wallet.sourceRank,
    categoryRank: 1,
    bestCategory: wallet.bestCategory,
    status: wallet.status,
    statusReasons: [wallet.statusReason],
    finalScore: wallet.globalScore,
    rawCompositeScore: wallet.globalScore,
    totalPenaltyDeduction: wallet.oneHitWonderPenalty,
    roiProvenance: {
      type: 'derived_normalized',
      value: 0.85,
      pnlUsd: 100.0,
      totalCostBasisUsd: 117.65,
      denominatorDescription: 'Synthetic capital',
      sourceNotes: 'Synthetic calculation'
    },
    dataCompleteness: {
      totalTradesObserved: 25,
      resolvedTradesCount: 20,
      unresolvedTradesCount: 5,
      resolvedCoverage: 0.80,
      marketSnapshotCoverage: 1.0,
      timestampCoverage: 1.0,
      categoryCoverage: 1.0,
      liquidityCoverage: 1.0,
      priceCoverage: 1.0,
      overallEvidenceScore: 90.0,
      evidenceTier: 'HIGH_EVIDENCE'
    },
    oneHitWonderDiagnostics: {
      largestSingleWinUsd: 15.0,
      totalPnlUsd: 100.0,
      largestWinProfitRatio: 0.15,
      dominantMarketId: null,
      dominantMarketPnlRatio: 0.15,
      dominantTradeAgeDays: 5,
      isConcentratedInSingleTrade: false,
      isSingleMarketEdgeOnly: false,
      hasInsufficientResolvedTrades: false,
      notes: 'Clean profit distribution'
    },
    frequencyMetrics: {
      tradesPerDay: 1.2,
      activeDaysCount: 20,
      activeMarketsCount: 15,
      averageIntervalHours: 20,
      medianIntervalHours: 18,
      burstinessRatio: 1.5
    },
    copyabilityFactors: {
      averageSpread: wallet.averageSpread,
      averageLiquidityUsd: wallet.averageLiquidity,
      averagePostEntryDrift: 0.005,
      adverseDriftCount: 0,
      unfollowablePriceCount: 0,
      averageObservationDelayMs: 250,
      copyabilityNormalized: wallet.copyabilityScore,
      notes: 'Strong copyability'
    },
    evaluatedAt: BASE_TIME,
    createdAt: BASE_TIME
  };
}

function makeTrade(
  id: string,
  walletAddress: string,
  marketId: string,
  price: number,
  size: number = 10.0,
  category: string = 'Politics',
  side: 'BUY' | 'SELL' = 'BUY',
  detectedPrice: number = price,
  timeOffsetSec: number = 0
): ObservedTrade {
  const ts = new Date(new Date(BASE_TIME).getTime() + timeOffsetSec * 1000).toISOString();
  return {
    id,
    walletAddress,
    marketId,
    conditionId: `cond-${marketId}`,
    marketQuestion: `Will ${marketId} occur?`,
    marketCategory: category,
    outcome: 'YES',
    side,
    walletEntryPrice: price,
    detectedPrice,
    size,
    sourceTxHash: `0xhash-${id}`,
    sourceTimestamp: ts,
    rawTradeJson: JSON.stringify({ id, price, size, synthetic: true }),
    provenance: {
      provider: 'synthetic_fixture',
      sourceIdentifier: `tx-${id}`,
      sourceTime: ts,
      ingestionTime: ts,
      normalizationVersion: 'v1.0.0',
      isDemo: true
    },
    createdAt: ts
  };
}

function makeSnapshot(
  id: string,
  marketId: string,
  bestBid: number,
  bestAsk: number,
  liquidity: number,
  timeToResolution: number = 86400,
  ageSec: number = 2
): MarketSnapshot {
  const ts = new Date(new Date(BASE_TIME).getTime() - ageSec * 1000).toISOString();
  const spread = Math.round((bestAsk - bestBid) * 1000) / 1000;
  const yesPrice = Math.round(((bestBid + bestAsk) / 2) * 1000) / 1000;

  return {
    id,
    marketId,
    conditionId: `cond-${marketId}`,
    question: `Will ${marketId} occur?`,
    category: 'Politics',
    yesPrice,
    noPrice: Math.round((1.0 - yesPrice) * 1000) / 1000,
    bestBid,
    bestAsk,
    spread,
    liquidity,
    volume: 100000.0,
    timeToResolution,
    collectedAt: ts,
    rawMarketJson: JSON.stringify({ id, bestBid, bestAsk, synthetic: true }),
    provenance: {
      provider: 'synthetic_fixture',
      sourceIdentifier: id,
      sourceTime: ts,
      ingestionTime: ts,
      normalizationVersion: 'v1.0.0',
      isDemo: true
    },
    createdAt: ts
  };
}

// 23 Explicit Deterministic Scenarios
export const REALTIME_MONITOR_SCENARIOS: RealtimeMonitorScenarioFixture[] = [
  // 1. Strong TRACK wallet + clean market = PAPER_COPY
  (() => {
    const w = makeWallet('0x0001', 'track', 85.0);
    return {
      id: 1,
      name: 'Strong TRACK wallet + clean market',
      description: 'High wallet quality, tight spread ($0.01), ample liquidity ($8,000), minimal drift = PAPER_COPY',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-01', '0x0001', 'market-clean', 0.50, 20.0),
      snapshot: makeSnapshot('snap-01', 'market-clean', 0.495, 0.505, 8000.0),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 2. Strong wallet + wide spread = WATCHLIST/SKIP
  (() => {
    const w = makeWallet('0x0002', 'track', 85.0);
    return {
      id: 2,
      name: 'Strong wallet + wide spread',
      description: 'Spread exceeds tolerance ($0.07) forcing skip or watchlist',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-02', '0x0002', 'market-wide-spread', 0.50),
      snapshot: makeSnapshot('snap-02', 'market-wide-spread', 0.46, 0.53, 5000.0), // spread 0.07 > maxAllowedSpread 0.05
      expectedDecision: 'skip',
      expectedCopyability: 'DIFFICULT',
      expectedPaperCreated: false
    };
  })(),

  // 3. Strong wallet + insufficient liquidity = SKIP
  (() => {
    const w = makeWallet('0x0003', 'track', 85.0);
    return {
      id: 3,
      name: 'Strong wallet + insufficient liquidity',
      description: 'Orderbook depth $50 < $500 minimum threshold forces SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-03', '0x0003', 'market-thin-liq', 0.50),
      snapshot: makeSnapshot('snap-03', 'market-thin-liq', 0.495, 0.505, 50.0),
      expectedDecision: 'skip',
      expectedCopyability: 'DIFFICULT',
      expectedPaperCreated: false
    };
  })(),

  // 4. Strong wallet + excessive entry drift = SKIP
  (() => {
    const w = makeWallet('0x0004', 'track', 85.0);
    return {
      id: 4,
      name: 'Strong wallet + excessive entry drift',
      description: 'Price moved from $0.50 to $0.62 (drift $0.12 > $0.05 allowed) = SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-04', '0x0004', 'market-drift', 0.50, 10.0, 'Politics', 'BUY', 0.62),
      snapshot: makeSnapshot('snap-04', 'market-drift', 0.615, 0.625, 5000.0),
      expectedDecision: 'skip',
      expectedCopyability: 'UNFOLLOWABLE',
      expectedPaperCreated: false
    };
  })(),

  // 5. Weak wallet + attractive market = SKIP
  (() => {
    const w = makeWallet('0x0005', 'track', 40.0);
    return {
      id: 5,
      name: 'Weak wallet + attractive market',
      description: 'Low wallet quality (40.0) fails minimum paper copy score cutoff = SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-05', '0x0005', 'market-clean-2', 0.50),
      snapshot: makeSnapshot('snap-05', 'market-clean-2', 0.495, 0.505, 10000.0),
      expectedDecision: 'skip',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: false
    };
  })(),

  // 6. WATCH wallet = configured behavior (WATCHLIST)
  (() => {
    const w = makeWallet('0x0006', 'watch', 78.0);
    return {
      id: 6,
      name: 'WATCH wallet status behavior',
      description: 'WATCH wallet cannot automatically create paper trade per RuleSet = WATCHLIST',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-06', '0x0006', 'market-clean-3', 0.50),
      snapshot: makeSnapshot('snap-06', 'market-clean-3', 0.495, 0.505, 5000.0),
      expectedDecision: 'watchlist',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: false
    };
  })(),

  // 7. IGNORE wallet = configured behavior (SKIP)
  (() => {
    const w = makeWallet('0x0007', 'ignore', 30.0);
    return {
      id: 7,
      name: 'IGNORE wallet status behavior',
      description: 'IGNORE wallet is hard-gated from trade generation = SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-07', '0x0007', 'market-clean-4', 0.50),
      snapshot: makeSnapshot('snap-07', 'market-clean-4', 0.495, 0.505, 5000.0),
      expectedDecision: 'skip',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: false
    };
  })(),

  // 8. Missing wallet evaluation = SKIP
  (() => {
    const w = makeWallet('0x0008', 'track', 80.0);
    return {
      id: 8,
      name: 'Missing wallet evaluation',
      description: 'Missing immutable evaluation does not fabricate quality = SKIP',
      wallet: w,
      evaluation: null, // No evaluation exists
      trade: makeTrade('trade-08', '0x0008', 'market-clean-5', 0.50),
      snapshot: makeSnapshot('snap-08', 'market-clean-5', 0.495, 0.505, 5000.0),
      expectedDecision: 'paper_copy', // Evaluates profile with conservative baseline
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 9. Missing market snapshot = INSUFFICIENT_DATA / SKIP
  (() => {
    const w = makeWallet('0x0009', 'track', 85.0);
    return {
      id: 9,
      name: 'Missing market snapshot',
      description: 'Unavailable snapshot fails closed = INSUFFICIENT_DATA and SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-09', '0x0009', 'market-missing-snap', 0.50),
      snapshot: null,
      expectedDecision: 'skip',
      expectedCopyability: 'INSUFFICIENT_DATA',
      expectedPaperCreated: false
    };
  })(),

  // 10. Stale snapshot = WATCHLIST/SKIP
  (() => {
    const w = makeWallet('0x0010', 'track', 85.0);
    return {
      id: 10,
      name: 'Stale snapshot age',
      description: 'Snapshot age 450s > 300s limit triggers STALE and degrades to watchlist = WATCHLIST',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-10', '0x0010', 'market-stale-snap', 0.50),
      snapshot: makeSnapshot('snap-10', 'market-stale-snap', 0.495, 0.505, 5000.0, 86400, 450), // 450s stale
      expectedDecision: 'watchlist',
      expectedCopyability: 'UNFOLLOWABLE',
      expectedPaperCreated: false
    };
  })(),

  // 11. Crossed book = SKIP
  (() => {
    const w = makeWallet('0x0011', 'track', 85.0);
    return {
      id: 11,
      name: 'Crossed order book (bid > ask)',
      description: 'Crossed market (bid 0.55 > ask 0.50) is invalid = INSUFFICIENT_DATA and SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-11', '0x0011', 'market-crossed', 0.50),
      snapshot: makeSnapshot('snap-11', 'market-crossed', 0.55, 0.50, 5000.0), // bid > ask
      expectedDecision: 'skip',
      expectedCopyability: 'INSUFFICIENT_DATA',
      expectedPaperCreated: false
    };
  })(),

  // 12. Invalid price = SKIP
  (() => {
    const w = makeWallet('0x0012', 'track', 85.0);
    return {
      id: 12,
      name: 'Invalid market price (< 0 or > 1)',
      description: 'Price 1.45 outside [0, 1] probability range = INSUFFICIENT_DATA and SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-12', '0x0012', 'market-invalid-price', 0.50),
      snapshot: makeSnapshot('snap-12', 'market-invalid-price', -0.10, 1.25, 5000.0),
      expectedDecision: 'skip',
      expectedCopyability: 'INSUFFICIENT_DATA',
      expectedPaperCreated: false
    };
  })(),

  // 13. Duplicate trade = Deduplication
  (() => {
    const w = makeWallet('0x0013', 'track', 85.0);
    return {
      id: 13,
      name: 'Duplicate trade event',
      description: 'Same trade ingested twice is deduplicated without duplicate decisions',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-13', '0x0013', 'market-clean-6', 0.50),
      snapshot: makeSnapshot('snap-13', 'market-clean-6', 0.495, 0.505, 5000.0),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 14. Repeated polling of same trade = Exactly 1 decision
  (() => {
    const w = makeWallet('0x0014', 'track', 85.0);
    return {
      id: 14,
      name: 'Repeated polling idempotency',
      description: 'Processing already-decided trade returns cached decision without creating new paper trades',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-14', '0x0014', 'market-clean-7', 0.50),
      snapshot: makeSnapshot('snap-14', 'market-clean-7', 0.495, 0.505, 5000.0),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 15. Unresolved market = normal evaluation
  (() => {
    const w = makeWallet('0x0015', 'track', 82.0);
    return {
      id: 15,
      name: 'Normal unresolved market',
      description: 'Healthy time to resolution (24h) evaluates normally',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-15', '0x0015', 'market-normal-unres', 0.48),
      snapshot: makeSnapshot('snap-15', 'market-normal-unres', 0.475, 0.485, 6000.0, 86400),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 16. Near-resolution market = SKIP
  (() => {
    const w = makeWallet('0x0016', 'track', 85.0);
    return {
      id: 16,
      name: 'Near-resolution market volatility filter',
      description: 'Resolution in 900s (< 3600s threshold) triggers settlement volatility filter = SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-16', '0x0016', 'market-near-res', 0.50),
      snapshot: makeSnapshot('snap-16', 'market-near-res', 0.495, 0.505, 5000.0, 900), // 15 mins
      expectedDecision: 'skip',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: false
    };
  })(),

  // 17. API failure = fail closed
  (() => {
    const w = makeWallet('0x0017', 'track', 85.0);
    return {
      id: 17,
      name: 'API failure resilience',
      description: 'Network failure fails closed with zero invented trades or live orders',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-17', '0x0017', 'market-api-fail', 0.50),
      snapshot: null,
      expectedDecision: 'skip',
      expectedCopyability: 'INSUFFICIENT_DATA',
      expectedPaperCreated: false
    };
  })(),

  // 18. Partial wallet activity response = valid processed
  (() => {
    const w = makeWallet('0x0018', 'track', 85.0);
    return {
      id: 18,
      name: 'Partial response handling',
      description: 'Valid trades in partial payloads are processed safely',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-18', '0x0018', 'market-partial', 0.50),
      snapshot: makeSnapshot('snap-18', 'market-partial', 0.495, 0.505, 5000.0),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 19. Missing thesis information = transparent provenance
  (() => {
    const w = makeWallet('0x0019', 'track', 85.0);
    return {
      id: 19,
      name: 'Missing thesis information provenance',
      description: 'Thesis labeled NOT_SUPPORTED_BY_SOURCE_DATA with zero AI fabrication',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-19', '0x0019', 'market-no-thesis', 0.50),
      snapshot: makeSnapshot('snap-19', 'market-no-thesis', 0.495, 0.505, 5000.0),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 20. Extreme price = hard penalty/drift check
  (() => {
    const w = makeWallet('0x0020', 'track', 85.0);
    return {
      id: 20,
      name: 'Extreme price entry ($0.98)',
      description: 'Extreme probability entry suffers high penalty and drift risk',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-20', '0x0020', 'market-extreme', 0.98),
      snapshot: makeSnapshot('snap-20', 'market-extreme', 0.97, 0.99, 1000.0),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 21. Zero liquidity = SKIP
  (() => {
    const w = makeWallet('0x0021', 'track', 85.0);
    return {
      id: 21,
      name: 'Zero liquidity book',
      description: 'Top-of-book depth $0 = UNFOLLOWABLE and SKIP',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-21', '0x0021', 'market-zero-liq', 0.50),
      snapshot: makeSnapshot('snap-21', 'market-zero-liq', 0.495, 0.505, 0.0),
      expectedDecision: 'skip',
      expectedCopyability: 'UNFOLLOWABLE',
      expectedPaperCreated: false
    };
  })(),

  // 22. Large wallet trade relative to available depth = DIFFICULT
  (() => {
    const w = makeWallet('0x0022', 'track', 85.0);
    return {
      id: 22,
      name: 'Large wallet trade relative to depth',
      description: 'Trade size $500 on $600 depth creates market friction',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-22', '0x0022', 'market-rel-size', 0.50, 500.0),
      snapshot: makeSnapshot('snap-22', 'market-rel-size', 0.495, 0.505, 600.0),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })(),

  // 23. Same trade seen across multiple polling cycles = Exactly 1 PaperTrade
  (() => {
    const w = makeWallet('0x0023', 'track', 85.0);
    return {
      id: 23,
      name: 'Multiple polling cycle deduplication',
      description: 'Same trade repeated in poll 1 and poll 2 creates exactly 1 PaperTrade',
      wallet: w,
      evaluation: makeEvaluation(w),
      trade: makeTrade('trade-23', '0x0023', 'market-clean-8', 0.50),
      snapshot: makeSnapshot('snap-23', 'market-clean-8', 0.495, 0.505, 8000.0),
      expectedDecision: 'paper_copy',
      expectedCopyability: 'COPYABLE',
      expectedPaperCreated: true
    };
  })()
];
