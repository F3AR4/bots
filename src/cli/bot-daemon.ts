/**
 * CLI Control & Daemon Runner for Autonomous Paper-Trading Bot (Task 2.0).
 * 
 * Supports:
 * - npm run bot:start   -> Starts the background paper-trading runtime (via API or standalone daemon)
 * - npm run bot:stop    -> Gracefully stops the paper-trading runtime
 * - npm run bot:status  -> Prints truthful runtime status & telemetry
 * - npm run bot:run     -> Runs the persistent daemon in the foreground
 * 
 * Safety Guarantee:
 * - Strictly PAPER ONLY. Zero private keys, zero live execution.
 */

import * as http from 'node:http';
import { getDatabaseManager } from '../db/connection.js';
import { RuntimeManager } from '../runtime/runtime-manager.js';
import { RuntimeRepository } from '../db/repositories/runtime.repo.js';
import { ExecutionBoundary } from '../safety/execution-boundary.js';

const PORT = Number(process.env.PORT) || 3000;
const API_BASE = `http://127.0.0.1:${PORT}`;

async function sendApiRequest(path: string, method = 'GET'): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const req = http.request(
      url,
      {
        method,
        headers: { 'Accept': 'application/json' },
        timeout: 5000
      },
      res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode || 0, data });
          } catch {
            resolve({ status: res.statusCode || 0, data: { raw: body } });
          }
        });
      }
    );

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API request timed out'));
    });
    req.end();
  });
}

export async function runCli(args: string[]): Promise<void> {
  ExecutionBoundary.assertPaperMode();
  const command = args[0] || 'status';

  console.log('================================================================');
  console.log('POLYMARKET COPY-TRADER: AUTONOMOUS RUNTIME DAEMON (TASK 2.0)');
  console.log('EXECUTION INVARIANT: STRICTLY PAPER ONLY');
  console.log(`COMMAND: ${command.toUpperCase()}`);
  console.log('================================================================');

  switch (command) {
    case 'start': {
      console.log('[BOT CLI] Sending start command to runtime engine...');
      try {
        const res = await sendApiRequest('/api/v1/control/start', 'POST');
        if (res.status === 200) {
          console.log(`[BOT CLI] Success: ${res.data.message || 'Engine started'}`);
          console.log(`[BOT CLI] State: ${res.data.state}`);
          console.log(`[BOT CLI] Background daemon is now active. Close terminal or inspect via http://localhost:${PORT}`);
        } else {
          console.error(`[BOT CLI] Failed to start runtime via API (Status ${res.status}):`, res.data);
          process.exitCode = 1;
        }
      } catch {
        console.log('[BOT CLI] Web server not running on port ' + PORT + '. Starting standalone daemon in background...');
        const manager = RuntimeManager.getInstance();
        const startResult = await manager.start();
        console.log(`[BOT CLI] Standalone Result: ${startResult.message} (State: ${startResult.state})`);
      }
      break;
    }

    case 'stop': {
      console.log('[BOT CLI] Sending graceful stop command to runtime engine...');
      try {
        const res = await sendApiRequest('/api/v1/control/stop', 'POST');
        if (res.status === 200) {
          console.log(`[BOT CLI] Success: ${res.data.message || 'Engine stopped'}`);
          console.log(`[BOT CLI] State: ${res.data.state}`);
        } else {
          console.error(`[BOT CLI] Failed to stop runtime via API (Status ${res.status}):`, res.data);
          process.exitCode = 1;
        }
      } catch {
        console.log('[BOT CLI] Web server not responding. Updating singleton database state to STOPPED...');
        const db = getDatabaseManager().getDatabase();
        const runtimeRepo = new RuntimeRepository(db);
        const state = runtimeRepo.getState();
        if (state) {
          state.lifecycleState = 'STOPPED';
          state.stoppedAt = new Date().toISOString();
          state.updatedAt = new Date().toISOString();
          runtimeRepo.upsertState(state);
        }
        console.log('[BOT CLI] Runtime state set to STOPPED.');
      }
      break;
    }

    case 'status': {
      console.log('[BOT CLI] Querying runtime status and telemetry...');
      try {
        const res = await sendApiRequest('/api/v1/monitor/status', 'GET');
        if (res.status === 200) {
          const obs = res.data.observability || {};
          console.log('\n--- RUNTIME STATUS & HEALTH ---');
          console.log(`Lifecycle State:           ${obs.monitorProcessStatus || res.data.walletMonitorStatus}`);
          console.log(`Execution Mode:            ${obs.executionMode || res.data.executionMode}`);
          console.log(`Active Tracked Wallets:    ${obs.trackedWalletCount ?? res.data.activeTrackedWallets}`);
          console.log(`Active Paper Trades:       ${obs.currentPaperTradeCount ?? res.data.totalPaperTradesCreated}`);
          console.log(`Current Paper PnL:         Unrealized: $${obs.currentPaperPnl?.unrealized ?? 0} | Realized: $${obs.currentPaperPnl?.realized ?? 0} | Total: $${obs.currentPaperPnl?.total ?? 0}`);
          console.log(`Data Freshness:            ${obs.currentDataFreshness || res.data.marketDataFreshness}`);
          console.log(`Ingestion Provider Health: ${obs.ingestionProviderHealth || res.data.ingestionStatus}`);
          console.log(`Last Monitoring Cycle:     ${obs.lastSuccessfulMonitoringCycle || 'None'}`);
          console.log(`Last Leaderboard Scan:     ${obs.lastSuccessfulLeaderboardScan || 'None'}`);
          console.log(`Last Wallet Scan:          ${obs.lastSuccessfulWalletScan || 'None'}`);
          console.log(`Last Trade Observation:    ${obs.lastSuccessfulTradeObservation || 'None'}`);
          console.log(`Last PnL Mark-to-Market:   ${obs.lastSuccessfulPnlUpdate || 'None'}`);
          console.log(`Last Outcome Review:       ${obs.lastSuccessfulOutcomeReview || 'None'}`);
          console.log(`Last Error:                ${obs.lastError || 'None'}`);
          console.log('--------------------------------\n');
        } else {
          throw new Error(`API returned status ${res.status}`);
        }
      } catch {
        console.log('[BOT CLI] Reading directly from SQLite database...');
        const db = getDatabaseManager().getDatabase();
        const runtimeRepo = new RuntimeRepository(db);
        const state = runtimeRepo.getState();
        const latestTel = runtimeRepo.getLatestTelemetry();

        console.log('\n--- PERSISTED RUNTIME STATE ---');
        console.log(`Lifecycle State:           ${state?.lifecycleState || 'STOPPED'}`);
        console.log(`Execution Mode:            STRICTLY PAPER ONLY`);
        console.log(`Started At:                ${state?.startedAt || 'None'}`);
        console.log(`Stopped At:                ${state?.stoppedAt || 'None'}`);
        console.log(`Cycle Count:               ${state?.cycleCount || 0}`);
        console.log(`Last Heartbeat:            ${state?.lastHeartbeatAt || 'None'}`);
        console.log(`Last Error:                ${state?.lastError || 'None'}`);
        if (latestTel) {
          console.log(`Tracked Wallets:           ${latestTel.trackedWalletCount}`);
          console.log(`Active Paper Trades:       ${latestTel.activePaperTradeCount}`);
          console.log(`Total Paper PnL:           $${latestTel.currentPaperPnl.total.toFixed(2)}`);
          console.log(`Data Freshness:            ${latestTel.currentDataFreshness}`);
        }
        console.log('--------------------------------\n');
      }
      break;
    }

    case 'run': {
      console.log('[BOT CLI] Launching persistent paper-trading daemon in foreground...');
      const manager = RuntimeManager.getInstance();
      await manager.start();
      console.log('[BOT CLI] Runtime daemon is RUNNING. Press Ctrl+C to terminate.');
      // Keep process alive until signal
      await new Promise(() => {});
      break;
    }

    default:
      console.error(`Unknown bot command: ${command}. Use: start | stop | status | run`);
      process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('bot-daemon.ts')) {
  const args = process.argv.slice(2);
  runCli(args).catch(err => {
    console.error('[BOT CLI ERROR]', err);
    process.exit(1);
  });
}
