/**
 * Health & Telemetry Persistence Job (Task 2.0).
 * 
 * Safety Guarantee:
 * - Collects truthful runtime operational metrics.
 * - Stores historical snapshots in SQLite for long-term audit and observability.
 */

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { RuntimeRepository } from '../../db/repositories/runtime.repo.js';
import { WalletRepository } from '../../db/repositories/wallet.repo.js';
import { PaperTradeRepository } from '../../db/repositories/paper-trade.repo.js';
import { LeaderboardRepository } from '../../db/repositories/leaderboard.repo.js';
import { TradeRepository } from '../../db/repositories/trade.repo.js';
import { DetectedTradeRepository } from '../../db/repositories/detected-trade.repo.js';
import { MarketRepository } from '../../db/repositories/market.repo.js';
import { PnlRepository } from '../../db/repositories/pnl.repo.js';
import { ReviewRepository } from '../../db/repositories/review.repo.js';
import { ReportRepository } from '../../db/repositories/report.repo.js';
import { RuleSetRepository } from '../../db/repositories/ruleset.repo.js';
import { IngestionRepository } from '../../db/repositories/ingestion.repo.js';
import { DEFAULT_RULESET } from '../../config/ruleset.default.js';
import { RuntimeTelemetry, EngineLifecycleState, MarketFreshness } from '../../types/domain.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';

export class HealthTelemetryJob {
  private runtimeRepo: RuntimeRepository;
  private walletRepo: WalletRepository;
  private paperTradeRepo: PaperTradeRepository;
  private leaderboardRepo: LeaderboardRepository;
  private detectedTradeRepo: DetectedTradeRepository;
  private marketRepo: MarketRepository;
  private pnlRepo: PnlRepository;
  private reviewRepo: ReviewRepository;
  private reportRepo: ReportRepository;
  private rulesetRepo: RuleSetRepository;
  private ingestionRepo: IngestionRepository;

  constructor(
    private db: DatabaseSync,
    private getLifecycleState: () => EngineLifecycleState,
    private getCycleCount: () => number,
    private getActiveJobsCount: () => number,
    private getStartTime: () => string | null,
    private getStopTime: () => string | null,
    private getLastError: () => { message: string; timestamp: string; job?: string } | null
  ) {
    ExecutionBoundary.assertPaperMode();
    this.runtimeRepo = new RuntimeRepository(db);
    this.walletRepo = new WalletRepository(db);
    this.paperTradeRepo = new PaperTradeRepository(db);
    this.leaderboardRepo = new LeaderboardRepository(db);
    this.detectedTradeRepo = new DetectedTradeRepository(db);
    this.marketRepo = new MarketRepository(db);
    this.pnlRepo = new PnlRepository(db);
    this.reviewRepo = new ReviewRepository(db);
    this.reportRepo = new ReportRepository(db);
    this.rulesetRepo = new RuleSetRepository(db);
    this.ingestionRepo = new IngestionRepository(db);
  }

  public async run(): Promise<RuntimeTelemetry> {
    ExecutionBoundary.assertPaperMode();
    const now = new Date().toISOString();
    const activeRuleSet = this.rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;

    // 1. Wallets & Trades
    const trackedWallets = this.walletRepo.listWalletsByStatus('track');
    const allTrades = this.paperTradeRepo.listAllPaperTrades(1000);
    const openTrades = allTrades.filter(t => t.status === 'open');
    const closedTrades = allTrades.filter(t => t.status === 'closed' || t.status === 'resolved');

    const unrealized = openTrades.reduce((acc, t) => acc + t.unrealizedPnl, 0);
    const realized = closedTrades.reduce((acc, t) => acc + t.realizedPnl, 0);
    const totalPnl = unrealized + realized;

    // 2. Timestamps
    const recentScans = this.leaderboardRepo.listRecentScans(1);
    const latestScanTime = recentScans.length > 0 ? recentScans[0].scannedAt : null;

    const topWallets = this.walletRepo.listTopWallets(1);
    const latestWalletScanTime = topWallets.length > 0 ? topWallets[0].updatedAt : null;

    const recentDetections = this.detectedTradeRepo.listRecentDetections(1);
    const latestTradeObsTime = recentDetections.length > 0 ? recentDetections[0].detectedAt : null;

    const latestPnlSnapshot = this.pnlRepo.getLatestSnapshots(1);
    const latestPnlTime = latestPnlSnapshot.length > 0 ? latestPnlSnapshot[0].capturedAt : null;

    const recentReviews = this.reviewRepo.listAllReviews(1);
    const latestReviewTime = recentReviews.length > 0 ? recentReviews[0].reviewedAt : null;

    const recentReports = this.reportRepo.listRecentReports(1);
    const latestReportTime = recentReports.length > 0 ? recentReports[0].createdAt : null;

    // 3. Market Freshness & Ingestion Health
    const recentSnapshots = this.marketRepo.listRecentSnapshots(1);
    const latestSnapshot = recentSnapshots.length > 0 ? recentSnapshots[0] : null;
    let dataFreshness: MarketFreshness = 'UNAVAILABLE';
    if (latestSnapshot) {
      const ageSeconds = Math.max(0, (Date.now() - new Date(latestSnapshot.collectedAt).getTime()) / 1000);
      if (ageSeconds < 300) dataFreshness = 'FRESH';
      else if (ageSeconds < 3600) dataFreshness = 'AGING';
      else dataFreshness = 'STALE';
    }

    const recentOps = this.ingestionRepo.listRecentOperations(10);
    const hasErrors = recentOps.some(o => o.status === 'failed' || o.errorsCount > 0);
    const ingestionHealth: 'OPERATIONAL' | 'DEGRADED' | 'IDLE' = hasErrors
      ? 'DEGRADED'
      : (latestScanTime ? 'OPERATIONAL' : 'IDLE');

    const lastErr = this.getLastError();

    const telemetry: RuntimeTelemetry = {
      id: `tel-${randomUUID()}`,
      lifecycleState: this.getLifecycleState(),
      runtimeStartTimestamp: this.getStartTime(),
      runtimeStopTimestamp: this.getStopTime(),
      lastSuccessfulCycle: now,
      lastSuccessfulLeaderboardScan: latestScanTime,
      lastSuccessfulWalletScan: latestWalletScanTime,
      lastSuccessfulTradeObservation: latestTradeObsTime,
      lastSuccessfulPnlUpdate: latestPnlTime,
      lastSuccessfulOutcomeReview: latestReviewTime,
      lastSuccessfulReport: latestReportTime,
      cycleCount: this.getCycleCount(),
      activeJobCount: this.getActiveJobsCount(),
      lastError: lastErr ? lastErr.message : null,
      lastErrorTimestamp: lastErr ? lastErr.timestamp : null,
      lastErrorJob: lastErr?.job || null,
      currentRuleSetId: activeRuleSet.id,
      trackedWalletCount: trackedWallets.length,
      activePaperTradeCount: openTrades.length,
      totalPaperTradesCount: allTrades.length,
      currentPaperPnl: {
        unrealized: Math.round(unrealized * 100) / 100,
        realized: Math.round(realized * 100) / 100,
        total: Math.round(totalPnl * 100) / 100
      },
      ingestionProviderHealth: ingestionHealth,
      currentDataFreshness: dataFreshness,
      executionMode: 'PAPER ONLY',
      capturedAt: now
    };

    this.runtimeRepo.insertTelemetry(telemetry);
    return telemetry;
  }
}
