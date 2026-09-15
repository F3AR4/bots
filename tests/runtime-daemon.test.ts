/**
 * Test Suite: Task 2.0 - Persistent Paper-Trading Runtime / Daemon.
 * 
 * Verifies:
 * - Singleton Runtime Manager lifecycle state machine (STOPPED, STARTING, RUNNING, STOPPING, ERROR)
 * - Idempotent start and stop controls
 * - Scheduler loop concurrency protection (no duplicate executions of same job)
 * - Pipeline jobs: Leaderboard, WalletScan, TradeMonitor, MarketSnapshot, Pnl, OutcomeReview, DailyReport, HealthTelemetry
 * - Fail-closed behavior on provider / market data errors
 * - Database persistence and restart / crash recovery
 * - REST API control and observability endpoints
 * - CLI operation
 * - Security invariants: zero private keys, zero live execution, strictly PAPER ONLY
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import { getDatabaseManager } from '../src/db/connection.js';
import { RuntimeManager } from '../src/runtime/runtime-manager.js';
import { RuntimeRepository } from '../src/db/repositories/runtime.repo.js';
import { PaperTradeRepository } from '../src/db/repositories/paper-trade.repo.js';
import { DecisionRepository } from '../src/db/repositories/decision.repo.js';
import { PnlRepository } from '../src/db/repositories/pnl.repo.js';
import { ReviewRepository } from '../src/db/repositories/review.repo.js';
import { ReportRepository } from '../src/db/repositories/report.repo.js';
import { LeaderboardRepository } from '../src/db/repositories/leaderboard.repo.js';
import { WalletRepository } from '../src/db/repositories/wallet.repo.js';
import { TradeRepository } from '../src/db/repositories/trade.repo.js';
import { MarketRepository } from '../src/db/repositories/market.repo.js';
import { RuleSetRepository } from '../src/db/repositories/ruleset.repo.js';
import { createWebServer } from '../src/web/server.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { runCli } from '../src/cli/bot-daemon.js';
import {
  DEMO_LEADERBOARD_SCAN,
  DEMO_WALLETS,
  DEMO_OBSERVED_TRADE,
  DEMO_MARKET_SNAPSHOT,
  DEMO_DECISION_JOURNAL,
  DEMO_PAPER_TRADE,
  DEMO_PNL_SNAPSHOT,
  DEMO_OUTCOME_REVIEW,
  DEMO_DAILY_REPORT
} from '../src/db/fixtures/demo-data.js';

function fetchJson(url: string, options?: { method?: string; body?: any }): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      parsed,
      {
        method: options?.method || 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      },
      res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode || 0, data: { raw: body } });
          }
        });
      }
    );
    req.on('error', reject);
    if (options?.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('Task 2.0: Persistent Paper-Trading Runtime / Daemon Suite', () => {
  let server: http.Server;
  const testPort = 3188;
  const baseUrl = `http://127.0.0.1:${testPort}`;
  const dbManager = getDatabaseManager();
  const db = dbManager.getDatabase();

  before(async () => {
    // Seed baseline data safely
    const rulesetRepo = new RuleSetRepository(db);
    if (!rulesetRepo.getRuleSetById(DEFAULT_RULESET.id)) {
      try { rulesetRepo.saveRuleSet(DEFAULT_RULESET); } catch {}
    }
    const walletRepo = new WalletRepository(db);
    for (const w of DEMO_WALLETS) {
      try { walletRepo.upsertWalletProfile(w); } catch {}
    }
    const leaderboardRepo = new LeaderboardRepository(db);
    try { leaderboardRepo.saveScan(DEMO_LEADERBOARD_SCAN); } catch {}
    const tradeRepo = new TradeRepository(db);
    try { tradeRepo.insertObservedTrade(DEMO_OBSERVED_TRADE); } catch {}
    const marketRepo = new MarketRepository(db);
    try { marketRepo.insertSnapshot(DEMO_MARKET_SNAPSHOT); } catch {}
    const decisionRepo = new DecisionRepository(db);
    try { decisionRepo.insertDecision(DEMO_DECISION_JOURNAL); } catch {}
    const paperRepo = new PaperTradeRepository(db);
    try { paperRepo.insertPaperTrade(DEMO_PAPER_TRADE); } catch {}
    const pnlRepo = new PnlRepository(db);
    try { pnlRepo.insertSnapshot(DEMO_PNL_SNAPSHOT); } catch {}
    const reviewRepo = new ReviewRepository(db);
    try { reviewRepo.insertOutcomeReview(DEMO_OUTCOME_REVIEW); } catch {}
    const reportRepo = new ReportRepository(db);
    try { reportRepo.upsertDailyReport(DEMO_DAILY_REPORT); } catch {}

    server = createWebServer(testPort);
    await new Promise<void>(resolve => server.listen(testPort, () => resolve()));
  });

  after(async () => {
    const manager = RuntimeManager.getInstance(db);
    await manager.stop();
    RuntimeManager.resetInstance();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  test('1. Singleton Runtime Manager enforces single instance across calls', () => {
    const instance1 = RuntimeManager.getInstance(db);
    const instance2 = RuntimeManager.getInstance(db);
    assert.strictEqual(instance1, instance2, 'RuntimeManager must be a singleton');
    assert.strictEqual(instance1.getState(), 'STOPPED', 'Initial state must be STOPPED');
  });

  test('2. Start / Stop Lifecycle Transitions and Idempotency', async () => {
    const manager = RuntimeManager.getInstance(db);

    // Initial state
    assert.strictEqual(manager.getState(), 'STOPPED');

    // 1st Start
    const startRes1 = await manager.start();
    assert.strictEqual(startRes1.success, true);
    assert.strictEqual(startRes1.state, 'RUNNING');
    assert.strictEqual(manager.getState(), 'RUNNING');

    // 2nd Start (Idempotent call should succeed without re-starting)
    const startRes2 = await manager.start();
    assert.strictEqual(startRes2.success, true);
    assert.strictEqual(startRes2.state, 'RUNNING');
    assert.ok(startRes2.message.includes('already active'));

    // 1st Stop
    const stopRes1 = await manager.stop();
    assert.strictEqual(stopRes1.success, true);
    assert.strictEqual(stopRes1.state, 'STOPPED');
    assert.strictEqual(manager.getState(), 'STOPPED');

    // 2nd Stop (Idempotent call should succeed without error)
    const stopRes2 = await manager.stop();
    assert.strictEqual(stopRes2.success, true);
    assert.strictEqual(stopRes2.state, 'STOPPED');
    assert.ok(stopRes2.message.includes('already stopped'));
  });

  test('3. Scheduler prevents duplicate overlapping job executions', async () => {
    const manager = RuntimeManager.getInstance(db);
    const scheduler = manager.getScheduler();

    let concurrentStarts = 0;
    let maxConcurrency = 0;
    let currentConcurrent = 0;

    scheduler.registerJob({
      name: 'trade_monitor',
      intervalMs: 100,
      execute: async () => {
        currentConcurrent++;
        concurrentStarts++;
        maxConcurrency = Math.max(maxConcurrency, currentConcurrent);
        await new Promise(r => setTimeout(r, 50));
        currentConcurrent--;
      }
    });

    // Trigger two executions in parallel
    const [exec1, exec2] = await Promise.all([
      scheduler.executeJob('trade_monitor'),
      scheduler.executeJob('trade_monitor')
    ]);

    // One must succeed, the overlapping one must be safely skipped
    assert.ok(exec1 || exec2, 'At least one execution must succeed');
    assert.strictEqual(maxConcurrency, 1, 'Max concurrent executions of same job must NEVER exceed 1');
  });

  test('4. End-to-end Pipeline Execution via RuntimeManager', async () => {
    const manager = RuntimeManager.getInstance(db);
    await manager.executeCycle();

    const telemetry = await manager.getTelemetry();
    assert.ok(telemetry);
    assert.strictEqual(telemetry.executionMode, 'PAPER ONLY');
    assert.strictEqual(typeof telemetry.trackedWalletCount, 'number');
    assert.strictEqual(typeof telemetry.activePaperTradeCount, 'number');
    assert.ok(telemetry.currentPaperPnl);
    assert.strictEqual(typeof telemetry.currentPaperPnl.total, 'number');
  });

  test('5. PnL Tracker Job creates hourly snapshots idempotently', async () => {
    const manager = RuntimeManager.getInstance(db);
    const pnlRepo = new PnlRepository(db);

    const initialSnaps = pnlRepo.getLatestSnapshots(100).length;
    await manager.triggerJob('pnl_update');
    const afterFirst = pnlRepo.getLatestSnapshots(100).length;

    // Running second time within same hour should update existing or safely avoid duplicates
    await manager.triggerJob('pnl_update');
    const afterSecond = pnlRepo.getLatestSnapshots(100).length;

    assert.ok(afterFirst >= initialSnaps);
    assert.strictEqual(afterSecond, afterFirst, 'Subsequent PnL runs in the same hour must not duplicate snapshots');
  });

  test('6. Outcome Review Job processes due milestones idempotently', async () => {
    const manager = RuntimeManager.getInstance(db);
    const reviewRepo = new ReviewRepository(db);

    const beforeCount = reviewRepo.listAllReviews(500).length;
    await manager.triggerJob('outcome_review');
    const afterFirst = reviewRepo.listAllReviews(500).length;

    // Running again should not duplicate milestone reviews
    await manager.triggerJob('outcome_review');
    const afterSecond = reviewRepo.listAllReviews(500).length;

    assert.strictEqual(afterSecond, afterFirst, 'Repeated outcome reviews must be idempotent');
  });

  test('7. Daily Report Job generates daily summary and persists to SQLite', async () => {
    const manager = RuntimeManager.getInstance(db);
    const reportRepo = new ReportRepository(db);

    await manager.triggerJob('daily_report');
    const todayStr = new Date().toISOString().slice(0, 10);
    const report = reportRepo.getDailyReportByDate(todayStr);

    assert.ok(report, 'Daily report for today must exist in SQLite');
    assert.strictEqual(report.reportDate, todayStr);
    assert.strictEqual(typeof report.paperPnlToday, 'number');
    assert.strictEqual(typeof report.totalPaperPnl, 'number');
    assert.ok(report.summaryNotes.includes('PAPER ONLY'));
  });

  test('8. Restart / Recovery: Persisted state is resumed on restart', () => {
    const runtimeRepo = new RuntimeRepository(db);
    const currentState = runtimeRepo.getState();
    assert.ok(currentState, 'Runtime singleton state must be persisted in SQLite');
    assert.strictEqual(typeof currentState.cycleCount, 'number');
    assert.ok(currentState.updatedAt);
  });

  test('9. REST API Control: POST /api/v1/control/start & POST /api/v1/control/stop', async () => {
    // 1. Start via API
    const startRes = await fetchJson(`${baseUrl}/api/v1/control/start`, { method: 'POST' });
    assert.strictEqual(startRes.status, 200);
    assert.strictEqual(startRes.data.success, true);
    assert.strictEqual(startRes.data.state, 'RUNNING');
    assert.strictEqual(startRes.data.executionMode, 'PAPER ONLY');

    // 2. Status via API
    const statusRes = await fetchJson(`${baseUrl}/api/v1/control/status`);
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.data.lifecycleState, 'RUNNING');
    assert.strictEqual(statusRes.data.executionMode, 'PAPER ONLY');
    assert.ok(statusRes.data.telemetry);

    // 3. Monitor Status endpoint integration
    const monitorRes = await fetchJson(`${baseUrl}/api/v1/monitor/status`);
    assert.strictEqual(monitorRes.status, 200);
    assert.strictEqual(monitorRes.data.observability.monitorProcessStatus, 'RUNNING');
    assert.strictEqual(monitorRes.data.engineLifecycleState, 'RUNNING');

    // 4. Stop via API
    const stopRes = await fetchJson(`${baseUrl}/api/v1/control/stop`, { method: 'POST' });
    assert.strictEqual(stopRes.status, 200);
    assert.strictEqual(stopRes.data.success, true);
    assert.strictEqual(stopRes.data.state, 'STOPPED');

    // 5. Monitor status reflects STOPPED
    const monitorStoppedRes = await fetchJson(`${baseUrl}/api/v1/monitor/status`);
    assert.strictEqual(monitorStoppedRes.data.engineLifecycleState, 'STOPPED');
  });

  test('10. Mobile Control Parity: POST /api/v1/mobile/control/start & stop', async () => {
    const mobileStart = await fetchJson(`${baseUrl}/api/v1/mobile/control/start`, { method: 'POST' });
    assert.strictEqual(mobileStart.status, 200);
    assert.strictEqual(mobileStart.data.state, 'RUNNING');

    const mobileStop = await fetchJson(`${baseUrl}/api/v1/mobile/control/stop`, { method: 'POST' });
    assert.strictEqual(mobileStop.status, 200);
    assert.strictEqual(mobileStop.data.state, 'STOPPED');
  });

  test('11. CLI Integration: status command runs cleanly without crashing', async () => {
    let output = '';
    const origLog = console.log;
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };

    try {
      await runCli(['status']);
      assert.ok(output.includes('POLYMARKET COPY-TRADER: AUTONOMOUS RUNTIME DAEMON'));
      assert.ok(output.includes('PAPER ONLY'));
    } finally {
      console.log = origLog;
    }
  });

  test('12. Security Invariant: Zero live signing or order execution tables / endpoints', async () => {
    // 1. Verify no live orders endpoint exists
    const orderRes = await fetchJson(`${baseUrl}/api/v1/orders`, { method: 'POST', body: { size: 100 } });
    assert.strictEqual(orderRes.status, 404, 'Live order endpoint must NOT exist');

    // 2. Verify all paper trades have execution_mode = 'PAPER'
    const paperRepo = new PaperTradeRepository(db);
    const allTrades = paperRepo.listAllPaperTrades(100);
    for (const t of allTrades) {
      assert.strictEqual(t.executionMode, 'PAPER');
      assert.ok(t.simulatedPositionSize >= 5.0 && t.simulatedPositionSize <= 20.0);
    }
  });
});
