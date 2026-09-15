/**
 * Test Suite I: Deterministic Replay and Simulation Test Harness.
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { ReplayHarness, ReplayInputDataset } from '../src/core/replay-harness.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { WalletHistoricalActivitySummary } from '../src/types/adapters.js';
import { ObservedTrade, MarketSnapshot } from '../src/types/domain.js';

describe('Deterministic Replay Harness Tests', () => {
  const fixedTimestamp = '2026-09-14T12:00:00.000Z';

  const activity: WalletHistoricalActivitySummary = {
    walletAddress: '0xreplay_wallet_01',
    analyzedWindowDays: 30,
    totalTrades: 20,
    resolvedTrades: 16,
    winningTrades: 12,
    totalPnlUsd: 4200,
    largestSingleWinUsd: 800,
    tradesByCategory: {
      Politics: { totalTrades: 15, resolvedTrades: 12, wins: 10, pnlUsd: 3500 }
    },
    averageLiquidityUsd: 9500,
    averageSpread: 0.015,
    recentActivity: [],
    provenance: {
      provider: 'fixture',
      sourceIdentifier: 'rep-01',
      sourceTime: fixedTimestamp,
      ingestionTime: fixedTimestamp,
      normalizationVersion: 'v1.0.0'
    }
  };

  const tradeA: ObservedTrade = {
    id: 'ot-rep-A',
    walletAddress: activity.walletAddress,
    marketId: 'mkt-rep-01',
    conditionId: 'cond-rep-01',
    marketQuestion: 'Question A?',
    marketCategory: 'Politics',
    outcome: 'YES',
    side: 'BUY',
    walletEntryPrice: 0.50,
    detectedPrice: 0.505,
    size: 250,
    sourceTimestamp: '2026-09-14T11:59:50.000Z',
    rawTradeJson: '{"id":"A"}',
    provenance: activity.provenance,
    createdAt: fixedTimestamp
  };

  const marketA: MarketSnapshot = {
    id: 'ms-rep-A',
    marketId: tradeA.marketId,
    conditionId: tradeA.conditionId,
    question: tradeA.marketQuestion,
    category: tradeA.marketCategory,
    yesPrice: 0.505,
    noPrice: 0.495,
    bestBid: 0.50,
    bestAsk: 0.51,
    spread: 0.01,
    liquidity: 14000,
    volume: 180000,
    timeToResolution: 40000,
    collectedAt: fixedTimestamp,
    rawMarketJson: '{}',
    provenance: activity.provenance,
    createdAt: fixedTimestamp
  };

  const tradeB: ObservedTrade = {
    id: 'ot-rep-B',
    walletAddress: activity.walletAddress,
    marketId: 'mkt-rep-02',
    conditionId: 'cond-rep-02',
    marketQuestion: 'Question B?',
    marketCategory: 'Politics',
    outcome: 'NO',
    side: 'BUY',
    walletEntryPrice: 0.30,
    detectedPrice: 0.45, // Heavy drift!
    size: 500,
    sourceTimestamp: '2026-09-14T11:59:55.000Z',
    rawTradeJson: '{"id":"B"}',
    provenance: activity.provenance,
    createdAt: fixedTimestamp
  };

  const marketB: MarketSnapshot = {
    ...marketA,
    id: 'ms-rep-B',
    marketId: tradeB.marketId,
    conditionId: tradeB.conditionId,
    yesPrice: 0.55,
    noPrice: 0.45
  };

  test('Executing replay twice with identical inputs produces identical results', () => {
    const dataset: ReplayInputDataset = {
      ruleSet: DEFAULT_RULESET,
      fixedTimestamp,
      walletActivity: activity,
      observedTrades: [
        { trade: tradeA, market: marketA },
        { trade: tradeB, market: marketB }
      ]
    };

    const run1 = ReplayHarness.executeReplay(dataset);
    const run2 = ReplayHarness.executeReplay(dataset);

    // Byte-for-byte serialization check
    const json1 = JSON.stringify(run1);
    const json2 = JSON.stringify(run2);

    assert.strictEqual(json1, json2, 'Repeated replay with identical inputs must produce identical outputs.');

    assert.strictEqual(run1.decisions.length, 2);
    assert.strictEqual(run1.decisions[0].decision, 'paper_copy');
    assert.strictEqual(run1.decisions[1].decision, 'skip');
    assert.strictEqual(run1.paperTrades.length, 1);
  });
});
