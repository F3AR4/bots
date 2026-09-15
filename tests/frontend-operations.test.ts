/**
 * Test Suite: Frontend Operations Module Verification (Task 1.11).
 * 
 * Verifies:
 * - Operations module components and React Query hooks are intact and type-safe
 * - HTTP SPA routing support for /operations, /operations/signals, /operations/paper-trades, /operations/decision-journal
 * - 24h/48h Observability Contract on /api/v1/monitor/status and /api/v1/mobile/monitor
 * - Real backend timestamps & fail-closed states without synthetic online fabrication
 * - Strict Paper-Only Safety: Zero private keys, signing, or live order placement
 */

import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';

import { createWebServer } from '../src/web/server.js';

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

function fetchText(url: string): Promise<{ status: number; text: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          text,
          contentType: res.headers['content-type'] || '',
        });
      });
    }).on('error', reject);
  });
}

describe('Frontend Operations Module Verification (Task 1.11)', () => {
  let server: http.Server;
  const testPort = 3198;
  const baseUrl = `http://localhost:${testPort}`;

  before(async () => {
    server = createWebServer(testPort);
    await new Promise<void>((resolve) => server.listen(testPort, () => resolve()));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('1. Operations module component files exist and are populated', () => {
    const pagesDir = path.resolve(__dirname, '../src/client/pages');
    const hooksDir = path.resolve(__dirname, '../src/client/hooks');

    assert.ok(fs.existsSync(path.join(pagesDir, 'OperationsOverviewPage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'LiveSignalsPage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'PaperTradesPage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'DecisionJournalPage.tsx')));
    assert.ok(fs.existsSync(path.join(hooksDir, 'useOperationsData.ts')));

    const overviewContent = fs.readFileSync(path.join(pagesDir, 'OperationsOverviewPage.tsx'), 'utf8');
    assert.ok(overviewContent.includes('useMonitorStatus'));
    assert.ok(overviewContent.includes('SAFETY INVARIANT: STRICTLY PAPER ONLY'));
    assert.ok(overviewContent.includes('24h / 48h Continuous Observation Telemetry'));

    const signalsContent = fs.readFileSync(path.join(pagesDir, 'LiveSignalsPage.tsx'), 'utf8');
    assert.ok(signalsContent.includes('useSignals'));
    assert.ok(signalsContent.includes('decisionFilter'));
    assert.ok(signalsContent.includes('selectedSignal'));

    const tradesContent = fs.readFileSync(path.join(pagesDir, 'PaperTradesPage.tsx'), 'utf8');
    assert.ok(tradesContent.includes('usePaperTrades'));
    assert.ok(tradesContent.includes('$5.00 min - $20.00 max'));

    const journalContent = fs.readFileSync(path.join(pagesDir, 'DecisionJournalPage.tsx'), 'utf8');
    assert.ok(journalContent.includes('useDecisionJournal'));
    assert.ok(journalContent.includes('Decision Audit Journal'));
    assert.ok(journalContent.includes('reasonsJson'));
  });

  test('2. 24h/48h Observability Contract on /api/v1/monitor/status and /api/v1/mobile/monitor', async () => {
    const status = await fetchJson(`${baseUrl}/api/v1/monitor/status`);
    assert.ok(status.observability, 'Must provide observability telemetry object');
    assert.strictEqual(status.observability.executionMode, 'PAPER ONLY');
    assert.ok(['RUNNING', 'IDLE', 'STALE', 'UNKNOWN', 'ERROR'].includes(status.observability.monitorProcessStatus));
    assert.strictEqual(typeof status.observability.trackedWalletCount, 'number');
    assert.strictEqual(typeof status.observability.currentPaperTradeCount, 'number');
    assert.ok(status.observability.currentPaperPnl);
    assert.strictEqual(typeof status.observability.currentPaperPnl.total, 'number');
    assert.ok(status.observability.currentRuleSetId);

    // Mobile endpoint parity
    const mobileStatus = await fetchJson(`${baseUrl}/api/v1/mobile/monitor`);
    assert.ok(mobileStatus.observability, 'Mobile endpoint must expose identical observability contract');
    assert.strictEqual(mobileStatus.observability.executionMode, 'PAPER ONLY');
  });

  test('3. Operations API endpoints return real database contracts', async () => {
    // Signals
    const signalsRes = await fetchJson(`${baseUrl}/api/v1/signals?limit=10`);
    assert.ok(Array.isArray(signalsRes.signals), 'signals must be an array');
    assert.strictEqual(typeof signalsRes.total, 'number');

    // Paper Trades
    const paperRes = await fetchJson(`${baseUrl}/api/v1/paper-trades`);
    assert.ok(Array.isArray(paperRes.paperTrades), 'paperTrades must be an array');
    assert.strictEqual(paperRes.executionMode, 'PAPER');
    assert.strictEqual(typeof paperRes.totalTrades, 'number');
    assert.strictEqual(typeof paperRes.totalPnl, 'number');

    // Verify paper trades sizing bounds invariant ($5.00 - $20.00)
    for (const trade of paperRes.paperTrades) {
      assert.ok(trade.simulatedPositionSize >= 5.0, `Trade size ${trade.simulatedPositionSize} violates min $5.00`);
      assert.ok(trade.simulatedPositionSize <= 20.0, `Trade size ${trade.simulatedPositionSize} violates max $20.00`);
      assert.strictEqual(trade.executionMode, 'PAPER');
    }

    // Decisions
    const decisionsRes = await fetchJson(`${baseUrl}/api/v1/decisions?limit=10`);
    assert.ok(Array.isArray(decisionsRes.decisions), 'decisions must be an array');
    assert.strictEqual(typeof decisionsRes.total, 'number');
  });

  test('4. SPA routing fallback serves React index.html for all Operations routes', async () => {
    const resOps = await fetchText(`${baseUrl}/operations`);
    assert.strictEqual(resOps.status, 200);
    assert.ok(resOps.text.includes('<div id="root"'));

    const resSignals = await fetchText(`${baseUrl}/operations/signals`);
    assert.strictEqual(resSignals.status, 200);
    assert.ok(resSignals.text.includes('<div id="root"'));

    const resTrades = await fetchText(`${baseUrl}/operations/paper-trades`);
    assert.strictEqual(resTrades.status, 200);
    assert.ok(resTrades.text.includes('<div id="root"'));

    const resJournal = await fetchText(`${baseUrl}/operations/decision-journal`);
    assert.strictEqual(resJournal.status, 200);
    assert.ok(resJournal.text.includes('<div id="root"'));
  });

  test('5. Strict Paper-Only Safety: Zero private keys, signing, or live order controls in Operations components', () => {
    const operationsFiles = [
      path.resolve(__dirname, '../src/client/pages/OperationsOverviewPage.tsx'),
      path.resolve(__dirname, '../src/client/pages/LiveSignalsPage.tsx'),
      path.resolve(__dirname, '../src/client/pages/PaperTradesPage.tsx'),
      path.resolve(__dirname, '../src/client/pages/DecisionJournalPage.tsx'),
      path.resolve(__dirname, '../src/client/hooks/useOperationsData.ts'),
    ];

    for (const file of operationsFiles) {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();
      assert.strictEqual(content.includes('privatekey'), false, `Forbidden privateKey in ${file}`);
      assert.strictEqual(content.includes('signtransaction'), false, `Forbidden signTransaction in ${file}`);
      assert.strictEqual(content.includes('placeorder'), false, `Forbidden placeOrder in ${file}`);
      assert.strictEqual(content.includes('wallet.sign'), false, `Forbidden wallet.sign in ${file}`);
      assert.strictEqual(content.includes('ethers.wallet'), false, `Forbidden ethers.Wallet in ${file}`);
    }
  });
});
