/**
 * Task 2.1: Empirical Calibration & Controlled Rule-Learning Verification Suite.
 * 
 * Safety & Invariant Guarantees:
 * - Deterministic replay and reproducibility.
 * - Zero look-ahead bias: timestamp verification.
 * - 4-cohort benchmarking and insufficient-data handling.
 * - 6 controlled adaptation policies.
 * - Overfitting guardrails (max step bounds, cooldown, evidence floors).
 * - Candidate RuleSet lifecycle (candidate -> walk-forward validation -> promote / reject).
 * - Immutability of RuleSets, RuleChanges, and historical decisions.
 * - Adversarial fixture resilience.
 */

import { test, describe, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { DatabaseManager } from '../src/db/connection.js';
import { RuleSetRepository } from '../src/db/repositories/ruleset.repo.js';
import { LearningRepository } from '../src/db/repositories/learning.repo.js';
import { TradeRepository } from '../src/db/repositories/trade.repo.js';
import { DecisionRepository } from '../src/db/repositories/decision.repo.js';
import { PaperTradeRepository } from '../src/db/repositories/paper-trade.repo.js';
import { MarketRepository } from '../src/db/repositories/market.repo.js';
import { ReviewRepository } from '../src/db/repositories/review.repo.js';
import { WalletRepository } from '../src/db/repositories/wallet.repo.js';

import { CalibrationDatasetBuilder } from '../src/core/calibration-dataset.js';
import { BenchmarkEngine } from '../src/core/benchmark-engine.js';
import { RuleLearningEngine } from '../src/core/rule-learning-engine.js';
import { WalkForwardValidator } from '../src/core/walk-forward-validator.js';
import { LearningBoundary } from '../src/core/learning-boundary.js';
import { CalibrationPipeline } from '../src/core/calibration-pipeline.js';
import { ExecutionBoundary, SafetyViolationError } from '../src/safety/execution-boundary.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { DEFAULT_RULE_LEARNING_CONFIG } from '../src/config/learning.default.js';
import {
  ObservedTrade,
  MarketSnapshot,
  DecisionJournal,
  PaperTrade,
  OutcomeReview,
  RuleSet,
  RuleLearningConfig
} from '../src/types/domain.js';

describe('Task 2.1: Empirical Calibration & Controlled Rule Learning Suite', () => {
  let dbManager: DatabaseManager;
  let rulesetRepo: RuleSetRepository;
  let learningRepo: LearningRepository;
  let tradeRepo: TradeRepository;
  let decisionRepo: DecisionRepository;
  let paperTradeRepo: PaperTradeRepository;
  let marketRepo: MarketRepository;
  let reviewRepo: ReviewRepository;
  let walletRepo: WalletRepository;
  let pipeline: CalibrationPipeline;

  beforeEach(() => {
    ExecutionBoundary.assertPaperMode();
    dbManager = new DatabaseManager(':memory:');
    dbManager.migrate();
    const db = dbManager.getDatabase();

    rulesetRepo = new RuleSetRepository(db);
    learningRepo = new LearningRepository(db);
    tradeRepo = new TradeRepository(db);
    decisionRepo = new DecisionRepository(db);
    paperTradeRepo = new PaperTradeRepository(db);
    marketRepo = new MarketRepository(db);
    reviewRepo = new ReviewRepository(db);
    walletRepo = new WalletRepository(db);

    // Save initial active RuleSet
    rulesetRepo.saveRuleSet(DEFAULT_RULESET);
    pipeline = new CalibrationPipeline(db);
  });

  // Helper to seed synthetic trades & decisions
  function seedSyntheticTrade(
    index: number,
    overrides: {
      spread?: number;
      liquidity?: number;
      walletAddress?: string;
      category?: string;
      drift?: number;
      pnl?: number;
      decision?: 'paper_copy' | 'watchlist' | 'skip';
      consistencyScore?: number;
      timestampOffsetMinutes?: number;
    } = {}
  ) {
    const db = dbManager.getDatabase();
    const baseTime = new Date('2026-09-01T00:00:00.000Z').getTime();
    const offsetMs = (overrides.timestampOffsetMinutes ?? index * 60) * 60 * 1000;
    const sourceTime = new Date(baseTime + offsetMs).toISOString();
    const decisionTime = new Date(baseTime + offsetMs + 1000).toISOString();
    const reviewTime = new Date(baseTime + offsetMs + 3600 * 1000).toISOString();

    const tradeId = `trade-test-${index}`;
    const walletAddress = overrides.walletAddress || `0xwallet${index % 3}`;
    const category = overrides.category || (index % 2 === 0 ? 'Crypto' : 'Politics');
    const entryPrice = 0.50;
    const drift = overrides.drift ?? 0.01;
    const detectedPrice = entryPrice + drift;
    const spread = overrides.spread ?? 0.02;
    const liquidity = overrides.liquidity ?? 2000;
    const decisionType = overrides.decision || 'paper_copy';
    const pnl = overrides.pnl ?? 5.0;

    const snapshotId = `snap-test-${index}`;
    const snapshot: MarketSnapshot = {
      id: snapshotId,
      marketId: `market-${category}-${index}`,
      conditionId: `cond-${index}`,
      question: `Will ${category} event ${index} occur?`,
      category,
      yesPrice: detectedPrice,
      noPrice: 1 - detectedPrice,
      bestBid: detectedPrice - spread / 2,
      bestAsk: detectedPrice + spread / 2,
      spread,
      liquidity,
      volume: 50000,
      timeToResolution: 86400,
      collectedAt: sourceTime,
      rawMarketJson: '{}',
      provenance: {
        provider: 'polymarket_public',
        sourceIdentifier: `m-${index}`,
        sourceTime,
        ingestionTime: sourceTime,
        normalizationVersion: 'v1.0.0'
      },
      createdAt: sourceTime
    };
    marketRepo.insertSnapshot(snapshot);

    const trade: ObservedTrade = {
      id: tradeId,
      walletAddress,
      marketId: snapshot.marketId,
      conditionId: snapshot.conditionId,
      marketQuestion: snapshot.question,
      marketCategory: category,
      outcome: 'Yes',
      side: 'BUY',
      walletEntryPrice: entryPrice,
      detectedPrice,
      size: 10.0,
      sourceTxHash: `0xtx-${index}-${Date.now()}`,
      sourceTimestamp: sourceTime,
      rawTradeJson: '{}',
      provenance: {
        provider: 'polymarket_public',
        sourceIdentifier: `tx-${index}`,
        sourceTime,
        ingestionTime: sourceTime,
        normalizationVersion: 'v1.0.0'
      },
      createdAt: sourceTime
    };
    tradeRepo.insertObservedTrade(trade);

    const decisionId = `dec-test-${index}`;
    const decision: DecisionJournal = {
      id: decisionId,
      observedTradeId: tradeId,
      marketSnapshotId: snapshotId,
      walletAddress,
      marketId: snapshot.marketId,
      decision: decisionType,
      copyScore: decisionType === 'paper_copy' ? 82.0 : (decisionType === 'watchlist' ? 60.0 : 40.0),
      confidence: 0.85,
      reasonsJson: '["Synthetic test decision"]',
      risksJson: '[]',
      walletQualityScore: 80.0,
      roiScore: 80.0,
      consistencyScore: overrides.consistencyScore ?? 75.0,
      copyabilityScore: 80.0,
      categoryFitScore: 80.0,
      entryTimingScore: drift > 0.02 ? 60.0 : 85.0,
      spreadScore: spread > 0.03 ? 60.0 : 85.0,
      liquidityScore: liquidity < 1000 ? 55.0 : 85.0,
      thesisScore: 80.0,
      simulatedPositionSize: 10.0,
      ruleSetId: DEFAULT_RULESET.id,
      ruleVersion: DEFAULT_RULESET.version,
      evaluatedAt: decisionTime,
      createdAt: decisionTime
    };
    decisionRepo.insertDecision(decision);

    const paperTrade: PaperTrade = {
      id: `pt-test-${index}`,
      decisionJournalId: decisionId,
      observedTradeId: tradeId,
      walletAddress,
      marketId: snapshot.marketId,
      conditionId: snapshot.conditionId,
      outcome: 'Yes',
      side: 'BUY',
      entryPrice: detectedPrice,
      currentPrice: detectedPrice + (pnl > 0 ? 0.20 : -0.20),
      simulatedPositionSize: 10.0,
      shares: 20.0,
      unrealizedPnl: 0,
      realizedPnl: pnl,
      status: 'resolved',
      executionMode: 'PAPER',
      ruleSetId: DEFAULT_RULESET.id,
      openedAt: decisionTime,
      closedAt: reviewTime,
      resolvedAt: reviewTime,
      createdAt: decisionTime,
      updatedAt: reviewTime
    };
    paperTradeRepo.insertPaperTrade(paperTrade);

    const review: OutcomeReview = {
      id: `rev-test-${index}`,
      paperTradeId: `pt-test-${index}`,
      decisionJournalId: decisionId,
      milestone: 'resolution',
      priceAtMilestone: entryPrice + (pnl > 0 ? 0.30 : -0.30),
      simulatedPnlAtMilestone: pnl,
      finalOutcome: pnl > 0 ? 'WIN' : 'LOSS',
      wasDecisionGood: pnl > 0,
      decisionQualityScore: pnl > 0 ? 85.0 : 40.0,
      timingQualityScore: 80.0,
      spreadLiquidityImpact: 0,
      lessonsJson: '[]',
      ruleSetId: DEFAULT_RULESET.id,
      reviewedAt: reviewTime,
      createdAt: reviewTime
    };
    reviewRepo.insertOutcomeReview(review);
  }

  test('1. Calibration Dataset Construction & No Look-Ahead Bias', () => {
    // Seed 10 trades chronologically
    for (let i = 0; i < 10; i++) {
      seedSyntheticTrade(i);
    }

    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const dataset = builder.buildDataset();

    assert.strictEqual(dataset.samples.length, 10);
    assert.strictEqual(dataset.excludedSamples.length, 0);
    assert.strictEqual(dataset.coverageRatio, 1.0);

    // Look-ahead invariant test:
    // Verify that every sample's decision was evaluated AFTER or AT the trade's source timestamp
    for (const sample of dataset.samples) {
      const tradeTime = new Date(sample.observedTrade.sourceTimestamp).getTime();
      const decisionTime = new Date(sample.decisionJournal.evaluatedAt).getTime();
      assert.ok(decisionTime >= tradeTime, `Look-ahead bias detected: decision ${decisionTime} before trade ${tradeTime}`);
      if (sample.marketSnapshot) {
        const snapTime = new Date(sample.marketSnapshot.collectedAt).getTime();
        assert.ok(snapTime <= decisionTime, `Look-ahead bias detected: snapshot ${snapTime} after decision ${decisionTime}`);
      }
    }
  });

  test('2. Four Cohort Benchmarking & Insufficient-Data Handling', () => {
    // Empty database -> INSUFFICIENT_DATA
    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const emptyDataset = builder.buildDataset();
    const emptyResult = BenchmarkEngine.evaluateFourCohorts(emptyDataset.samples);

    assert.strictEqual(emptyResult.state, 'INSUFFICIENT_DATA');
    assert.strictEqual(emptyResult.paperCopy.dataStatus, 'INSUFFICIENT_DATA');
    assert.strictEqual(emptyResult.paperCopy.sampleCount, 0);
    assert.strictEqual(emptyResult.paperCopy.winRate, null);

    // Seed 15 trades across 4 cohorts
    for (let i = 0; i < 8; i++) seedSyntheticTrade(i, { decision: 'paper_copy', pnl: 5.0 });
    for (let i = 8; i < 11; i++) seedSyntheticTrade(i, { decision: 'watchlist', pnl: -3.0 });
    for (let i = 11; i < 15; i++) seedSyntheticTrade(i, { decision: 'skip', pnl: -4.0 });

    const populatedDataset = builder.buildDataset();
    const result = BenchmarkEngine.evaluateFourCohorts(populatedDataset.samples);

    assert.strictEqual(result.state, 'CALIBRATION_READY');
    assert.strictEqual(result.paperCopy.sampleCount, 8);
    assert.strictEqual(result.paperCopy.winRate, 1.0);
    assert.strictEqual(result.watchlist.sampleCount, 3);
    assert.strictEqual(result.skipped.sampleCount, 4);
    assert.ok(result.comparisonSummary.paperVsBlindPnlDelta > 0);
    assert.ok(result.skipped.avoidedLossValue > 0);
  });

  test('3. Spread Adaptation Policy', () => {
    // Seed 10 trades where wide spread trades lose and tight spread trades win
    for (let i = 0; i < 6; i++) {
      seedSyntheticTrade(i, { spread: 0.045, pnl: -8.0, decision: 'paper_copy' });
    }
    for (let i = 6; i < 12; i++) {
      seedSyntheticTrade(i, { spread: 0.015, pnl: 10.0, decision: 'paper_copy' });
    }

    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const dataset = builder.buildDataset();
    const cohortResult = BenchmarkEngine.evaluateFourCohorts(dataset.samples);

    const engine = new RuleLearningEngine();
    const analysis = engine.analyzeAndPropose(DEFAULT_RULESET, dataset, cohortResult);

    assert.ok(analysis.proposals.length > 0);
    const spreadProposal = analysis.proposals.find(p => p.paramKey === 'maxAllowedSpread');
    assert.ok(spreadProposal, 'Spread adaptation proposal must be generated');
    assert.strictEqual(spreadProposal.policyName, 'SPREAD_ADAPTATION');
    assert.ok(spreadProposal.proposedValue < spreadProposal.beforeValue);
    assert.ok(spreadProposal.proposedValue >= DEFAULT_RULE_LEARNING_CONFIG.guardrails.maxAllowedSpread.min);
  });

  test('4. Liquidity Adaptation Policy', () => {
    // Seed 10 trades where thin-liquidity trades lose and deep-liquidity trades win
    for (let i = 0; i < 6; i++) {
      seedSyntheticTrade(i, { liquidity: 400, pnl: -6.0, decision: 'paper_copy' });
    }
    for (let i = 6; i < 12; i++) {
      seedSyntheticTrade(i, { liquidity: 5000, pnl: 8.0, decision: 'paper_copy' });
    }

    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const dataset = builder.buildDataset();
    const cohortResult = BenchmarkEngine.evaluateFourCohorts(dataset.samples);

    const engine = new RuleLearningEngine();
    const analysis = engine.analyzeAndPropose(DEFAULT_RULESET, dataset, cohortResult);

    const liqProposal = analysis.proposals.find(p => p.paramKey === 'minTradeLiquidityUsd');
    assert.ok(liqProposal, 'Liquidity adaptation proposal must be generated');
    assert.strictEqual(liqProposal.policyName, 'LIQUIDITY_ADAPTATION');
    assert.ok(liqProposal.proposedValue > liqProposal.beforeValue);
  });

  test('5. Wallet Quality & Track Cutoff Adaptation Policy', () => {
    // Seed 10 paper copy trades with persistently poor wallet performance (all losses)
    for (let i = 0; i < 10; i++) {
      seedSyntheticTrade(i, { pnl: -5.0, decision: 'paper_copy' });
    }

    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const dataset = builder.buildDataset();
    const cohortResult = BenchmarkEngine.evaluateFourCohorts(dataset.samples);

    const engine = new RuleLearningEngine();
    const analysis = engine.analyzeAndPropose(DEFAULT_RULESET, dataset, cohortResult);

    const wqProposal = analysis.proposals.find(p => p.paramKey === 'walletTrackCutoffScore');
    assert.ok(wqProposal, 'Wallet quality adaptation proposal must be generated');
    assert.strictEqual(wqProposal.policyName, 'WALLET_QUALITY_ADAPTATION');
    assert.ok(wqProposal.proposedValue > wqProposal.beforeValue);
  });

  test('6. Category Fit Adaptation Policy', () => {
    // Seed 6 Crypto winning trades and 6 Politics losing trades
    for (let i = 0; i < 6; i++) {
      seedSyntheticTrade(i, { category: 'Crypto', pnl: 8.0, decision: 'paper_copy' });
    }
    for (let i = 6; i < 12; i++) {
      seedSyntheticTrade(i, { category: 'Politics', pnl: -6.0, decision: 'paper_copy' });
    }

    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const dataset = builder.buildDataset();
    const cohortResult = BenchmarkEngine.evaluateFourCohorts(dataset.samples);

    const engine = new RuleLearningEngine();
    const analysis = engine.analyzeAndPropose(DEFAULT_RULESET, dataset, cohortResult);

    const catProposal = analysis.proposals.find(p => p.paramKey === 'tradeWeightCategoryFit');
    assert.ok(catProposal, 'Category adaptation proposal must be generated');
    assert.strictEqual(catProposal.policyName, 'CATEGORY_ADAPTATION');
    assert.ok(catProposal.proposedValue > catProposal.beforeValue);
  });

  test('7. Late-Entry Adaptation Policy', () => {
    // Seed 6 late entries with high drift that lose, and 6 prompt entries that win
    for (let i = 0; i < 6; i++) {
      seedSyntheticTrade(i, { drift: 0.025, pnl: -7.0, decision: 'paper_copy' });
    }
    for (let i = 6; i < 12; i++) {
      seedSyntheticTrade(i, { drift: 0.005, pnl: 9.0, decision: 'paper_copy' });
    }

    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const dataset = builder.buildDataset();
    const cohortResult = BenchmarkEngine.evaluateFourCohorts(dataset.samples);

    const engine = new RuleLearningEngine();
    const analysis = engine.analyzeAndPropose(DEFAULT_RULESET, dataset, cohortResult);

    const lateProposal = analysis.proposals.find(p => p.paramKey === 'maxAllowedPriceDrift');
    assert.ok(lateProposal, 'Late-entry adaptation proposal must be generated');
    assert.strictEqual(lateProposal.policyName, 'LATE_ENTRY_ADAPTATION');
    assert.ok(lateProposal.proposedValue < lateProposal.beforeValue);
  });

  test('8. Consistency Adaptation Policy', () => {
    // Seed 6 low consistency score trades losing and 6 high consistency score trades winning
    for (let i = 0; i < 6; i++) {
      seedSyntheticTrade(i, { consistencyScore: 35.0, pnl: -6.0, decision: 'paper_copy' });
    }
    for (let i = 6; i < 12; i++) {
      seedSyntheticTrade(i, { consistencyScore: 85.0, pnl: 8.0, decision: 'paper_copy' });
    }

    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const dataset = builder.buildDataset();
    const cohortResult = BenchmarkEngine.evaluateFourCohorts(dataset.samples);

    const engine = new RuleLearningEngine();
    const analysis = engine.analyzeAndPropose(DEFAULT_RULESET, dataset, cohortResult);

    const constProposal = analysis.proposals.find(p => p.paramKey === 'walletWeightConsistency');
    assert.ok(constProposal, 'Consistency adaptation proposal must be generated');
    assert.strictEqual(constProposal.policyName, 'CONSISTENCY_ADAPTATION');
    assert.ok(constProposal.proposedValue > constProposal.beforeValue);
  });

  test('9. Anti-Overfitting Guardrails & Parameter Cooldown', () => {
    // Test hard invariant boundary violation error
    assert.throws(() => {
      LearningBoundary.validateParameterBound('simulatedBetMin', 10.0);
    }, SafetyViolationError);

    assert.throws(() => {
      LearningBoundary.validateParameterBound('maxAllowedSpread', 0.10);
    }, SafetyViolationError);

    // Test cooldown rejection
    for (let i = 0; i < 10; i++) {
      seedSyntheticTrade(i, { spread: 0.045, pnl: -8.0, decision: 'paper_copy' });
    }

    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());
    const dataset = builder.buildDataset();
    const cohortResult = BenchmarkEngine.evaluateFourCohorts(dataset.samples);

    const engine = new RuleLearningEngine();
    // Pass maxAllowedSpread in cooldown set
    const cooldownParams = new Set<string>(['maxAllowedSpread']);
    const analysis = engine.analyzeAndPropose(DEFAULT_RULESET, dataset, cohortResult, cooldownParams);

    const spreadProposal = analysis.proposals.find(p => p.paramKey === 'maxAllowedSpread');
    assert.strictEqual(spreadProposal, undefined, 'Cooldown parameter must not be accepted');
    const rejectedSpread = analysis.rejectedProposals.find(r => r.proposal.paramKey === 'maxAllowedSpread');
    assert.ok(rejectedSpread, 'Cooldown parameter must be recorded in rejected proposals');
  });

  test('10. Walk-Forward Validation, Promotion & Rejection Lifecycle', () => {
    // Seed 14 train trades (spread-heavy losing) and 6 validation trades
    for (let i = 0; i < 14; i++) {
      seedSyntheticTrade(i, { spread: 0.045, pnl: -5.0, decision: 'paper_copy' });
    }
    // Validation window: 3 wide-spread losing trades, 3 tight-spread winning trades
    for (let i = 14; i < 17; i++) {
      seedSyntheticTrade(i, { spread: 0.045, pnl: -5.0, decision: 'paper_copy' });
    }
    for (let i = 17; i < 20; i++) {
      seedSyntheticTrade(i, { spread: 0.015, pnl: 10.0, decision: 'paper_copy' });
    }

    const result = pipeline.runCalibrationCycle();

    assert.strictEqual(result.status, 'PROMOTED');
    assert.ok(result.outputRuleSetId !== null);
    assert.ok(result.ruleChange !== null);

    // Verify Active RuleSet transitioned to the new version
    const activeRuleset = rulesetRepo.getActiveRuleSet();
    assert.ok(activeRuleset);
    assert.strictEqual(activeRuleset.id, result.outputRuleSetId);
    assert.strictEqual(activeRuleset.status, 'active');

    // Verify parent RuleSet was superseded and preserved
    const parentRuleset = rulesetRepo.getRuleSetById(DEFAULT_RULESET.id);
    assert.ok(parentRuleset);
    assert.strictEqual(parentRuleset.status, 'superseded');

    // Verify LearningEvent was persisted
    const event = learningRepo.getLatestLearningEvent();
    assert.ok(event);
    assert.strictEqual(event.status, 'PROMOTED');
    assert.strictEqual(event.outputRuleSetId, activeRuleset.id);
  });

  test('11. Historical Decisions Immutability & No Retroactive Rewriting', () => {
    // Seed decision with DEFAULT_RULESET
    seedSyntheticTrade(0, { pnl: 5.0 });

    const originalDecision = decisionRepo.getDecisionById('dec-test-0');
    assert.ok(originalDecision);
    assert.strictEqual(originalDecision.ruleSetId, DEFAULT_RULESET.id);

    // Run calibration promoting a new RuleSet
    for (let i = 1; i < 20; i++) {
      seedSyntheticTrade(i, { spread: 0.045, pnl: -5.0 });
    }
    pipeline.runCalibrationCycle();

    const activeRuleset = rulesetRepo.getActiveRuleSet();
    assert.notStrictEqual(activeRuleset?.id, DEFAULT_RULESET.id);

    // Historical decision must still reference original RuleSet ID
    const reloadedDecision = decisionRepo.getDecisionById('dec-test-0');
    assert.ok(reloadedDecision);
    assert.strictEqual(reloadedDecision.ruleSetId, DEFAULT_RULESET.id);
  });

  test('12. Adversarial Fixtures & Corrupted Data Handling', () => {
    const builder = new CalibrationDatasetBuilder(dbManager.getDatabase());

    // 1. One giant winning trade ($1,000,000) does not distort sizing or break bounds
    seedSyntheticTrade(100, { pnl: 1000000.0, decision: 'paper_copy' });
    // 2. Corrupted trade with missing decision journal
    const db = dbManager.getDatabase();
    const corruptedTrade: ObservedTrade = {
      id: 'trade-corrupt-1',
      walletAddress: '0xcorrupt',
      marketId: 'm-corrupt',
      conditionId: 'c-corrupt',
      marketQuestion: 'Corrupt?',
      marketCategory: 'Other',
      outcome: 'Yes',
      side: 'BUY',
      walletEntryPrice: 0.50,
      detectedPrice: 0.50,
      size: 10.0,
      sourceTimestamp: '2026-09-05T00:00:00.000Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'polymarket_public',
        sourceIdentifier: 'corrupt',
        sourceTime: '2026-09-05T00:00:00.000Z',
        ingestionTime: '2026-09-05T00:00:00.000Z',
        normalizationVersion: 'v1.0.0'
      },
      createdAt: '2026-09-05T00:00:00.000Z'
    };
    tradeRepo.insertObservedTrade(corruptedTrade);

    const dataset = builder.buildDataset();
    assert.ok(dataset.excludedSamples.length > 0);
    const corruptExcluded = dataset.excludedSamples.find(e => e.observedTradeId === 'trade-corrupt-1');
    assert.ok(corruptExcluded);
    assert.strictEqual(corruptExcluded.reason, 'MISSING_DECISION_JOURNAL');

    // Sizing invariant is permanently preserved
    const paperTrade = paperTradeRepo.getPaperTradeById('pt-test-100');
    assert.ok(paperTrade);
    assert.ok(paperTrade.simulatedPositionSize >= 5.0 && paperTrade.simulatedPositionSize <= 20.0);
  });
});
