/**
 * Test Suite G, H: Paper Trade Lifecycle, Outcome Reviews, and Benchmark Cohorts.
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { PaperTradingEngine } from '../src/core/paper-engine.js';
import { PnlTracker } from '../src/core/pnl-tracker.js';
import { OutcomeReviewer } from '../src/core/outcome-reviewer.js';
import { BenchmarkEngine, EvaluatedDecisionItem } from '../src/core/benchmark-engine.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { ObservedTrade, DecisionJournal } from '../src/types/domain.js';
import { TradeScoreResult } from '../src/types/scoring.js';

describe('Paper Trading Lifecycle & Retrospective Analysis', () => {
  const mockTrade: ObservedTrade = {
    id: 'ot-pt-01',
    walletAddress: '0xwallet_01',
    marketId: 'mkt-01',
    conditionId: 'cond-01',
    marketQuestion: 'Will Market Resolve YES?',
    marketCategory: 'Politics',
    outcome: 'YES',
    side: 'BUY',
    walletEntryPrice: 0.50,
    detectedPrice: 0.50,
    size: 200,
    sourceTimestamp: '2026-09-14T10:00:00Z',
    rawTradeJson: '{}',
    provenance: {
      provider: 'test',
      sourceIdentifier: 'pt-01',
      sourceTime: '2026-09-14T10:00:00Z',
      ingestionTime: '2026-09-14T10:00:01Z',
      normalizationVersion: 'v1.0.0'
    },
    createdAt: '2026-09-14T10:00:01Z'
  };

  test('Paper Trade Creation enforces $5.00 to $20.00 bounds', () => {
    const mockScoreResult: TradeScoreResult = {
      observedTradeId: mockTrade.id,
      marketSnapshotId: 'ms-01',
      walletAddress: mockTrade.walletAddress,
      marketId: mockTrade.marketId,
      ruleSetId: DEFAULT_RULESET.id,
      factorResults: [],
      compositeCopyScore: 85.0,
      confidence: 0.8,
      decision: 'paper_copy',
      reasons: ['High score'],
      risks: [],
      simulatedPositionSize: 17.0, // Between $5 and $20
      generatedAt: '2026-09-14T10:00:02Z'
    };

    const { journal, paperTrade } = PaperTradingEngine.createDecisionAndPaperTrade(
      mockTrade,
      mockScoreResult,
      DEFAULT_RULESET
    );

    assert.ok(paperTrade);
    assert.strictEqual(paperTrade?.executionMode, 'PAPER');
    assert.strictEqual(paperTrade?.simulatedPositionSize, 17.0);
    assert.strictEqual(paperTrade?.shares, 17.0 / 0.50);
    assert.strictEqual(paperTrade?.status, 'open');
    assert.strictEqual(journal.decision, 'paper_copy');
  });

  test('Mark-to-market updates floating PnL accurately', () => {
    const mockScoreResult: TradeScoreResult = {
      observedTradeId: mockTrade.id,
      marketSnapshotId: 'ms-01',
      walletAddress: mockTrade.walletAddress,
      marketId: mockTrade.marketId,
      ruleSetId: DEFAULT_RULESET.id,
      factorResults: [],
      compositeCopyScore: 85.0,
      confidence: 0.8,
      decision: 'paper_copy',
      reasons: [],
      risks: [],
      simulatedPositionSize: 10.0,
      generatedAt: '2026-09-14T10:00:02Z'
    };

    const { paperTrade } = PaperTradingEngine.createDecisionAndPaperTrade(
      mockTrade,
      mockScoreResult,
      DEFAULT_RULESET
    );
    assert.ok(paperTrade);

    // Price rises from 0.50 to 0.60 (shares = 20)
    const { updatedTrade, snapshot } = PnlTracker.createHourlySnapshot(paperTrade!, 0.60);

    // Expected profit: (0.60 - 0.50) * 20 = $2.00
    assert.strictEqual(updatedTrade.unrealizedPnl, 2.0);
    assert.strictEqual(snapshot.unrealizedPnl, 2.0);
    assert.strictEqual(snapshot.totalPositionValue, 12.0);
  });

  test('Outcome Review records milestone and evaluates decision quality', () => {
    const mockScoreResult: TradeScoreResult = {
      observedTradeId: mockTrade.id,
      marketSnapshotId: 'ms-01',
      walletAddress: mockTrade.walletAddress,
      marketId: mockTrade.marketId,
      ruleSetId: DEFAULT_RULESET.id,
      factorResults: [],
      compositeCopyScore: 85.0,
      confidence: 0.8,
      decision: 'paper_copy',
      reasons: [],
      risks: [],
      simulatedPositionSize: 10.0,
      generatedAt: '2026-09-14T10:00:02Z'
    };

    const { journal, paperTrade } = PaperTradingEngine.createDecisionAndPaperTrade(
      mockTrade,
      mockScoreResult,
      DEFAULT_RULESET
    );
    assert.ok(paperTrade);

    const reviewT1h = OutcomeReviewer.reviewMilestone(paperTrade!, journal, 'T+1h', 0.65);

    assert.strictEqual(reviewT1h.milestone, 'T+1h');
    assert.strictEqual(reviewT1h.wasDecisionGood, true);
    assert.strictEqual(reviewT1h.simulatedPnlAtMilestone, 3.0);
    assert.ok(reviewT1h.decisionQualityScore > 50);
  });

  test('Benchmark Engine accurately computes cohort comparisons and good skips', () => {
    const journalCopied: DecisionJournal = {
      id: 'dj-01',
      observedTradeId: 'ot-01',
      marketSnapshotId: 'ms-01',
      walletAddress: '0x1',
      marketId: 'mkt-01',
      decision: 'paper_copy',
      copyScore: 85,
      confidence: 0.8,
      reasonsJson: '[]',
      risksJson: '[]',
      walletQualityScore: 80,
      roiScore: 80,
      consistencyScore: 80,
      copyabilityScore: 80,
      categoryFitScore: 80,
      entryTimingScore: 80,
      spreadScore: 80,
      liquidityScore: 80,
      thesisScore: 80,
      simulatedPositionSize: 10,
      ruleSetId: DEFAULT_RULESET.id,
      ruleVersion: DEFAULT_RULESET.version,
      evaluatedAt: '2026-09-14T10:00:00Z',
      createdAt: '2026-09-14T10:00:00Z'
    };

    const journalSkipped: DecisionJournal = {
      ...journalCopied,
      id: 'dj-02',
      decision: 'skip',
      simulatedPositionSize: 0
    };

    const items: EvaluatedDecisionItem[] = [
      {
        journal: journalCopied,
        hypotheticalPnl: 4.50, // Copied and won
        marketOutcomeWon: true,
        spreadAtEntry: 0.01,
        entryDrift: 0.005
      },
      {
        journal: journalSkipped,
        hypotheticalPnl: -6.00, // Skipped a loser! (Good skip)
        marketOutcomeWon: false,
        spreadAtEntry: 0.05,
        entryDrift: 0.04
      }
    ];

    const result = BenchmarkEngine.compareCohorts(items);

    assert.strictEqual(result.paper_copy.tradeCount, 1);
    assert.strictEqual(result.paper_copy.winRate, 1.0);
    assert.strictEqual(result.paper_copy.totalPnl, 4.50);

    // Skipped trade prevented a loss
    assert.strictEqual(result.skipped.goodSkipsCount, 1);
    assert.strictEqual(result.skipped.avoidedLosersCount, 1);
  });
});
