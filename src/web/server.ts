/**
 * Web Application & Observability REST API Server.
 * 
 * Safety Guarantee:
 * - Read-only API surface for web and mobile.
 * - Displays prominent PAPER TRADING ONLY notice.
 * - Zero endpoints for signing, wallet credentials, or live order placement.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabaseManager } from '../db/connection.js';
import { RuleSetRepository } from '../db/repositories/ruleset.repo.js';
import { WalletRepository } from '../db/repositories/wallet.repo.js';
import { TradeRepository } from '../db/repositories/trade.repo.js';
import { DecisionRepository } from '../db/repositories/decision.repo.js';
import { PaperTradeRepository } from '../db/repositories/paper-trade.repo.js';
import { ReportRepository } from '../db/repositories/report.repo.js';
import { ReviewRepository } from '../db/repositories/review.repo.js';
import { PnlRepository } from '../db/repositories/pnl.repo.js';
import { LeaderboardRepository } from '../db/repositories/leaderboard.repo.js';
import { MarketRepository } from '../db/repositories/market.repo.js';
import { IngestionRepository } from '../db/repositories/ingestion.repo.js';
import { HistoricalCopyRepository } from '../db/repositories/historical-copy.repo.js';
import { DetectedTradeRepository } from '../db/repositories/detected-trade.repo.js';
import { HistoricalTradeResearchPipeline } from '../core/historical-trade-research.js';
import { WalletTradeMonitor } from '../core/wallet-trade-monitor.js';
import { BenchmarkEngine, EvaluatedDecisionItem } from '../core/benchmark-engine.js';
import { LearningRepository } from '../db/repositories/learning.repo.js';
import { CalibrationPipeline } from '../core/calibration-pipeline.js';
import { DEFAULT_RULESET } from '../config/ruleset.default.js';
import { ExecutionBoundary } from '../safety/execution-boundary.js';
import { RuntimeManager } from '../runtime/runtime-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createWebServer(port = 3000): http.Server {
  ExecutionBoundary.assertPaperMode();
  const db = getDatabaseManager().getDatabase();

  const rulesetRepo = new RuleSetRepository(db);
  const walletRepo = new WalletRepository(db);
  const tradeRepo = new TradeRepository(db);
  const decisionRepo = new DecisionRepository(db);
  const paperTradeRepo = new PaperTradeRepository(db);
  const reportRepo = new ReportRepository(db);
  const leaderboardRepo = new LeaderboardRepository(db);
  const marketRepo = new MarketRepository(db);
  const ingestionRepo = new IngestionRepository(db);
  const histCopyRepo = new HistoricalCopyRepository(db);
  const detectedTradeRepo = new DetectedTradeRepository(db);
  const reviewRepo = new ReviewRepository(db);
  const pnlRepo = new PnlRepository(db);
  const learningRepo = new LearningRepository(db);
  const runtimeManager = RuntimeManager.getInstance(db);
  const monitor = runtimeManager.getTradeMonitor().getMonitor();
  const calibrationPipeline = runtimeManager.getCalibrationJob().getPipeline();

  const server = http.createServer((req, res) => {
    // CORS headers for local observability and control
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // --- REST API ENDPOINTS ---
    if (pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');

      try {
        // --- Task 2.0: Real Engine Lifecycle Control Endpoints ---
        if ((pathname === '/api/v1/control/start' || pathname === '/api/v1/mobile/control/start') && req.method === 'POST') {
          runtimeManager.start().then(result => {
            res.writeHead(result.success ? 200 : 500);
            res.end(JSON.stringify({
              success: result.success,
              state: result.state,
              message: result.message,
              executionMode: 'PAPER ONLY',
              timestamp: new Date().toISOString()
            }));
          }).catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: (err as Error).message }));
          });
          return;
        }

        if ((pathname === '/api/v1/control/stop' || pathname === '/api/v1/mobile/control/stop') && req.method === 'POST') {
          runtimeManager.stop().then(result => {
            res.writeHead(result.success ? 200 : 500);
            res.end(JSON.stringify({
              success: result.success,
              state: result.state,
              message: result.message,
              executionMode: 'PAPER ONLY',
              timestamp: new Date().toISOString()
            }));
          }).catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: (err as Error).message }));
          });
          return;
        }

        if (pathname === '/api/v1/control/status') {
          const state = runtimeManager.getState();
          runtimeManager.getTelemetry().then(telemetry => {
            res.writeHead(200);
            res.end(JSON.stringify({
              lifecycleState: state,
              executionMode: 'PAPER ONLY',
              telemetry,
              timestamp: new Date().toISOString()
            }));
          }).catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: (err as Error).message }));
          });
          return;
        }

        if (pathname === '/api/v1/status' || pathname === '/api/v1/mobile/status') {
          const activeRuleset = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;
          const allTrades = paperTradeRepo.listAllPaperTrades(500);
          const openTrades = allTrades.filter(t => t.status === 'open');
          const closedTrades = allTrades.filter(t => t.status === 'closed' || t.status === 'resolved');
          const trackedWallets = walletRepo.listWalletsByStatus('track');
          const unrealizedPnl = openTrades.reduce((acc, t) => acc + t.unrealizedPnl, 0);
          const realizedPnl = closedTrades.reduce((acc, t) => acc + t.realizedPnl, 0);
          const totalPaperPnl = unrealizedPnl + realizedPnl;

          // Ingestion & Market freshness
          const recentScans = leaderboardRepo.listRecentScans(1);
          const latestScan = recentScans.length > 0 ? recentScans[0] : null;
          const latestOp = ingestionRepo.getLatestOperation();
          const recentOps = ingestionRepo.listRecentOperations(10);
          const recentSnapshots = marketRepo.listRecentSnapshots(1);
          const latestSnapshot = recentSnapshots.length > 0 ? recentSnapshots[0] : null;

          let dataMode: 'LIVE READ-ONLY DATA' | 'SYNTHETIC FIXTURE DATA' | 'NO DATA' = 'NO DATA';
          let lastIngestionTime: string | null = null;
          if (latestScan) {
            dataMode = latestScan.provenance.isDemo ? 'SYNTHETIC FIXTURE DATA' : 'LIVE READ-ONLY DATA';
            lastIngestionTime = latestScan.scannedAt;
          } else if (latestOp) {
            dataMode = latestOp.isLive ? 'LIVE READ-ONLY DATA' : 'SYNTHETIC FIXTURE DATA';
            lastIngestionTime = latestOp.startedAt;
          }

          const snapshotAgeSeconds = latestSnapshot
            ? Math.max(0, Math.floor((Date.now() - new Date(latestSnapshot.collectedAt).getTime()) / 1000))
            : null;

          const monitorHealth = monitor.getSystemHealth();
          const latestSignals = monitor.getLiveSignals(1);
          const latestSignal = latestSignals.length > 0 ? latestSignals[0] : null;
          const latestDecisions = decisionRepo.listRecentDecisions(1);
          const latestDecision = latestDecisions.length > 0 ? latestDecisions[0] : null;

          const failedOp = recentOps.find(o => o.status === 'failed' || o.errorsCount > 0);
          const lastError = failedOp
            ? `Operation ${failedOp.operationType} failed with ${failedOp.errorsCount} error(s)`
            : null;

          res.writeHead(200);
          res.end(JSON.stringify({
            status: failedOp ? 'DEGRADED' : 'HEALTHY',
            executionMode: 'PAPER',
            safetyNotice: 'PAPER TRADING ONLY - No live execution or private keys supported',
            dataMode,
            databaseStatus: {
              connected: true,
              engine: 'node:sqlite (DatabaseSync)',
              location: 'data/copy_trading.db'
            },
            ingestionStatus: {
              health: latestScan ? 'OPERATIONAL' : (latestOp ? 'ACTIVE' : 'IDLE'),
              lastIngestionTime,
              dataMode
            },
            walletMonitorStatus: {
              status: monitorHealth.ingestionStatus,
              executionMode: monitorHealth.executionMode,
              marketDataFreshness: monitorHealth.marketDataFreshness
            },
            marketDataFreshness: {
              lastSnapshotTime: latestSnapshot ? latestSnapshot.collectedAt : null,
              ageSeconds: snapshotAgeSeconds,
              freshnessLabel: snapshotAgeSeconds === null ? 'NO DATA' : (snapshotAgeSeconds < 3600 ? 'FRESH (<1h)' : `${Math.floor(snapshotAgeSeconds / 3600)}h ago`)
            },
            activeRuleVersion: activeRuleset.version,
            trackedWalletsCount: trackedWallets.length,
            openPaperTradesCount: openTrades.length,
            totalPaperTradesCount: allTrades.length,
            currentPnl: {
              unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
              realizedPnl: Math.round(realizedPnl * 100) / 100,
              totalPnl: Math.round(totalPaperPnl * 100) / 100
            },
            totalUnrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
            latestSignal: latestSignal ? {
              id: latestSignal.id,
              decision: latestSignal.decision,
              marketId: latestSignal.marketId,
              walletAddress: latestSignal.walletAddress,
              finalScore: latestSignal.finalScore,
              timestamp: latestSignal.detectedAt
            } : null,
            latestDecision: latestDecision ? {
              id: latestDecision.id,
              decision: latestDecision.decision,
              marketId: latestDecision.marketId,
              walletAddress: latestDecision.walletAddress,
              copyScore: latestDecision.copyScore,
              evaluatedAt: latestDecision.evaluatedAt
            } : null,
            lastSuccessfulIngestion: lastIngestionTime,
            lastError,
            timestamp: new Date().toISOString()
          }));
          return;
        }

        if (pathname === '/api/v1/wallets' || pathname === '/api/v1/mobile/wallets') {
          const category = url.searchParams.get('category');
          let wallets = category
            ? walletRepo.listProfilesByCategory(category, 50)
            : walletRepo.listTopWallets(50);
          const evaluations = walletRepo.listWalletEvaluations(undefined, 50);
          res.writeHead(200);
          res.end(JSON.stringify({ wallets, evaluations, total: wallets.length }));
          return;
        }

        if (pathname === '/api/v1/research/rankings') {
          const category = url.searchParams.get('category');
          const evaluations = walletRepo.listWalletEvaluations(undefined, 100);
          const filtered = category
            ? evaluations.filter(e => e.bestCategory.toLowerCase() === category.toLowerCase())
            : evaluations;
          res.writeHead(200);
          res.end(JSON.stringify({
            rankings: filtered,
            total: filtered.length,
            activeRuleVersion: (rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET).version,
            analysisWindowDays: 30
          }));
          return;
        }

        if (pathname.startsWith('/api/v1/research/wallets/') || pathname.startsWith('/api/v1/wallets/')) {
          const address = pathname.replace('/api/v1/research/wallets/', '').replace('/api/v1/wallets/', '');
          const wallet = walletRepo.getWalletByAddress(address);
          const evaluation = walletRepo.getLatestEvaluationForWallet(address);
          if (!wallet && !evaluation) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: `Wallet ${address} not found` }));
            return;
          }
          const trades = tradeRepo.listTradesForWallet(address, 50);
          res.writeHead(200);
          res.end(JSON.stringify({
            wallet: wallet || { address },
            evaluation,
            recentTrades: trades,
            totalTrades: trades.length
          }));
          return;
        }

        // --- Task 1.5: Historical Trade Research & Copyability Endpoints ---
        if (pathname === '/api/v1/research/copyability/summary') {
          const window = url.searchParams.get('window') || undefined;
          const summary = histCopyRepo.getSummary(window);
          res.writeHead(200);
          res.end(JSON.stringify({ summary, window: window || '30d' }));
          return;
        }

        if (pathname === '/api/v1/research/copyability/evaluations') {
          const window = url.searchParams.get('window') || undefined;
          const classification = url.searchParams.get('classification') || undefined;
          const cohort = url.searchParams.get('cohort') || undefined;
          const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 100;
          const evaluations = histCopyRepo.listAll({ window, classification, cohort, limit });
          res.writeHead(200);
          res.end(JSON.stringify({ evaluations, total: evaluations.length }));
          return;
        }

        if (pathname.startsWith('/api/v1/research/copyability/evaluations/')) {
          const id = pathname.replace('/api/v1/research/copyability/evaluations/', '');
          const evaluation = histCopyRepo.findById(id);
          if (!evaluation) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: `Evaluation ${id} not found` }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ evaluation }));
          return;
        }

        if (pathname === '/api/v1/research/copyability/wallets') {
          const window = url.searchParams.get('window') || undefined;
          const evals = histCopyRepo.listAll({ window, limit: 1000 });
          const wallets = HistoricalTradeResearchPipeline.aggregateByWallet(evals);
          res.writeHead(200);
          res.end(JSON.stringify({ wallets, total: wallets.length }));
          return;
        }

        if (pathname === '/api/v1/research/copyability/categories') {
          const window = url.searchParams.get('window') || undefined;
          const evals = histCopyRepo.listAll({ window, limit: 1000 });
          const trades = tradeRepo.listRecentTrades(1000);
          const tradeMap = new Map<string, typeof trades[0]>();
          for (const t of trades) tradeMap.set(t.id, t);
          const categories = HistoricalTradeResearchPipeline.aggregateByCategory(evals, tradeMap);
          res.writeHead(200);
          res.end(JSON.stringify({ categories, total: categories.length }));
          return;
        }

        if (pathname === '/api/v1/research/copyability/latency') {
          const window = url.searchParams.get('window') || undefined;
          const evals = histCopyRepo.listAll({ window, limit: 1000 });
          const buckets = HistoricalTradeResearchPipeline.analyzeLatencyBuckets(evals);
          res.writeHead(200);
          res.end(JSON.stringify({ buckets }));
          return;
        }

        // --- Task 1.6: Real-Time Live Signals & Monitor Endpoints ---
        if (pathname === '/api/v1/signals/latest') {
          const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
          const signals = monitor.getLiveSignals(limit);
          res.writeHead(200);
          res.end(JSON.stringify({ signals, total: signals.length }));
          return;
        }

        if (pathname.startsWith('/api/v1/signals/') && pathname !== '/api/v1/signals/latest') {
          const id = pathname.replace('/api/v1/signals/', '');
          const signal = monitor.getLiveSignalById(id);
          if (!signal) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: `Live signal ${id} not found` }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ signal }));
          return;
        }

        if (pathname === '/api/v1/signals' || pathname === '/api/v1/mobile/signals') {
          const signals = monitor.getLiveSignals(50);
          res.writeHead(200);
          res.end(JSON.stringify({ signals, total: signals.length }));
          return;
        }

        if (pathname === '/api/v1/monitor/status' || pathname === '/api/v1/mobile/monitor' || pathname === '/api/v1/mobile/observability') {
          const health = monitor.getSystemHealth();

          // Gather real timestamps for 24h/48h long-running observation contract
          const recentScans = leaderboardRepo.listRecentScans(1);
          const latestScanTime = recentScans.length > 0 ? recentScans[0].scannedAt : null;
          const topWallets = walletRepo.listTopWallets(1);
          const latestWalletScanTime = topWallets.length > 0 ? topWallets[0].updatedAt : null;
          const recentDetections = detectedTradeRepo.listRecentDetections(1);
          const latestTradeObsTime = recentDetections.length > 0 ? recentDetections[0].detectedAt : null;
          const allTrades = paperTradeRepo.listAllPaperTrades(100);
          const latestPnlSnapshot = pnlRepo.getLatestSnapshots(1);
          const latestPnlTime = latestPnlSnapshot.length > 0 ? latestPnlSnapshot[0].capturedAt : (allTrades.length > 0 ? allTrades[0].updatedAt : null);
          const recentReviews = reviewRepo.listAllReviews(1);
          const latestReviewTime = recentReviews.length > 0 ? recentReviews[0].reviewedAt : null;

          const openTrades = allTrades.filter(t => t.status === 'open');
          const closedTrades = allTrades.filter(t => t.status === 'closed' || t.status === 'resolved');
          const unrealized = openTrades.reduce((acc, t) => acc + t.unrealizedPnl, 0);
          const realized = closedTrades.reduce((acc, t) => acc + t.realizedPnl, 0);
          const totalPnl = unrealized + realized;

          // Process status calculation based on real backend runtime state and timestamps
          const runtimeState = runtimeManager.getState();
          let monitorProcessStatus: 'RUNNING' | 'IDLE' | 'STALE' | 'UNKNOWN' | 'ERROR' = 'IDLE';
          if (runtimeState === 'RUNNING' || health.walletMonitorStatus === 'RUNNING') {
            if (health.lastPollAt) {
              const pollAgeSeconds = (Date.now() - new Date(health.lastPollAt).getTime()) / 1000;
              if (pollAgeSeconds < 120) {
                monitorProcessStatus = 'RUNNING';
              } else {
                monitorProcessStatus = 'STALE';
              }
            } else {
              monitorProcessStatus = 'RUNNING';
            }
          } else if (runtimeState === 'ERROR' || health.walletMonitorStatus === 'ERROR') {
            monitorProcessStatus = 'ERROR';
          } else if (runtimeState === 'STARTING') {
            monitorProcessStatus = 'RUNNING';
          } else {
            monitorProcessStatus = 'IDLE';
          }

          const activeRuleset = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;

          const observability = {
            monitorProcessStatus,
            engineLifecycleState: runtimeState,
            lastSuccessfulMonitoringCycle: health.lastPollAt,
            lastSuccessfulLeaderboardScan: latestScanTime,
            lastSuccessfulWalletScan: latestWalletScanTime,
            lastSuccessfulTradeObservation: latestTradeObsTime,
            lastSuccessfulPnlUpdate: latestPnlTime,
            lastSuccessfulOutcomeReview: latestReviewTime,
            lastError: health.lastErrorMessage || null,
            lastErrorTimestamp: health.lastErrorMessage ? new Date().toISOString() : null,
            currentDataFreshness: health.marketDataFreshness,
            trackedWalletCount: health.activeTrackedWallets,
            currentPaperTradeCount: allTrades.length,
            currentPaperPnl: {
              unrealized: Math.round(unrealized * 100) / 100,
              realized: Math.round(realized * 100) / 100,
              total: Math.round(totalPnl * 100) / 100,
            },
            ingestionProviderHealth: health.ingestionStatus === 'HEALTHY' ? 'OPERATIONAL' : (health.ingestionStatus === 'DEGRADED' ? 'DEGRADED' : 'IDLE'),
            currentRuleSetId: activeRuleset.id,
            executionMode: 'PAPER ONLY',
          };

          res.writeHead(200);
          res.end(JSON.stringify({
            ...health,
            walletMonitorStatus: runtimeState === 'RUNNING' ? 'RUNNING' : (runtimeState === 'STOPPED' ? 'IDLE' : runtimeState),
            paperEngineStatus: runtimeState === 'RUNNING' ? 'RUNNING' : (runtimeState === 'STOPPED' ? 'STOPPED' : runtimeState),
            engineLifecycleState: runtimeState,
            observability,
          }));
          return;
        }

        if (pathname === '/api/v1/performance' || pathname === '/api/v1/mobile/performance') {
          const allPaperTrades = paperTradeRepo.listAllPaperTrades(1000);
          const allDecisions = decisionRepo.listRecentDecisions(1000);
          const allReviews = reviewRepo.listAllReviews(1000);
          const histSummary = histCopyRepo.getSummary('30d');

          const openTrades = allPaperTrades.filter(t => t.status === 'open');
          const closedTrades = allPaperTrades.filter(t => t.status === 'closed' || t.status === 'resolved');

          const totalTrades = allPaperTrades.length;
          const openTradesCount = openTrades.length;
          const closedTradesCount = closedTrades.length;

          const unrealizedPnl = Math.round(openTrades.reduce((acc, t) => acc + t.unrealizedPnl, 0) * 100) / 100;
          const realizedPnl = Math.round(closedTrades.reduce((acc, t) => acc + t.realizedPnl, 0) * 100) / 100;
          const totalPnl = Math.round((unrealizedPnl + realizedPnl) * 100) / 100;

          const wins = closedTrades.filter(t => t.realizedPnl > 0).length;
          const losses = closedTrades.filter(t => t.realizedPnl < 0).length;
          const winRate = closedTradesCount > 0 ? Math.round((wins / closedTradesCount) * 1000) / 1000 : null;

          // Decision counts
          const paperCopyDecisions = allDecisions.filter(d => d.decision === 'paper_copy').length;
          const watchlistDecisions = allDecisions.filter(d => d.decision === 'watchlist').length;
          const skipDecisions = allDecisions.filter(d => d.decision === 'skip').length;

          // Map evaluated items for BenchmarkEngine
          const paperTradeMap = new Map<string, typeof allPaperTrades[0]>();
          for (const pt of allPaperTrades) {
            paperTradeMap.set(pt.decisionJournalId, pt);
          }
          const reviewMap = new Map<string, typeof allReviews[0]>();
          for (const r of allReviews) {
            reviewMap.set(r.decisionJournalId, r);
          }

          const evaluatedItems: EvaluatedDecisionItem[] = [];
          for (const d of allDecisions) {
            const pt = paperTradeMap.get(d.id);
            const rev = reviewMap.get(d.id);
            if (pt) {
              const pnl = pt.status === 'resolved' ? pt.realizedPnl : pt.unrealizedPnl;
              evaluatedItems.push({
                journal: d,
                hypotheticalPnl: pnl,
                marketOutcomeWon: pnl > 0,
                spreadAtEntry: d.spreadScore > 0 ? (100 - d.spreadScore) / 1000 : 0.02,
                entryDrift: d.entryTimingScore > 0 ? (100 - d.entryTimingScore) / 2000 : 0.01
              });
            } else if (rev) {
              evaluatedItems.push({
                journal: d,
                hypotheticalPnl: rev.simulatedPnlAtMilestone,
                marketOutcomeWon: rev.wasDecisionGood,
                spreadAtEntry: 0.02,
                entryDrift: 0.01
              });
            }
          }

          const cohortComparison = BenchmarkEngine.compareCohorts(evaluatedItems);

          // Data Mode Detection
          const recentScans = leaderboardRepo.listRecentScans(1);
          const isDemo = recentScans.length > 0 ? Boolean(recentScans[0].provenance.isDemo) : true;
          const dataMode = isDemo ? 'SYNTHETIC FIXTURE DATA' : 'LIVE READ-ONLY DATA';

          res.writeHead(200);
          res.end(JSON.stringify({
            dataMode,
            executionMode: 'PAPER',
            safetyNotice: 'PAPER TRADING ONLY - No live execution or private keys supported',
            metrics: {
              totalPaperTrades: totalTrades,
              openPaperTrades: openTradesCount,
              closedPaperTrades: closedTradesCount,
              realizedPnl,
              unrealizedPnl,
              totalPnl,
              wins,
              losses,
              winRate: winRate !== null ? winRate : null,
              winRateStatus: closedTradesCount === 0 ? 'INSUFFICIENT DATA' : 'AVAILABLE',
              winRateReason: closedTradesCount === 0 ? 'Awaiting market settlement for open paper positions' : null
            },
            decisionsSummary: {
              totalDecisions: allDecisions.length,
              paperCopyCount: paperCopyDecisions,
              watchlistCount: watchlistDecisions,
              skippedCount: skipDecisions
            },
            benchmarkCohorts: cohortComparison,
            cohortDataStatus: evaluatedItems.length === 0 ? 'INSUFFICIENT DATA' : 'AVAILABLE',
            cohortDataReason: evaluatedItems.length === 0 ? 'No reviewed decisions or resolved paper trades available yet' : null,
            historicalResearchBenchmark: {
              dataMode: 'HISTORICAL RESEARCH DATA - HYPOTHETICAL',
              totalTradesAnalyzed: histSummary.totalTradesAnalyzed,
              copyableCount: histSummary.copyableCount,
              modeledCopyPnL: histSummary.totalModeledCopyPnL,
              walletRealizedPnL: histSummary.totalWalletPnL,
              pnlDelta: histSummary.totalCopyPnLDelta,
              missedWinners: histSummary.missedWinnerCount,
              avoidedLosers: histSummary.avoidedLoserCount,
              avgLatencySeconds: histSummary.avgLatencySeconds
            },
            recentPaperTrades: allPaperTrades.slice(0, 20)
          }));
          return;
        }

        if (pathname === '/api/v1/paper-trades' || pathname === '/api/v1/mobile/pnl') {
          const trades = paperTradeRepo.listAllPaperTrades(100);
          const totalPnl = trades.reduce((acc, t) => acc + t.unrealizedPnl + t.realizedPnl, 0);
          res.writeHead(200);
          res.end(JSON.stringify({
            paperTrades: trades,
            totalTrades: trades.length,
            totalPnl: Math.round(totalPnl * 100) / 100,
            executionMode: 'PAPER'
          }));
          return;
        }

        if (pathname.startsWith('/api/v1/paper-trades/')) {
          const id = pathname.replace('/api/v1/paper-trades/', '');
          const trade = paperTradeRepo.getPaperTradeById(id);
          if (!trade) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: `Paper trade ${id} not found` }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ paperTrade: trade }));
          return;
        }

        if (pathname === '/api/v1/decisions' || pathname === '/api/v1/decisions/latest') {
          const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
          const decisions = decisionRepo.listRecentDecisions(limit);
          res.writeHead(200);
          res.end(JSON.stringify({ decisions, total: decisions.length }));
          return;
        }

        // --- Task 2.1: Empirical Calibration & Rule Learning Endpoints ---
        if (pathname === '/api/v1/calibration/status' || pathname === '/api/v1/mobile/calibration') {
          const activeRuleSet = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;
          const latestEvent = learningRepo.getLatestLearningEvent();
          const totalEvents = learningRepo.countLearningEvents();
          const candidateRuleSets = rulesetRepo.getCandidateRuleSets();
          const rejectedRuleSets = rulesetRepo.getRejectedRuleSets();

          res.writeHead(200);
          res.end(JSON.stringify({
            executionMode: 'PAPER ONLY',
            status: latestEvent ? latestEvent.status : 'INSUFFICIENT_DATA',
            evidenceTier: latestEvent ? latestEvent.evidenceTier : 'INSUFFICIENT',
            activeRuleSetVersion: activeRuleSet.version,
            activeRuleSetId: activeRuleSet.id,
            totalCalibrationCycles: totalEvents,
            latestLearningEvent: latestEvent,
            candidateRuleSetsCount: candidateRuleSets.length,
            rejectedRuleSetsCount: rejectedRuleSets.length,
            parameterProvenanceNotice: '[IMPLEMENTATION BASELINE - CALIBRATION CONFIG] Only bet size ($5-$20) is PDF-mandated',
            timestamp: new Date().toISOString()
          }));
          return;
        }

        if (pathname === '/api/v1/calibration/history') {
          const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
          const events = learningRepo.listLearningEvents(limit);
          res.writeHead(200);
          res.end(JSON.stringify({
            events,
            total: events.length,
            executionMode: 'PAPER ONLY'
          }));
          return;
        }

        if (pathname === '/api/v1/calibration/evaluate') {
          // Deterministic dry-run evaluation (no persistent mutation)
          const dryRunResult = calibrationPipeline.runCalibrationCycle({ dryRun: true });
          res.writeHead(200);
          res.end(JSON.stringify({
            executionMode: 'PAPER ONLY',
            dryRun: true,
            result: dryRunResult,
            timestamp: new Date().toISOString()
          }));
          return;
        }

        if (pathname === '/api/v1/rules/candidates') {
          const candidates = rulesetRepo.getCandidateRuleSets();
          const rejected = rulesetRepo.getRejectedRuleSets();
          res.writeHead(200);
          res.end(JSON.stringify({
            candidates,
            rejected,
            totalCandidates: candidates.length,
            totalRejected: rejected.length,
            executionMode: 'PAPER ONLY'
          }));
          return;
        }

        if (pathname === '/api/v1/rules/history' || pathname === '/api/v1/rules/lineage') {
          const allRulesets = rulesetRepo.listAllRuleSets();
          const changes = rulesetRepo.listRuleChanges();
          const activeRuleSet = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;
          res.writeHead(200);
          res.end(JSON.stringify({
            activeRuleSet,
            allRulesets,
            auditChanges: changes,
            totalVersions: allRulesets.length,
            executionMode: 'PAPER ONLY'
          }));
          return;
        }

        if (pathname === '/api/v1/rules') {
          const allRulesets = rulesetRepo.listAllRuleSets();
          const changes = rulesetRepo.listRuleChanges();
          const candidates = rulesetRepo.getCandidateRuleSets();
          const rejected = rulesetRepo.getRejectedRuleSets();
          const latestLearning = learningRepo.getLatestLearningEvent();
          res.writeHead(200);
          res.end(JSON.stringify({
            activeRuleSet: rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET,
            allRulesets,
            auditChanges: changes,
            candidateRuleSets: candidates,
            rejectedRuleSets: rejected,
            latestLearningEvent: latestLearning
          }));
          return;
        }

        if (pathname === '/api/v1/reports') {
          const reports = reportRepo.listRecentReports(30);
          res.writeHead(200);
          res.end(JSON.stringify({ reports, total: reports.length }));
          return;
        }

        if (pathname === '/api/v1/mobile/alerts') {
          const decisions = decisionRepo.listDecisionsByVerdict('paper_copy', 10);
          const alerts = decisions.map(d => ({
            id: `alert-${d.id}`,
            type: 'PAPER_COPY_SIGNAL',
            title: `Paper Copy Triggered: $${d.simulatedPositionSize.toFixed(2)}`,
            message: `Score ${d.copyScore.toFixed(1)} on market ${d.marketId} (Wallet: ${d.walletAddress.slice(0, 8)}...)`,
            timestamp: d.evaluatedAt,
            executionMode: 'PAPER'
          }));
          res.writeHead(200);
          res.end(JSON.stringify({ alerts, total: alerts.length }));
          return;
        }

        if (pathname === '/api/v1/ingestion/status' || pathname === '/api/v1/mobile/ingestion') {
          const recentScans = leaderboardRepo.listRecentScans(1);
          const latestScan = recentScans.length > 0 ? recentScans[0] : null;
          const latestOp = ingestionRepo.getLatestOperation();
          const recentOps = ingestionRepo.listRecentOperations(10);
          const recentSnapshots = marketRepo.listRecentSnapshots(1);
          const latestSnapshot = recentSnapshots.length > 0 ? recentSnapshots[0] : null;

          const topWallets = walletRepo.listTopWallets(100);
          const observedTrades = tradeRepo.listRecentTrades(100);

          let dataMode: 'LIVE READ-ONLY DATA' | 'DEMO DATA' | 'NO DATA' = 'NO DATA';
          let lastIngestionTime: string | null = null;

          if (latestScan) {
            dataMode = latestScan.provenance.isDemo ? 'DEMO DATA' : 'LIVE READ-ONLY DATA';
            lastIngestionTime = latestScan.scannedAt;
          } else if (latestOp) {
            dataMode = latestOp.isLive ? 'LIVE READ-ONLY DATA' : 'DEMO DATA';
            lastIngestionTime = latestOp.startedAt;
          }

          const ageSeconds = lastIngestionTime
            ? Math.max(0, Math.floor((Date.now() - new Date(lastIngestionTime).getTime()) / 1000))
            : null;

          const hasErrors = recentOps.some(o => o.status === 'failed' || o.errorsCount > 0);

          res.writeHead(200);
          res.end(JSON.stringify({
            dataMode,
            executionMode: 'PAPER',
            dataFreshness: {
              lastIngestionTime,
              ageSeconds,
              freshnessLabel: ageSeconds === null ? 'NO DATA' : (ageSeconds < 3600 ? 'FRESH (<1h)' : `${Math.floor(ageSeconds / 3600)}h ago`)
            },
            providerHealth: {
              status: hasErrors ? 'DEGRADED' : (latestScan ? 'OPERATIONAL' : 'IDLE'),
              lastVerifiedService: 'polymarket_data_api',
              unsupportedCapabilitiesNotice: 'Live order placement, signing, and private key operations are permanently disabled.'
            },
            latestLeaderboardScan: latestScan ? {
              scanId: latestScan.id,
              scannedAt: latestScan.scannedAt,
              walletCount: latestScan.walletCount,
              lookbackDays: latestScan.lookbackDays,
              isDemo: Boolean(latestScan.provenance.isDemo)
            } : null,
            latestMarketSnapshot: latestSnapshot ? {
              id: latestSnapshot.id,
              marketId: latestSnapshot.marketId,
              question: latestSnapshot.question,
              spread: latestSnapshot.spread,
              liquidity: latestSnapshot.liquidity,
              collectedAt: latestSnapshot.collectedAt
            } : null,
            databaseCoverage: {
              walletsDiscovered: topWallets.length,
              observedTradesCount: observedTrades.length
            },
            recentOperations: recentOps
          }));
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
        return;
      } catch (err: unknown) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal Server Error' }));
        return;
      }
    }

    // --- STATIC FILES (SPA Dashboard) ---
    const serveLegacy = process.env.SERVE_LEGACY_DASHBOARD === 'true';
    const clientDistDir = path.resolve(process.cwd(), 'dist/client');
    const legacyPublicDir = fs.existsSync(path.join(__dirname, 'public'))
      ? path.join(__dirname, 'public')
      : path.resolve(process.cwd(), 'src/web/public');

    // Use modern build if available and not explicitly disabled
    // Dedicated /legacy fallback route for direct parity/emergency inspection
    if (pathname === '/legacy' || pathname === '/legacy/' || pathname === '/legacy/index.html') {
      const legacyHtml = path.join(legacyPublicDir, 'index.html');
      if (fs.existsSync(legacyHtml)) {
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(fs.readFileSync(legacyHtml));
        return;
      }
    }

    // Use modern build if available and not explicitly disabled
    const useModern = !serveLegacy && fs.existsSync(path.join(clientDistDir, 'index.html'));
    const publicDir = useModern ? clientDistDir : legacyPublicDir;

    let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

    // Support client-side SPA routing fallback to index.html
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(publicDir, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
        '.ttf': 'font/ttf'
      };
      res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
      res.writeHead(200);
      res.end(fs.readFileSync(filePath));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  return server;
}

// If run directly via CLI
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  const PORT = Number(process.env.PORT) || 3000;
  const server = createWebServer(PORT);
  server.listen(PORT, () => {
    console.log(`[WEB SERVER] Running at http://localhost:${PORT}`);
    console.log(`[SAFETY NOTICE] Execution Mode: PAPER ONLY. No live orders or signing keys enabled.`);
  });
}
