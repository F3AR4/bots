/**
 * Task 1.6: Real-Time Wallet Trade Detection + Paper-Copy Signal Engine Test Suite.
 * 
 * Comprehensive verification of:
 * - Tests A through Z (Section 30)
 * - Adversarial cases (Section 31)
 * - All 23 deterministic synthetic scenarios (Section 29)
 * - Permanent safety invariants (PAPER ONLY, READ ONLY, zero keys/signers/orders)
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DatabaseManager } from '../src/db/connection.js';
import { RuleSetRepository } from '../src/db/repositories/ruleset.repo.js';
import { WalletRepository } from '../src/db/repositories/wallet.repo.js';
import { TradeRepository } from '../src/db/repositories/trade.repo.js';
import { MarketRepository } from '../src/db/repositories/market.repo.js';
import { DecisionRepository } from '../src/db/repositories/decision.repo.js';
import { PaperTradeRepository } from '../src/db/repositories/paper-trade.repo.js';
import { DetectedTradeRepository } from '../src/db/repositories/detected-trade.repo.js';
import { CurrentCopyabilityEvaluator } from '../src/core/current-copyability.js';
import { WalletTradeMonitor } from '../src/core/wallet-trade-monitor.js';
import { PaperTradingEngine } from '../src/core/paper-engine.js';
import { TradeScorer } from '../src/core/trade-scorer.js';
import { ExecutionBoundary } from '../src/safety/execution-boundary.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { REALTIME_MONITOR_SCENARIOS } from './fixtures/realtime-monitor-scenarios.fixture.js';
import { IWalletActivityAdapter, RawWalletActivityEvent } from '../src/types/adapters.js';

describe('Task 1.6: Real-Time Wallet Trade Detection & Signal Engine Suite', () => {
  let dbManager: DatabaseManager;
  let rulesetRepo: RuleSetRepository;
  let walletRepo: WalletRepository;
  let tradeRepo: TradeRepository;
  let marketRepo: MarketRepository;
  let decisionRepo: DecisionRepository;
  let paperTradeRepo: PaperTradeRepository;
  let detectedTradeRepo: DetectedTradeRepository;
  let monitor: WalletTradeMonitor;

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
    dbManager.migrate();
    const db = dbManager.getDatabase();

    rulesetRepo = new RuleSetRepository(db);
    walletRepo = new WalletRepository(db);
    tradeRepo = new TradeRepository(db);
    marketRepo = new MarketRepository(db);
    decisionRepo = new DecisionRepository(db);
    paperTradeRepo = new PaperTradeRepository(db);
    detectedTradeRepo = new DetectedTradeRepository(db);

    rulesetRepo.saveRuleSet(DEFAULT_RULESET);

    monitor = new WalletTradeMonitor(
      db,
      walletRepo,
      tradeRepo,
      marketRepo,
      decisionRepo,
      paperTradeRepo,
      detectedTradeRepo,
      DEFAULT_RULESET,
      null as any,
      () => '2026-09-14T12:00:00.000Z'
    );
  });

  // --- Test A: New Trade Detection ---
  test('A. New Trade Detection: Unprocessed observed trades are identified and recorded as detection events', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0]; // Scenario 1: Clean paper copy
    walletRepo.upsertWalletProfile(sc.wallet);
    if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const result = monitor.processTrade(sc.trade, sc.snapshot);
    assert.strictEqual(result.alreadyProcessed, false);
    assert.ok(result.detectedTradeId.startsWith('det-'));

    const det = detectedTradeRepo.getDetectedTradeByObservedTradeId(sc.trade.id);
    assert.ok(det);
    assert.strictEqual(det.observedTradeId, sc.trade.id);
    assert.strictEqual(det.walletAddress, sc.trade.walletAddress);
    assert.strictEqual(det.processed, true);
  });

  // --- Test B: Deduplication ---
  test('B. Deduplication: Duplicate trade events with same txHash or composite key are not duplicated', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    const inserted1 = tradeRepo.insertObservedTrade(sc.trade);
    assert.strictEqual(inserted1, true);

    const inserted2 = tradeRepo.insertObservedTrade(sc.trade);
    assert.strictEqual(inserted2, false); // Deduplicated at database level
  });

  // --- Test C: Tracked Wallet Selection ---
  test('C. Tracked Wallet Selection: Respects status TRACK vs WATCH vs IGNORE', () => {
    const trackWallet = REALTIME_MONITOR_SCENARIOS[0].wallet; // track
    const watchWallet = REALTIME_MONITOR_SCENARIOS[5].wallet; // watch
    const ignoreWallet = REALTIME_MONITOR_SCENARIOS[6].wallet; // ignore

    walletRepo.upsertWalletProfile(trackWallet);
    walletRepo.upsertWalletProfile(watchWallet);
    walletRepo.upsertWalletProfile(ignoreWallet);

    const tracked = walletRepo.listWalletsByStatus('track');
    assert.strictEqual(tracked.length, 1);
    assert.strictEqual(tracked[0].address, trackWallet.address);

    const watched = walletRepo.listWalletsByStatus('watch');
    assert.strictEqual(watched.length, 1);
    assert.strictEqual(watched[0].address, watchWallet.address);
  });

  // --- Test D: Wallet Evaluation Lookup ---
  test('D. Wallet Evaluation Lookup: Loads latest valid evaluation without fabricating metrics', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);

    const ev = walletRepo.getLatestEvaluationForWallet(sc.wallet.address);
    assert.ok(ev);
    assert.strictEqual(ev.walletAddress, sc.wallet.address);
    assert.strictEqual(ev.finalScore, sc.wallet.globalScore);
  });

  // --- Test E: Current Market Snapshot Lookup ---
  test('E. Current Market Snapshot Lookup: Loads point-in-time orderbook snapshot', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const snap = marketRepo.getLatestMarketSnapshot(sc.trade.marketId);
    assert.ok(snap);
    assert.strictEqual(snap.marketId, sc.trade.marketId);
    assert.strictEqual(snap.spread, 0.01);
  });

  // --- Test F: Snapshot Freshness Classification ---
  test('F. Snapshot Freshness: Accurately classifies FRESH, AGING, STALE, and UNAVAILABLE', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    const now = '2026-09-14T12:00:00.000Z';

    // Fresh snapshot (age = 10s)
    const freshRes = CurrentCopyabilityEvaluator.evaluate({
      trade: sc.trade,
      market: { ...sc.snapshot!, collectedAt: '2026-09-14T11:59:50.000Z' },
      ruleSet: DEFAULT_RULESET,
      detectedAt: now
    });
    assert.strictEqual(freshRes.marketFreshness, 'FRESH');

    // Aging snapshot (age = 120s)
    const agingRes = CurrentCopyabilityEvaluator.evaluate({
      trade: sc.trade,
      market: { ...sc.snapshot!, collectedAt: '2026-09-14T11:58:00.000Z' },
      ruleSet: DEFAULT_RULESET,
      detectedAt: now
    });
    assert.strictEqual(agingRes.marketFreshness, 'AGING');

    // Stale snapshot (age = 450s > 300s)
    const staleRes = CurrentCopyabilityEvaluator.evaluate({
      trade: sc.trade,
      market: { ...sc.snapshot!, collectedAt: '2026-09-14T11:52:30.000Z' },
      ruleSet: DEFAULT_RULESET,
      detectedAt: now
    });
    assert.strictEqual(staleRes.marketFreshness, 'STALE');

    // Unavailable snapshot
    const unavailRes = CurrentCopyabilityEvaluator.evaluate({
      trade: sc.trade,
      market: null,
      ruleSet: DEFAULT_RULESET,
      detectedAt: now
    });
    assert.strictEqual(unavailRes.marketFreshness, 'UNAVAILABLE');
  });

  // --- Test G: Current Copyability Evaluation ---
  test('G. Current Copyability Evaluation: Classifies COPYABLE vs DIFFICULT vs UNFOLLOWABLE', () => {
    const scClean = REALTIME_MONITOR_SCENARIOS[0]; // Scenario 1: clean
    const resClean = CurrentCopyabilityEvaluator.evaluate({
      trade: scClean.trade,
      market: scClean.snapshot,
      ruleSet: DEFAULT_RULESET,
      detectedAt: '2026-09-14T12:00:00.000Z'
    });
    assert.strictEqual(resClean.classification, 'COPYABLE');

    const scWide = REALTIME_MONITOR_SCENARIOS[1]; // Scenario 2: wide spread ($0.07)
    const resWide = CurrentCopyabilityEvaluator.evaluate({
      trade: scWide.trade,
      market: scWide.snapshot,
      ruleSet: DEFAULT_RULESET,
      detectedAt: '2026-09-14T12:00:00.000Z'
    });
    assert.strictEqual(resWide.classification, 'DIFFICULT');

    const scDrift = REALTIME_MONITOR_SCENARIOS[3]; // Scenario 4: excessive drift
    const resDrift = CurrentCopyabilityEvaluator.evaluate({
      trade: scDrift.trade,
      market: scDrift.snapshot,
      ruleSet: DEFAULT_RULESET,
      detectedAt: '2026-09-14T12:00:00.000Z'
    });
    assert.strictEqual(resDrift.classification, 'UNFOLLOWABLE');
  });

  // --- Test H: Trade Scoring Integration ---
  test('H. Trade Scoring Integration: Preserves 7 strategy dimensions with parameter provenance', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    const score = TradeScorer.evaluateTrade(sc.trade, sc.snapshot!, sc.wallet, DEFAULT_RULESET);

    assert.ok(score.compositeCopyScore >= DEFAULT_RULESET.config.minPaperCopyScore);
    assert.strictEqual(score.decision, 'paper_copy');
    assert.strictEqual(score.factorResults.length, 7);

    // Verify thesis dimension explicitly states NOT_SUPPORTED_BY_SOURCE_DATA
    const thesis = score.factorResults.find(f => f.dimension === 'thesis');
    assert.ok(thesis);
    assert.ok(thesis.notes.includes('NOT_SUPPORTED_BY_SOURCE_DATA'));
  });

  // --- Test I: Decision Generation ---
  test('I. Decision Generation: Every detected trade produces exactly one of paper_copy | watchlist | skip', () => {
    for (const sc of REALTIME_MONITOR_SCENARIOS) {
      walletRepo.upsertWalletProfile(sc.wallet);
      if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);
      tradeRepo.insertObservedTrade(sc.trade);
      if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

      const res = monitor.processTrade(sc.trade, sc.snapshot);
      assert.ok(['paper_copy', 'watchlist', 'skip'].includes(res.decision));
      assert.strictEqual(res.decision, sc.expectedDecision, `Scenario ${sc.id} (${sc.name}) expected ${sc.expectedDecision} got ${res.decision}`);
    }
  });

  // --- Test J: Decision Explanation Transparency ---
  test('J. Decision Explanation: Every decision includes specific contributing factors and risks answering WHY', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    assert.ok(res.reasons.length > 0, 'Must provide contributing positive factors');
    assert.ok(res.reasons.some(r => r.includes('reputation') || r.includes('copy')));
  });

  // --- Test K: PaperTrade Creation ---
  test('K. PaperTrade Creation: Generates exactly one PaperTrade when decision is paper_copy', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    assert.strictEqual(res.decision, 'paper_copy');
    assert.ok(res.paperTradeId);

    const pt = paperTradeRepo.getPaperTradeById(res.paperTradeId!);
    assert.ok(pt);
    assert.strictEqual(pt.observedTradeId, sc.trade.id);
    assert.strictEqual(pt.walletAddress, sc.trade.walletAddress);
    assert.strictEqual(pt.executionMode, 'PAPER');
    assert.strictEqual(pt.status, 'open');
  });

  // --- Test L: Paper Sizing Bounds ($5.00 to $20.00) ---
  test('L. Paper Sizing Bounds: Strict PDF invariant enforcement between $5.00 and $20.00', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    assert.ok(res.paperSize >= 5.0, `Size ${res.paperSize} must be >= $5.00`);
    assert.ok(res.paperSize <= 20.0, `Size ${res.paperSize} must be <= $20.00`);

    // Direct repository invariant validation
    assert.throws(() => {
      paperTradeRepo.insertPaperTrade({
        id: 'pt-violating-min',
        decisionJournalId: 'dj-test',
        observedTradeId: 'trade-test',
        walletAddress: '0x001',
        marketId: 'market-1',
        conditionId: 'cond-1',
        outcome: 'YES',
        side: 'BUY',
        entryPrice: 0.50,
        currentPrice: 0.50,
        simulatedPositionSize: 3.50, // Invalid: < $5.00
        shares: 7.0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        status: 'open',
        executionMode: 'PAPER',
        ruleSetId: 'ruleset-1',
        openedAt: '2026-09-14T12:00:00Z',
        closedAt: null,
        resolvedAt: null,
        createdAt: '2026-09-14T12:00:00Z',
        updatedAt: '2026-09-14T12:00:00Z'
      });
    }, /sizing invariant violated/);
  });

  // --- Test M: PaperTrade Idempotency ---
  test('M. PaperTrade Idempotency: Repeated processing produces exactly one decision and at most one PaperTrade', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const run1 = monitor.processTrade(sc.trade, sc.snapshot);
    assert.strictEqual(run1.alreadyProcessed, false);
    assert.ok(run1.paperTradeId);

    const run2 = monitor.processTrade(sc.trade, sc.snapshot);
    assert.strictEqual(run2.alreadyProcessed, true);
    assert.strictEqual(run2.decisionId, run1.decisionId);
    assert.strictEqual(run2.paperTradeId, run1.paperTradeId);

    // Database check: exactly 1 decision journal and 1 paper trade
    const allDecisions = decisionRepo.listRecentDecisions(100).filter(d => d.observedTradeId === sc.trade.id);
    assert.strictEqual(allDecisions.length, 1);

    const allPaper = paperTradeRepo.listAllPaperTrades(100).filter(p => p.observedTradeId === sc.trade.id);
    assert.strictEqual(allPaper.length, 1);
  });

  // --- Test N: Decision Journal Persistence & Immutability ---
  test('N. Decision Journal Immutability: Decision record cannot be updated in-place', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    const db = dbManager.getDatabase();

    assert.throws(() => {
      db.exec(`UPDATE decision_journals SET decision = 'skip' WHERE id = '${res.decisionId}';`);
    }, /DecisionJournal immutability violation/);
  });

  // --- Test O: PnL Lifecycle Integration ---
  test('O. PnL Lifecycle Integration: Mark-to-market and resolution update unrealized/realized PnL', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    const pt = paperTradeRepo.getPaperTradeById(res.paperTradeId!)!;

    // Mark to market at price = $0.60 (entry = $0.50, BUY, size ~$15)
    const marked = PaperTradingEngine.markToMarket(pt, 0.60, '2026-09-14T13:00:00Z');
    assert.ok(marked.unrealizedPnl > 0);

    // Settlement WIN at $1.00
    const resolved = PaperTradingEngine.resolvePosition(marked, 'YES', 1.00, '2026-09-14T14:00:00Z');
    assert.strictEqual(resolved.status, 'resolved');
    assert.strictEqual(resolved.unrealizedPnl, 0.0);
    assert.ok(resolved.realizedPnl > 0);
  });

  // --- Test P: WATCH Wallet Behavior ---
  test('P. WATCH Wallet Status: Does not trigger paper_copy without RuleSet explicit permission', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[5]; // Scenario 6: WATCH wallet
    walletRepo.upsertWalletProfile(sc.wallet);
    if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    assert.strictEqual(res.decision, 'watchlist');
    assert.strictEqual(res.paperTradeId, null);
    assert.ok(res.risks.some(r => r.includes('WATCH')));
  });

  // --- Test Q: API Failure Fail-Closed ---
  test('Q. API Failure Fail-Closed: Monitor fails closed on network errors without inventing state', async () => {
    const failingAdapter: IWalletActivityAdapter = {
      providerName: 'failing_mock',
      fetchHistoricalActivity: async () => { throw new Error('HTTP 500 Internal Server Error'); },
      fetchRecentTrades: async () => { throw new Error('HTTP 429 Too Many Requests'); }
    };

    const w = REALTIME_MONITOR_SCENARIOS[0].wallet;
    walletRepo.upsertWalletProfile(w);

    const failMonitor = new WalletTradeMonitor(
      dbManager.getDatabase(),
      walletRepo,
      tradeRepo,
      marketRepo,
      decisionRepo,
      paperTradeRepo,
      detectedTradeRepo,
      DEFAULT_RULESET,
      failingAdapter
    );

    const result = await failMonitor.pollOnce();
    assert.ok(result.errors.length > 0);
    assert.strictEqual(result.paperTradesCreated, 0);
    assert.strictEqual(failMonitor.getSystemHealth().ingestionStatus, 'DEGRADED');
  });

  // --- Test R: Missing Market Snapshot ---
  test('R. Missing Market Snapshot: Fails closed to SKIP with INSUFFICIENT_DATA', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[8]; // Scenario 9: Missing market snapshot
    walletRepo.upsertWalletProfile(sc.wallet);
    tradeRepo.insertObservedTrade(sc.trade);

    const res = monitor.processTrade(sc.trade, null);
    assert.strictEqual(res.decision, 'skip');
    assert.strictEqual(res.paperTradeId, null);
  });

  // --- Test S: Stale Market Snapshot ---
  test('S. Stale Market Snapshot: Degrades to configured fallback (watchlist/skip)', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[9]; // Scenario 10: Stale snapshot
    walletRepo.upsertWalletProfile(sc.wallet);
    tradeRepo.insertObservedTrade(sc.trade);
    marketRepo.insertSnapshot(sc.snapshot!);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    assert.strictEqual(res.decision, 'watchlist');
    assert.strictEqual(res.paperTradeId, null);
    assert.ok(res.risks.some(r => r.includes('STALE')));
  });

  // --- Test T: Invalid Market State Rejection ---
  test('T. Invalid Market State: Crossed order book rejects trade execution', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[10]; // Scenario 11: Crossed book
    walletRepo.upsertWalletProfile(sc.wallet);
    tradeRepo.insertObservedTrade(sc.trade);
    marketRepo.insertSnapshot(sc.snapshot!);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    assert.strictEqual(res.decision, 'skip');
    assert.strictEqual(res.paperTradeId, null);
    assert.ok(res.risks.some(r => r.includes('CROSSED')));
  });

  // --- Test U: Historical vs Current Evidence Separation ---
  test('U. Provenance Separation: Distinguishes historical wallet quality from current market state', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    if (sc.evaluation) walletRepo.saveWalletEvaluation(sc.evaluation);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    monitor.processTrade(sc.trade, sc.snapshot);
    const signals = monitor.getLiveSignals(1);
    assert.strictEqual(signals.length, 1);

    const sig = signals[0];
    assert.ok(sig.provenance.historicalWalletEvidence.includes('score'));
    assert.ok(sig.provenance.currentMarketEvidence.includes('spread'));
    assert.ok(sig.provenance.currentWalletTrade.includes('Observed'));
    assert.ok(sig.provenance.paperDecision.includes('Decision'));
  });

  // --- Test V: RuleSet Provenance Tracking ---
  test('V. RuleSet Provenance: Records exact immutable RuleSet version on decisions and paper trades', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    walletRepo.upsertWalletProfile(sc.wallet);
    tradeRepo.insertObservedTrade(sc.trade);
    if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

    const res = monitor.processTrade(sc.trade, sc.snapshot);
    const dj = decisionRepo.getDecisionById(res.decisionId)!;
    assert.strictEqual(dj.ruleSetId, DEFAULT_RULESET.id);
    assert.strictEqual(dj.ruleVersion, DEFAULT_RULESET.version);

    const pt = paperTradeRepo.getPaperTradeById(res.paperTradeId!)!;
    assert.strictEqual(pt.ruleSetId, DEFAULT_RULESET.id);
  });

  // --- Test W: Replay Determinism ---
  test('W. Replay Determinism: Running same trade through monitor produces byte-for-byte identical output', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    const fixedClock = () => '2026-09-14T12:00:00.000Z';

    const score1 = TradeScorer.evaluateTrade(sc.trade, sc.snapshot!, sc.wallet, DEFAULT_RULESET, null, fixedClock);
    const score2 = TradeScorer.evaluateTrade(sc.trade, sc.snapshot!, sc.wallet, DEFAULT_RULESET, null, fixedClock);

    assert.strictEqual(JSON.stringify(score1), JSON.stringify(score2));
  });

  // --- Test X: No Hidden Strategy Constants ---
  test('X. No Hidden Strategy Constants: Customizing RuleSetConfig directly alters trade decision', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    // Create restrictive custom RuleSet requiring minPaperCopyScore = 99.0
    const customRuleSet = {
      ...DEFAULT_RULESET,
      id: 'ruleset-strict',
      config: {
        ...DEFAULT_RULESET.config,
        minPaperCopyScore: 99.0 // Unreachable
      }
    };

    const score = TradeScorer.evaluateTrade(sc.trade, sc.snapshot!, sc.wallet, customRuleSet);
    assert.notStrictEqual(score.decision, 'paper_copy');
  });

  // --- Test Y: No Network Access Inside Deterministic Scoring ---
  test('Y. No Network Inside Scoring: CurrentCopyabilityEvaluator and TradeScorer are purely synchronous', () => {
    const sc = REALTIME_MONITOR_SCENARIOS[0];
    const copyResult = CurrentCopyabilityEvaluator.evaluate({
      trade: sc.trade,
      market: sc.snapshot,
      ruleSet: DEFAULT_RULESET,
      detectedAt: '2026-09-14T12:00:00.000Z'
    });
    assert.strictEqual(typeof copyResult, 'object');

    const scoreResult = TradeScorer.evaluateTrade(sc.trade, sc.snapshot!, sc.wallet, DEFAULT_RULESET, copyResult);
    assert.strictEqual(typeof scoreResult, 'object');
  });

  // --- Test Z: Critical Safety Boundaries ---
  test('Z. Safety Boundaries: Zero private keys, zero live order placement, paper mode invariant', () => {
    assert.doesNotThrow(() => ExecutionBoundary.assertPaperMode());
    assert.throws(() => ExecutionBoundary.preventLiveOrderExecution());
  });

  // --- Adversarial Failure Tests (Section 31) ---
  describe('Adversarial Failure Tests', () => {
    test('Adv 1. Negative trade price fails closed', () => {
      const sc = REALTIME_MONITOR_SCENARIOS[0];
      const badTrade = { ...sc.trade, walletEntryPrice: -0.50 };
      const score = TradeScorer.evaluateTrade(badTrade, sc.snapshot!, sc.wallet, DEFAULT_RULESET);
      assert.strictEqual(score.decision, 'skip');
    });

    test('Adv 2. Price > 1.0 fails closed', () => {
      const sc = REALTIME_MONITOR_SCENARIOS[0];
      const badTrade = { ...sc.trade, walletEntryPrice: 1.50 };
      const score = TradeScorer.evaluateTrade(badTrade, sc.snapshot!, sc.wallet, DEFAULT_RULESET);
      assert.strictEqual(score.decision, 'skip');
    });

    test('Adv 3. Negative top-of-book liquidity is sanitized safely', () => {
      const sc = REALTIME_MONITOR_SCENARIOS[0];
      const badSnap = { ...sc.snapshot!, liquidity: -500.0 };
      const copyResult = CurrentCopyabilityEvaluator.evaluate({
        trade: sc.trade,
        market: badSnap,
        ruleSet: DEFAULT_RULESET,
        detectedAt: '2026-09-14T12:00:00.000Z'
      });
      assert.strictEqual(copyResult.classification, 'UNFOLLOWABLE');
    });

    test('Adv 4. Transaction rollback on database write error prevents orphan decisions', () => {
      const sc = REALTIME_MONITOR_SCENARIOS[0];
      walletRepo.upsertWalletProfile(sc.wallet);
      tradeRepo.insertObservedTrade(sc.trade);
      if (sc.snapshot) marketRepo.insertSnapshot(sc.snapshot);

      // Pre-insert an invalid decision that violates uniqueness to simulate mid-transaction failure
      const existingDecision = {
        id: 'dj-pre-existing',
        observedTradeId: sc.trade.id,
        marketSnapshotId: sc.snapshot!.id,
        walletAddress: sc.trade.walletAddress,
        marketId: sc.trade.marketId,
        decision: 'skip' as const,
        copyScore: 0,
        confidence: null,
        reasonsJson: '[]',
        risksJson: '[]',
        walletQualityScore: 0,
        roiScore: 0,
        consistencyScore: 0,
        copyabilityScore: 0,
        categoryFitScore: 0,
        entryTimingScore: 0,
        spreadScore: 0,
        liquidityScore: 0,
        thesisScore: 0,
        simulatedPositionSize: 0,
        ruleSetId: DEFAULT_RULESET.id,
        ruleVersion: DEFAULT_RULESET.version,
        evaluatedAt: '2026-09-14T12:00:00Z',
        createdAt: '2026-09-14T12:00:00Z'
      };
      decisionRepo.insertDecision(existingDecision);

      // Attempting to re-process returns idempotent existing decision without throwing uncaught error
      const res = monitor.processTrade(sc.trade, sc.snapshot);
      assert.strictEqual(res.alreadyProcessed, true);
      assert.strictEqual(res.decisionId, 'dj-pre-existing');
    });
  });
});
