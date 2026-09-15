/**
 * Deterministic Test Fixtures for Task 1.3: Wallet Intelligence.
 * 
 * Defines 12 clearly labeled scenarios:
 * 1. Consistently profitable wallet (Multiple wins across diverse markets, solid liquidity, tight spreads) -> TRACK
 * 2. One-hit-wonder wallet (85% of total PnL from one lucky trade) -> IGNORE (Penalized)
 * 3. Highly profitable but illiquid wallet (High returns but order book depth < $2,000) -> IGNORE / WATCH (Penalized)
 * 4. Good wallet with poor copyability (Entries at extreme prices 0.02 or 0.98, adverse drift) -> WATCH / IGNORE
 * 5. Category-specialist wallet (Dominates Politics with 85% win rate, no Crypto) -> TRACK / WATCH (High category score)
 * 6. Wallet with insufficient resolved trades (Only 2 resolved trades) -> IGNORE (Penalized)
 * 7. Wallet with missing market snapshots (Trades with no snapshots) -> LOW EVIDENCE tier (Graceful degradation)
 * 8. Wallet with wide spreads (Average spread > 0.08) -> IGNORE (Penalized)
 * 9. Wallet with late-entry price drift (Price drifts > 0.10 immediately after entry) -> WATCH / IGNORE
 * 10. Wallet with incomplete timestamps (Missing or malformed source timestamps) -> Processed safely
 * 11. Wallet with mixed categories (Balanced trading across Tech, Politics, Macro, Crypto) -> TRACK / WATCH
 * 12. Wallet with unresolved activity (Open positions, zero resolutions) -> INSUFFICIENT EVIDENCE (Not penalized as loss)
 */

import { ObservedTrade, MarketSnapshot, ProvenanceMetadata } from '../../src/types/domain.js';

const baseProvenance: ProvenanceMetadata = {
  provider: 'fixture_wallet_intelligence',
  sourceIdentifier: 'fixture_scenario',
  sourceTime: '2026-09-01T12:00:00Z',
  ingestionTime: '2026-09-01T12:05:00Z',
  normalizationVersion: '1.0.0',
  isDemo: true
};

function makeTrade(
  id: string,
  walletAddress: string,
  marketId: string,
  category: string,
  price: number,
  size: number,
  timestamp: string,
  isResolved: boolean,
  won: boolean,
  side: 'BUY' | 'SELL' = 'BUY',
  detectedPrice = price
): ObservedTrade {
  const rawPayload = {
    id,
    user: walletAddress,
    marketId,
    resolved: isResolved,
    winner: won ? 'YES' : 'NO',
    payout: won ? size : 0,
    side,
    price,
    size
  };

  return {
    id,
    walletAddress,
    marketId,
    conditionId: `cond-${marketId}`,
    marketQuestion: `Will ${marketId} resolve successfully?`,
    marketCategory: category,
    outcome: 'YES',
    side,
    walletEntryPrice: price,
    detectedPrice,
    size,
    sourceTxHash: `0xtx_${id}`,
    sourceTimestamp: timestamp,
    rawTradeJson: JSON.stringify(rawPayload),
    provenance: { ...baseProvenance, sourceIdentifier: id, sourceTime: timestamp },
    createdAt: timestamp
  };
}

function makeSnapshot(
  marketId: string,
  category: string,
  yesPrice: number,
  noPrice: number,
  spread = 0.015,
  liquidity = 25000
): MarketSnapshot {
  return {
    id: `snap-${marketId}`,
    marketId,
    conditionId: `cond-${marketId}`,
    question: `Will ${marketId} resolve successfully?`,
    category,
    yesPrice,
    noPrice,
    bestBid: yesPrice - spread / 2,
    bestAsk: yesPrice + spread / 2,
    spread,
    liquidity,
    volume: 150000,
    timeToResolution: 14,
    collectedAt: '2026-09-02T12:00:00Z',
    rawMarketJson: JSON.stringify({ marketId, yesPrice, noPrice, spread, liquidity }),
    provenance: baseProvenance,
    createdAt: '2026-09-02T12:00:00Z'
  };
}

export interface ScenarioFixture {
  name: string;
  walletAddress: string;
  description: string;
  trades: ObservedTrade[];
  snapshots: MarketSnapshot[];
  expectedStatus: 'track' | 'watch' | 'ignore';
  expectedPenalties: string[];
}

export const SCENARIO_FIXTURES: Record<string, ScenarioFixture> = {
  // Scenario 1: Consistently Profitable Wallet
  CONSISTENT_PROFITABLE: {
    name: 'Consistently Profitable Wallet',
    walletAddress: '0x1111111111111111111111111111111111111111',
    description: '15 trades, 12 wins across 4 categories, high depth, tight spreads',
    trades: [
      makeTrade('t1_1', '0x1111111111111111111111111111111111111111', 'mkt_pol_1', 'Politics', 0.40, 500, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t1_2', '0x1111111111111111111111111111111111111111', 'mkt_pol_2', 'Politics', 0.45, 500, '2026-09-02T10:00:00Z', true, true),
      makeTrade('t1_3', '0x1111111111111111111111111111111111111111', 'mkt_pol_3', 'Politics', 0.50, 500, '2026-09-03T10:00:00Z', true, true),
      makeTrade('t1_4', '0x1111111111111111111111111111111111111111', 'mkt_cry_1', 'Crypto', 0.35, 600, '2026-09-04T10:00:00Z', true, true),
      makeTrade('t1_5', '0x1111111111111111111111111111111111111111', 'mkt_cry_2', 'Crypto', 0.40, 600, '2026-09-05T10:00:00Z', true, true),
      makeTrade('t1_6', '0x1111111111111111111111111111111111111111', 'mkt_cry_3', 'Crypto', 0.60, 500, '2026-09-06T10:00:00Z', true, false), // loss
      makeTrade('t1_7', '0x1111111111111111111111111111111111111111', 'mkt_tec_1', 'Tech', 0.42, 500, '2026-09-07T10:00:00Z', true, true),
      makeTrade('t1_8', '0x1111111111111111111111111111111111111111', 'mkt_tec_2', 'Tech', 0.38, 500, '2026-09-08T10:00:00Z', true, true),
      makeTrade('t1_9', '0x1111111111111111111111111111111111111111', 'mkt_mac_1', 'Macro', 0.50, 400, '2026-09-09T10:00:00Z', true, true),
      makeTrade('t1_10', '0x1111111111111111111111111111111111111111', 'mkt_mac_2', 'Macro', 0.48, 400, '2026-09-10T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_pol_1', 'Politics', 0.41, 0.59, 0.012, 30000),
      makeSnapshot('mkt_pol_2', 'Politics', 0.46, 0.54, 0.015, 28000),
      makeSnapshot('mkt_pol_3', 'Politics', 0.51, 0.49, 0.014, 25000),
      makeSnapshot('mkt_cry_1', 'Crypto', 0.36, 0.64, 0.015, 40000),
      makeSnapshot('mkt_cry_2', 'Crypto', 0.41, 0.59, 0.016, 35000),
      makeSnapshot('mkt_cry_3', 'Crypto', 0.61, 0.39, 0.015, 30000),
      makeSnapshot('mkt_tec_1', 'Tech', 0.43, 0.57, 0.012, 22000),
      makeSnapshot('mkt_tec_2', 'Tech', 0.39, 0.61, 0.013, 25000),
      makeSnapshot('mkt_mac_1', 'Macro', 0.51, 0.49, 0.015, 20000),
      makeSnapshot('mkt_mac_2', 'Macro', 0.49, 0.51, 0.014, 21000)
    ],
    expectedStatus: 'track',
    expectedPenalties: []
  },

  // Scenario 2: One-Hit-Wonder Wallet
  ONE_HIT_WONDER: {
    name: 'One-Hit-Wonder Wallet',
    walletAddress: '0x2222222222222222222222222222222222222222',
    description: '1 massive win of $18,000 and 4 tiny $50 wins; 90% profit concentrated in single trade',
    trades: [
      makeTrade('t2_1', '0x2222222222222222222222222222222222222222', 'mkt_huge_win', 'Politics', 0.10, 20000, '2026-09-01T10:00:00Z', true, true), // win $18k
      makeTrade('t2_2', '0x2222222222222222222222222222222222222222', 'mkt_tiny_1', 'Crypto', 0.50, 100, '2026-09-03T10:00:00Z', true, true), // win $50
      makeTrade('t2_3', '0x2222222222222222222222222222222222222222', 'mkt_tiny_2', 'Tech', 0.50, 100, '2026-09-05T10:00:00Z', true, true), // win $50
      makeTrade('t2_4', '0x2222222222222222222222222222222222222222', 'mkt_tiny_3', 'Macro', 0.50, 100, '2026-09-07T10:00:00Z', true, true), // win $50
      makeTrade('t2_5', '0x2222222222222222222222222222222222222222', 'mkt_tiny_4', 'Culture', 0.50, 100, '2026-09-09T10:00:00Z', true, true)  // win $50
    ],
    snapshots: [
      makeSnapshot('mkt_huge_win', 'Politics', 0.11, 0.89, 0.015, 20000),
      makeSnapshot('mkt_tiny_1', 'Crypto', 0.51, 0.49, 0.015, 20000),
      makeSnapshot('mkt_tiny_2', 'Tech', 0.51, 0.49, 0.015, 20000),
      makeSnapshot('mkt_tiny_3', 'Macro', 0.51, 0.49, 0.015, 20000),
      makeSnapshot('mkt_tiny_4', 'Culture', 0.51, 0.49, 0.015, 20000)
    ],
    expectedStatus: 'ignore',
    expectedPenalties: ['single_trade_profit_concentration']
  },

  // Scenario 3: Highly Profitable but Illiquid Wallet
  ILLIQUID_TRADER: {
    name: 'Highly Profitable but Illiquid Wallet',
    walletAddress: '0x3333333333333333333333333333333333333333',
    description: 'High win rate but executed in markets with only $400 book depth',
    trades: [
      makeTrade('t3_1', '0x3333333333333333333333333333333333333333', 'mkt_thin_1', 'Politics', 0.40, 200, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t3_2', '0x3333333333333333333333333333333333333333', 'mkt_thin_2', 'Politics', 0.45, 200, '2026-09-03T10:00:00Z', true, true),
      makeTrade('t3_3', '0x3333333333333333333333333333333333333333', 'mkt_thin_3', 'Politics', 0.50, 200, '2026-09-05T10:00:00Z', true, true),
      makeTrade('t3_4', '0x3333333333333333333333333333333333333333', 'mkt_thin_4', 'Politics', 0.35, 200, '2026-09-07T10:00:00Z', true, true),
      makeTrade('t3_5', '0x3333333333333333333333333333333333333333', 'mkt_thin_5', 'Politics', 0.40, 200, '2026-09-09T10:00:00Z', true, true),
      makeTrade('t3_6', '0x3333333333333333333333333333333333333333', 'mkt_thin_6', 'Politics', 0.42, 200, '2026-09-11T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_thin_1', 'Politics', 0.41, 0.59, 0.015, 450),
      makeSnapshot('mkt_thin_2', 'Politics', 0.46, 0.54, 0.015, 400),
      makeSnapshot('mkt_thin_3', 'Politics', 0.51, 0.49, 0.015, 350),
      makeSnapshot('mkt_thin_4', 'Politics', 0.36, 0.64, 0.015, 500),
      makeSnapshot('mkt_thin_5', 'Politics', 0.41, 0.59, 0.015, 420),
      makeSnapshot('mkt_thin_6', 'Politics', 0.43, 0.57, 0.015, 480)
    ],
    expectedStatus: 'ignore',
    expectedPenalties: ['illiquid_activity']
  },

  // Scenario 4: Poor Copyability (Extreme pricing <0.05 or >0.95)
  POOR_COPYABILITY: {
    name: 'Poor Copyability Wallet',
    walletAddress: '0x4444444444444444444444444444444444444444',
    description: 'High win rate by buying 97c outcome contracts that cannot be copied safely',
    trades: [
      makeTrade('t4_1', '0x4444444444444444444444444444444444444444', 'mkt_ext_1', 'Politics', 0.98, 1000, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t4_2', '0x4444444444444444444444444444444444444444', 'mkt_ext_2', 'Politics', 0.97, 1000, '2026-09-03T10:00:00Z', true, true),
      makeTrade('t4_3', '0x4444444444444444444444444444444444444444', 'mkt_ext_3', 'Politics', 0.98, 1000, '2026-09-05T10:00:00Z', true, true),
      makeTrade('t4_4', '0x4444444444444444444444444444444444444444', 'mkt_ext_4', 'Politics', 0.99, 1000, '2026-09-07T10:00:00Z', true, true),
      makeTrade('t4_5', '0x4444444444444444444444444444444444444444', 'mkt_ext_5', 'Politics', 0.97, 1000, '2026-09-09T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_ext_1', 'Politics', 0.98, 0.02, 0.01, 15000),
      makeSnapshot('mkt_ext_2', 'Politics', 0.97, 0.03, 0.01, 15000),
      makeSnapshot('mkt_ext_3', 'Politics', 0.98, 0.02, 0.01, 15000),
      makeSnapshot('mkt_ext_4', 'Politics', 0.99, 0.01, 0.01, 15000),
      makeSnapshot('mkt_ext_5', 'Politics', 0.97, 0.03, 0.01, 15000)
    ],
    expectedStatus: 'ignore',
    expectedPenalties: ['unfollowable_extreme_pricing']
  },

  // Scenario 5: Category-Specialist Wallet
  CATEGORY_SPECIALIST: {
    name: 'Category Specialist Wallet',
    walletAddress: '0x5555555555555555555555555555555555555555',
    description: '100% win rate in Politics across 6 resolved trades, zero activity elsewhere',
    trades: [
      makeTrade('t5_1', '0x5555555555555555555555555555555555555555', 'mkt_pol_s1', 'Politics', 0.40, 500, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t5_2', '0x5555555555555555555555555555555555555555', 'mkt_pol_s2', 'Politics', 0.45, 500, '2026-09-03T10:00:00Z', true, true),
      makeTrade('t5_3', '0x5555555555555555555555555555555555555555', 'mkt_pol_s3', 'Politics', 0.50, 500, '2026-09-05T10:00:00Z', true, true),
      makeTrade('t5_4', '0x5555555555555555555555555555555555555555', 'mkt_pol_s4', 'Politics', 0.42, 500, '2026-09-07T10:00:00Z', true, true),
      makeTrade('t5_5', '0x5555555555555555555555555555555555555555', 'mkt_pol_s5', 'Politics', 0.38, 500, '2026-09-09T10:00:00Z', true, true),
      makeTrade('t5_6', '0x5555555555555555555555555555555555555555', 'mkt_pol_s6', 'Politics', 0.48, 500, '2026-09-11T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_pol_s1', 'Politics', 0.41, 0.59, 0.015, 20000),
      makeSnapshot('mkt_pol_s2', 'Politics', 0.46, 0.54, 0.015, 20000),
      makeSnapshot('mkt_pol_s3', 'Politics', 0.51, 0.49, 0.015, 20000),
      makeSnapshot('mkt_pol_s4', 'Politics', 0.43, 0.57, 0.015, 20000),
      makeSnapshot('mkt_pol_s5', 'Politics', 0.39, 0.61, 0.015, 20000),
      makeSnapshot('mkt_pol_s6', 'Politics', 0.49, 0.51, 0.015, 20000)
    ],
    expectedStatus: 'track',
    expectedPenalties: []
  },

  // Scenario 6: Insufficient Resolved Trades
  INSUFFICIENT_RESOLVED: {
    name: 'Insufficient Resolved Trades Wallet',
    walletAddress: '0x6666666666666666666666666666666666666666',
    description: 'Only 2 resolved trades (RuleSet minimum is 5)',
    trades: [
      makeTrade('t6_1', '0x6666666666666666666666666666666666666666', 'mkt_ins_1', 'Politics', 0.40, 500, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t6_2', '0x6666666666666666666666666666666666666666', 'mkt_ins_2', 'Politics', 0.45, 500, '2026-09-03T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_ins_1', 'Politics', 0.41, 0.59, 0.015, 20000),
      makeSnapshot('mkt_ins_2', 'Politics', 0.46, 0.54, 0.015, 20000)
    ],
    expectedStatus: 'ignore',
    expectedPenalties: ['insufficient_resolved_trades']
  },

  // Scenario 7: Missing Market Snapshots
  MISSING_SNAPSHOTS: {
    name: 'Missing Market Snapshots Wallet',
    walletAddress: '0x7777777777777777777777777777777777777777',
    description: 'Trades present but zero corresponding MarketSnapshots in DB',
    trades: [
      makeTrade('t7_1', '0x7777777777777777777777777777777777777777', 'mkt_nosnap_1', 'Politics', 0.40, 500, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t7_2', '0x7777777777777777777777777777777777777777', 'mkt_nosnap_2', 'Politics', 0.45, 500, '2026-09-03T10:00:00Z', true, true),
      makeTrade('t7_3', '0x7777777777777777777777777777777777777777', 'mkt_nosnap_3', 'Politics', 0.50, 500, '2026-09-05T10:00:00Z', true, true),
      makeTrade('t7_4', '0x7777777777777777777777777777777777777777', 'mkt_nosnap_4', 'Politics', 0.42, 500, '2026-09-07T10:00:00Z', true, true),
      makeTrade('t7_5', '0x7777777777777777777777777777777777777777', 'mkt_nosnap_5', 'Politics', 0.38, 500, '2026-09-09T10:00:00Z', true, true)
    ],
    snapshots: [], // Zero snapshots
    expectedStatus: 'track',
    expectedPenalties: []
  },

  // Scenario 8: Wide Spreads
  WIDE_SPREADS: {
    name: 'Wide Spreads Wallet',
    walletAddress: '0x8888888888888888888888888888888888888888',
    description: 'Average spread is 0.12 (exceeds maxHistoricalSpread 0.08)',
    trades: [
      makeTrade('t8_1', '0x8888888888888888888888888888888888888888', 'mkt_wide_1', 'Politics', 0.40, 500, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t8_2', '0x8888888888888888888888888888888888888888', 'mkt_wide_2', 'Politics', 0.45, 500, '2026-09-03T10:00:00Z', true, true),
      makeTrade('t8_3', '0x8888888888888888888888888888888888888888', 'mkt_wide_3', 'Politics', 0.50, 500, '2026-09-05T10:00:00Z', true, true),
      makeTrade('t8_4', '0x8888888888888888888888888888888888888888', 'mkt_wide_4', 'Politics', 0.42, 500, '2026-09-07T10:00:00Z', true, true),
      makeTrade('t8_5', '0x8888888888888888888888888888888888888888', 'mkt_wide_5', 'Politics', 0.38, 500, '2026-09-09T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_wide_1', 'Politics', 0.40, 0.60, 0.12, 10000),
      makeSnapshot('mkt_wide_2', 'Politics', 0.45, 0.55, 0.11, 10000),
      makeSnapshot('mkt_wide_3', 'Politics', 0.50, 0.50, 0.13, 10000),
      makeSnapshot('mkt_wide_4', 'Politics', 0.42, 0.58, 0.12, 10000),
      makeSnapshot('mkt_wide_5', 'Politics', 0.38, 0.62, 0.12, 10000)
    ],
    expectedStatus: 'ignore',
    expectedPenalties: ['wide_historical_spread']
  },

  // Scenario 9: Late-Entry Price Drift (Adverse slippage)
  LATE_ENTRY_DRIFT: {
    name: 'Late-Entry Price Drift Wallet',
    walletAddress: '0x9999999999999999999999999999999999999999',
    description: 'Price moved up +0.12 immediately after BUY entry on all trades',
    trades: [
      makeTrade('t9_1', '0x9999999999999999999999999999999999999999', 'mkt_drift_1', 'Politics', 0.40, 500, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t9_2', '0x9999999999999999999999999999999999999999', 'mkt_drift_2', 'Politics', 0.40, 500, '2026-09-03T10:00:00Z', true, true),
      makeTrade('t9_3', '0x9999999999999999999999999999999999999999', 'mkt_drift_3', 'Politics', 0.40, 500, '2026-09-05T10:00:00Z', true, true),
      makeTrade('t9_4', '0x9999999999999999999999999999999999999999', 'mkt_drift_4', 'Politics', 0.40, 500, '2026-09-07T10:00:00Z', true, true),
      makeTrade('t9_5', '0x9999999999999999999999999999999999999999', 'mkt_drift_5', 'Politics', 0.40, 500, '2026-09-09T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_drift_1', 'Politics', 0.52, 0.48, 0.015, 20000), // +0.12 drift
      makeSnapshot('mkt_drift_2', 'Politics', 0.53, 0.47, 0.015, 20000), // +0.13 drift
      makeSnapshot('mkt_drift_3', 'Politics', 0.52, 0.48, 0.015, 20000), // +0.12 drift
      makeSnapshot('mkt_drift_4', 'Politics', 0.54, 0.46, 0.015, 20000), // +0.14 drift
      makeSnapshot('mkt_drift_5', 'Politics', 0.52, 0.48, 0.015, 20000)  // +0.12 drift
    ],
    expectedStatus: 'watch',
    expectedPenalties: ['excessive_post_entry_movement']
  },

  // Scenario 10: Incomplete Timestamps
  INCOMPLETE_TIMESTAMPS: {
    name: 'Incomplete Timestamps Wallet',
    walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    description: 'Trades with empty or non-ISO timestamp strings; engine processes without crashing',
    trades: [
      makeTrade('t10_1', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'mkt_ts_1', 'Politics', 0.40, 500, 'unknown', true, true),
      makeTrade('t10_2', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'mkt_ts_2', 'Politics', 0.45, 500, 'invalid-date', true, true),
      makeTrade('t10_3', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'mkt_ts_3', 'Politics', 0.50, 500, '2026-09-05T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_ts_1', 'Politics', 0.41, 0.59, 0.015, 20000),
      makeSnapshot('mkt_ts_2', 'Politics', 0.46, 0.54, 0.015, 20000),
      makeSnapshot('mkt_ts_3', 'Politics', 0.51, 0.49, 0.015, 20000)
    ],
    expectedStatus: 'ignore',
    expectedPenalties: ['insufficient_resolved_trades']
  },

  // Scenario 11: Mixed Categories
  MIXED_CATEGORIES: {
    name: 'Mixed Categories Wallet',
    walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    description: 'Balanced trading across Tech, Politics, Macro, Crypto with strong win rate',
    trades: [
      makeTrade('t11_1', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_1', 'Politics', 0.40, 400, '2026-09-01T10:00:00Z', true, true),
      makeTrade('t11_2', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_2', 'Politics', 0.45, 400, '2026-09-02T10:00:00Z', true, true),
      makeTrade('t11_3', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_3', 'Politics', 0.50, 400, '2026-09-03T10:00:00Z', true, true),
      makeTrade('t11_4', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_4', 'Crypto', 0.35, 400, '2026-09-04T10:00:00Z', true, true),
      makeTrade('t11_5', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_5', 'Crypto', 0.40, 400, '2026-09-05T10:00:00Z', true, true),
      makeTrade('t11_6', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_6', 'Crypto', 0.45, 400, '2026-09-06T10:00:00Z', true, true),
      makeTrade('t11_7', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_7', 'Tech', 0.42, 400, '2026-09-07T10:00:00Z', true, true),
      makeTrade('t11_8', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_8', 'Tech', 0.38, 400, '2026-09-08T10:00:00Z', true, true),
      makeTrade('t11_9', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mkt_mix_9', 'Macro', 0.50, 400, '2026-09-09T10:00:00Z', true, true)
    ],
    snapshots: [
      makeSnapshot('mkt_mix_1', 'Politics', 0.41, 0.59, 0.015, 25000),
      makeSnapshot('mkt_mix_2', 'Politics', 0.46, 0.54, 0.015, 25000),
      makeSnapshot('mkt_mix_3', 'Politics', 0.51, 0.49, 0.015, 25000),
      makeSnapshot('mkt_mix_4', 'Crypto', 0.36, 0.64, 0.015, 25000),
      makeSnapshot('mkt_mix_5', 'Crypto', 0.41, 0.59, 0.015, 25000),
      makeSnapshot('mkt_mix_6', 'Crypto', 0.46, 0.54, 0.015, 25000),
      makeSnapshot('mkt_mix_7', 'Tech', 0.43, 0.57, 0.015, 25000),
      makeSnapshot('mkt_mix_8', 'Tech', 0.39, 0.61, 0.015, 25000),
      makeSnapshot('mkt_mix_9', 'Macro', 0.51, 0.49, 0.015, 25000)
    ],
    expectedStatus: 'track',
    expectedPenalties: []
  },

  // Scenario 12: Unresolved Activity Only
  UNRESOLVED_ACTIVITY: {
    name: 'Unresolved Activity Only Wallet',
    walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
    description: '5 open positions, zero resolved trades; must not be penalized as losses or wins',
    trades: [
      makeTrade('t12_1', '0xcccccccccccccccccccccccccccccccccccccccc', 'mkt_unres_1', 'Politics', 0.40, 500, '2026-09-01T10:00:00Z', false, false),
      makeTrade('t12_2', '0xcccccccccccccccccccccccccccccccccccccccc', 'mkt_unres_2', 'Politics', 0.45, 500, '2026-09-03T10:00:00Z', false, false),
      makeTrade('t12_3', '0xcccccccccccccccccccccccccccccccccccccccc', 'mkt_unres_3', 'Politics', 0.50, 500, '2026-09-05T10:00:00Z', false, false),
      makeTrade('t12_4', '0xcccccccccccccccccccccccccccccccccccccccc', 'mkt_unres_4', 'Politics', 0.42, 500, '2026-09-07T10:00:00Z', false, false),
      makeTrade('t12_5', '0xcccccccccccccccccccccccccccccccccccccccc', 'mkt_unres_5', 'Politics', 0.38, 500, '2026-09-09T10:00:00Z', false, false)
    ],
    snapshots: [
      makeSnapshot('mkt_unres_1', 'Politics', 0.41, 0.59, 0.015, 20000),
      makeSnapshot('mkt_unres_2', 'Politics', 0.46, 0.54, 0.015, 20000),
      makeSnapshot('mkt_unres_3', 'Politics', 0.51, 0.49, 0.015, 20000),
      makeSnapshot('mkt_unres_4', 'Politics', 0.43, 0.57, 0.015, 20000),
      makeSnapshot('mkt_unres_5', 'Politics', 0.39, 0.61, 0.015, 20000)
    ],
    expectedStatus: 'ignore',
    expectedPenalties: ['insufficient_resolved_trades']
  }
};
