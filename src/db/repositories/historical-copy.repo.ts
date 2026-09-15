/**
 * Historical Copy Evaluation Repository.
 * 
 * Safety & Integrity:
 * - Persists immutable trade-level copyability research evaluations.
 * - Enforces database-level immutability via SQLite triggers.
 * - Supports batched inserts and deterministic aggregations.
 */

import { DatabaseSync } from 'node:sqlite';
import {
  HistoricalCopyEvaluation,
  WalletCopyabilityAggregation,
  CategoryCopyabilityAggregation,
  CopyabilityClassification,
  ResearchCohort,
  FillModelTier
} from '../../types/domain.js';

export class HistoricalCopyRepository {
  constructor(private db: DatabaseSync) {}

  public saveEvaluation(e: HistoricalCopyEvaluation): void {
    const stmt = this.db.prepare(`
      INSERT INTO historical_copy_evaluations (
        id, wallet_address, observed_trade_id, market_id, timeline_json,
        wallet_entry_price, wallet_entry_size, wallet_entry_timestamp,
        observed_price, observed_timestamp, modeled_copy_price, modeled_copy_timestamp,
        fill_model, spread_at_entry, spread_at_observation, spread_at_copy,
        liquidity_at_entry, liquidity_at_observation, liquidity_at_copy,
        relative_trade_size_to_depth, price_drift, adverse_drift, latency_seconds,
        wallet_outcome, wallet_pnl, modeled_copy_outcome, modeled_copy_pnl, copy_pnl_delta,
        classification, cohort, reason_codes_json, analysis_window,
        rule_set_id, rule_version, normalization_version, dataset_id, dataset_version,
        generated_at, provenance_json, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      e.id,
      e.walletAddress,
      e.observedTradeId,
      e.marketId,
      JSON.stringify(e.timeline),
      e.walletEntryPrice,
      e.walletEntrySize,
      e.walletEntryTimestamp,
      e.observedPrice,
      e.observedTimestamp,
      e.modeledCopyPrice,
      e.modeledCopyTimestamp,
      e.fillModel,
      e.spreadAtEntry,
      e.spreadAtObservation,
      e.spreadAtCopy,
      e.liquidityAtEntry,
      e.liquidityAtObservation,
      e.liquidityAtCopy,
      e.relativeTradeSizeToDepth,
      e.priceDrift,
      e.adverseDrift,
      e.latencySeconds,
      e.walletOutcome,
      e.walletPnl,
      e.modeledCopyOutcome,
      e.modeledCopyPnl,
      e.copyPnlDelta,
      e.classification,
      e.cohort,
      JSON.stringify(e.reasonCodes),
      e.analysisWindow,
      e.ruleSetId,
      e.ruleVersion,
      e.normalizationVersion,
      e.datasetId,
      e.datasetVersion,
      e.generatedAt,
      JSON.stringify(e.provenance),
      e.generatedAt
    );
  }

  public saveBatch(evaluations: HistoricalCopyEvaluation[]): void {
    if (evaluations.length === 0) return;
    this.db.exec('BEGIN TRANSACTION;');
    try {
      for (const e of evaluations) {
        this.saveEvaluation(e);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public findById(id: string): HistoricalCopyEvaluation | null {
    const stmt = this.db.prepare(`SELECT * FROM historical_copy_evaluations WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRowToEvaluation(row) : null;
  }

  public findByTradeId(tradeId: string): HistoricalCopyEvaluation | null {
    const stmt = this.db.prepare(`SELECT * FROM historical_copy_evaluations WHERE observed_trade_id = ?`);
    const row = stmt.get(tradeId) as Record<string, unknown> | undefined;
    return row ? this.mapRowToEvaluation(row) : null;
  }

  public findByWallet(walletAddress: string, window?: string): HistoricalCopyEvaluation[] {
    let sql = `SELECT * FROM historical_copy_evaluations WHERE wallet_address = ?`;
    const params: any[] = [walletAddress];
    if (window) {
      sql += ` AND analysis_window = ?`;
      params.push(window);
    }
    sql += ` ORDER BY wallet_entry_timestamp DESC`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToEvaluation(r));
  }

  public listAll(options?: {
    window?: string;
    classification?: string;
    cohort?: string;
    limit?: number;
  }): HistoricalCopyEvaluation[] {
    let sql = `SELECT * FROM historical_copy_evaluations WHERE 1=1`;
    const params: any[] = [];

    if (options?.window) {
      sql += ` AND analysis_window = ?`;
      params.push(options.window);
    }
    if (options?.classification) {
      sql += ` AND classification = ?`;
      params.push(options.classification);
    }
    if (options?.cohort) {
      sql += ` AND cohort = ?`;
      params.push(options.cohort);
    }

    sql += ` ORDER BY wallet_entry_timestamp DESC`;

    if (options?.limit && options.limit > 0) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToEvaluation(r));
  }

  public getSummary(window?: string) {
    let sql = `
      SELECT 
        COUNT(*) as totalTradesAnalyzed,
        SUM(CASE WHEN classification = 'COPYABLE' THEN 1 ELSE 0 END) as copyableCount,
        SUM(CASE WHEN classification = 'DIFFICULT' THEN 1 ELSE 0 END) as difficultCount,
        SUM(CASE WHEN classification = 'UNFOLLOWABLE' THEN 1 ELSE 0 END) as unfollowableCount,
        SUM(CASE WHEN classification = 'INSUFFICIENT_DATA' THEN 1 ELSE 0 END) as insufficientDataCount,
        SUM(CASE WHEN cohort = 'MISSED_WINNER' THEN 1 ELSE 0 END) as missedWinnerCount,
        SUM(CASE WHEN cohort = 'AVOIDED_LOSER' THEN 1 ELSE 0 END) as avoidedLoserCount,
        COALESCE(SUM(wallet_pnl), 0) as totalWalletPnL,
        COALESCE(SUM(modeled_copy_pnl), 0) as totalModeledCopyPnL,
        COALESCE(SUM(copy_pnl_delta), 0) as totalCopyPnLDelta,
        AVG(latency_seconds) as avgLatencySeconds,
        AVG(spread_at_copy) as avgSpreadAtCopy,
        AVG(liquidity_at_copy) as avgLiquidityAtCopy
      FROM historical_copy_evaluations
      WHERE 1=1
    `;
    const params: any[] = [];
    if (window) {
      sql += ` AND analysis_window = ?`;
      params.push(window);
    }

    const row = this.db.prepare(sql).get(...params) as Record<string, unknown>;
    return {
      totalTradesAnalyzed: Number(row.totalTradesAnalyzed || 0),
      copyableCount: Number(row.copyableCount || 0),
      difficultCount: Number(row.difficultCount || 0),
      unfollowableCount: Number(row.unfollowableCount || 0),
      insufficientDataCount: Number(row.insufficientDataCount || 0),
      missedWinnerCount: Number(row.missedWinnerCount || 0),
      avoidedLoserCount: Number(row.avoidedLoserCount || 0),
      totalWalletPnL: Math.round(Number(row.totalWalletPnL || 0) * 100) / 100,
      totalModeledCopyPnL: Math.round(Number(row.totalModeledCopyPnL || 0) * 100) / 100,
      totalCopyPnLDelta: Math.round(Number(row.totalCopyPnLDelta || 0) * 100) / 100,
      avgLatencySeconds: Math.round(Number(row.avgLatencySeconds || 0) * 100) / 100,
      avgSpreadAtCopy: Math.round(Number(row.avgSpreadAtCopy || 0) * 1000) / 1000,
      avgLiquidityAtCopy: Math.round(Number(row.avgLiquidityAtCopy || 0) * 100) / 100
    };
  }

  private mapRowToEvaluation(r: Record<string, unknown>): HistoricalCopyEvaluation {
    return {
      id: String(r.id),
      walletAddress: String(r.wallet_address),
      observedTradeId: String(r.observed_trade_id),
      marketId: String(r.market_id),
      timeline: JSON.parse(String(r.timeline_json)),
      walletEntryPrice: Number(r.wallet_entry_price),
      walletEntrySize: Number(r.wallet_entry_size),
      walletEntryTimestamp: String(r.wallet_entry_timestamp),
      observedPrice: r.observed_price !== null ? Number(r.observed_price) : null,
      observedTimestamp: r.observed_timestamp !== null ? String(r.observed_timestamp) : null,
      modeledCopyPrice: r.modeled_copy_price !== null ? Number(r.modeled_copy_price) : null,
      modeledCopyTimestamp: r.modeled_copy_timestamp !== null ? String(r.modeled_copy_timestamp) : null,
      fillModel: String(r.fill_model) as FillModelTier,
      spreadAtEntry: r.spread_at_entry !== null ? Number(r.spread_at_entry) : null,
      spreadAtObservation: r.spread_at_observation !== null ? Number(r.spread_at_observation) : null,
      spreadAtCopy: r.spread_at_copy !== null ? Number(r.spread_at_copy) : null,
      liquidityAtEntry: r.liquidity_at_entry !== null ? Number(r.liquidity_at_entry) : null,
      liquidityAtObservation: r.liquidity_at_observation !== null ? Number(r.liquidity_at_observation) : null,
      liquidityAtCopy: r.liquidity_at_copy !== null ? Number(r.liquidity_at_copy) : null,
      relativeTradeSizeToDepth: r.relative_trade_size_to_depth !== null ? Number(r.relative_trade_size_to_depth) : null,
      priceDrift: r.price_drift !== null ? Number(r.price_drift) : null,
      adverseDrift: r.adverse_drift !== null ? Number(r.adverse_drift) : null,
      latencySeconds: r.latency_seconds !== null ? Number(r.latency_seconds) : null,
      walletOutcome: (r.wallet_outcome as 'WIN' | 'LOSS' | 'UNRESOLVED') || null,
      walletPnl: r.wallet_pnl !== null ? Number(r.wallet_pnl) : null,
      modeledCopyOutcome: (r.modeled_copy_outcome as 'WIN' | 'LOSS' | 'UNRESOLVED') || null,
      modeledCopyPnl: r.modeled_copy_pnl !== null ? Number(r.modeled_copy_pnl) : null,
      copyPnlDelta: r.copy_pnl_delta !== null ? Number(r.copy_pnl_delta) : null,
      classification: String(r.classification) as CopyabilityClassification,
      cohort: String(r.cohort) as ResearchCohort,
      reasonCodes: JSON.parse(String(r.reason_codes_json)),
      analysisWindow: String(r.analysis_window),
      ruleSetId: String(r.rule_set_id),
      ruleVersion: String(r.rule_version),
      normalizationVersion: String(r.normalization_version),
      datasetId: String(r.dataset_id),
      datasetVersion: String(r.dataset_version),
      generatedAt: String(r.generated_at),
      provenance: JSON.parse(String(r.provenance_json))
    };
  }
}
