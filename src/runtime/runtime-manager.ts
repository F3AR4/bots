/**
 * Singleton Paper-Trading Runtime Manager & Daemon Orchestrator (Task 2.0).
 * 
 * Safety Guarantee:
 * - Single source of truth for background paper trading.
 * - Idempotent Start / Stop controls.
 * - ZERO live execution, zero wallet credentials, strictly PAPER ONLY.
 * - Persistent across client disconnects for 24h / 48h unattended operation.
 */

import { DatabaseSync } from 'node:sqlite';
import { getDatabaseManager } from '../db/connection.js';
import { ExecutionBoundary } from '../safety/execution-boundary.js';
import {
  EngineLifecycleState,
  RuntimeJobName,
  RuntimeTelemetry,
  RuntimeConfigOptions,
  RuntimeDaemonState
} from '../types/domain.js';
import { RuntimeConfig, createRuntimeConfig, DEFAULT_RUNTIME_CONFIG } from './runtime-config.js';
import { RuntimeLogger } from './runtime-logger.js';
import { RuntimeScheduler } from './scheduler.js';
import { RuntimeRepository } from '../db/repositories/runtime.repo.js';

// Import job definitions
import { LeaderboardJob } from './jobs/leaderboard.job.js';
import { WalletScanJob } from './jobs/wallet-scan.job.js';
import { TradeMonitorJob } from './jobs/trade-monitor.job.js';
import { MarketSnapshotJob } from './jobs/market-snapshot.job.js';
import { PnlJob } from './jobs/pnl.job.js';
import { OutcomeReviewJob } from './jobs/outcome-review.job.js';
import { DailyReportJob } from './jobs/daily-report.job.js';
import { CalibrationJob } from './jobs/calibration.job.js';
import { HealthTelemetryJob } from './jobs/health-telemetry.job.js';

export class RuntimeManager {
  private static instance: RuntimeManager | null = null;

  private lifecycleState: EngineLifecycleState = 'STOPPED';
  private config: RuntimeConfig;
  private scheduler: RuntimeScheduler;
  private runtimeRepo: RuntimeRepository;
  private startedAt: string | null = null;
  private stoppedAt: string | null = null;
  private cycleCount = 0;
  private lastError: { message: string; timestamp: string; job?: string } | null = null;
  private signalHandlersAttached = false;

  // Job instances
  private leaderboardJob: LeaderboardJob;
  private walletScanJob: WalletScanJob;
  private tradeMonitorJob: TradeMonitorJob;
  private marketSnapshotJob: MarketSnapshotJob;
  private pnlJob: PnlJob;
  private outcomeReviewJob: OutcomeReviewJob;
  private dailyReportJob: DailyReportJob;
  private calibrationJob: CalibrationJob;
  private healthTelemetryJob: HealthTelemetryJob;

  private constructor(
    private db: DatabaseSync,
    options?: Partial<RuntimeConfigOptions>,
    private runnerMode: 'live' | 'fixture' = 'fixture'
  ) {
    ExecutionBoundary.assertPaperMode();
    this.config = createRuntimeConfig(options);
    this.runtimeRepo = new RuntimeRepository(db);

    this.scheduler = new RuntimeScheduler(() => this.lifecycleState);

    // Initialize Jobs
    this.leaderboardJob = new LeaderboardJob(db, this.runnerMode);
    this.walletScanJob = new WalletScanJob(db, this.runnerMode);
    this.tradeMonitorJob = new TradeMonitorJob(db, this.runnerMode);
    this.marketSnapshotJob = new MarketSnapshotJob(db, this.runnerMode);
    this.pnlJob = new PnlJob(db);
    this.outcomeReviewJob = new OutcomeReviewJob(db);
    this.dailyReportJob = new DailyReportJob(db);
    this.calibrationJob = new CalibrationJob(db);
    this.healthTelemetryJob = new HealthTelemetryJob(
      db,
      () => this.lifecycleState,
      () => this.cycleCount,
      () => this.scheduler.getActiveJobsCount(),
      () => this.startedAt,
      () => this.stoppedAt,
      () => this.lastError
    );

    this.registerSchedulerJobs();
    this.resumePersistedState();
  }

  public static getInstance(
    db?: DatabaseSync,
    options?: Partial<RuntimeConfigOptions>,
    mode: 'live' | 'fixture' = 'fixture'
  ): RuntimeManager {
    if (!RuntimeManager.instance) {
      const activeDb = db || getDatabaseManager().getDatabase();
      RuntimeManager.instance = new RuntimeManager(activeDb, options, mode);
    }
    return RuntimeManager.instance;
  }

  public static resetInstance(): void {
    if (RuntimeManager.instance) {
      try {
        RuntimeManager.instance.stop().catch(() => {});
      } catch {
        // Ignore
      }
      RuntimeManager.instance = null;
    }
  }

  private registerSchedulerJobs(): void {
    // 1. Leaderboard Ingestion
    this.scheduler.registerJob({
      name: 'leaderboard',
      intervalMs: this.config.leaderboardIntervalMs,
      runImmediately: false,
      execute: async () => {
        await this.leaderboardJob.run();
        this.persistHeartbeat('leaderboard');
      }
    });

    // 2. Wallet Intelligence / Research
    this.scheduler.registerJob({
      name: 'wallet_scan',
      intervalMs: this.config.walletScanIntervalMs,
      runImmediately: false,
      execute: async () => {
        await this.walletScanJob.run();
        this.persistHeartbeat('wallet_scan');
      }
    });

    // 3. Trade Monitor
    this.scheduler.registerJob({
      name: 'trade_monitor',
      intervalMs: this.config.tradeMonitorIntervalMs,
      runImmediately: true,
      execute: async () => {
        await this.tradeMonitorJob.run();
        this.cycleCount++;
        this.persistHeartbeat('trade_monitor');
      }
    });

    // 4. Market Snapshots
    this.scheduler.registerJob({
      name: 'market_snapshot',
      intervalMs: this.config.marketSnapshotIntervalMs,
      runImmediately: false,
      execute: async () => {
        await this.marketSnapshotJob.run();
        this.persistHeartbeat('market_snapshot');
      }
    });

    // 5. Mark-to-Market PnL
    this.scheduler.registerJob({
      name: 'pnl_update',
      intervalMs: this.config.pnlIntervalMs,
      runImmediately: false,
      execute: async () => {
        await this.pnlJob.run();
        this.persistHeartbeat('pnl_update');
      }
    });

    // 6. Retrospective Outcome Reviews
    this.scheduler.registerJob({
      name: 'outcome_review',
      intervalMs: this.config.outcomeReviewIntervalMs,
      runImmediately: false,
      execute: async () => {
        await this.outcomeReviewJob.run();
        this.persistHeartbeat('outcome_review');
      }
    });

    // 7. Daily Report
    this.scheduler.registerJob({
      name: 'daily_report',
      intervalMs: this.config.dailyReportIntervalMs,
      runImmediately: false,
      execute: async () => {
        await this.dailyReportJob.run();
        this.persistHeartbeat('daily_report');
      }
    });

    // 8. Empirical Calibration & Rule Learning
    this.scheduler.registerJob({
      name: 'calibration',
      intervalMs: this.config.calibrationIntervalMs,
      runImmediately: false,
      execute: async () => {
        await this.calibrationJob.run();
        this.persistHeartbeat('calibration');
      }
    });

    // 9. Health Telemetry Snapshot
    this.scheduler.registerJob({
      name: 'health_telemetry',
      intervalMs: this.config.healthTelemetryIntervalMs,
      runImmediately: true,
      execute: async () => {
        await this.healthTelemetryJob.run();
      }
    });
  }

  private resumePersistedState(): void {
    try {
      const persisted = this.runtimeRepo.getState();
      if (persisted) {
        this.cycleCount = persisted.cycleCount;
        this.startedAt = persisted.startedAt;
        this.stoppedAt = persisted.stoppedAt;
        if (persisted.lastError) {
          this.lastError = {
            message: persisted.lastError,
            timestamp: persisted.lastErrorAt || persisted.updatedAt,
            job: persisted.lastErrorJob || undefined
          };
        }
        // If process crashed while RUNNING, set to STOPPED on restart until explicitly started
        this.lifecycleState = 'STOPPED';
        this.persistState();
      }
    } catch (err) {
      RuntimeLogger.warn('UNKNOWN', 'init', `Could not load persisted state: ${(err as Error).message}`);
    }
  }

  /**
   * Starts the autonomous paper-trading runtime.
   * Guaranteed Idempotent.
   */
  public async start(): Promise<{ success: boolean; state: EngineLifecycleState; message: string }> {
    ExecutionBoundary.assertPaperMode();

    if (this.lifecycleState === 'RUNNING') {
      return { success: true, state: 'RUNNING', message: 'Runtime is already active and running.' };
    }

    if (this.lifecycleState === 'STARTING') {
      return { success: true, state: 'STARTING', message: 'Runtime is currently starting.' };
    }

    if (this.lifecycleState === 'STOPPING') {
      return { success: false, state: 'STOPPING', message: 'Cannot start runtime while shutdown is in progress.' };
    }

    RuntimeLogger.info(this.lifecycleState, 'control', 'Initiating Paper-Trading Runtime startup...');
    this.lifecycleState = 'STARTING';
    this.startedAt = new Date().toISOString();
    this.stoppedAt = null;
    this.persistState();

    try {
      // 1. Initial Telemetry & Initial Poll
      await this.tradeMonitorJob.run();
      await this.healthTelemetryJob.run();

      // 2. Start Scheduler Loops
      this.scheduler.startAll();
      this.attachSignalHandlers();

      this.lifecycleState = 'RUNNING';
      this.persistState();

      RuntimeLogger.info('RUNNING', 'control', 'Paper-Trading Runtime daemon successfully started and RUNNING.');
      return { success: true, state: 'RUNNING', message: 'Runtime daemon started successfully.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lifecycleState = 'ERROR';
      this.lastError = { message: msg, timestamp: new Date().toISOString(), job: 'startup' };
      this.persistState();
      RuntimeLogger.error('ERROR', 'control', `Failed to start runtime daemon: ${msg}`, err);
      return { success: false, state: 'ERROR', message: `Startup failed: ${msg}` };
    }
  }

  /**
   * Stops the autonomous paper-trading runtime cleanly.
   * Guaranteed Idempotent.
   */
  public async stop(): Promise<{ success: boolean; state: EngineLifecycleState; message: string }> {
    if (this.lifecycleState === 'STOPPED') {
      return { success: true, state: 'STOPPED', message: 'Runtime is already stopped.' };
    }

    if (this.lifecycleState === 'STOPPING') {
      return { success: true, state: 'STOPPING', message: 'Runtime is currently stopping.' };
    }

    RuntimeLogger.info(this.lifecycleState, 'control', 'Initiating Paper-Trading Runtime graceful shutdown...');
    this.lifecycleState = 'STOPPING';
    this.stoppedAt = new Date().toISOString();
    this.persistState();

    try {
      // Await running jobs and stop scheduler
      await this.scheduler.stopAll(this.config.shutdownTimeoutMs);

      // Record final telemetry
      await this.healthTelemetryJob.run();

      this.lifecycleState = 'STOPPED';
      this.persistState();

      RuntimeLogger.info('STOPPED', 'control', 'Paper-Trading Runtime daemon successfully stopped.');
      return { success: true, state: 'STOPPED', message: 'Runtime daemon stopped successfully.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lifecycleState = 'ERROR';
      this.lastError = { message: msg, timestamp: new Date().toISOString(), job: 'shutdown' };
      this.persistState();
      RuntimeLogger.error('ERROR', 'control', `Error during runtime shutdown: ${msg}`, err);
      return { success: false, state: 'ERROR', message: `Shutdown encountered error: ${msg}` };
    }
  }

  /**
   * Executes a single end-to-end cycle manually (e.g. for testing or CLI).
   */
  public async executeCycle(): Promise<void> {
    ExecutionBoundary.assertPaperMode();
    await this.leaderboardJob.run();
    await this.walletScanJob.run();
    await this.tradeMonitorJob.run();
    await this.pnlJob.run();
    await this.outcomeReviewJob.run();
    await this.dailyReportJob.run();
    await this.healthTelemetryJob.run();
    this.cycleCount++;
    this.persistState();
  }

  /**
   * Triggers a specific registered job manually.
   */
  public async triggerJob(name: RuntimeJobName): Promise<boolean> {
    return this.scheduler.executeJob(name);
  }

  /**
   * Gathers rich runtime telemetry.
   */
  public async getTelemetry(): Promise<RuntimeTelemetry> {
    return this.healthTelemetryJob.run();
  }

  public getState(): EngineLifecycleState {
    return this.lifecycleState;
  }

  public getScheduler(): RuntimeScheduler {
    return this.scheduler;
  }

  public getConfig(): RuntimeConfig {
    return { ...this.config };
  }

  public getTradeMonitor(): TradeMonitorJob {
    return this.tradeMonitorJob;
  }

  public getCalibrationJob(): CalibrationJob {
    return this.calibrationJob;
  }

  private persistHeartbeat(jobName?: string): void {
    const now = new Date().toISOString();
    const stateRecord: RuntimeDaemonState = {
      id: 'singleton',
      lifecycleState: this.lifecycleState,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      lastHeartbeatAt: now,
      lastSuccessfulCycleAt: now,
      cycleCount: this.cycleCount,
      activeJobsCount: this.scheduler.getActiveJobsCount(),
      lastError: this.lastError?.message || null,
      lastErrorAt: this.lastError?.timestamp || null,
      lastErrorJob: jobName || this.lastError?.job || null,
      telemetryJson: '{}',
      updatedAt: now
    };
    try {
      this.runtimeRepo.upsertState(stateRecord);
    } catch {
      // Ignore DB transient errors in heartbeat
    }
  }

  private persistState(): void {
    const now = new Date().toISOString();
    const stateRecord: RuntimeDaemonState = {
      id: 'singleton',
      lifecycleState: this.lifecycleState,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      lastHeartbeatAt: now,
      lastSuccessfulCycleAt: this.startedAt,
      cycleCount: this.cycleCount,
      activeJobsCount: this.scheduler.getActiveJobsCount(),
      lastError: this.lastError?.message || null,
      lastErrorAt: this.lastError?.timestamp || null,
      lastErrorJob: this.lastError?.job || null,
      telemetryJson: '{}',
      updatedAt: now
    };
    try {
      this.runtimeRepo.upsertState(stateRecord);
    } catch (err) {
      RuntimeLogger.error(this.lifecycleState, 'state', 'Failed to persist runtime state', err);
    }
  }

  public attachSignalHandlers(): void {
    if (this.signalHandlersAttached) return;
    this.signalHandlersAttached = true;

    const onSignal = async (signal: string) => {
      RuntimeLogger.info(this.lifecycleState, 'control', `Received ${signal}. Initiating graceful shutdown...`);
      await this.stop();
    };

    process.on('SIGINT', () => {
      onSignal('SIGINT').finally(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
      onSignal('SIGTERM').finally(() => process.exit(0));
    });
  }
}
