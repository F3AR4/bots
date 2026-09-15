/**
 * Runtime Configuration Model & Operational Defaults (Task 2.0).
 * 
 * Safety Guarantee:
 * - Runtime intervals are operational configuration parameters, strictly separated from RuleSet strategy scoring.
 * - Configurable via environment variables or runtime options.
 * - Defaults tuned for 24h / 48h persistent unattended execution.
 */

import { RuntimeConfigOptions } from '../types/domain.js';

export interface RuntimeConfig {
  leaderboardIntervalMs: number;      // e.g. 5 minutes (300,000 ms)
  walletScanIntervalMs: number;       // e.g. 10 minutes (600,000 ms)
  tradeMonitorIntervalMs: number;     // e.g. 30 seconds (30,000 ms)
  marketSnapshotIntervalMs: number;   // e.g. 60 seconds (60,000 ms)
  pnlIntervalMs: number;              // e.g. 1 hour (3,600,000 ms)
  outcomeReviewIntervalMs: number;    // e.g. 30 minutes (1,800,000 ms)
  dailyReportIntervalMs: number;      // e.g. 24 hours (86,400,000 ms)
  calibrationIntervalMs: number;      // e.g. 6 hours (21,600,000 ms) [IMPLEMENTATION BASELINE - CALIBRATION CONFIG]
  healthTelemetryIntervalMs: number;  // e.g. 15 seconds (15,000 ms)
  providerRetryAttempts: number;      // e.g. 3 retries
  providerRetryBackoffMs: number;     // e.g. 2,000 ms initial backoff
  shutdownTimeoutMs: number;          // e.g. 10,000 ms graceful timeout
  staleThresholdSeconds: number;      // e.g. 120 seconds for cycle staleness
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  leaderboardIntervalMs: Number(process.env.RUNTIME_LEADERBOARD_INTERVAL_MS) || 5 * 60 * 1000,
  walletScanIntervalMs: Number(process.env.RUNTIME_WALLET_SCAN_INTERVAL_MS) || 10 * 60 * 1000,
  tradeMonitorIntervalMs: Number(process.env.RUNTIME_TRADE_MONITOR_INTERVAL_MS) || 30 * 1000,
  marketSnapshotIntervalMs: Number(process.env.RUNTIME_MARKET_SNAPSHOT_INTERVAL_MS) || 60 * 1000,
  pnlIntervalMs: Number(process.env.RUNTIME_PNL_INTERVAL_MS) || 60 * 60 * 1000,
  outcomeReviewIntervalMs: Number(process.env.RUNTIME_OUTCOME_REVIEW_INTERVAL_MS) || 30 * 60 * 1000,
  dailyReportIntervalMs: Number(process.env.RUNTIME_DAILY_REPORT_INTERVAL_MS) || 24 * 60 * 60 * 1000,
  calibrationIntervalMs: Number(process.env.RUNTIME_CALIBRATION_INTERVAL_MS) || 6 * 60 * 60 * 1000,
  healthTelemetryIntervalMs: Number(process.env.RUNTIME_HEALTH_TELEMETRY_INTERVAL_MS) || 15 * 1000,
  providerRetryAttempts: Number(process.env.RUNTIME_PROVIDER_RETRY_ATTEMPTS) || 3,
  providerRetryBackoffMs: Number(process.env.RUNTIME_PROVIDER_RETRY_BACKOFF_MS) || 2000,
  shutdownTimeoutMs: Number(process.env.RUNTIME_SHUTDOWN_TIMEOUT_MS) || 10000,
  staleThresholdSeconds: Number(process.env.RUNTIME_STALE_THRESHOLD_SECONDS) || 120
};

export function createRuntimeConfig(overrides?: Partial<RuntimeConfigOptions>): RuntimeConfig {
  return {
    leaderboardIntervalMs: overrides?.leaderboardIntervalMs ?? DEFAULT_RUNTIME_CONFIG.leaderboardIntervalMs,
    walletScanIntervalMs: overrides?.walletScanIntervalMs ?? DEFAULT_RUNTIME_CONFIG.walletScanIntervalMs,
    tradeMonitorIntervalMs: overrides?.tradeMonitorIntervalMs ?? DEFAULT_RUNTIME_CONFIG.tradeMonitorIntervalMs,
    marketSnapshotIntervalMs: overrides?.marketSnapshotIntervalMs ?? DEFAULT_RUNTIME_CONFIG.marketSnapshotIntervalMs,
    pnlIntervalMs: overrides?.pnlIntervalMs ?? DEFAULT_RUNTIME_CONFIG.pnlIntervalMs,
    outcomeReviewIntervalMs: overrides?.outcomeReviewIntervalMs ?? DEFAULT_RUNTIME_CONFIG.outcomeReviewIntervalMs,
    dailyReportIntervalMs: overrides?.dailyReportIntervalMs ?? DEFAULT_RUNTIME_CONFIG.dailyReportIntervalMs,
    calibrationIntervalMs: overrides?.calibrationIntervalMs ?? DEFAULT_RUNTIME_CONFIG.calibrationIntervalMs,
    healthTelemetryIntervalMs: overrides?.healthTelemetryIntervalMs ?? DEFAULT_RUNTIME_CONFIG.healthTelemetryIntervalMs,
    providerRetryAttempts: overrides?.providerRetryAttempts ?? DEFAULT_RUNTIME_CONFIG.providerRetryAttempts,
    providerRetryBackoffMs: overrides?.providerRetryBackoffMs ?? DEFAULT_RUNTIME_CONFIG.providerRetryBackoffMs,
    shutdownTimeoutMs: overrides?.shutdownTimeoutMs ?? DEFAULT_RUNTIME_CONFIG.shutdownTimeoutMs,
    staleThresholdSeconds: overrides?.staleThresholdSeconds ?? DEFAULT_RUNTIME_CONFIG.staleThresholdSeconds
  };
}
