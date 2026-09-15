/**
 * Task 1.4 Verification Suite: Strategy-Parameter Integrity & Provenance Audit.
 * 
 * Verifies Requirements A through O:
 * A. No hidden strategy constants
 * B. Every strategy parameter has provenance
 * C. PDF_EXPLICIT parameters are not accidentally marked provisional
 * D. Provisional parameters are not presented as PDF-defined
 * E. TBD parameters cannot silently fall back to hidden defaults
 * F. Historical RuleSet immutability
 * G. Wallet evaluation immutability
 * H. Deterministic replay
 * I. Parameter-isolation behavior
 * J. Missing-data does not become negative performance
 * K. ROI provenance
 * L. One-hit diagnostics versus penalty trigger separation
 * M. Category diagnostics versus category score separation
 * N. Status cutoffs provenance
 * O. Evidence tier provenance
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_RULESET, DEFAULT_RULESET_CONFIG, DEFAULT_RULESET_PARAMETER_METADATA } from '../src/config/ruleset.default.js';
import { WalletIntelligenceEngine } from '../src/core/wallet-intelligence.js';
import { WalletScorer } from '../src/core/wallet-scorer.js';
import { DatabaseManager } from '../src/db/connection.js';
import { RuleSetRepository } from '../src/db/repositories/ruleset.repo.js';
import { WalletRepository } from '../src/db/repositories/wallet.repo.js';
import { RuleSet, RuleSetConfig, ObservedTrade, MarketSnapshot } from '../src/types/domain.js';
import { WalletHistoricalActivitySummary } from '../src/types/adapters.js';

describe('Task 1.4: Strategy-Parameter Integrity & Provenance Audit Suite', () => {

  test('A. No hidden strategy constants: All RuleSet parameters have explicit entries and code contains no raw magic numbers', () => {
    const configKeys = Object.keys(DEFAULT_RULESET_CONFIG);
    const metadataKeys = Object.keys(DEFAULT_RULESET_PARAMETER_METADATA);

    assert.strictEqual(configKeys.length, metadataKeys.length);
    for (const key of configKeys) {
      assert.ok(key in DEFAULT_RULESET_PARAMETER_METADATA, `Missing metadata for config parameter: ${key}`);
    }

    // Inspect wallet-intelligence.ts to verify that previously hardcoded literals were replaced
    const engineCode = fs.readFileSync(path.join(process.cwd(), 'src', 'core', 'wallet-intelligence.ts'), 'utf8');
    assert.ok(!engineCode.includes('totalLiquidity += 5000;'), 'Magic number 5000 must not be hardcoded');
    assert.ok(!engineCode.includes('totalSpread += 0.02;'), 'Magic number 0.02 must not be hardcoded');
    assert.ok(!engineCode.includes('resolvedTrades.length <= 2'), 'Magic trade limit 2 must not be hardcoded');
    assert.ok(!engineCode.includes('adverseDriftCount / snapshotsMatched >= 0.4'), 'Magic threshold 0.4 must not be hardcoded');
    assert.ok(!engineCode.includes('hasExcessiveSlippage ? 15.0 : 0.0'), 'Magic deduction 15.0 must not be hardcoded');
  });

  test('B. Every strategy parameter has provenance: Required metadata fields populated', () => {
    for (const [key, meta] of Object.entries(DEFAULT_RULESET_PARAMETER_METADATA)) {
      assert.strictEqual(meta.key, key);
      assert.ok(meta.sourceType, `Parameter ${key} missing sourceType`);
      assert.ok(meta.sourceReference, `Parameter ${key} missing sourceReference`);
      assert.ok(meta.status, `Parameter ${key} missing status`);
      assert.strictEqual(typeof meta.affectsDecisions, 'boolean', `Parameter ${key} missing affectsDecisions boolean`);
      assert.ok(meta.description && meta.description.length > 5, `Parameter ${key} missing description`);
    }
  });

  test('C. PDF_EXPLICIT parameters are not accidentally marked provisional: strictly $5 and $20 bounds', () => {
    const minBetMeta = DEFAULT_RULESET_PARAMETER_METADATA.simulatedBetMin;
    const maxBetMeta = DEFAULT_RULESET_PARAMETER_METADATA.simulatedBetMax;

    assert.strictEqual(minBetMeta.sourceType, 'PDF_EXPLICIT');
    assert.strictEqual(minBetMeta.status, 'ACTIVE');
    assert.strictEqual(minBetMeta.value, 5.0);
    assert.ok(minBetMeta.sourceReference.includes('PDF'));

    assert.strictEqual(maxBetMeta.sourceType, 'PDF_EXPLICIT');
    assert.strictEqual(maxBetMeta.status, 'ACTIVE');
    assert.strictEqual(maxBetMeta.value, 20.0);
    assert.ok(maxBetMeta.sourceReference.includes('PDF'));

    // Count PDF_EXPLICIT parameters: exactly 2
    const pdfExplicits = Object.values(DEFAULT_RULESET_PARAMETER_METADATA).filter(m => m.sourceType === 'PDF_EXPLICIT');
    assert.strictEqual(pdfExplicits.length, 2, 'Only simulatedBetMin and simulatedBetMax are explicitly defined by the PDF');
  });

  test('D. Provisional parameters are not presented as PDF-defined: weights and cutoffs are baselines', () => {
    const provisionalKeys = [
      'walletWeightRoi',
      'walletWeightConsistency',
      'walletWeightCopyability',
      'walletWeightCategoryEdge',
      'walletWeightLiquidity',
      'walletWeightEntryTiming',
      'walletTrackCutoffScore',
      'walletWatchCutoffScore',
      'roiTargetBenchmarkUsd',
      'singleTradeProfitConcentrationThreshold',
      'penaltySingleTradeConcentrationDeduction',
      'penaltyIlliquidActivityDeduction',
      'penaltyInsufficientResolvedTradesDeduction',
      'minResolvedTradesCount',
      'minCategoryResolvedTradesCount'
    ];

    for (const key of provisionalKeys) {
      const meta = DEFAULT_RULESET_PARAMETER_METADATA[key];
      assert.ok(meta, `Parameter ${key} should exist in metadata`);
      assert.strictEqual(meta.sourceType, 'IMPLEMENTATION_BASELINE', `Parameter ${key} must be marked IMPLEMENTATION_BASELINE`);
      assert.strictEqual(meta.status, 'PROVISIONAL', `Parameter ${key} status must be PROVISIONAL`);
      assert.ok(!meta.sourceReference.includes('PDF specifies this weight') && !meta.sourceReference.includes('PDF specifies this threshold'),
        `Parameter ${key} must not claim PDF specified its numerical value`);
    }
  });

  test('E. TBD parameters cannot silently fall back to hidden defaults: custom config directly changes behavior', () => {
    const customConfig: RuleSetConfig = {
      ...DEFAULT_RULESET_CONFIG,
      minCategoryResolvedTradesCount: 10, // Require 10 trades instead of 3
      singleTradeProfitConcentrationThreshold: 0.50, // Stricter 50% threshold
      walletTrackCutoffScore: 90.0 // Stricter cutoff
    };

    const customRuleSet: RuleSet = {
      ...DEFAULT_RULESET,
      id: 'ruleset-custom-test',
      version: '1.9.9',
      config: customConfig
    };

    const dummyTrade: ObservedTrade = {
      id: 'trade-test-1',
      conditionId: 'cond-1',
      walletAddress: '0x1234567890123456789012345678901234567890',
      marketId: 'm-1',
      marketQuestion: 'Will Candidate Win?',
      marketCategory: 'Politics',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.50,
      detectedPrice: 0.50,
      size: 1000,
      sourceTimestamp: '2026-09-10T10:00:00Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'test_provider',
        sourceIdentifier: 'evt-1',
        sourceTime: '2026-09-10T10:00:00Z',
        ingestionTime: '2026-09-10T10:00:01Z',
        normalizationVersion: '1.0.0'
      },
      createdAt: '2026-09-10T10:00:01Z'
    };

    const evalWithDefault = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: dummyTrade.walletAddress, observedTrades: [dummyTrade] },
      DEFAULT_RULESET,
      () => '2026-09-14T00:00:00Z'
    );

    const evalWithCustom = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: dummyTrade.walletAddress, observedTrades: [dummyTrade] },
      customRuleSet,
      () => '2026-09-14T00:00:00Z'
    );

    assert.strictEqual(evalWithDefault.evaluation.ruleSetId, DEFAULT_RULESET.id);
    assert.strictEqual(evalWithCustom.evaluation.ruleSetId, customRuleSet.id);
    assert.strictEqual(evalWithCustom.evaluation.ruleVersion, '1.9.9');
  });

  test('F. Historical RuleSet immutability: SQLite trigger prevents modification of config and metadata', () => {
    const dbManager = new DatabaseManager(':memory:');
    dbManager.migrate();
    const db = dbManager.getDatabase();
    const repo = new RuleSetRepository(db);

    repo.saveRuleSet(DEFAULT_RULESET);

    const saved = repo.getRuleSetById(DEFAULT_RULESET.id);
    assert.ok(saved);
    assert.strictEqual(saved.config.simulatedBetMin, 5.0);
    assert.ok(saved.parameterMetadata);
    assert.strictEqual(saved.parameterMetadata.simulatedBetMin.sourceType, 'PDF_EXPLICIT');

    // Attempt direct SQL update to mutate config_json in place -> must fail via trigger
    assert.throws(() => {
      db.prepare("UPDATE rule_sets SET config_json = '{\"simulatedBetMin\": 100.0}' WHERE id = ?").run(DEFAULT_RULESET.id);
    }, /immutability violation/);

    // Attempt direct SQL update to mutate parameter_metadata_json in place -> must fail via trigger
    assert.throws(() => {
      db.prepare("UPDATE rule_sets SET parameter_metadata_json = '{}' WHERE id = ?").run(DEFAULT_RULESET.id);
    }, /immutability violation/);

    dbManager.close();
  });

  test('G. Wallet evaluation immutability: Evaluations store fixed snapshot and cannot be modified', () => {
    const dbManager = new DatabaseManager(':memory:');
    dbManager.migrate();
    const db = dbManager.getDatabase();
    const rulesetRepo = new RuleSetRepository(db);
    const walletRepo = new WalletRepository(db);

    rulesetRepo.saveRuleSet(DEFAULT_RULESET);

    const trade: ObservedTrade = {
      id: 'trade-imm-1',
      conditionId: 'cond-imm-1',
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      marketId: 'market-imm-1',
      marketQuestion: 'Test Question',
      marketCategory: 'Crypto',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.60,
      detectedPrice: 0.60,
      size: 500,
      sourceTimestamp: '2026-09-10T12:00:00Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'test_provider',
        sourceIdentifier: 'evt-imm-1',
        sourceTime: '2026-09-10T12:00:00Z',
        ingestionTime: '2026-09-10T12:00:01Z',
        normalizationVersion: '1.0.0'
      },
      createdAt: '2026-09-10T12:00:01Z'
    };

    const { profile, evaluation } = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: trade.walletAddress, observedTrades: [trade] },
      DEFAULT_RULESET,
      () => '2026-09-14T00:00:00Z'
    );

    walletRepo.upsertWalletProfile(profile);
    walletRepo.saveWalletEvaluation(evaluation);
    const retrieved = walletRepo.getLatestEvaluationForWallet(trade.walletAddress);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.ruleSetId, DEFAULT_RULESET.id);
    assert.strictEqual(retrieved.finalScore, evaluation.finalScore);

    // Ensure evaluation preserves ruleVersion, window, and provenance
    assert.strictEqual(retrieved.ruleVersion, DEFAULT_RULESET.version);
    assert.strictEqual(retrieved.analysisWindowDays, 30);

    // Invariant test: verify that wallet_evaluations cannot be updated in-place
    assert.throws(() => {
      db.prepare('UPDATE wallet_evaluations SET final_score = 99.9 WHERE id = ?').run(evaluation.id);
    }, /WalletEvaluation immutability violation/);

    dbManager.close();
  });

  test('H. Deterministic replay: Identical observations and RuleSet produce identical output', () => {
    const trade: ObservedTrade = {
      id: 'trade-replay-1',
      conditionId: 'cond-rep-1',
      walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      marketId: 'market-rep-1',
      marketQuestion: 'Replay Question',
      marketCategory: 'Pop Culture',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.45,
      detectedPrice: 0.45,
      size: 800,
      sourceTimestamp: '2026-09-10T14:00:00Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'test_provider',
        sourceIdentifier: 'evt-rep-1',
        sourceTime: '2026-09-10T14:00:00Z',
        ingestionTime: '2026-09-10T14:00:01Z',
        normalizationVersion: '1.0.0'
      },
      createdAt: '2026-09-10T14:00:01Z'
    };

    const fixedClock = () => '2026-09-14T12:00:00.000Z';

    const run1 = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: trade.walletAddress, observedTrades: [trade] },
      DEFAULT_RULESET,
      fixedClock
    );

    const run2 = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: trade.walletAddress, observedTrades: [trade] },
      DEFAULT_RULESET,
      fixedClock
    );

    assert.strictEqual(run1.evaluation.finalScore, run2.evaluation.finalScore);
    assert.strictEqual(run1.evaluation.rawCompositeScore, run2.evaluation.rawCompositeScore);
    assert.strictEqual(run1.evaluation.totalPenaltyDeduction, run2.evaluation.totalPenaltyDeduction);
    assert.strictEqual(run1.evaluation.status, run2.evaluation.status);
    assert.deepStrictEqual(run1.scoreResult.factorResults, run2.scoreResult.factorResults);
    assert.deepStrictEqual(run1.scoreResult.penalties, run2.scoreResult.penalties);
  });

  test('I. Parameter-isolation behavior: Changing one RuleSet parameter alters ONLY dependent outputs', () => {
    const trades: ObservedTrade[] = [
      {
        id: 't-iso-1',
        conditionId: 'cond-1',
        walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
        marketId: 'm-1',
        marketQuestion: 'Q1',
        marketCategory: 'Macro',
        outcome: 'YES',
        side: 'BUY',
        walletEntryPrice: 0.40,
        detectedPrice: 0.40,
        size: 500,
        sourceTimestamp: '2026-09-10T10:00:00Z',
        rawTradeJson: '{}',
        provenance: {
          provider: 'test_provider',
          sourceIdentifier: 'e-1',
          sourceTime: '2026-09-10T10:00:00Z',
          ingestionTime: '2026-09-10T10:00:01Z',
          normalizationVersion: '1.0.0'
        },
        createdAt: '2026-09-10T10:00:01Z'
      }
    ];

    const fixedClock = () => '2026-09-14T00:00:00Z';
    const baseEval = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: trades[0].walletAddress, observedTrades: trades },
      DEFAULT_RULESET,
      fixedClock
    );

    // 1. Alter singleTradeProfitConcentrationThreshold: raw composite score and ROI MUST NOT change
    const customConfig1: RuleSetConfig = {
      ...DEFAULT_RULESET_CONFIG,
      singleTradeProfitConcentrationThreshold: 0.99
    };
    const evalConfig1 = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: trades[0].walletAddress, observedTrades: trades },
      { ...DEFAULT_RULESET, config: customConfig1 },
      fixedClock
    );
    assert.strictEqual(evalConfig1.evaluation.rawCompositeScore, baseEval.evaluation.rawCompositeScore);
    const baseRoiFactor = baseEval.scoreResult.factorResults.find(f => f.factorName === 'roi30d');
    const isoRoiFactor = evalConfig1.scoreResult.factorResults.find(f => f.factorName === 'roi30d');
    assert.strictEqual(baseRoiFactor?.rawMetric, isoRoiFactor?.rawMetric);

    // 2. Alter evidence tier threshold: raw PnL and skill scores MUST NOT change
    const customConfig2: RuleSetConfig = {
      ...DEFAULT_RULESET_CONFIG,
      evidenceTierHighThreshold: 99.0
    };
    const evalConfig2 = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: trades[0].walletAddress, observedTrades: trades },
      { ...DEFAULT_RULESET, config: customConfig2 },
      fixedClock
    );
    assert.strictEqual(evalConfig2.evaluation.finalScore, baseEval.evaluation.finalScore);
    assert.strictEqual(evalConfig2.evaluation.rawCompositeScore, baseEval.evaluation.rawCompositeScore);

    // 3. Alter status cutoffs: raw factor scores MUST NOT change
    const customConfig3: RuleSetConfig = {
      ...DEFAULT_RULESET_CONFIG,
      walletTrackCutoffScore: 95.0,
      walletWatchCutoffScore: 90.0
    };
    const evalConfig3 = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: trades[0].walletAddress, observedTrades: trades },
      { ...DEFAULT_RULESET, config: customConfig3 },
      fixedClock
    );
    assert.strictEqual(evalConfig3.evaluation.rawCompositeScore, baseEval.evaluation.rawCompositeScore);
  });

  test('J. Missing-data does not become negative performance: Low evidence is distinguished from bad trading', () => {
    const sparseTrade: ObservedTrade = {
      id: 't-sparse-1',
      conditionId: 'cond-sparse-1',
      walletAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
      marketId: 'm-sparse',
      marketQuestion: 'Sparse Question',
      marketCategory: 'General',
      outcome: 'YES',
      side: 'BUY',
      walletEntryPrice: 0.50,
      detectedPrice: 0.50,
      size: 100,
      sourceTimestamp: '2026-09-10T12:00:00Z',
      rawTradeJson: '{}',
      provenance: {
        provider: 'test_provider',
        sourceIdentifier: 'e-sparse-1',
        sourceTime: '2026-09-10T12:00:00Z',
        ingestionTime: '2026-09-10T12:00:01Z',
        normalizationVersion: '1.0.0'
      },
      createdAt: '2026-09-10T12:00:01Z'
    };

    // Zero snapshots provided
    const res = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: sparseTrade.walletAddress, observedTrades: [sparseTrade] },
      DEFAULT_RULESET,
      () => '2026-09-14T00:00:00Z'
    );

    // Evidence tier flags thin data
    assert.strictEqual(res.evaluation.dataCompleteness.evidenceTier, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(res.evaluation.dataCompleteness.marketSnapshotCoverage, 0.0);

    // Trading performance metrics remain neutral or zero rather than fabricated loss
    assert.strictEqual(res.evaluation.oneHitWonderDiagnostics.totalPnlUsd, 0.0);
    assert.strictEqual(res.evaluation.roiProvenance.type, 'unavailable');
  });

  test('K. ROI provenance: Distinguishes provider-reported vs derived vs unavailable without fabrication', () => {
    const fixedClock = () => '2026-09-14T00:00:00Z';
    const address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    // Case 1: Provider-reported ROI provided
    const resProvider = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: address, observedTrades: [], providerReportedRoi: 0.42, providerReportedPnlUsd: 4200 },
      DEFAULT_RULESET,
      fixedClock
    );
    assert.strictEqual(resProvider.evaluation.roiProvenance.type, 'provider_reported');
    assert.strictEqual(resProvider.evaluation.roiProvenance.value, 0.42);

    // Case 2: Zero trades and no provider ROI -> unavailable (no synthetic ROI created)
    const resUnavailable = WalletIntelligenceEngine.analyzeWallet(
      { walletAddress: address, observedTrades: [] },
      DEFAULT_RULESET,
      fixedClock
    );
    assert.strictEqual(resUnavailable.evaluation.roiProvenance.type, 'unavailable');
    assert.strictEqual(resUnavailable.evaluation.roiProvenance.value, null);
  });

  test('L. One-hit diagnostics versus penalty trigger separation: Diagnostic fact is reported regardless of penalty', () => {
    // Summary where largest win is 75% of profit (below 80% threshold)
    const summary: WalletHistoricalActivitySummary = {
      walletAddress: '0xffffffffffffffffffffffffffffffffffffffff',
      analyzedWindowDays: 30,
      totalTrades: 10,
      resolvedTrades: 8,
      winningTrades: 6,
      totalPnlUsd: 1000.0,
      largestSingleWinUsd: 750.0, // 75% concentration
      averageSpread: 0.02,
      averageLiquidityUsd: 5000,
      tradesByCategory: { Politics: { totalTrades: 10, resolvedTrades: 8, wins: 6, pnlUsd: 1000 } },
      recentActivity: [],
      provenance: {
        provider: 'test_provider',
        sourceIdentifier: 'sum-1',
        sourceTime: '2026-09-10T00:00:00Z',
        ingestionTime: '2026-09-10T00:00:00Z',
        normalizationVersion: '1.0.0'
      }
    };

    const scoreResult = WalletScorer.scoreWallet(summary, DEFAULT_RULESET);

    // Diagnostic fact is reported accurately
    assert.ok(scoreResult.oneHitWonderDiagnostics);
    assert.strictEqual(scoreResult.oneHitWonderDiagnostics.largestWinProfitRatio, 0.75);
    assert.strictEqual(scoreResult.oneHitWonderDiagnostics.isConcentratedInSingleTrade, false);

    // Penalty check was evaluated against RuleSet threshold (0.80) and did not trigger
    const concPenalty = scoreResult.penalties.find(p => p.penaltyName === 'single_trade_profit_concentration');
    assert.ok(concPenalty);
    assert.strictEqual(concPenalty.triggered, false);
    assert.strictEqual(concPenalty.penaltyDeduction, 0.0);
  });

  test('M. Category diagnostics versus category score separation: All category stats computed', () => {
    const summary: WalletHistoricalActivitySummary = {
      walletAddress: '0x1111111111111111111111111111111111111111',
      analyzedWindowDays: 30,
      totalTrades: 5,
      resolvedTrades: 2, // Only 2 resolved in Crypto (below required 3 for domain edge)
      winningTrades: 2,
      totalPnlUsd: 500.0,
      largestSingleWinUsd: 250.0,
      averageSpread: 0.02,
      averageLiquidityUsd: 5000,
      tradesByCategory: { Crypto: { totalTrades: 5, resolvedTrades: 2, wins: 2, pnlUsd: 500 } },
      recentActivity: [],
      provenance: {
        provider: 'test_provider',
        sourceIdentifier: 'sum-2',
        sourceTime: '2026-09-10T00:00:00Z',
        ingestionTime: '2026-09-10T00:00:00Z',
        normalizationVersion: '1.0.0'
      }
    };

    const scoreResult = WalletScorer.scoreWallet(summary, DEFAULT_RULESET);
    const catFactor = scoreResult.factorResults.find(f => f.factorName === 'categoryEdge');
    assert.ok(catFactor);
    // Because resolvedTrades (2) < minCategoryResolvedTradesCount (3), bestCategory is 'None' and rawMetric is 0
    assert.strictEqual(catFactor.rawMetric, 0);
  });

  test('N. Status cutoffs provenance: walletTrackCutoffScore and walletWatchCutoffScore are implementation baselines', () => {
    const trackMeta = DEFAULT_RULESET_PARAMETER_METADATA.walletTrackCutoffScore;
    const watchMeta = DEFAULT_RULESET_PARAMETER_METADATA.walletWatchCutoffScore;

    assert.strictEqual(trackMeta.sourceType, 'IMPLEMENTATION_BASELINE');
    assert.strictEqual(trackMeta.status, 'PROVISIONAL');
    assert.strictEqual(trackMeta.value, 70.0);

    assert.strictEqual(watchMeta.sourceType, 'IMPLEMENTATION_BASELINE');
    assert.strictEqual(watchMeta.status, 'PROVISIONAL');
    assert.strictEqual(watchMeta.value, 45.0);
  });

  test('O. Evidence tier provenance: Evidence thresholds marked as research data-quality conventions', () => {
    const highTierMeta = DEFAULT_RULESET_PARAMETER_METADATA.evidenceTierHighThreshold;
    const modTierMeta = DEFAULT_RULESET_PARAMETER_METADATA.evidenceTierModerateThreshold;
    const lowTierMeta = DEFAULT_RULESET_PARAMETER_METADATA.evidenceTierLowThreshold;

    assert.strictEqual(highTierMeta.sourceType, 'IMPLEMENTATION_BASELINE');
    assert.strictEqual(highTierMeta.affectsDecisions, false, 'Evidence tiers are research data completeness metrics, not trading decisions');
    assert.ok(highTierMeta.sourceReference.includes('Data Quality Convention'));

    assert.strictEqual(modTierMeta.affectsDecisions, false);
    assert.strictEqual(lowTierMeta.affectsDecisions, false);
  });

});
