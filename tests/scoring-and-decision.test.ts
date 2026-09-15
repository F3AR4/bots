/**
 * Test Suite D, E, F: Deterministic Wallet Scoring, Trade Scoring, and Decision Journal Traceability.
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { WalletScorer } from '../src/core/wallet-scorer.js';
import { TradeScorer } from '../src/core/trade-scorer.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { WalletHistoricalActivitySummary } from '../src/types/adapters.js';
import { ObservedTrade, MarketSnapshot, WalletProfile } from '../src/types/domain.js';

describe('Deterministic Scoring & Decision Engine Tests', () => {
  const mockWalletActivityGood: WalletHistoricalActivitySummary = {
    walletAddress: '0xgood_wallet_01',
    analyzedWindowDays: 30,
    totalTrades: 35,
    resolvedTrades: 28,
    winningTrades: 22,
    totalPnlUsd: 8500,
    largestSingleWinUsd: 900, // <80% concentration (distributed)
    tradesByCategory: {
      Politics: { totalTrades: 25, resolvedTrades: 20, wins: 16, pnlUsd: 6500 },
      Crypto: { totalTrades: 10, resolvedTrades: 8, wins: 6, pnlUsd: 2000 }
    },
    averageLiquidityUsd: 12000,
    averageSpread: 0.015,
    recentActivity: [],
    provenance: {
      provider: 'test',
      sourceIdentifier: 'act-01',
      sourceTime: '2026-09-14T10:00:00Z',
      ingestionTime: '2026-09-14T10:00:01Z',
      normalizationVersion: 'v1.0.0'
    }
  };

  const mockWalletActivityLuckyWhale: WalletHistoricalActivitySummary = {
    walletAddress: '0xlucky_whale_02',
    analyzedWindowDays: 30,
    totalTrades: 3,
    resolvedTrades: 2,
    winningTrades: 1,
    totalPnlUsd: 50000,
    largestSingleWinUsd: 48000, // 96% concentration from 1 trade!
    tradesByCategory: {
      'Pop Culture': { totalTrades: 3, resolvedTrades: 2, wins: 1, pnlUsd: 50000 }
    },
    averageLiquidityUsd: 400, // Illiquid!
    averageSpread: 0.08,     // Wide spread!
    recentActivity: [],
    provenance: {
      provider: 'test',
      sourceIdentifier: 'act-02',
      sourceTime: '2026-09-14T10:00:00Z',
      ingestionTime: '2026-09-14T10:00:01Z',
      normalizationVersion: 'v1.0.0'
    }
  };

  test('Wallet Scoring: Consistent wallet achieves TRACK status with zero penalties', () => {
    const result = WalletScorer.scoreWallet(mockWalletActivityGood, DEFAULT_RULESET);

    assert.strictEqual(result.walletAddress, '0xgood_wallet_01');
    assert.strictEqual(result.ruleSetId, DEFAULT_RULESET.id);
    assert.strictEqual(result.totalPenaltyDeduction, 0);
    assert.strictEqual(result.status, 'track');
    assert.ok(result.finalTotalScore >= 70.0);
    assert.strictEqual(result.factorResults.length, 6);
  });

  test('Wallet Scoring: One-Hit-Wonder penalties trigger and downgrade lucky whale to IGNORE', () => {
    const result = WalletScorer.scoreWallet(mockWalletActivityLuckyWhale, DEFAULT_RULESET);

    assert.strictEqual(result.walletAddress, '0xlucky_whale_02');
    assert.ok(result.totalPenaltyDeduction >= 50); // Penalties triggered
    assert.strictEqual(result.status, 'ignore');

    const concentrationPenalty = result.penalties.find(p => p.penaltyName === 'single_trade_profit_concentration');
    assert.ok(concentrationPenalty?.triggered);
    const illiquidPenalty = result.penalties.find(p => p.penaltyName === 'illiquid_activity');
    assert.ok(illiquidPenalty?.triggered);
  });

  test('Trade Scoring: High-quality setup produces paper_copy decision with $5-$20 bounded size', () => {
    const walletProfile: WalletProfile = {
      id: 'wp-01',
      address: '0xgood_wallet_01',
      label: null,
      sourceRank: 5,
      status: 'track',
      statusReason: 'High consistency',
      roi30d: 0.85,
      consistencyScore: 85,
      copyabilityScore: 90,
      oneHitWonderPenalty: 0,
      globalScore: 86.0,
      bestCategory: 'Politics',
      categoryStrengthsJson: JSON.stringify({ Politics: { winRate: 0.80 } }),
      averageTradeSize: 300,
      tradeCount30d: 35,
      resolvedTradeCount30d: 28,
      winRate30d: 0.785,
      averageLiquidity: 12000,
      averageSpread: 0.015,
      averageEntryTiming: 88,
      copyabilityNotes: 'Good',
      riskNotes: 'Low',
      ruleSetId: DEFAULT_RULESET.id,
      lastScannedAt: '2026-09-14T10:00:00Z',
      provenance: mockWalletActivityGood.provenance,
      createdAt: '2026-09-14T10:00:00Z',
      updatedAt: '2026-09-14T10:00:00Z'
    };

    const trade: ObservedTrade = {
      id: 'trade-01',
      walletAddress: walletProfile.address,
      marketId: 'mkt-pol-01',
      conditionId: 'cond-01',
      marketQuestion: 'Will Candidate X Win?',
      marketCategory: 'Politics',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.50,
      detectedPrice: 0.505, // 0.5 cent drift (within 3c tolerance)
      size: 500,
      sourceTimestamp: '2026-09-14T10:00:00Z',
      rawTradeJson: '{}',
      provenance: mockWalletActivityGood.provenance,
      createdAt: '2026-09-14T10:00:01Z'
    };

    const market: MarketSnapshot = {
      id: 'ms-01',
      marketId: trade.marketId,
      conditionId: trade.conditionId,
      question: trade.marketQuestion,
      category: trade.marketCategory,
      yesPrice: 0.505,
      noPrice: 0.495,
      bestBid: 0.50,
      bestAsk: 0.51,
      spread: 0.01, // 1 cent spread (well below 4c cutoff)
      liquidity: 15000, // Deep book (well above $500 min)
      volume: 250000,
      timeToResolution: 86400,
      collectedAt: '2026-09-14T10:00:01Z',
      rawMarketJson: '{}',
      provenance: mockWalletActivityGood.provenance,
      createdAt: '2026-09-14T10:00:01Z'
    };

    const result = TradeScorer.evaluateTrade(trade, market, walletProfile, DEFAULT_RULESET);

    assert.strictEqual(result.decision, 'paper_copy');
    assert.ok(result.compositeCopyScore >= 75.0);
    assert.ok(result.simulatedPositionSize >= 5.0 && result.simulatedPositionSize <= 20.0);
    assert.ok(result.reasons.length > 0);
  });

  test('Trade Scoring: Excessive post-entry drift forces skip decision', () => {
    const walletProfile: WalletProfile = {
      id: 'wp-01',
      address: '0xgood_wallet_01',
      label: null,
      sourceRank: 5,
      status: 'track',
      statusReason: 'High consistency',
      roi30d: 0.85,
      consistencyScore: 85,
      copyabilityScore: 90,
      oneHitWonderPenalty: 0,
      globalScore: 86.0,
      bestCategory: 'Politics',
      categoryStrengthsJson: JSON.stringify({ Politics: { winRate: 0.80 } }),
      averageTradeSize: 300,
      tradeCount30d: 35,
      resolvedTradeCount30d: 28,
      winRate30d: 0.785,
      averageLiquidity: 12000,
      averageSpread: 0.015,
      averageEntryTiming: 88,
      copyabilityNotes: 'Good',
      riskNotes: 'Low',
      ruleSetId: DEFAULT_RULESET.id,
      lastScannedAt: '2026-09-14T10:00:00Z',
      provenance: mockWalletActivityGood.provenance,
      createdAt: '2026-09-14T10:00:00Z',
      updatedAt: '2026-09-14T10:00:00Z'
    };

    const trade: ObservedTrade = {
      id: 'trade-drift',
      walletAddress: walletProfile.address,
      marketId: 'mkt-pol-01',
      conditionId: 'cond-01',
      marketQuestion: 'Will Candidate X Win?',
      marketCategory: 'Politics',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.40,
      detectedPrice: 0.55, // 15 cents drift! (Severe late detection)
      size: 500,
      sourceTimestamp: '2026-09-14T10:00:00Z',
      rawTradeJson: '{}',
      provenance: mockWalletActivityGood.provenance,
      createdAt: '2026-09-14T10:00:01Z'
    };

    const market: MarketSnapshot = {
      id: 'ms-01',
      marketId: trade.marketId,
      conditionId: trade.conditionId,
      question: trade.marketQuestion,
      category: trade.marketCategory,
      yesPrice: 0.55,
      noPrice: 0.45,
      bestBid: 0.54,
      bestAsk: 0.56,
      spread: 0.02,
      liquidity: 15000,
      volume: 250000,
      timeToResolution: 86400,
      collectedAt: '2026-09-14T10:00:01Z',
      rawMarketJson: '{}',
      provenance: mockWalletActivityGood.provenance,
      createdAt: '2026-09-14T10:00:01Z'
    };

    const result = TradeScorer.evaluateTrade(trade, market, walletProfile, DEFAULT_RULESET);
    assert.strictEqual(result.decision, 'skip');
    assert.strictEqual(result.simulatedPositionSize, 0);
  });
});
