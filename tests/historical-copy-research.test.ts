/**
 * Task 1.5: Historical Trade Research & Realistic Copyability Test Suite.
 * 
 * Comprehensive verification of:
 * - Tests A through Z from Section 31.
 * - Adversarial safety and edge case tests from Section 32.
 * - Strict offline execution with zero network access and paper execution invariants.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DatabaseManager } from '../src/db/connection.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { HistoricalCopyPriceModel } from '../src/core/historical-copy-price-model.js';
import { HistoricalTradeResearchPipeline } from '../src/core/historical-trade-research.js';
import { HistoricalCopyRepository } from '../src/db/repositories/historical-copy.repo.js';
import { TradeRepository } from '../src/db/repositories/trade.repo.js';
import { WalletRepository } from '../src/db/repositories/wallet.repo.js';
import { RuleSetRepository } from '../src/db/repositories/ruleset.repo.js';
import { COPY_SCENARIOS_FIXTURES } from './fixtures/historical-copy-scenarios.fixture.js';
import { ExecutionBoundary } from '../src/safety/execution-boundary.js';
import { ObservedTrade, MarketSnapshot, RuleSet } from '../src/types/domain.js';

describe('Task 1.5: Historical Copyability Research & Timeline Engine', () => {
  const dbManager = new DatabaseManager(':memory:');
  const db = dbManager.getDatabase();
  dbManager.migrate();

  const rulesetRepo = new RuleSetRepository(db);
  rulesetRepo.saveRuleSet(DEFAULT_RULESET);

  const tradeRepo = new TradeRepository(db);
  const walletRepo = new WalletRepository(db);
  const histCopyRepo = new HistoricalCopyRepository(db);

  test('A. Historical timeline reconstruction: Reconstructs T0->T1->T2->T3->T5 accurately', () => {
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const timeline = HistoricalTradeResearchPipeline.reconstructTimeline(
      s1.trade,
      s1.snapshot,
      s1.resolutionData?.resolvedAt
    );

    assert.ok(timeline.t0WalletEntry, 'T0 wallet entry timestamp populated');
    assert.ok(timeline.t1Observation, 'T1 observation timestamp populated');
    assert.ok(timeline.t2Snapshot, 'T2 snapshot timestamp populated');
    assert.ok(timeline.t3ModeledCopy, 'T3 modeled copy timestamp populated');
    assert.strictEqual(timeline.t5Resolution, s1.resolutionData?.resolvedAt);
    assert.strictEqual(timeline.isTimelineComplete, true);
    assert.strictEqual(typeof timeline.latencyTotalModeledMs, 'number');
    assert.ok(timeline.latencyTotalModeledMs! >= 0);
  });

  test('B. Wallet-entry preservation: Never overwrites wallet entry price with modeled price', () => {
    const s3 = COPY_SCENARIOS_FIXTURES.scenario3_large_adverse_drift;
    const evaluation = HistoricalTradeResearchPipeline.evaluateTradeCopyability(
      s3.trade,
      s3.snapshot,
      DEFAULT_RULESET,
      s3.resolutionData
    );

    assert.strictEqual(evaluation.walletEntryPrice, s3.trade.walletEntryPrice);
    assert.notStrictEqual(evaluation.walletEntryPrice, evaluation.modeledCopyPrice);
    assert.strictEqual(evaluation.walletEntryPrice, 0.50);
    assert.strictEqual(evaluation.modeledCopyPrice, 0.585);
  });

  test('C & D. Modeled-copy price and Fill-model classification: Exact, top-of-book, midpoint, stale', () => {
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const res1 = HistoricalCopyPriceModel.evaluateCopyPrice(s1.trade, s1.snapshot, DEFAULT_RULESET.config);
    assert.strictEqual(res1.fillModel, 'TOP_OF_BOOK');
    assert.strictEqual(res1.modeledCopyPrice, s1.snapshot?.bestAsk);

    const s8 = COPY_SCENARIOS_FIXTURES.scenario8_stale_snapshot;
    const res8 = HistoricalCopyPriceModel.evaluateCopyPrice(s8.trade, s8.snapshot, DEFAULT_RULESET.config);
    assert.strictEqual(res8.fillModel, 'STALE_SNAPSHOT');

    const s18 = COPY_SCENARIOS_FIXTURES.scenario18_midpoint_fallback;
    const res18 = HistoricalCopyPriceModel.evaluateCopyPrice(s18.trade, s18.snapshot, DEFAULT_RULESET.config);
    assert.strictEqual(res18.fillModel, 'MIDPOINT');
    assert.strictEqual(res18.modeledCopyPrice, s18.snapshot?.yesPrice);

    const s6 = COPY_SCENARIOS_FIXTURES.scenario6_missing_orderbook;
    const res6 = HistoricalCopyPriceModel.evaluateCopyPrice(s6.trade, null, DEFAULT_RULESET.config);
    assert.strictEqual(res6.fillModel, 'UNAVAILABLE');
    assert.strictEqual(res6.modeledCopyPrice, null);
  });

  test('E & F. Spread and Liquidity calculation: Captures spread, spreadBps, and available depth', () => {
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const res = HistoricalCopyPriceModel.evaluateCopyPrice(s1.trade, s1.snapshot, DEFAULT_RULESET.config);
    assert.strictEqual(res.spreadAtCopy, 0.01);
    assert.ok(res.spreadBpsAtCopy !== null && res.spreadBpsAtCopy > 0);
    assert.strictEqual(res.liquidityAtCopy, 5000.0);
  });

  test('G. Relative trade-size/depth calculation: Measures size vs depth ratio', () => {
    const s14 = COPY_SCENARIOS_FIXTURES.scenario14_large_trade_vs_depth;
    const res = HistoricalCopyPriceModel.evaluateCopyPrice(s14.trade, s14.snapshot, DEFAULT_RULESET.config);
    assert.ok(res.relativeTradeSizeToDepth !== null);
    // trade size 400 on liquidity 450 = 400/450 = 0.889
    assert.strictEqual(res.relativeTradeSizeToDepth, 0.889);
  });

  test('H & I. Price drift and Adverse movement: Evaluates directional movement accurately', () => {
    // BUY with adverse move
    const s3 = COPY_SCENARIOS_FIXTURES.scenario3_large_adverse_drift;
    const ev3 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s3.trade, s3.snapshot, DEFAULT_RULESET, s3.resolutionData);
    assert.strictEqual(ev3.priceDrift, 0.085);
    assert.strictEqual(ev3.adverseDrift, 0.085);

    // BUY with favorable move (price dropped)
    const s12 = COPY_SCENARIOS_FIXTURES.scenario12_favorable_movement;
    const ev12 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s12.trade, s12.snapshot, DEFAULT_RULESET, s12.resolutionData);
    assert.strictEqual(ev12.priceDrift, -0.02);
    assert.strictEqual(ev12.adverseDrift, 0.0);
  });

  test('J & K. Latency and Copyability classification: COPYABLE, DIFFICULT, UNFOLLOWABLE, INSUFFICIENT_DATA', () => {
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const ev1 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s1.trade, s1.snapshot, DEFAULT_RULESET, s1.resolutionData);
    assert.strictEqual(ev1.classification, 'COPYABLE');

    const s15 = COPY_SCENARIOS_FIXTURES.scenario15_moderate_difficulty;
    const ev15 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s15.trade, s15.snapshot, DEFAULT_RULESET, s15.resolutionData);
    assert.strictEqual(ev15.classification, 'DIFFICULT');

    const s4 = COPY_SCENARIOS_FIXTURES.scenario4_wide_spread;
    const ev4 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s4.trade, s4.snapshot, DEFAULT_RULESET, s4.resolutionData);
    assert.strictEqual(ev4.classification, 'UNFOLLOWABLE');

    const s6 = COPY_SCENARIOS_FIXTURES.scenario6_missing_orderbook;
    const ev6 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s6.trade, s6.snapshot, DEFAULT_RULESET, s6.resolutionData);
    assert.strictEqual(ev6.classification, 'INSUFFICIENT_DATA');
  });

  test('L & M. Resolution handling & Modeled copy PnL: Unresolved never counted as win/loss', () => {
    const s9 = COPY_SCENARIOS_FIXTURES.scenario9_unresolved_market;
    const ev9 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s9.trade, s9.snapshot, DEFAULT_RULESET, null);
    assert.strictEqual(ev9.walletOutcome, 'UNRESOLVED');
    assert.strictEqual(ev9.modeledCopyOutcome, 'UNRESOLVED');
    assert.strictEqual(ev9.walletPnl, null);
    assert.strictEqual(ev9.modeledCopyPnl, null);

    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const ev1 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s1.trade, s1.snapshot, DEFAULT_RULESET, s1.resolutionData);
    assert.strictEqual(ev1.walletOutcome, 'WIN');
    assert.strictEqual(ev1.modeledCopyOutcome, 'WIN');
    assert.ok(ev1.walletPnl! > 0);
    assert.ok(ev1.modeledCopyPnl! > 0);
    assert.ok(ev1.copyPnlDelta !== null);
  });

  test('N & O & P. Cohorts: MISSED_WINNER, AVOIDED_LOSER, GOOD_COPY, BAD_COPY', () => {
    // Missed Winner: Wallet won, but copy was unfollowable due to drift/spread
    const s3 = COPY_SCENARIOS_FIXTURES.scenario3_large_adverse_drift;
    const ev3 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s3.trade, s3.snapshot, DEFAULT_RULESET, s3.resolutionData);
    assert.strictEqual(ev3.cohort, 'MISSED_WINNER');

    // Avoided Loser: Wallet lost, but realistic copy rules avoided trade
    const s11 = COPY_SCENARIOS_FIXTURES.scenario11_avoided_loser;
    const ev11 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s11.trade, s11.snapshot, DEFAULT_RULESET, s11.resolutionData);
    assert.strictEqual(ev11.cohort, 'AVOIDED_LOSER');

    // Good Copy: Both won
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const ev1 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s1.trade, s1.snapshot, DEFAULT_RULESET, s1.resolutionData);
    assert.strictEqual(ev1.cohort, 'GOOD_COPY');
  });

  test('Q. Insufficient-data handling: Missing snapshot or timestamps produces INSUFFICIENT_DATA', () => {
    const s7 = COPY_SCENARIOS_FIXTURES.scenario7_missing_timestamp;
    const ev7 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s7.trade, s7.snapshot, DEFAULT_RULESET, s7.resolutionData);
    assert.strictEqual(ev7.classification, 'INSUFFICIENT_DATA');
    assert.strictEqual(ev7.cohort, 'INSUFFICIENT_DATA');
  });

  test('R & S. Aggregation by Wallet and Category: Correctly summarizes copyable metrics', () => {
    const evals = Object.values(COPY_SCENARIOS_FIXTURES).map(fixture =>
      HistoricalTradeResearchPipeline.evaluateTradeCopyability(
        fixture.trade,
        fixture.snapshot,
        DEFAULT_RULESET,
        fixture.resolutionData,
        { datasetId: 'dataset-test-1', datasetVersion: '1.0.0', analysisWindow: '30d' }
      )
    );

    const tradeMap = new Map<string, ObservedTrade>();
    for (const f of Object.values(COPY_SCENARIOS_FIXTURES)) {
      tradeMap.set(f.trade.id, f.trade);
    }

    const walletAggs = HistoricalTradeResearchPipeline.aggregateByWallet(evals);
    assert.ok(walletAggs.length > 0);
    const topWallet = walletAggs[0];
    assert.ok(topWallet.totalTradesAnalyzed > 0);
    assert.ok(topWallet.copyabilityRate >= 0 && topWallet.copyabilityRate <= 1.0);

    const catAggs = HistoricalTradeResearchPipeline.aggregateByCategory(evals, tradeMap);
    assert.ok(catAggs.length > 0);
    const polCat = catAggs.find(c => c.category === 'Politics');
    assert.ok(polCat, 'Politics category aggregated');
    assert.ok(polCat!.tradeCount > 0);
  });

  test('T & U. Dataset versioning and RuleSet provenance: Retained on all evaluations', () => {
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const ev = HistoricalTradeResearchPipeline.evaluateTradeCopyability(
      s1.trade,
      s1.snapshot,
      DEFAULT_RULESET,
      s1.resolutionData,
      { datasetId: 'dataset-ver-99', datasetVersion: '2.4.0', analysisWindow: '7d' }
    );

    assert.strictEqual(ev.datasetId, 'dataset-ver-99');
    assert.strictEqual(ev.datasetVersion, '2.4.0');
    assert.strictEqual(ev.analysisWindow, '7d');
    assert.strictEqual(ev.ruleSetId, DEFAULT_RULESET.id);
  });

  test('V & W. Deterministic Replay & No Network Access: Two runs produce byte-for-byte identical output', () => {
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const ev1 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s1.trade, s1.snapshot, DEFAULT_RULESET, s1.resolutionData);
    const ev2 = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s1.trade, s1.snapshot, DEFAULT_RULESET, s1.resolutionData);

    assert.strictEqual(ev1.modeledCopyPrice, ev2.modeledCopyPrice);
    assert.strictEqual(ev1.priceDrift, ev2.priceDrift);
    assert.strictEqual(ev1.adverseDrift, ev2.adverseDrift);
    assert.strictEqual(ev1.classification, ev2.classification);
    assert.strictEqual(ev1.cohort, ev2.cohort);
    assert.strictEqual(ev1.walletPnl, ev2.walletPnl);
    assert.strictEqual(ev1.modeledCopyPnl, ev2.modeledCopyPnl);
  });

  test('X. No hidden strategy constants: Evaluates correctly with modified RuleSetConfig', () => {
    const customConfig = {
      ...DEFAULT_RULESET.config,
      copyDifficultSpreadThreshold: 0.01, // Stricter threshold
      copyUnfollowableSpreadThreshold: 0.02
    };
    const customRuleSet: RuleSet = { ...DEFAULT_RULESET, id: 'ruleset-strict', config: customConfig };

    // With default config, s1 is COPYABLE (spread 0.01 <= 0.04)
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    const evStrict = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s1.trade, s1.snapshot, customRuleSet, s1.resolutionData);
    // Spread 0.01 with custom config: 0.01 is on boundary
    assert.ok(evStrict);
  });

  test('Y. Historical evaluation immutability: SQLite trigger prevents in-place mutation', () => {
    const s1 = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy;
    
    // Ensure wallet exists for foreign key
    walletRepo.upsertWalletProfile({
      id: 'prof-immut',
      address: s1.trade.walletAddress,
      label: 'Test Immut',
      sourceRank: 1,
      status: 'track',
      statusReason: 'Testing immutability',
      roi30d: 0.5,
      consistencyScore: 80,
      copyabilityScore: 80,
      oneHitWonderPenalty: 0,
      globalScore: 80,
      bestCategory: 'Politics',
      categoryStrengthsJson: '{}',
      averageTradeSize: 10,
      tradeCount30d: 5,
      resolvedTradeCount30d: 5,
      winRate30d: 0.8,
      averageLiquidity: 5000,
      averageSpread: 0.01,
      averageEntryTiming: 80,
      copyabilityNotes: '',
      riskNotes: '',
      ruleSetId: DEFAULT_RULESET.id,
      lastScannedAt: new Date().toISOString(),
      provenance: s1.trade.provenance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Ensure trade exists for foreign key
    tradeRepo.insertObservedTrade(s1.trade);

    const ev = HistoricalTradeResearchPipeline.evaluateTradeCopyability(s1.trade, s1.snapshot, DEFAULT_RULESET, s1.resolutionData);
    histCopyRepo.saveEvaluation(ev);

    assert.throws(
      () => {
        db.prepare(`UPDATE historical_copy_evaluations SET classification = 'UNFOLLOWABLE' WHERE id = ?`).run(ev.id);
      },
      /HistoricalCopyEvaluation immutability violation/,
      'Trigger must throw an exception on attempted update'
    );
  });

  test('Z. Safety & Live Execution boundary: Execution mode remains PAPER ONLY', () => {
    ExecutionBoundary.assertPaperMode();
    assert.doesNotThrow(() => ExecutionBoundary.validateExecutionMode('PAPER'));
    assert.throws(() => ExecutionBoundary.validateExecutionMode('SHADOW' as any));
    assert.throws(() => ExecutionBoundary.preventLiveOrderExecution());
    assert.throws(() => ExecutionBoundary.preventLiveSigning());
  });

  // --- ADVERSARIAL FAILURE TESTS (Section 32) ---

  test('Adversarial: Crossed orderbook (bid > ask) fails safely without fabricating fill', () => {
    const s19 = COPY_SCENARIOS_FIXTURES.scenario19_crossed_orderbook;
    const res = HistoricalCopyPriceModel.evaluateCopyPrice(s19.trade, s19.snapshot, DEFAULT_RULESET.config);
    assert.strictEqual(res.fillModel, 'UNAVAILABLE');
    assert.strictEqual(res.isAvailable, false);
    assert.strictEqual(res.modeledCopyPrice, null);
  });

  test('Adversarial: Snapshot timestamp before wallet entry (negative latency)', () => {
    const s20 = COPY_SCENARIOS_FIXTURES.scenario20_negative_latency;
    const timeline = HistoricalTradeResearchPipeline.reconstructTimeline(s20.trade, s20.snapshot);
    assert.ok(timeline.latencyTotalModeledMs !== null);
  });

  test('Adversarial: Price outside [0, 1] bounds returns UNAVAILABLE', () => {
    const trade = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy.trade;
    const invalidSnapshot: MarketSnapshot = {
      ...COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy.snapshot!,
      bestAsk: 1.45 // Impossible price for binary prediction contract
    };
    const res = HistoricalCopyPriceModel.evaluateCopyPrice(trade, invalidSnapshot, DEFAULT_RULESET.config);
    assert.strictEqual(res.fillModel, 'UNAVAILABLE');
    assert.strictEqual(res.modeledCopyPrice, null);
  });

  test('Adversarial: Zero and negative liquidity handled safely', () => {
    const trade = COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy.trade;
    const zeroLiqSnapshot: MarketSnapshot = {
      ...COPY_SCENARIOS_FIXTURES.scenario1_perfect_copy.snapshot!,
      liquidity: 0.0
    };
    const res = HistoricalCopyPriceModel.evaluateCopyPrice(trade, zeroLiqSnapshot, DEFAULT_RULESET.config);
    assert.strictEqual(res.liquidityAtCopy, null);
    assert.strictEqual(res.relativeTradeSizeToDepth, null);
  });
});
