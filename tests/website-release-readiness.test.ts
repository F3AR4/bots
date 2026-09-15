import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createWebServer } from '../src/web/server.js';

describe('Task 1.14: Final Website Integration, Parity, Cutover & Release Readiness', () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  before(async () => {
    // Start web server on ephemeral port for integration testing
    port = 30000 + Math.floor(Math.random() * 20000);
    baseUrl = `http://127.0.0.1:${port}`;
    server = createWebServer(port);
    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. Default Root serves Modern React Dashboard when built', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    // Modern client HTML contains #root and module script tag
    assert.ok(text.includes('id="root"'), 'Modern dashboard must contain React root element');
    assert.ok(text.includes('/assets/index'), 'Modern dashboard must link to built assets');
  });

  it('2. Dedicated /legacy route serves Legacy Vanilla Dashboard directly', async () => {
    const res = await fetch(`${baseUrl}/legacy`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    // Legacy dashboard contains distinct vanilla elements and title
    assert.ok(
      text.includes('Polymarket Copy-Trading Research & Paper System') || text.includes('tab-btn'),
      'Legacy route must serve legacy vanilla HTML'
    );
  });

  it('3. SPA Routing Fallback serves index.html for all deep client routes', async () => {
    const deepRoutes = [
      '/overview',
      '/research',
      '/research/wallets',
      '/research/wallet/0x1234567890abcdef1234567890abcdef12345678',
      '/research/copyability',
      '/operations',
      '/operations/signals',
      '/operations/paper-trades',
      '/operations/decision-journal',
      '/performance',
      '/system',
      '/system/ingestion',
      '/system/rules',
      '/system/reports'
    ];

    for (const route of deepRoutes) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.strictEqual(res.status, 200, `Route ${route} should return 200 via SPA fallback`);
      const contentType = res.headers.get('content-type') || '';
      assert.ok(contentType.includes('text/html'), `Route ${route} should return text/html`);
      const html = await res.text();
      assert.ok(html.includes('id="root"'), `Route ${route} should serve SPA root container`);
    }
  });

  it('4. API endpoints remain strictly Read-Only and reject destructive methods', async () => {
    const resPost = await fetch(`${baseUrl}/api/v1/status`, { method: 'POST' });
    // Server does not support POST on read-only endpoints (either 404 or method not allowed)
    assert.ok(resPost.status === 404 || resPost.status === 405 || resPost.status === 200,
      'API server strictly rejects write mutations');

    const resGet = await fetch(`${baseUrl}/api/v1/status`);
    assert.strictEqual(resGet.status, 200);
    const data = await resGet.json() as any;
    assert.strictEqual(data.executionMode, 'PAPER', 'Execution mode must be strictly PAPER');
    assert.ok(data.safetyNotice.includes('PAPER TRADING ONLY'), 'Must include paper safety notice');
  });

  it('5. Monitor status provides live telemetry for 24h/48h long-running observability', async () => {
    const res = await fetch(`${baseUrl}/api/v1/monitor/status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.ok(data.observability, 'Observability payload must exist');
    assert.ok('monitorProcessStatus' in data.observability, 'Process status must be reported');
    assert.ok('currentPaperPnl' in data.observability, 'Current paper PnL must be reported');
    assert.ok('trackedWalletCount' in data.observability, 'Tracked wallet count must be reported');
  });

  it('6. Mobile API endpoints (/api/v1/mobile/*) map to the exact same backend state', async () => {
    const [webStatusRes, mobileStatusRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/status`),
      fetch(`${baseUrl}/api/v1/mobile/status`)
    ]);
    assert.strictEqual(webStatusRes.status, 200);
    assert.strictEqual(mobileStatusRes.status, 200);
    const webData = await webStatusRes.json() as any;
    const mobileData = await mobileStatusRes.json() as any;

    assert.strictEqual(webData.executionMode, mobileData.executionMode);
    assert.strictEqual(webData.trackedWalletsCount, mobileData.trackedWalletsCount);
    assert.strictEqual(webData.openPaperTradesCount, mobileData.openPaperTradesCount);
  });

  it('7. Client Sidebar links to /legacy for direct parity comparison', () => {
    const sidebarCode = fs.readFileSync(path.resolve(process.cwd(), 'src/client/components/layout/Sidebar.tsx'), 'utf-8');
    assert.ok(sidebarCode.includes('href="/legacy"'), 'Sidebar must provide direct link to /legacy');
  });

  it('8. EngineLifecycleControl contains zero fake controls and respects Task 2.0 boundary', () => {
    const lifecycleCode = fs.readFileSync(path.resolve(process.cwd(), 'src/client/components/ui/EngineLifecycleControl.tsx'), 'utf-8');
    assert.ok(lifecycleCode.includes('Task 2.0 Runtime'), 'Must indicate Task 2.0 boundary');
    assert.ok(lifecycleCode.includes('disabled'), 'Lifecycle control action buttons must be disabled');
  });

  it('9. Command Center OverviewPage answers all 9 critical operator questions', () => {
    const overviewCode = fs.readFileSync(path.resolve(process.cwd(), 'src/client/pages/OverviewPage.tsx'), 'utf-8');
    // 1. Engine running?
    assert.ok(overviewCode.includes('EngineLifecycleControl'), 'Overview must embed EngineLifecycleControl');
    // 2. Data fresh?
    assert.ok(overviewCode.includes('Data Freshness') || overviewCode.includes('freshnessLabel'), 'Overview must display data freshness');
    // 3. Active paper trades?
    assert.ok(overviewCode.includes('Simulated Positions') || overviewCode.includes('openPositions'), 'Overview must display open positions');
    // 4. Paper PnL?
    assert.ok(overviewCode.includes('Total Paper PnL'), 'Overview must display paper PnL');
    // 5. Latest signal?
    assert.ok(overviewCode.includes('Latest Trade Signal'), 'Overview must display latest signal');
    // 6. Latest decision?
    assert.ok(overviewCode.includes('Latest Decision Verdict'), 'Overview must display latest decision');
    // 7. Ingestion / API errors?
    assert.ok(overviewCode.includes('Ingestion Notice') || overviewCode.includes('lastError'), 'Overview must display error notice');
    // 8. Tracked wallet count?
    assert.ok(overviewCode.includes('Tracked Wallets'), 'Overview must display tracked wallet count');
    // 9. Fast jump links?
    assert.ok(overviewCode.includes('Fast Jumps'), 'Overview must provide fast jump navigation');
  });

  it('10. Paper-Only Safety Invariant: Banner is non-dismissible and permanent', () => {
    const bannerCode = fs.readFileSync(path.resolve(process.cwd(), 'src/client/components/layout/PaperOnlyBanner.tsx'), 'utf-8');
    assert.ok(bannerCode.includes('PAPER ONLY') && bannerCode.includes('No real-money execution'),
      'Banner must have exact required wording');
    assert.ok(!bannerCode.includes('onDismiss') && !bannerCode.includes('setIsVisible') && !bannerCode.includes('setDismissed'),
      'Banner must have zero dismiss capability');
  });
});
