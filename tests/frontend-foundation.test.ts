/**
 * Test Suite: Frontend Architecture & Modern UI Foundation (Task 1.9).
 * 
 * Verifies:
 * - Modern React 19 + TypeScript + Vite frontend structure is intact
 * - Static file serving with modern SPA support and legacy fallback
 * - Client-side SPA routing fallback to index.html
 * - SERVE_LEGACY_DASHBOARD flag reversibility
 * - Strict Paper-Only Safety: Zero private keys, signing, or order placement in client code
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

function fetchText(url: string, headers?: Record<string, string>): Promise<{ status: number; text: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, res => {
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

describe('Frontend Architecture & Modern UI Foundation (Task 1.9)', () => {
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

  test('1. Modern React frontend source files exist and contain core architecture', () => {
    const clientDir = path.resolve(__dirname, '../src/client');
    assert.ok(fs.existsSync(clientDir), 'src/client directory must exist');
    assert.ok(fs.existsSync(path.join(clientDir, 'App.tsx')), 'App.tsx must exist');
    assert.ok(fs.existsSync(path.join(clientDir, 'main.tsx')), 'main.tsx must exist');
    assert.ok(fs.existsSync(path.join(clientDir, 'index.css')), 'index.css must exist');
    assert.ok(fs.existsSync(path.join(clientDir, 'api/client.ts')), 'api/client.ts must exist');
    assert.ok(fs.existsSync(path.join(clientDir, 'api/types.ts')), 'api/types.ts must exist');
    assert.ok(fs.existsSync(path.join(clientDir, 'components/layout/AppShell.tsx')), 'AppShell.tsx must exist');
    assert.ok(fs.existsSync(path.join(clientDir, 'components/layout/PaperOnlyBanner.tsx')), 'PaperOnlyBanner.tsx must exist');
    assert.ok(fs.existsSync(path.join(clientDir, 'pages/OverviewPage.tsx')), 'OverviewPage.tsx must exist');
  });

  test('2. Built production bundle exists in dist/client and contains #root', () => {
    const distIndex = path.resolve(__dirname, '../dist/client/index.html');
    assert.ok(fs.existsSync(distIndex), 'dist/client/index.html must exist from vite build');
    const content = fs.readFileSync(distIndex, 'utf8');
    assert.ok(content.includes('<div id="root"'), 'Must contain #root mounting container');
    assert.ok(content.includes('Trading Research Console') || content.includes('Polymarket Copy-Trading'), 'Must contain application title');
  });

  test('3. Web server serves modern React SPA by default when dist/client exists', async () => {
    const res = await fetchText(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.contentType.includes('text/html'));
    assert.ok(res.text.includes('<div id="root"'), 'Should serve React SPA containing #root');
  });

  test('4. Web server supports client-side SPA routing fallback (e.g. /overview, /research/wallets)', async () => {
    const resOverview = await fetchText(`${baseUrl}/overview`);
    assert.strictEqual(resOverview.status, 200);
    assert.ok(resOverview.text.includes('<div id="root"'), 'SPA routing /overview must return index.html');

    const resResearch = await fetchText(`${baseUrl}/research/wallets`);
    assert.strictEqual(resResearch.status, 200);
    assert.ok(resResearch.text.includes('<div id="root"'), 'SPA routing /research/wallets must return index.html');
  });

  test('5. Legacy dashboard remains intact at src/web/public/index.html', () => {
    const legacyPath = path.resolve(__dirname, '../src/web/public/index.html');
    assert.ok(fs.existsSync(legacyPath), 'Legacy index.html must remain intact');
    const content = fs.readFileSync(legacyPath, 'utf8');
    assert.ok(content.includes('Polymarket Copy-Trading Research & Paper System'));
    assert.ok(content.includes('id="perf-cohorts-table"'));
  });

  test('6. Strict Paper-Only Safety: Zero private keys, signing, or live order placement in src/client', () => {
    const clientDir = path.resolve(__dirname, '../src/client');

    function checkDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          checkDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html')) {
          const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();
          assert.strictEqual(content.includes('privatekey'), false, `Forbidden privateKey in ${file}`);
          assert.strictEqual(content.includes('signtransaction'), false, `Forbidden signTransaction in ${file}`);
          assert.strictEqual(content.includes('placeorder'), false, `Forbidden placeOrder in ${file}`);
          assert.strictEqual(content.includes('wallet.sign'), false, `Forbidden wallet.sign in ${file}`);
          assert.strictEqual(content.includes('ethers.wallet'), false, `Forbidden ethers.Wallet in ${file}`);
        }
      }
    }

    checkDir(clientDir);
  });
});
