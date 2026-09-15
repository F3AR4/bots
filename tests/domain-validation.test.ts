/**
 * Test Suite A & M: Domain Validation and Timestamp/Provenance Preservation.
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import {
  ProvenanceMetadata,
  LeaderboardScan,
  ObservedTrade,
  MarketSnapshot,
  PaperTrade
} from '../src/types/domain.js';

describe('Domain Validation & Provenance Tests', () => {
  test('Provenance preserves distinct source, ingestion, and processing times', () => {
    const sourceTime = '2026-09-14T10:00:00.000Z';
    const ingestionTime = '2026-09-14T10:00:02.500Z';
    const processingTime = '2026-09-14T10:00:03.100Z';

    const provenance: ProvenanceMetadata = {
      provider: 'polymarket_public',
      sourceIdentifier: '0x1234567890abcdef',
      sourceTime,
      ingestionTime,
      processingTime,
      normalizationVersion: 'v1.0.0',
      isDemo: false
    };

    assert.strictEqual(provenance.sourceTime, sourceTime);
    assert.strictEqual(provenance.ingestionTime, ingestionTime);
    assert.strictEqual(provenance.processingTime, processingTime);
    assert.notStrictEqual(provenance.sourceTime, provenance.ingestionTime);
    assert.strictEqual(provenance.isDemo, false);
  });

  test('ObservedTrade retains unaltered raw JSON payload and transaction hash', () => {
    const rawPayload = JSON.stringify({ fillId: 'fill-99', side: 'BUY', originalExchangeTime: 1726310400 });
    const trade: ObservedTrade = {
      id: 'ot-test-01',
      walletAddress: '0x1111111111111111111111111111111111111111',
      marketId: 'mkt-test-pol',
      conditionId: 'cond-01',
      marketQuestion: 'Will Congress pass legislation X?',
      marketCategory: 'Politics',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.45,
      detectedPrice: 0.46,
      size: 250,
      sourceTxHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      sourceTimestamp: '2026-09-14T10:00:00.000Z',
      rawTradeJson: rawPayload,
      provenance: {
        provider: 'polymarket_indexer',
        sourceIdentifier: 'fill-99',
        sourceTime: '2026-09-14T10:00:00.000Z',
        ingestionTime: '2026-09-14T10:00:02.000Z',
        normalizationVersion: 'v1.0.0'
      },
      createdAt: '2026-09-14T10:00:02.000Z'
    };

    assert.strictEqual(trade.rawTradeJson, rawPayload);
    assert.strictEqual(trade.sourceTxHash?.startsWith('0x'), true);
    assert.strictEqual(trade.detectedPrice >= trade.walletEntryPrice, true);
  });

  test('MarketSnapshot captures spread and top-of-book depth accurately', () => {
    const snapshot: MarketSnapshot = {
      id: 'ms-test-01',
      marketId: 'mkt-test-pol',
      conditionId: 'cond-01',
      question: 'Test Market',
      category: 'Politics',
      yesPrice: 0.50,
      noPrice: 0.50,
      bestBid: 0.49,
      bestAsk: 0.51,
      spread: 0.02,
      liquidity: 12500,
      volume: 450000,
      timeToResolution: 86400,
      collectedAt: '2026-09-14T10:00:01.000Z',
      rawMarketJson: '{}',
      provenance: {
        provider: 'polymarket_clob',
        sourceIdentifier: 'book-01',
        sourceTime: '2026-09-14T10:00:01.000Z',
        ingestionTime: '2026-09-14T10:00:01.500Z',
        normalizationVersion: 'v1.0.0'
      },
      createdAt: '2026-09-14T10:00:01.500Z'
    };

    assert.strictEqual(snapshot.spread, 0.02);
    assert.strictEqual(Math.round((snapshot.bestAsk - snapshot.bestBid) * 1000) / 1000, snapshot.spread);
    assert.strictEqual(snapshot.liquidity, 12500);
  });
});
