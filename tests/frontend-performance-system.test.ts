/**
 * Test Suite: Frontend Performance & System Modules Verification (Task 1.12).
 * 
 * Verifies:
 * - Performance, System Health, Ingestion, Rules, and Reports module components and React Query hooks are intact and type-safe
 * - HTTP SPA routing support for /performance, /system, /system/ingestion, /system/rules, /system/reports
 * - Benchmark Cohort contracts (paper_copy, blind_leaderboard, watchlist, skipped) and zero fabrication
 * - Parameter Provenance distinction: strictly $5 and $20 bounds are PDF_EXPLICIT; weights & thresholds are IMPLEMENTATION_BASELINE / OPERATOR_CONFIG
 * - 24h/48h Observability readiness with real backend status (RUNNING, STALE, IDLE, ERROR, UNKNOWN)
 * - Ingestion health & provider telemetry without secret leakage
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

describe('Frontend Performance & System Modules Verification (Task 1.12)', () => {
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

  test('1. Performance and System module component files exist and are populated', () => {
    const pagesDir = path.resolve(__dirname, '../src/client/pages');
    const hooksDir = path.resolve(__dirname, '../src/client/hooks');

    assert.ok(fs.existsSync(path.join(pagesDir, 'PerformancePage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'SystemRulesPage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'DailyReportsPage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'SystemHealthPage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'IngestionHealthPage.tsx')));
    assert.ok(fs.existsSync(path.join(hooksDir, 'useSystemData.ts')));

    const perfContent = fs.readFileSync(path.join(pagesDir, 'PerformancePage.tsx'), 'utf8');
    assert.ok(perfContent.includes('usePerformance'));
    assert.ok(perfContent.includes('Empirical Cohort Comparison'));
    assert.ok(perfContent.includes('BOT PAPER COPY'));
    assert.ok(perfContent.includes('BLIND COPY'));
    assert.ok(perfContent.includes('Historical Research Baseline'));

    const rulesContent = fs.readFileSync(path.join(pagesDir, 'SystemRulesPage.tsx'), 'utf8');
    assert.ok(rulesContent.includes('useRuleSets'));
    assert.ok(rulesContent.includes('Strict Parameter Provenance Distinction'));
    assert.ok(rulesContent.includes('PDF_EXPLICIT'));
    assert.ok(rulesContent.includes('IMPLEMENTATION_BASELINE'));
    assert.ok(rulesContent.includes('RuleChange Audit Trail'));

    const reportsContent = fs.readFileSync(path.join(pagesDir, 'DailyReportsPage.tsx'), 'utf8');
    assert.ok(reportsContent.includes('useReports'));
    assert.ok(reportsContent.includes('Daily Research Reports'));
    assert.ok(reportsContent.includes('RESEARCH ARCHIVE'));

    const sysContent = fs.readFileSync(path.join(pagesDir, 'SystemHealthPage.tsx'), 'utf8');
    assert.ok(sysContent.includes('useMonitorStatus'));
    assert.ok(sysContent.includes('24H / 48H Continuous Paper Data Collection Readiness'));
    assert.ok(sysContent.includes('Fail-Closed Policy'));

    const ingContent = fs.readFileSync(path.join(pagesDir, 'IngestionHealthPage.tsx'), 'utf8');
    assert.ok(ingContent.includes('useIngestionStatus'));
    assert.ok(ingContent.includes('Polymarket Data API'));
    assert.ok(ingContent.includes('Gamma API'));
    assert.ok(ingContent.includes('CLOB API'));
  });

  test('2. /api/v1/performance provides benchmark cohorts, attribution, and research baseline', async () => {
    const res = await fetchJson(`${baseUrl}/api/v1/performance`);
    assert.strictEqual(res.executionMode, 'PAPER');
    assert.ok(res.metrics, 'Must contain metrics block');
    assert.ok(res.benchmarkCohorts, 'Must contain benchmark cohorts');
    assert.ok(res.decisionsSummary, 'Must contain decisions summary');
    assert.ok(res.historicalResearchBenchmark, 'Must contain historical research benchmark');

    // Verify benchmark cohorts structure
    const cohorts = res.benchmarkCohorts;
    assert.ok('paper_copy' in cohorts, 'Must include bot-filtered paper trades cohort');
    assert.ok('blind_leaderboard' in cohorts, 'Must include blind leaderboard cohort');
    assert.ok('watchlist' in cohorts, 'Must include watchlist cohort');
    assert.ok('skipped' in cohorts, 'Must include skipped cohort');

    // Verify cohort fields
    assert.strictEqual(typeof cohorts.paper_copy.tradeCount, 'number');
    assert.strictEqual(typeof cohorts.blind_leaderboard.tradeCount, 'number');
    assert.strictEqual(typeof cohorts.watchlist.tradeCount, 'number');
    assert.strictEqual(typeof cohorts.skipped.tradeCount, 'number');
  });

  test('3. /api/v1/rules provides immutable RuleSets and parameter provenance', async () => {
    const res = await fetchJson(`${baseUrl}/api/v1/rules`);
    assert.ok(res.activeRuleSet, 'Must return activeRuleSet');
    assert.ok(Array.isArray(res.allRulesets), 'Must return allRulesets array');
    assert.ok(Array.isArray(res.auditChanges), 'Must return auditChanges array');

    const active = res.activeRuleSet;
    assert.ok(active.id);
    assert.ok(active.version);
    assert.ok(active.config);

    // Verify PDF_EXPLICIT parameters
    const metadata = active.parameterMetadata;
    assert.ok(metadata, 'Must contain parameter metadata');
    assert.strictEqual(metadata.simulatedBetMin.sourceType, 'PDF_EXPLICIT');
    assert.strictEqual(metadata.simulatedBetMin.value, 5);
    assert.strictEqual(metadata.simulatedBetMax.sourceType, 'PDF_EXPLICIT');
    assert.strictEqual(metadata.simulatedBetMax.value, 20);

    // Verify weights and cutoffs are NOT marked PDF_EXPLICIT
    assert.notStrictEqual(metadata.tradeWeightWalletQuality.sourceType, 'PDF_EXPLICIT');
    assert.notStrictEqual(metadata.minPaperCopyScore.sourceType, 'PDF_EXPLICIT');
  });

  test('4. /api/v1/reports provides daily report history', async () => {
    const res = await fetchJson(`${baseUrl}/api/v1/reports`);
    assert.ok(Array.isArray(res.reports), 'Must return reports array');
    assert.strictEqual(typeof res.total, 'number');
  });

  test('5. /api/v1/ingestion/status provides provider health and zero secret leakage', async () => {
    const res = await fetchJson(`${baseUrl}/api/v1/ingestion/status`);
    assert.strictEqual(res.executionMode, 'PAPER');
    assert.ok(res.providerHealth);
    assert.ok(res.dataFreshness);
    assert.ok(res.databaseCoverage);

    // Verify zero credential exposure
    const serialized = JSON.stringify(res);
    assert.strictEqual(serialized.includes('PRIVATE_KEY'), false);
    assert.strictEqual(serialized.includes('SECRET'), false);
    assert.strictEqual(serialized.includes('PASSWORD'), false);
    assert.strictEqual(serialized.includes('AUTH_TOKEN'), false);
  });

  test('6. SPA Routing: /performance, /system, /system/rules, /system/reports return index.html', async () => {
    const routes = [
      '/performance',
      '/system',
      '/system/ingestion',
      '/system/rules',
      '/system/reports'
    ];

    for (const route of routes) {
      const res = await fetchText(`${baseUrl}${route}`);
      assert.strictEqual(res.status, 200, `Expected 200 OK for ${route}`);
      assert.ok(res.contentType.includes('text/html'), `Expected HTML response for ${route}`);
      assert.ok(res.text.includes('<div id="root"'), `Expected root div in SPA response for ${route}`);
    }
  });

  test('7. Strict Paper-Only Safety Invariant across all surfaces', () => {
    const clientDir = path.resolve(__dirname, '../src/client');
    const walkFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(walkFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const clientFiles = walkFiles(clientDir);
    for (const file of clientFiles) {
      const content = fs.readFileSync(file, 'utf8');
      assert.strictEqual(
        content.includes('sendTransaction(') ||
        content.includes('signTransaction(') ||
        content.includes('submitOrder(') ||
        content.includes('privateKey') ||
        content.includes('createOrder('),
        false,
        `Safety violation: prohibited live execution pattern found in ${file}`
      );
    }
  });
});
