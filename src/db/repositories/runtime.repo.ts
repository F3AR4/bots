/**
 * Repository for Runtime Daemon State and Historical Telemetry records (Task 2.0).
 * 
 * Safety Guarantee:
 * - Strictly PAPER ONLY execution mode persistence.
 * - Stores singleton daemon lifecycle and health metrics in SQLite.
 */

import { DatabaseSync } from 'node:sqlite';
import { RuntimeDaemonState, RuntimeTelemetry, EngineLifecycleState } from '../../types/domain.js';

export class RuntimeRepository {
  constructor(private db: DatabaseSync) {}

  /**
   * Loads the singleton runtime daemon state from SQLite.
   */
  public getState(): RuntimeDaemonState | null {
    const stmt = this.db.prepare('SELECT * FROM runtime_state WHERE id = ?');
    const row = stmt.get('singleton') as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapStateRow(row);
  }

  /**
   * Upserts the singleton runtime daemon state.
   */
  public upsertState(state: RuntimeDaemonState): void {
    const stmt = this.db.prepare(`
      INSERT INTO runtime_state (
        id, lifecycle_state, started_at, stopped_at, last_heartbeat_at,
        last_successful_cycle_at, cycle_count, active_jobs_count,
        last_error, last_error_at, last_error_job, telemetry_json, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        lifecycle_state = excluded.lifecycle_state,
        started_at = excluded.started_at,
        stopped_at = excluded.stopped_at,
        last_heartbeat_at = excluded.last_heartbeat_at,
        last_successful_cycle_at = excluded.last_successful_cycle_at,
        cycle_count = excluded.cycle_count,
        active_jobs_count = excluded.active_jobs_count,
        last_error = excluded.last_error,
        last_error_at = excluded.last_error_at,
        last_error_job = excluded.last_error_job,
        telemetry_json = excluded.telemetry_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      'singleton',
      state.lifecycleState,
      state.startedAt || null,
      state.stoppedAt || null,
      state.lastHeartbeatAt || null,
      state.lastSuccessfulCycleAt || null,
      state.cycleCount,
      state.activeJobsCount,
      state.lastError || null,
      state.lastErrorAt || null,
      state.lastErrorJob || null,
      state.telemetryJson || '{}',
      state.updatedAt
    );
  }

  /**
   * Inserts a historical telemetry snapshot.
   */
  public insertTelemetry(telemetry: RuntimeTelemetry): void {
    const stmt = this.db.prepare(`
      INSERT INTO runtime_telemetry (
        id, lifecycle_state, cycle_count, active_jobs_count,
        tracked_wallets_count, open_paper_trades_count, total_paper_trades_count,
        unrealized_pnl, realized_pnl, total_pnl,
        last_successful_cycle, last_leaderboard_scan, last_wallet_scan,
        last_trade_observation, last_pnl_update, last_outcome_review, last_daily_report,
        ingestion_health, market_freshness, last_error, last_error_job,
        telemetry_json, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);

    stmt.run(
      telemetry.id,
      telemetry.lifecycleState,
      telemetry.cycleCount,
      telemetry.activeJobCount,
      telemetry.trackedWalletCount,
      telemetry.activePaperTradeCount,
      telemetry.totalPaperTradesCount,
      telemetry.currentPaperPnl.unrealized,
      telemetry.currentPaperPnl.realized,
      telemetry.currentPaperPnl.total,
      telemetry.lastSuccessfulCycle || null,
      telemetry.lastSuccessfulLeaderboardScan || null,
      telemetry.lastSuccessfulWalletScan || null,
      telemetry.lastSuccessfulTradeObservation || null,
      telemetry.lastSuccessfulPnlUpdate || null,
      telemetry.lastSuccessfulOutcomeReview || null,
      telemetry.lastSuccessfulReport || null,
      telemetry.ingestionProviderHealth,
      telemetry.currentDataFreshness,
      telemetry.lastError || null,
      telemetry.lastErrorJob || null,
      JSON.stringify(telemetry),
      telemetry.capturedAt
    );
  }

  /**
   * Retrieves the latest historical telemetry snapshot.
   */
  public getLatestTelemetry(): RuntimeTelemetry | null {
    const stmt = this.db.prepare('SELECT * FROM runtime_telemetry ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapTelemetryRow(row);
  }

  /**
   * Lists recent telemetry snapshots.
   */
  public listRecentTelemetry(limit = 50): RuntimeTelemetry[] {
    const stmt = this.db.prepare('SELECT * FROM runtime_telemetry ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapTelemetryRow(r));
  }

  private mapStateRow(row: Record<string, unknown>): RuntimeDaemonState {
    return {
      id: String(row.id),
      lifecycleState: row.lifecycle_state as EngineLifecycleState,
      startedAt: row.started_at ? String(row.started_at) : null,
      stoppedAt: row.stopped_at ? String(row.stopped_at) : null,
      lastHeartbeatAt: row.last_heartbeat_at ? String(row.last_heartbeat_at) : null,
      lastSuccessfulCycleAt: row.last_successful_cycle_at ? String(row.last_successful_cycle_at) : null,
      cycleCount: Number(row.cycle_count || 0),
      activeJobsCount: Number(row.active_jobs_count || 0),
      lastError: row.last_error ? String(row.last_error) : null,
      lastErrorAt: row.last_error_at ? String(row.last_error_at) : null,
      lastErrorJob: row.last_error_job ? String(row.last_error_job) : null,
      telemetryJson: String(row.telemetry_json || '{}'),
      updatedAt: String(row.updated_at)
    };
  }

  private mapTelemetryRow(row: Record<string, unknown>): RuntimeTelemetry {
    if (row.telemetry_json) {
      try {
        return JSON.parse(String(row.telemetry_json)) as RuntimeTelemetry;
      } catch {
        // Fallback to columns
      }
    }

    return {
      id: String(row.id),
      lifecycleState: row.lifecycle_state as EngineLifecycleState,
      runtimeStartTimestamp: null,
      runtimeStopTimestamp: null,
      lastSuccessfulCycle: row.last_successful_cycle ? String(row.last_successful_cycle) : null,
      lastSuccessfulLeaderboardScan: row.last_leaderboard_scan ? String(row.last_leaderboard_scan) : null,
      lastSuccessfulWalletScan: row.last_wallet_scan ? String(row.last_wallet_scan) : null,
      lastSuccessfulTradeObservation: row.last_trade_observation ? String(row.last_trade_observation) : null,
      lastSuccessfulPnlUpdate: row.last_pnl_update ? String(row.last_pnl_update) : null,
      lastSuccessfulOutcomeReview: row.last_outcome_review ? String(row.last_outcome_review) : null,
      lastSuccessfulReport: row.last_daily_report ? String(row.last_daily_report) : null,
      cycleCount: Number(row.cycle_count || 0),
      activeJobCount: Number(row.active_jobs_count || 0),
      lastError: row.last_error ? String(row.last_error) : null,
      lastErrorTimestamp: null,
      lastErrorJob: row.last_error_job ? String(row.last_error_job) : null,
      currentRuleSetId: '',
      trackedWalletCount: Number(row.tracked_wallets_count || 0),
      activePaperTradeCount: Number(row.open_paper_trades_count || 0),
      totalPaperTradesCount: Number(row.total_paper_trades_count || 0),
      currentPaperPnl: {
        unrealized: Number(row.unrealized_pnl || 0),
        realized: Number(row.realized_pnl || 0),
        total: Number(row.total_pnl || 0)
      },
      ingestionProviderHealth: (row.ingestion_health as any) || 'IDLE',
      currentDataFreshness: (row.market_freshness as any) || 'UNAVAILABLE',
      executionMode: 'PAPER ONLY',
      capturedAt: String(row.created_at)
    };
  }
}
