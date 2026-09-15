/**
 * Test Suite: Frontend Research Module Verification (Task 1.10).
 * 
 * Verifies:
 * - Research module pages and hooks are intact and type-safe
 * - HTTP SPA routing support for /research, /research/wallets, /research/wallet/:address, /research/copyability
 * - Backend API endpoints backing the Research module return expected contracts
 * - Strict Paper-Only Safety: Zero private keys, signing, or live order placement in research files
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

describe('Frontend Research Module Verification (Task 1.10)', () => {
  let server: http.Server;
  const testPort = 3197;
  const baseUrl = `http://localhost:${testPort}`;

  before(async () => {
    server = createWebServer(testPort);
    await new Promise<void>((resolve) => server.listen(testPort, () => resolve()));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('1. Research module component files exist and are populated', () => {
    const pagesDir = path.resolve(__dirname, '../src/client/pages');
    const hooksDir = path.resolve(__dirname, '../src/client/hooks');

    assert.ok(fs.existsSync(path.join(pagesDir, 'ResearchRankingsPage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'WalletProfilePage.tsx')));
    assert.ok(fs.existsSync(path.join(pagesDir, 'CopyabilityResearchPage.tsx')));
    assert.ok(fs.existsSync(path.join(hooksDir, 'useResearchData.ts')));

    const rankingsContent = fs.readFileSync(path.join(pagesDir, 'ResearchRankingsPage.tsx'), 'utf8');
    assert.ok(rankingsContent.includes('useWalletRankings'));
    assert.ok(rankingsContent.includes('statusFilter'));
    assert.ok(rankingsContent.includes('searchQuery'));

    const profileContent = fs.readFileSync(path.join(pagesDir, 'WalletProfilePage.tsx'), 'utf8');
    assert.ok(profileContent.includes('useWalletProfile'));
    assert.ok(profileContent.includes('oneHitWonderDiagnostics'));
    assert.ok(profileContent.includes('dataCompleteness'));

    const copyContent = fs.readFileSync(path.join(pagesDir, 'CopyabilityResearchPage.tsx'), 'utf8');
    assert.ok(copyContent.includes('useCopyabilitySummary'));
    assert.ok(copyContent.includes('HISTORICAL RESEARCH DATA - HYPOTHETICAL SIMULATION'));
  });

  test('2. Web server routes research endpoints correctly with real DB data', async () => {
    const rankings = await fetchJson(`${baseUrl}/api/v1/research/rankings`);
    assert.ok(Array.isArray(rankings.rankings), 'rankings must be an array');
    assert.strictEqual(typeof rankings.total, 'number');
    assert.ok(rankings.activeRuleVersion);

    const copySummary = await fetchJson(`${baseUrl}/api/v1/research/copyability/summary`);
    assert.ok(copySummary.summary);
    assert.strictEqual(typeof copySummary.summary.totalTradesAnalyzed, 'number');

    const copyEvals = await fetchJson(`${baseUrl}/api/v1/research/copyability/evaluations?limit=10`);
    assert.ok(Array.isArray(copyEvals.evaluations));
  });

  test('3. SPA routing fallback serves React index.html for all Research routes', async () => {
    const resRankings = await fetchText(`${baseUrl}/research`);
    assert.strictEqual(resRankings.status, 200);
    assert.ok(resRankings.text.includes('<div id="root"'));

    const resWallets = await fetchText(`${baseUrl}/research/wallets`);
    assert.strictEqual(resWallets.status, 200);
    assert.ok(resWallets.text.includes('<div id="root"'));

    const resProfile = await fetchText(`${baseUrl}/research/wallet/0x1234567890abcdef1234567890abcdef12345678`);
    assert.strictEqual(resProfile.status, 200);
    assert.ok(resProfile.text.includes('<div id="root"'));

    const resCopy = await fetchText(`${baseUrl}/research/copyability`);
    assert.strictEqual(resCopy.status, 200);
    assert.ok(resCopy.text.includes('<div id="root"'));
  });

  test('4. Strict Paper-Only Safety: Zero private keys, signing, or live order controls in Research components', () => {
    const researchFiles = [
      path.resolve(__dirname, '../src/client/pages/ResearchRankingsPage.tsx'),
      path.resolve(__dirname, '../src/client/pages/WalletProfilePage.tsx'),
      path.resolve(__dirname, '../src/client/pages/CopyabilityResearchPage.tsx'),
      path.resolve(__dirname, '../src/client/hooks/useResearchData.ts'),
    ];

    for (const file of researchFiles) {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();
      assert.strictEqual(content.includes('privatekey'), false, `Forbidden privateKey in ${file}`);
      assert.strictEqual(content.includes('signtransaction'), false, `Forbidden signTransaction in ${file}`);
      assert.strictEqual(content.includes('placeorder'), false, `Forbidden placeOrder in ${file}`);
      assert.strictEqual(content.includes('wallet.sign'), false, `Forbidden wallet.sign in ${file}`);
      assert.strictEqual(content.includes('ethers.wallet'), false, `Forbidden ethers.Wallet in ${file}`);
    }
  });
});
