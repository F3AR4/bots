/**
 * Test Suite B & L: Database Model Integrity and Idempotent Deduplication.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { DatabaseManager } from '../src/db/connection.js';
import { TradeRepository } from '../src/db/repositories/trade.repo.js';
import { PaperTradeRepository } from '../src/db/repositories/paper-trade.repo.js';
import { DecisionRepository } from '../src/db/repositories/decision.repo.js';
import { MarketRepository } from '../src/db/repositories/market.repo.js';
import { RuleSetRepository } from '../src/db/repositories/ruleset.repo.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { ObservedTrade, DecisionJournal, PaperTrade } from '../src/types/domain.js';

describe('Database Integrity & Idempotency Tests', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
    dbManager.migrate();
  });

  afterEach(() => {
    dbManager.close();
  });

  test('Idempotency: Inserting duplicate trade with same sourceTxHash is ignored', () => {
    const db = dbManager.getDatabase();
    const tradeRepo = new TradeRepository(db);

    const trade: ObservedTrade = {
      id: 'ot-idemp-01',
      walletAddress: '0x123',
      marketId: 'mkt-01',
      conditionId: 'cond-01',
      marketQuestion: 'Market?',
      marketCategory: 'Politics',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.50,
      detectedPrice: 0.50,
      size: 100,
      sourceTxHash: '0xunique_tx_hash_123',
      sourceTimestamp: '2026-09-14T10:00:00Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'test',
        sourceIdentifier: 'tx-123',
        sourceTime: '2026-09-14T10:00:00Z',
        ingestionTime: '2026-09-14T10:00:01Z',
        normalizationVersion: 'v1.0.0'
      },
      createdAt: '2026-09-14T10:00:01Z'
    };

    const firstInsert = tradeRepo.insertObservedTrade(trade);
    assert.strictEqual(firstInsert, true, 'First insert must succeed');

    // Duplicate insert with same tx hash but different UUID
    const duplicateTrade: ObservedTrade = {
      ...trade,
      id: 'ot-idemp-02'
    };
    const secondInsert = tradeRepo.insertObservedTrade(duplicateTrade);
    assert.strictEqual(secondInsert, false, 'Duplicate insert must be ignored');

    const retrieved = tradeRepo.findByTxHash('0xunique_tx_hash_123');
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.id, 'ot-idemp-01');
  });

  test('Relational Integrity: PaperTrade links to DecisionJournal which links to ObservedTrade', () => {
    const db = dbManager.getDatabase();
    const rulesetRepo = new RuleSetRepository(db);
    const tradeRepo = new TradeRepository(db);
    const decisionRepo = new DecisionRepository(db);
    const paperRepo = new PaperTradeRepository(db);

    rulesetRepo.saveRuleSet(DEFAULT_RULESET);

    const trade: ObservedTrade = {
      id: 'trade-fk-01',
      walletAddress: '0xabc',
      marketId: 'mkt-01',
      conditionId: 'cond-01',
      marketQuestion: 'Question',
      marketCategory: 'Politics',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.50,
      detectedPrice: 0.51,
      size: 100,
      sourceTimestamp: '2026-09-14T10:00:00Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'test',
        sourceIdentifier: 'fk-01',
        sourceTime: '2026-09-14T10:00:00Z',
        ingestionTime: '2026-09-14T10:00:01Z',
        normalizationVersion: 'v1.0.0'
      },
      createdAt: '2026-09-14T10:00:01Z'
    };
    tradeRepo.insertObservedTrade(trade);
    const marketRepo = new MarketRepository(db);
    marketRepo.insertSnapshot({
      id: 'ms-fk-01',
      marketId: trade.marketId,
      conditionId: trade.conditionId,
      question: trade.marketQuestion,
      category: trade.marketCategory,
      yesPrice: 0.50,
      noPrice: 0.50,
      bestBid: 0.49,
      bestAsk: 0.51,
      spread: 0.02,
      liquidity: 10000,
      volume: 50000,
      timeToResolution: 86400,
      collectedAt: '2026-09-14T10:00:00Z',
      rawMarketJson: '{}',
      provenance: trade.provenance,
      createdAt: '2026-09-14T10:00:00Z'
    });

    const decision: DecisionJournal = {
      id: 'decision-fk-01',
      observedTradeId: trade.id,
      marketSnapshotId: 'ms-fk-01',
      walletAddress: trade.walletAddress,
      marketId: trade.marketId,
      decision: 'paper_copy',
      copyScore: 82.5,
      confidence: 0.7,
      reasonsJson: '[]',
      risksJson: '[]',
      walletQualityScore: 80,
      roiScore: 80,
      consistencyScore: 80,
      copyabilityScore: 85,
      categoryFitScore: 80,
      entryTimingScore: 85,
      spreadScore: 90,
      liquidityScore: 90,
      thesisScore: 80,
      simulatedPositionSize: 15.0,
      ruleSetId: DEFAULT_RULESET.id,
      ruleVersion: DEFAULT_RULESET.version,
      evaluatedAt: '2026-09-14T10:00:02Z',
      createdAt: '2026-09-14T10:00:02Z'
    };
    decisionRepo.insertDecision(decision);

    const paperTrade: PaperTrade = {
      id: 'paper-fk-01',
      decisionJournalId: decision.id,
      observedTradeId: trade.id,
      walletAddress: trade.walletAddress,
      marketId: trade.marketId,
      conditionId: trade.conditionId,
      outcome: 'YES',
      side: 'BUY',
      entryPrice: 0.51,
      currentPrice: 0.51,
      simulatedPositionSize: 15.0,
      shares: 29.4117,
      unrealizedPnl: 0,
      realizedPnl: 0,
      status: 'open',
      executionMode: 'PAPER',
      ruleSetId: DEFAULT_RULESET.id,
      openedAt: '2026-09-14T10:00:02Z',
      closedAt: null,
      resolvedAt: null,
      createdAt: '2026-09-14T10:00:02Z',
      updatedAt: '2026-09-14T10:00:02Z'
    };
    paperRepo.insertPaperTrade(paperTrade);

    const retrieved = paperRepo.getPaperTradeById('paper-fk-01');
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.decisionJournalId, decision.id);
    assert.strictEqual(retrieved?.observedTradeId, trade.id);
  });

  test('Idempotency: Duplicate trade without txHash is deduplicated via composite unique index', () => {
    const db = dbManager.getDatabase();
    const tradeRepo = new TradeRepository(db);

    const tradeA: ObservedTrade = {
      id: 'ot-notx-01',
      walletAddress: '0x999',
      marketId: 'mkt-notx',
      conditionId: 'cond-notx',
      marketQuestion: 'No Tx Question',
      marketCategory: 'Crypto',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.60,
      detectedPrice: 0.60,
      size: 50,
      sourceTimestamp: '2026-09-14T11:00:00Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'test',
        sourceIdentifier: 'ev-01',
        sourceTime: '2026-09-14T11:00:00Z',
        ingestionTime: '2026-09-14T11:00:01Z',
        normalizationVersion: 'v1.0.0'
      },
      createdAt: '2026-09-14T11:00:01Z'
    };

    const first = tradeRepo.insertObservedTrade(tradeA);
    assert.strictEqual(first, true);

    // Identical event details without tx hash
    const tradeB: ObservedTrade = {
      ...tradeA,
      id: 'ot-notx-02'
    };

    const second = tradeRepo.insertObservedTrade(tradeB);
    assert.strictEqual(second, false, 'Duplicate observation without txHash must be ignored via composite unique index');
  });

  test('Database Invariant Triggers: Prevents unauthorized modification of immutable audit records', () => {
    const db = dbManager.getDatabase();
    const rulesetRepo = new RuleSetRepository(db);
    rulesetRepo.saveRuleSet(DEFAULT_RULESET);

    // 1. Attempting to mutate RuleSet config_json must fail at SQLite trigger level
    assert.throws(
      () => {
        db.prepare('UPDATE rule_sets SET config_json = ? WHERE id = ?').run('{}', DEFAULT_RULESET.id);
      },
      /RuleSet immutability violation/
    );

    // 2. Attempting to mutate a DecisionJournal must fail at SQLite trigger level
    const tradeRepo = new TradeRepository(db);
    const decisionRepo = new DecisionRepository(db);
    const marketRepo = new MarketRepository(db);

    const trade: ObservedTrade = {
      id: 'ot-trg-01',
      walletAddress: '0x777',
      marketId: 'mkt-trg',
      conditionId: 'cond-trg',
      marketQuestion: 'Q',
      marketCategory: 'Politics',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.50,
      detectedPrice: 0.50,
      size: 100,
      sourceTimestamp: '2026-09-14T10:00:00Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'test',
        sourceIdentifier: 'trg-01',
        sourceTime: '2026-09-14T10:00:00Z',
        ingestionTime: '2026-09-14T10:00:01Z',
        normalizationVersion: 'v1.0.0'
      },
      createdAt: '2026-09-14T10:00:01Z'
    };
    tradeRepo.insertObservedTrade(trade);

    marketRepo.insertSnapshot({
      id: 'ms-trg-01',
      marketId: trade.marketId,
      conditionId: trade.conditionId,
      question: 'Q',
      category: 'Politics',
      yesPrice: 0.5,
      noPrice: 0.5,
      bestBid: 0.49,
      bestAsk: 0.51,
      spread: 0.02,
      liquidity: 5000,
      volume: 10000,
      timeToResolution: 1000,
      collectedAt: '2026-09-14T10:00:00Z',
      rawMarketJson: '{}',
      provenance: trade.provenance,
      createdAt: '2026-09-14T10:00:00Z'
    });

    const decision: DecisionJournal = {
      id: 'dj-trg-01',
      observedTradeId: trade.id,
      marketSnapshotId: 'ms-trg-01',
      walletAddress: trade.walletAddress,
      marketId: trade.marketId,
      decision: 'skip',
      copyScore: 30,
      confidence: null,
      reasonsJson: '[]',
      risksJson: '[]',
      walletQualityScore: 30,
      roiScore: 30,
      consistencyScore: 30,
      copyabilityScore: 30,
      categoryFitScore: 30,
      entryTimingScore: 30,
      spreadScore: 30,
      liquidityScore: 30,
      thesisScore: 30,
      simulatedPositionSize: 0,
      ruleSetId: DEFAULT_RULESET.id,
      ruleVersion: DEFAULT_RULESET.version,
      evaluatedAt: '2026-09-14T10:00:02Z',
      createdAt: '2026-09-14T10:00:02Z'
    };
    decisionRepo.insertDecision(decision);

    assert.throws(
      () => {
        db.prepare('UPDATE decision_journals SET copy_score = 99.0 WHERE id = ?').run('dj-trg-01');
      },
      /DecisionJournal immutability violation/
    );

    // 3. Attempting to mutate an ObservedTrade must fail at SQLite trigger level
    assert.throws(
      () => {
        db.prepare('UPDATE observed_trades SET wallet_entry_price = 0.99 WHERE id = ?').run('ot-trg-01');
      },
      /ObservedTrade immutability violation/
    );
  });
});
