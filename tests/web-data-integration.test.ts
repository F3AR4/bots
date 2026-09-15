/**
 * Test Suite: Web Data Integration & Dashboard Integrity (Task 1.7).
 * 
 * Verifies:
 * - Dynamic /api/v1/performance endpoint computes real empirical metrics
 * - Elimination of static hardcoded performance rows in index.html
 * - No-data and insufficient-data states are handled transparently without fabrication
 * - Clear distinction of LIVE READ-ONLY DATA vs SYNTHETIC FIXTURE DATA vs HISTORICAL DATA
 * - Invariant bounds ($5.00 - $20.00) on simulated paper positions
 */

import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';

import { createWebServer } from '../src/web/server.js';
import { getDatabaseManager } from '../src/db/connection.js';
import { PaperTradeRepository } from '../src/db/repositories/paper-trade.repo.js';
import { DecisionRepository } from '../src/db/repositories/decision.repo.js';
import { ReviewRepository } from '../src/db/repositories/review.repo.js';
import { RuleSetRepository } from '../src/db/repositories/ruleset.repo.js';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { PaperTrade, DecisionJournal } from '../src/types/domain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fetchJson(url: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

describe('Web Data Integration & Dashboard Integrity (Task 1.7)', () => {
  let server: http.Server;
  const testPort = 3199;
  const baseUrl = `http://localhost:${testPort}`;

  before(async () => {
    server = createWebServer(testPort);
    await new Promise<void>((resolve) => server.listen(testPort, () => resolve()));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('1. index.html contains ZERO static hardcoded performance example rows', () => {
    const htmlPath = path.join(__dirname, '../src/web/public/index.html');
    const content = fs.readFileSync(htmlPath, 'utf8');

    // Confirm old hardcoded strings do not exist anywhere in the file
    assert.strictEqual(content.includes('<td><span class="badge badge-copy">Bot Paper Copy</span></td>\n                <td>1</td>'), false);
    assert.strictEqual(content.includes('<td>+$1.70</td>\n                <td>+$1.70</td>'), false);
    assert.strictEqual(content.includes('<td><span class="badge badge-watch">Blind Leaderboard Copy</span></td>\n                <td>3</td>'), false);
    assert.strictEqual(content.includes('<td>-$8.40</td>'), false);

    // Confirm dynamic containers exist
    assert.ok(content.includes('id="perf-cohorts-table"'));
    assert.ok(content.includes('id="perf-historical-table"'));
    assert.ok(content.includes('id="perf-paper-trades-table"'));
    assert.ok(content.includes('renderPerformance'));
    assert.ok(content.includes('renderOverview'));
  });

  test('2. /api/v1/performance returns real database-backed data structure with provenance', async () => {
    const data = await fetchJson(`${baseUrl}/api/v1/performance`);

    assert.ok(data.executionMode === 'PAPER');
    assert.ok(data.dataMode, 'Should declare dataMode');
    assert.ok(data.metrics, 'Metrics object must exist');
    assert.strictEqual(typeof data.metrics.totalPaperTrades, 'number');
    assert.strictEqual(typeof data.metrics.openPaperTrades, 'number');
    assert.strictEqual(typeof data.metrics.closedPaperTrades, 'number');
    assert.strictEqual(typeof data.metrics.realizedPnl, 'number');
    assert.strictEqual(typeof data.metrics.unrealizedPnl, 'number');
    assert.strictEqual(typeof data.metrics.totalPnl, 'number');

    // Cohort benchmarks from BenchmarkEngine
    assert.ok(data.benchmarkCohorts, 'benchmarkCohorts must exist');
    assert.ok(data.benchmarkCohorts.paper_copy);
    assert.ok(data.benchmarkCohorts.blind_leaderboard);
    assert.ok(data.benchmarkCohorts.watchlist);
    assert.ok(data.benchmarkCohorts.skipped);

    // Historical research benchmark tagged appropriately
    assert.ok(data.historicalResearchBenchmark);
    assert.strictEqual(data.historicalResearchBenchmark.dataMode, 'HISTORICAL RESEARCH DATA - HYPOTHETICAL');
  });

  test('3. /api/v1/performance handles INSUFFICIENT DATA gracefully when 0 closed trades exist', async () => {
    const data = await fetchJson(`${baseUrl}/api/v1/performance`);

    if (data.metrics.closedPaperTrades === 0) {
      assert.strictEqual(data.metrics.winRate, null);
      assert.strictEqual(data.metrics.winRateStatus, 'INSUFFICIENT DATA');
      assert.ok(data.metrics.winRateReason.includes('Awaiting market settlement'));
    } else {
      assert.strictEqual(typeof data.metrics.winRate, 'number');
      assert.strictEqual(data.metrics.winRateStatus, 'AVAILABLE');
    }
  });

  test('4. /api/v1/status provides complete operational overview state', async () => {
    const s = await fetchJson(`${baseUrl}/api/v1/status`);

    assert.strictEqual(s.executionMode, 'PAPER');
    assert.ok(s.safetyNotice.includes('PAPER TRADING ONLY'));
    assert.ok(s.databaseStatus);
    assert.strictEqual(s.databaseStatus.connected, true);
    assert.strictEqual(s.databaseStatus.engine, 'node:sqlite (DatabaseSync)');
    assert.ok(s.ingestionStatus);
    assert.ok(s.walletMonitorStatus);
    assert.ok(s.marketDataFreshness);
    assert.strictEqual(typeof s.openPaperTradesCount, 'number');
    assert.strictEqual(typeof s.totalPaperTradesCount, 'number');
    assert.ok(s.currentPnl);
    assert.strictEqual(typeof s.currentPnl.totalPnl, 'number');
  });

  test('5. Paper Trading Sizing Invariant: Position sizes strictly bounded between $5.00 and $20.00', () => {
    const db = getDatabaseManager().getDatabase();
    const paperRepo = new PaperTradeRepository(db);
    const trades = paperRepo.listAllPaperTrades(100);

    for (const t of trades) {
      assert.ok(
        t.simulatedPositionSize >= 5.0 && t.simulatedPositionSize <= 20.0,
        `Paper trade ${t.id} size $${t.simulatedPositionSize} violated [$5, $20] invariant`
      );
      assert.strictEqual(t.executionMode, 'PAPER');
    }
  });

  test('6. Read-Only API Invariant: No write/POST endpoints exist on web server', async () => {
    // Attempt POST to an endpoint
    const postOptions = {
      hostname: 'localhost',
      port: testPort,
      path: '/api/v1/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const statusCode = await new Promise<number>((resolve) => {
      const req = http.request(postOptions, res => resolve(res.statusCode || 0));
      req.write(JSON.stringify({ action: 'BUY', size: 100 }));
      req.end();
    });

    // Server must reject or return 404 (read-only surface)
    assert.strictEqual(statusCode, 404);
  });
});
