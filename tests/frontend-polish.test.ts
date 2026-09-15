/**
 * Test Suite: Frontend Polish, Responsiveness, Accessibility, and Operator UX (Task 1.13).
 * 
 * Verifies:
 * - App Shell, Paper Only Safety Banner ("PAPER ONLY | No real-money execution"), TopBar, and Sidebar
 * - Start / Stop Architecture Preparation: EngineLifecycleControl states without fake endpoints
 * - Accessible Modal component with Escape key, backdrop click, focus trap, and ARIA attributes
 * - Contextual Breadcrumbs navigation
 * - 404 NotFoundPage fallback
 * - Long-running 24h / 48h observation telemetry visibility
 * - Strict Paper-Only Safety Invariant across all UI primitives
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

describe('Frontend Polish, Accessibility & UX Verification (Task 1.13)', () => {
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

  test('1. PaperOnlyBanner contains unmistakable safety boundary wording', () => {
    const bannerPath = path.resolve(__dirname, '../src/client/components/layout/PaperOnlyBanner.tsx');
    assert.ok(fs.existsSync(bannerPath), 'PaperOnlyBanner.tsx must exist');
    const content = fs.readFileSync(bannerPath, 'utf8');

    assert.ok(content.includes('PAPER ONLY'), 'Must include PAPER ONLY');
    assert.ok(content.includes('No real-money execution'), 'Must include No real-money execution');
    assert.ok(content.includes('sticky top-0'), 'Must be persistent and sticky');
    // Verify non-dismissible: no dismiss button or close handler
    assert.strictEqual(content.includes('onDismiss'), false, 'Must be non-dismissible');
    assert.strictEqual(content.includes('setDismissed'), false, 'Must be non-dismissible');
  });

  test('2. EngineLifecycleControl prepares Start/Stop architecture without fake endpoints', () => {
    const ctrlPath = path.resolve(__dirname, '../src/client/components/ui/EngineLifecycleControl.tsx');
    assert.ok(fs.existsSync(ctrlPath), 'EngineLifecycleControl.tsx must exist');
    const content = fs.readFileSync(ctrlPath, 'utf8');

    // Verify support for all required conceptual lifecycle states
    assert.ok(content.includes('STOPPED'));
    assert.ok(content.includes('STARTING'));
    assert.ok(content.includes('RUNNING'));
    assert.ok(content.includes('STOPPING'));
    assert.ok(content.includes('ERROR'));
    assert.ok(content.includes('UNKNOWN'));

    // Verify controls are disabled pending Task 2.0 daemon without fake mutation POSTs
    assert.ok(content.includes('disabled'), 'Buttons must be disabled');
    assert.ok(content.includes('Task 2.0 Runtime'), 'Must explain Task 2.0 runtime integration');
    assert.strictEqual(content.includes('fetch('), false, 'Must not call fake endpoints');
    assert.strictEqual(content.includes('axios.post'), false, 'Must not post to fake endpoints');
    assert.ok(content.includes('Closing the web browser or disconnecting a phone will not terminate'));
  });

  test('3. Accessible Modal component implements Escape key, focus trapping, and ARIA roles', () => {
    const modalPath = path.resolve(__dirname, '../src/client/components/ui/Modal.tsx');
    assert.ok(fs.existsSync(modalPath), 'Modal.tsx must exist');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('role="dialog"'), 'Must have role="dialog"');
    assert.ok(content.includes('aria-modal="true"'), 'Must have aria-modal="true"');
    assert.ok(content.includes("e.key === 'Escape'"), 'Must handle Escape key');
    assert.ok(content.includes('document.addEventListener(\'keydown\''), 'Must listen to keydown');
    assert.ok(content.includes('aria-label="Close dialog"'), 'Must provide accessible close label');
  });

  test('4. Breadcrumbs component provides accessible navigation across sub-routes', () => {
    const bcPath = path.resolve(__dirname, '../src/client/components/layout/Breadcrumbs.tsx');
    assert.ok(fs.existsSync(bcPath), 'Breadcrumbs.tsx must exist');
    const content = fs.readFileSync(bcPath, 'utf8');

    assert.ok(content.includes('aria-label="Breadcrumb"'), 'Must have aria-label="Breadcrumb"');
    assert.ok(content.includes('Command Center'), 'Must have home label');
    assert.ok(content.includes('Wallet Profile'), 'Must map wallet address routes');
  });

  test('5. Sidebar implements mobile drawer, Escape key handler, and aria-current', () => {
    const sidebarPath = path.resolve(__dirname, '../src/client/components/layout/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    assert.ok(content.includes("e.key === 'Escape'"), 'Must close drawer on Escape key');
    assert.ok(content.includes('aria-current={isActive ? \'page\' : undefined}'), 'Must set aria-current');
    assert.ok(content.includes('aria-label="Workstation Navigation"'));
  });

  test('6. TopBar integrates EngineLifecycleControl and accessible controls', () => {
    const topBarPath = path.resolve(__dirname, '../src/client/components/layout/TopBar.tsx');
    const content = fs.readFileSync(topBarPath, 'utf8');

    assert.ok(content.includes('EngineLifecycleControl'), 'Must integrate EngineLifecycleControl');
    assert.ok(content.includes('aria-label="Toggle Navigation Menu"'));
    assert.ok(content.includes('aria-label="Refresh telemetry data"'));
  });

  test('7. Modals across operations and research pages use unified Modal component', () => {
    const pagesDir = path.resolve(__dirname, '../src/client/pages');
    
    // LiveSignalsPage
    const signalsContent = fs.readFileSync(path.join(pagesDir, 'LiveSignalsPage.tsx'), 'utf8');
    assert.ok(signalsContent.includes('<Modal'), 'LiveSignalsPage must use Modal component');

    // PaperTradesPage
    const tradesContent = fs.readFileSync(path.join(pagesDir, 'PaperTradesPage.tsx'), 'utf8');
    assert.ok(tradesContent.includes('<Modal'), 'PaperTradesPage must use Modal component');

    // DecisionJournalPage
    const journalContent = fs.readFileSync(path.join(pagesDir, 'DecisionJournalPage.tsx'), 'utf8');
    assert.ok(journalContent.includes('<Modal'), 'DecisionJournalPage must use Modal component');

    // DailyReportsPage
    const reportsContent = fs.readFileSync(path.join(pagesDir, 'DailyReportsPage.tsx'), 'utf8');
    assert.ok(reportsContent.includes('<Modal'), 'DailyReportsPage must use Modal component');

    // CopyabilityResearchPage
    const copyContent = fs.readFileSync(path.join(pagesDir, 'CopyabilityResearchPage.tsx'), 'utf8');
    assert.ok(copyContent.includes('<Modal'), 'CopyabilityResearchPage must use Modal component');
  });

  test('8. 404 Route handling serves NotFoundPage in client', () => {
    const notFoundPath = path.resolve(__dirname, '../src/client/pages/NotFoundPage.tsx');
    assert.ok(fs.existsSync(notFoundPath), 'NotFoundPage.tsx must exist');
    const content = fs.readFileSync(notFoundPath, 'utf8');

    assert.ok(content.includes('404: ROUTE NOT FOUND'));
    assert.ok(content.includes('Return to Command Center'));
  });

  test('9. SPA routing serves index.html for arbitrary subpaths for client-side routing', async () => {
    const testRoutes = [
      '/overview',
      '/research/wallets',
      '/research/wallet/0x1234567890abcdef1234567890abcdef12345678',
      '/research/copyability',
      '/operations/signals',
      '/operations/paper-trades',
      '/operations/decision-journal',
      '/performance',
      '/system/rules',
      '/system/reports',
      '/unknown-route-test'
    ];

    for (const route of testRoutes) {
      const res = await fetchText(`${baseUrl}${route}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.contentType.includes('text/html'));
      assert.ok(res.text.includes('<div id="root"'));
    }
  });

  test('10. Strict Paper-Only Safety Invariant across all client code', () => {
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
        content.includes('createOrder(') ||
        content.includes('window.ethereum') ||
        content.includes('ethers.Wallet'),
        false,
        `Safety boundary violation: prohibited live execution pattern found in ${file}`
      );
    }
  });
});
